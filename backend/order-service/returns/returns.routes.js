const router = require('express').Router();
const pool = require('../db/pool');

/**
 * [MAPPING: POST /api/order/returns]
 * Tạo yêu cầu trả hàng
 */
router.post('/', async (req, res) => {
    try {
        const { order_id, reason, items, order_channel, refund_amount, refund_method } = req.body;
        
        let total_amount = 0;
        let batch = null;

        if (order_channel === 'supplier') {
            const { callInternalService, CATALOG_SERVICE_URL } = require('../utils/internalApi');
            const batchRes = await callInternalService(`${CATALOG_SERVICE_URL}/batches/${order_id}`);
            if (!batchRes.ok) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin lô hàng nhập gốc' });
            }
            const batchData = await batchRes.json();
            if (!batchData.success || !batchData.data) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin lô hàng nhập gốc' });
            }
            batch = batchData.data;
            total_amount = Number(batch.total_amount || 0);
        } else {
            // 1. Kiểm tra đơn hàng có tồn tại không
            const [[order]] = await pool.query('SELECT total_amount, discount_amount, subtotal FROM orders WHERE id = ? AND is_active = 1', [order_id]);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
            }
            total_amount = Number(order.total_amount || 0);
        }

        // 2. Kiểm tra tổng số tiền hoàn trả
        const [[returnedSum]] = await pool.query(
            "SELECT SUM(refund_amount) AS total_returned FROM returns WHERE order_id = ? AND order_channel = ? AND status != 'rejected' AND is_active = 1", 
            [order_id, order_channel || 'pos']
        );
        const currentReturned = Number(returnedSum?.total_returned || 0);
        const maxRefundAllowed = total_amount - currentReturned;
        if (maxRefundAllowed <= 0) {
            return res.status(400).json({ success: false, message: 'Đơn hàng/lô hàng này đã được hoàn trả toàn bộ, không thể tạo thêm yêu cầu đổi trả.' });
        }
        if (Number(refund_amount) > maxRefundAllowed) {
            return res.status(400).json({ success: false, message: `Tiền hoàn trả không được vượt quá số tiền còn lại có thể hoàn (Tối đa: ${maxRefundAllowed}đ)` });
        }

        // 3. Kiểm tra số lượng từng item trả lại
        if (items && items.length > 0) {
            for (const item of items) {
                if (order_channel === 'supplier') {
                    const batchItem = batch.items.find(it => it.id === item.order_item_id);
                    if (!batchItem) {
                        return res.status(400).json({ success: false, message: `Không tìm thấy sản phẩm trong chi tiết lô hàng nhập` });
                    }
                    const [[alreadyReturned]] = await pool.query(
                        "SELECT SUM(quantity_returned) AS qty FROM return_items ri JOIN returns r ON ri.return_id = r.id WHERE ri.order_item_id = ? AND r.order_channel = 'supplier' AND r.status != 'rejected' AND ri.is_active = 1 AND r.is_active = 1",
                        [item.order_item_id]
                    );
                    const currentReturnedQty = Number(alreadyReturned?.qty || 0);
                    const maxQtyAllowed = Number(batchItem.quantity_received) - currentReturnedQty;
                    if (Number(item.quantity) > maxQtyAllowed) {
                        return res.status(400).json({ success: false, message: `Số lượng trả lại sản phẩm "${batchItem.product_name}" không được vượt quá số lượng còn lại của lô hàng (Tối đa: ${maxQtyAllowed})` });
                    }
                } else {
                    const [[orderItem]] = await pool.query('SELECT product_name, quantity FROM order_items WHERE id = ? AND order_id = ? AND is_active = 1', [item.order_item_id, order_id]);
                    if (!orderItem) {
                        return res.status(400).json({ success: false, message: `Không tìm thấy sản phẩm trong chi tiết đơn hàng` });
                    }
                    const [[alreadyReturned]] = await pool.query(
                        "SELECT SUM(quantity_returned) AS qty FROM return_items ri JOIN returns r ON ri.return_id = r.id WHERE ri.order_item_id = ? AND r.order_channel != 'supplier' AND r.status != 'rejected' AND ri.is_active = 1 AND r.is_active = 1",
                        [item.order_item_id]
                    );
                    const currentReturnedQty = Number(alreadyReturned?.qty || 0);
                    const maxQtyAllowed = Number(orderItem.quantity) - currentReturnedQty;
                    if (Number(item.quantity) > maxQtyAllowed) {
                        return res.status(400).json({ success: false, message: `Số lượng trả lại sản phẩm "${orderItem.product_name}" không được vượt quá số lượng đã mua còn lại (Tối đa: ${maxQtyAllowed})` });
                    }
                }
            }
        }

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
        res.status(500).json({ success: false, message: 'Lỗi khi yêu cầu trả hàng: ' + error.message });
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

        if (req.userType === 'customer') {
            query += ' AND o.customer_id = ?';
            params.push(req.userId);
        }

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

        // Enrich supplier returns with supplier name and batch code from catalog-service
        const supplierReturns = returns.filter(r => r.order_channel === 'supplier');
        if (supplierReturns.length > 0) {
            try {
                const { callInternalService, CATALOG_SERVICE_URL } = require('../utils/internalApi');
                const uniqueBatchIds = [...new Set(supplierReturns.map(r => r.order_id))];
                const batchPromises = uniqueBatchIds.map(async (id) => {
                    const res = await callInternalService(`${CATALOG_SERVICE_URL}/batches/${id}`);
                    if (res.ok) {
                        const resData = await res.json();
                        return { id, data: resData.data };
                    }
                    return { id, data: null };
                });
                const batchResults = await Promise.all(batchPromises);
                const batchMap = {};
                batchResults.forEach(r => {
                    if (r.data) batchMap[r.id] = r.data;
                });

                const supplierRes = await callInternalService(`${CATALOG_SERVICE_URL}/suppliers?limit=100`);
                let suppliers = [];
                if (supplierRes.ok) {
                    const supData = await supplierRes.json();
                    suppliers = supData.data || [];
                }

                supplierReturns.forEach(r => {
                    const batch = batchMap[r.order_id];
                    if (batch) {
                        r.order_code = batch.batch_code;
                        const supplier = suppliers.find(s => s.id === batch.supplier_id);
                        r.customer_name = supplier ? supplier.name : `Nhà cung cấp #${batch.supplier_id}`;
                        r.customer_phone = supplier ? supplier.phone : '';
                    }
                });
            } catch (err) {
                console.error('Enrich supplier returns error:', err);
            }
        }

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

        if (req.userType === 'customer') {
            const [[orderCheck]] = await pool.query('SELECT customer_id FROM orders WHERE id = ?', [returnRecord.order_id]);
            if (!orderCheck || orderCheck.customer_id !== req.userId) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền xem phiếu trả hàng này' });
            }
        }

        let items = [];

        if (returnRecord.order_channel === 'supplier') {
            try {
                const { callInternalService, CATALOG_SERVICE_URL } = require('../utils/internalApi');
                const batchRes = await callInternalService(`${CATALOG_SERVICE_URL}/batches/${returnRecord.order_id}`);
                if (batchRes.ok) {
                    const batchData = await batchRes.json();
                    const batch = batchData.data;
                    
                    returnRecord.order_code = batch.batch_code;
                    
                    const supplierRes = await callInternalService(`${CATALOG_SERVICE_URL}/suppliers/${batch.supplier_id}`);
                    if (supplierRes.ok) {
                        const supData = await supplierRes.json();
                        const supplier = supData.data;
                        returnRecord.customer_name = supplier ? supplier.name : `Nhà cung cấp #${batch.supplier_id}`;
                        returnRecord.customer_phone = supplier ? supplier.phone : '';
                    }

                    const [returnItems] = await pool.query(`
                        SELECT ri.*
                        FROM return_items ri
                        WHERE ri.return_id = ? AND ri.is_active = 1
                    `, [returnRecord.id]);

                    items = returnItems.map(item => {
                        const batchItem = batch.items.find(bi => bi.id === item.order_item_id);
                        return {
                            ...item,
                            product_name: batchItem ? batchItem.product_name : `Sản phẩm #${item.order_item_id}`,
                            unit_price: batchItem ? batchItem.cost_price : 0,
                            unit_name: batchItem ? (batchItem.base_unit || 'Hộp') : 'Hộp'
                        };
                    });
                }
            } catch (err) {
                console.error('Enrich supplier return detail error:', err);
            }
        } else {
            const [orderItems] = await pool.query(`
                SELECT ri.*, oi.product_name, oi.unit_price, oi.unit_name
                FROM return_items ri
                JOIN order_items oi ON ri.order_item_id = oi.id
                WHERE ri.return_id = ? AND ri.is_active = 1
            `, [returnRecord.id]);
            items = orderItems;
        }

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
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { status } = req.body;

        await connection.beginTransaction();

        // 1. Lấy thông tin phiếu trả hàng để kiểm tra
        const [returns] = await connection.query(
            'SELECT id, status, refund_amount, order_id, order_channel FROM returns WHERE return_code = ? AND is_active = 1 FOR UPDATE',
            [id]
        );

        if (returns.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu trả hàng' });
        }

        const returnRecord = returns[0];
        const oldStatus = returnRecord.status;

        // 2. Cập nhật trạng thái phiếu trả hàng
        await connection.query(
            'UPDATE returns SET status = ? WHERE id = ?',
            [status, returnRecord.id]
        );

        // 3. Nếu được duyệt thành công (completed) và trước đó chưa ở trạng thái completed
        if (status === 'completed' && oldStatus !== 'completed') {
            if (returnRecord.order_channel === 'supplier') {
                // 1. Lấy thông tin lô nhập hàng từ catalog-service
                const { callInternalService, CATALOG_SERVICE_URL } = require('../utils/internalApi');
                const batchRes = await callInternalService(`${CATALOG_SERVICE_URL}/batches/${returnRecord.order_id}`);
                if (!batchRes.ok) {
                    throw new Error('Không thể lấy thông tin lô nhập hàng gốc từ catalog-service');
                }
                const batchData = await batchRes.json();
                if (!batchData.success || !batchData.data) {
                    throw new Error('Dữ liệu lô hàng gốc từ catalog-service không hợp lệ');
                }
                const batch = batchData.data;

                // 2. Lấy danh sách sản phẩm cần xuất trả kho
                const [returnItems] = await connection.query(`
                    SELECT ri.id, ri.quantity_returned, ri.order_item_id AS batch_item_id
                    FROM return_items ri
                    WHERE ri.return_id = ? AND ri.is_active = 1
                `, [returnRecord.id]);

                const deductItems = returnItems.map(item => {
                    const batchItem = batch.items.find(bi => bi.id === item.batch_item_id);
                    return {
                        batch_item_id: item.batch_item_id,
                        product_id: batchItem ? batchItem.product_id : null,
                        quantity: item.quantity_returned
                    };
                });

                // 3. Trực tiếp trừ tồn kho của lô hàng trong catalog-service
                const deductRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/deduct`, {
                    method: 'POST',
                    body: JSON.stringify({
                        items: deductItems,
                        reference_type: 'supplier_return',
                        reference_id: returnRecord.id,
                        created_by: req.userId || null
                    })
                });

                if (!deductRes.ok) {
                    throw new Error('Lỗi trừ kho khi trả hàng NCC: ' + (await deductRes.text()));
                }

                // 4. Giảm công nợ NCC tương ứng số tiền hoàn nhận được
                if (returnRecord.refund_amount > 0) {
                    const payDebtRes = await callInternalService(`${CATALOG_SERVICE_URL}/suppliers/${batch.supplier_id}/pay-debt`, {
                        method: 'POST',
                        headers: {
                            'x-user-role': 'admin'
                        },
                        body: JSON.stringify({
                            amount: returnRecord.refund_amount
                        })
                    });
                    if (!payDebtRes.ok) {
                        console.error('Không thể giảm công nợ NCC qua catalog-service:', await payDebtRes.text());
                    }
                }
            } else {
                // Lấy danh sách sản phẩm bị trả và lô gốc
                const [returnItems] = await connection.query(`
                    SELECT ri.id, ri.quantity_returned, oi.product_id, oi.batch_item_id 
                    FROM return_items ri
                    JOIN order_items oi ON ri.order_item_id = oi.id
                    WHERE ri.return_id = ? AND ri.is_active = 1
                `, [returnRecord.id]);

                const restockItems = [];
                for (const item of returnItems) {
                    let batchItemId = item.batch_item_id;
                    if (!batchItemId) {
                        const { callInternalService, CATALOG_SERVICE_URL } = require('../utils/internalApi');
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
                            quantity: item.quantity_returned
                        });
                    }
                }

                if (restockItems.length > 0) {
                    const { callInternalService, CATALOG_SERVICE_URL } = require('../utils/internalApi');
                    const restockRes = await callInternalService(`${CATALOG_SERVICE_URL}/inventory/restock`, {
                        method: 'POST',
                        body: JSON.stringify({
                            items: restockItems,
                            reference_type: 'return',
                            reference_id: returnRecord.id,
                            created_by: req.userId || null
                        })
                    });

                    if (!restockRes.ok) {
                        throw new Error('Không thể hoàn kho tự động qua catalog-service: ' + (await restockRes.text()));
                    }
                }

                // 4. Thu hồi điểm loyalty tích lũy tương ứng
                const [[orderInfo]] = await connection.query(`
                    SELECT o.customer_id, o.order_code
                    FROM orders o
                    WHERE o.id = ?
                `, [returnRecord.order_id]);

                if (orderInfo && orderInfo.customer_id && returnRecord.refund_amount > 0) {
                    const pointsToRecover = Math.floor(Number(returnRecord.refund_amount) / 1000);
                    if (pointsToRecover > 0) {
                        const { callInternalService, IDENTITY_SERVICE_URL } = require('../utils/internalApi');
                        const adjustRes = await callInternalService(`${IDENTITY_SERVICE_URL}/customers/${orderInfo.customer_id}/loyalty/adjust`, {
                            method: 'POST',
                            body: JSON.stringify({
                                points_change: -pointsToRecover,
                                description: `Thu hồi điểm do trả hàng đơn ${orderInfo.order_code || ''} (Phiếu trả ${returnRecord.id})`,
                                idempotency_key: `return:${returnRecord.id}:loyalty`
                            })
                        });
                        if (!adjustRes.ok) {
                            console.error('Không thể thu hồi điểm loyalty qua identity-service:', await adjustRes.text());
                        }
                    }
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
    } catch (error) {
        await connection.rollback();
        console.error('[Update Return Status Error]:', error);
        res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái phiếu và tồn kho: ' + error.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
