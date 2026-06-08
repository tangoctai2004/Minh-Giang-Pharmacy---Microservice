const router = require('express').Router();
const pool = require('../db/pool');

function buildReturnCode() {
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const suffix = String(Date.now()).slice(-5);
    return `RET-${date}-${suffix}`;
}

/**
 * [MAPPING: POST /api/order/returns]
 * Tạo yêu cầu trả hàng
 */
router.post('/', async (req, res) => {
    let connection;
    try {
        const { order_id, reason, refund_method = 'original_payment', items } = req.body;

        if (!order_id || !reason || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Thiếu order_id, reason hoặc danh sách sản phẩm trả' });
        }

        if (!['cash', 'original_payment', 'store_credit'].includes(refund_method)) {
            return res.status(400).json({ success: false, message: 'refund_method không hợp lệ' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[order]] = await connection.query(
            'SELECT id, order_channel, order_status, payment_status FROM orders WHERE id = ?',
            [order_id]
        );
        if (!order) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        if (order.order_status !== 'completed' || order.payment_status !== 'paid') {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Chỉ tạo trả hàng cho đơn đã hoàn tất và đã thanh toán' });
        }

        const orderItemIds = items.map((item) => Number(item.order_item_id)).filter(Boolean);
        if (orderItemIds.length !== items.length) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'order_item_id không hợp lệ' });
        }

        const [orderItems] = await connection.query(
            `SELECT id, quantity, unit_price, prescription_id
             FROM order_items
             WHERE order_id = ? AND id IN (?)`,
            [order_id, orderItemIds]
        );
        const itemById = new Map(orderItems.map((item) => [Number(item.id), item]));

        let refundAmount = 0;
        const normalizedItems = [];
        for (const item of items) {
            const orderItemId = Number(item.order_item_id);
            const quantityReturned = Number(item.quantity_returned || item.quantity);
            const orderItem = itemById.get(orderItemId);

            if (!orderItem) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: `Dòng hàng ${orderItemId} không thuộc đơn này` });
            }
            if (!Number.isInteger(quantityReturned) || quantityReturned <= 0 || quantityReturned > Number(orderItem.quantity)) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: `Số lượng trả của dòng ${orderItemId} không hợp lệ` });
            }
            if (orderItem.prescription_id) {
                await connection.rollback();
                return res.status(409).json({ success: false, message: 'Không tạo trả hàng tự động cho thuốc kê đơn' });
            }

            refundAmount += quantityReturned * Number(orderItem.unit_price);
            normalizedItems.push({ order_item_id: orderItemId, quantity_returned: quantityReturned });
        }

        const returnCode = buildReturnCode();
        const [result] = await connection.query(
            `INSERT INTO returns (
                return_code, order_id, order_channel, reason,
                refund_amount, refund_method, status
             ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [returnCode, order_id, order.order_channel, reason, refundAmount, refund_method]
        );
        const returnId = result.insertId;

        for (const item of normalizedItems) {
            await connection.query(
                `INSERT INTO return_items (
                    return_id, order_item_id, quantity_returned, return_to_stock
                 ) VALUES (?, ?, ?, 0)`,
                [returnId, item.order_item_id, item.quantity_returned]
            );
        }

        await connection.commit();
        res.status(201).json({
            success: true,
            message: 'Yêu cầu trả hàng đã được gửi',
            data: { return_id: returnId, return_code: returnCode, refund_amount: refundAmount }
        });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi yêu cầu trả hàng' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
