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
            order_code = null,
            applied_voucher_codes = []
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

        // --- Kiểm tra sản phẩm Flash Sale ---
        let hasFlashSaleItem = false;
        const productIds = items.map(it => it.product_id);
        if (productIds.length > 0) {
            const [flashSales] = await connection.query(
                `SELECT DISTINCT product_id FROM mg_catalog.product_tag_promotions 
                 WHERE product_id IN (?) 
                   AND tag_name = 'flash-sale' 
                   AND status = 'active' 
                   AND start_time <= NOW() 
                   AND end_time >= NOW() 
                   AND (campaign_qty IS NULL OR sold_qty < campaign_qty)`,
                [productIds]
            );
            if (flashSales.length > 0) {
                hasFlashSaleItem = true;
            }
        }

        // --- Xử lý áp dụng nhiều Voucher ---
        let calculatedDiscount = 0;
        const promotionsToInsert = [];
        const promoUsageIncrements = [];

        if (applied_voucher_codes && Array.isArray(applied_voucher_codes) && applied_voucher_codes.length > 0 && applied_voucher_codes.filter(Boolean).length > 0) {
            if (hasFlashSaleItem) {
                throw new Error('Đơn hàng có chứa sản phẩm Flash Sale nên không thể áp dụng mã giảm giá.');
            }

            for (const code of applied_voucher_codes) {
                if (!code) continue;
                const normalizedCode = code.trim().toUpperCase();

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

                if (promos.length === 0) {
                    throw new Error(`Mã voucher ${code} không tồn tại, đã hết hạn hoặc hết lượt dùng.`);
                }

                const v = promos[0];

                if (v.applicable_channel !== 'all' && v.applicable_channel !== 'web') {
                    throw new Error(`Mã voucher ${code} không được áp dụng trên kênh Web.`);
                }

                if (subtotal < Number(v.min_order_value || 0)) {
                    throw new Error(`Đơn hàng chưa đạt giá trị tối thiểu ${Number(v.min_order_value).toLocaleString('vi-VN')}đ để áp dụng mã ${code}.`);
                }

                let disc = 0;
                if (v.type === 'percent_discount' || v.type === 'percent') {
                    disc = Math.round((subtotal * Number(v.discount_value)) / 100);
                    if (v.max_discount_amount > 0) {
                        disc = Math.min(disc, Number(v.max_discount_amount));
                    }
                } else if (v.type === 'free_shipping' || v.type === 'freeship') {
                    disc = parsedShippingFee;
                    if (v.discount_value > 0) {
                        disc = Math.min(disc, Number(v.discount_value));
                    }
                    if (v.max_discount_amount > 0) {
                        disc = Math.min(disc, Number(v.max_discount_amount));
                    }
                } else {
                    disc = Number(v.discount_value);
                }

                calculatedDiscount += disc;
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

        // --- Xử lý tặng quà tự động (buy_x_get_y) ---
        const giftItems = [];
        if (!hasFlashSaleItem) {
            const [activeGifts] = await connection.query(
                `SELECT id, name, gift_product_name, gift_product_qty, min_order_value
                 FROM mg_cms.promotions
                 WHERE type = 'buy_x_get_y'
                   AND is_active = 1
                   AND start_date <= NOW()
                   AND end_date >= NOW()
                   AND (usage_limit IS NULL OR usage_count < usage_limit)
                   AND (applicable_channel = 'all' OR applicable_channel = 'web')
                   AND min_order_value <= ?
                 ORDER BY min_order_value DESC`,
                [subtotal]
            );

            for (const giftCampaign of activeGifts) {
                // Tìm kiếm sản phẩm trong catalog theo tên (hỗ trợ so khớp mềm và chính xác)
                const prod = await findProductForGift(connection, giftCampaign.gift_product_name);

                if (prod) {
                    giftItems.push({
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

        const totalAmount = Math.max(0, subtotal + parsedShippingFee - calculatedDiscount);

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
            shipping_address, subtotal, parsedShippingFee, calculatedDiscount, totalAmount,
            mappedPaymentMethod, requires_vat_invoice ? 1 : 0, customer_notes
        ]);
        const orderId = orderResult.insertId;

        // 6. Chuyển item từ giỏ sang đơn hàng (order_items)
        const allItemsToInsert = [...items.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            unit_name: item.unit_name || 'Hộp',
            quantity: item.quantity,
            unit_price: item.unit_price
        })), ...giftItems];

        for (const item of allItemsToInsert) {
            await connection.query(`
                INSERT INTO order_items (
                    order_id, product_id, product_name, unit_name,
                    quantity, unit_price, total_price
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                orderId, item.product_id, item.product_name, item.unit_name,
                item.quantity, item.unit_price, item.quantity * item.unit_price
            ]);
        }

        // 7. Ghi nhận lịch sử khuyến mãi (order_promotions)
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

        // 8. Tăng usage_count cho promotions
        for (const promoId of promoUsageIncrements) {
            await connection.query(
                `UPDATE mg_cms.promotions SET usage_count = usage_count + 1 WHERE id = ?`,
                [promoId]
            );
        }

        // 9. Xóa mềm giỏ hàng sau khi checkout thành công
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
