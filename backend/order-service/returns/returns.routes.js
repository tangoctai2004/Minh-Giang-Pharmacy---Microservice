const router = require('express').Router();
const pool = require('../db/pool');

/**
 * [MAPPING: POST /api/order/returns]
 * Tạo yêu cầu trả hàng
 */
router.post('/', async (req, res) => {
    try {
        const { order_id, reason, items, order_channel, refund_amount, refund_method } = req.body;
        const returnCode = `RET-${Date.now()}`;
        
        const [result] = await pool.query(
            'INSERT INTO returns (return_code, order_id, order_channel, reason, refund_amount, refund_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [returnCode, order_id, order_channel || 'pos', reason, refund_amount || 0, refund_method || 'cash', 'pending']
        );
        const returnId = result.insertId;

        if (items && items.length > 0) {
            for (const item of items) {
                await pool.query(
                    'INSERT INTO return_items (return_id, order_item_id, quantity_returned) VALUES (?, ?, ?)',
                    [returnId, item.order_item_id, item.quantity]
                );
            }
        }

        res.json({ success: true, message: 'Yêu cầu trả hàng đã được gửi', data: { return_id: returnId, return_code: returnCode } });
    } catch (error) {
        console.error('[Return POST Error]:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi yêu cầu trả hàng' });
    }
});

/**
 * [MAPPING: GET /api/order/returns/stats]
 * Thống kê phiếu trả hàng
 */
router.get('/stats', async (req, res) => {
    try {
        const [[{ pending_count }]] = await pool.query("SELECT COUNT(*) as pending_count FROM returns WHERE status = 'pending' AND is_active = 1");
        const [[{ completed_count }]] = await pool.query("SELECT COUNT(*) as completed_count FROM returns WHERE status = 'completed' AND is_active = 1");
        const [[{ rejected_count }]] = await pool.query("SELECT COUNT(*) as rejected_count FROM returns WHERE status = 'rejected' AND is_active = 1");
        const [[{ total_refund }]] = await pool.query("SELECT SUM(refund_amount) as total_refund FROM returns WHERE status = 'completed' AND is_active = 1");

        res.json({
            success: true,
            data: {
                pending: pending_count || 0,
                completed: completed_count || 0,
                rejected: rejected_count || 0,
                total_refund: total_refund || 0
            }
        });
    } catch (error) {
        console.error('[Return Stats Error]:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy thống kê trả hàng' });
    }
});

/**
 * [MAPPING: GET /api/order/returns]
 * Lấy danh sách phiếu trả hàng (có lọc, phân trang)
 */
router.get('/', async (req, res) => {
    try {
        const { channel, status, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT r.*, o.customer_name, o.customer_phone, o.order_code 
            FROM returns r
            LEFT JOIN orders o ON r.order_id = o.id
            WHERE r.is_active = 1
        `;
        let params = [];

        if (channel) {
            query += ' AND r.order_channel = ?';
            params.push(channel);
        }

        if (status && status !== 'Tất cả trạng thái') {
            const statusMap = {
                'Chờ xử lý': 'pending',
                'Đã nhập kho': 'completed',
                'Đã xuất & hoàn tiền': 'completed',
                'Đã tiêu hủy': 'rejected',
                'Từ chối': 'rejected'
            };
            const mappedStatus = statusMap[status] || status;
            query += ' AND r.status = ?';
            params.push(mappedStatus);
        }

        if (search) {
            query += ' AND (r.return_code LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.order_code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        let countQuery = query.replace('SELECT r.*, o.customer_name, o.customer_phone, o.order_code', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [returns] = await pool.query(query, params);

        res.json({
            success: true,
            data: returns,
            pagination: { total: parseInt(total), page: parseInt(page), limit: parseInt(limit) }
        });
    } catch (error) {
        console.error('[Get Returns List Error]:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách phiếu trả hàng' });
    }
});

/**
 * [MAPPING: GET /api/order/returns/:id]
 * Lấy chi tiết phiếu trả hàng
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        let [returns] = await pool.query(`
            SELECT r.*, o.customer_name, o.customer_phone, o.order_code
            FROM returns r
            LEFT JOIN orders o ON r.order_id = o.id
            WHERE r.return_code = ? AND r.is_active = 1
        `, [id]);

        if (returns.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu trả hàng' });
        }

        const returnRecord = returns[0];

        const [items] = await pool.query(`
            SELECT ri.*, oi.product_name, oi.unit_price, oi.unit_name
            FROM return_items ri
            JOIN order_items oi ON ri.order_item_id = oi.id
            WHERE ri.return_id = ? AND ri.is_active = 1
        `, [returnRecord.id]);

        res.json({ success: true, data: { ...returnRecord, items } });
    } catch (error) {
        console.error('[Get Return Detail Error]:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết phiếu trả hàng' });
    }
});

/**
 * [MAPPING: PUT /api/order/returns/:id/status]
 * Cập nhật trạng thái phiếu trả hàng
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const [updateResult] = await pool.query(
            'UPDATE returns SET status = ? WHERE return_code = ? AND is_active = 1',
            [status, id]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu trả hàng' });
        }

        res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
    } catch (error) {
        console.error('[Update Return Status Error]:', error);
        res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái phiếu' });
    }
});

module.exports = router;
