const router = require('express').Router();
const pool = require('../db/pool');

/**
 * [MAPPING: POST /api/order/checkout]
 * Tạo đơn hàng từ giỏ hàng
 */
router.post('/', async (req, res) => {
    let connection;
    try {
        const userId = req.userId;
        const {
            customer_name, customer_phone,
            province_id, district_id, ward_id, address_detail,
            payment_method, shipping_fee = 0
        } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Lấy giỏ hàng hiện tại
        const [carts] = await connection.query('SELECT id FROM carts WHERE customer_id = ? AND is_active = 1', [userId]);
        if (carts.length === 0) throw new Error('Giỏ hàng trống');
        const cartId = carts[0].id;

        const [items] = await connection.query('SELECT * FROM cart_items WHERE cart_id = ? AND is_active = 1', [cartId]);
        if (items.length === 0) throw new Error('Giỏ hàng không có sản phẩm');

        // 2. Tính tổng tiền
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const finalAmount = totalAmount + parseFloat(shipping_fee);

        // 3. Tạo đơn hàng (orders)
        const orderCode = `MG${Date.now()}`;
        const [orderResult] = await connection.query(`
            INSERT INTO orders (
                order_code, customer_id, customer_name, customer_phone,
                province_id, district_id, ward_id, address_detail,
                total_amount, shipping_fee, final_amount,
                payment_method, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [
            orderCode, userId, customer_name, customer_phone,
            province_id, district_id, ward_id, address_detail,
            totalAmount, shipping_fee, finalAmount,
            payment_method
        ]);
        const orderId = orderResult.insertId;

        // 4. Chuyển item từ giỏ sang đơn hàng (order_items)
        for (const item of items) {
            await connection.query(`
                INSERT INTO order_items (
                    order_id, product_id, product_name, unit_name,
                    quantity, unit_price, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                orderId, item.product_id, item.product_name, item.unit_name,
                item.quantity, item.unit_price, item.quantity * item.unit_price
            ]);
        }

        // 5. Xóa mềm giỏ hàng sau khi checkout thành công
        await connection.query('UPDATE cart_items SET is_active = 0 WHERE cart_id = ?', [cartId]);

        await connection.commit();
        res.json({
            success: true,
            message: 'Đặt hàng thành công',
            data: { order_id: orderId, order_code: orderCode }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[Checkout] Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi xử lý thanh toán' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
