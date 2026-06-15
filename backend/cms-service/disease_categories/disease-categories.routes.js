/**
 * disease-categories.routes.js — Quản lý nhóm bệnh lý (Level 2)
 *
 * Thỏa mãn api-mapping-client-disease-articles.md
 */
const router = require('express').Router();
const pool = require('../db/pool');

/**
 * GET /disease-categories
 * Lấy danh sách nhóm bệnh chính
 * Query: ?level=root&limit=8
 */
router.get('/', async (req, res) => {
  try {
    const { level, limit = 8 } = req.query;
    const limitNum = Math.min(50, Number(limit) || 8);

    let queryStr = `
      SELECT id, name, slug, description, image_url AS icon_url, sort_order
      FROM cms_categories
      WHERE type = 'disease' AND is_active = 1
    `;
    const params = [];

    if (level === 'root') {
      queryStr += ' AND parent_id IS NULL';
    }

    queryStr += ' ORDER BY sort_order ASC, name ASC LIMIT ?';
    params.push(limitNum);

    const [rows] = await pool.query(queryStr, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh mục bệnh: ' + err.message });
  }
});

/**
 * GET /disease-categories/:slug
 * Lấy chi tiết một nhóm bệnh kèm theo danh mục con của nó và đếm bài viết
 */
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    
    // Lấy thông tin category cha
    const [[category]] = await pool.query(
      `SELECT id, name, slug, description, image_url AS icon_url
       FROM cms_categories
       WHERE slug = ? AND type = 'disease' AND is_active = 1`,
      [slug]
    );

    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm bệnh' });
    }

    // Lấy các danh mục con và đếm số bài viết trong mỗi danh mục con
    const [children] = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description, c.image_url AS icon_url,
              (SELECT COUNT(*) 
               FROM articles a 
               WHERE a.category_id = c.id 
                 AND a.status = 'published' 
                 AND a.published_at <= NOW()) AS article_count
       FROM cms_categories c
       WHERE c.parent_id = ? AND c.is_active = 1
       ORDER BY c.sort_order ASC, c.name ASC`,
      [category.id]
    );

    res.json({
      success: true,
      data: {
        ...category,
        children: children.map(child => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          icon_url: child.icon_url || null,
          article_count: Number(child.article_count || 0)
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết nhóm bệnh: ' + err.message });
  }
});

module.exports = router;
