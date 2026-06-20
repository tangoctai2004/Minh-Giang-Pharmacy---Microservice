const router = require('express').Router();
const redisUtil = require('../utils/redis');
const rabbitmq = require('../utils/rabbitmq');

/**
 * [MAPPING: POST /api/order/flashsale/preheat]
 * Preheat stock to Redis cache
 */
router.post('/preheat', async (req, res) => {
    try {
        const { product_id, stock_qty } = req.body;
        if (!product_id || stock_qty === undefined) {
            return res.status(400).json({ success: false, message: 'Thiếu product_id hoặc stock_qty' });
        }

        const stockKey = `flashsale:stock:${product_id}`;
        await redisUtil.redisClient.set(stockKey, String(stock_qty));
        console.log(`[Flashsale] Preheated stock for product ${product_id} to ${stock_qty} in Redis.`);
        
        res.json({ success: true, message: `Tải tồn kho sản phẩm ${product_id} lên Redis thành công: ${stock_qty}` });
    } catch (err) {
        console.error('[Flashsale Preheat Error]:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi preheat tồn kho: ' + err.message });
    }
});

/**
 * [MAPPING: POST /api/order/flashsale/reserve]
 * Reserve a product slot using Redis Lua script with a 10-second TTL
 */
router.post('/reserve', async (req, res) => {
    try {
        const { product_id } = req.body;
        const userId = req.userId || req.body.customer_phone || 'guest';

        if (!product_id) {
            return res.status(400).json({ success: false, message: 'Thiếu product_id' });
        }

        // Call redis Lua script to atomically reserve stock for 10 seconds
        const reserved = await redisUtil.reserveStock(userId, product_id, 1, 10);
        if (reserved) {
            res.json({
                success: true,
                message: 'Giữ chỗ thành công! Bạn có 10 giây để xác nhận đặt hàng.',
                data: {
                    reservation_ttl: 10
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Sản phẩm đã hết hàng hoặc sự kiện chưa bắt đầu.'
            });
        }
    } catch (err) {
        console.error('[Flashsale Reserve Error]:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi giữ chỗ sản phẩm: ' + err.message });
    }
});

/**
 * [MAPPING: POST /api/order/flashsale/confirm]
 * Confirm checkout, verify reservation, delete slot, and publish payload to RabbitMQ
 */
router.post('/confirm', async (req, res) => {
    try {
        const {
            product_id,
            customer_name,
            customer_phone,
            subtotal,
            discount_amount,
            total_amount,
            payment_method,
            shipping_address,
            items,
            voucher_code
        } = req.body;

        const userId = req.userId || customer_phone || 'guest';

        if (!product_id) {
            return res.status(400).json({ success: false, message: 'Thiếu product_id' });
        }

        const reservationKey = `flashsale:reservation:${userId}:${product_id}`;

        // 1. Verify reservation exists in Redis
        const exists = await redisUtil.redisClient.exists(reservationKey);
        if (exists === 0) {
            return res.status(408).json({
                success: false,
                message: 'Phiên giữ hàng của bạn đã hết hạn (quá 10 giây) hoặc không tồn tại. Vui lòng quay lại đặt hàng.'
            });
        }

        // 2. Delete the reservation slot key so it doesn't expire and auto-rollback stock
        await redisUtil.redisClient.del(reservationKey);

        // 3. Package and publish payload to RabbitMQ
        const orderPayload = {
            customer_id: req.userId || null,
            customer_name,
            customer_phone,
            subtotal,
            discount_amount,
            total_amount,
            payment_method,
            shipping_address,
            items,
            voucher_code
        };

        const queued = await rabbitmq.publishFlashsaleOrder(orderPayload);
        if (queued) {
            res.json({
                success: true,
                message: 'Đơn hàng của bạn đã được tiếp nhận thành công và đang được xử lý dưới hệ thống!'
            });
        } else {
            // If message queue fails, restore stock back in Redis
            const stockKey = `flashsale:stock:${product_id}`;
            await redisUtil.redisClient.incrBy(stockKey, 1);
            res.status(500).json({
                success: false,
                message: 'Hệ thống hàng đợi gặp sự cố. Vui lòng thử lại sau.'
            });
        }
    } catch (err) {
        console.error('[Flashsale Confirm Error]:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi xác nhận đơn hàng: ' + err.message });
    }
});

module.exports = router;
