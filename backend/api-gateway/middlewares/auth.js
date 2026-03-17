const jwt = require('jsonwebtoken');

/**
 * Danh sách endpoint CÔNG KHAI — không yêu cầu JWT
 * method: HTTP method ('GET' | 'POST' | 'PUT' | '*')
 * path  : chuỗi prefix (dùng startsWith) hoặc RegExp
 */
const PUBLIC_ROUTES = [
  // ── Xác thực tài khoản ──────────────────────────────────────────────────
  { method: 'POST', path: '/api/identity/auth' },       // /auth/login, /auth/register, /auth/send-otp...
  { method: 'GET',  path: '/api/identity/auth/refresh' },

  // ── Nội dung CMS công khai (website) ────────────────────────────────────
  { method: 'GET', path: '/api/cms/articles' },
  { method: 'GET', path: '/api/cms/banners' },
  { method: 'GET', path: '/api/cms/disease-categories' },
  { method: 'GET', path: '/api/cms/store-config/public' },

  // ── Danh mục sản phẩm công khai ─────────────────────────────────────────
  { method: 'GET', path: '/api/catalog/products' },
  { method: 'GET', path: '/api/catalog/categories' },
  { method: 'GET', path: '/api/catalog/promotions/active' },
];

/**
 * Kiểm tra xem request có nằm trong whitelist công khai không
 */
function isPublic(req) {
  return PUBLIC_ROUTES.some(({ method, path }) => {
    const methodOk = method === '*' || req.method === method;
    const url      = req.originalUrl.split('?')[0]; // bỏ query string khi so sánh
    const pathOk   = typeof path === 'string'
      ? url === path || url.startsWith(path + '/')
      : path.test(url);
    return methodOk && pathOk;
  });
}

/**
 * JWT Authentication Middleware
 *
 * - Các route công khai (PUBLIC_ROUTES) → bỏ qua, cho đi thẳng
 * - Các route bảo vệ → yêu cầu header "Authorization: Bearer <token>"
 * - Sau khi verify thành công → gắn req.user = { id, role, type, ... }
 *   Gateway sẽ forward user info xuống service con qua x-user-* headers
 */
module.exports = function authMiddleware(req, res, next) {
  if (isPublic(req)) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Thiếu token xác thực. Vui lòng đăng nhập để tiếp tục.',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, type, iat, exp }
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      : 'Token không hợp lệ.';
    return res.status(401).json({ success: false, message });
  }
};
