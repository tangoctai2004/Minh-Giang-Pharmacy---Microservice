const router = require('express').Router();
const pool = require('../db/pool');
const { callInternalService, CATALOG_SERVICE_URL, CMS_SERVICE_URL, IDENTITY_SERVICE_URL } = require('../utils/internalApi');

async function findProductForGift(giftProductName) {
    const cleanName = giftProductName.trim().toLowerCase();
    
    const search = async (queryStr) => {
        const response = await callInternalService(`${CATALOG_SERVICE_URL}/products?q=${encodeURIComponent(queryStr)}&limit=50`);
        if (!response.ok) return [];
        const result = await response.json();
        return (result.success && Array.isArray(result.data)) ? result.data : [];
    };

    let products = await search(giftProductName);
    
    if (products.length === 0) {
        if (cleanName.includes('listerine')) {
            products = await search('Listerine');
        } else if (cleanName.includes('bông y tế') || cleanName.includes('bông')) {
            products = await search('Bông');
        } else if (cleanName.includes('vitamin c') || cleanName.includes('vit c')) {
            products = await search('Vitamin C');
        } else {
            const words = cleanName.split(/\s+/).filter(w => w.length > 3 && !['nước', 'miệng', 'thuốc', 'tổng', 'hợp', 'bằng', 'chứa'].includes(w));
            if (words.length > 0) {
                words.sort((a, b) => b.length - a.length);
                products = await search(words[0]);
            }
        }
    }
    
    if (products.length === 0) return null;
    
    // 1. Exact match (case insensitive)
    const exact = products.find(p => p.name.trim().toLowerCase() === cleanName);
    if (exact) return { id: exact.id, name: exact.name, base_unit: exact.base_unit };
    
    // 2. Fallback: replace space with word matching
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
        const match = products.find(p => {
            const pName = p.name.toLowerCase();
            return words.every(word => pName.includes(word));
        });
        if (match) return { id: match.id, name: match.name, base_unit: match.base_unit };
    }
    
    if (products.length > 0) {
        return { id: products[0].id, name: products[0].name, base_unit: products[0].base_unit };
    }
    
    return null;
}

async function incrementPromotionSoldQty(productId, quantity) {
    await callInternalService(`${CATALOG_SERVICE_URL}/promotions/product-tag/increment-sold-qty`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity })
    }).catch(e => console.error('Failed to increment promotion sold qty:', e));
}

async function decrementPromotionSoldQty(productId, quantity) {
    await callInternalService(`${CATALOG_SERVICE_URL}/promotions/product-tag/decrement-sold-qty`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity })
    }).catch(e => console.error('Failed to decrement promotion sold qty:', e));
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
            applied_voucher_codes = [],
            cart_item_ids = []
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
        let items;
        if (Array.isArray(cart_item_ids) && cart_item_ids.length > 0) {
            const [queryResult] = await connection.query(
                'SELECT * FROM cart_items WHERE cart_id = ? AND is_active = 1 AND id IN (?)',
                [cartId, cart_item_ids]
            );
            items = queryResult;
        } else {
            const [queryResult] = await connection.query(
                'SELECT * FROM cart_items WHERE cart_id = ? AND is_active = 1',
                [cartId]
            );
            items = queryResult;
        }

        if (items.length === 0) {
            throw new Error('Giỏ hàng không có sản phẩm nào được chọn để thanh toán.');
        }

        // 2.1. Lấy thông tin chi tiết và kiểm tra tồn kho từ catalog-service
        const productIds = items.map(it => it.product_id);
        const availRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/availability?product_ids=${productIds.join(',')}`);
        if (!availRes.ok) {
            throw new Error('Không thể kiểm tra tồn kho tại thời điểm này.');
        }
        const availData = await availRes.json();
        if (!availData.success) {
            throw new Error('Lỗi lấy thông tin tồn kho: ' + availData.message);
        }
        const stockMap = {};
        for (const s of availData.data) {
            stockMap[s.product_id] = Number(s.available_stock || 0);
        }
        for (const item of items) {
            const availableStock = stockMap[item.product_id] || 0;
            if (availableStock < item.quantity) {
                throw new Error(`Sản phẩm "${item.product_name}" không đủ tồn kho (còn lại: ${availableStock}).`);
            }
        }

        // 3. Tính toán các khoản tiền
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const parsedShippingFee = parseFloat(shipping_fee) || 0;

        // --- Kiểm tra sản phẩm Flash Sale qua catalog-service ---
        let hasFlashSaleItem = false;
        const prodRes = await callInternalService(`${CATALOG_SERVICE_URL}/products?ids=${productIds.join(',')}`);
        if (prodRes.ok) {
            const prodData = await prodRes.json();
            if (prodData.success) {
                for (const p of prodData.data) {
                    if (p.promo_info && p.promo_info.tag_name === 'flash-sale') {
                        hasFlashSaleItem = true;
                    }
                }
            }
        }

        // --- Xử lý áp dụng nhiều Voucher ---
        let calculatedDiscount = 0;
        const promotionsToInsert = [];
        const promoUsageIncrements = [];

        // Ngăn tự nhân bản voucher (Lỗi 19) bằng cách deduplicate mảng voucher
        const uniqueVoucherCodes = [...new Set((applied_voucher_codes || []).map(c => c ? c.trim().toUpperCase() : '').filter(Boolean))];

        if (uniqueVoucherCodes.length > 0) {
            if (hasFlashSaleItem) {
                throw new Error('Đơn hàng có chứa sản phẩm Flash Sale nên không thể áp dụng mã giảm giá.');
            }

            for (const code of uniqueVoucherCodes) {
                const normalizedCode = code.trim().toUpperCase();

                const promoRes = await callInternalService(`${CMS_SERVICE_URL}/promotions/validate/${encodeURIComponent(normalizedCode)}`);
                if (!promoRes.ok) {
                    throw new Error(`Mã voucher ${code} không tồn tại, đã hết hạn hoặc hết lượt dùng.`);
                }
                const promoData = await promoRes.json();
                if (!promoData.success || !promoData.data) {
                    throw new Error(`Mã voucher ${code} không hợp lệ hoặc đã hết lượt dùng.`);
                }

                const v = promoData.data;

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
            const activeRes = await callInternalService(`${CMS_SERVICE_URL}/promotions/active`);
            if (activeRes.ok) {
                const activeData = await activeRes.json();
                if (activeData.success) {
                    const activeGifts = activeData.data.filter(p =>
                        p.type === 'buy_x_get_y' &&
                        (p.applicable_channel === 'all' || p.applicable_channel === 'web') &&
                        Number(p.min_order_value || 0) <= subtotal
                    ).sort((a, b) => Number(b.min_order_value || 0) - Number(a.min_order_value || 0));

                    // Giới hạn nhận tối đa 1 quà tặng tốt nhất (Lỗi 20)
                    const bestGiftCampaign = activeGifts[0];
                    if (bestGiftCampaign) {
                        const prod = await findProductForGift(bestGiftCampaign.gift_product_name);
                        if (prod) {
                            // Kiểm tra tồn kho quà tặng (Lỗi 21)
                            const giftStockRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/availability?product_ids=${prod.id}`);
                            if (giftStockRes.ok) {
                                const giftStockData = await giftStockRes.json();
                                if (giftStockData.success && giftStockData.data && giftStockData.data.length > 0) {
                                    const availableGiftStock = Number(giftStockData.data[0].available_stock || 0);
                                    const requiredQty = bestGiftCampaign.gift_product_qty || 1;
                                    if (availableGiftStock >= requiredQty) {
                                        giftItems.push({
                                            product_id: prod.id,
                                            product_name: `🎁 [Quà tặng] ${prod.name}`,
                                            unit_name: prod.base_unit || 'Hộp',
                                            quantity: requiredQty,
                                            unit_price: 0
                                        });

                                        promotionsToInsert.push({
                                            promotion_id: bestGiftCampaign.id,
                                            promo_code: null,
                                            promo_name: bestGiftCampaign.name,
                                            promo_type: 'buy_x_get_y',
                                            discount_value: 0,
                                            discount_applied: 0
                                        });
                                        promoUsageIncrements.push(bestGiftCampaign.id);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        const totalAmount = Math.max(0, subtotal + parsedShippingFee - calculatedDiscount);

        // Xác thực số điểm tích lũy của khách hàng ở identity-service trước khi giảm trừ tiền đơn hàng (Lỗi 5)
        const voucherDiscountTotal = promotionsToInsert.reduce((sum, p) => sum + (p.discount_applied || 0), 0);
        const pointsRedeemed = Math.max(0, (discount_amount || 0) - voucherDiscountTotal);
        if (userId && pointsRedeemed > 0) {
            const custRes = await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${userId}`);
            if (!custRes.ok) {
                throw new Error('Không thể xác thực điểm tích lũy của khách hàng.');
            }
            const custData = await custRes.json();
            if (!custData.success || !custData.data) {
                throw new Error('Khách hàng không tồn tại.');
            }
            const currentPoints = Number(custData.data.loyalty_points || 0);
            if (currentPoints < pointsRedeemed) {
                throw new Error(`Điểm tích lũy không đủ (Khách hàng có: ${currentPoints}, cần dùng: ${pointsRedeemed}).`);
            }
        }

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

        // 6. Trừ tồn kho lập tức theo FEFO (Web Checkout)
        const allItemsToInsert = [...items.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            unit_name: item.unit_name || 'Hộp',
            quantity: item.quantity,
            unit_price: item.unit_price
        })), ...giftItems];

        const deductRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/deduct`, {
            method: 'POST',
            body: JSON.stringify({
                items: allItemsToInsert.map(it => ({ product_id: it.product_id, quantity: it.quantity })),
                reference_type: 'web_order',
                reference_id: orderId,
                created_by: req.userId || null
            })
        });
        if (!deductRes.ok) {
            const errText = await deductRes.text();
            throw new Error('Trừ kho thất bại: ' + errText);
        }
        const deductData = await deductRes.json();
        if (!deductData.success || !deductData.data || !Array.isArray(deductData.data.deducted_items)) {
            throw new Error('Dữ liệu trừ kho trả về từ catalog-service không hợp lệ.');
        }
        const deductedItems = deductData.data.deducted_items;

        // 6.1. Chuyển item sang đơn hàng (order_items) kèm thông tin lô thực tế đã trừ
        const orderItemsToInsert = [];
        for (const d of deductedItems) {
            const origItem = allItemsToInsert.find(it => Number(it.product_id) === Number(d.product_id));
            if (!origItem) continue;

            orderItemsToInsert.push([
                orderId,
                d.product_id,
                origItem.product_name,
                origItem.unit_name || 'Hộp',
                d.quantity,
                origItem.unit_price,
                d.quantity * Number(origItem.unit_price),
                d.batch_item_id,
                d.lot_number,
                null // prescription_id
            ]);
        }

        if (orderItemsToInsert.length > 0) {
            await connection.query(`
                INSERT INTO order_items (
                    order_id, product_id, product_name, unit_name,
                    quantity, unit_price, total_price, batch_item_id, lot_number, prescription_id
                ) VALUES ?
            `, [orderItemsToInsert]);
        }

        // Cập nhật sold_qty của promotion active
        for (const item of allItemsToInsert) {
            await incrementPromotionSoldQty(item.product_id, item.quantity);
        }

        // 7. Ghi nhận lịch sử khuyến mãi (order_promotions)
        if (promotionsToInsert.length > 0) {
            const values = promotionsToInsert.map(promo => [
                orderId, promo.promotion_id, promo.promo_code, promo.promo_name,
                promo.promo_type, promo.discount_value, promo.discount_applied
            ]);
            await connection.query(`
                INSERT INTO order_promotions (
                    order_id, promotion_id, promo_code_snapshot, promo_name_snapshot,
                    promo_type_snapshot, discount_value_snapshot, discount_applied
                ) VALUES ?
            `, [values]);
        }

        // 9. Xóa mềm giỏ hàng sau khi checkout thành công
        const purchasedItemIds = items.map(item => item.id);
        if (purchasedItemIds.length > 0) {
            await connection.query('UPDATE cart_items SET is_active = 0 WHERE cart_id = ? AND id IN (?)', [cartId, purchasedItemIds]);
        }

        await connection.commit();

        // 10. Tăng usage_count cho promotions qua CMS service
        if (promoUsageIncrements.length > 0) {
            await callInternalService(`${CMS_SERVICE_URL}/promotions/usage/increment`, {
                method: 'POST',
                body: JSON.stringify({ promotion_ids: promoUsageIncrements })
            }).catch(e => console.error('Failed to increment promo usage:', e));
        }

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

/**
 * [MAPPING: POST /api/order/checkout/payment-callback]
 * Callback giả lập thanh toán online thành công/thất bại
 */
router.post('/payment-callback', async (req, res) => {
    let connection;
    try {
        const { order_id, status } = req.body;
        if (!order_id || !status) {
            return res.status(400).json({ success: false, message: 'Thiếu order_id hoặc status' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? AND is_active = 1 FOR UPDATE', [order_id]);
        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        const order = orders[0];

        if (status === 'success') {
            // Update status and payment
            await connection.query(
                `UPDATE orders SET payment_status = 'paid', order_status = 'confirmed' WHERE id = ?`,
                [order_id]
            );
        } else {
            // Payment failed: update order status to cancelled
            await connection.query(
                `UPDATE orders SET order_status = 'cancelled', payment_status = 'failed', customer_notes = ? WHERE id = ?`,
                ['Thanh toán thất bại tại cổng', order_id]
            );

            // Hoàn lại kho thực tế của các lô hàng khi thanh toán thất bại
            const [orderItems] = await connection.query(
                'SELECT product_id, quantity, batch_item_id FROM order_items WHERE order_id = ? AND is_active = 1',
                [order_id]
            );

            if (orderItems.length > 0) {
                const restockItems = orderItems.map(item => ({
                    batch_item_id: item.batch_item_id,
                    product_id: item.product_id,
                    quantity: item.quantity
                })).filter(it => it.batch_item_id);

                if (restockItems.length > 0) {
                    await callInternalService(`${CATALOG_SERVICE_URL}/inventory/restock`, {
                        method: 'POST',
                        body: JSON.stringify({
                            items: restockItems,
                            reference_type: 'web_order',
                            reference_id: order_id,
                            created_by: null
                        })
                    }).catch(e => console.error('Failed to restock items after payment failure:', e));
                }

                for (const item of orderItems) {
                    await decrementPromotionSoldQty(item.product_id, item.quantity);
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Xử lý callback thanh toán thành công' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[Payment Callback Error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi xử lý callback' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
