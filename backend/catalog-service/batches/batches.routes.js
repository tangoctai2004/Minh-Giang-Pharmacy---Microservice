const router = require('express').Router();
const pool   = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');
const { writeAudit } = require('../services/audit.service');
const canWriteCatalog = requireRoles(['admin', 'manager']);

/**
 * Batches Routes — Phiếu nhập hàng (mg_catalog.batches + batch_items)
 *
 * GET  /batches          — Danh sách phiếu nhập ✅
 * GET  /batches/:id      — Chi tiết phiếu nhập kèm batch_items ✅
 * POST /batches          — Tạo phiếu nhập mới (TODO)
 * PUT  /batches/:id      — Cập nhật phiếu (chỉ khi status=draft) (TODO)
 */

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.batch_code, b.status,
              s.name AS supplier_name,
              b.total_amount, b.paid_amount, b.received_date, b.created_at
       FROM batches b
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       ORDER BY b.created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[batch]] = await pool.query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
    const [items] = await pool.query(
      `SELECT bi.*, p.name AS product_name, p.sku AS product_sku, p.base_unit
       FROM batch_items bi
       LEFT JOIN products p ON p.id = bi.product_id
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

    const normalizedItems = [];
    let totalAmount = 0;
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantityReceived = Number(item.quantity_received);
      const costPrice = Number(item.cost_price);

      if (!productId || !item.lot_number || !item.expiry_date || !quantityReceived || quantityReceived <= 0 || !Number.isFinite(costPrice) || costPrice < 0) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Dữ liệu item không hợp lệ' });
      }

      const [[product]] = await conn.query(
        `SELECT id FROM products WHERE id = ? AND status = 'active'`,
        [productId]
      );
      if (!product) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Sản phẩm #${productId} không tồn tại hoặc đang inactive` });
      }

      const lineTotal = quantityReceived * costPrice;
      totalAmount += lineTotal;

      normalizedItems.push({
        product_id: productId,
        lot_number: item.lot_number,
        manufacture_date: item.manufacture_date || null,
        expiry_date: item.expiry_date,
        quantity_received: quantityReceived,
        quantity_remaining: Number(item.quantity_remaining ?? quantityReceived),
        cost_price: costPrice,
        location_id: item.location_id ? Number(item.location_id) : null,
      });
    }

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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
        [
          batchId, item.product_id, item.lot_number, item.manufacture_date, item.expiry_date,
          item.quantity_received, item.quantity_remaining, item.cost_price, item.location_id
        ]
      );
    }

    await conn.query('COMMIT');
    await writeAudit({
      action: 'batch_create',
      entity_type: 'batch',
      entity_id: batchId,
      user_id: req.userId,
      request_id: req.requestId,
      after_data: { id: batchId, batch_code: batchCode, supplier_id, status, total_amount: totalAmount }
    });
    res.status(201).json({ success: true, data: { id: batchId, batch_code: batchCode } });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
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

    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'items phải là mảng và có ít nhất 1 phần tử' });
      }

      for (const item of items) {
        const productId = Number(item.product_id);
        const quantityReceived = Number(item.quantity_received);
        const costPrice = Number(item.cost_price);
        if (!productId || !item.lot_number || !item.expiry_date || !quantityReceived || quantityReceived <= 0 || !Number.isFinite(costPrice) || costPrice < 0) {
          await conn.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Dữ liệu item không hợp lệ' });
        }

        const [[product]] = await conn.query(
          `SELECT id FROM products WHERE id = ? AND status = 'active'`,
          [productId]
        );
        if (!product) {
          await conn.query('ROLLBACK');
          return res.status(400).json({ success: false, message: `Sản phẩm #${productId} không tồn tại hoặc đang inactive` });
        }

        const quantityRemaining = Number(item.quantity_remaining ?? quantityReceived);
        if (quantityRemaining < 0 || quantityRemaining > quantityReceived) {
          await conn.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'quantity_remaining phải nằm trong [0, quantity_received]' });
        }

        if (item.id) {
          const [[existingItem]] = await conn.query(
            `SELECT id FROM batch_items WHERE id = ? AND batch_id = ?`,
            [Number(item.id), batchId]
          );
          if (!existingItem) {
            await conn.query('ROLLBACK');
            return res.status(400).json({ success: false, message: `Item #${item.id} không thuộc phiếu nhập này` });
          }

          await conn.query(
            `UPDATE batch_items
             SET product_id = ?, lot_number = ?, manufacture_date = ?, expiry_date = ?,
                 quantity_received = ?, quantity_remaining = ?, cost_price = ?, location_id = ?
             WHERE id = ?`,
            [
              productId, item.lot_number, item.manufacture_date || null, item.expiry_date,
              quantityReceived, quantityRemaining, costPrice, item.location_id ? Number(item.location_id) : null,
              Number(item.id)
            ]
          );
        } else {
          await conn.query(
            `INSERT INTO batch_items (
              batch_id, product_id, lot_number, manufacture_date, expiry_date,
              quantity_received, quantity_remaining, cost_price, location_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
            [
              batchId, productId, item.lot_number, item.manufacture_date || null, item.expiry_date,
              quantityReceived, quantityRemaining, costPrice, item.location_id ? Number(item.location_id) : null
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
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
