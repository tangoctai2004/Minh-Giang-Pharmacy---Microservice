const router = require('express').Router();
const pool = require('../db/pool');

/**
 * [MAPPING: POST /api/order/checkout]
 * Tạo đơn hàng từ giỏ hàng (Checkout)
 */
router.post('/', async (req, res) => {
    let connection;
    try {
        const userId = req.userId;
        const {
            customer_name, customer_phone,
            shipping_address, payment_method,
            shipping_fee = 0, discount_amount = 0,
            requires_vat_invoice = false, customer_notes = null,
            order_code = null
        } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thanh toán.' });
        }

        if (!customer_name || !customer_phone || !shipping_address) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin người nhận hoặc địa chỉ giao hàng.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Lấy giỏ hàng hiện tại của user
        const [carts] = await connection.query('SELECT id FROM carts WHERE customer_id = ? AND is_active = 1 LIMIT 1', [userId]);
        if (carts.length === 0) {
            throw new Error('Giỏ hàng trống hoặc không tồn tại.');
        }
        const cartId = carts[0].id;

        // 2. Lấy danh sách item đang hoạt động trong giỏ
        const [items] = await connection.query('SELECT * FROM cart_items WHERE cart_id = ? AND is_active = 1', [cartId]);
        if (items.length === 0) {
            throw new Error('Giỏ hàng không có sản phẩm nào để thanh toán.');
        }

        // 3. Tính toán các khoản tiền
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const parsedShippingFee = parseFloat(shipping_fee) || 0;
        const parsedDiscountAmount = parseFloat(discount_amount) || 0;
        const totalAmount = subtotal + parsedShippingFee - parsedDiscountAmount;

        // 4. Tạo mã đơn hàng độc nhất dạng WEB-YYYYMMDD-XXXX
        let orderCode = order_code;
        if (!orderCode) {
            const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
            const randomStr = Math.floor(1000 + Math.random() * 9000);
            orderCode = `WEB-${todayStr}-${randomStr}`;
        }

        // Validate payment method matches ENUM ('cash','cod','vnpay','momo','card_visa','qr_transfer')
        const validPaymentMethods = ['cash', 'cod', 'vnpay', 'momo', 'card_visa', 'qr_transfer'];
        const mappedPaymentMethod = validPaymentMethods.includes(payment_method) ? payment_method : 'cod';

        // 5. Tạo đơn hàng (orders)
        const [orderResult] = await connection.query(`
            INSERT INTO orders (
                order_code, order_channel, customer_id, customer_name, customer_phone,
                shipping_address, subtotal, shipping_fee, discount_amount, total_amount,
                payment_method, payment_status, order_status, requires_vat_invoice, customer_notes
            ) VALUES (?, 'web', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending_approval', ?, ?)
        `, [
            orderCode, userId, customer_name, customer_phone,
            shipping_address, subtotal, parsedShippingFee, parsedDiscountAmount, totalAmount,
            mappedPaymentMethod, requires_vat_invoice ? 1 : 0, customer_notes
        ]);
        const orderId = orderResult.insertId;

        // 6. Chuyển item từ giỏ sang đơn hàng (order_items)
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
        }

        // 7. Xóa mềm giỏ hàng sau khi checkout thành công
        await connection.query('UPDATE cart_items SET is_active = 0 WHERE cart_id = ?', [cartId]);

        await connection.commit();
        res.json({
            success: true,
            message: 'Đặt hàng thành công!',
            data: { order_id: orderId, order_code: orderCode }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[Checkout API Error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi xử lý thanh toán' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
