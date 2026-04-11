const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan  = require('morgan');
require('dotenv').config();

const authMiddleware = require('./middlewares/auth');

const app  = express();
const PORT = process.env.PORT || 8000;

// ── Lấy URL từng service từ .env ─────────────────────────────────────────────
// Dev local  : giá trị mặc định  → localhost:800x
// Docker     : đặt trong docker-compose.yml → http://identity-service:8001
const SERVICES = {
  IDENTITY:     process.env.IDENTITY_SERVICE_URL     || 'http://localhost:8001',
  CATALOG:      process.env.CATALOG_SERVICE_URL      || 'http://localhost:8002',
  ORDER:        process.env.ORDER_SERVICE_URL        || 'http://localhost:8003',
  CMS:          process.env.CMS_SERVICE_URL          || 'http://localhost:8004',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8005',
};

// ── Middlewares ───────────────────────────────────────────────────────────────;
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Xử lý preflight ngay, không chuyển xuống proxy
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(morgan('dev'));

// ── Proxy factory ─────────────────────────────────────────────────────────────
function makeProxy(target, prefix) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { [`^${prefix}`]: '' },
    on: {
      proxyRes(proxyRes) {
        // Gắn CORS headers vào response từ backend service trước khi gửi về client
        proxyRes.headers['access-control-allow-origin'] = '*';
        proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization';
      },
      proxyReq(proxyReq, req) {
        if (req.user) {
          proxyReq.setHeader('x-user-id',   String(req.user.id));
          proxyReq.setHeader('x-user-role', String(req.user.role  || ''));
          proxyReq.setHeader('x-user-type', String(req.user.type  || ''));
        }
      },
      error(err, req, res) {
        res.status(503).json({
          success: false,
          message:  'Service tạm thời không khả dụng. Vui lòng thử lại.',
          service:  prefix,
          ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
        });
      },
    },
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
// authMiddleware kiểm tra JWT nhưng tự động bỏ qua các endpoint công khai
// (xem danh sách whitelist trong middlewares/auth.js)
const ROUTES = [
  { prefix: '/api/identity',     target: SERVICES.IDENTITY },
  { prefix: '/api/catalog',      target: SERVICES.CATALOG },
  { prefix: '/api/order',        target: SERVICES.ORDER },
  { prefix: '/api/cms',          target: SERVICES.CMS },
  { prefix: '/api/notification', target: SERVICES.NOTIFICATION },
];

for (const { prefix, target } of ROUTES) {
  app.use(prefix, authMiddleware, makeProxy(target, prefix));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    service:   'api-gateway',
    status:    'ok',
    uptime:    `${process.uptime().toFixed(1)}s`,
    timestamp: new Date().toISOString(),
    services:  SERVICES,
  });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} không tồn tại trên Gateway`,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n[API Gateway] ✅  http://localhost:${PORT}`);
  console.log('[API Gateway] Danh sách route:');
  console.table(ROUTES.map(r => ({ prefix: r.prefix, service: r.target })));
  console.log();
});
