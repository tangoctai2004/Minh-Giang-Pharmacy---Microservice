const router = require('express').Router();
const pool   = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');
const { writeAudit } = require('../services/audit.service');
const canWriteCatalog = requireRoles(['admin', 'manager']);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function inferLocationStorageType(location = {}) {
  const text = `${location.zone || ''} ${location.cabinet || ''} ${location.shelf || ''} ${location.label || ''}`.toLowerCase();
  if (/(lạnh|kho lạnh|cold|2-8|2 - 8)/i.test(text)) return 'cold';
  if (/(khóa|khoa|kiểm soát|kiem soat|gây nghiện|gay nghien|hướng tâm|huong tam|hướng thần|huong than|controlled)/i.test(text)) {
    return 'controlled';
  }
  return 'normal';
}

function isColdChainProduct(product = {}) {
  return /lạnh|2-8|2 - 8|cold/i.test(String(product.storage_condition || ''));
}

function isControlledProduct(product = {}) {
  return /gây nghiện|gay nghien|hướng tâm|huong tam|hướng thần|huong than|tiền chất|tien chat|thuốc độc|thuoc doc|kiểm soát|kiem soat/i
    .test(`${product.special_control_group || ''} ${product.storage_condition || ''}`);
}

function batchItemStatus(expiryDate, quantityRemaining) {
  if (Number(quantityRemaining) <= 0) return 'depleted';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${normalizeDateOnly(expiryDate)}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return 'available';
  if (expiry < today) return 'expired';
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  return days <= 90 ? 'near_expiry' : 'available';
}

function validateExpiryDates(manufactureDate, expiryDate, receivedDate) {
  const expiryText = normalizeDateOnly(expiryDate);
  if (!expiryText) return 'Thiếu hạn sử dụng của lô';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiryText}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return 'Hạn sử dụng không hợp lệ';
  if (expiry < today) return 'Không được nhập lô đã hết hạn sử dụng';

  const receivedText = normalizeDateOnly(receivedDate);
  if (receivedText) {
    const received = new Date(`${receivedText}T00:00:00`);
    if (!Number.isNaN(received.getTime()) && expiry < received) {
      return 'Hạn sử dụng không được trước ngày nhập kho';
    }
  }

  const manufactureText = normalizeDateOnly(manufactureDate);
  if (manufactureText) {
    const manufacture = new Date(`${manufactureText}T00:00:00`);
    if (!Number.isNaN(manufacture.getTime()) && manufacture > expiry) {
      return 'Ngày sản xuất không được sau hạn sử dụng';
    }
  }
  return null;
}

async function normalizeBatchItems(conn, items, receivedDate, targetStatus) {
  const normalizedItems = [];
  let totalAmount = 0;

  // Thu thập ID duy nhất của sản phẩm và vị trí để batch fetch
  const productIds = [...new Set(items.map((it) => Number(it.product_id)).filter((id) => !Number.isNaN(id) && id > 0))];
  const locationIds = [...new Set(items.map((it) => Number(it.location_id)).filter((id) => !Number.isNaN(id) && id > 0))];

  let productsMap = {};
  if (productIds.length > 0) {
    const [products] = await conn.query(
      `SELECT id, name, status, storage_condition, special_control_group
       FROM products
       WHERE id IN (?) AND status = 'active'`,
      [productIds]
    );
    products.forEach((p) => {
      productsMap[p.id] = p;
    });
  }

  let locationsMap = {};
  if (locationIds.length > 0) {
    const [locations] = await conn.query(
      `SELECT id, zone, cabinet, shelf, label, is_active FROM locations WHERE id IN (?) AND is_active = 1`,
      [locationIds]
    );
    locations.forEach((l) => {
      locationsMap[l.id] = l;
    });
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const rowNumber = index + 1;
    const productId = Number(item.product_id);
    const quantityReceived = Number(item.quantity_received);
    const costPrice = Number(item.cost_price);
    const lotNumber = normalizeText(item.lot_number);
    const expiryDate = normalizeDateOnly(item.expiry_date);
    const manufactureDate = normalizeDateOnly(item.manufacture_date) || null;
    const locationId = item.location_id ? Number(item.location_id) : null;

    if (!productId || !lotNumber || !expiryDate || !quantityReceived || quantityReceived <= 0 || !Number.isFinite(costPrice) || costPrice < 0) {
      throw Object.assign(new Error(`Dòng ${rowNumber}: dữ liệu sản phẩm/lô/số lượng/giá nhập không hợp lệ`), { statusCode: 400 });
    }

    const expiryError = validateExpiryDates(manufactureDate, expiryDate, receivedDate);
    if (expiryError) {
      throw Object.assign(new Error(`Dòng ${rowNumber}: ${expiryError}`), { statusCode: 400 });
    }

    const product = productsMap[productId];
    if (!product) {
      throw Object.assign(new Error(`Dòng ${rowNumber}: sản phẩm #${productId} không tồn tại hoặc chưa ở trạng thái active`), { statusCode: 400 });
    }

    let location = null;
    if (locationId) {
      location = locationsMap[locationId];
      if (!location) {
        throw Object.assign(new Error(`Dòng ${rowNumber}: vị trí lưu trữ không tồn tại hoặc đã ngừng dùng`), { statusCode: 400 });
      }
      const locationType = inferLocationStorageType(location);
      if (isColdChainProduct(product) && locationType !== 'cold') {
        throw Object.assign(new Error(`Dòng ${rowNumber}: thuốc cần lưu kho lạnh phải chọn vị trí kho lạnh 2-8°C`), { statusCode: 400 });
      }
      if (isControlledProduct(product) && locationType !== 'controlled') {
        throw Object.assign(new Error(`Dòng ${rowNumber}: thuốc quản lý đặc biệt phải chọn vị trí tủ khóa kiểm soát`), { statusCode: 400 });
      }
    } else if (isColdChainProduct(product) || isControlledProduct(product)) {
      throw Object.assign(new Error(`Dòng ${rowNumber}: thuốc có điều kiện bảo quản đặc biệt bắt buộc chọn vị trí lưu trữ phù hợp`), { statusCode: 400 });
    }

    const quantityRemaining = targetStatus === 'completed'
      ? quantityReceived
      : Number(item.quantity_remaining ?? 0);
    if (quantityRemaining < 0 || quantityRemaining > quantityReceived) {
      throw Object.assign(new Error(`Dòng ${rowNumber}: tồn còn lại phải nằm trong khoảng 0 đến số lượng nhập`), { statusCode: 400 });
    }

    totalAmount += quantityReceived * costPrice;
    normalizedItems.push({
      id: item.id ? Number(item.id) : null,
      product_id: productId,
      lot_number: lotNumber,
      manufacture_date: manufactureDate,
      expiry_date: expiryDate,
      quantity_received: quantityReceived,
      quantity_remaining: quantityRemaining,
      cost_price: costPrice,
      location_id: locationId,
      status: targetStatus === 'completed' ? batchItemStatus(expiryDate, quantityRemaining) : 'depleted'
    });
  }

  return { normalizedItems, totalAmount };
}

async function writeInboundMovements(conn, batchId, batchCode, userId) {
  const [items] = await conn.query(
    `SELECT id, product_id, quantity_received
     FROM batch_items
     WHERE batch_id = ? AND quantity_received > 0`,
    [batchId]
  );
  for (const item of items) {
    await conn.query(
      `INSERT INTO stock_movements (
        movement_code, batch_item_id, product_id, movement_type, quantity,
        reference_type, reference_id, reason, created_by
      ) VALUES (?, ?, ?, 'inbound', ?, 'purchase_order', ?, ?, ?)`,
      [
        batchCode,
        item.id,
        item.product_id,
        item.quantity_received,
        batchId,
        'Nhập kho từ phiếu nhập đã hoàn tất',
        userId || null
      ]
    );
  }
}

/**
 * Batches Routes — Phiếu nhập hàng (mg_catalog.batches + batch_items)
 *
 * GET  /batches          — Danh sách phiếu nhập ✅
 * GET  /batches/:id      — Chi tiết phiếu nhập kèm batch_items ✅
 * POST /batches          — Tạo phiếu nhập mới, ghi tồn khi status=completed ✅
 * PUT  /batches/:id      — Cập nhật phiếu (chỉ khi status=draft), hoàn tất nhập kho ✅
 */

router.get('/', async (req, res) => {
  try {
    const status = req.query.status || '';
    const q = req.query.q ? `%${req.query.q}%` : null;
    const params = [];
    let where = 'WHERE 1 = 1';
    if (status) {
      if (!['draft', 'completed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status không hợp lệ' });
      }
      where += ' AND b.status = ?';
      params.push(status);
    }
    if (q) {
      where += ' AND (b.batch_code LIKE ? OR s.name LIKE ? OR b.delivery_person LIKE ? OR b.invoice_number LIKE ?)';
      params.push(q, q, q, q);
    }

    const [rows] = await pool.query(
      `SELECT b.id, b.batch_code, b.status,
              s.name AS supplier_name,
              b.total_amount, b.paid_amount, b.received_date, b.created_at,
              COUNT(bi.id) AS item_count,
              COALESCE(SUM(bi.quantity_received), 0) AS total_quantity
       FROM batches b
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       LEFT JOIN batch_items bi ON bi.batch_id = b.id
       ${where}
       GROUP BY b.id, b.batch_code, b.status, s.name, b.total_amount, b.paid_amount, b.received_date, b.created_at
       ORDER BY b.created_at DESC LIMIT 50`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[batch]] = await pool.query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
    const [items] = await pool.query(
      `SELECT bi.*, p.name AS product_name, p.sku AS product_sku, p.base_unit,
              l.zone, l.cabinet, l.shelf, l.label AS location_label
       FROM batch_items bi
       LEFT JOIN products p ON p.id = bi.product_id
       LEFT JOIN locations l ON l.id = bi.location_id
       WHERE bi.batch_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...batch, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', canWriteCatalog, requireFields(['supplier_id', 'received_date', 'items']), validateEnum('status', ['draft', 'completed']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      supplier_id,
      delivery_person,
      received_date,
      paid_amount = 0,
      notes,
      status = 'draft',
      items = [],
    } = req.body || {};

    if (!supplier_id || !received_date) {
      return res.status(400).json({ success: false, message: 'Thiếu supplier_id hoặc received_date' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Phiếu nhập phải có ít nhất 1 item' });
    }

    if (!['draft', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status không hợp lệ' });
    }

    await conn.query('START TRANSACTION');

    const [[supplier]] = await conn.query(
      `SELECT id FROM suppliers WHERE id = ? AND status = 'active'`,
      [supplier_id]
    );
    if (!supplier) {
      await conn.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Nhà cung cấp không tồn tại hoặc đã ngừng hoạt động' });
    }

    const { normalizedItems, totalAmount } = await normalizeBatchItems(conn, items, received_date, status);

    const safePaidAmount = Number(paid_amount) || 0;
    if (safePaidAmount < 0 || safePaidAmount > totalAmount) {
      await conn.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'paid_amount không hợp lệ' });
    }

    const codeDate = String(received_date).replace(/-/g, '').slice(2);
    const codeSeed = Date.now().toString().slice(-4);
    const batchCode = `PO-${codeDate}-${codeSeed}`;

    const [batchResult] = await conn.query(
      `INSERT INTO batches (
        batch_code, supplier_id, delivery_person, received_date,
        total_amount, paid_amount, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchCode, supplier_id, delivery_person || null, received_date,
        totalAmount, safePaidAmount, status, notes || null, req.userId || 0
      ]
    );

    const batchId = batchResult.insertId;

    for (const item of normalizedItems) {
      await conn.query(
        `INSERT INTO batch_items (
          batch_id, product_id, lot_number, manufacture_date, expiry_date,
          quantity_received, quantity_remaining, cost_price, location_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId, item.product_id, item.lot_number, item.manufacture_date, item.expiry_date,
          item.quantity_received, item.quantity_remaining, item.cost_price, item.location_id, item.status
        ]
      );
    }

    if (status === 'completed') {
      await writeInboundMovements(conn, batchId, batchCode, req.userId);
      const debtAmount = totalAmount - safePaidAmount;
      await conn.query(
        `UPDATE suppliers
         SET total_purchase_value = total_purchase_value + ?,
             current_debt = current_debt + ?
         WHERE id = ?`,
        [totalAmount, debtAmount, supplier_id]
      );
    }

    await conn.query('COMMIT');
    await writeAudit({
      action: 'batch_create',
      entity_type: 'batch',
      entity_id: batchId,
      user_id: req.userId,
      request_id: req.requestId,
      after_data: { id: batchId, batch_code: batchCode, supplier_id, status, total_amount: totalAmount },
      metadata: { item_count: normalizedItems.length }
    });
    res.status(201).json({ success: true, data: { id: batchId, batch_code: batchCode } });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', canWriteCatalog, validateEnum('status', ['draft', 'completed']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const batchId = Number(req.params.id);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return res.status(400).json({ success: false, message: 'id phiếu nhập không hợp lệ' });
    }

    const [[existingBatch]] = await conn.query(
      `SELECT id, status FROM batches WHERE id = ?`,
      [batchId]
    );
    if (!existingBatch) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
    }
    if (existingBatch.status !== 'draft') {
      return res.status(409).json({ success: false, message: 'Chỉ được cập nhật phiếu ở trạng thái draft' });
    }

    const {
      supplier_id,
      delivery_person,
      received_date,
      paid_amount,
      notes,
      status,
      items
    } = req.body || {};

    const [[beforeBatch]] = await conn.query(`SELECT * FROM batches WHERE id = ?`, [batchId]);
    await conn.query('START TRANSACTION');

    if (supplier_id !== undefined) {
      const [[supplier]] = await conn.query(
        `SELECT id FROM suppliers WHERE id = ? AND status = 'active'`,
        [supplier_id]
      );
      if (!supplier) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Nhà cung cấp không tồn tại hoặc đã ngừng hoạt động' });
      }
    }

    const updateFields = [];
    const updateParams = [];
    if (supplier_id !== undefined) { updateFields.push('supplier_id = ?'); updateParams.push(supplier_id); }
    if (delivery_person !== undefined) { updateFields.push('delivery_person = ?'); updateParams.push(delivery_person || null); }
    if (received_date !== undefined) { updateFields.push('received_date = ?'); updateParams.push(received_date); }
    if (paid_amount !== undefined) { updateFields.push('paid_amount = ?'); updateParams.push(Number(paid_amount) || 0); }
    if (notes !== undefined) { updateFields.push('notes = ?'); updateParams.push(notes || null); }
    if (status !== undefined) {
      if (!['draft', 'completed'].includes(status)) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'status không hợp lệ' });
      }
      updateFields.push('status = ?');
      updateParams.push(status);
    }

    let normalizedItems = null;
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'items phải là mảng và có ít nhất 1 phần tử' });
      }

      const targetStatus = status || existingBatch.status;
      const normalizedResult = await normalizeBatchItems(conn, items, received_date || beforeBatch.received_date, targetStatus);
      normalizedItems = normalizedResult.normalizedItems;

      for (const item of normalizedItems) {
        if (item.id) {
          const [[existingItem]] = await conn.query(
            `SELECT id FROM batch_items WHERE id = ? AND batch_id = ?`,
            [item.id, batchId]
          );
          if (!existingItem) {
            await conn.query('ROLLBACK');
            return res.status(400).json({ success: false, message: `Item #${item.id} không thuộc phiếu nhập này` });
          }

          await conn.query(
            `UPDATE batch_items
             SET product_id = ?, lot_number = ?, manufacture_date = ?, expiry_date = ?,
                 quantity_received = ?, quantity_remaining = ?, cost_price = ?, location_id = ?, status = ?
             WHERE id = ?`,
            [
              item.product_id, item.lot_number, item.manufacture_date || null, item.expiry_date,
              item.quantity_received, item.quantity_remaining, item.cost_price, item.location_id,
              item.status, item.id
            ]
          );
        } else {
          await conn.query(
            `INSERT INTO batch_items (
              batch_id, product_id, lot_number, manufacture_date, expiry_date,
              quantity_received, quantity_remaining, cost_price, location_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              batchId, item.product_id, item.lot_number, item.manufacture_date, item.expiry_date,
              item.quantity_received, item.quantity_remaining, item.cost_price, item.location_id, item.status
            ]
          );
        }
      }

      const [[{ totalAmount }]] = await conn.query(
        `SELECT COALESCE(SUM(quantity_received * cost_price), 0) AS totalAmount
         FROM batch_items
         WHERE batch_id = ?`,
        [batchId]
      );
      updateFields.push('total_amount = ?');
      updateParams.push(Number(totalAmount) || 0);
    }

    if (updateFields.length > 0) {
      await conn.query(
        `UPDATE batches SET ${updateFields.join(', ')} WHERE id = ?`,
        [...updateParams, batchId]
      );
    }

    const isCompleting = status === 'completed';
    if (isCompleting) {
      await conn.query(
        `UPDATE batch_items
         SET quantity_remaining = quantity_received,
             status = CASE
               WHEN expiry_date < CURDATE() THEN 'expired'
               WHEN DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 90 THEN 'near_expiry'
               ELSE 'available'
             END
         WHERE batch_id = ?`,
        [batchId]
      );
      const [[completedBatch]] = await conn.query(
        `SELECT batch_code, supplier_id, total_amount, paid_amount FROM batches WHERE id = ?`,
        [batchId]
      );
      await writeInboundMovements(conn, batchId, completedBatch.batch_code, req.userId);
      const debtAmount = Number(completedBatch.total_amount) - Number(completedBatch.paid_amount);
      await conn.query(
        `UPDATE suppliers
         SET total_purchase_value = total_purchase_value + ?,
             current_debt = current_debt + ?
         WHERE id = ?`,
        [Number(completedBatch.total_amount), debtAmount, completedBatch.supplier_id]
      );
    }

    await conn.query('COMMIT');
    const [[afterBatch]] = await pool.query(`SELECT * FROM batches WHERE id = ?`, [batchId]);
    await writeAudit({
      action: 'batch_update',
      entity_type: 'batch',
      entity_id: batchId,
      user_id: req.userId,
      request_id: req.requestId,
      before_data: beforeBatch,
      after_data: afterBatch,
      metadata: { updated_items: Array.isArray(items) ? items.length : 0 }
    });
    res.json({ success: true, message: 'Cập nhật phiếu nhập thành công' });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
