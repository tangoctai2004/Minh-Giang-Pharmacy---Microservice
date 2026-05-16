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
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(final_amount) as total_revenue
            FROM orders
            WHERE is_active = 1
        `);
        res.json({ success: true, data: stats[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi lấy thống kê' });
    }
});

/**
 * [MAPPING: GET /api/order/orders]
 * Lấy danh sách đơn hàng
 */
router.get('/', async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
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
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [orders] = await pool.query(query, params);
        res.json({ success: true, data: orders, pagination: { page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đơn hàng' });
    }
});

/**
 * [MAPPING: GET /api/order/orders/:id]
 * Chi tiết đơn hàng
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [orders] = await pool.query('SELECT * FROM orders WHERE id = ? AND is_active = 1', [id]);
        if (orders.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

        const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
        res.json({ success: true, data: { ...orders[0], items } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết đơn hàng' });
    }
});

/**
 * [MAPPING: PUT /api/order/orders/:id/approve]
 * Duyệt đơn hàng (Admin)
 */
router.put('/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE orders SET status = 'approved' WHERE id = ? AND status = 'pending'", [id]);
        res.json({ success: true, message: 'Đã duyệt đơn hàng' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi duyệt đơn hàng' });
    }
});

module.exports = router;
