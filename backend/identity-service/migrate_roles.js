const pool = require('./db/pool');

async function migrateRoles() {
    try {
        console.log('Migrating roles to Vietnamese...');
        await pool.query("UPDATE roles SET name = 'Quản trị viên' WHERE name = 'admin'");
        await pool.query("UPDATE roles SET name = 'Dược sĩ' WHERE name = 'pharmacist'");
        await pool.query("UPDATE roles SET name = 'Thu ngân' WHERE name = 'cashier'");
        await pool.query("UPDATE roles SET name = 'Nhân viên kho' WHERE name = 'staff'");
        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrateRoles();
