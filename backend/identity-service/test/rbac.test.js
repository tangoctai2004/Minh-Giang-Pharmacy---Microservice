const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasPermission,
  hasRole,
  isStaff,
  requirePermission,
} = require('../middlewares/rbac');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('checks permissions defensively', () => {
  assert.equal(hasPermission({ userPermissions: ['users.manage'] }, 'users.manage'), true);
  assert.equal(hasPermission({ userPermissions: null }, 'users.manage'), false);
});

test('checks staff roles', () => {
  assert.equal(isStaff({ userType: 'staff' }), true);
  assert.equal(hasRole({ userRole: 'admin' }, ['admin', 'manager']), true);
});

test('requirePermission allows admin without explicit permission', () => {
  const req = { userId: 1, userRole: 'admin', userPermissions: [] };
  const res = mockRes();

  assert.equal(requirePermission('users.manage')(req, res), true);
  assert.equal(res.statusCode, 200);
});

test('requirePermission rejects authenticated users without permission', () => {
  const req = { userId: 2, userRole: 'cashier', userPermissions: [] };
  const res = mockRes();

  assert.equal(requirePermission('users.manage')(req, res), false);
  assert.equal(res.statusCode, 403);
});
