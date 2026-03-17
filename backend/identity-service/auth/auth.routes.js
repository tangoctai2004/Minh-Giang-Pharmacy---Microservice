const router = require('express').Router();
const pool   = require('../db/pool');

/**
 * Auth Routes (Public — không yêu cầu JWT)
 * Gateway đã whitelist các path này nên request tới đây không có x-user-id
 *
 * POST /auth/login        — Đăng nhập nhân viên/admin → trả access + refresh token
 * POST /auth/login-pos    — Đăng nhập tại quầy POS
 * POST /auth/register     — Đăng ký tài khoản khách hàng mới
 * POST /auth/send-otp     — Gửi OTP đến SĐT/Email
 * POST /auth/verify-otp   — Xác minh OTP
 * POST /auth/refresh      — Làm mới access token bằng refresh token
 * POST /auth/logout       — Đăng xuất (thu hồi refresh token)
 */

// POST /auth/login
router.post('/login', async (req, res) => {
  // TODO: 1. Validate { username, password } từ req.body
  //       2. SELECT * FROM users WHERE (email=? OR phone=?) AND is_active=1
  //       3. So sánh password với bcrypt.compare(password, user.password_hash)
  //       4. Tạo JWT: access token (2h) + refresh token (30d)
  //       5. Lưu refresh token vào bảng refresh_tokens
  //       6. Trả về { accessToken, refreshToken, user: { id, name, role } }
  res.status(501).json({ success: false, message: 'TODO: implement POST /auth/login' });
});

// POST /auth/login-pos
router.post('/login-pos', async (req, res) => {
  // TODO: Tương tự /login nhưng chỉ cho role pharmacist / cashier
  //       Kiểm tra thêm kiosk_id trong body
  res.status(501).json({ success: false, message: 'TODO: implement POST /auth/login-pos' });
});

// POST /auth/register
router.post('/register', async (req, res) => {
  // TODO: 1. Validate { phone, full_name, password? }
  //       2. Kiểm tra phone chưa tồn tại trong bảng customers
  //       3. INSERT INTO customers (phone, full_name, ...)
  //       4. Trả về customer mới tạo (không có password)
  res.status(501).json({ success: false, message: 'TODO: implement POST /auth/register' });
});

// POST /auth/send-otp
router.post('/send-otp', async (req, res) => {
  // TODO: 1. Validate { target: phone|email, target_type, purpose }
  //       2. Kiểm tra blocked_until trong otp_codes (D4-01 security patch)
  //       3. Generate 6-digit OTP, hash rồi INSERT INTO otp_codes
  //       4. Gọi notification-service để gửi SMS/Email
  //       5. Trả về { message: 'OTP đã được gửi', expires_in: 300 }
  res.status(501).json({ success: false, message: 'TODO: implement POST /auth/send-otp' });
});

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  // TODO: 1. Validate { target, target_type, purpose, otp_code }
  //       2. SELECT từ otp_codes WHERE target=? AND purpose=? AND used_at IS NULL AND expires_at > NOW()
  //       3. So sánh otp_code với giá trị lưu (hoặc hash)
  //       4. UPDATE otp_codes SET used_at = NOW()
  //       5. Nếu purpose='register' → kích hoạt tài khoản
  res.status(501).json({ success: false, message: 'TODO: implement POST /auth/verify-otp' });
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  // TODO: 1. Lấy refreshToken từ body hoặc cookie
  //       2. SELECT từ refresh_tokens WHERE token=? AND revoked_at IS NULL AND expires_at > NOW()
  //       3. Verify JWT refresh token
  //       4. Tạo access token mới (2h)
  //       5. Trả về { accessToken }
  res.status(501).json({ success: false, message: 'TODO: implement POST /auth/refresh' });
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  // TODO: 1. Lấy refreshToken từ body
  //       2. UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ?
  //       3. Trả về { message: 'Đăng xuất thành công' }
  res.status(501).json({ success: false, message: 'TODO: implement POST /auth/logout' });
});

module.exports = router;
