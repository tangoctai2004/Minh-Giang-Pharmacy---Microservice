module.exports = function requireRoles(allowedRoles = []) {
  return function roleGuard(req, res, next) {
    // Use ALLOW_DEV_RBAC_BYPASS=true only for local debugging.
    const allowDevBypass = process.env.ALLOW_DEV_RBAC_BYPASS === 'true';
    if (allowDevBypass && !req.userRole) {
      return next();
    }

    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này.'
      });
    }
    return next();
  };
};
