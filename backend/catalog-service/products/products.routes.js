const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields } = require('../middlewares/validate');
const canWriteCatalog = requireRoles(['admin', 'manager']);

function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactSearchText(value = '') {
  return normalizeSearchText(value).replace(/\s+/g, '');
}

function buildPosSearchTerms(rawValue = '') {
  const raw = String(rawValue || '').trim();
  const normalized = normalizeSearchText(raw);
  const compact = compactSearchText(raw);
  return [...new Set([raw, normalized, compact].filter(Boolean))];
}

function getPosWarnings(row) {
  const warnings = [];
  const availableStock = Number(row.available_stock || 0);
  const minStockAlert = Number(row.min_stock_alert || 0);
  const nearestExpiry = row.nearest_expiry ? new Date(row.nearest_expiry) : null;

  if (Number(row.requires_prescription) === 1) {
    warnings.push({
      code: 'requires_prescription',
      level: 'danger',
      message: 'Thuốc kê đơn - cần kiểm tra toa trước khi bán'
    });
  }

  if (availableStock <= 0) {
    warnings.push({
      code: 'out_of_stock',
      level: 'danger',
      message: 'Hết hàng có thể bán'
    });
  } else if (minStockAlert > 0 && availableStock <= minStockAlert) {
    warnings.push({
      code: 'low_stock',
      level: 'warning',
      message: `Sắp hết hàng - còn ${availableStock}`
    });
  }

  if (nearestExpiry && !Number.isNaN(nearestExpiry.getTime())) {
    const daysToExpiry = Math.ceil((nearestExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToExpiry < 0) {
      warnings.push({
        code: 'expired',
        level: 'danger',
        message: 'Có lô đã hết hạn, không được bán'
      });
    } else if (daysToExpiry <= 90) {
      warnings.push({
        code: 'near_expiry',
        level: 'warning',
        message: `Gần hết hạn - còn ${daysToExpiry} ngày`
      });
    }
  }

  if (Number(row.retail_price || 0) <= 0) {
    warnings.push({
      code: 'missing_price',
      level: 'danger',
      message: 'Chưa có giá bán'
    });
  }

  return warnings;
}

function buildSaleUnits(row, units = []) {
  const baseUnit = {
    id: null,
    product_id: row.id,
    unit_name: row.base_unit || 'Đơn vị',
    conversion_qty: 1,
    of_unit: row.base_unit || 'Đơn vị',
    retail_price: Number(row.retail_price || row.price || 0),
    sort_order: -1,
    is_base: true,
    barcode: row.barcode || null,
    available_qty: Number(row.available_stock || 0),
  };

  const normalizedUnits = units.map((unit) => {
    const conversionQty = Number(unit.conversion_qty || 1);
    return {
      ...unit,
      conversion_qty: conversionQty,
      retail_price: Number(unit.retail_price || 0),
      is_base: false,
      barcode: unit.barcode || null,
      available_qty: Math.floor(Number(row.available_stock || 0) / conversionQty),
    };
  });

  return [baseUnit, ...normalizedUnits].filter((unit, index, list) =>
    index === list.findIndex((candidate) => candidate.unit_name === unit.unit_name)
  );
}

function toPosProduct(row, units = []) {
  const saleUnits = buildSaleUnits(row, units);
  return {
    ...row,
    retail_price: Number(row.retail_price || 0),
    price: Number(row.retail_price || row.price || 0),
    total_stock: Number(row.total_stock || 0),
    reserved_stock: Number(row.reserved_stock || 0),
    available_stock: Number(row.available_stock || 0),
    requires_prescription: Number(row.requires_prescription || 0),
    in_stock: Number(row.available_stock || 0) > 0,
    units: saleUnits,
    sale_units: saleUnits,
    warnings: getPosWarnings(row),
    pos_flags: {
      can_sell: Number(row.available_stock || 0) > 0 && Number(row.retail_price || 0) > 0,
      requires_prescription: Number(row.requires_prescription || 0) === 1,
      near_expiry: getPosWarnings(row).some((warning) => warning.code === 'near_expiry'),
      low_stock: getPosWarnings(row).some((warning) => warning.code === 'low_stock'),
    }
  };
}

const POS_STOCK_SELECT = `COALESCE(SUM(CASE
  WHEN bi.status IN ('available', 'near_expiry')
  THEN GREATEST(
    bi.quantity_remaining - COALESCE((
      SELECT SUM(sr.quantity)
      FROM stock_reservations sr
      WHERE sr.batch_item_id = bi.id
        AND sr.released_at IS NULL
        AND sr.expires_at > NOW()
    ), 0),
    0
  )
  ELSE 0
END), 0)`;

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
    const origins = req.query.origins ? req.query.origins.split(',') : [];
    const indications = req.query.indications ? req.query.indications.split(',') : [];
    const requiresPrescription = req.query.requires_prescription; // '1' or '0'
    const tag = req.query.tag || null;
    const excludeId = req.query.exclude_id ? Number(req.query.exclude_id) : null;
    const ids = req.query.ids
      ? req.query.ids.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    const status = req.query.status || 'active';
    const sort = req.query.sort || 'newest';

    let where = "WHERE p.status = ?";
    const params = [status];

    if (req.query.ids && ids.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { total: 0, page, limit, pages: 0, total_pages: 0 },
        category: null
      });
    }

    if (keyword) {
      where += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.active_ingredient LIKE ?)';
      params.push(keyword, keyword, keyword);
    }
    if (subCategoryId) {
      where += ' AND p.category_id = ?';
      params.push(subCategoryId);
    } else if (categoryId) {
      where += ` AND (
        p.category_id = ? 
        OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?)
        OR p.category_id IN (SELECT id FROM categories WHERE parent_id IN (SELECT id FROM categories WHERE parent_id = ?))
      )`;
      params.push(categoryId, categoryId, categoryId);
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
    if (origins.length > 0) {
      where += ` AND p.country_of_origin IN (${origins.map(() => '?').join(',')})`;
      params.push(...origins);
    }
    if (indications.length > 0) {
      where += ` AND p.active_ingredient IN (${indications.map(() => '?').join(',')})`;
      params.push(...indications);
    }
    if (requiresPrescription === '1') {
      where += ' AND p.requires_prescription = 1';
    } else if (requiresPrescription === '0') {
      where += ' AND p.requires_prescription = 0';
    }
    if (tag) {
      where += ' AND JSON_CONTAINS(p.tags, ?)';
      params.push(JSON.stringify(tag));
    }
    if (excludeId) {
      where += ' AND p.id != ?';
      params.push(excludeId);
    }
    if (ids.length > 0) {
      where += ` AND p.id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }

    // Sort mapping
    let orderBy = 'p.id DESC';
    if (sort === 'price_asc') orderBy = 'p.retail_price ASC';
    else if (sort === 'price_desc') orderBy = 'p.retail_price DESC';
    else if (sort === 'popular' || sort === 'best_seller') orderBy = 'p.sales_volume DESC';
    else if (sort === 'newest') orderBy = 'p.created_at DESC';
    else if (sort === 'trending') orderBy = 'p.sales_volume DESC, p.created_at DESC';
    if (ids.length > 0 && !req.query.sort) {
      orderBy = `FIELD(p.id, ${ids.map(() => '?').join(',')})`;
    }

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
      [...params, ...(ids.length > 0 && !req.query.sort ? ids : []), limit, offset]
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
    let where = "WHERE p.status = 'active'";
    const params = [];
    if (categoryId) {
      where += ` AND (
        p.category_id = ? 
        OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?)
        OR p.category_id IN (SELECT id FROM categories WHERE parent_id IN (SELECT id FROM categories WHERE parent_id = ?))
      )`;
      params.push(categoryId, categoryId, categoryId);
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
      `SELECT p.country_of_origin as name, COUNT(p.id) as count
       FROM products p
       ${where} AND p.country_of_origin IS NOT NULL
       GROUP BY p.country_of_origin
       ORDER BY p.country_of_origin ASC`,
      params
    );

    const [[{ rx_count }]] = await pool.query(
      `SELECT COUNT(p.id) as rx_count FROM products p ${where} AND p.requires_prescription = 1`, params
    );
    const [[{ non_rx_count }]] = await pool.query(
      `SELECT COUNT(p.id) as non_rx_count FROM products p ${where} AND p.requires_prescription = 0`, params
    );

    res.json({
      success: true,
      data: { price_ranges, brands, origins, rx_count, non_rx_count }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/barcode/:barcode — Tra cứu theo mã vạch
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.status, p.retail_price, p.base_unit,
              p.requires_prescription, p.image_url, p.active_ingredient, p.manufacturer,
              p.registration_number, p.description, p.min_stock_alert,
              c.id AS category_id, c.name AS category_name,
              b.id AS brand_id, b.name AS brand_name,
              COALESCE(SUM(CASE WHEN bi.status IN ('available', 'near_expiry') THEN bi.quantity_remaining ELSE 0 END), 0) AS total_stock,
              COALESCE(SUM(CASE
                WHEN bi.status IN ('available', 'near_expiry')
                THEN COALESCE((
                  SELECT SUM(sr.quantity)
                  FROM stock_reservations sr
                  WHERE sr.batch_item_id = bi.id
                    AND sr.released_at IS NULL
                    AND sr.expires_at > NOW()
                ), 0)
                ELSE 0
              END), 0) AS reserved_stock,
              COALESCE(SUM(CASE
                WHEN bi.status IN ('available', 'near_expiry')
                THEN GREATEST(
                  bi.quantity_remaining - COALESCE((
                    SELECT SUM(sr.quantity)
                    FROM stock_reservations sr
                    WHERE sr.batch_item_id = bi.id
                      AND sr.released_at IS NULL
                      AND sr.expires_at > NOW()
                  ), 0),
                  0
                )
                ELSE 0
              END), 0) AS available_stock,
              MIN(CASE
                WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                THEN bi.expiry_date
                ELSE NULL
              END) AS nearest_expiry,
              SUBSTRING_INDEX(
                GROUP_CONCAT(
                  CASE
                    WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                    THEN CONCAT_WS(' / ', l.zone, l.cabinet, l.shelf)
                    ELSE NULL
                  END
                  ORDER BY bi.expiry_date ASC SEPARATOR '||'
                ),
                '||',
                1
              ) AS location_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN batch_items bi ON bi.product_id = p.id
       LEFT JOIN locations l ON l.id = bi.location_id
       WHERE p.barcode = ? AND p.status = 'active'
       GROUP BY p.id, p.sku, p.barcode, p.name, p.status, p.retail_price,
                p.base_unit, p.requires_prescription, p.image_url, p.active_ingredient,
                p.manufacturer, p.registration_number, p.description, p.min_stock_alert,
                c.id, c.name, b.id, b.name`,
      [req.params.barcode]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const [units] = await pool.query(
      `SELECT id, product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order
       FROM product_units
       WHERE product_id = ?
       ORDER BY sort_order ASC`,
      [row.id]
    );

    res.json({
      success: true,
      data: {
        ...toPosProduct(row, units),
        barcode_match: {
          type: 'product',
          unit_name: row.base_unit,
          conversion_qty: 1,
        }
      }
    });
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
    const searchTerms = req.query.q ? buildPosSearchTerms(req.query.q) : [];
    const barcode = req.query.barcode || null;
    const category = req.query.category_id ? Number(req.query.category_id) : (req.query.category ? Number(req.query.category) : null);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const requiresPrescription = req.query.requires_prescription !== undefined
      ? Number(req.query.requires_prescription)
      : null;
    const inStockOnly = req.query.in_stock === '1' || req.query.in_stock === 'true';

    let where = `WHERE p.status = 'active'`;
    const params = [];

    if (barcode) {
      where += ' AND p.barcode = ?';
      params.push(barcode);
    } else if (searchTerms.length > 0) {
      const searchBlocks = searchTerms.map(() => `(
        p.name LIKE ?
        OR p.sku LIKE ?
        OR p.barcode LIKE ?
        OR p.active_ingredient LIKE ?
        OR REPLACE(REPLACE(REPLACE(LOWER(p.name), ' ', ''), '-', ''), '/', '') LIKE ?
        OR REPLACE(REPLACE(REPLACE(LOWER(COALESCE(p.active_ingredient, '')), ' ', ''), '-', ''), '/', '') LIKE ?
      )`);
      where += ` AND (${searchBlocks.join(' OR ')})`;
      searchTerms.forEach((term) => {
        const likeTerm = `%${term}%`;
        const compactTerm = `%${compactSearchText(term)}%`;
        params.push(likeTerm, likeTerm, likeTerm, likeTerm, compactTerm, compactTerm);
      });
    }

    if (category) {
      where += ` AND p.category_id IN (
        SELECT id FROM categories WHERE id = ?
        UNION
        SELECT id FROM categories WHERE parent_id = ?
        UNION
        SELECT id FROM categories WHERE parent_id IN (SELECT id FROM categories WHERE parent_id = ?)
      )`;
      params.push(category, category, category);
    }

    if (requiresPrescription === 0 || requiresPrescription === 1) {
      where += ' AND p.requires_prescription = ?';
      params.push(requiresPrescription);
    }

    const groupBy = `GROUP BY p.id, p.sku, p.barcode, p.name, p.retail_price, p.base_unit,
              p.requires_prescription, p.image_url, p.active_ingredient, p.manufacturer,
              p.registration_number, p.description, p.min_stock_alert, c.id, c.name, b.id, b.name`;
    const having = inStockOnly ? `HAVING available_stock > 0` : '';

    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.retail_price, p.base_unit,
              p.requires_prescription, p.image_url, p.active_ingredient, p.manufacturer,
              p.registration_number, p.description, p.min_stock_alert,
              c.id AS category_id, c.name AS category_name,
              b.id AS brand_id, b.name AS brand_name,
              COALESCE(SUM(CASE WHEN bi.status IN ('available', 'near_expiry') THEN bi.quantity_remaining ELSE 0 END), 0) AS total_stock,
              COALESCE(SUM(CASE
                WHEN bi.status IN ('available', 'near_expiry')
                THEN COALESCE((
                  SELECT SUM(sr.quantity)
                  FROM stock_reservations sr
                  WHERE sr.batch_item_id = bi.id
                    AND sr.released_at IS NULL
                    AND sr.expires_at > NOW()
                ), 0)
                ELSE 0
              END), 0) AS reserved_stock,
              ${POS_STOCK_SELECT} AS available_stock,
              MIN(CASE
                WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                THEN bi.expiry_date
                ELSE NULL
              END) AS nearest_expiry,
              SUBSTRING_INDEX(
                GROUP_CONCAT(
                  CASE
                    WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                    THEN CONCAT_WS(' / ', l.zone, l.cabinet, l.shelf)
                    ELSE NULL
                  END
                  ORDER BY bi.expiry_date ASC SEPARATOR '||'
                ),
                '||',
                1
              ) AS location_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN batch_items bi ON bi.product_id = p.id
       LEFT JOIN locations l ON l.id = bi.location_id
       ${where}
       ${groupBy}
       ${having}
       ORDER BY available_stock DESC, p.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT p.id, ${POS_STOCK_SELECT} AS available_stock
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN batch_items bi ON bi.product_id = p.id
         ${where}
         GROUP BY p.id
         ${having}
       ) filtered`,
      params
    );

    const productIds = rows.map((row) => row.id);
    let unitsByProductId = {};
    if (productIds.length > 0) {
      const [units] = await pool.query(
        `SELECT product_id, id, unit_name, conversion_qty, of_unit, retail_price, sort_order
         FROM product_units
         WHERE product_id IN (${productIds.map(() => '?').join(',')})
         ORDER BY product_id ASC, sort_order ASC`,
        productIds
      );
      unitsByProductId = units.reduce((acc, unit) => {
        if (!acc[unit.product_id]) acc[unit.product_id] = [];
        acc[unit.product_id].push(unit);
        return acc;
      }, {});
    }

    const data = rows.map((row) => toPosProduct(row, unitsByProductId[row.id] || []));

    res.json({
      success: true,
      data,
      pagination: {
        total: Number(total || 0),
        page: Math.floor(offset / limit) + 1,
        limit,
        pages: Math.ceil(Number(total || 0) / limit),
        total_pages: Math.ceil(Number(total || 0) / limit)
      },
      meta: {
        total: Number(total || 0),
        limit,
        offset,
        has_more: offset + data.length < Number(total || 0),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/pos-detail/:id — Chi tiết thuốc tối ưu cho POS
router.get('/pos-detail/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'product_id không hợp lệ' });
    }

    const [[row]] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.status, p.retail_price, p.base_unit,
              p.requires_prescription, p.image_url, p.active_ingredient,
              p.registration_number, p.manufacturer, p.description, p.min_stock_alert,
              p.country_of_origin,
              c.id AS category_id, c.name AS category_name,
              pc.id AS parent_category_id, pc.name AS parent_category_name,
              b.id AS brand_id, b.name AS brand_name,
              COALESCE(SUM(CASE WHEN bi.status IN ('available', 'near_expiry') THEN bi.quantity_remaining ELSE 0 END), 0) AS total_stock,
              COALESCE(SUM(CASE
                WHEN bi.status IN ('available', 'near_expiry')
                THEN COALESCE((
                  SELECT SUM(sr.quantity)
                  FROM stock_reservations sr
                  WHERE sr.batch_item_id = bi.id
                    AND sr.released_at IS NULL
                    AND sr.expires_at > NOW()
                ), 0)
                ELSE 0
              END), 0) AS reserved_stock,
              ${POS_STOCK_SELECT} AS available_stock,
              MIN(CASE
                WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                THEN bi.expiry_date
                ELSE NULL
              END) AS nearest_expiry,
              SUBSTRING_INDEX(
                GROUP_CONCAT(
                  CASE
                    WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                    THEN CONCAT_WS(' / ', l.zone, l.cabinet, l.shelf)
                    ELSE NULL
                  END
                  ORDER BY bi.expiry_date ASC SEPARATOR '||'
                ),
                '||',
                1
              ) AS location_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories pc ON pc.id = c.parent_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN batch_items bi ON bi.product_id = p.id
       LEFT JOIN locations l ON l.id = bi.location_id
       WHERE p.id = ? AND p.status = 'active'
       GROUP BY p.id, p.sku, p.barcode, p.name, p.status, p.retail_price, p.base_unit,
                p.requires_prescription, p.image_url, p.active_ingredient, p.registration_number,
                p.manufacturer, p.description, p.min_stock_alert, p.country_of_origin,
                c.id, c.name, pc.id, pc.name, b.id, b.name`,
      [productId]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    const [units] = await pool.query(
      `SELECT id, product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order
       FROM product_units
       WHERE product_id = ?
       ORDER BY sort_order ASC`,
      [productId]
    );

    const [specifications] = await pool.query(
      `SELECT spec_key, spec_value, sort_order
       FROM product_specifications
       WHERE product_id = ?
       ORDER BY sort_order ASC`,
      [productId]
    );

    const [batches] = await pool.query(
      `SELECT bi.id, bi.lot_number, bi.expiry_date, bi.quantity_remaining, bi.status,
              CONCAT_WS(' / ', l.zone, l.cabinet, l.shelf) AS location_name
       FROM batch_items bi
       LEFT JOIN locations l ON l.id = bi.location_id
       WHERE bi.product_id = ?
         AND bi.status IN ('available', 'near_expiry')
         AND bi.quantity_remaining > 0
       ORDER BY bi.expiry_date ASC
       LIMIT 5`,
      [productId]
    );

    res.json({
      success: true,
      data: {
        ...toPosProduct(row, units),
        category: {
          id: row.category_id,
          name: row.category_name,
          parent: row.parent_category_id ? {
            id: row.parent_category_id,
            name: row.parent_category_name
          } : null
        },
        brand: row.brand_id ? { id: row.brand_id, name: row.brand_name } : null,
        specifications,
        batches,
      }
    });
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
      `SELECT p.id, p.name, p.active_ingredient, p.category_id, p.retail_price,
              c.parent_id AS parent_category_id
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.status = 'active'`,
      [productId]
    );
    if (!current) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.retail_price AS price, p.retail_price,
              p.base_unit, p.requires_prescription, p.active_ingredient, p.image_url,
              p.manufacturer, p.registration_number,
              c.id AS category_id, c.name AS category_name,
              b.id AS brand_id, b.name AS brand_name,
              COALESCE(SUM(CASE WHEN bi.status IN ('available','near_expiry') THEN bi.quantity_remaining ELSE 0 END), 0) AS total_stock,
              COALESCE(SUM(CASE
                WHEN bi.status IN ('available', 'near_expiry')
                THEN COALESCE((
                  SELECT SUM(sr.quantity)
                  FROM stock_reservations sr
                  WHERE sr.batch_item_id = bi.id
                    AND sr.released_at IS NULL
                    AND sr.expires_at > NOW()
                ), 0)
                ELSE 0
              END), 0) AS reserved_stock,
              ${POS_STOCK_SELECT} AS available_stock,
              MIN(CASE WHEN bi.status IN ('available','near_expiry') THEN bi.expiry_date ELSE NULL END) AS nearest_expiry,
              SUBSTRING_INDEX(
                GROUP_CONCAT(
                  CASE
                    WHEN bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining > 0
                    THEN CONCAT_WS(' / ', l.zone, l.cabinet, l.shelf)
                    ELSE NULL
                  END
                  ORDER BY bi.expiry_date ASC SEPARATOR '||'
                ),
                '||',
                1
              ) AS location_name,
              CASE
                WHEN p.active_ingredient IS NOT NULL
                  AND p.active_ingredient != ''
                  AND p.active_ingredient = ?
                THEN 'same_active_ingredient'
                WHEN p.category_id = ?
                THEN 'same_category'
                ELSE 'same_parent_category'
              END AS match_reason
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN batch_items bi ON bi.product_id = p.id
       LEFT JOIN locations l ON l.id = bi.location_id
       WHERE p.status = 'active'
         AND p.id != ?
         AND (
           (p.active_ingredient IS NOT NULL AND p.active_ingredient != '' AND p.active_ingredient = ?)
           OR p.category_id = ?
           OR (? IS NOT NULL AND c.parent_id = ?)
         )
        GROUP BY p.id, p.sku, p.barcode, p.name, p.retail_price, p.base_unit,
                 p.requires_prescription, p.active_ingredient, p.image_url,
                 p.manufacturer, p.registration_number, c.id, c.name, b.id, b.name
       HAVING available_stock > 0
       ORDER BY
         CASE WHEN p.active_ingredient = ? THEN 0 ELSE 1 END,
         CASE WHEN p.category_id = ? THEN 0 ELSE 1 END,
         ABS(p.retail_price - ?) ASC,
         available_stock DESC,
         p.sales_volume DESC
       LIMIT 10`,
      [
        current.active_ingredient,
        current.category_id,
        productId,
        current.active_ingredient,
        current.category_id,
        current.parent_category_id,
        current.parent_category_id,
        current.active_ingredient,
        current.category_id,
        Number(current.retail_price || 0)
      ]
    );

    res.json({
      success: true,
      data: {
        active_ingredient: current.active_ingredient,
        alternatives: rows.map((row) => ({
          ...toPosProduct(row, []),
          stock_qty: Number(row.available_stock || 0),
          match_reason_label: row.match_reason === 'same_active_ingredient'
            ? 'Cùng hoạt chất'
            : (row.match_reason === 'same_category' ? 'Cùng danh mục' : 'Cùng nhóm thuốc'),
          in_stock: Number(row.available_stock) > 0,
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
