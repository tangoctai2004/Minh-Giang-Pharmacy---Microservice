const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function seed() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'mg_catalog',
    multipleStatements: true
  });

  console.log('--- Đang đọc script SQL... ---');
  const sqlFile = path.join(__dirname, '../../../infrastructure/database/100_seed_final_categories.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('--- Đang thực thi migration... ---');
  try {
    await connection.query(sql);
    console.log('✅ Migration thành công! Dữ liệu danh mục và sản phẩm đã được cập nhật.');
  } catch (error) {
    console.error('❌ Lỗi khi thực thi migration:', error.message);
  } finally {
    await connection.end();
  }
}

seed();
