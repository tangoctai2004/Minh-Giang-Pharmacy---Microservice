const router = require('express').Router();
const pool   = require('../db/pool');

// GET /articles (public)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, slug, thumbnail_url, excerpt, view_count, published_at
       FROM articles
       WHERE status = 'published' AND published_at <= NOW()
       ORDER BY published_at DESC
       LIMIT 20`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /articles/:id (public) — dùng content_sanitized (D4-08 security)
router.get('/:id', async (req, res) => {
  try {
    const col = isNaN(req.params.id) ? 'slug' : 'id';
    const [rows] = await pool.query(
      `SELECT id, title, slug, thumbnail_url, content_sanitized AS content,
              view_count, published_at
       FROM articles WHERE ${col} = ? AND status = 'published'`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    // Tăng view count
    pool.query('UPDATE articles SET view_count = view_count + 1 WHERE id = ?', [rows[0].id]).catch(() => {});
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/',     (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /articles — nhớ sanitize content trước khi lưu content_sanitized' }));
router.put('/:id',   (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /articles/:id' }));
router.delete('/:id',(req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /articles/:id' }));

module.exports = router;
