const router = require('express').Router();
const pool   = require('../db/pool');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const OTP_PURPOSES = new Set(['register', 'reset_password', 'verify_email', 'pos_confirm']);
const OTP_TARGET_TYPES = new Set(['phone', 'email']);
const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 300);
const OTP_COOLDOWN_SECONDS = Number(process.env.OTP_COOLDOWN_SECONDS || 60);
const OTP_DAILY_LIMIT = Number(process.env.OTP_DAILY_LIMIT || 5);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

function parsePermissions(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function allowSocialAuthFallback() {
  return process.env.NODE_ENV !== 'production' && process.env.SOCIAL_AUTH_MOCK !== 'false';
}

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

// ── Helper: tự động sinh mã khách hàng KH-XXXX ──
async function generateCustomerCode() {
  const [[result]] = await pool.query('SELECT MAX(id) AS maxId FROM customers');
  const nextId = (result && result.maxId ? result.maxId : 0) + 1;
  return `KH-${String(nextId).padStart(4, '0')}`;
}

let customerColumnsCache = null;

async function getCustomerColumns() {
  if (customerColumnsCache) return customerColumnsCache;
  const [rows] = await pool.query('SHOW COLUMNS FROM customers');
  customerColumnsCache = new Set(rows.map((row) => row.Field));
  return customerColumnsCache;
}

async function hasCustomerColumn(field) {
  const columns = await getCustomerColumns();
  return columns.has(field);
}

async function insertCustomer(data) {
  const columns = await getCustomerColumns();
  const fields = [];
  const values = [];

  for (const [field, value] of Object.entries(data)) {
    if (columns.has(field)) {
      fields.push(field);
      values.push(value);
    }
  }

  const placeholders = fields.map(() => '?').join(', ');
  return pool.query(
    `INSERT INTO customers (${fields.join(', ')}) VALUES (${placeholders})`,
    values
  );
}

function socialFallbackEmail(provider, providerId) {
  const hash = crypto.createHash('sha1').update(`${provider}:${providerId}`).digest('hex').slice(0, 12);
  return `${provider}_${hash}@social.local`;
}

function socialFallbackPhone(provider, providerId) {
  const prefix = provider === 'zalo' ? '84' : '99';
  const digits = crypto.createHash('sha1').update(`${provider}:${providerId}`).digest('hex')
    .replace(/[a-f]/g, '')
    .padEnd(12, '0')
    .slice(0, 10);
  return `${prefix}${digits}`;
}

function normalizeTarget(target, targetType) {
  const raw = String(target || '').trim();
  if (targetType === 'email') return raw.toLowerCase();
  return raw.replace(/[^\d+]/g, '');
}

function inferTargetType(target, targetType) {
  if (targetType) return targetType;
  return String(target || '').includes('@') ? 'email' : 'phone';
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function getNotificationBaseUrl() {
  if (process.env.NOTIFICATION_SERVICE_URL) return process.env.NOTIFICATION_SERVICE_URL;
  return process.env.DB_HOST === 'mysql-db' ? 'http://notification-service:8005' : 'http://localhost:8005';
}

async function deliverOtp({ target, targetType, otpCode, purpose }) {
  const baseUrl = getNotificationBaseUrl();
  const timeoutMs = Number(process.env.NOTIFICATION_TIMEOUT_MS || 3000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const purposeLabels = {
    register: 'đăng ký tài khoản',
    reset_password: 'đặt lại mật khẩu',
    verify_email: 'xác minh email',
    pos_confirm: 'xác nhận thao tác POS',
  };
  const message = `Ma OTP Minh Giang Pharmacy cua ban la ${otpCode}. Ma co hieu luc ${Math.ceil(OTP_TTL_SECONDS / 60)} phut.`;

  try {
    const url = targetType === 'email' ? `${baseUrl}/email/send` : `${baseUrl}/sms/send`;
    const body = targetType === 'email'
      ? {
          to: target,
          subject: `OTP ${purposeLabels[purpose] || 'xác thực'} - Minh Giang Pharmacy`,
          text: message,
          html: `<p>${message}</p>`,
        }
      : { phone: target, message };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    return {
      attempted: true,
      ok: response.ok && payload.success !== false,
      status: response.status,
      provider: targetType === 'email' ? 'email' : 'sms',
      detail: payload.message || null,
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      provider: targetType === 'email' ? 'email' : 'sms',
      detail: err.message,
    };
  } finally {
    clearTimeout(timer);
  }
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
      ? { id: user.id, role: user.role_name, type: 'staff', permissions: parsePermissions(user.permissions) }
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

    // Chỉ cho phép admin hoặc manager
    if (user.role_name !== 'admin' && user.role_name !== 'manager') {
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

    const tokenPayload = { id: user.id, role: user.role_name, type: 'staff', permissions: parsePermissions(user.permissions) };
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

    // Chỉ cho phép pharmacist hoặc cashier
    if (user.role_name !== 'pharmacist' && user.role_name !== 'cashier') {
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

    const tokenPayload = { id: user.id, role: user.role_name, type: 'staff', permissions: parsePermissions(user.permissions) };
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

    // 3. Chỉ cho phép pharmacist hoặc cashier
    if (user.role_name !== 'pharmacist' && user.role_name !== 'cashier') {
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
      { id: user.id, role: user.role_name, type: 'staff', permissions: parsePermissions(user.permissions) },
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
    const customerCode = await generateCustomerCode();
    const [result] = await pool.query(
      'INSERT INTO customers (full_name, email, phone, password_hash, code) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, phone, passwordHash, customerCode]
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

// POST /auth/google — Đăng nhập bằng Google
router.post('/google', async (req, res) => {
  try {
    const { idToken, email: bodyEmail, google_id: bodyGoogleId, name: bodyName, picture: bodyPicture } = req.body;
    let email = bodyEmail;
    let googleId = bodyGoogleId;
    let name = bodyName;
    let picture = bodyPicture;
    let socialVerified = false;
    const supportsGoogleId = await hasCustomerColumn('google_id');
    const supportsAvatar = await hasCustomerColumn('avatar_url');

    // 1. Xác thực Google ID Token
    if (idToken) {
      try {
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
        if (response.ok) {
          const payload = await response.json();
          const audienceOk = !process.env.GOOGLE_CLIENT_ID || payload.aud === process.env.GOOGLE_CLIENT_ID;
          const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
          if (audienceOk && emailVerified) {
            email = payload.email;
            googleId = payload.sub;
            name = payload.name;
            picture = payload.picture;
            socialVerified = true;
          } else {
            console.warn('[Google Auth] Token không khớp GOOGLE_CLIENT_ID hoặc email chưa xác minh');
          }
        } else {
          console.warn('[Google Auth] Không thể xác thực token, sử dụng fallback / mock nếu có');
        }
      } catch (err) {
        console.error('[Google Auth] Lỗi kết nối Google API:', err.message);
      }
    }

    // 2. Kiểm tra thông tin bắt buộc
    if (!socialVerified && !allowSocialAuthFallback()) {
      return res.status(401).json({
        success: false,
        message: 'Google token không hợp lệ hoặc không xác thực được',
      });
    }

    if (!googleId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp idToken hợp lệ hoặc google_id',
      });
    }

    // 3. Tìm khách hàng theo google_id nếu schema hỗ trợ
    let customer = null;
    if (supportsGoogleId) {
      [[customer]] = await pool.query(
        'SELECT * FROM customers WHERE google_id = ? AND deleted_at IS NULL LIMIT 1',
        [googleId]
      );
    }

    // 4. Nếu chưa có google_id, tìm theo email để liên kết
    if (!customer && email) {
      [[customer]] = await pool.query(
        'SELECT * FROM customers WHERE email = ? AND deleted_at IS NULL LIMIT 1',
        [email]
      );
      if (customer) {
        const updateFields = [];
        const updateValues = [];
        if (supportsGoogleId) {
          updateFields.push('google_id = ?');
          updateValues.push(googleId);
          customer.google_id = googleId;
        }
        if (supportsAvatar && picture) {
          updateFields.push('avatar_url = COALESCE(avatar_url, ?)');
          updateValues.push(picture);
          if (!customer.avatar_url) customer.avatar_url = picture;
        }
        if (updateFields.length) {
          updateValues.push(customer.id);
          await pool.query(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
      }
    }

    // 5. Nếu hoàn toàn chưa tồn tại, tạo mới
    if (!customer) {
      const code = await generateCustomerCode();
      const safeEmail = email || socialFallbackEmail('google', googleId);
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const [result] = await insertCustomer({
        full_name: name || safeEmail.split('@')[0] || 'Google User',
        email: safeEmail,
        phone: socialFallbackPhone('google', googleId),
        password_hash: passwordHash,
        google_id: googleId,
        avatar_url: picture || null,
        code,
        is_active: 1,
      });

      const [[newCustomer]] = await pool.query(
        'SELECT * FROM customers WHERE id = ?',
        [result.insertId]
      );
      customer = newCustomer;
    }

    if (!customer.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hoá',
      });
    }

    // 6. Tạo tokens
    const tokenPayload = { id: customer.id, role: 'customer', type: 'customer' };
    const { accessToken, refreshToken } = await generateTokens(tokenPayload);
    // 7. Trả kết quả
    res.json({
      success: true,
      message: 'Đăng nhập Google thành công',
      data: {
        accessToken,
        refreshToken,
        access_token: accessToken,
        refresh_token: refreshToken,
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          role: 'customer',
          avatar_url: supportsAvatar ? customer.avatar_url : null,
          loyalty_tier: customer.loyalty_tier || 'member',
          loyalty_points: customer.loyalty_points || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/zalo — Đăng nhập bằng Zalo
router.post('/zalo', async (req, res) => {
  try {
    const { accessToken: tokenFromBody, zalo_id: bodyZaloId, name: bodyName, picture: bodyPicture } = req.body;
    let zaloId = bodyZaloId;
    let name = bodyName;
    let picture = bodyPicture;
    let socialVerified = false;
    const supportsAvatar = await hasCustomerColumn('avatar_url');

    // 1. Xác thực Zalo Access Token
    if (tokenFromBody) {
      try {
        const response = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
          headers: { access_token: tokenFromBody }
        });
        if (response.ok) {
          const payload = await response.json();
          zaloId = payload.id;
          name = payload.name;
          picture = payload.picture && payload.picture.data && payload.picture.data.url ? payload.picture.data.url : null;
          socialVerified = true;
        } else {
          console.warn('[Zalo Auth] Không thể xác thực token, sử dụng fallback / mock nếu có');
        }
      } catch (err) {
        console.error('[Zalo Auth] Lỗi kết nối Zalo API:', err.message);
      }
    }

    // 2. Kiểm tra thông tin bắt buộc
    if (!socialVerified && !allowSocialAuthFallback()) {
      return res.status(401).json({
        success: false,
        message: 'Zalo token không hợp lệ hoặc không xác thực được',
      });
    }

    if (!zaloId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp accessToken hợp lệ hoặc zalo_id',
      });
    }

    // 3. Tìm khách hàng theo zalo_id
    let [[customer]] = await pool.query(
      'SELECT * FROM customers WHERE zalo_id = ? AND deleted_at IS NULL LIMIT 1',
      [zaloId]
    );

    // 4. Nếu chưa có, tạo mới
    if (!customer) {
      const code = await generateCustomerCode();
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const [result] = await insertCustomer({
        full_name: name || 'Zalo User',
        email: socialFallbackEmail('zalo', zaloId),
        phone: socialFallbackPhone('zalo', zaloId),
        password_hash: passwordHash,
        zalo_id: zaloId,
        avatar_url: picture || null,
        code,
        is_active: 1,
      });

      const [[newCustomer]] = await pool.query(
        'SELECT * FROM customers WHERE id = ?',
        [result.insertId]
      );
      customer = newCustomer;
    }

    if (!customer.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hoá',
      });
    }

    // 5. Tạo tokens
    const tokenPayload = { id: customer.id, role: 'customer', type: 'customer' };
    const { accessToken, refreshToken } = await generateTokens(tokenPayload);

    // 6. Trả kết quả
    res.json({
      success: true,
      message: 'Đăng nhập bằng Zalo thành công',
      data: {
        accessToken,
        refreshToken,
        access_token: accessToken,
        refresh_token: refreshToken,
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          role: 'customer',
          avatar_url: supportsAvatar ? customer.avatar_url : null,
          loyalty_tier: customer.loyalty_tier || 'member',
          loyalty_points: customer.loyalty_points || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /auth/zalo/redirect — Tạo link redirect OAuth2 Zalo
router.get('/zalo/redirect', (req, res) => {
  const appId = process.env.ZALO_APP_ID || '1234567890';
  const redirectUri = process.env.ZALO_REDIRECT_URI || `${process.env.GATEWAY_URL || 'http://localhost:8000'}/api/identity/auth/zalo/callback`;
  const state = crypto.randomBytes(8).toString('hex');
  const redirectUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      success: true,
      data: { redirect_url: redirectUrl }
    });
  }

  res.redirect(redirectUrl);
});

// GET /auth/zalo/callback — Nhận callback từ Zalo OAuth2
router.get('/zalo/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Thiếu authorization code');
    }
    const supportsAvatar = await hasCustomerColumn('avatar_url');

    let zaloId = allowSocialAuthFallback() ? 'mock_zalo_id_' + code.substring(0, 8) : null;
    let name = allowSocialAuthFallback() ? 'Zalo User ' + code.substring(0, 4) : null;
    let picture = null;
    let socialVerified = false;

    const appId = process.env.ZALO_APP_ID || '1234567890';
    const appSecret = process.env.ZALO_APP_SECRET || 'mock_secret';

    try {
      const tokenRes = await fetch('https://oauth.zaloapp.com/v3/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'secret_key': appSecret
        },
        body: new URLSearchParams({
          code,
          app_id: appId,
          grant_type: 'authorization_code'
        })
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const profileRes = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
          headers: { access_token: accessToken }
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          zaloId = profileData.id;
          name = profileData.name;
          picture = profileData.picture && profileData.picture.data && profileData.picture.data.url ? profileData.picture.data.url : null;
          socialVerified = true;
        }
      }
    } catch (e) {
      console.warn('[Zalo Callback] Không thể kết nối Zalo OAuth, chạy chế độ mock/fallback:', e.message);
    }

    if (!socialVerified && !allowSocialAuthFallback()) {
      return res.status(401).send('Zalo authorization code không hợp lệ hoặc không xác thực được');
    }

    let [[customer]] = await pool.query(
      'SELECT * FROM customers WHERE zalo_id = ? AND deleted_at IS NULL LIMIT 1',
      [zaloId]
    );

    if (!customer) {
      const codeStr = await generateCustomerCode();
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const [result] = await insertCustomer({
        full_name: name,
        email: socialFallbackEmail('zalo', zaloId),
        phone: socialFallbackPhone('zalo', zaloId),
        password_hash: passwordHash,
        zalo_id: zaloId,
        avatar_url: picture || null,
        code: codeStr,
        is_active: 1,
      });

      const [[newCustomer]] = await pool.query(
        'SELECT * FROM customers WHERE id = ?',
        [result.insertId]
      );
      customer = newCustomer;
    }

    const tokenPayload = { id: customer.id, role: 'customer', type: 'customer' };
    const { accessToken, refreshToken } = await generateTokens(tokenPayload);
    const frontendOrigin = process.env.FRONTEND_ORIGIN || process.env.GATEWAY_URL || 'http://localhost:3000';
    const callbackData = {
      success: true,
      data: {
        accessToken,
        refreshToken,
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          email: customer.email || null,
          phone: customer.phone || null,
          role: 'customer',
        },
      },
    };

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Zalo Authentication</title></head>
      <body>
        <p>Đăng nhập thành công! Đang chuyển hướng...</p>
        <script>
          const data = ${JSON.stringify(callbackData)};
          if (window.opener) {
            window.opener.postMessage(data, ${JSON.stringify(frontendOrigin)});
            window.close();
          } else {
            localStorage.setItem('accessToken', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
            localStorage.setItem('customer', JSON.stringify(data.data.customer));
            window.location.href = '/';
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Lỗi máy chủ: ' + err.message);
  }
});

// POST /auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const targetType = inferTargetType(req.body.target, req.body.target_type);
    const target = normalizeTarget(req.body.target, targetType);
    const purpose = req.body.purpose || 'register';

    if (!target || !OTP_TARGET_TYPES.has(targetType) || !OTP_PURPOSES.has(purpose)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp target, target_type hợp lệ và purpose hợp lệ',
      });
    }

    if (targetType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return res.status(400).json({ success: false, message: 'Email nhận OTP không hợp lệ' });
    }
    if (targetType === 'phone' && !/^\+?\d{9,15}$/.test(target)) {
      return res.status(400).json({ success: false, message: 'Số điện thoại nhận OTP không hợp lệ' });
    }

    const [[latest]] = await pool.query(
      `SELECT id, created_at, last_send_at, blocked_until
       FROM otp_codes
       WHERE target = ? AND target_type = ? AND purpose = ?
       ORDER BY id DESC
       LIMIT 1`,
      [target, targetType, purpose]
    );

    if (latest && latest.blocked_until && new Date(latest.blocked_until).getTime() > Date.now()) {
      return res.status(429).json({
        success: false,
        message: 'Mã OTP đang bị tạm khoá do nhập sai quá nhiều lần. Vui lòng thử lại sau.',
        blocked_until: latest.blocked_until,
      });
    }

    if (latest && latest.last_send_at) {
      const elapsedSeconds = (Date.now() - new Date(latest.last_send_at).getTime()) / 1000;
      if (elapsedSeconds < OTP_COOLDOWN_SECONDS) {
        return res.status(429).json({
          success: false,
          message: `Vui lòng chờ ${Math.ceil(OTP_COOLDOWN_SECONDS - elapsedSeconds)} giây trước khi gửi lại OTP`,
        });
      }
    }

    const [[{ sentToday }]] = await pool.query(
      `SELECT COUNT(*) AS sentToday
       FROM otp_codes
       WHERE target = ? AND target_type = ? AND purpose = ? AND created_at >= CURDATE()`,
      [target, targetType, purpose]
    );
    if (sentToday >= OTP_DAILY_LIMIT) {
      return res.status(429).json({
        success: false,
        message: 'Đã vượt quá số lần gửi OTP trong ngày',
      });
    }

    const otpCode = generateOtpCode();
    const otpHash = await bcrypt.hash(otpCode, 10);
    await pool.query(
      `INSERT INTO otp_codes
       (target, target_type, otp_hash, purpose, expires_at, send_count_today, last_send_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, NOW())`,
      [target, targetType, otpHash, purpose, OTP_TTL_SECONDS, sentToday + 1]
    );

    const delivery = await deliverOtp({ target, targetType, otpCode, purpose });
    if (!delivery.ok && process.env.NOTIFICATION_REQUIRED === 'true') {
      return res.status(502).json({
        success: false,
        message: 'Không gửi được OTP qua hệ thống thông báo',
        delivery,
      });
    }

    const data = {
      target,
      target_type: targetType,
      purpose,
      expires_in: OTP_TTL_SECONDS,
      delivery: delivery.ok ? delivery : { ...delivery, mode: 'local-fallback' },
    };
    if (process.env.NODE_ENV !== 'production' || process.env.OTP_DEBUG_RESPONSE === 'true') {
      data.debug_otp = otpCode;
    }

    res.status(201).json({
      success: true,
      message: 'OTP đã được tạo và gửi',
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const targetType = inferTargetType(req.body.target, req.body.target_type);
    const target = normalizeTarget(req.body.target, targetType);
    const purpose = req.body.purpose || 'register';
    const otpCode = String(req.body.otp_code || req.body.otp || '').trim();

    if (!target || !OTP_TARGET_TYPES.has(targetType) || !OTP_PURPOSES.has(purpose) || !/^\d{6}$/.test(otpCode)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp target, target_type, purpose và otp_code hợp lệ',
      });
    }

    const [[otp]] = await pool.query(
      `SELECT *
       FROM otp_codes
       WHERE target = ? AND target_type = ? AND purpose = ? AND used_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [target, targetType, purpose]
    );

    if (!otp) {
      return res.status(401).json({ success: false, message: 'OTP không hợp lệ hoặc đã được sử dụng' });
    }
    if (otp.blocked_until && new Date(otp.blocked_until).getTime() > Date.now()) {
      return res.status(429).json({
        success: false,
        message: 'OTP đang bị tạm khoá do nhập sai quá nhiều lần',
        blocked_until: otp.blocked_until,
      });
    }
    if (new Date(otp.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({ success: false, message: 'OTP đã hết hạn' });
    }

    const matched = await bcrypt.compare(otpCode, otp.otp_hash);
    if (!matched) {
      const attempts = Number(otp.attempts || 0) + 1;
      const shouldBlock = attempts >= OTP_MAX_ATTEMPTS;
      await pool.query(
        `UPDATE otp_codes
         SET attempts = ?, blocked_until = CASE WHEN ? THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE) ELSE blocked_until END
         WHERE id = ?`,
        [attempts, shouldBlock, otp.id]
      );
      return res.status(401).json({
        success: false,
        message: shouldBlock
          ? 'OTP sai quá nhiều lần. Tài khoản nhận OTP bị tạm khoá 15 phút.'
          : 'OTP không đúng',
        attempts_remaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts),
      });
    }

    await pool.query('UPDATE otp_codes SET used_at = NOW() WHERE id = ?', [otp.id]);

    if (purpose === 'register' || purpose === 'verify_email') {
      const column = targetType === 'email' ? 'email' : 'phone';
      await pool.query(
        `UPDATE customers SET is_active = 1 WHERE ${column} = ? AND deleted_at IS NULL`,
        [target]
      );
    }

    res.json({
      success: true,
      message: 'Xác minh OTP thành công',
      data: {
        target,
        target_type: targetType,
        purpose,
        verified: true,
      },
    });
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
      payload = { id: user.id, role: user.role_name, type: 'staff', permissions: parsePermissions(user.permissions) };
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
