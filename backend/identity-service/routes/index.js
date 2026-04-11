const router = require('express').Router();
const gatewayAuth = require('../middlewares/gatewayAuth');

// ── Áp dụng gatewayAuth cho tất cả routes của service này ───────────────────
router.use(gatewayAuth);

// ── Các route auth là PUBLIC — gatewayAuth vẫn chạy nhưng cho phép userId=null ─
router.use('/auth',      require('../auth/auth.routes'));

// ── Các route còn lại yêu cầu đã đăng nhập (userId không null) ──────────────
router.use('/users',     require('../users/users.routes'));
router.use('/customers', require('../customers/customers.routes'));
router.use('/roles',     require('../roles/roles.routes'));
router.use('/shifts',    require('../shifts/shifts.routes'));

// Root — danh sách endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'identity-service',
    endpoints: [
      'POST   /auth/login',
      'POST   /auth/admin/login',
      'POST   /auth/pos/verify-pin',
      'POST   /auth/login-pos',
      'POST   /auth/register',
      'PUT    /auth/change-password',
      'POST   /auth/send-otp',
      'POST   /auth/verify-otp',
      'POST   /auth/refresh',
      'POST   /auth/logout',
      'GET    /users',
      'GET    /users/:id',
      'POST   /users',
      'PUT    /users/:id',
      'DELETE /users/:id',
      'GET    /customers',
      'GET    /customers/me',
      'PUT    /customers/me',
      'GET    /customers/:id',
      'POST   /customers',
      'PUT    /customers/:id',
      'GET    /roles',
      'GET    /shifts',
      'POST   /shifts',
      'POST   /shifts/open',
      'PUT    /shifts/:id/close',
    ],
  });
});

module.exports = router;
