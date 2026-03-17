const mysql = require('mysql2/promise');

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

pool.getConnection()
  .then(conn => {
    console.log(`[DB] ✅ Đã kết nối ${process.env.DB_NAME}@${process.env.DB_HOST || 'localhost'}`);
    conn.release();
  })
  .catch(err => {
    console.error('[DB] ❌ Kết nối thất bại:', err.message);
    process.exit(1);
  });

module.exports = pool;
