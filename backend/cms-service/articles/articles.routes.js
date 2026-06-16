/**
 * articles.routes.js — CRUD bài viết sức khoẻ của Nhà thuốc Minh Giang
 *
 * Public:
 *   GET  /articles              — Danh sách bài đã publish, hỗ trợ filter/pagination
 *   GET  /articles/:idOrSlug    — Chi tiết bài viết (tăng view_count)
 *
 * Admin/Manager only:
 *   GET  /articles/admin        — Tất cả bài (gồm draft/archived)
 *   POST /articles              — Tạo bài mới
 *   PUT  /articles/:id          — Cập nhật bài
 *   DELETE /articles/:id        — Soft delete (chuyển sang archived)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');
const { toSlug, sanitizeHtml } = require('../utils/slug');

const canWrite = requireRoles(['admin', 'manager']);

// ──────────────────────────────────────────────
// PUBLIC ROUTES
// ──────────────────────────────────────────────

/**
 * GET /articles
 * Query params:
 *   ?category_id=1    — lọc theo danh mục
 *   ?q=từ khoá       — fulltext search trên title, excerpt
 *   ?page=1&limit=12  — phân trang
 *   ?tags=benh-gut    — lọc theo tag
 */
router.get('/', async (req, res) => {
  try {
    const { category_id, disease_category_id, q, tags, page = 1, limit = 12, sort, type } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit) || 12);
    const pageLimit = Math.min(50, Number(limit) || 12);

    let conditions = [`a.status = 'published'`, `a.published_at <= NOW()`];
    const params = [];

    if (category_id) {
      const parsedCat = Number(category_id);
      if (!isNaN(parsedCat)) {
        conditions.push('a.category_id = ?');
        params.push(parsedCat);
      }
    }

    if (disease_category_id) {
      const parsedDiseaseCat = Number(disease_category_id);
      if (!isNaN(parsedDiseaseCat)) {
        conditions.push(`(
          a.category_id = ? 
          OR a.category_id IN (SELECT id FROM cms_categories WHERE parent_id = ?)
          OR JSON_CONTAINS(a.tags, (SELECT JSON_QUOTE(slug) FROM cms_categories WHERE id = ?))
        )`);
        params.push(parsedDiseaseCat, parsedDiseaseCat, parsedDiseaseCat);
      }
    }

    if (type) {
      conditions.push('c.type = ?');
      params.push(type);
    }

    if (q && q.trim()) {
      conditions.push('MATCH(a.title, a.excerpt) AGAINST(? IN BOOLEAN MODE)');
      params.push(`${q.trim()}*`);
    }

    if (tags) {
      conditions.push('JSON_CONTAINS(a.tags, ?)');
      params.push(JSON.stringify(tags));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count tổng để trả về pagination
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM articles a
       LEFT JOIN cms_categories c ON c.id = a.category_id
       ${where}`,
      params
    );

    let orderBy = 'ORDER BY a.published_at DESC';
    if (sort === 'popular') {
      orderBy = 'ORDER BY a.view_count DESC, a.published_at DESC';
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.slug, a.thumbnail_url, a.excerpt,
              a.view_count, a.published_at, a.category_id, a.tags,
              c.name AS category_name, c.slug AS category_slug
       FROM articles a
       LEFT JOIN cms_categories c ON c.id = a.category_id
       ${where}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    // Map fields for client compatibility
    const mapped = rows.map(r => {
      let parsedTags = [];
      try {
        parsedTags = typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []);
      } catch (e) {
        parsedTags = [];
      }
      return {
        ...r,
        tags: parsedTags,
        thumbnail: r.thumbnail_url,
        views: r.view_count,
        author: "Dược sĩ Minh Giang",
        disease_category: r.category_name,
        created_at: r.published_at
      };
    });

    res.json({
      success: true,
      data: mapped,
      pagination: {
        total: Number(total),
        page: Number(page),
        limit: pageLimit,
        pages: Math.ceil(Number(total) / pageLimit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /articles/admin — Danh sách tất cả bài (admin/manager)
 * Query params: ?status=draft|published|archived, ?category_id=, ?disease_category_id=, ?q=, ?page=, ?limit=
 */
router.get('/admin', canWrite, async (req, res) => {
  try {
    const { status, category_id, disease_category_id, q, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit) || 20);
    const pageLimit = Math.min(50, Number(limit) || 20);

    const conditions = [];
    const params = [];

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (category_id) {
      conditions.push('a.category_id = ?');
      params.push(Number(category_id));
    }
    if (disease_category_id) {
      const parsedDiseaseCat = Number(disease_category_id);
      if (!isNaN(parsedDiseaseCat)) {
        conditions.push(`(
          a.category_id = ? 
          OR a.category_id IN (SELECT id FROM cms_categories WHERE parent_id = ?)
          OR JSON_CONTAINS(a.tags, (SELECT JSON_QUOTE(slug) FROM cms_categories WHERE id = ?))
        )`);
        params.push(parsedDiseaseCat, parsedDiseaseCat, parsedDiseaseCat);
      }
    }
    if (q && q.trim()) {
      conditions.push('(a.title LIKE ? OR a.excerpt LIKE ?)');
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM articles a ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.slug, a.status, a.view_count,
              a.thumbnail_url,
              a.published_at, a.created_at, a.updated_at, a.category_id,
              a.author_id, c.name AS category_name
       FROM articles a
       LEFT JOIN cms_categories c ON c.id = a.category_id
       ${where}
       ORDER BY a.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: Number(total),
        page: Number(page),
        limit: pageLimit,
        pages: Math.ceil(Number(total) / pageLimit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /articles/admin/stats — Thống kê bài viết cho Admin
 */
router.get('/admin/stats', canWrite, async (req, res) => {
  try {
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM articles WHERE status != 'archived'");
    const [[{ published }]] = await pool.query("SELECT COUNT(*) AS published FROM articles WHERE status = 'published'");
    const [[{ draft }]] = await pool.query("SELECT COUNT(*) AS draft FROM articles WHERE status = 'draft'");
    const [[{ views }]] = await pool.query("SELECT COALESCE(SUM(view_count), 0) AS views FROM articles WHERE status != 'archived'");

    res.json({
      success: true,
      data: {
        total_articles: Number(total),
        published_articles: Number(published),
        draft_articles: Number(draft),
        total_views: Number(views)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


/**
 * GET /articles/:idOrSlug — Chi tiết bài viết
 * Hỗ trợ cả id (số) và slug (chuỗi)
 * Trả về content_sanitized (không trả content thô — bảo mật XSS)
 */
router.get('/:idOrSlug', async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    const col = /^\d+$/.test(param) ? 'a.id' : 'a.slug';

    const isAdmin = req.userRole === 'admin' || req.userRole === 'manager';
    const statusCond = isAdmin ? '1=1' : "a.status = 'published'";

    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.slug, a.thumbnail_url, a.status,
              COALESCE(a.content_sanitized, a.content) AS content,
              a.excerpt, a.tags, a.view_count, a.published_at,
              a.category_id, a.author_id, a.related_product_ids, a.related_article_ids,
              c.name AS category_name, c.slug AS category_slug
       FROM articles a
       LEFT JOIN cms_categories c ON c.id = a.category_id
       WHERE ${col} = ? AND ${statusCond}`,
      [param]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const article = rows[0];

    // Tăng view_count bất đồng bộ (chỉ tính lượt xem của người dùng thực tế, không tính admin)
    if (!isAdmin) {
      pool.query('UPDATE articles SET view_count = view_count + 1 WHERE id = ?', [article.id])
        .catch(() => {});
    }

    // 1. Phân tích related_article_ids từ DB
    let relatedArticles = [];
    let customArticleIds = [];
    try {
      customArticleIds = typeof article.related_article_ids === 'string' 
        ? JSON.parse(article.related_article_ids) 
        : (article.related_article_ids || []);
    } catch (e) {
      customArticleIds = [];
    }

    if (customArticleIds && customArticleIds.length > 0) {
      const [rowsArt] = await pool.query(
        `SELECT id, title, slug, thumbnail_url AS thumbnail
         FROM articles
         WHERE id IN (?) AND status = 'published' AND published_at <= NOW()`,
        [customArticleIds]
      );
      // Giữ đúng thứ tự user đã chọn
      relatedArticles = customArticleIds
        .map(id => rowsArt.find(a => Number(a.id) === Number(id)))
        .filter(Boolean);
    } else {
      // Fallback về bài viết cùng danh mục
      const [rowsArt] = await pool.query(
        `SELECT id, title, slug, thumbnail_url AS thumbnail
         FROM articles
         WHERE category_id = ? AND id != ? AND status = 'published' AND published_at <= NOW()
         LIMIT 10`,
        [article.category_id, article.id]
      );
      relatedArticles = rowsArt;
    }

    // 2. Phân tích related_product_ids từ DB
    let relatedProducts = [];
    let customProductIds = [];
    try {
      customProductIds = typeof article.related_product_ids === 'string' 
        ? JSON.parse(article.related_product_ids) 
        : (article.related_product_ids || []);
    } catch (e) {
      customProductIds = [];
    }

    if (customProductIds && customProductIds.length > 0) {
      const [rowsProd] = await pool.query(
        `SELECT id, name, retail_price AS price, image_url AS thumbnail
         FROM mg_catalog.products
         WHERE id IN (?) AND status = 'active'`,
        [customProductIds]
      );
      // Giữ đúng thứ tự user đã chọn
      relatedProducts = customProductIds.map(id => {
        const p = rowsProd.find(prod => Number(prod.id) === Number(id));
        if (p) {
          return {
            id: p.id,
            name: p.name,
            slug: toSlug(p.name),
            price: Number(p.price),
            thumbnail: p.thumbnail
          };
        }
        return null;
      }).filter(Boolean);
    } else {
      // Fallback gợi ý động dựa trên slug bài viết như cũ
      const slugLower = article.slug.toLowerCase();
      if (slugLower.includes('gut') || slugLower.includes('gout')) {
        relatedProducts = [
          { id: 101, name: "Colchicine 1mg Viatris (Hộp 20 viên)", slug: "colchicine-1mg-viatris", price: 85000, thumbnail: "/assets/images/products/colchicine.png" },
          { id: 102, name: "Allopurinol Stella 300mg (Hộp 30 viên)", slug: "allopurinol-stella-300mg", price: 92000, thumbnail: "/assets/images/products/allopurinol.png" }
        ];
      } else if (slugLower.includes('da-day') || slugLower.includes('gerd') || slugLower.includes('tieu-hoa') || slugLower.includes('dai-trang')) {
        relatedProducts = [
          { id: 103, name: "Thuốc dạ dày Phosphalugel (Hộp 20 gói)", slug: "phosphalugel-hop-20-goi", price: 110000, thumbnail: "/assets/images/products/phosphalugel.png" },
          { id: 104, name: "Hỗn dịch uống Gaviscon (Hộp 24 gói)", slug: "gaviscon-hop-24-goi", price: 175000, thumbnail: "/assets/images/products/gaviscon.png" }
        ];
      } else if (slugLower.includes('tim-mach') || slugLower.includes('huyet-ap')) {
        relatedProducts = [
          { id: 105, name: "Thuốc huyết áp Amlodipine 5mg (Hộp 30 viên)", slug: "amlodipine-5mg-stella", price: 45000, thumbnail: "/assets/images/products/amlodipine.png" },
          { id: 106, name: "Viên uống Kirkland CoQ10 300mg (100 viên)", slug: "kirkland-coq10-300mg", price: 420000, thumbnail: "/assets/images/products/coq10.png" }
        ];
      } else if (slugLower.includes('khop') || slugLower.includes('xuong')) {
        relatedProducts = [
          { id: 107, name: "Glucosamine Sulfate 1500mg (Hộp 60 viên)", slug: "glucosamine-sulfate-1500mg", price: 280000, thumbnail: "/assets/images/products/glucosamine.png" },
          { id: 108, name: "Thuốc giảm đau kháng viêm Celecoxib 200mg", slug: "celecoxib-200mg", price: 120000, thumbnail: "/assets/images/products/celecoxib.png" }
        ];
      } else {
        relatedProducts = [
          { id: 109, name: "Viên sủi tăng đề kháng Berocca Performance", slug: "berocca-performance-vi-10-vien", price: 78000, thumbnail: "/assets/images/products/berocca.png" },
          { id: 110, name: "Dầu cá thiên nhiên Kirkland Omega-3 1000mg", slug: "kirkland-omega-3-1000mg", price: 340000, thumbnail: "/assets/images/products/omega3.png" }
        ];
      }
    }

    let parsedTags = [];
    try {
      parsedTags = typeof article.tags === 'string' ? JSON.parse(article.tags) : (article.tags || []);
    } catch (e) {
      parsedTags = [];
    }

    const responseData = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      thumbnail: article.thumbnail_url,
      thumbnail_url: article.thumbnail_url,
      excerpt: article.excerpt,
      tags: parsedTags,
      views: article.view_count,
      view_count: article.view_count,
      created_at: article.published_at,
      updated_at: article.published_at,
      author: { name: "DS. Lâm Giang", avatar_url: null },
      disease_category: {
        id: article.category_id,
        name: article.category_name,
        slug: article.category_slug
      },
      related_products: relatedProducts,
      related_articles: relatedArticles,
      related_product_ids: customProductIds,
      related_article_ids: customArticleIds
    };

    res.json({ success: true, data: responseData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN / MANAGER ROUTES
// ──────────────────────────────────────────────

/**
 * POST /articles — Tạo bài viết mới
 * Body: { title, content, category_id, excerpt?, thumbnail_url?, tags?, status?, slug? }
 */
router.post(
  '/',
  canWrite,
  requireFields(['title', 'content', 'category_id']),
  validateEnum('status', ['draft', 'published', 'archived']),
  async (req, res) => {
    try {
      const {
        title,
        content,
        category_id,
        excerpt = null,
        thumbnail_url = null,
        tags = null,
        status = 'draft',
        slug,
        related_products = [],
        related_articles = [],
      } = req.body;

      // Validate category tồn tại
      const [[cat]] = await pool.query(
        'SELECT id FROM cms_categories WHERE id = ? AND is_active = 1',
        [Number(category_id)]
      );
      if (!cat) {
        return res.status(400).json({ success: false, message: 'category_id không tồn tại' });
      }

      const finalSlug = toSlug(slug || title);
      if (!finalSlug) {
        return res.status(400).json({ success: false, message: 'Không thể tạo slug từ tiêu đề đã cho' });
      }

      const sanitized = sanitizeHtml(content);
      const publishedAt = status === 'published' ? new Date() : null;

      const relatedProductIds = Array.isArray(related_products) ? related_products.map(p => typeof p === 'object' ? p.id : p) : [];
      const relatedArticleIds = Array.isArray(related_articles) ? related_articles.map(a => typeof a === 'object' ? a.id : a) : [];

      const [result] = await pool.query(
        `INSERT INTO articles
           (title, slug, content, content_sanitized, sanitized_at,
            excerpt, thumbnail_url, category_id, author_id,
            tags, status, published_at, related_product_ids, related_article_ids)
         VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          finalSlug,
          content,
          sanitized,
          excerpt,
          thumbnail_url,
          Number(category_id),
          req.userId || null,
          tags ? JSON.stringify(tags) : null,
          status,
          publishedAt,
          JSON.stringify(relatedProductIds),
          JSON.stringify(relatedArticleIds),
        ]
      );

      res.status(201).json({ success: true, data: { id: result.insertId, slug: finalSlug } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Slug đã tồn tại, hãy dùng tiêu đề khác hoặc đặt slug thủ công' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /articles/:id — Cập nhật bài viết
 * Hỗ trợ partial update — chỉ cập nhật các trường được gửi lên
 */
router.put(
  '/:id',
  canWrite,
  validateEnum('status', ['draft', 'published', 'archived']),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'id không hợp lệ' });
      }

      const [[existing]] = await pool.query('SELECT id, status, published_at FROM articles WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
      }

      const { title, content, slug, excerpt, thumbnail_url, category_id, tags, status, related_products, related_articles } = req.body || {};
      const fields = [];
      const params = [];

      if (title !== undefined) { fields.push('title = ?'); params.push(title); }

      if (slug !== undefined) {
        const normalizedSlug = toSlug(slug);
        if (!normalizedSlug) return res.status(400).json({ success: false, message: 'slug không hợp lệ' });
        fields.push('slug = ?'); params.push(normalizedSlug);
      }

      if (content !== undefined) {
        fields.push('content = ?'); params.push(content);
        fields.push('content_sanitized = ?'); params.push(sanitizeHtml(content));
        fields.push('sanitized_at = NOW()');
      }

      if (excerpt !== undefined) { fields.push('excerpt = ?'); params.push(excerpt || null); }
      if (thumbnail_url !== undefined) { fields.push('thumbnail_url = ?'); params.push(thumbnail_url || null); }
      if (tags !== undefined) { fields.push('tags = ?'); params.push(tags ? JSON.stringify(tags) : null); }

      if (related_products !== undefined) {
        const relatedProductIds = Array.isArray(related_products) ? related_products.map(p => typeof p === 'object' ? p.id : p) : [];
        fields.push('related_product_ids = ?');
        params.push(JSON.stringify(relatedProductIds));
      }

      if (related_articles !== undefined) {
        const relatedArticleIds = Array.isArray(related_articles) ? related_articles.map(a => typeof a === 'object' ? a.id : a) : [];
        fields.push('related_article_ids = ?');
        params.push(JSON.stringify(relatedArticleIds));
      }

      if (category_id !== undefined) {
        const [[cat]] = await pool.query(
          'SELECT id FROM cms_categories WHERE id = ? AND is_active = 1',
          [Number(category_id)]
        );
        if (!cat) return res.status(400).json({ success: false, message: 'category_id không tồn tại' });
        fields.push('category_id = ?'); params.push(Number(category_id));
      }

      if (status !== undefined) {
        fields.push('status = ?'); params.push(status);
        // Lần đầu publish → set published_at
        if (status === 'published' && !existing.published_at) {
          fields.push('published_at = NOW()');
        }
      }

      if (!fields.length) {
        return res.status(400).json({ success: false, message: 'Không có trường nào để cập nhật' });
      }

      await pool.query(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
      res.json({ success: true, message: 'Cập nhật bài viết thành công' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Slug đã tồn tại' });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /articles/:id — Soft delete (chuyển sang archived, không xoá vĩnh viễn)
 */
router.delete('/:id', canWrite, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      `UPDATE articles SET status = 'archived' WHERE id = ? AND status != 'archived'`,
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết hoặc đã archived' });
    }
    res.json({ success: true, message: 'Bài viết đã được lưu trữ (archived)' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
