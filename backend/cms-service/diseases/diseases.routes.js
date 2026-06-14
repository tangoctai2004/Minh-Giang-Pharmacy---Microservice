/**
 * diseases.routes.js — Tra cứu thông tin bệnh lý
 * 
 * Thỏa mãn api-mapping-client-disease-articles.md
 */
const router = require('express').Router();
const pool = require('../db/pool');

/**
 * GET /diseases/search
 * Tìm kiếm bệnh theo tên hoặc từ khóa
 */
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.title AS name, a.title, a.slug
       FROM articles a
       INNER JOIN cms_categories c ON a.category_id = c.id
       WHERE c.type = 'disease'
         AND a.status = 'published'
         AND a.published_at <= NOW()
         AND (a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)
       ORDER BY a.title ASC`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );

    // Bổ sung thuộc tính letter (chữ cái đầu đã chuẩn hóa) cho mỗi bệnh
    const data = rows.map(r => {
      const letter = r.title.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0].toUpperCase();
      return {
        id: r.id,
        name: r.name,
        title: r.title,
        slug: r.slug,
        letter: /^[A-Z]$/.test(letter) ? letter : '#'
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tìm kiếm bệnh lý: ' + err.message });
  }
});

/**
 * GET /diseases
 * Lấy danh sách bệnh lọc theo chữ cái đầu A-Z
 */
router.get('/', async (req, res) => {
  try {
    const letter = String(req.query.letter || '').trim().toUpperCase();
    if (!letter || letter.length !== 1) {
      return res.status(400).json({ success: false, message: 'Tham số letter không hợp lệ. Vui lòng truyền 1 chữ cái.' });
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.title AS name, a.title, a.slug
       FROM articles a
       INNER JOIN cms_categories c ON a.category_id = c.id
       WHERE c.type = 'disease'
         AND a.status = 'published'
         AND a.published_at <= NOW()
       ORDER BY a.title ASC`
    );

    // Lọc theo chữ cái đầu đã chuẩn hóa tiếng Việt
    const filtered = rows.filter(r => {
      const firstLetter = r.title.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0].toUpperCase();
      return firstLetter === letter;
    }).map(r => ({
      id: r.id,
      name: r.name,
      title: r.title,
      slug: r.slug
    }));

    res.json({ success: true, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách bệnh: ' + err.message });
  }
});

module.exports = router;
