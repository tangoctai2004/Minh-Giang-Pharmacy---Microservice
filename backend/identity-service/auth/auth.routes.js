const router = require('express').Router();
const pool   = require('../db/pool');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Auth Routes (Public — không yêu cầu JWT)
 * Gateway đã whitelist các path này nên request tới đây không có x-user-id
 *
 * DONE - POST /auth/login             — Đăng nhập chung (staff + customer)
 * DONE - POST /auth/admin/login       — Đăng nhập quản trị (chỉ admin/manager)
 * DONE - POST /auth/pos/verify-pin    — Xác thực PIN tại quầy POS
 * DONE - POST /auth/login-pos         — Đăng nhập tại quầy POS (legacy)
 * DONE - POST /auth/register          — Đăng ký tài khoản khách hàng mới
 * POST /auth/send-otp          — Gửi OTP đến SĐT/Email
 * POST /auth/verify-otp        — Xác minh OTP
 * DONE - POST /auth/refresh           — Làm mới access token bằng refresh token
 * DONE - POST /auth/logout            — Đăng xuất (thu hồi refresh token)
 * DONE - PUT  /auth/change-password   — Đổi mật khẩu
 */

// ── Helper: tìm account bằng identifier (username/email/phone) ──
async function findAccount(identifier) {
  // Tìm trong bảng users (staff) trước
  const [[user]] = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone,
            u.password_hash, u.is_active, u.role_id,
            r.name AS role_name, r.permissions
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE (u.username = ? OR u.email = ? OR u.phone = ?)
     LIMIT 1`,
    [identifier, identifier, identifier]
  );

  // Nếu không thấy staff → tìm trong bảng customers
  const [[customer]] = !user
    ? await pool.query(
        `SELECT id, full_name, email, phone, password_hash, is_active
         FROM customers
         WHERE (email = ? OR phone = ?) AND deleted_at IS NULL
         LIMIT 1`,
        [identifier, identifier]
      )
    : [[]];

  return { user, customer };
}

// ── Helper: tạo token pair + lưu refresh token ──
async function generateTokens(payload) {
  const jti = crypto.randomBytes(16).toString('hex');
  const accessToken = jwt.sign({ ...payload, jti }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  const refreshJti = crypto.randomBytes(16).toString('hex');
  const refreshToken = jwt.sign(
    { id: payload.id, type: payload.type, jti: refreshJti },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [payload.id, payload.type, tokenHash]
  );
  return { accessToken, refreshToken };
}

// POST /auth/login — Đăng nhập chung (hỗ trợ cả username và email_or_phone)
router.post('/login', async (req, res) => {
  try {
    // Hỗ trợ cả 2 field name: "username" (legacy) và "email_or_phone" (spec)
    const identifier = req.body.email_or_phone || req.body.username;
    const { password } = req.body;

    // 1. Validate input
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu',
      });
    }

    // 2. Tìm account
    const { user, customer } = await findAccount(identifier);

    // 3. Xác định account tìm được
    const account = user || customer;
    if (!account || !account.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    // 4. So sánh password
    const isMatch = await bcrypt.compare(password, account.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    // 5. Xác định type và payload
    const isStaff = !!user;
    const tokenPayload = isStaff
      ? { id: user.id, role: user.role_name, type: 'staff', permissions: user.permissions }
      : { id: customer.id, role: 'customer', type: 'customer' };

    // 6. Tạo tokens
    const { accessToken, refreshToken } = await generateTokens(tokenPayload);

    // 7. Cập nhật last_login (chỉ staff có field này)
    if (isStaff) {
      pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => {});
    }

    // 11. Trả kết quả
    const responseData = {
      accessToken,
      refreshToken,
    };

    if (isStaff) {
      responseData.user = {
        id:        user.id,
        username:  user.username,
        full_name: user.full_name,
        email:     user.email,
        role:      user.role_name,
      };
    } else {
      responseData.customer = {
        id:        customer.id,
        full_name: customer.full_name,
        email:     customer.email,
        phone:     customer.phone,
        role:      'customer',
      };
    }

    res.json({ success: true, data: responseData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/admin/login — Đăng nhập quản trị (chỉ admin/manager)
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password, remember_me } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu',
      });
    }

    // Tìm trong bảng users (staff only)
    const [[user]] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone,
              u.password_hash, u.is_active, u.role_id,
              r.name AS role_name, r.permissions
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE (u.username = ? OR u.email = ?)
       LIMIT 1`,
      [username, username]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    if (!user.permissions || !user.permissions.includes('dashboard.view')) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản không có quyền truy cập trang quản trị',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    const tokenPayload = { id: user.id, role: user.role_name, type: 'staff', permissions: user.permissions };
    const { accessToken, refreshToken } = await generateTokens(tokenPayload);

    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => {});

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id:        user.id,
          username:  user.username,
          full_name: user.full_name,
          email:     user.email,
          role:      user.role_name,
        },
        expires_in: process.env.JWT_EXPIRES_IN || '8h',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/pos/verify-pin — Xác thực PIN tại quầy POS
router.post('/pos/verify-pin', async (req, res) => {
  try {
    const { user_code, pin, kiosk_id } = req.body;

    if (!user_code || !pin || !kiosk_id) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp user_code, pin và kiosk_id',
      });
    }

    // Tìm user bằng user_code (username)
    const [[user]] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone,
              u.password_hash, u.is_active, u.role_id,
              r.name AS role_name, r.permissions
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.username = ?
       LIMIT 1`,
      [user_code]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Mã nhân viên hoặc PIN không đúng',
      });
    }

    if (!user.permissions || !user.permissions.includes('pos.access')) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản không có quyền truy cập POS',
      });
    }

    // Xác thực PIN (dùng password_hash)
    const isMatch = await bcrypt.compare(pin, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Mã nhân viên hoặc PIN không đúng',
      });
    }

    const tokenPayload = { id: user.id, role: user.role_name, type: 'staff', permissions: user.permissions };
    const { accessToken, refreshToken } = await generateTokens(tokenPayload);

    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => {});

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id:        user.id,
          username:  user.username,
          full_name: user.full_name,
          role:      user.role_name,
        },
        kiosk_id,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/login-pos (legacy — backward compatible)
router.post('/login-pos', async (req, res) => {
  try {
    const { username, password, kiosk_id } = req.body;

    // 1. Validate input
    if (!username || !password || !kiosk_id) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập, mật khẩu và mã kiosk',
      });
    }

    // 2. Tìm user trong bảng users
    const [[user]] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone,
              u.password_hash, u.is_active, u.role_id,
              r.name AS role_name, r.permissions
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE (u.username = ? OR u.email = ? OR u.phone = ?)
       LIMIT 1`,
      [username, username, username]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    if (!user.permissions || !user.permissions.includes('pos.access')) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản không có quyền truy cập POS',
      });
    }

    // 4. So sánh password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    // 5. Tạo access token
    const accessToken = jwt.sign(
      { id: user.id, role: user.role_name, type: 'staff', permissions: user.permissions },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // 6. Tạo refresh token
    const refreshToken = jwt.sign(
      { id: user.id, type: 'staff' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 7. Lưu refresh token vào DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at)
       VALUES (?, 'staff', ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
      [user.id, tokenHash]
    );

    // 8. Cập nhật last_login
    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => {});

    // 9. Trả kết quả
    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id:        user.id,
          username:  user.username,
          full_name: user.full_name,
          role:      user.role_name,
        },
        kiosk_id,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body;

    // 1. Validate input
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ họ tên, email, số điện thoại và mật khẩu',
      });
    }

    // 2. Kiểm tra email hoặc phone đã tồn tại chưa
    const [[existing]] = await pool.query(
      'SELECT id FROM customers WHERE (email = ? OR phone = ?) AND deleted_at IS NULL LIMIT 1',
      [email, phone]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email hoặc số điện thoại đã được đăng ký',
      });
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Insert customer mới
    const [result] = await pool.query(
      'INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [full_name, email, phone, passwordHash]
    );
    const customerId = result.insertId;

    // 5. Tạo access token (8h)
    const accessToken = jwt.sign(
      { id: customerId, role: 'customer', type: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // 6. Tạo refresh token (30 ngày)
    const refreshToken = jwt.sign(
      { id: customerId, type: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 7. Lưu refresh token vào DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at)
       VALUES (?, 'customer', ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
      [customerId, tokenHash]
    );

    // 8. Trả kết quả
    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        customer: {
          id:        customerId,
          full_name,
          email,
          phone,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { target, target_type, purpose } = req.body;

    // 1. Validate payload
    if (!target || !target_type || !purpose) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp target, target_type và purpose' });
    }
    if (!['phone', 'email'].includes(target_type)) {
      return res.status(400).json({ success: false, message: 'target_type không hợp lệ' });
    }

    // 2. Sinh ngẫu nhiên mã OTP 6 chữ số
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('\n--- 🔴 [TESTING ONLY] MÃ OTP ĐƯỢC SINH RA LÀ:', otpCode, '---\n');

    // 3. Băm (Hash) mã OTP bằng bcrypt
    const otpHash = await bcrypt.hash(otpCode, 10);

    // 4. Xoá cứng (hoặc update) các OTP cũ chưa sử dụng của target và purpose này để tránh spam hoặc lưu trữ rác
    await pool.query('DELETE FROM otp_codes WHERE target = ? AND purpose = ? AND used_at IS NULL', [target, purpose]);

    // 5. INSERT vào bảng otp_codes
    await pool.query(
      `INSERT INTO otp_codes (target, target_type, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
      [target, target_type, otpHash, purpose]
    );

    // 6. Gọi nội bộ sang Notification Service
    try {
      const endpoint = target_type === 'phone' ? 'sms/send' : 'email/send';
      // Sử dụng global fetch (Node.js 18+)
      await fetch(`http://notification-service:8005/api/notification/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: target, otp: otpCode, purpose })
      });
    } catch (err) {
      console.error('Call to Notification Service failed:', err);
    }

    // 7. Trả về response
    res.json({ success: true, message: 'Gửi OTP thành công', expires_in: 300 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { target, purpose, otp_code } = req.body;

    // 1. Validate target, purpose, otp_code
    if (!target || !purpose || !otp_code) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp target, purpose và otp_code' });
    }

    // 2. Lệnh SQL SELECT từ otp_codes lấy OTP mới nhất
    const [[record]] = await pool.query(
      `SELECT id, otp_hash, attempts FROM otp_codes 
       WHERE target = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW() 
       ORDER BY id DESC LIMIT 1`,
      [target, purpose]
    );

    // 3. Nếu không tìm thấy
    if (!record) {
      return res.status(400).json({ success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    if (record.attempts >= 5) {
      return res.status(400).json({ success: false, message: 'Bạn đã nhập sai quá số lần quy định' });
    }

    // 4. Dùng bcrypt.compare để so sánh otp_code
    const isMatch = await bcrypt.compare(otp_code, record.otp_hash);
    if (!isMatch) {
      // Nếu SAI: tăng attempts
      const newAttempts = record.attempts + 1;
      await pool.query('UPDATE otp_codes SET attempts = ? WHERE id = ?', [newAttempts, record.id]);
      
      if (newAttempts >= 5) {
        return res.status(400).json({ success: false, message: 'Bạn đã nhập sai quá số lần quy định' });
      } else {
        return res.status(400).json({ success: false, message: 'Mã OTP không đúng' });
      }
    }

    // Nếu ĐÚNG: update used_at
    await pool.query('UPDATE otp_codes SET used_at = NOW() WHERE id = ?', [record.id]);

    // 5. Trả về response
    res.json({ success: true, message: 'Xác thực thành công', data: { verified: true } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // 1. Validate input
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp refresh token',
      });
    }

    // 2. Tìm token trong DB (chưa bị revoke và chưa hết hạn)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const [[tokenRecord]] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ hoặc đã hết hạn',
      });
    }

    // 3. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ hoặc đã hết hạn',
      });
    }

    // 4. Lấy thông tin user/customer từ DB dựa vào type
    let payload;
    if (decoded.type === 'staff') {
      const [[user]] = await pool.query(
        `SELECT u.id, r.name AS role_name, r.permissions
         FROM users u LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND u.is_active = 1`,
        [decoded.id]
      );
      if (!user) {
        return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khoá' });
      }
      payload = { id: user.id, role: user.role_name, type: 'staff', permissions: user.permissions };
    } else {
      const [[customer]] = await pool.query(
        'SELECT id FROM customers WHERE id = ? AND is_active = 1 AND deleted_at IS NULL',
        [decoded.id]
      );
      if (!customer) {
        return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khoá' });
      }
      payload = { id: customer.id, role: 'customer', type: 'customer' };
    }

    // 5. Tạo access token mới
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // 1. Validate input
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp refresh token',
      });
    }

    // 2. Hash token rồi revoke trong DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const [result] = await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
      [tokenHash]
    );

    // 3. Không tìm thấy token cũng trả success (tránh lộ thông tin)
    res.json({ success: true, message: 'Đăng xuất thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /auth/change-password — Đổi mật khẩu (yêu cầu JWT)
router.put('/change-password', async (req, res) => {
  try {
    const userId = req.userId;
    const userType = req.userType;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const { current_password, new_password, confirm_password } = req.body;

    // Validate input
    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu',
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới và xác nhận mật khẩu không khớp',
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự',
      });
    }

    // Lấy password_hash hiện tại
    let passwordHash;
    if (userType === 'staff') {
      const [[user]] = await pool.query(
        'SELECT password_hash FROM users WHERE id = ? AND is_active = 1',
        [userId]
      );
      if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
      passwordHash = user.password_hash;
    } else {
      const [[customer]] = await pool.query(
        'SELECT password_hash FROM customers WHERE id = ? AND deleted_at IS NULL AND is_active = 1',
        [userId]
      );
      if (!customer) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
      passwordHash = customer.password_hash;
    }

    // Xác thực mật khẩu hiện tại
    const isMatch = await bcrypt.compare(current_password, passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Mật khẩu hiện tại không đúng',
      });
    }

    // Hash mật khẩu mới
    const newHash = await bcrypt.hash(new_password, 10);

    // Cập nhật
    if (userType === 'staff') {
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
    } else {
      await pool.query('UPDATE customers SET password_hash = ? WHERE id = ?', [newHash, userId]);
    }

    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
