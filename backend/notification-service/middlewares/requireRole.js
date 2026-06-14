const gatewayAuth = require('./gatewayAuth');

function requireRole(allowedRoles = []) {
  return [
    gatewayAuth,
    (req, res, next) => {
      if (process.env.NODE_ENV !== 'production' && !req.userRole) {
        return next();
      }

      if (!allowedRoles.includes(req.userRole)) {
        return res.status(403).json({ success: false, message: 'Khong co quyen truy cap' });
      }

      next();
    },
  ];
}

module.exports = requireRole;
