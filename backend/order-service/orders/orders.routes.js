const router = require('express').Router();
const pool = require('../db/pool');

async function findProductForGift(connection, giftProductName) {
    const cleanName = giftProductName.trim().toLowerCase();
    
    // 1. Exact match (case insensitive)
    const [exactMatches] = await connection.query(
        `SELECT id, name, base_unit FROM mg_catalog.products 
         WHERE LOWER(name) = ? AND status = 'active' LIMIT 1`,
        [cleanName]
    );
    if (exactMatches.length > 0) return exactMatches[0];

    // 2. Fallback: replace space with %
    const wildcardName = '%' + cleanName.replace(/\s+/g, '%') + '%';
    const [likeMatches] = await connection.query(
        `SELECT id, name, base_unit FROM mg_catalog.products 
         WHERE LOWER(name) LIKE ? AND status = 'active' LIMIT 1`,
        [wildcardName]
    );
    if (likeMatches.length > 0) return likeMatches[0];

    // 3. Fallback: search with words > 2 chars
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
        const componentWildcard = '%' + words.join('%') + '%';
        const [componentMatches] = await connection.query(
            `SELECT id, name, base_unit FROM mg_catalog.products 
             WHERE LOWER(name) LIKE ? AND status = 'active' LIMIT 1`,
            [componentWildcard]
        );
        if (componentMatches.length > 0) return componentMatches[0];
    }
    
    return null;
}

/**
 * Helper to find or automatically create a customer by phone number.
 */
async function findOrCreateCustomerByPhone(connection, phone, name) {
    if (!phone) return null;
    
    const normalizedPhone = String(phone).trim();
    if (!normalizedPhone) return null;

    // 1. Check if customer exists
    const [customers] = await connection.query(
        'SELECT id FROM mg_identity.customers WHERE phone = ? AND deleted_at IS NULL LIMIT 1',
        [normalizedPhone]
    );

    if (customers.length > 0) {
        return customers[0].id;
    }

    // 2. Not found -> Auto create
    // Generate unique code KH-XXXX
    const [[maxResult]] = await connection.query('SELECT MAX(id) AS maxId FROM mg_identity.customers');
    const nextId = (maxResult && maxResult.maxId ? maxResult.maxId : 0) + 1;
    const customerCode = `KH-${String(nextId).padStart(4, '0')}`;
    
    // Generate email placeholder
    const placeholderEmail = `${normalizedPhone}@minhgiang.vn`;
    
    // Default hashed password (bcrypt of '123456')
    const defaultPasswordHash = '$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy';
    
    const customerName = name || `Khách hàng ${normalizedPhone}`;

    const [insertResult] = await connection.query(`
        INSERT INTO mg_identity.customers (
            full_name, email, phone, password_hash, code, is_active
        ) VALUES (?, ?, ?, ?, ?, 1)
    `, [customerName, placeholderEmail, normalizedPhone, defaultPasswordHash, customerCode]);

    return insertResult.insertId;
}

async function incrementPromotionSoldQty(connection, productId, quantity) {
    const [promos] = await connection.query(
        `SELECT id FROM mg_catalog.product_tag_promotions
         WHERE product_id = ?
           AND status = 'active'
           AND start_time <= NOW()
           AND end_time >= NOW()
         ORDER BY FIELD(tag_name, 'flash-sale', 'deal', 'discount') ASC
         LIMIT 1`,
        [productId]
    );
    if (promos.length > 0) {
        await connection.query(
            `UPDATE mg_catalog.product_tag_promotions
             SET sold_qty = sold_qty + ?
             WHERE id = ?`,
            [quantity, promos[0].id]
        );
    }
}

async function decrementPromotionSoldQty(connection, productId, quantity) {
    const [promos] = await connection.query(
        `SELECT id FROM mg_catalog.product_tag_promotions
         WHERE product_id = ?
           AND status = 'active'
           AND start_time <= NOW()
           AND end_time >= NOW()
         ORDER BY FIELD(tag_name, 'flash-sale', 'deal', 'discount') ASC
         LIMIT 1`,
        [productId]
    );
    if (promos.length > 0) {
        await connection.query(
            `UPDATE mg_catalog.product_tag_promotions
             SET sold_qty = GREATEST(0, CAST(sold_qty AS SIGNED) - ?)
             WHERE id = ?`,
            [quantity, promos[0].id]
        );
    }
}

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
            items,
            voucher_code
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

        let activeCustomerId = customer_id || null;
        if (!activeCustomerId && customer_phone) {
            activeCustomerId = await findOrCreateCustomerByPhone(connection, customer_phone, customer_name);
        }

        // --- Xử lý Voucher & Quà tặng POS ---
        let calculatedDiscount = 0;
        const promotionsToInsert = [];
        const promoUsageIncrements = [];
        const isPhoneValid = customer_phone && customer_phone.trim().length >= 10;

        if (voucher_code && isPhoneValid) {
            const normalizedCode = voucher_code.trim().toUpperCase();
            const [promos] = await connection.query(
                `SELECT id, name, code, type, discount_value, min_order_value, max_discount_amount, applicable_channel
                 FROM mg_cms.promotions
                 WHERE code = ?
                   AND is_active = 1
                   AND start_date <= NOW()
                   AND end_date >= NOW()
                   AND (usage_limit IS NULL OR usage_count < usage_limit)
                 LIMIT 1`,
                [normalizedCode]
            );

            if (promos.length > 0) {
                const v = promos[0];
                if (v.applicable_channel === 'all' || v.applicable_channel === 'pos') {
                    let disc = 0;
                    if (v.type === 'percent_discount' || v.type === 'percent') {
                        disc = Math.round((subtotal * Number(v.discount_value)) / 100);
                        if (v.max_discount_amount > 0) {
                            disc = Math.min(disc, Number(v.max_discount_amount));
                        }
                    } else {
                        disc = Number(v.discount_value);
                    }
                    calculatedDiscount = disc;
                    promotionsToInsert.push({
                        promotion_id: v.id,
                        promo_code: v.code,
                        promo_name: v.name,
                        promo_type: v.type,
                        discount_value: Number(v.discount_value),
                        discount_applied: disc
                    });
                    promoUsageIncrements.push(v.id);
                }
            }
        }

        if (isPhoneValid) {
            const [activeGifts] = await connection.query(
                `SELECT id, name, gift_product_name, gift_product_qty, min_order_value
                 FROM mg_cms.promotions
                 WHERE type = 'buy_x_get_y'
                   AND is_active = 1
                   AND start_date <= NOW()
                   AND end_date >= NOW()
                   AND (usage_limit IS NULL OR usage_count < usage_limit)
                   AND (applicable_channel = 'all' OR applicable_channel = 'pos')
                   AND min_order_value <= ?
                 ORDER BY min_order_value DESC`,
                [subtotal]
            );

            for (const giftCampaign of activeGifts) {
                const prod = await findProductForGift(connection, giftCampaign.gift_product_name);

                if (prod) {
                    items.push({
                        product_id: prod.id,
                        product_name: `🎁 [Quà tặng] ${prod.name}`,
                        unit_name: prod.base_unit || 'Hộp',
                        quantity: giftCampaign.gift_product_qty || 1,
                        unit_price: 0
                    });

                    promotionsToInsert.push({
                        promotion_id: giftCampaign.id,
                        promo_code: null,
                        promo_name: giftCampaign.name,
                        promo_type: 'buy_x_get_y',
                        discount_value: 0,
                        discount_applied: 0
                    });
                    promoUsageIncrements.push(giftCampaign.id);
                }
            }
        }

        // 2. Thêm đơn hàng vào bảng orders
        const [orderResult] = await connection.query(`
            INSERT INTO orders (
                order_code, order_channel, customer_id, customer_name, customer_phone,
                shipping_address, subtotal, shipping_fee, discount_amount, total_amount,
                payment_method, payment_status, order_status, requires_vat_invoice
            ) VALUES (?, 'pos', ?, ?, ?, NULL, ?, 0, ?, ?, ?, 'paid', 'completed', 0)
        `, [
            orderCode, activeCustomerId, customer_name || 'Khách vãng lai', customer_phone || null,
            subtotal, discount_amount || calculatedDiscount, total_amount, payment_method || 'cash'
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

            // Cập nhật sold_qty của promotion active
            await incrementPromotionSoldQty(connection, item.product_id, item.quantity);
        }

        // 3.5. Ghi nhận lịch sử khuyến mãi (order_promotions) & tăng lượt sử dụng trong CMS
        for (const promo of promotionsToInsert) {
            await connection.query(`
                INSERT INTO order_promotions (
                    order_id, promotion_id, promo_code_snapshot, promo_name_snapshot,
                    promo_type_snapshot, discount_value_snapshot, discount_applied
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                orderId, promo.promotion_id, promo.promo_code, promo.promo_name,
                promo.promo_type, promo.discount_value, promo.discount_applied
            ]);
        }

        for (const promoId of promoUsageIncrements) {
            await connection.query(
                `UPDATE mg_cms.promotions SET usage_count = usage_count + 1 WHERE id = ?`,
                [promoId]
            );
        }

        // 4. Tích lũy điểm & Khấu trừ điểm trong mg_identity.customers & ghi nhận lịch sử vào mg_identity.loyalty_points_transactions
        if (activeCustomerId) {
            const pointsEarned = Math.floor(total_amount / 10);
            const voucherDiscountTotal = promotionsToInsert.reduce((sum, p) => sum + (p.discount_applied || 0), 0);
            const pointsRedeemed = Math.max(0, (discount_amount || 0) - voucherDiscountTotal);
            const netPointsChange = pointsEarned - pointsRedeemed;

            if (netPointsChange !== 0) {
                await connection.query(`
                    UPDATE mg_identity.customers 
                    SET loyalty_points = loyalty_points + ? 
                    WHERE id = ?
                `, [netPointsChange, activeCustomerId]);
            }

            if (pointsEarned > 0) {
                await connection.query(`
                    INSERT INTO mg_identity.loyalty_points_transactions (
                        customer_id, transaction_type, points_change, description, reference_order_id
                    ) VALUES (?, 'earn_purchase', ?, ?, ?)
                `, [
                    activeCustomerId,
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
                    activeCustomerId,
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
        const { status, channel, search, customer_id, customer_phone, date_from, date_to, page = 1, limit = 10 } = req.query;
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

        if (customer_id && isStaffOrAdmin) {
            if (customer_phone) {
                query += ' AND (customer_id = ? OR customer_phone = ?)';
                params.push(customer_id, customer_phone);
            } else {
                query += ' AND customer_id = ?';
                params.push(customer_id);
            }
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
        const [promotions] = await pool.query('SELECT * FROM order_promotions WHERE order_id = ?', [orderId]);
        res.json({ success: true, data: { ...orders[0], items, promotions } });
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
    let connection;
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending_approval', 'confirmed', 'picking', 'shipping', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let [orders] = await connection.query('SELECT * FROM orders WHERE id = ? AND is_active = 1 FOR UPDATE', [id]);
        if (orders.length === 0) {
            const [ordersByCode] = await connection.query('SELECT * FROM orders WHERE order_code = ? AND is_active = 1 FOR UPDATE', [id]);
            if (ordersByCode.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
            }
            orders[0] = ordersByCode[0];
        }
        const realId = orders[0].id;
        const order = orders[0];
        const oldStatus = order.order_status;

        // Bổ sung kiểm soát quyền đối với khách hàng (Customer)
        const isCustomer = req.userType === 'customer';
        if (isCustomer) {
            if (status !== 'cancelled') {
                await connection.rollback();
                return res.status(403).json({ success: false, message: 'Khách hàng chỉ có quyền hủy đơn hàng.' });
            }
            if (order.customer_id !== req.userId) {
                await connection.rollback();
                return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn hàng này.' });
            }
            if (oldStatus !== 'pending_approval') {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn hàng khi đơn đang ở trạng thái chờ duyệt.' });
            }
        }

        let updateQuery = 'UPDATE orders SET order_status = ?';
        let updateParams = [status];

        if (status === 'completed') {
            updateQuery += ", payment_status = 'paid'";
        }

        updateQuery += ' WHERE id = ?';
        updateParams.push(realId);

        await connection.query(updateQuery, updateParams);

        // Xử lý Trừ kho và Cập nhật Promotion khi chuyển sang Completed (đối với Web order)
        if (oldStatus !== 'completed' && status === 'completed') {
            if (order.order_channel === 'web') {
                const [orderItems] = await connection.query(
                    'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND is_active = 1',
                    [realId]
                );
                for (const item of orderItems) {
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

                    await incrementPromotionSoldQty(connection, item.product_id, item.quantity);
                }
            }
        }
        // Xử lý Hoàn kho và Cập nhật Promotion khi chuyển từ Completed sang Cancelled (đối với Web order)
        else if (oldStatus === 'completed' && status === 'cancelled') {
            if (order.order_channel === 'web') {
                const [orderItems] = await connection.query(
                    'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND is_active = 1',
                    [realId]
                );
                for (const item of orderItems) {
                    const [batches] = await connection.query(`
                        SELECT id FROM mg_catalog.batch_items 
                        WHERE product_id = ? AND status = 'available'
                        LIMIT 1
                    `, [item.product_id]);
                    if (batches.length > 0) {
                        await connection.query(`
                            UPDATE mg_catalog.batch_items 
                            SET quantity_remaining = quantity_remaining + ? 
                            WHERE id = ?
                        `, [item.quantity, batches[0].id]);
                    }
                    await decrementPromotionSoldQty(connection, item.product_id, item.quantity);
                }
            }
        }

        // Tích lũy điểm khi chuyển sang completed và hoàn điểm khi chuyển sang cancelled
        let activeCustomerId = order.customer_id;
        if (activeCustomerId) {
            // Kiểm tra xem khách hàng có thực sự tồn tại trong mg_identity hay không
            const [[custExists]] = await connection.query(
                'SELECT id FROM mg_identity.customers WHERE id = ?',
                [activeCustomerId]
            );
            if (!custExists) {
                activeCustomerId = null;
            }
        }

        if (!activeCustomerId && order.customer_phone) {
            activeCustomerId = await findOrCreateCustomerByPhone(connection, order.customer_phone, order.customer_name);
            await connection.query('UPDATE orders SET customer_id = ? WHERE id = ?', [activeCustomerId, realId]);
        }

        if (activeCustomerId) {
            // Query total voucher discount from order_promotions
            const [[promoSum]] = await connection.query(
                'SELECT SUM(discount_applied) AS total_promo_discount FROM order_promotions WHERE order_id = ?',
                [realId]
            );
            const voucherDiscountTotal = Number(promoSum?.total_promo_discount || 0);
            const pointsEarned = Math.floor(order.total_amount / 10);
            const pointsRedeemed = Math.max(0, (order.discount_amount || 0) - voucherDiscountTotal);
            const netPointsChange = pointsEarned - pointsRedeemed;

            // 1. Chuyển từ trạng thái khác sang completed -> Cộng điểm tích lũy
            if (oldStatus !== 'completed' && status === 'completed') {
                if (netPointsChange !== 0) {
                    await connection.query(`
                        UPDATE mg_identity.customers 
                        SET loyalty_points = loyalty_points + ? 
                        WHERE id = ?
                    `, [netPointsChange, activeCustomerId]);
                }

                if (pointsEarned > 0) {
                    await connection.query(`
                        INSERT INTO mg_identity.loyalty_points_transactions (
                            customer_id, transaction_type, points_change, description, reference_order_id
                        ) VALUES (?, 'earn_purchase', ?, ?, ?)
                    `, [
                        activeCustomerId,
                        pointsEarned,
                        `Tích điểm mua hàng - Đơn ${order.order_code}`,
                        order.id
                    ]);
                }

                if (pointsRedeemed > 0) {
                    await connection.query(`
                        INSERT INTO mg_identity.loyalty_points_transactions (
                            customer_id, transaction_type, points_change, description, reference_order_id
                        ) VALUES (?, 'redeem', ?, ?, ?)
                    `, [
                        activeCustomerId,
                        -pointsRedeemed,
                        `Quy đổi điểm giảm giá - Đơn ${order.order_code}`,
                        order.id
                    ]);
                }
            }
            // 2. Chuyển từ completed sang cancelled -> Thu hồi/Hoàn trả điểm
            else if (oldStatus === 'completed' && status === 'cancelled') {
                if (netPointsChange !== 0) {
                    await connection.query(`
                        UPDATE mg_identity.customers 
                        SET loyalty_points = loyalty_points - ? 
                        WHERE id = ?
                    `, [netPointsChange, activeCustomerId]);
                }

                if (pointsEarned > 0) {
                    await connection.query(`
                        INSERT INTO mg_identity.loyalty_points_transactions (
                            customer_id, transaction_type, points_change, description, reference_order_id
                        ) VALUES (?, 'adjust_deduct', ?, ?, ?)
                    `, [
                        activeCustomerId,
                        -pointsEarned,
                        `Thu hồi điểm thưởng (Hủy đơn) - Đơn ${order.order_code}`,
                        order.id
                    ]);
                }

                if (pointsRedeemed > 0) {
                    await connection.query(`
                        INSERT INTO mg_identity.loyalty_points_transactions (
                            customer_id, transaction_type, points_change, description, reference_order_id
                        ) VALUES (?, 'adjust_add', ?, ?, ?)
                    `, [
                        activeCustomerId,
                        pointsRedeemed,
                        `Hoàn lại điểm đã tiêu (Hủy đơn) - Đơn ${order.order_code}`,
                        order.id
                    ]);
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: `Đã cập nhật trạng thái đơn hàng thành ${status}` });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[Update Order Status Error]', error);
        res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái đơn hàng' });
    } finally {
        if (connection) connection.release();
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
