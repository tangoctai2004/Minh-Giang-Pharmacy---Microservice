module.exports = function gatewayAuth(req, res, next) {
  const userId   = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const userType = req.headers['x-user-type'];

  if (!userId && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Request phải đến từ API Gateway.' });
  }

  req.userId   = userId   ? Number(userId)   : null;
  req.userRole = userRole || null;
  req.userType = userType || null;
  next();
};
