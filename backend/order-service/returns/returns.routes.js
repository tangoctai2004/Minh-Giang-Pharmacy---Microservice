const router = require('express').Router();
const pool = require('../db/pool');

/**
 * [MAPPING: POST /api/order/returns]
 * Tạo yêu cầu trả hàng
 */
router.post('/', async (req, res) => {
    try {
        const { order_id, reason, items } = req.body;
        const [result] = await pool.query(
            'INSERT INTO returns (order_id, reason, status) VALUES (?, ?, ?)',
            [order_id, reason, 'pending']
        );
        const returnId = result.insertId;

        if (items && items.length > 0) {
            for (const item of items) {
                await pool.query(
                    'INSERT INTO return_items (return_id, order_item_id, quantity) VALUES (?, ?, ?)',
                    [returnId, item.order_item_id, item.quantity]
                );
            }
        }

        res.json({ success: true, message: 'Yêu cầu trả hàng đã được gửi', data: { return_id: returnId } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi yêu cầu trả hàng' });
    }
});

module.exports = router;
