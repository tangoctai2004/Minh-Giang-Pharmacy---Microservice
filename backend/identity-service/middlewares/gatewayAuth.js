/**
 * Gateway Auth Middleware
 *
 * Xác nhận request đến từ API Gateway (có header x-user-id do gateway gắn).
 * Gateway đã verify JWT trước khi proxy xuống đây, nên service con chỉ cần
 * đọc x-user-* headers để biết ai đang gọi — KHÔNG verify JWT lại ở đây.
 *
 * Trong môi trường development: cho phép request trực tiếp (để dễ test với Postman)
 * Trong môi trường production:  bắt buộc có x-user-id (chặn gọi thẳng bypass gateway)
 */
module.exports = function gatewayAuth(req, res, next) {
  const userId   = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const userType = req.headers['x-user-type'];

  if (!userId && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Request phải đến từ API Gateway.',
    });
  }

  // Gắn thông tin user vào req để routes sử dụng
  req.userId   = userId   ? Number(userId)   : null;
  req.userRole = userRole || null;
  req.userType = userType || null;   // 'staff' | 'customer'

  next();
};
