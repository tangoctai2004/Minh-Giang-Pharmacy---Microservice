const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields } = require('../middlewares/validate');
const canWriteCatalog = requireRoles(['admin', 'manager']);

/**
 * Products Routes — mg_catalog.products
 * GET /products và GET /products/:id là PUBLIC (gateway whitelist)
 */

// GET /products — Danh sách sản phẩm với phân trang + filters
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    // Filters
    const keyword = req.query.q ? `%${req.query.q}%` : null;
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const subCategoryId = req.query.sub_category_id ? Number(req.query.sub_category_id) : null;
    const brandIds = req.query.brand_ids ? req.query.brand_ids.split(',').map(Number) : [];
    const priceMin = req.query.price_min ? Number(req.query.price_min) : null;
    const priceMax = req.query.price_max ? Number(req.query.price_max) : null;
    const tag = req.query.tag || null;
    const excludeId = req.query.exclude_id ? Number(req.query.exclude_id) : null;
    const status = req.query.status || 'active';
    const sort = req.query.sort || 'newest';

    let where = "WHERE p.status = ?";
    const params = [status];

    if (keyword) {
      where += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.active_ingredient LIKE ?)';
      params.push(keyword, keyword, keyword);
    }
    if (subCategoryId) {
      where += ' AND p.category_id = ?';
      params.push(subCategoryId);
    } else if (categoryId) {
      where += ' AND (p.category_id = ? OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?))';
      params.push(categoryId, categoryId);
    }
    if (brandIds.length > 0) {
      where += ` AND p.brand_id IN (${brandIds.map(() => '?').join(',')})`;
      params.push(...brandIds);
    }
    if (priceMin !== null) {
      where += ' AND p.retail_price >= ?';
      params.push(priceMin);
    }
    if (priceMax !== null) {
      where += ' AND p.retail_price <= ?';
      params.push(priceMax);
    }
    if (tag) {
      where += ' AND JSON_CONTAINS(p.tags, ?)';
      params.push(JSON.stringify(tag));
    }
    if (excludeId) {
      where += ' AND p.id != ?';
      params.push(excludeId);
    }

    // Sort mapping
    let orderBy = 'p.id DESC';
    if (sort === 'price_asc') orderBy = 'p.retail_price ASC';
    else if (sort === 'price_desc') orderBy = 'p.retail_price DESC';
    else if (sort === 'popular' || sort === 'best_seller') orderBy = 'p.sales_volume DESC';
    else if (sort === 'newest') orderBy = 'p.created_at DESC';
    else if (sort === 'trending') orderBy = 'p.sales_volume DESC, p.created_at DESC';

    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.name, p.retail_price,
              p.base_unit, p.requires_prescription, p.status, p.image_url,
              p.sales_volume, p.tags,
              c.name AS category_name, c.parent_id AS category_parent_id,
              (SELECT COALESCE(SUM(quantity_remaining), 0) 
               FROM batch_items 
               WHERE product_id = p.id AND status IN ('available', 'near_expiry')) AS total_stock,
              EXISTS(SELECT 1 
                     FROM batch_items 
                     WHERE product_id = p.id AND status IN ('available', 'near_expiry') AND quantity_remaining > 0) AS in_stock
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p ${where}`, params
    );

    const data = rows.map(r => ({
      ...r,
      thumbnail: r.image_url,
      original_price: r.retail_price,
      price: r.retail_price,
      discount_percent: 0,
      in_stock: Boolean(r.in_stock)
    }));

    let categoryInfo = null;
    if (categoryId) {
      const [[cat]] = await pool.query(
        `SELECT c1.id, c1.name, c1.slug, c2.id as parent_id, c2.name as parent_name
         FROM categories c1
         LEFT JOIN categories c2 ON c2.id = c1.parent_id
         WHERE c1.id = ?`,
        [categoryId]
      );
      if (cat) {
        categoryInfo = {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          parent: cat.parent_id ? { id: cat.parent_id, name: cat.parent_name } : null
        };
      }
    }

    const totalPages = Math.ceil(total / limit);

    res.json({ 
      success: true, 
      data, 
      pagination: {
        total,
        page,
        limit,
        pages: totalPages,
        total_pages: totalPages
      },
      category: categoryInfo
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/filters — Filter options cho sidebar
router.get('/filters', async (req, res) => {
  try {
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    let where = "WHERE status = 'active'";
    const params = [];
    if (categoryId) {
      where += " AND category_id = ?";
      params.push(categoryId);
    }

    const price_ranges = [
      { label: "Dưới 100,000đ", min: 0, max: 100000 },
      { label: "100,000đ - 300,000đ", min: 100000, max: 300000 },
      { label: "300,000đ - 500,000đ", min: 300000, max: 500000 },
      { label: "500,000đ - 1,000,000đ", min: 500000, max: 1000000 },
      { label: "Trên 1,000,000đ", min: 1000000, max: null }
    ];

    const [brands] = await pool.query(
      `SELECT b.id, b.name, COUNT(p.id) as count
       FROM brands b
       JOIN products p ON p.brand_id = b.id
       ${where}
       GROUP BY b.id, b.name
       ORDER BY b.name ASC`,
      params
    );

    const [origins] = await pool.query(
      `SELECT country_of_origin as name, COUNT(id) as count
       FROM products
       ${where} AND country_of_origin IS NOT NULL
       GROUP BY country_of_origin
       ORDER BY country_of_origin ASC`,
      params
    );

    res.json({
      success: true,
      data: { price_ranges, brands, origins }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/barcode/:barcode — Tra cứu theo mã vạch
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT p.id, p.sku, p.name, p.status, p.retail_price, p.base_unit, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.barcode = ? AND p.status = 'active'`,
      [req.params.barcode]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/search-suggest — Autocomplete search
router.get('/search-suggest', async (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q}%` : '';
    const limit = Math.min(20, Number(req.query.limit) || 8);

    if (!q) {
      return res.json({ success: true, data: { products: [], categories: [] } });
    }

    const [products] = await pool.query(
      `SELECT id, name, sku, image_url, retail_price
       FROM products
       WHERE (name LIKE ? OR sku LIKE ?) AND status = 'active'
       LIMIT ?`,
      [q, q, limit]
    );

    const [categories] = await pool.query(
      `SELECT id, name, slug
       FROM categories
       WHERE name LIKE ? AND is_active = 1
       LIMIT 5`,
      [q]
    );

    res.json({
      success: true,
      data: { products, categories }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/pos-search — Tìm kiếm nhanh cho POS (theo keyword/barcode/category)
router.get('/pos-search', async (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q}%` : null;
    const barcode = req.query.barcode || null;
    const category = req.query.category ? Number(req.query.category) : null;
    const limit = Math.min(100, Number(req.query.limit) || 20);

    let where = `WHERE p.status = 'active'`;
    const params = [];

    if (barcode) {
      where += ' AND p.barcode = ?';
      params.push(barcode);
    } else if (q) {
      where += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
      params.push(q, q, q);
    }

    if (category) {
      where += ' AND (p.category_id = ? OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?))';
      params.push(category, category);
    }

    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.retail_price, p.base_unit, p.image_url,
              c.id AS category_id, c.name AS category_name,
              COALESCE(SUM(CASE WHEN bi.status IN ('available', 'near_expiry') THEN bi.quantity_remaining ELSE 0 END), 0) AS total_stock
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN batch_items bi ON bi.product_id = p.id
       ${where}
       GROUP BY p.id, p.sku, p.barcode, p.name, p.retail_price, p.base_unit, p.image_url, c.id, c.name
       ORDER BY p.name ASC
       LIMIT ?`,
      [...params, limit]
    );

    const data = rows.map((row) => ({
      ...row,
      in_stock: Number(row.total_stock) > 0,
      price: row.retail_price,
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/top-searches — Dữ liệu tĩnh tạm thời
router.get('/top-searches', async (req, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 30);
    const keywords = [
      { keyword: "Khẩu trang", slug: "khau-trang" },
      { keyword: "Nước súc miệng", slug: "nuoc-suc-mieng" },
      { keyword: "Vitamin C", slug: "vitamin-c" },
      { keyword: "Panadol", slug: "panadol" },
      { keyword: "Dầu gió", slug: "dau-gio" }
    ];
    res.json({ success: true, data: keywords.slice(0, limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/:id/alternatives — Gợi ý thuốc thay thế khi hết hàng
router.get('/:id/alternatives', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const [[current]] = await pool.query(
      `SELECT id, name, active_ingredient, category_id, retail_price
       FROM products
       WHERE id = ? AND status = 'active'`,
      [productId]
    );
    if (!current) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.retail_price AS price, p.base_unit, p.requires_prescription, p.active_ingredient,
              COALESCE(SUM(CASE WHEN bi.status IN ('available','near_expiry') THEN bi.quantity_remaining ELSE 0 END), 0) AS stock_qty,
              MIN(CASE WHEN bi.status IN ('available','near_expiry') THEN bi.expiry_date ELSE NULL END) AS nearest_expiry
       FROM products p
       LEFT JOIN batch_items bi ON bi.product_id = p.id
       WHERE p.status = 'active'
         AND p.id != ?
         AND (
           (p.active_ingredient IS NOT NULL AND p.active_ingredient = ?)
           OR p.category_id = ?
         )
         AND p.retail_price BETWEEN ? AND ?
        GROUP BY p.id, p.name, p.retail_price, p.base_unit, p.requires_prescription, p.active_ingredient
       HAVING stock_qty > 0
       ORDER BY
         CASE WHEN p.active_ingredient = ? THEN 0 ELSE 1 END,
         stock_qty DESC,
         p.sales_volume DESC
       LIMIT 10`,
      [
        productId,
        current.active_ingredient,
        current.category_id,
        Number(current.retail_price) * 0.5,
        Number(current.retail_price) * 1.5,
        current.active_ingredient
      ]
    );

    res.json({
      success: true,
      data: {
        active_ingredient: current.active_ingredient,
        alternatives: rows.map((row) => ({
          ...row,
          in_stock: Number(row.stock_qty) > 0,
          near_expiry: !!row.nearest_expiry && (new Date(row.nearest_expiry) - new Date()) / (1000 * 60 * 60 * 24) <= 90
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/:id — Chi tiết sản phẩm
router.get('/:id', async (req, res) => {
  try {
    const productId = req.params.id;

    const [[product]] = await pool.query(
      `SELECT p.*, b.name as brand_name,
              c1.name as category_name, c1.slug as category_slug,
              c2.id as category_parent_id, c2.name as category_parent_name
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c1 ON c1.id = p.category_id
       LEFT JOIN categories c2 ON c2.id = c1.parent_id
       WHERE p.id = ?`,
      [productId]
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    const [units] = await pool.query(
      `SELECT * FROM product_units WHERE product_id = ? ORDER BY sort_order`,
      [productId]
    );

    const [specifications] = await pool.query(
      `SELECT spec_key, spec_value FROM product_specifications WHERE product_id = ? ORDER BY sort_order`,
      [productId]
    );

    const [[{ total_stock }]] = await pool.query(
      `SELECT COALESCE(SUM(quantity_remaining), 0) as total_stock 
       FROM batch_items 
       WHERE product_id = ? AND status IN ('available', 'near_expiry')`,
      [productId]
    );

    const data = {
      ...product,
      brand: product.brand_id ? { id: product.brand_id, name: product.brand_name } : null,
      category: {
        id: product.category_id,
        name: product.category_name,
        slug: product.category_slug,
        parent: product.category_parent_id ? { id: product.category_parent_id, name: product.category_parent_name } : null
      },
      units,
      specifications,
      total_stock: Number(total_stock),
      in_stock: Number(total_stock) > 0,
      image_url: product.image_url,
      gallery: product.gallery || []
    };

    delete data.brand_id;
    delete data.brand_name;
    delete data.category_id;
    delete data.category_name;
    delete data.category_slug;
    delete data.category_parent_id;
    delete data.category_parent_name;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST / — Tạo sản phẩm mới
router.post('/', canWriteCatalog, requireFields(['name', 'category_id', 'base_unit', 'retail_price']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      name, category_id, brand_id, active_ingredient, registration_number,
      manufacturer, requires_prescription, base_unit, retail_price,
      min_stock_alert, image_url, gallery, description, tags, country_of_origin,
      barcode, unit_conversions, specifications
    } = req.body;

    if (!name || !category_id || !base_unit || retail_price === undefined) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    await conn.query('START TRANSACTION');

    const [result] = await conn.query(
      `INSERT INTO products (
        sku, name, category_id, brand_id, active_ingredient, registration_number,
        manufacturer, requires_prescription, base_unit, retail_price,
        min_stock_alert, image_url, gallery, description, tags, country_of_origin,
        barcode, status
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        name, category_id, brand_id || null, active_ingredient || null, registration_number || null,
        manufacturer || null, requires_prescription ? 1 : 0, base_unit, retail_price,
        min_stock_alert || 10, image_url || null, gallery ? JSON.stringify(gallery) : null,
        description || null, tags ? JSON.stringify(tags) : null, country_of_origin || null,
        barcode || null
      ]
    );

    const productId = result.insertId;
    const sku = `MED-${productId.toString().padStart(4, '0')}`;
    await conn.query(`UPDATE products SET sku = ? WHERE id = ?`, [sku, productId]);

    if (unit_conversions && Array.isArray(unit_conversions) && unit_conversions.length > 0) {
      const unitValues = unit_conversions.map((u, index) => [
        productId, u.unit_name, u.conversion_qty, u.of_unit, u.retail_price, index
      ]);
      await conn.query(
        `INSERT INTO product_units (product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order) VALUES ?`,
        [unitValues]
      );
    }

    if (specifications && Array.isArray(specifications) && specifications.length > 0) {
      const specValues = specifications.map((s, index) => [
        productId, s.spec_key, s.spec_value, index
      ]);
      await conn.query(
        `INSERT INTO product_specifications (product_id, spec_key, spec_value, sort_order) VALUES ?`,
        [specValues]
      );
    }

    await conn.query('COMMIT');
    res.status(201).json({ success: true, data: { id: productId, sku } });
  } catch (err) {
    await conn.query('ROLLBACK');
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: 'Mã vạch hoặc SKU đã tồn tại' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  } finally {
    conn.release();
  }
});

// PUT /:id — Cập nhật sản phẩm
router.put('/:id', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const productId = req.params.id;
    const {
      name, category_id, brand_id, active_ingredient, registration_number,
      manufacturer, requires_prescription, base_unit, retail_price,
      min_stock_alert, image_url, gallery, description, tags, country_of_origin,
      barcode, status, unit_conversions, specifications
    } = req.body;

    const [[existing]] = await conn.query(`SELECT id FROM products WHERE id = ?`, [productId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    await conn.query('START TRANSACTION');

    const updateFields = [];
    const updateParams = [];
    const fields = {
      name, category_id, brand_id, active_ingredient, registration_number,
      manufacturer, requires_prescription, base_unit, retail_price,
      min_stock_alert, image_url, gallery, description, tags, country_of_origin,
      barcode, status
    };

    Object.keys(fields).forEach(key => {
      if (fields[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        updateParams.push(key === 'gallery' || key === 'tags' ? JSON.stringify(fields[key]) : fields[key]);
      }
    });

    if (updateFields.length > 0) {
      await conn.query(`UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`, [...updateParams, productId]);
    }

    if (unit_conversions && Array.isArray(unit_conversions)) {
      await conn.query(`DELETE FROM product_units WHERE product_id = ?`, [productId]);
      if (unit_conversions.length > 0) {
        const unitValues = unit_conversions.map((u, index) => [productId, u.unit_name, u.conversion_qty, u.of_unit, u.retail_price, index]);
        await conn.query(`INSERT INTO product_units (product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order) VALUES ?`, [unitValues]);
      }
    }

    if (specifications && Array.isArray(specifications)) {
      await conn.query(`DELETE FROM product_specifications WHERE product_id = ?`, [productId]);
      if (specifications.length > 0) {
        const specValues = specifications.map((s, index) => [productId, s.spec_key, s.spec_value, index]);
        await conn.query(`INSERT INTO product_specifications (product_id, spec_key, spec_value, sort_order) VALUES ?`, [specValues]);
      }
    }

    await conn.query('COMMIT');
    res.json({ success: true, message: 'Cập nhật sản phẩm thành công' });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /:id — Xóa sản phẩm
router.delete('/:id', canWriteCatalog, async (req, res) => {
  try {
    const [result] = await pool.query(`UPDATE products SET status = 'inactive' WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }
    res.json({ success: true, message: 'Xóa sản phẩm thành công (soft delete)' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
