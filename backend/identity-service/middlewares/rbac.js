function getPermissions(req) {
  return Array.isArray(req.userPermissions) ? req.userPermissions : [];
}

function hasPermission(req, permission) {
  return getPermissions(req).includes(permission);
}

function hasRole(req, roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return allowedRoles.includes(req.userRole);
}

function isStaff(req) {
  return req.userType === 'staff';
}

function deny(res, status, message) {
  res.status(status).json({ success: false, message });
  return false;
}

function requireAuthenticated(req, res) {
  if (!req.userId) return deny(res, 401, 'Chưa đăng nhập');
  return true;
}

function requirePermission(permission, message = 'Không có quyền thực hiện thao tác này') {
  return (req, res) => {
    if (!requireAuthenticated(req, res)) return false;
    if (hasPermission(req, permission) || req.userRole === 'admin') return true;
    return deny(res, 403, message);
  };
}

function requireStaffRole(roles, message = 'Không có quyền thực hiện thao tác này') {
  return (req, res) => {
    if (!requireAuthenticated(req, res)) return false;
    if (isStaff(req) && hasRole(req, roles)) return true;
    return deny(res, 403, message);
  };
}

module.exports = {
  getPermissions,
  hasPermission,
  hasRole,
  isStaff,
  requireAuthenticated,
  requirePermission,
  requireStaffRole,
};
