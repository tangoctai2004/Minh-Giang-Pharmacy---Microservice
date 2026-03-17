const router = require('express').Router();
const pool   = require('../db/pool');

// GET /store-config/public — Cấu hình an toàn để hiển thị trên website (public)
router.get('/public', async (req, res) => {
  try {
    const [rows] = await pool.query(
      // is_sensitive=1 là API key / password → KHÔNG bao giờ trả về qua API này
      `SELECT config_key, config_value
       FROM store_config
       WHERE is_active = 1 AND (is_sensitive = 0 OR is_sensitive IS NULL)`
    );
    const config = {};
    rows.forEach(r => { config[r.config_key] = r.config_value; });
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /store-config — Admin: tất cả config (ẩn giá trị sensitive)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, config_key, is_sensitive,
              CASE WHEN is_sensitive = 1 THEN '***HIDDEN***' ELSE config_value END AS config_value,
              is_active, updated_at
       FROM store_config ORDER BY config_key`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:key', (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /store-config/:key — nhớ mã hoá nếu is_sensitive=1' }));
router.post('/',    (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /store-config' }));

module.exports = router;
