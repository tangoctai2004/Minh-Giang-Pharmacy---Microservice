const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// 1. Nhúng Middlewares cơ bản
app.use(cors()); // Cho phép Frontend gọi API mà không bị lỗi CORS
app.use(morgan('dev')); // Log lịch sử gọi API ra terminal cho dễ debug

const routes = {
  '/api/identity': 'http://localhost:8001',   // Cổng của Identity Service (Tài khoản)
  '/api/catalog': 'http://localhost:8002',    // Cổng của Catalog Service (Thuốc)
  '/api/order': 'http://localhost:8003',      // Cổng của Order Service (Đơn hàng)
  '/api/cms': 'http://localhost:8004',        // Cổng của CMS Service (Nội dung)
  '/api/notification': 'http://localhost:8005' // Cổng Notification Service
};

// Vòng lặp để proxy mọi luồng tự động
for (const path in routes) {
  const targetUrl = routes[path];
  app.use(
    path, 
    // Tích hợp middleware xác thực Token (JWT Authentication) ở đây sau
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      pathRewrite: (pathStr) => pathStr.replace(path, ''), // Xoá chữ '/api/identity' khi đi xuống service con cho sạch
      onProxyReq: (proxyReq, req, res) => {
        // Gắn thêm Header thông tin user sau khi giải mã JWT để các service bên dưới biết là ai gọi
        if (req.user) {
           proxyReq.setHeader('x-user-id', req.user.id);
           proxyReq.setHeader('x-user-role', req.user.role);
        }
      },
      onError: (err, req, res) => {
        res.status(500).json({ message: 'Service con hiện chưa khởi chạy hoặc bị sập', error: err.message });
      }
    })
  );
}

// Route Ping kiểm tra Gateway sống hay chết
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'API Gateway is Up and Running 🚀', timestamp: new Date() });
});

// Chạy Server
app.listen(PORT, () => {
  console.log(`[GATEWAY] đang lắng nghe tại http://localhost:${PORT}`);
  console.log('--- Cấu hình Route hiện tại ---');
  console.table(routes);
});
