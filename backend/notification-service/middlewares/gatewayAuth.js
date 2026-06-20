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
