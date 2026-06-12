const router = require('express').Router();
const pool = require('../db/pool');

/**
 * [MAPPING: POST /api/order/orders]
 * Tạo đơn hàng POS mới & trừ tồn kho thực tế trong mg_catalog.batch_items (FEFO)
 */
router.post('/', async (req, res) => {
    let connection;
    try {
        const {
            customer_id,
            customer_name,
            customer_phone,
            subtotal,
            discount_amount,
            total_amount,
            payment_method,
            items
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh sách sản phẩm không hợp lệ' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Tạo mã đơn hàng độc nhất dạng POS-YYYYMMDD-XXXX
        const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        const orderCode = `POS-${todayStr}-${randomStr}`;

        // 2. Thêm đơn hàng vào bảng orders
        const [orderResult] = await connection.query(`
            INSERT INTO orders (
                order_code, order_channel, customer_id, customer_name, customer_phone,
                shipping_address, subtotal, shipping_fee, discount_amount, total_amount,
                payment_method, payment_status, order_status, requires_vat_invoice
            ) VALUES (?, 'pos', ?, ?, ?, NULL, ?, 0, ?, ?, ?, 'paid', 'completed', 0)
        `, [
            orderCode, customer_id || null, customer_name || 'Khách vãng lai', customer_phone || null,
            subtotal, discount_amount || 0, total_amount, payment_method || 'cash'
        ]);
        const orderId = orderResult.insertId;

        // 3. Thêm các chi tiết đơn hàng (order_items) & trừ tồn kho thực tế trong mg_catalog.batch_items
        for (const item of items) {
            await connection.query(`
                INSERT INTO order_items (
                    order_id, product_id, product_name, unit_name,
                    quantity, unit_price, total_price
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                orderId, item.product_id, item.product_name, item.unit_name || 'Hộp',
                item.quantity, item.unit_price, item.quantity * item.unit_price
            ]);

            // Trừ tồn kho trong mg_catalog.batch_items theo FEFO
            let remainingToDeduct = item.quantity;

            const [batches] = await connection.query(`
                SELECT id, quantity_remaining, lot_number, expiry_date 
                FROM mg_catalog.batch_items 
                WHERE product_id = ? AND quantity_remaining > 0 AND status IN ('available', 'near_expiry')
                ORDER BY expiry_date ASC
            `, [item.product_id]);

            for (const batch of batches) {
                if (remainingToDeduct <= 0) break;

                const deductAmount = Math.min(remainingToDeduct, batch.quantity_remaining);
                await connection.query(`
                    UPDATE mg_catalog.batch_items 
                    SET quantity_remaining = quantity_remaining - ? 
                    WHERE id = ?
                `, [deductAmount, batch.id]);

                remainingToDeduct -= deductAmount;
            }

            if (remainingToDeduct > 0 && batches.length > 0) {
                await connection.query(`
                    UPDATE mg_catalog.batch_items 
                    SET quantity_remaining = quantity_remaining - ? 
                    WHERE id = ?
                `, [remainingToDeduct, batches[0].id]);
            }
        }

        // 4. Tích lũy điểm & Khấu trừ điểm trong mg_identity.customers & ghi nhận lịch sử vào mg_identity.loyalty_points_transactions
        if (customer_id) {
            const pointsEarned = Math.floor(total_amount / 10000);
            const pointsRedeemed = discount_amount || 0;
            const netPointsChange = pointsEarned - pointsRedeemed;

            if (netPointsChange !== 0) {
                await connection.query(`
                    UPDATE mg_identity.customers 
                    SET loyalty_points = loyalty_points + ? 
                    WHERE id = ?
                `, [netPointsChange, customer_id]);
            }

            if (pointsEarned > 0) {
                await connection.query(`
                    INSERT INTO mg_identity.loyalty_points_transactions (
                        customer_id, transaction_type, points_change, description, reference_order_id
                    ) VALUES (?, 'earn_purchase', ?, ?, ?)
                `, [
                    customer_id,
                    pointsEarned,
                    `Tích điểm mua hàng tại POS - Đơn ${orderCode}`,
                    orderId
                ]);
            }

            if (pointsRedeemed > 0) {
                await connection.query(`
                    INSERT INTO mg_identity.loyalty_points_transactions (
                        customer_id, transaction_type, points_change, description, reference_order_id
                    ) VALUES (?, 'redeem', ?, ?, ?)
                `, [
                    customer_id,
                    -pointsRedeemed,
                    `Quy đổi điểm giảm giá tại POS - Đơn ${orderCode}`,
                    orderId
                ]);
            }
        }

        await connection.commit();
        res.json({
            success: true,
            message: 'Thanh toán & trừ kho thành công!',
            data: { order_id: orderId, order_code: orderCode }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[POS Checkout API Error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi xử lý thanh toán đơn hàng' });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * [MAPPING: GET /api/order/orders/stats]
 * Thống kê đơn hàng (dành cho Admin/Dashboard)
 */
router.get('/stats', async (req, res) => {
    try {
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN order_status = 'pending_approval' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN order_status != 'pending_approval' AND order_status != 'cancelled' AND DATE(updated_at) = CURDATE() THEN 1 ELSE 0 END) as today_approved_count,
                SUM(CASE WHEN order_status = 'cancelled' AND MONTH(updated_at) = MONTH(CURDATE()) AND YEAR(updated_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as month_cancelled_count,
                SUM(CASE WHEN order_channel = 'pos' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_pos_count,
                COALESCE(SUM(total_amount), 0) as total_revenue
            FROM orders
            WHERE is_active = 1
        `);
        res.json({ success: true, data: stats[0] });
    } catch (error) {
        console.error('[Get Stats Error]', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy thống kê' });
    }
});

/**
 * [MAPPING: GET /api/order/orders]
 * Lấy danh sách đơn hàng có tìm kiếm, trạng thái, kênh bán và phân trang
 */
router.get('/', async (req, res) => {
    try {
        const { status, channel, search, date_from, date_to, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.userId;
        const userRole = req.userRole;

        let query = 'SELECT * FROM orders WHERE is_active = 1';
        let params = [];

        // Nếu là khách hàng (không phải staff/admin), chỉ xem đơn của mình
        const isStaffOrAdmin = req.userType === 'staff' || ['admin', 'pharmacist', 'cashier', 'staff'].includes(userRole);
        if (!isStaffOrAdmin) {
            query += ' AND customer_id = ?';
            params.push(userId);
        }

        if (status) {
            query += ' AND order_status = ?';
            params.push(status);
        }

        if (channel) {
            query += ' AND order_channel = ?';
            params.push(channel);
        }

        if (search) {
            query += ' AND (order_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Lọc theo khoảng ngày
        if (date_from) {
            query += ' AND DATE(created_at) >= ?';
            params.push(date_from);
        }
        if (date_to) {
            query += ' AND DATE(created_at) <= ?';
            params.push(date_to);
        }

        // Đếm tổng số đơn để phân trang
        let countQuery = query.replace('SELECT * FROM orders', 'SELECT COUNT(*) as total FROM orders');
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [orders] = await pool.query(query, params);
        res.json({ 
            success: true, 
            data: orders, 
            pagination: { 
                total: parseInt(total),
                page: parseInt(page), 
                limit: parseInt(limit) 
            } 
        });
    } catch (error) {
        console.error('[Get Orders Error]', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đơn hàng' });
    }
});

/**
 * [MAPPING: GET /api/order/orders/:id]
 * Chi tiết đơn hàng (hỗ trợ cả ID số hoặc order_code)
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let [orders] = await pool.query('SELECT * FROM orders WHERE id = ? AND is_active = 1', [id]);
        if (orders.length === 0) {
            const [ordersByCode] = await pool.query('SELECT * FROM orders WHERE order_code = ? AND is_active = 1', [id]);
            if (ordersByCode.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
            }
            orders[0] = ordersByCode[0];
        }
        const orderId = orders[0].id;
        const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ? AND is_active = 1', [orderId]);
        res.json({ success: true, data: { ...orders[0], items } });
    } catch (error) {
        console.error('[Get Order Detail Error]', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết đơn hàng' });
    }
});

/**
 * [MAPPING: PUT /api/order/orders/:id/status]
 * Cập nhật trạng thái đơn hàng (Admin/Staff)
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending_approval', 'confirmed', 'picking', 'shipping', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        let [orders] = await pool.query('SELECT * FROM orders WHERE id = ? AND is_active = 1', [id]);
        if (orders.length === 0) {
            const [ordersByCode] = await pool.query('SELECT * FROM orders WHERE order_code = ? AND is_active = 1', [id]);
            if (ordersByCode.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
            }
            orders[0] = ordersByCode[0];
        }
        const realId = orders[0].id;

        let updateQuery = 'UPDATE orders SET order_status = ?';
        let updateParams = [status];

        if (status === 'completed') {
            updateQuery += ", payment_status = 'paid'";
        }

        updateQuery += ' WHERE id = ?';
        updateParams.push(realId);

        await pool.query(updateQuery, updateParams);
        res.json({ success: true, message: `Đã cập nhật trạng thái đơn hàng thành ${status}` });
    } catch (error) {
        console.error('[Update Order Status Error]', error);
        res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái đơn hàng' });
    }
});

/**
 * [MAPPING: PUT /api/order/orders/:id/approve]
 * Duyệt đơn hàng (Admin) - Giữ để tương thích ngược
 */
router.put('/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        let [orders] = await pool.query('SELECT * FROM orders WHERE id = ? AND is_active = 1', [id]);
        if (orders.length === 0) {
            const [ordersByCode] = await pool.query('SELECT * FROM orders WHERE order_code = ? AND is_active = 1', [id]);
            if (ordersByCode.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
            }
            orders[0] = ordersByCode[0];
        }
        const realId = orders[0].id;
        await pool.query("UPDATE orders SET order_status = 'confirmed' WHERE id = ? AND order_status = 'pending_approval'", [realId]);
        res.json({ success: true, message: 'Đã duyệt đơn hàng' });
    } catch (error) {
        console.error('[Approve Order Error]', error);
        res.status(500).json({ success: false, message: 'Lỗi khi duyệt đơn hàng' });
    }
});

module.exports = router;
