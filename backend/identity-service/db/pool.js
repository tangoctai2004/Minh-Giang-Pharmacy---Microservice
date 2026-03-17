const mysql = require('mysql2/promise');

/**
 * Connection pool đến MySQL
 * Tự động retry khi mất kết nối, giới hạn tối đa 10 connection song song
 */
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASS     || 'root',
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
});

// Kiểm tra kết nối khi service khởi động
pool.getConnection()
  .then(conn => {
    console.log(`[DB] ✅ Đã kết nối ${process.env.DB_NAME}@${process.env.DB_HOST || 'localhost'}`);
    conn.release();
  })
  .catch(err => {
    console.error('[DB] ❌ Kết nối thất bại:', err.message);
    console.error('     Kiểm tra DB_HOST, DB_USER, DB_PASS, DB_NAME trong file .env');
    process.exit(1);
  });

module.exports = pool;
