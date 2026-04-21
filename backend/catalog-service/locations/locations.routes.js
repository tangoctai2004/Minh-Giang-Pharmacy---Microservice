const router = require('express').Router();
const pool   = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields } = require('../middlewares/validate');
const canWriteCatalog = requireRoles(['admin', 'manager']);

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const q = req.query.q ? `%${req.query.q}%` : null;

    let where = 'WHERE is_active = 1';
    const params = [];
    if (q) {
      where += ' AND (zone LIKE ? OR cabinet LIKE ? OR shelf LIKE ? OR label LIKE ?)';
      params.push(q, q, q, q);
    }

    const [rows] = await pool.query(
      `SELECT id, zone, cabinet, shelf, label, is_active
       FROM locations
       ${where}
       ORDER BY zone ASC, cabinet ASC, shelf ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM locations ${where}`,
      params
    );

    const totalPages = Math.ceil(total / limit);
    res.json({
      success: true,
      data: rows,
      pagination: { total, page, limit, pages: totalPages, total_pages: totalPages }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM locations WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', canWriteCatalog, requireFields(['zone', 'cabinet', 'shelf', 'label']), async (req, res) => {
  try {
    const { zone, cabinet, shelf, label } = req.body || {};
    if (!zone || !cabinet || !shelf || !label) {
      return res.status(400).json({ success: false, message: 'Thiếu zone, cabinet, shelf hoặc label' });
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
    const { zone, cabinet, shelf, label, is_active } = req.body || {};
    const [[existing]] = await pool.query('SELECT id FROM locations WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
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
