const router = require('express').Router();
const pool = require('../db/pool');
const { callInternalService, CATALOG_SERVICE_URL, IDENTITY_SERVICE_URL, CMS_SERVICE_URL } = require('../utils/internalApi');

async function findProductForGift(giftProductName) {
    const cleanName = giftProductName.trim().toLowerCase();
    const response = await callInternalService(`${CATALOG_SERVICE_URL}/products?q=${encodeURIComponent(giftProductName)}&limit=50`);
    if (!response.ok) return null;
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) return null;
    
    const products = result.data;
    
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

/**
 * Helper to find or automatically create a customer by phone number.
 */
async function findOrCreateCustomerByPhone(phone, name) {
    if (!phone) return null;
    const response = await callInternalService(`${IDENTITY_SERVICE_URL}/customers/find-or-create`, {
        method: 'POST',
        body: JSON.stringify({ phone, name })
    });
    if (!response.ok) {
        throw new Error('Không thể tra cứu hoặc tạo thông tin khách hàng từ identity-service');
    }
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Lỗi tra cứu/tạo khách hàng');
    }
    return result.data.id;
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
 * [MAPPING: POST /api/order/orders]
 * Tạo đơn hàng POS mới & trừ tồn kho thực tế trong mg_catalog.batch_items (FEFO)
 */
router.post('/', async (req, res) => {
    let connection;
    try {
        const {
            customer_id,
            customer_name,
            customer_phone,
            subtotal,
            discount_amount,
            total_amount,
            payment_method,
            items,
            voucher_code,
            prescription_doctor,
            prescription_number
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh sách sản phẩm không hợp lệ' });
        }

        // --- Cập nhật thông tin khách hàng ---
        let activeCustomerId = customer_id || null;
        let lookupPhone = customer_phone;
        let lookupName = customer_name || 'Khách vãng lai';

        if (!activeCustomerId) {
            if (!lookupPhone || lookupPhone.trim() === 'Vãng lai' || lookupPhone.trim().length < 10) {
                lookupPhone = '0900000000';
                lookupName = 'Khách vãng lai';
            }
            activeCustomerId = await findOrCreateCustomerByPhone(lookupPhone, lookupName);
        }

        // --- Kiểm tra thuốc kê đơn (Rx) ---
        const productIds = items.map(it => it.product_id);
        const catalogRes = await callInternalService(`${CATALOG_SERVICE_URL}/products?ids=${productIds.join(',')}`);
        if (!catalogRes.ok) {
            return res.status(500).json({ success: false, message: 'Không thể kiểm tra thông tin thuốc từ catalog-service.' });
        }
        const catalogData = await catalogRes.json();
        if (!catalogData.success || !Array.isArray(catalogData.data)) {
            return res.status(500).json({ success: false, message: 'Dữ liệu sản phẩm từ catalog-service không hợp lệ.' });
        }
        const catalogProductsMap = {};
        for (const p of catalogData.data) {
            catalogProductsMap[p.id] = p;
        }

        const rxItems = [];
        for (const item of items) {
            const catalogProd = catalogProductsMap[item.product_id];
            if (catalogProd && Number(catalogProd.requires_prescription) === 1) {
                rxItems.push(item);
            }
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Tạo mã đơn hàng độc nhất dạng POS-YYYYMMDD-XXXX
        const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        const orderCode = `POS-${todayStr}-${randomStr}`;

        // --- Xử lý Voucher & Quà tặng POS ---
        let calculatedDiscount = 0;
        const promotionsToInsert = [];
        const promoUsageIncrements = [];
        const isPhoneValid = lookupPhone && lookupPhone !== '0900000000' && lookupPhone.trim().length >= 10;

        if (voucher_code && isPhoneValid) {
            const normalizedCode = voucher_code.trim().toUpperCase();
            const promoRes = await callInternalService(`${CMS_SERVICE_URL}/promotions/validate/${encodeURIComponent(normalizedCode)}`);
            if (promoRes.ok) {
                const promoData = await promoRes.json();
                if (promoData.success && promoData.data) {
                    const v = promoData.data;
                    if (v.applicable_channel === 'all' || v.applicable_channel === 'pos') {
                        let disc = 0;
                        if (v.type === 'percent_discount' || v.type === 'percent') {
                            disc = Math.round((subtotal * Number(v.discount_value)) / 100);
                            if (v.max_discount_amount > 0) {
                                disc = Math.min(disc, Number(v.max_discount_amount));
                            }
                        } else {
                            disc = Number(v.discount_value);
                        }
                        calculatedDiscount = disc;
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
            }
        }

        if (isPhoneValid) {
            const activeRes = await callInternalService(`${CMS_SERVICE_URL}/promotions/active`);
            if (activeRes.ok) {
                const activeData = await activeRes.json();
                if (activeData.success) {
                    const activeGifts = activeData.data.filter(p =>
                        p.type === 'buy_x_get_y' &&
                        (p.applicable_channel === 'all' || p.applicable_channel === 'pos') &&
                        Number(p.min_order_value || 0) <= subtotal
                    ).sort((a, b) => Number(b.min_order_value || 0) - Number(a.min_order_value || 0));

                    const bestGiftCampaign = activeGifts[0];
                    if (bestGiftCampaign) {
                        const prod = await findProductForGift(bestGiftCampaign.gift_product_name);
                        if (prod) {
                            const giftStockRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/availability?product_ids=${prod.id}`);
                            if (giftStockRes.ok) {
                                const giftStockData = await giftStockRes.json();
                                if (giftStockData.success && giftStockData.data && giftStockData.data.length > 0) {
                                    const availableGiftStock = Number(giftStockData.data[0].available_stock || 0);
                                    const requiredQty = bestGiftCampaign.gift_product_qty || 1;
                                    if (availableGiftStock >= requiredQty) {
                                        items.push({
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

        // --- Lưu Đơn thuốc Bác sĩ kê đơn (Rx) ---
        let prescriptionId = null;
        if (rxItems.length > 0) {
            if (!prescription_doctor) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Đơn hàng chứa thuốc kê đơn (Rx). Yêu cầu nhập thông tin Bác sĩ kê đơn.' });
            }

            const rxCode = prescription_number || `POS-RX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const todayYMD = new Date().toISOString().slice(0, 10);
            
            const [rxInsertResult] = await connection.query(`
                INSERT INTO prescriptions (
                    prescription_code, order_id, customer_id, patient_name, patient_phone,
                    doctor_name, hospital_name, issue_date, image_url, status, verified_at
                ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'verified', NOW())
            `, [
                rxCode, activeCustomerId, lookupName, lookupPhone,
                prescription_doctor, 'Bệnh viện Đa khoa', todayYMD, '/uploads/prescriptions/pos-rx-default.jpg'
            ]);
            prescriptionId = rxInsertResult.insertId;
        }

        // 2. Thêm đơn hàng vào bảng orders
        const [orderResult] = await connection.query(`
            INSERT INTO orders (
                order_code, order_channel, customer_id, customer_name, customer_phone,
                shipping_address, subtotal, shipping_fee, discount_amount, total_amount,
                payment_method, payment_status, order_status, requires_vat_invoice
            ) VALUES (?, 'pos', ?, ?, ?, NULL, ?, 0, ?, ?, ?, 'paid', 'completed', 0)
        `, [
            orderCode, activeCustomerId, lookupName, lookupPhone,
            subtotal, discount_amount || calculatedDiscount, total_amount, payment_method || 'cash'
        ]);
        const orderId = orderResult.insertId;

        // Cập nhật order_id cho đơn thuốc
        if (prescriptionId) {
            await connection.query('UPDATE prescriptions SET order_id = ? WHERE id = ?', [orderId, prescriptionId]);
        }

        // 3. Trừ tồn kho trong mg_catalog theo FEFO
        const deductRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/deduct`, {
            method: 'POST',
            body: JSON.stringify({
                items: items.map(it => ({ product_id: it.product_id, quantity: it.quantity })),
                reference_type: 'pos_order',
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

        // 4. Thêm các chi tiết đơn hàng (order_items)
        const orderItemsToInsert = [];
        for (const d of deductedItems) {
            const origItem = items.find(it => Number(it.product_id) === Number(d.product_id));
            if (!origItem) continue;

            const catalogProd = catalogProductsMap[d.product_id];
            let itemPrescriptionId = null;
            if (catalogProd && Number(catalogProd.requires_prescription) === 1) {
                itemPrescriptionId = prescriptionId;
            }

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
                itemPrescriptionId
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
        for (const item of items) {
            await incrementPromotionSoldQty(item.product_id, item.quantity);
        }

        // 5. Ghi nhận lịch sử khuyến mãi (order_promotions)
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

        await connection.commit();

        // --- Cập nhật bên ngoài transaction để tránh delay/block DB ---
        
        // Tăng lượt sử dụng khuyến mãi qua CMS service
        if (promoUsageIncrements.length > 0) {
            await callInternalService(`${CMS_SERVICE_URL}/promotions/usage/increment`, {
                method: 'POST',
                body: JSON.stringify({ promotion_ids: promoUsageIncrements })
            }).catch(e => console.error('Failed to increment promo usage:', e));
        }

        // Tích lũy & khấu trừ điểm loyalty qua identity-service
        if (activeCustomerId) {
            const pointsEarned = Math.floor(total_amount / 1000);
            const voucherDiscountTotal = promotionsToInsert.reduce((sum, p) => sum + (p.discount_applied || 0), 0);
            const pointsRedeemed = Math.max(0, (discount_amount || 0) - voucherDiscountTotal);

            if (pointsEarned > 0) {
                await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${activeCustomerId}/loyalty/earn`, {
                    method: 'POST',
                    body: JSON.stringify({
                        amount: total_amount,
                        points: pointsEarned,
                        order_id: orderId
                    })
                }).catch(e => console.error('Failed to earn loyalty points:', e));
            }

            if (pointsRedeemed > 0) {
                await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${activeCustomerId}/loyalty/adjust`, {
                    method: 'POST',
                    body: JSON.stringify({
                        points_change: -pointsRedeemed,
                        description: `Quy đổi điểm giảm giá tại POS - Đơn ${orderCode}`,
                        idempotency_key: `order:${orderId}:redeem`
                    })
                }).catch(e => console.error('Failed to redeem loyalty points:', e));
            }
        }

        // Cập nhật ca POS (Shift)
        let activeShiftId = null;
        if (req.userId) {
            try {
                const activeShiftRes = await callInternalService(`${IDENTITY_SERVICE_URL}/shifts/active/${req.userId}`);
                if (activeShiftRes.ok) {
                    const activeShiftData = await activeShiftRes.json();
                    if (activeShiftData && activeShiftData.success && activeShiftData.data) {
                        activeShiftId = activeShiftData.data.id;
                    }
                }
            } catch (err) {
                console.error('Error fetching active shift for user:', err);
            }
        }

        if (activeShiftId) {
            try {
                await callInternalService(`${IDENTITY_SERVICE_URL}/shifts/${activeShiftId}/sales`, {
                    method: 'POST',
                    body: JSON.stringify({
                        payment_method: payment_method || 'cash',
                        amount: total_amount
                    })
                });
            } catch (err) {
                console.error('Error updating shift sales:', err);
            }
        }

        res.json({
            success: true,
            message: 'Thanh toán & trừ kho thành công!',
            data: { order_id: orderId, order_code: orderCode }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[POS Checkout API Error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi xử lý thanh toán đơn hàng' });
    } finally {
        if (connection) connection.release();
    }
});

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
        const { status, channel, search, customer_id, customer_phone, date_from, date_to, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.userId;
        const userRole = req.userRole;

        let query = 'SELECT * FROM orders WHERE is_active = 1';
        let params = [];

        // Nếu là khách hàng (không phải staff/admin), chỉ xem đơn của mình
        const isStaffOrAdmin = req.userType === 'staff' || ['admin', 'pharmacist', 'cashier', 'staff'].includes(userRole);
        if (!isStaffOrAdmin) {
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

        if (customer_id && isStaffOrAdmin) {
            if (customer_phone) {
                query += ' AND (customer_id = ? OR customer_phone = ?)';
                params.push(customer_id, customer_phone);
            } else {
                query += ' AND customer_id = ?';
                params.push(customer_id);
            }
        }

        if (search) {
            query += ' AND (order_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Lọc theo khoảng ngày
        if (date_from) {
            query += ' AND DATE(created_at) >= ?';
            params.push(date_from);
        }
        if (date_to) {
            query += ' AND DATE(created_at) <= ?';
            params.push(date_to);
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
        const [items] = await pool.query(`
            SELECT oi.*, 
                   COALESCE((
                       SELECT SUM(ri.quantity_returned)
                       FROM return_items ri
                       JOIN returns r ON ri.return_id = r.id
                       WHERE ri.order_item_id = oi.id
                         AND r.status != 'rejected'
                         AND ri.is_active = 1
                         AND r.is_active = 1
                   ), 0) AS quantity_returned
            FROM order_items oi
            WHERE oi.order_id = ? AND oi.is_active = 1
        `, [orderId]);
        const [promotions] = await pool.query('SELECT * FROM order_promotions WHERE order_id = ?', [orderId]);
        
        // Query total refunded amount from returns table
        const [[returnedSum]] = await pool.query(
            "SELECT SUM(refund_amount) AS total_returned FROM returns WHERE order_id = ? AND status != 'rejected' AND is_active = 1",
            [orderId]
        );
        const totalReturned = Number(returnedSum?.total_returned || 0);

        res.json({ success: true, data: { ...orders[0], items, promotions, total_returned: totalReturned } });
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
    let connection;
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending_approval', 'confirmed', 'picking', 'shipping', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let [orders] = await connection.query('SELECT * FROM orders WHERE id = ? AND is_active = 1 FOR UPDATE', [id]);
        if (orders.length === 0) {
            const [ordersByCode] = await connection.query('SELECT * FROM orders WHERE order_code = ? AND is_active = 1 FOR UPDATE', [id]);
            if (ordersByCode.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
            }
            orders[0] = ordersByCode[0];
        }
        const realId = orders[0].id;
        const order = orders[0];
        const oldStatus = order.order_status;

        // Bổ sung kiểm soát quyền đối với khách hàng (Customer)
        const isCustomer = req.userType === 'customer';
        if (isCustomer) {
            if (status !== 'cancelled') {
                await connection.rollback();
                return res.status(403).json({ success: false, message: 'Khách hàng chỉ có quyền hủy đơn hàng.' });
            }
            if (order.customer_id !== req.userId) {
                await connection.rollback();
                return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn hàng này.' });
            }
            if (oldStatus !== 'pending_approval') {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn hàng khi đơn đang ở trạng thái chờ duyệt.' });
            }
        }

        let updateQuery = 'UPDATE orders SET order_status = ?';
        let updateParams = [status];

        if (status === 'completed') {
            updateQuery += ", payment_status = 'paid'";
        }

        updateQuery += ' WHERE id = ?';
        updateParams.push(realId);

        await connection.query(updateQuery, updateParams);

        // Xử lý Hoàn kho và Cập nhật Promotion khi đơn hàng bị Hủy (ở bất kỳ trạng thái nào trước đó)
        if (oldStatus !== 'cancelled' && status === 'cancelled') {
            const [orderItems] = await connection.query(
                'SELECT product_id, quantity, batch_item_id FROM order_items WHERE order_id = ? AND is_active = 1',
                [realId]
            );

            if (orderItems.length > 0) {
                const restockItems = [];
                for (const item of orderItems) {
                    let batchItemId = item.batch_item_id;
                    if (!batchItemId) {
                        const batchRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/${item.product_id}`);
                        if (batchRes.ok) {
                            const batchResult = await batchRes.json();
                            if (batchResult.success && batchResult.data && batchResult.data.length > 0) {
                                batchItemId = batchResult.data[0].id;
                            }
                        }
                    }
                    if (batchItemId) {
                        restockItems.push({
                            batch_item_id: batchItemId,
                            product_id: item.product_id,
                            quantity: item.quantity
                        });
                    }
                }

                if (restockItems.length > 0) {
                    const restockRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/restock`, {
                        method: 'POST',
                        body: JSON.stringify({
                            items: restockItems,
                            reference_type: order.order_channel === 'web' ? 'web_order' : 'pos_order',
                            reference_id: realId,
                            created_by: req.userId || null
                        })
                    });
                    if (!restockRes.ok) {
                        throw new Error('Hoàn kho thất bại: ' + (await restockRes.text()));
                    }
                }

                for (const item of orderItems) {
                    await decrementPromotionSoldQty(item.product_id, item.quantity);
                }
            }

            // Hoàn lại lượt sử dụng voucher khi hủy đơn hàng (Lỗi 23)
            const [orderPromos] = await connection.query(
                'SELECT promotion_id FROM order_promotions WHERE order_id = ?',
                [realId]
            );
            const promoIdsToRefund = orderPromos.map(op => op.promotion_id).filter(Boolean);
            if (promoIdsToRefund.length > 0) {
                await callInternalService(`${CMS_SERVICE_URL}/promotions/usage/decrement`, {
                    method: 'POST',
                    body: JSON.stringify({ promotion_ids: promoIdsToRefund })
                }).catch(e => console.error('Failed to decrement promo usage:', e));
            }
        }

        // Tích lũy điểm khi chuyển sang completed và hoàn điểm khi chuyển sang cancelled
        let activeCustomerId = order.customer_id;
        if (activeCustomerId) {
            // Kiểm tra xem khách hàng có thực sự tồn tại trong mg_identity hay không
            const custRes = await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${activeCustomerId}`);
            let custExists = false;
            if (custRes.ok) {
                const custData = await custRes.json();
                custExists = custData.success && custData.data;
            }
            if (!custExists) {
                activeCustomerId = null;
            }
        }

        if (!activeCustomerId && order.customer_phone) {
            activeCustomerId = await findOrCreateCustomerByPhone(order.customer_phone, order.customer_name);
            await connection.query('UPDATE orders SET customer_id = ? WHERE id = ?', [activeCustomerId, realId]);
        }

        if (activeCustomerId) {
            // Query total voucher discount from order_promotions
            const [[promoSum]] = await connection.query(
                'SELECT SUM(discount_applied) AS total_promo_discount FROM order_promotions WHERE order_id = ?',
                [realId]
            );
            const voucherDiscountTotal = Number(promoSum?.total_promo_discount || 0);
            const pointsEarned = Math.floor(order.total_amount / 1000);
            const pointsRedeemed = Math.max(0, (order.discount_amount || 0) - voucherDiscountTotal);

            // 1. Chuyển từ trạng thái khác sang completed -> Cộng điểm tích lũy
            if (oldStatus !== 'completed' && status === 'completed') {
                if (pointsEarned > 0) {
                    await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${activeCustomerId}/loyalty/earn`, {
                        method: 'POST',
                        body: JSON.stringify({
                            amount: order.total_amount,
                            points: pointsEarned,
                            order_id: realId
                        })
                    }).catch(e => console.error('Failed to earn loyalty points:', e));
                }

                if (pointsRedeemed > 0) {
                    await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${activeCustomerId}/loyalty/adjust`, {
                        method: 'POST',
                        body: JSON.stringify({
                            points_change: -pointsRedeemed,
                            description: `Quy đổi điểm giảm giá - Đơn ${order.order_code}`,
                            idempotency_key: `order:${realId}:redeem`
                        })
                    }).catch(e => console.error('Failed to redeem loyalty points:', e));
                }
            }
            // 2. Chuyển từ completed sang cancelled -> Thu hồi/Hoàn trả điểm
            else if (oldStatus === 'completed' && status === 'cancelled') {
                if (pointsEarned > 0) {
                    await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${activeCustomerId}/loyalty/adjust`, {
                        method: 'POST',
                        body: JSON.stringify({
                            points_change: -pointsEarned,
                            description: `Thu hồi điểm thưởng (Hủy đơn) - Đơn ${order.order_code}`,
                            idempotency_key: `order:${realId}:cancel_earn`
                        })
                    }).catch(e => console.error('Failed to deduct loyalty points:', e));
                }

                if (pointsRedeemed > 0) {
                    await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${activeCustomerId}/loyalty/adjust`, {
                        method: 'POST',
                        body: JSON.stringify({
                            points_change: pointsRedeemed,
                            description: `Hoàn lại điểm đã tiêu (Hủy đơn) - Đơn ${order.order_code}`,
                            idempotency_key: `order:${realId}:cancel_redeem`
                        })
                    }).catch(e => console.error('Failed to restore loyalty points:', e));
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: `Đã cập nhật trạng thái đơn hàng thành ${status}` });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[Update Order Status Error]', error);
        res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái đơn hàng: ' + error.message });
    } finally {
        if (connection) connection.release();
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
