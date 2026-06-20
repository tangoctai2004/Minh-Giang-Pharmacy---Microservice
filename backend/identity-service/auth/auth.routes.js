const router = require('express').Router();
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
  return process.env.NODE_ENV !== 'production' && process.env.SOCIAL_AUTH_MOCK === 'true';
}

function getGatewayUrl() {
  return process.env.GATEWAY_URL || 'http://localhost:8000';
}

function getGoogleRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${getGatewayUrl()}/api/identity/auth/google/callback`;
}

function getZaloRedirectUri() {
  return process.env.ZALO_REDIRECT_URI || `${getGatewayUrl()}/api/identity/auth/zalo/callback`;
}

function isConfiguredSecret(value) {
  const normalized = String(value || '').trim();
  return Boolean(normalized && !normalized.startsWith('your_') && !normalized.startsWith('change_me'));
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getOAuthSecret() {
  return process.env.JWT_SECRET || 'change_me_to_a_random_32_char_string';
}

function createOAuthState(provider) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const payload = `${provider}.${timestamp}.${nonce}`;
  const signature = base64Url(crypto.createHmac('sha256', getOAuthSecret()).update(payload).digest());
  return `${payload}.${signature}`;
}

function verifyOAuthState(provider, state) {
  if (!state || typeof state !== 'string') return false;

  const parts = state.split('.');
  if (parts.length !== 4 || parts[0] !== provider) return false;

  const timestamp = Number(parts[1]);
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > 10 * 60 * 1000) return false;

  const payload = parts.slice(0, 3).join('.');
  const expected = base64Url(crypto.createHmac('sha256', getOAuthSecret()).update(payload).digest());
  const actual = parts[3];
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean);
  const prefix = `${name}=`;
  const cookie = cookies.find((part) => part.startsWith(prefix));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch (_err) {
    return null;
  }
}

function setOAuthCookie(res, name, value) {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
}

function clearOAuthCookie(res, name) {
  res.clearCookie(name, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

function validateOAuthState(req, res, provider) {
  const state = req.query.state;
  const cookieName = `oauth_${provider}_state`;
  const expectedState = readCookie(req, cookieName);
  clearOAuthCookie(res, cookieName);
  return expectedState && state === expectedState && verifyOAuthState(provider, state);
}

function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function verifyGoogleIdToken(idToken) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    return { ok: false, reason: `tokeninfo_${response.status}` };
  }

  const payload = await response.json();
  const audienceOk = !process.env.GOOGLE_CLIENT_ID || payload.aud === process.env.GOOGLE_CLIENT_ID;
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (!audienceOk || !emailVerified || !payload.sub || !payload.email) {
    return { ok: false, reason: 'audience_or_email_unverified', payload };
  }

  return {
    ok: true,
    profile: {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture || null,
    },
  };
}

async function exchangeGoogleCode(code) {
  if (!isConfiguredSecret(process.env.GOOGLE_CLIENT_ID) || !isConfiguredSecret(process.env.GOOGLE_CLIENT_SECRET)) {
    throw new Error('Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id_token) {
    throw new Error(payload.error_description || payload.error || 'Không đổi được Google authorization code');
  }
  return payload;
}

async function getZaloProfile(accessToken) {
  const headers = { access_token: accessToken };
  const appSecret = process.env.ZALO_APP_SECRET;
  if (isConfiguredSecret(appSecret)) {
    const proof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
    headers.appsecret_proof = proof;
  }
  const response = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
    headers: headers,
  });
  if (!response.ok) {
    throw new Error(`Không lấy được Zalo profile (${response.status})`);
  }
  const payload = await response.json();
  return {
    zaloId: payload.id,
    name: payload.name,
    picture: payload.picture && payload.picture.data && payload.picture.data.url ? payload.picture.data.url : null,
  };
}

async function exchangeZaloCode(code, codeVerifier) {
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;
  if (!isConfiguredSecret(appId) || !isConfiguredSecret(appSecret)) {
    throw new Error('Thiếu ZALO_APP_ID hoặc ZALO_APP_SECRET');
  }

  const body = new URLSearchParams({
    code,
    app_id: appId,
    grant_type: 'authorization_code',
  });
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetch('https://oauth.zaloapp.com/v4/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      secret_key: appSecret,
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_name || payload.error_description || payload.error || 'Không đổi được Zalo authorization code');
  }
  return payload;
}

async function findOrCreateGoogleCustomer({ googleId, email, name, picture }) {
  const supportsGoogleId = await hasCustomerColumn('google_id');
  const supportsAvatar = await hasCustomerColumn('avatar_url');
  const supportsEmailVerifiedAt = await hasCustomerColumn('email_verified_at');
  let customer = null;

  if (supportsGoogleId) {
    [[customer]] = await pool.query(
      'SELECT * FROM customers WHERE google_id = ? AND deleted_at IS NULL LIMIT 1',
      [googleId]
    );
  }

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
      if (supportsEmailVerifiedAt && email) {
        updateFields.push('email_verified_at = COALESCE(email_verified_at, NOW())');
        customer.email_verified_at = customer.email_verified_at || new Date();
      }
      if (updateFields.length) {
        updateValues.push(customer.id);
        await pool.query(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
      }
    }
  }

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
      email_verified_at: email ? new Date() : null,
    });
    const [[newCustomer]] = await pool.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    customer = newCustomer;
  }

  return { customer, supportsAvatar };
}

function sendOAuthCallbackPage(res, data) {
  const frontendOrigin = process.env.FRONTEND_ORIGIN || process.env.GATEWAY_URL || 'http://localhost:3000';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>OAuth Authentication</title></head>
    <body>
      <p>Đăng nhập thành công!</p>
      <p id="oauth-status">Đang hoàn tất đăng nhập...</p>
      <script>
        const data = ${JSON.stringify(data)};
        if (window.opener) {
          window.opener.postMessage(data, ${JSON.stringify(frontendOrigin)});
          window.close();
        } else {
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          localStorage.setItem('customer', JSON.stringify(data.data.customer));
          localStorage.setItem('MG_CLIENT_AUTH', JSON.stringify({
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
            customer: data.data.customer,
            loggedInAt: Date.now()
          }));
          document.getElementById('oauth-status').textContent = 'Token đã được lưu vào localStorage.';
        }
      </script>
    </body>
    </html>
  `);
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
 * DONE - POST /auth/reset-password    — Đặt lại mật khẩu bằng OTP
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
  let customer;
  if (!user) {
    const supportsEmailVerifiedAt = await hasCustomerColumn('email_verified_at');
    const supportsPhoneVerifiedAt = await hasCustomerColumn('phone_verified_at');
    [[customer]] = await pool.query(
      `SELECT id, full_name, email, phone, password_hash, is_active
              ${supportsEmailVerifiedAt ? ', email_verified_at' : ', NOW() AS email_verified_at'}
              ${supportsPhoneVerifiedAt ? ', phone_verified_at' : ', NOW() AS phone_verified_at'}
       FROM customers
       WHERE (email = ? OR phone = ?) AND deleted_at IS NULL
       LIMIT 1`,
      [identifier, identifier]
    );
  }

  return { user, customer };
}

function ttlToSeconds(value, fallback) {
  const raw = String(value || fallback || '').trim();
  const match = raw.match(/^(\d+)\s*([smhd])?$/i);
  if (!match) return ttlToSeconds(fallback || '8h', '8h');
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multiplier = unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
  return Math.max(60, amount * multiplier);
}

function sessionPolicy(kind) {
  if (kind === 'admin') {
    return {
      accessTtl: process.env.ADMIN_ACCESS_TOKEN_TTL || '2h',
      refreshTtl: process.env.ADMIN_REFRESH_TOKEN_TTL || '1d',
    };
  }
  if (kind === 'pos') {
    return {
      accessTtl: process.env.POS_ACCESS_TOKEN_TTL || '8h',
      refreshTtl: process.env.POS_REFRESH_TOKEN_TTL || '12h',
    };
  }
  if (kind === 'customer') {
    return {
      accessTtl: process.env.CUSTOMER_ACCESS_TOKEN_TTL || process.env.JWT_EXPIRES_IN || '2h',
      refreshTtl: process.env.CUSTOMER_REFRESH_TOKEN_TTL || '14d',
    };
  }
  return {
    accessTtl: process.env.JWT_EXPIRES_IN || '8h',
    refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  };
}

// ── Helper: tạo token pair + lưu refresh token ──
async function generateTokens(payload, policyName) {
  const policy = sessionPolicy(policyName || (payload.type === 'customer' ? 'customer' : 'staff'));
  const sessionKind = policyName || (payload.type === 'customer' ? 'customer' : 'staff');
  const refreshTtlSeconds = ttlToSeconds(policy.refreshTtl, '7d');
  const refreshExpiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);
  const jti = crypto.randomBytes(16).toString('hex');
  const accessToken = jwt.sign({ ...payload, session_kind: sessionKind, jti }, process.env.JWT_SECRET, {
    expiresIn: policy.accessTtl,
  });
  const refreshJti = crypto.randomBytes(16).toString('hex');
  const refreshToken = jwt.sign(
    { id: payload.id, type: payload.type, session_kind: sessionKind, jti: refreshJti },
    process.env.JWT_SECRET,
    { expiresIn: policy.refreshTtl }
  );
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [payload.id, payload.type, tokenHash, refreshExpiresAt]
  );
  return { accessToken, refreshToken, expiresIn: policy.accessTtl, refreshExpiresIn: policy.refreshTtl };
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
  const timeoutMs = Number(process.env.NOTIFICATION_TIMEOUT_MS || 10000);
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
        subject: `[Minh Giang Pharmacy] Mã OTP ${purposeLabels[purpose] || 'xác thực'} của bạn`,
        text: message,
        html: `
            <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #f8fafc; text-align: center;">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); border: 1px solid #334155;">
                <tr>
                  <td style="padding: 40px 30px; text-align: center;">
                    <!-- Logo -->
                    <div style="margin-bottom: 25px;">
                      <img src="cid:logo" alt="Minh Giang Pharmacy" style="height: 60px; width: auto; max-width: 100%; border: 0; outline: none; text-decoration: none;" />
                    </div>
                    
                    <!-- Divider -->
                    <hr style="border: 0; border-top: 1px solid #334155; margin-bottom: 25px;" />
                    
                    <!-- Title -->
                    <h2 style="font-size: 16px; font-weight: 600; color: #94a3b8; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1.5px;">Mã xác thực của bạn:</h2>
                    
                    <!-- OTP Code Box -->
                    <div style="background-color: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 15px; margin: 20px 0; display: inline-block; min-width: 200px;">
                      <span style="font-size: 38px; font-weight: 800; color: #10b981; letter-spacing: 6px; font-family: monospace, Courier, monospace; display: block;">${otpCode}</span>
                    </div>
                    
                    <!-- Content -->
                    <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; text-align: left; margin: 20px 0 15px 0;">
                      Chào bạn,
                    </p>
                    <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; text-align: left; margin: 0 0 20px 0;">
                      Bạn gần như đã hoàn tất quy trình <strong>${purposeLabels[purpose] || 'xác thực'}</strong> tại <strong>Minh Giang Pharmacy</strong>. Vui lòng quay lại màn hình thiết lập tài khoản và nhập mã OTP ở trên để tiếp tục.
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: left; margin: 0 0 25px 0; background-color: #1a2230; padding: 12px; border-radius: 6px; border-left: 4px solid #10b981;">
                      ⚠️ Mã xác thực này chỉ có hiệu lực với địa chỉ email nhận thư này và sẽ hết hạn sau <strong>${Math.ceil(OTP_TTL_SECONDS / 60)} phút</strong>. Tuyệt đối không chia sẻ mã này với bất kỳ ai để bảo vệ tài khoản của bạn.
                    </p>
                    
                    <!-- Sign-off -->
                    <p style="font-size: 14px; color: #94a3b8; text-align: left; margin: 25px 0 0 0; border-top: 1px solid #334155; padding-top: 20px;">
                      Trân trọng,<br />
                      <strong>Đội ngũ Minh Giang Pharmacy</strong>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #0f172a; padding: 25px 30px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #1e293b;">
                    Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ CSKH nếu có thắc mắc.<br />
                    <a href="http://localhost:5500/client/index.html" style="color: #10b981; text-decoration: none; font-weight: bold; margin-top: 8px; display: inline-block;">Ghé thăm website của chúng tôi</a><br /><br />
                    © 2026 Minh Giang Pharmacy. All Rights Reserved.
                  </td>
                </tr>
              </table>
            </div>
          `,
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

async function createAndDeliverOtp({ target, targetType, purpose }) {
  const [[latest]] = await pool.query(
    `SELECT id, created_at, last_send_at, blocked_until
     FROM otp_codes
     WHERE target = ? AND target_type = ? AND purpose = ?
     ORDER BY id DESC
     LIMIT 1`,
    [target, targetType, purpose]
  );

  if (latest && latest.blocked_until && new Date(latest.blocked_until).getTime() > Date.now()) {
    const err = new Error('Mã OTP đang bị tạm khoá do nhập sai quá nhiều lần. Vui lòng thử lại sau.');
    err.status = 429;
    err.blocked_until = latest.blocked_until;
    throw err;
  }

  if (latest && latest.last_send_at) {
    const elapsedSeconds = (Date.now() - new Date(latest.last_send_at).getTime()) / 1000;
    if (elapsedSeconds < OTP_COOLDOWN_SECONDS) {
      const err = new Error(`Vui lòng chờ ${Math.ceil(OTP_COOLDOWN_SECONDS - elapsedSeconds)} giây trước khi gửi lại OTP`);
      err.status = 429;
      throw err;
    }
  }

  const [[{ sentToday }]] = await pool.query(
    `SELECT COUNT(*) AS sentToday
     FROM otp_codes
     WHERE target = ? AND target_type = ? AND purpose = ? AND created_at >= CURDATE()`,
    [target, targetType, purpose]
  );
  if (sentToday >= OTP_DAILY_LIMIT) {
    const err = new Error('Đã vượt quá số lần gửi OTP trong ngày');
    err.status = 429;
    throw err;
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
  if (!delivery.ok) {
    const err = new Error('Không gửi được OTP qua hệ thống thông báo');
    err.status = 502;
    err.delivery = delivery;
    throw err;
  }

  const data = {
    target,
    target_type: targetType,
    purpose,
    expires_in: OTP_TTL_SECONDS,
    delivery,
    ...(process.env.OTP_DEBUG_RESPONSE === 'true' && { code: otpCode }),
  };
  return data;
}

async function consumeOtpCode({ target, targetType, purpose, otpCode }) {
  const [[otp]] = await pool.query(
    `SELECT *
     FROM otp_codes
     WHERE target = ? AND target_type = ? AND purpose = ? AND used_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [target, targetType, purpose]
  );

  if (!otp) {
    return { ok: false, status: 401, message: 'OTP không hợp lệ hoặc đã được sử dụng' };
  }
  if (otp.blocked_until && new Date(otp.blocked_until).getTime() > Date.now()) {
    return {
      ok: false,
      status: 429,
      message: 'OTP đang bị tạm khoá do nhập sai quá nhiều lần',
      blocked_until: otp.blocked_until,
    };
  }
  if (new Date(otp.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 401, message: 'OTP đã hết hạn' };
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
    return {
      ok: false,
      status: 401,
      message: shouldBlock
        ? 'OTP sai quá nhiều lần. Tài khoản nhận OTP bị tạm khoá 15 phút.'
        : 'OTP không đúng',
      attempts_remaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts),
    };
  }

  await pool.query('UPDATE otp_codes SET used_at = NOW() WHERE id = ?', [otp.id]);
  return { ok: true, otp };
}

async function findPasswordResetAccount(target, targetType, accountType) {
  const column = targetType === 'email' ? 'email' : 'phone';
  if (accountType === 'customer' || !accountType) {
    const [[customer]] = await pool.query(
      `SELECT id, 'customer' AS account_type FROM customers
       WHERE ${column} = ? AND deleted_at IS NULL LIMIT 1`,
      [target]
    );
    if (customer) return customer;
  }

  if (accountType === 'staff' || !accountType) {
    const [[user]] = await pool.query(
      `SELECT id, 'staff' AS account_type FROM users
       WHERE ${column} = ? AND is_active = 1 LIMIT 1`,
      [target]
    );
    if (user) return user;
  }

  return null;
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
    if (customer && !customer.email_verified_at) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản chưa xác thực email. Vui lòng kiểm tra email để nhập mã OTP.',
        code: 'EMAIL_NOT_VERIFIED',
        data: {
          email: customer.email,
          phone: customer.phone,
        },
      });
    }

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
    const { accessToken, refreshToken, expiresIn, refreshExpiresIn } = await generateTokens(
      tokenPayload,
      isStaff ? 'staff' : 'customer'
    );

    // 7. Cập nhật last_login (chỉ staff có field này)
    if (isStaff) {
      pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => { });
    }

    // 11. Trả kết quả
    const responseData = {
      accessToken,
      refreshToken,
      expires_in: expiresIn,
      refresh_expires_in: refreshExpiresIn,
    };

    if (isStaff) {
      responseData.user = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role_name,
      };
    } else {
      responseData.customer = {
        id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone,
        role: 'customer',
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
    const { accessToken, refreshToken, expiresIn, refreshExpiresIn } = await generateTokens(tokenPayload, 'admin');

    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => { });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role_name,
        },
        expires_in: expiresIn,
        refresh_expires_in: refreshExpiresIn,
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
    const { accessToken, refreshToken, expiresIn, refreshExpiresIn } = await generateTokens(tokenPayload, 'pos');

    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => { });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role_name,
        },
        kiosk_id,
        expires_in: expiresIn,
        refresh_expires_in: refreshExpiresIn,
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

    // 5. Tạo token theo chính sách phiên POS
    const { accessToken, refreshToken, expiresIn, refreshExpiresIn } = await generateTokens(
      { id: user.id, role: user.role_name, type: 'staff', permissions: parsePermissions(user.permissions) },
      'pos'
    );

    // 8. Cập nhật last_login
    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => { });

    // 9. Trả kết quả
    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role_name,
        },
        kiosk_id,
        expires_in: expiresIn,
        refresh_expires_in: refreshExpiresIn,
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
    const normalizedEmail = normalizeTarget(email, 'email');
    const normalizedPhone = normalizeTarget(phone, 'phone');

    // 1. Validate input
    if (!full_name || !normalizedEmail || !normalizedPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ họ tên, email, số điện thoại và mật khẩu',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
    }
    if (!/^\+?\d{9,15}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ' });
    }
    if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 8 ký tự, có chữ in hoa và chữ số',
      });
    }

    // 2. Kiểm tra email hoặc phone đã tồn tại chưa
    const supportsEmailVerifiedAt = await hasCustomerColumn('email_verified_at');
    const [[existing]] = await pool.query(
      `SELECT id, email, phone, is_active,
              ${supportsEmailVerifiedAt ? 'email_verified_at' : 'NOW() AS email_verified_at'}
       FROM customers WHERE (email = ? OR phone = ?) AND deleted_at IS NULL LIMIT 1`,
      [normalizedEmail, normalizedPhone]
    );
    if (existing) {
      if (existing.is_active && existing.email_verified_at) {
        return res.status(409).json({
          success: false,
          message: 'Email hoặc số điện thoại đã được đăng ký',
        });
      }

      const otp = await createAndDeliverOtp({
        target: normalizedEmail,
        targetType: 'email',
        purpose: 'register',
      });
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE customers
         SET full_name = ?, email = ?, phone = ?, password_hash = ?, is_active = 0 ${supportsEmailVerifiedAt ? `, email_verified_at = NULL` : ''}
         WHERE id = ?`,
        [full_name, normalizedEmail, normalizedPhone, passwordHash, existing.id]
      );

      return res.status(200).json({
        success: true,
        message: 'Tài khoản đang chờ xác thực. Mã OTP mới đã được gửi đến email.',
        data: {
          customer: {
            id: existing.id,
            full_name,
            email: normalizedEmail,
            phone: normalizedPhone,
            is_active: 0,
          },
          ...(otp && { otp }),
        },
      });
    }

    const otp = await createAndDeliverOtp({
      target: normalizedEmail,
      targetType: 'email',
      purpose: 'register',
    });

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Insert customer mới ở trạng thái chờ xác thực
    const customerCode = await generateCustomerCode();
    const [result] = await insertCustomer({
      full_name,
      email: normalizedEmail,
      phone: normalizedPhone,
      password_hash: passwordHash,
      code: customerCode,
      is_active: 0,
      email_verified_at: null,
      phone_verified_at: null,
    });
    const customerId = result.insertId;

    // 8. Trả kết quả
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Vui lòng nhập mã OTP đã gửi đến email để kích hoạt tài khoản.',
      data: {
        customer: {
          id: customerId,
          full_name,
          email: normalizedEmail,
          phone: normalizedPhone,
          is_active: 0,
        },
        ...(otp && { otp }),
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
      ...(err.delivery && { delivery: err.delivery }),
    });
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
    const supportsEmailVerifiedAt = await hasCustomerColumn('email_verified_at');

    // 1. Xác thực Google ID Token
    if (idToken) {
      try {
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
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
        if (supportsEmailVerifiedAt && email) {
          updateFields.push('email_verified_at = COALESCE(email_verified_at, NOW())');
          customer.email_verified_at = customer.email_verified_at || new Date();
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
        email_verified_at: email ? new Date() : null,
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

// GET /auth/google/redirect - Create Google OAuth redirect URL
router.get('/google/redirect', (req, res) => {
  if (!isConfiguredSecret(process.env.GOOGLE_CLIENT_ID)) {
    return res.status(500).json({
      success: false,
      message: 'Missing or invalid GOOGLE_CLIENT_ID',
    });
  }

  const state = createOAuthState('google');
  setOAuthCookie(res, 'oauth_google_state', state);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });
  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      success: true,
      data: { redirect_url: redirectUrl, state },
    });
  }

  res.redirect(redirectUrl);
});

// GET /auth/google/callback - Handle Google OAuth authorization code
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }
    if (!validateOAuthState(req, res, 'google')) {
      return res.status(400).send('Invalid OAuth state');
    }

    const googleToken = await exchangeGoogleCode(code);
    const verification = await verifyGoogleIdToken(googleToken.id_token);
    if (!verification.ok) {
      return res.status(401).send('Invalid Google authorization code or unverified email');
    }

    const { customer, supportsAvatar } = await findOrCreateGoogleCustomer(verification.profile);
    if (!customer.is_active) {
      return res.status(401).send('Account is disabled');
    }

    const { accessToken, refreshToken } = await generateTokens({
      id: customer.id,
      role: 'customer',
      type: 'customer',
    });

    sendOAuthCallbackPage(res, {
      success: true,
      data: {
        accessToken,
        refreshToken,
        access_token: accessToken,
        refresh_token: refreshToken,
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          email: customer.email || null,
          phone: customer.phone || null,
          role: 'customer',
          avatar_url: supportsAvatar ? customer.avatar_url : null,
          loyalty_tier: customer.loyalty_tier || 'member',
          loyalty_points: customer.loyalty_points || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
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
        const headers = { access_token: tokenFromBody };
        const appSecret = process.env.ZALO_APP_SECRET;
        if (isConfiguredSecret(appSecret)) {
          const proof = crypto.createHmac('sha256', appSecret).update(tokenFromBody).digest('hex');
          headers.appsecret_proof = proof;
        }
        const response = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
          headers: headers
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
  if (!isConfiguredSecret(process.env.ZALO_APP_ID)) {
    return res.status(500).json({
      success: false,
      message: 'Missing or invalid ZALO_APP_ID',
    });
  }

  const state = createOAuthState('zalo');
  const pkce = createPkcePair();
  setOAuthCookie(res, 'oauth_zalo_state', state);
  setOAuthCookie(res, 'oauth_zalo_code_verifier', pkce.verifier);
  const params = new URLSearchParams({
    app_id: process.env.ZALO_APP_ID,
    redirect_uri: getZaloRedirectUri(),
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
  });
  const redirectUrl = `https://oauth.zaloapp.com/v4/permission?${params.toString()}`;

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      success: true,
      data: { redirect_url: redirectUrl, state }
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
    if (!validateOAuthState(req, res, 'zalo')) {
      return res.status(400).send('Invalid OAuth state');
    }
    const supportsAvatar = await hasCustomerColumn('avatar_url');

    const codeVerifier = readCookie(req, 'oauth_zalo_code_verifier') || process.env.ZALO_CODE_VERIFIER;
    clearOAuthCookie(res, 'oauth_zalo_code_verifier');
    const tokenData = await exchangeZaloCode(code, codeVerifier);
    const profile = await getZaloProfile(tokenData.access_token);
    const realZaloId = profile.zaloId;
    const realName = profile.name || 'Zalo User';
    const realPicture = profile.picture;

    let [[realCustomer]] = await pool.query(
      'SELECT * FROM customers WHERE zalo_id = ? AND deleted_at IS NULL LIMIT 1',
      [realZaloId]
    );

    if (!realCustomer) {
      const codeStr = await generateCustomerCode();
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const [result] = await insertCustomer({
        full_name: realName,
        email: socialFallbackEmail('zalo', realZaloId),
        phone: socialFallbackPhone('zalo', realZaloId),
        password_hash: passwordHash,
        zalo_id: realZaloId,
        avatar_url: realPicture || null,
        code: codeStr,
        is_active: 1,
      });

      const [[newCustomer]] = await pool.query(
        'SELECT * FROM customers WHERE id = ?',
        [result.insertId]
      );
      realCustomer = newCustomer;
    }

    if (!realCustomer.is_active) {
      return res.status(401).send('Account is disabled');
    }

    const realTokenPayload = { id: realCustomer.id, role: 'customer', type: 'customer' };
    const realTokens = await generateTokens(realTokenPayload);
    return sendOAuthCallbackPage(res, {
      success: true,
      data: {
        accessToken: realTokens.accessToken,
        refreshToken: realTokens.refreshToken,
        access_token: realTokens.accessToken,
        refresh_token: realTokens.refreshToken,
        customer: {
          id: realCustomer.id,
          full_name: realCustomer.full_name,
          email: realCustomer.email || null,
          phone: realCustomer.phone || null,
          role: 'customer',
          avatar_url: supportsAvatar ? realCustomer.avatar_url : null,
          loyalty_tier: realCustomer.loyalty_tier || 'member',
          loyalty_points: realCustomer.loyalty_points || 0,
        },
      },
    });

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

    if (purpose === 'reset_password') {
      const account = await findPasswordResetAccount(target, targetType, req.body.account_type);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản phù hợp với thông tin đã nhập',
        });
      }
    }

    const data = await createAndDeliverOtp({ target, targetType, purpose });

    res.status(201).json({
      success: true,
      message: 'OTP đã được tạo và gửi',
      data,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
      ...(err.blocked_until && { blocked_until: err.blocked_until }),
      ...(err.delivery && { delivery: err.delivery }),
    });
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

    const verification = await consumeOtpCode({ target, targetType, purpose, otpCode });
    if (!verification.ok) {
      return res.status(verification.status).json({
        success: false,
        message: verification.message,
        ...(verification.blocked_until && { blocked_until: verification.blocked_until }),
        ...(verification.attempts_remaining !== undefined && { attempts_remaining: verification.attempts_remaining }),
      });
    }

    if (purpose === 'register' || purpose === 'verify_email') {
      const column = targetType === 'email' ? 'email' : 'phone';
      const verifiedColumn = targetType === 'email' ? 'email_verified_at' : 'phone_verified_at';
      const supportsVerifiedColumn = await hasCustomerColumn(verifiedColumn);
      await pool.query(
        `UPDATE customers
         SET is_active = 1${supportsVerifiedColumn ? `, ${verifiedColumn} = COALESCE(${verifiedColumn}, NOW())` : ''}
         WHERE ${column} = ? AND deleted_at IS NULL`,
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

// POST /auth/reset-password — Đặt lại mật khẩu bằng OTP, không cần đăng nhập
router.post('/reset-password', async (req, res) => {
  try {
    const targetType = inferTargetType(req.body.target, req.body.target_type);
    const target = normalizeTarget(req.body.target, targetType);
    const otpCode = String(req.body.otp_code || req.body.otp || '').trim();
    const { new_password, confirm_password } = req.body;
    const accountType = req.body.account_type;

    if (!target || !OTP_TARGET_TYPES.has(targetType) || !/^\d{6}$/.test(otpCode)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email/số điện thoại và mã OTP hợp lệ',
      });
    }
    if (!new_password || !confirm_password || new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới và xác nhận mật khẩu không khớp',
      });
    }
    if (new_password.length < 8 || !/\d/.test(new_password) || !/[A-Z]/.test(new_password)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 8 ký tự, có chữ in hoa và chữ số',
      });
    }

    const account = await findPasswordResetAccount(target, targetType, accountType);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản phù hợp với thông tin đã nhập',
      });
    }

    const verification = await consumeOtpCode({
      target,
      targetType,
      purpose: 'reset_password',
      otpCode,
    });
    if (!verification.ok) {
      return res.status(verification.status).json({
        success: false,
        message: verification.message,
        ...(verification.blocked_until && { blocked_until: verification.blocked_until }),
        ...(verification.attempts_remaining !== undefined && { attempts_remaining: verification.attempts_remaining }),
      });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    if (account.account_type === 'staff') {
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, account.id]);
    } else {
      const verifiedColumn = targetType === 'email' ? 'email_verified_at' : 'phone_verified_at';
      const supportsVerifiedColumn = await hasCustomerColumn(verifiedColumn);
      await pool.query(
        `UPDATE customers
         SET password_hash = ?, is_active = 1${supportsVerifiedColumn ? `, ${verifiedColumn} = COALESCE(${verifiedColumn}, NOW())` : ''}
         WHERE id = ?`,
        [newHash, account.id]
      );
    }

    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND user_type = ? AND revoked_at IS NULL',
      [account.id, account.account_type === 'staff' ? 'staff' : 'customer']
    );

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
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

    // 5. Tạo access token mới theo đúng loại phiên ban đầu
    const policy = sessionPolicy(decoded.session_kind || (decoded.type === 'customer' ? 'customer' : 'staff'));
    const accessToken = jwt.sign({
      ...payload,
      session_kind: decoded.session_kind || payload.type,
      jti: crypto.randomBytes(16).toString('hex'),
    }, process.env.JWT_SECRET, {
      expiresIn: policy.accessTtl,
    });

    res.json({ success: true, data: { accessToken, expires_in: policy.accessTtl } });
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
