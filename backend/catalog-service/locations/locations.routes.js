const router = require('express').Router();
const pool   = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields } = require('../middlewares/validate');
const canWriteCatalog = requireRoles(['admin', 'manager']);

function normalizeText(value) {
  return String(value || '').trim();
}

function inferStorageType(row = {}) {
  const text = `${row.zone || ''} ${row.cabinet || ''} ${row.shelf || ''} ${row.label || ''}`.toLowerCase();
  if (/(lạnh|kho lạnh|cold|2-8|2 - 8|snow)/i.test(text)) return 'cold';
  if (/(khóa|khoa|kiểm soát|kiem soat|gây nghiện|gay nghien|hướng tâm|huong tam|hướng thần|huong than|controlled)/i.test(text)) {
    return 'controlled';
  }
  return 'normal';
}

function locationIcon(storageType) {
  if (storageType === 'cold') return 'fa-snowflake';
  if (storageType === 'controlled') return 'fa-lock';
  return 'fa-layer-group';
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const q = req.query.q ? `%${req.query.q}%` : null;

    let where = 'WHERE l.is_active = 1';
    const params = [];
    if (q) {
      where += ' AND (l.zone LIKE ? OR l.cabinet LIKE ? OR l.shelf LIKE ? OR l.label LIKE ?)';
      params.push(q, q, q, q);
    }

    const [rows] = await pool.query(
      `SELECT l.id, l.zone, l.cabinet, l.shelf, l.label, l.is_active,
              COUNT(DISTINCT CASE WHEN bi.quantity_remaining > 0 AND bi.status IN ('available', 'near_expiry') THEN bi.id END) AS active_lot_count,
              COALESCE(SUM(CASE WHEN bi.status IN ('available', 'near_expiry') THEN bi.quantity_remaining ELSE 0 END), 0) AS total_stock
       FROM locations l
       LEFT JOIN batch_items bi ON bi.location_id = l.id
       ${where}
       GROUP BY l.id, l.zone, l.cabinet, l.shelf, l.label, l.is_active
       ORDER BY l.zone ASC, l.cabinet ASC, l.shelf ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM locations l ${where}`,
      params
    );

    const data = rows.map((row) => {
      const storageType = inferStorageType(row);
      return {
        ...row,
        active_lot_count: Number(row.active_lot_count) || 0,
        total_stock: Number(row.total_stock) || 0,
        storage_type: storageType,
        icon: locationIcon(storageType)
      };
    });

    const totalPages = Math.ceil(total / limit);
    res.json({
      success: true,
      data,
      pagination: { total, page, limit, pages: totalPages, total_pages: totalPages }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.*,
              COUNT(DISTINCT CASE WHEN bi.quantity_remaining > 0 AND bi.status IN ('available', 'near_expiry') THEN bi.id END) AS active_lot_count,
              COALESCE(SUM(CASE WHEN bi.status IN ('available', 'near_expiry') THEN bi.quantity_remaining ELSE 0 END), 0) AS total_stock
       FROM locations l
       LEFT JOIN batch_items bi ON bi.location_id = l.id
       WHERE l.id = ?
       GROUP BY l.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    const storageType = inferStorageType(rows[0]);
    res.json({
      success: true,
      data: {
        ...rows[0],
        active_lot_count: Number(rows[0].active_lot_count) || 0,
        total_stock: Number(rows[0].total_stock) || 0,
        storage_type: storageType,
        icon: locationIcon(storageType)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', canWriteCatalog, requireFields(['zone', 'cabinet', 'shelf', 'label']), async (req, res) => {
  try {
    const zone = normalizeText(req.body?.zone);
    const cabinet = normalizeText(req.body?.cabinet);
    const shelf = normalizeText(req.body?.shelf);
    const label = normalizeText(req.body?.label);
    if (!zone || !cabinet || !shelf || !label) {
      return res.status(400).json({ success: false, message: 'Thiếu zone, cabinet, shelf hoặc label' });
    }

    const [[duplicate]] = await pool.query(
      `SELECT id FROM locations
       WHERE is_active = 1 AND zone = ? AND cabinet = ? AND shelf = ?
       LIMIT 1`,
      [zone, cabinet, shelf]
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Vị trí này đã tồn tại trong kho' });
    }

    const [result] = await pool.query(
      `INSERT INTO locations (zone, cabinet, shelf, label, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [zone, cabinet, shelf, label]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', canWriteCatalog, async (req, res) => {
  try {
    const { is_active } = req.body || {};
    const zone = req.body?.zone !== undefined ? normalizeText(req.body.zone) : undefined;
    const cabinet = req.body?.cabinet !== undefined ? normalizeText(req.body.cabinet) : undefined;
    const shelf = req.body?.shelf !== undefined ? normalizeText(req.body.shelf) : undefined;
    const label = req.body?.label !== undefined ? normalizeText(req.body.label) : undefined;
    const [[existing]] = await pool.query('SELECT * FROM locations WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    }
    if (is_active === false || is_active === 0 || is_active === '0') {
      const [[stock]] = await pool.query(
        `SELECT COALESCE(SUM(quantity_remaining), 0) AS total_stock
         FROM batch_items
         WHERE location_id = ? AND status IN ('available', 'near_expiry')`,
        [req.params.id]
      );
      if (Number(stock.total_stock) > 0) {
        return res.status(409).json({ success: false, message: 'Không thể ngừng dùng vị trí đang còn tồn kho' });
      }
    }

    const fields = [];
    const params = [];
    if (zone !== undefined) { fields.push('zone = ?'); params.push(zone); }
    if (cabinet !== undefined) { fields.push('cabinet = ?'); params.push(cabinet); }
    if (shelf !== undefined) { fields.push('shelf = ?'); params.push(shelf); }
    if (label !== undefined) { fields.push('label = ?'); params.push(label); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
    }

    await pool.query(`UPDATE locations SET ${fields.join(', ')} WHERE id = ?`, [...params, req.params.id]);
    res.json({ success: true, message: 'Cập nhật vị trí thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', canWriteCatalog, async (req, res) => {
  try {
    const [[stock]] = await pool.query(
      `SELECT COALESCE(SUM(quantity_remaining), 0) AS total_stock
       FROM batch_items
       WHERE location_id = ? AND status IN ('available', 'near_expiry')`,
      [req.params.id]
    );
    if (Number(stock.total_stock) > 0) {
      return res.status(409).json({ success: false, message: 'Không thể ẩn vị trí đang còn tồn kho' });
    }

    const [result] = await pool.query(
      `UPDATE locations SET is_active = 0 WHERE id = ?`,
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    }
    res.json({ success: true, message: 'Ẩn vị trí thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
