const router = require('express').Router();
const pool   = require('../db/pool');

/**
 * Customers Routes — mg_identity.customers (khách hàng)
 *
 * GET    /customers        — Danh sách khách (admin) ✅
 * GET    /customers/me     — Hồ sơ khách đang đăng nhập ✅
 * GET    /customers/:id    — Chi tiết 1 khách ✅
 * POST   /customers        — Admin thêm khách thủ công ✅
 * PUT    /customers/:id    — Cập nhật hồ sơ ✅
 * DELETE /customers/:id    — Xoá mềm — ĐẶT deleted_at ✅
 * GET    /customers/:id/addresses — Danh sách địa chỉ giao hàng ✅
 * POST   /customers/:id/addresses — Thêm địa chỉ giao hàng ✅
 * PUT    /customers/:id/addresses/:addressId — Cập nhật địa chỉ ✅
 * DELETE /customers/:id/addresses/:addressId — Xoá địa chỉ ✅
 */

// GET /customers
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, full_name, phone, email, loyalty_points,
              is_active, created_at
       FROM customers
       WHERE deleted_at IS NULL
       ORDER BY id DESC
       LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /customers/me — Hồ sơ khách đang đăng nhập
router.get('/me', async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT id, code, full_name, phone, email, date_of_birth,
              gender, loyalty_points, is_active, created_at
       FROM customers WHERE id = ? AND deleted_at IS NULL`,
      [req.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /customers/me — Khách hàng tự cập nhật hồ sơ (không cần truyền id)
router.put('/me', async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  try {
    const id = req.userId;
    const { full_name, email, phone, date_of_birth, gender } = req.body;

    if (!full_name && !email && !phone && !date_of_birth && !gender) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ít nhất 1 trường cần cập nhật',
      });
    }

    const [[customer]] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    if (email || phone) {
      const [[existing]] = await pool.query(
        `SELECT id FROM customers WHERE deleted_at IS NULL AND id != ? AND (email = ? OR phone = ?) LIMIT 1`,
        [id, email || '', phone || '']
      );
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Email hoặc số điện thoại đã được sử dụng bởi tài khoản khác',
        });
      }
    }

    const updateFields = [];
    const updateValues = [];
    if (full_name) { updateFields.push('full_name = ?'); updateValues.push(full_name); }
    if (email) { updateFields.push('email = ?'); updateValues.push(email); }
    if (phone) { updateFields.push('phone = ?'); updateValues.push(phone); }
    if (date_of_birth) { updateFields.push('date_of_birth = ?'); updateValues.push(date_of_birth); }
    if (gender) { updateFields.push('gender = ?'); updateValues.push(gender); }
    updateValues.push(id);

    await pool.query(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    const [[updated]] = await pool.query(
      `SELECT id, code, full_name, phone, email, date_of_birth,
              gender, loyalty_points, loyalty_tier, is_active, created_at, updated_at
       FROM customers WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Cập nhật hồ sơ thành công', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /customers/:id — Chi tiết 1 khách hàng
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT id, code, full_name, phone, email, date_of_birth,
              gender, loyalty_points, loyalty_tier, is_active, created_at
       FROM customers WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /customers/:id/addresses - Get customer delivery addresses
router.get('/:id/addresses', async (req, res) => {
  try {
    const { id } = req.params;

    // Check customer exists
    const [[customer]] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng',
      });
    }

    // Get addresses
    const [addresses] = await pool.query(
      `SELECT id, customer_id, receiver_name, phone, province, district, ward, 
              street_address, is_default
       FROM customer_addresses
       WHERE customer_id = ?
       ORDER BY is_default DESC, id DESC`,
      [id]
    );

    res.json({
      success: true,
      data: addresses,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /customers — Admin thêm khách thủ công
router.post('/', async (req, res) => {
  const bcrypt = require('bcryptjs');
  try {
    const { full_name, email, phone, password, date_of_birth, gender } = req.body;

    // 1. Validate input
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp full_name, email, phone, password',
      });
    }

    // 2. Check email/phone uniqueness
    const [[existing]] = await pool.query(
      `SELECT id FROM customers 
       WHERE deleted_at IS NULL 
       AND (email = ? OR phone = ?) 
       LIMIT 1`,
      [email, phone]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email hoặc số điện thoại đã được sử dụng',
      });
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. INSERT customer
    const [result] = await pool.query(
      `INSERT INTO customers 
       (full_name, email, phone, password_hash, date_of_birth, gender)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, email, phone, passwordHash, date_of_birth || null, gender || null]
    );

    // 5. Fetch and return created customer
    const [[customer]] = await pool.query(
      `SELECT id, full_name, email, phone, date_of_birth, gender, 
              loyalty_points, loyalty_tier, is_active, created_at
       FROM customers WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Thêm khách hàng thành công',
      data: customer,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /customers/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, date_of_birth, gender } = req.body;

    // 1. Validate input
    if (!full_name && !email && !phone && !date_of_birth && !gender) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ít nhất 1 trường cần cập nhật',
      });
    }

    // 2. Kiểm tra khách hàng có tồn tại không
    const [[customer]] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng',
      });
    }

    // 3. Kiểm tra email/phone trùng (nếu cập nhật)
    if (email || phone) {
      const [[existing]] = await pool.query(
        `SELECT id FROM customers
         WHERE deleted_at IS NULL
         AND id != ?
         AND (email = ? OR phone = ?)
         LIMIT 1`,
        [id, email || '', phone || '']
      );
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Email hoặc số điện thoại đã được sử dụng bởi tài khoản khác',
        });
      }
    }

    // 4. Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    if (full_name) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }
    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (date_of_birth) {
      updateFields.push('date_of_birth = ?');
      updateValues.push(date_of_birth);
    }
    if (gender) {
      updateFields.push('gender = ?');
      updateValues.push(gender);
    }
    updateValues.push(id);

    const query = `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.query(query, updateValues);

    // 5. Trả lại dữ liệu cập nhật
    const [[updated]] = await pool.query(
      `SELECT id, code, full_name, phone, email, date_of_birth,
              gender, loyalty_points, loyalty_tier, is_active, created_at, updated_at
       FROM customers WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Cập nhật hồ sơ thành công',
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /customers/:id/addresses
router.post('/:id/addresses', async (req, res) => {
  try {
    const { id } = req.params;
    const { receiver_name, phone, province, district, ward, street_address, is_default } = req.body;

    // 1. Validate input
    if (!receiver_name || !phone || !province || !district || !ward || !street_address) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin địa chỉ',
      });
    }

    // 2. Kiểm tra khách hàng có tồn tại không
    const [[customer]] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng',
      });
    }

    // 3. Nếu là địa chỉ mặc định, xoá cái cũ
    if (is_default) {
      await pool.query(
        'UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?',
        [id]
      );
    }

    // 4. Insert địa chỉ mới
    const [result] = await pool.query(
      `INSERT INTO customer_addresses
       (customer_id, receiver_name, phone, province, district, ward, street_address, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, receiver_name, phone, province, district, ward, street_address, is_default ? 1 : 0]
    );

    res.status(201).json({
      success: true,
      message: 'Thêm địa chỉ giao hàng thành công',
      data: {
        id: result.insertId,
        customer_id: id,
        receiver_name,
        phone,
        province,
        district,
        ward,
        street_address,
        is_default: is_default ? 1 : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /customers/:id/addresses/:addressId — Cập nhật địa chỉ giao hàng
router.put('/:id/addresses/:addressId', async (req, res) => {
  try {
    const { id, addressId } = req.params;
    const { receiver_name, phone, province, district, ward, street_address, is_default } = req.body;

    // 1. Validate input
    if (!receiver_name || !phone || !province || !district || !ward || !street_address) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin địa chỉ',
      });
    }

    // 2. Kiểm tra khách hàng có tồn tại không
    const [[customer]] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng',
      });
    }

    // 3. Kiểm tra địa chỉ có tồn tại không
    const [[address]] = await pool.query(
      'SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [addressId, id]
    );
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy địa chỉ giao hàng',
      });
    }

    // 4. Nếu bật mặc định, tắt mặc định địa chỉ cũ
    if (is_default) {
      await pool.query(
        'UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ? AND id != ?',
        [id, addressId]
      );
    }

    // 5. Update địa chỉ
    await pool.query(
      `UPDATE customer_addresses
       SET receiver_name = ?, phone = ?, province = ?, district = ?, ward = ?,
           street_address = ?, is_default = ?
       WHERE id = ? AND customer_id = ?`,
      [receiver_name, phone, province, district, ward, street_address, is_default ? 1 : 0, addressId, id]
    );

    res.json({
      success: true,
      message: 'Cập nhật địa chỉ thành công',
      data: {
        id: addressId,
        customer_id: id,
        receiver_name,
        phone,
        province,
        district,
        ward,
        street_address,
        is_default: is_default ? 1 : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /customers/:id/addresses/:addressId — Xoá địa chỉ giao hàng
router.delete('/:id/addresses/:addressId', async (req, res) => {
  try {
    const { id, addressId } = req.params;

    // 1. Kiểm tra khách hàng có tồn tại không
    const [[customer]] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng',
      });
    }

    // 2. Kiểm tra địa chỉ có tồn tại không
    const [[address]] = await pool.query(
      'SELECT id, is_default FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [addressId, id]
    );
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy địa chỉ giao hàng',
      });
    }

    // 3. Xoá địa chỉ
    await pool.query(
      'DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [addressId, id]
    );

    // 4. Nếu cái vừa xoá là mặc định, set địa chỉ khác làm mặc định
    if (address.is_default) {
      const [[firstAddr]] = await pool.query(
        'SELECT id FROM customer_addresses WHERE customer_id = ? LIMIT 1',
        [id]
      );
      if (firstAddr) {
        await pool.query(
          'UPDATE customer_addresses SET is_default = 1 WHERE id = ?',
          [firstAddr.id]
        );
      }
    }

    res.json({
      success: true,
      message: 'Xoá địa chỉ thành công',
      data: {
        id: addressId,
        deleted: true,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /customers/:id — Xoá mềm (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check customer exists
    const [[customer]] = await pool.query(
      `SELECT id, full_name FROM customers WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng hoặc tài khoản đã bị xoá',
      });
    }

    // 2. Soft delete — set deleted_at
    await pool.query(
      `UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Xoá khách hàng thành công',
      data: {
        id: customer.id,
        full_name: customer.full_name,
        deleted_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
