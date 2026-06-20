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
  const serviceName = req.headers['x-service-name'];
  const internalToken = req.headers['x-internal-token'];
  const gatewayToken = req.headers['x-gateway-token'];
  const isGatewayRequest = Boolean(process.env.GATEWAY_INTERNAL_TOKEN && gatewayToken === process.env.GATEWAY_INTERNAL_TOKEN);
  const isInternalService = Boolean(serviceName && process.env.INTERNAL_SERVICE_TOKEN && internalToken === process.env.INTERNAL_SERVICE_TOKEN);

  if (process.env.NODE_ENV === 'production' && !isGatewayRequest && !isInternalService) {
    return res.status(403).json({
      success: false,
      message: 'Request phải đến từ API Gateway.',
    });
  }

  // Prevents header spoofing: ignore identification headers if not from Gateway/Internal
  if (!isGatewayRequest && !isInternalService) {
    req.userId   = null;
    req.userRole = null;
    req.userType = null;
    req.userPermissions = [];
  } else {
    req.userId   = userId   ? Number(userId)   : null;
    req.userRole = userRole || null;
    req.userType = userType || null;   // 'staff' | 'customer'
    try {
      req.userPermissions = req.headers['x-user-permissions'] ? JSON.parse(req.headers['x-user-permissions']) : [];
    } catch (e) {
      req.userPermissions = [];
    }
  }

  next();
};
