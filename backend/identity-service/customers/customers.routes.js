const router = require('express').Router();
const pool   = require('../db/pool');
const { hasPermission, isStaff } = require('../middlewares/rbac');

let customerColumnsCache = null;

async function getCustomerColumns() {
  if (customerColumnsCache) return customerColumnsCache;
  const [rows] = await pool.query('SHOW COLUMNS FROM customers');
  customerColumnsCache = new Set(rows.map((row) => row.Field));
  return customerColumnsCache;
}

async function customerSelect(fields) {
  const columns = await getCustomerColumns();
  return fields.filter((field) => columns.has(field)).join(', ');
}

async function hasCustomerColumn(field) {
  const columns = await getCustomerColumns();
  return columns.has(field);
}

function calculateTier(points) {
  if (points >= 5000) return 'vip';
  if (points >= 2000) return 'gold';
  if (points >= 500) return 'silver';
  return 'member';
}

function canManageLoyalty(req) {
  return req.userRole === 'admin' || req.userRole === 'manager' || req.userRole === 'pharmacist';
}

function isTrustedServiceRequest(req) {
  const serviceName = req.headers['x-service-name'];
  const internalToken = req.headers['x-internal-token'];
  return Boolean(
    process.env.INTERNAL_SERVICE_TOKEN
    && internalToken === process.env.INTERNAL_SERVICE_TOKEN
    && (!serviceName || serviceName === 'order-service')
  );
}

function isAdmin(req) {
  return isStaff(req) && req.userRole === 'admin';
}

function isSelfCustomer(req, id) {
  return req.userType === 'customer' && req.userId === Number(id);
}

function canViewCustomers(req) {
  return isStaff(req) && (
    req.userRole === 'admin'
    || req.userRole === 'pharmacist'
    || req.userRole === 'cashier'
    || hasPermission(req, 'customers.view')
  );
}

function canEditCustomers(req) {
  return isStaff(req) && (
    req.userRole === 'admin'
    || req.userRole === 'pharmacist'
    || hasPermission(req, 'customers.edit')
  );
}

function requireCustomerAuth(req, res) {
  if (!req.userId || req.userType !== 'customer') {
    res.status(401).json({ success: false, message: 'Chưa đăng nhập bằng tài khoản khách hàng' });
    return false;
  }
  return true;
}

function requireCanViewCustomer(req, res, id) {
  if (!req.userId) {
    res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    return false;
  }
  if (!canViewCustomers(req) && !isSelfCustomer(req, id)) {
    res.status(403).json({ success: false, message: 'Không có quyền xem thông tin khách hàng này' });
    return false;
  }
  return true;
}

function requireCanEditCustomer(req, res, id) {
  if (!req.userId) {
    res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    return false;
  }
  if (!canEditCustomers(req) && !isSelfCustomer(req, id)) {
    res.status(403).json({ success: false, message: 'Không có quyền cập nhật khách hàng này' });
    return false;
  }
  return true;
}

function requireCanEditCustomers(req, res) {
  if (!req.userId) {
    res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    return false;
  }
  if (!canEditCustomers(req)) {
    res.status(403).json({ success: false, message: 'Không có quyền quản lý khách hàng' });
    return false;
  }
  return true;
}

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
  if (!req.userId) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  if (!canViewCustomers(req)) {
    return res.status(403).json({ success: false, message: 'Không có quyền xem danh sách khách hàng' });
  }

  try {
    const fields = await customerSelect([
      'id', 'code', 'full_name', 'phone', 'email', 'loyalty_points',
      'loyalty_tier', 'avatar_url', 'is_active', 'created_at',
    ]);
    const [rows] = await pool.query(
      `SELECT ${fields}
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
  if (!requireCustomerAuth(req, res)) return;
  try {
    const fields = await customerSelect([
      'id', 'code', 'full_name', 'phone', 'email', 'date_of_birth',
      'gender', 'loyalty_points', 'loyalty_tier', 'avatar_url', 'google_id',
      'zalo_id', 'is_active', 'created_at',
    ]);
    const [rows] = await pool.query(
      `SELECT ${fields}
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
  if (!requireCustomerAuth(req, res)) return;
  try {
    const id = req.userId;
    const { full_name, email, phone, date_of_birth, gender, avatar_url } = req.body;
    const supportsAvatar = await hasCustomerColumn('avatar_url');

    if (!full_name && !email && !phone && !date_of_birth && !gender && !(supportsAvatar && avatar_url)) {
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
    if (full_name)    { updateFields.push('full_name = ?');    updateValues.push(full_name); }
    if (email)        { updateFields.push('email = ?');        updateValues.push(email); }
    if (phone)        { updateFields.push('phone = ?');        updateValues.push(phone); }
    if (date_of_birth){ updateFields.push('date_of_birth = ?');updateValues.push(date_of_birth); }
    if (gender)       { updateFields.push('gender = ?');       updateValues.push(gender); }
    if (supportsAvatar && avatar_url !== undefined) { updateFields.push('avatar_url = ?'); updateValues.push(avatar_url); }
    updateValues.push(id);

    await pool.query(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    const fields = await customerSelect([
      'id', 'code', 'full_name', 'phone', 'email', 'date_of_birth',
      'gender', 'loyalty_points', 'loyalty_tier', 'avatar_url',
      'is_active', 'created_at', 'updated_at',
    ]);
    const [[updated]] = await pool.query(
      `SELECT ${fields}
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
  if (!requireCanViewCustomer(req, res, req.params.id)) return;

  try {
    const { id } = req.params;
    const fields = await customerSelect([
      'id', 'code', 'full_name', 'phone', 'email', 'date_of_birth',
      'gender', 'loyalty_points', 'loyalty_tier', 'avatar_url',
      'is_active', 'created_at',
    ]);
    const [rows] = await pool.query(
      `SELECT ${fields}
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

// GET /customers/:id/loyalty - Điểm tích luỹ Loyalty
router.get('/:id/loyalty', async (req, res) => {
  if (!requireCanViewCustomer(req, res, req.params.id)) return;

  try {
    const { id } = req.params;

    // 1. Query bảng customers để lấy loyalty_points và loyalty_tier
    const [[customer]] = await pool.query(
      'SELECT id, loyalty_points, loyalty_tier FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    }

    // 2. Query bảng loyalty_points_transactions lấy 10 lịch sử giao dịch mới nhất
    const [transactions] = await pool.query(
      `SELECT id, transaction_type, points_change, description, created_at 
       FROM loyalty_points_transactions 
       WHERE customer_id = ? 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [id]
    );

    // 3. Ghép thành object data và trả về
    res.json({
      success: true,
      data: {
        loyalty_points: customer.loyalty_points,
        loyalty_tier: customer.loyalty_tier,
        transactions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /customers/:id/loyalty/earn — Cộng điểm từ đơn hàng hoặc thưởng thủ công
router.post('/:id/loyalty/earn', async (req, res) => {
  if (!canManageLoyalty(req) && !isTrustedServiceRequest(req)) {
    return res.status(403).json({ success: false, message: 'Không có quyền cộng điểm khách hàng' });
  }

  const conn = await pool.getConnection();
  try {
    const customerId = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const requestedPoints = req.body.points !== undefined ? Number(req.body.points) : null;
    const referenceOrderId = req.body.order_id || req.body.reference_order_id || null;
    const idempotencyKey = req.body.idempotency_key || (referenceOrderId ? `order:${referenceOrderId}:earn` : null);
    const description = req.body.description || (referenceOrderId ? `Tích điểm từ đơn hàng #${referenceOrderId}` : 'Cộng điểm khách hàng thân thiết');

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khách hàng không hợp lệ' });
    }

    const points = requestedPoints !== null ? requestedPoints : Math.floor(amount / 10000);
    if (!Number.isInteger(points) || points <= 0) {
      return res.status(400).json({ success: false, message: 'Số điểm cộng phải là số nguyên dương' });
    }

    await conn.beginTransaction();

    const [[customer]] = await conn.query(
      'SELECT id, loyalty_points FROM customers WHERE id = ? AND deleted_at IS NULL AND is_active = 1 FOR UPDATE',
      [customerId]
    );
    if (!customer) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng đang hoạt động' });
    }

    if (idempotencyKey) {
      const [[existingTxn]] = await conn.query(
        'SELECT id FROM loyalty_points_transactions WHERE customer_id = ? AND idempotency_key = ? LIMIT 1',
        [customerId, idempotencyKey]
      );
      if (existingTxn) {
        const [[current]] = await conn.query(
          'SELECT id, loyalty_points, loyalty_tier FROM customers WHERE id = ?',
          [customerId]
        );
        await conn.commit();
        return res.json({
          success: true,
          message: 'Giao dịch điểm đã được ghi nhận trước đó',
          data: { customer: current, idempotent: true },
        });
      }
    }

    const newPoints = Number(customer.loyalty_points) + points;
    const newTier = calculateTier(newPoints);

    await conn.query(
      'UPDATE customers SET loyalty_points = ?, loyalty_tier = ? WHERE id = ?',
      [newPoints, newTier, customerId]
    );
    const [txnResult] = await conn.query(
      `INSERT INTO loyalty_points_transactions
       (customer_id, transaction_type, points_change, description, reference_order_id, adjusted_by, idempotency_key, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 12 MONTH))`,
      [
        customerId,
        referenceOrderId ? 'earn_purchase' : 'earn_bonus',
        points,
        description,
        referenceOrderId,
        req.userId || null,
        idempotencyKey,
      ]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Cộng điểm thành công',
      data: {
        transaction_id: txnResult.insertId,
        customer_id: customerId,
        points_change: points,
        loyalty_points: newPoints,
        loyalty_tier: newTier,
      },
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Giao dịch điểm bị trùng idempotency_key' });
    }
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// POST /customers/:id/loyalty/adjust — Admin/dược sĩ điều chỉnh điểm thủ công
router.post('/:id/loyalty/adjust', async (req, res) => {
  if (!canManageLoyalty(req)) {
    return res.status(403).json({ success: false, message: 'Không có quyền điều chỉnh điểm khách hàng' });
  }

  const conn = await pool.getConnection();
  try {
    const customerId = Number(req.params.id);
    const pointsChange = Number(req.body.points_change);
    const adminNote = req.body.admin_note || req.body.note || null;
    const description = req.body.description || 'Điều chỉnh điểm thủ công';
    const idempotencyKey = req.body.idempotency_key || null;

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khách hàng không hợp lệ' });
    }
    if (!Number.isInteger(pointsChange) || pointsChange === 0) {
      return res.status(400).json({ success: false, message: 'points_change phải là số nguyên khác 0' });
    }

    await conn.beginTransaction();

    const [[customer]] = await conn.query(
      'SELECT id, loyalty_points FROM customers WHERE id = ? AND deleted_at IS NULL AND is_active = 1 FOR UPDATE',
      [customerId]
    );
    if (!customer) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng đang hoạt động' });
    }

    const newPoints = Number(customer.loyalty_points) + pointsChange;
    if (newPoints < 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Điểm khách hàng không được âm' });
    }

    const newTier = calculateTier(newPoints);
    const transactionType = pointsChange > 0 ? 'adjust_add' : 'adjust_deduct';

    await conn.query(
      'UPDATE customers SET loyalty_points = ?, loyalty_tier = ? WHERE id = ?',
      [newPoints, newTier, customerId]
    );
    const [txnResult] = await conn.query(
      `INSERT INTO loyalty_points_transactions
       (customer_id, transaction_type, points_change, description, adjusted_by, admin_note, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customerId, transactionType, pointsChange, description, req.userId || null, adminNote, idempotencyKey]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Điều chỉnh điểm thành công',
      data: {
        transaction_id: txnResult.insertId,
        customer_id: customerId,
        points_change: pointsChange,
        loyalty_points: newPoints,
        loyalty_tier: newTier,
      },
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Giao dịch điểm bị trùng idempotency_key' });
    }
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// GET /customers/:id/addresses - Get customer delivery addresses
router.get('/:id/addresses', async (req, res) => {
  if (!requireCanViewCustomer(req, res, req.params.id)) return;

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
  if (!requireCanEditCustomers(req, res)) return;

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
  if (!requireCanEditCustomer(req, res, req.params.id)) return;

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
  if (!requireCanEditCustomer(req, res, req.params.id)) return;

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
  if (!requireCanEditCustomer(req, res, req.params.id)) return;

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
  if (!requireCanEditCustomer(req, res, req.params.id)) return;

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
  if (!requireCanEditCustomers(req, res)) return;

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

// PUT /customers/me/avatar — Khách hàng tự đổi ảnh đại diện
router.put('/me/avatar', async (req, res) => {
  if (!requireCustomerAuth(req, res)) return;
  try {
    if (!(await hasCustomerColumn('avatar_url'))) {
      return res.status(501).json({
        success: false,
        message: 'Schema hiện tại chưa hỗ trợ avatar_url cho khách hàng',
      });
    }

    const id = req.userId;
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp avatar_url',
      });
    }

    // Kiểm tra URL hợp lệ (cơ bản)
    if (typeof avatar_url !== 'string' || avatar_url.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'avatar_url không hợp lệ (tối đa 500 ký tự)',
      });
    }

    const [[customer]] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    await pool.query(
      'UPDATE customers SET avatar_url = ? WHERE id = ?',
      [avatar_url, id]
    );

    res.json({
      success: true,
      message: 'Cập nhật ảnh đại diện thành công',
      data: { id, avatar_url },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /customers/:id/avatar — Admin cập nhật ảnh đại diện cho khách hàng
router.put('/:id/avatar', async (req, res) => {
  try {
    if (!(await hasCustomerColumn('avatar_url'))) {
      return res.status(501).json({
        success: false,
        message: 'Schema hiện tại chưa hỗ trợ avatar_url cho khách hàng',
      });
    }

    const { id } = req.params;
    const { avatar_url } = req.body;

    // Kiểm tra quyền: phải là admin hoặc chính khách hàng đó
    const isAdmin = req.userRole === 'admin';
    const isSelf  = req.userType === 'customer' && req.userId === Number(id);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền cập nhật ảnh đại diện cho tài khoản này',
      });
    }

    if (!avatar_url) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp avatar_url',
      });
    }

    if (typeof avatar_url !== 'string' || avatar_url.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'avatar_url không hợp lệ (tối đa 500 ký tự)',
      });
    }

    const [[customer]] = await pool.query(
      'SELECT id, full_name FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    }

    await pool.query(
      'UPDATE customers SET avatar_url = ? WHERE id = ?',
      [avatar_url, id]
    );

    res.json({
      success: true,
      message: 'Cập nhật ảnh đại diện thành công',
      data: { id: Number(id), full_name: customer.full_name, avatar_url },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
