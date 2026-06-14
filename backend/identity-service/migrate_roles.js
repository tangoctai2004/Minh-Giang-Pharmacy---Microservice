const pool = require('./db/pool');

async function migrateRoles() {
  try {
    console.log('Normalizing role codes...');
    await pool.query("UPDATE roles SET name = 'admin', description = 'Quản trị viên hệ thống toàn quyền' WHERE id = 1");
    await pool.query("UPDATE roles SET name = 'pharmacist', description = 'Dược sĩ quản lý thuốc và tồn kho' WHERE id = 2");
    await pool.query("UPDATE roles SET name = 'cashier', description = 'Thu ngân bán hàng tại quầy POS' WHERE id = 3");
    await pool.query("UPDATE roles SET name = 'staff', description = 'Nhân viên kho nhập xuất kho' WHERE id = 4");
    console.log('Done!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

migrateRoles();
