const router = require('express').Router();
const pool = require('../db/pool');

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
        const { status, channel, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.userId;
        const userRole = req.userRole;

        let query = 'SELECT * FROM orders WHERE is_active = 1';
        let params = [];

        // Nếu là khách hàng, chỉ xem đơn của mình
        if (userRole !== 'admin') {
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
