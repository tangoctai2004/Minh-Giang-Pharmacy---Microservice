/**
 * requireRoles — Middleware kiểm tra vai trò người dùng (RBAC).
 * Role được inject bởi API Gateway qua header x-user-role.
 * Dùng: requireRoles(['admin', 'manager'])
 */
module.exports = function requireRoles(allowedRoles = []) {
  return function roleGuard(req, res, next) {
    // Chỉ dùng ALLOW_DEV_RBAC_BYPASS=true để debug local — KHÔNG bao giờ bật production
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
