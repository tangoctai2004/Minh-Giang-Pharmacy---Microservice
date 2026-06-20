const router = require('express').Router();
const pool = require('../db/pool');

/**
 * [MAPPING: GET /api/order/cart]
 * Load giỏ hàng của user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.json({ success: true, data: { items: [], summary: { total_items: 0, total: 0 } } });
        }

        // 1. Lấy cart_id của customer
        let [carts] = await pool.query('SELECT id FROM carts WHERE customer_id = ? AND is_active = 1 LIMIT 1', [userId]);
        
        if (carts.length === 0) {
            return res.json({ success: true, data: { items: [], summary: { total_items: 0, total: 0 } } });
        }

        const cartId = carts[0].id;

        // 2. Lấy danh sách item trong giỏ (Dùng dữ liệu snapshot trong cart_items)
        const [items] = await pool.query(`
            SELECT 
                ci.id, ci.product_id, ci.product_name, ci.product_sku, ci.thumbnail,
                ci.unit_name, ci.quantity, ci.unit_price,
                (ci.quantity * ci.unit_price) as subtotal
            FROM cart_items ci
            WHERE ci.cart_id = ? AND ci.is_active = 1
        `, [cartId]);

        // Tính toán summary
        const total_items = items.length;
        const subtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

        res.json({
            success: true,
            data: {
                items: items,
                summary: {
                    total_items,
                    subtotal,
                    total: subtotal 
                }
            }
        });

    } catch (error) {
        console.error('[Cart GET] Error:', error);
        res.status(500).json({ success: false, message: 'Không thể lấy thông tin giỏ hàng' });
    }
});

/**
 * [MAPPING: POST /api/order/cart/items]
 * Thêm sản phẩm vào giỏ
 */
router.post('/items', async (req, res) => {
    try {
        const userId = req.userId;
        const { product_id, quantity, unit_name } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
        if (!product_id || !quantity) return res.status(400).json({ success: false, message: 'Thiếu thông tin sản phẩm' });

        const { callInternalService, CATALOG_SERVICE_URL } = require('../utils/internalApi');

        // 1. Lấy thông tin sản phẩm và giá được xác thực từ catalog-service
        const prodRes = await callInternalService(`${CATALOG_SERVICE_URL}/products/${product_id}`);
        if (!prodRes.ok) {
            return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại hoặc đã ngừng bán.' });
        }
        const prodResult = await prodRes.json();
        if (!prodResult.success || !prodResult.data) {
            return res.status(404).json({ success: false, message: 'Không thể lấy thông tin sản phẩm.' });
        }
        const product = prodResult.data;

        // Xác định đơn giá và tỷ lệ quy đổi
        const cleanUnit = unit_name || product.base_unit || 'Hộp';
        let unit_price = Number(product.retail_price);
        let conversionQty = 1;

        const baseUnitClean = (product.base_unit || '').trim().toLowerCase();
        const cleanUnitLower = cleanUnit.trim().toLowerCase();

        if (cleanUnitLower && cleanUnitLower !== baseUnitClean) {
            const unitDetails = (product.units || []).find(u => (u.unit_name || '').trim().toLowerCase() === cleanUnitLower);
            if (unitDetails) {
                unit_price = Number(unitDetails.retail_price);
                conversionQty = Number(unitDetails.conversion_qty);
            } else if (cleanUnitLower === 'vỉ') {
                unit_price = Math.round(Number(product.retail_price) / 10);
                conversionQty = 10;
            } else if (cleanUnitLower === 'viên') {
                unit_price = Math.round(Number(product.retail_price) / 30);
                conversionQty = 1;
            }
        }

        // 2. Đảm bảo có cart cho user
        let [carts] = await pool.query('SELECT id FROM carts WHERE customer_id = ? AND is_active = 1', [userId]);
        let cartId;
        if (carts.length === 0) {
            const [result] = await pool.query('INSERT INTO carts (customer_id) VALUES (?)', [userId]);
            cartId = result.insertId;
        } else {
            cartId = carts[0].id;
        }

        // 3. Kiểm tra xem sản phẩm đã có trong giỏ chưa
        const [existing] = await pool.query(
            'SELECT id, quantity, is_active FROM cart_items WHERE cart_id = ? AND product_id = ? AND unit_name = ?',
            [cartId, product_id, cleanUnit]
        );

        let targetQty = Number(quantity);
        if (existing.length > 0 && existing[0].is_active === 1) {
            targetQty += Number(existing[0].quantity);
        }

        // 4. Kiểm tra tồn kho khả dụng từ catalog-service
        const qtyInBaseUnit = targetQty * conversionQty;
        const stockRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/availability?product_ids=${product_id}`);
        if (!stockRes.ok) {
            return res.status(500).json({ success: false, message: 'Lỗi kiểm tra tồn kho từ catalog service.' });
        }
        const stockResult = await stockRes.json();
        if (!stockResult.success || !Array.isArray(stockResult.data) || stockResult.data.length === 0) {
            return res.status(400).json({ success: false, message: 'Không thể tìm thấy thông tin tồn kho cho sản phẩm.' });
        }
        const availableStock = Number(stockResult.data[0].available_stock || 0);
        if (availableStock < qtyInBaseUnit) {
            return res.status(400).json({ 
                success: false, 
                message: `Không đủ hàng khả dụng trong kho (Kho còn lại: ${availableStock} ${product.base_unit}).` 
            });
        }

        if (existing.length > 0) {
            if (existing[0].is_active === 0) {
                // Kích hoạt lại
                await pool.query(
                    'UPDATE cart_items SET is_active = 1, quantity = ?, product_name = ?, thumbnail = ?, unit_price = ? WHERE id = ?',
                    [quantity, product.name, product.image_url || '', unit_price, existing[0].id]
                );
            } else {
                // Cộng dồn
                await pool.query(
                    'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
                    [quantity, existing[0].id]
                );
            }
        } else {
            // Thêm mới
            await pool.query(
                'INSERT INTO cart_items (cart_id, product_id, product_name, product_sku, thumbnail, unit_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [cartId, product_id, product.name, product.sku || '', product.image_url || '', cleanUnit, quantity, unit_price]
            );
        }

        const [countResult] = await pool.query('SELECT COUNT(*) as count FROM cart_items WHERE cart_id = ? AND is_active = 1', [cartId]);

        res.json({
            success: true,
            message: 'Đã thêm vào giỏ hàng',
            data: { cart_count: countResult[0].count || 0 }
        });

    } catch (error) {
        console.error('[Cart POST] Error:', error);
        res.status(500).json({ success: false, message: 'Không thể thêm vào giỏ hàng: ' + error.message });
    }
});

/**
 * [MAPPING: PUT /api/order/cart/items/:id]
 * Cập nhật số lượng
 */
router.put('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;
        const userId = req.userId;

        if (!userId) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
        if (quantity < 1) return res.status(400).json({ success: false, message: 'Số lượng không hợp lệ' });

        // 1. Lấy thông tin chi tiết item hiện có và kiểm tra quyền sở hữu giỏ hàng
        const [items] = await pool.query(`
            SELECT ci.id, ci.product_id, ci.unit_name, ci.quantity, ci.unit_price 
            FROM cart_items ci
            JOIN carts c ON ci.cart_id = c.id
            WHERE ci.id = ? AND c.customer_id = ? AND ci.is_active = 1
        `, [id, userId]);

        if (items.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm trong giỏ' });
        }
        const item = items[0];

        const { callInternalService, CATALOG_SERVICE_URL } = require('../utils/internalApi');

        // 2. Lấy thông tin sản phẩm từ catalog-service
        const prodRes = await callInternalService(`${CATALOG_SERVICE_URL}/products/${item.product_id}`);
        if (!prodRes.ok) {
            return res.status(404).json({ success: false, message: 'Không thể lấy thông tin sản phẩm.' });
        }
        const prodResult = await prodRes.json();
        if (!prodResult.success || !prodResult.data) {
            return res.status(404).json({ success: false, message: 'Không thể lấy thông tin sản phẩm.' });
        }
        const product = prodResult.data;

        // 3. Xác định tỷ lệ quy đổi
        const cleanUnit = item.unit_name || product.base_unit || 'Hộp';
        let conversionQty = 1;
        const baseUnitClean = (product.base_unit || '').trim().toLowerCase();
        const cleanUnitLower = cleanUnit.trim().toLowerCase();

        if (cleanUnitLower && cleanUnitLower !== baseUnitClean) {
            const unitDetails = (product.units || []).find(u => (u.unit_name || '').trim().toLowerCase() === cleanUnitLower);
            if (unitDetails) {
                conversionQty = Number(unitDetails.conversion_qty);
            } else if (cleanUnitLower === 'vỉ') {
                conversionQty = 10;
            } else if (cleanUnitLower === 'viên') {
                conversionQty = 1;
            }
        }

        // 4. Kiểm tra tồn kho khả dụng từ catalog-service
        const qtyInBaseUnit = Number(quantity) * conversionQty;
        const stockRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/availability?product_ids=${item.product_id}`);
        if (!stockRes.ok) {
            return res.status(500).json({ success: false, message: 'Lỗi kiểm tra tồn kho từ catalog service.' });
        }
        const stockResult = await stockRes.json();
        if (!stockResult.success || !Array.isArray(stockResult.data) || stockResult.data.length === 0) {
            return res.status(400).json({ success: false, message: 'Không thể tìm thấy thông tin tồn kho cho sản phẩm.' });
        }
        const availableStock = Number(stockResult.data[0].available_stock || 0);
        if (availableStock < qtyInBaseUnit) {
            return res.status(400).json({ 
                success: false, 
                message: `Không đủ hàng khả dụng trong kho (Kho còn lại: ${availableStock} ${product.base_unit}).` 
            });
        }

        // 5. Cập nhật số lượng
        await pool.query(`
            UPDATE cart_items SET quantity = ? WHERE id = ?
        `, [quantity, id]);

        const subtotal = quantity * Number(item.unit_price);
        res.json({ success: true, data: { item: { id: parseInt(id), quantity, subtotal } } });
    } catch (error) {
        console.error('[Cart Item PUT] Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật giỏ hàng: ' + error.message });
    }
});

/**
 * [MAPPING: DELETE /api/order/cart/items/:id]
 * Xoá 1 sản phẩm (Soft delete)
 */
router.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!userId) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });

        await pool.query(`
            UPDATE cart_items ci
            JOIN carts c ON ci.cart_id = c.id
            SET ci.is_active = 0 
            WHERE ci.id = ? AND c.customer_id = ?
        `, [id, userId]);

        res.json({ success: true, message: 'Đã xóa sản phẩm khỏi giỏ hàng' });
    } catch (error) {
        console.error('[Cart Item DELETE] Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xoá sản phẩm' });
    }
});

/**
 * [MAPPING: DELETE /api/order/cart]
 * Xoá sạch giỏ hàng (Soft delete)
 */
router.delete('/', async (req, res) => {
    try {
        const userId = req.userId;
        const [carts] = await pool.query('SELECT id FROM carts WHERE customer_id = ? AND is_active = 1', [userId]);
        if (carts.length > 0) {
            await pool.query('UPDATE cart_items SET is_active = 0 WHERE cart_id = ?', [carts[0].id]);
        }
        res.json({ success: true, message: 'Giỏ hàng đã được xóa' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi làm sạch giỏ hàng' });
    }
});

module.exports = router;
