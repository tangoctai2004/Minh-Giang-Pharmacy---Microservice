const router = require('express').Router();
const pool   = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');
const canWriteCatalog = requireRoles(['admin', 'manager']);

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const q = req.query.q ? `%${req.query.q}%` : null;

    let where = `WHERE status = 'active'`;
    const params = [];
    if (q) {
      where += ` AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)`;
      params.push(q, q, q);
    }

    const [rows] = await pool.query(
      `SELECT id, code, name, contact_name, phone, email, address,
              tax_code, current_debt, total_purchase_value, status, created_at, updated_at
       FROM suppliers
       ${where}
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM suppliers ${where}`,
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
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', canWriteCatalog, requireFields(['code', 'name']), validateEnum('status', ['active', 'inactive']), async (req, res) => {
  try {
    const { code, name, contact_name, phone, email, address, tax_code, status = 'active' } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Thiếu code hoặc name' });
    }
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status không hợp lệ' });
    }

    const [result] = await pool.query(
      `INSERT INTO suppliers (code, name, contact_name, phone, email, address, tax_code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, name, contact_name || null, phone || null, email || null, address || null, tax_code || null, status]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Mã nhà cung cấp đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', canWriteCatalog, validateEnum('status', ['active', 'inactive']), async (req, res) => {
  try {
    const { code, name, contact_name, phone, email, address, tax_code, status } = req.body || {};
    const [[existing]] = await pool.query('SELECT id FROM suppliers WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });
    }

    const fields = [];
    const params = [];
    if (code !== undefined) { fields.push('code = ?'); params.push(code); }
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (contact_name !== undefined) { fields.push('contact_name = ?'); params.push(contact_name || null); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone || null); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email || null); }
    if (address !== undefined) { fields.push('address = ?'); params.push(address || null); }
    if (tax_code !== undefined) { fields.push('tax_code = ?'); params.push(tax_code || null); }
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status không hợp lệ' });
      }
      fields.push('status = ?');
      params.push(status);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
    }

    await pool.query(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, [...params, req.params.id]);
    res.json({ success: true, message: 'Cập nhật nhà cung cấp thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Mã nhà cung cấp đã tồn tại' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', canWriteCatalog, async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE suppliers SET status = 'inactive' WHERE id = ?`,
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });
    }
    res.json({ success: true, message: 'Ẩn nhà cung cấp thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
