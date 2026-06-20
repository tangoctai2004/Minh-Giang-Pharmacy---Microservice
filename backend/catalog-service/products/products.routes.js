const router = require('express').Router();
const pool = require('../db/pool');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields } = require('../middlewares/validate');
const { writeAudit } = require('../services/audit.service');
const cache = require('../utils/cache');
const canWriteCatalog = requireRoles(['admin', 'manager']);
let productUnitBarcodeColumnCache = null;
let productImagesTableCache = null;
const ALLOWED_PRODUCT_IMAGE_ROLES = ['main', 'gallery', 'packaging', 'label', 'certificate'];
const CONTROLLED_SPECIAL_GROUPS = ['Thuốc gây nghiện', 'Thuốc hướng tâm thần', 'Tiền chất', 'Thuốc độc'];
const MEDICINE_ROOT_CATEGORY_ID = 1000;
const PRODUCT_STATUSES = ['draft', 'pending_review', 'active', 'inactive', 'rejected'];

async function hasProductUnitBarcodeColumn() {
  if (productUnitBarcodeColumnCache !== null) return productUnitBarcodeColumnCache;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'product_units'
        AND COLUMN_NAME = 'barcode'`
  );
  productUnitBarcodeColumnCache = Number(rows[0]?.count || 0) > 0;
  return productUnitBarcodeColumnCache;
}

function productUnitBarcodeSelect(hasBarcodeColumn) {
  return hasBarcodeColumn ? 'barcode' : 'NULL AS barcode';
}

async function hasProductImagesTable() {
  if (productImagesTableCache !== null) return productImagesTableCache;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'product_images'`
  );
  productImagesTableCache = Number(rows[0]?.count || 0) > 0;
  return productImagesTableCache;
}

function productImageUrlSelect(hasImagesTable) {
  return `${productImageUrlExpression(hasImagesTable)} AS image_url`;
}

function productImageUrlExpression(hasImagesTable) {
  if (!hasImagesTable) return 'p.image_url';
  return `COALESCE(
            (SELECT pi.public_url
             FROM product_images pi
             WHERE pi.product_id = p.id
             ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
             LIMIT 1),
            p.image_url
          )`;
}

function toPublicImageUrl(value, req) {
  if (!value) return value;
  const text = String(value);
  if (text.startsWith('http://catalog-service:8002') || text.startsWith('http://minhgiang_catalog:8002')) {
    return text.replace(/^http:\/\/(?:catalog-service|minhgiang_catalog):8002/, getPublicBaseUrl(req));
  }
  return text;
}

function normalizeProductImageFields(product, req) {
  const imageUrl = toPublicImageUrl(product.image_url, req);
  const thumbnail = toPublicImageUrl(product.thumbnail || imageUrl, req);
  return { ...product, image_url: imageUrl, thumbnail };
}

function normalizeProductImageRecord(image, req) {
  if (!image) return image;
  return {
    ...image,
    public_url: toPublicImageUrl(image.public_url, req)
  };
}

function cleanNullableText(value) {
  const cleaned = String(value ?? '').trim();
  return cleaned || null;
}

async function getCategoryLineage(categoryId) {
  const lineage = [];
  let currentId = Number(categoryId);
  const visited = new Set();
  while (Number.isInteger(currentId) && currentId > 0 && !visited.has(currentId)) {
    visited.add(currentId);
    const [[category]] = await pool.query(
      `SELECT id, name, parent_id FROM categories WHERE id = ?`,
      [currentId]
    );
    if (!category) break;
    lineage.push(category);
    currentId = Number(category.parent_id || 0);
  }
  return lineage;
}

function isMedicineCategoryLineage(lineage = []) {
  return lineage.some((category) => Number(category.id) === MEDICINE_ROOT_CATEGORY_ID)
    || lineage.some((category) => String(category.name || '').toLowerCase().includes('thuốc'));
}

function isMedicineCatalogProduct(product = {}) {
  return Number(product.requires_prescription || 0) === 1
    || String(product.category_name || '').toLowerCase().includes('thuốc');
}

function computeProductQuality(product = {}) {
  const issues = [];
  const imageUrl = cleanNullableText(product.image_url || product.thumbnail);
  const isMedicine = isMedicineCatalogProduct(product);

  if (!cleanNullableText(product.name)) issues.push('Thiếu tên sản phẩm');
  if (!Number(product.category_id || 0) && !cleanNullableText(product.category_name)) issues.push('Thiếu danh mục');
  if (!cleanNullableText(product.base_unit)) issues.push('Thiếu đơn vị bán cơ bản');
  if (!cleanNullableText(product.barcode)) issues.push('Thiếu barcode đơn vị cơ bản');
  if (!Number.isFinite(Number(product.retail_price)) || Number(product.retail_price) <= 0) issues.push('Thiếu giá bán lẻ hợp lệ');
  if (!imageUrl) issues.push('Thiếu ảnh chính');

  if (isMedicine) {
    if (!cleanNullableText(product.active_ingredient)) issues.push('Thiếu hoạt chất');
    if (!cleanNullableText(product.registration_number)) issues.push('Thiếu số đăng ký/SĐK');
    if (!cleanNullableText(product.manufacturer)) issues.push('Thiếu nhà sản xuất');
    if (!cleanNullableText(product.strength)) issues.push('Thiếu hàm lượng/nồng độ');
    if (!cleanNullableText(product.route_of_administration)) issues.push('Thiếu đường dùng');
  }

  const totalChecks = isMedicine ? 11 : 6;
  const score = Math.max(0, Math.round(((totalChecks - issues.length) / totalChecks) * 100));
  return {
    quality_score: score,
    quality_issues: issues,
    is_publish_ready: issues.length === 0
  };
}

async function validateProductPublishReadiness(payload = {}, existingProduct = null) {
  if (payload.status !== 'active') return [];
  if (existingProduct?.status === 'active') return [];

  const merged = { ...(existingProduct || {}), ...(payload || {}) };
  const categoryId = Number(merged.category_id);
  const lineage = Number.isInteger(categoryId) && categoryId > 0 ? await getCategoryLineage(categoryId) : [];
  const imageFromTable = !cleanNullableText(merged.image_url) && existingProduct?.id
    ? (await getProductImages(existingProduct.id))[0]?.public_url
    : null;
  const quality = computeProductQuality({
    ...merged,
    image_url: cleanNullableText(merged.image_url) || imageFromTable,
    category_name: merged.category_name || lineage.map((category) => category.name).join(' / ')
  });

  if (quality.is_publish_ready) return [];
  return [`Không thể chuyển thuốc sang Hoạt động vì còn thiếu dữ liệu: ${quality.quality_issues.join(', ')}`];
}

function pickAuditProductFields(product = {}) {
  const fields = [
    'id', 'sku', 'name', 'strength', 'route_of_administration', 'category_id', 'brand_id',
    'active_ingredient', 'registration_number', 'manufacturer', 'requires_prescription',
    'special_control_group', 'storage_condition', 'base_unit', 'retail_price', 'cost_price',
    'min_stock_alert', 'image_url', 'barcode', 'status'
  ];
  return fields.reduce((acc, field) => {
    if (product[field] !== undefined) acc[field] = product[field];
    return acc;
  }, {});
}

function diffAuditFields(beforeData = {}, afterData = {}) {
  const changed = {};
  const keys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
  keys.forEach((key) => {
    const beforeValue = beforeData[key] ?? null;
    const afterValue = afterData[key] ?? null;
    if (String(beforeValue) !== String(afterValue)) {
      changed[key] = { before: beforeValue, after: afterValue };
    }
  });
  return changed;
}

function getPublicBaseUrl(req) {
  if (process.env.CATALOG_PUBLIC_BASE_URL) {
    return process.env.CATALOG_PUBLIC_BASE_URL.replace(/\/+$/, '');
  }
  const host = req.get('host') || '';
  if (host.startsWith('catalog-service:') || host.startsWith('minhgiang_catalog:')) {
    return 'http://localhost:8002';
  }
  return `${req.protocol}://${host}`.replace(/\/+$/, '');
}

function safeUploadName(value = 'product-image') {
  return String(value || 'product-image')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'product-image';
}

async function getProductImages(productId) {
  if (!(await hasProductImagesTable())) return [];
  const [images] = await pool.query(
    `SELECT id, product_id, file_name, original_name, mime_type, file_size,
            storage_path, public_url, image_role, alt_text, is_primary, sort_order,
            created_at, updated_at
     FROM product_images
     WHERE product_id = ?
     ORDER BY is_primary DESC, sort_order ASC, id ASC`,
    [productId]
  );
  return images;
}

async function insertProductUnits(conn, productId, unitConversions = []) {
  if (!Array.isArray(unitConversions) || unitConversions.length === 0) return;
  const hasUnitBarcode = await hasProductUnitBarcodeColumn();
  if (hasUnitBarcode) {
    const unitValues = unitConversions.map((u, index) => [
      productId,
      u.unit_name,
      u.conversion_qty,
      u.of_unit,
      u.retail_price,
      index,
      u.barcode || null
    ]);
    await conn.query(
      `INSERT INTO product_units
        (product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order, barcode)
       VALUES ?`,
      [unitValues]
    );
    return;
  }

  const unitValues = unitConversions.map((u, index) => [
    productId,
    u.unit_name,
    u.conversion_qty,
    u.of_unit,
    u.retail_price,
    index
  ]);
  await conn.query(
    `INSERT INTO product_units
      (product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order)
     VALUES ?`,
    [unitValues]
  );
}

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

function validateProductPayload(payload = {}, { isCreate = false } = {}) {
  const errors = [];
  const specs = Array.isArray(payload.specifications)
    ? payload.specifications.reduce((acc, item) => {
        acc[item.spec_key] = item.spec_value;
        return acc;
      }, {})
    : {};
  const route = payload.route_of_administration ?? specs.route_of_administration;
  const specialControlGroup = payload.special_control_group ?? specs.special_control_group;
  const storageCondition = payload.storage_condition ?? specs.storage_condition;
  const allowedRoutes = ['Uống', 'Tiêm', 'Bôi ngoài da', 'Đặt âm đạo', 'Nhỏ mắt/tai', 'Khác'];
  const allowedSpecialGroups = ['Thuốc kê đơn thông thường', 'Thuốc gây nghiện', 'Thuốc hướng tâm thần', 'Tiền chất', 'Thuốc độc', 'Kháng sinh'];
  const allowedStorageConditions = ['Điều kiện thường', 'Lưu kho lạnh (2-8°C)', 'Tủ khóa kiểm soát đặc biệt'];

  if (isCreate || payload.name !== undefined) {
    if (!String(payload.name || '').trim()) errors.push('Tên thuốc là bắt buộc');
  }
  if (isCreate || payload.category_id !== undefined) {
    const categoryId = Number(payload.category_id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) errors.push('Danh mục thuốc không hợp lệ');
  }
  if (isCreate || payload.base_unit !== undefined) {
    if (!String(payload.base_unit || '').trim()) errors.push('Đơn vị cơ bản là bắt buộc');
  }
  if (isCreate || payload.retail_price !== undefined) {
    const retailPrice = Number(payload.retail_price);
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) errors.push('Giá bán lẻ phải lớn hơn 0');
  }
  if (payload.cost_price !== undefined) {
    const costPrice = Number(payload.cost_price);
    if (!Number.isFinite(costPrice) || costPrice < 0) errors.push('Giá nhập dự kiến không được âm');
  }
  if (payload.min_stock_alert !== undefined) {
    const minStockAlert = Number(payload.min_stock_alert);
    if (!Number.isInteger(minStockAlert) || minStockAlert < 0) errors.push('Mức cảnh báo tồn tối thiểu không hợp lệ');
  }
  if (payload.status !== undefined && !PRODUCT_STATUSES.includes(payload.status)) {
    errors.push('Trạng thái kinh doanh không hợp lệ');
  }
  if (Number(payload.requires_prescription || 0) === 1 && !allowedSpecialGroups.includes(specialControlGroup)) {
    errors.push('Thuốc bán theo đơn phải có nhóm thuốc quản lý đặc biệt hợp lệ');
  }
  if (route && !allowedRoutes.includes(route)) {
    errors.push('Đường dùng không hợp lệ');
  }
  if (specialControlGroup && !allowedSpecialGroups.includes(specialControlGroup)) {
    errors.push('Nhóm thuốc quản lý đặc biệt không hợp lệ');
  }
  if (storageCondition && !allowedStorageConditions.includes(storageCondition)) {
    errors.push('Điều kiện bảo quản không hợp lệ');
  }
  if (payload.unit_conversions !== undefined) {
    if (!Array.isArray(payload.unit_conversions)) {
      errors.push('Danh sách quy đổi đơn vị không hợp lệ');
    } else {
      const seenUnitNames = new Set(payload.base_unit ? [String(payload.base_unit).trim().toLowerCase()] : []);
      const seenBarcodes = new Set(payload.barcode ? [String(payload.barcode).trim()] : []);
      payload.unit_conversions.forEach((unit, index) => {
        const unitName = String(unit.unit_name || '').trim();
        const unitBarcode = String(unit.barcode || '').trim();
        if (!unitName) errors.push(`Dòng quy đổi ${index + 1}: thiếu tên đơn vị`);
        else if (seenUnitNames.has(unitName.toLowerCase())) errors.push(`Dòng quy đổi ${index + 1}: đơn vị bị trùng`);
        else seenUnitNames.add(unitName.toLowerCase());
        if (!String(unit.of_unit || '').trim()) errors.push(`Dòng quy đổi ${index + 1}: thiếu đơn vị gốc`);
        if (!Number.isFinite(Number(unit.conversion_qty)) || Number(unit.conversion_qty) <= 1) {
          errors.push(`Dòng quy đổi ${index + 1}: hệ số quy đổi phải lớn hơn 1`);
        }
        if (!Number.isFinite(Number(unit.retail_price)) || Number(unit.retail_price) <= 0) {
          errors.push(`Dòng quy đổi ${index + 1}: giá bán phải lớn hơn 0`);
        }
        if (!unitBarcode) errors.push(`Dòng quy đổi ${index + 1}: barcode riêng là bắt buộc`);
        else if (!/^[A-Za-z0-9._-]{6,100}$/.test(unitBarcode)) errors.push(`Dòng quy đổi ${index + 1}: barcode không hợp lệ`);
        else if (seenBarcodes.has(unitBarcode)) errors.push(`Dòng quy đổi ${index + 1}: barcode bị trùng`);
        else seenBarcodes.add(unitBarcode);
      });
    }
  }
  return errors;
}

async function validateProductBusinessRules(payload = {}, { isCreate = false, existingProduct = null } = {}) {
  const errors = [];
  const merged = { ...(existingProduct || {}), ...(payload || {}) };
  const categoryId = Number(merged.category_id);
  const lineage = Number.isInteger(categoryId) && categoryId > 0 ? await getCategoryLineage(categoryId) : [];
  const isMedicine = isMedicineCategoryLineage(lineage) || Number(merged.requires_prescription || 0) === 1;
  const specialControlGroup = cleanNullableText(merged.special_control_group);
  const storageCondition = cleanNullableText(merged.storage_condition) || 'Điều kiện thường';
  const isRx = Number(merged.requires_prescription || 0) === 1;

  if (isMedicine) {
    if (!cleanNullableText(merged.active_ingredient)) errors.push('Thuốc phải có hoạt chất để đối chiếu hồ sơ GPP/Bộ Y tế');
    if (!cleanNullableText(merged.registration_number)) errors.push('Thuốc phải có số đăng ký/SĐK');
    if (!cleanNullableText(merged.manufacturer)) errors.push('Thuốc phải có nhà sản xuất');
    if (!cleanNullableText(merged.strength)) errors.push('Thuốc phải có hàm lượng/nồng độ');
    if (!cleanNullableText(merged.route_of_administration)) errors.push('Thuốc phải có đường dùng');
  }

  if (specialControlGroup === 'Kháng sinh' && Number(merged.requires_prescription || 0) !== 1) {
    errors.push('Kháng sinh phải được đánh dấu là thuốc bán theo đơn');
  }

  if (CONTROLLED_SPECIAL_GROUPS.includes(specialControlGroup)) {
    if (Number(merged.requires_prescription || 0) !== 1) {
      errors.push('Nhóm thuốc quản lý đặc biệt phải được đánh dấu là thuốc bán theo đơn');
    }
    if (storageCondition !== 'Tủ khóa kiểm soát đặc biệt') {
      errors.push('Thuốc gây nghiện/hướng tâm thần/tiền chất/thuốc độc phải bảo quản trong tủ khóa kiểm soát đặc biệt');
    }
  }

  if ((isCreate || payload.storage_condition !== undefined) && storageCondition === 'Tủ khóa kiểm soát đặc biệt' && Number(merged.requires_prescription || 0) !== 1) {
    errors.push('Chỉ thuốc kê đơn/quản lý đặc biệt mới được chọn tủ khóa kiểm soát đặc biệt');
  }

  // Ràng buộc thuốc kê đơn Rx không được phép khuyến mãi
  if (isRx) {
    let tagsList = [];
    if (merged.tags) {
      try {
        tagsList = Array.isArray(merged.tags) ? merged.tags : JSON.parse(merged.tags);
      } catch (e) {
        tagsList = [];
      }
    }
    const hasPromoTags = tagsList.some(t => ['flash-sale', 'deal', 'discount'].includes(t));
    if (hasPromoTags || payload.promotions_config) {
      errors.push('Thuốc kê đơn không được phép áp dụng các nhãn khuyến mãi hoặc cấu hình khuyến mãi');
    }
  }

  // Kiểm tra tính hợp lệ của cấu hình khuyến mãi
  if (payload.promotions_config) {
    const configs = Array.isArray(payload.promotions_config) ? payload.promotions_config : [payload.promotions_config];
    configs.forEach(promo => {
      if (!['flash-sale', 'deal', 'discount'].includes(promo.tag_name)) {
        errors.push(`Nhãn khuyến mãi không hợp lệ: ${promo.tag_name}`);
      }
      if (!['percentage', 'fixed_price'].includes(promo.discount_type)) {
        errors.push(`Kiểu giảm giá không hợp lệ: ${promo.discount_type}`);
      }
      if (Number(promo.discount_value) <= 0) {
        errors.push(`Giá trị giảm giá của tag "${promo.tag_name}" phải lớn hơn 0`);
      }
      if (promo.discount_type === 'percentage' && Number(promo.discount_value) > 100) {
        errors.push(`Phần trăm giảm giá của tag "${promo.tag_name}" không được vượt quá 100%`);
      }
      if (!promo.start_time || !promo.end_time) {
        errors.push(`Khuyến mãi cho tag "${promo.tag_name}" yêu cầu thời điểm bắt đầu và kết thúc`);
      }
      if (promo.start_time && promo.end_time && new Date(promo.start_time) >= new Date(promo.end_time)) {
        errors.push(`Thời gian bắt đầu của tag "${promo.tag_name}" phải trước thời gian kết thúc`);
      }
    });
  }

  return errors;
}

function collectPayloadBarcodes(payload = {}) {
  const barcodes = [];
  const baseBarcode = cleanNullableText(payload.barcode);
  if (baseBarcode) barcodes.push({ barcode: baseBarcode, label: 'Barcode đơn vị cơ bản' });
  if (Array.isArray(payload.unit_conversions)) {
    payload.unit_conversions.forEach((unit, index) => {
      const unitBarcode = cleanNullableText(unit.barcode);
      if (unitBarcode) barcodes.push({ barcode: unitBarcode, label: `Barcode dòng quy đổi ${index + 1}` });
    });
  }
  return barcodes;
}

async function validateGlobalBarcodeUniqueness(payload = {}, productId = null) {
  const barcodes = collectPayloadBarcodes(payload);
  if (!barcodes.length) return [];

  const errors = [];
  const values = barcodes.map((item) => item.barcode);
  const placeholders = values.map(() => '?').join(',');
  const excludeProductId = productId ? Number(productId) : null;

  const [productMatches] = await pool.query(
    `SELECT id, sku, name, barcode
       FROM products
      WHERE barcode IN (${placeholders})
        ${excludeProductId ? 'AND id != ?' : ''}`,
    excludeProductId ? [...values, excludeProductId] : values
  );

  const [unitMatches] = await pool.query(
    `SELECT pu.product_id, p.sku, p.name, pu.unit_name, pu.barcode
       FROM product_units pu
       JOIN products p ON p.id = pu.product_id
      WHERE pu.barcode IN (${placeholders})
        ${excludeProductId ? 'AND pu.product_id != ?' : ''}`,
    excludeProductId ? [...values, excludeProductId] : values
  );

  barcodes.forEach((item) => {
    const productMatch = productMatches.find((row) => row.barcode === item.barcode);
    if (productMatch) {
      errors.push(`${item.label} "${item.barcode}" đã được dùng bởi thuốc ${productMatch.sku || productMatch.id}`);
      return;
    }
    const unitMatch = unitMatches.find((row) => row.barcode === item.barcode);
    if (unitMatch) {
      errors.push(`${item.label} "${item.barcode}" đã được dùng bởi đơn vị ${unitMatch.unit_name} của thuốc ${unitMatch.sku || unitMatch.product_id}`);
    }
  });

  return errors;
}

function toPosProduct(row, units = [], req = null) {
  const saleUnits = buildSaleUnits(row, units);
  const imageUrl = req ? toPublicImageUrl(row.image_url, req) : row.image_url;
  return {
    ...row,
    image_url: imageUrl,
    thumbnail: imageUrl,
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

function computeActivePromoInfo(product, promotions) {
  if (Number(product.requires_prescription || 0) === 1) {
    return null;
  }
  if (!promotions || promotions.length === 0) {
    return null;
  }
  
  const now = new Date();
  const activePromos = promotions.filter(p => {
    const start = new Date(p.start_time);
    const end = new Date(p.end_time);
    const hasRemaining = p.campaign_qty === null || Number(p.sold_qty) < Number(p.campaign_qty);
    return p.status === 'active' && start <= now && end >= now && hasRemaining;
  });

  if (activePromos.length === 0) {
    return null;
  }

  // Ưu tiên: flash-sale -> deal -> discount
  const activePromo = activePromos.find(p => p.tag_name === 'flash-sale') ||
                      activePromos.find(p => p.tag_name === 'deal') ||
                      activePromos[0];

  const originalPrice = Number(product.retail_price || 0);
  let promoPrice = originalPrice;
  let discountPercent = 0;

  if (activePromo.discount_type === 'percentage') {
    discountPercent = Math.round(Number(activePromo.discount_value));
    promoPrice = Math.round(originalPrice * (1 - discountPercent / 100));
  } else {
    promoPrice = Math.round(Number(activePromo.discount_value));
    discountPercent = originalPrice > 0 ? Math.round((originalPrice - promoPrice) / originalPrice * 100) : 0;
  }

  return {
    tag_name: activePromo.tag_name,
    discount_type: activePromo.discount_type,
    discount_value: Number(activePromo.discount_value),
    promo_price: promoPrice,
    original_price: originalPrice,
    campaign_qty: activePromo.campaign_qty,
    sold_qty: activePromo.sold_qty,
    max_per_customer: activePromo.max_per_customer,
    end_time: activePromo.end_time,
    discount_percent: discountPercent
  };
}

async function saveProductPromotions(conn, productId, promotionsConfig, tags) {
  // 1. Xóa cấu hình khuyến mãi cũ của sản phẩm này
  await conn.query(`DELETE FROM product_tag_promotions WHERE product_id = ?`, [productId]);

  if (!promotionsConfig || !Array.isArray(promotionsConfig) || promotionsConfig.length === 0) {
    return;
  }

  // 2. Parse danh sách tag đang chọn của sản phẩm
  let tagsList = [];
  if (tags) {
    tagsList = Array.isArray(tags) ? tags : JSON.parse(tags);
  }

  // Chỉ giữ lại cấu hình khuyến mãi của các tag thực sự đang được gán
  const validPromos = promotionsConfig.filter(p => 
    tagsList.includes(p.tag_name) && ['flash-sale', 'deal', 'discount'].includes(p.tag_name)
  );

  if (validPromos.length === 0) {
    return;
  }

  // 3. Thêm cấu hình mới
  const insertValues = validPromos.map(promo => [
    productId,
    promo.tag_name,
    promo.discount_type,
    promo.discount_value,
    promo.campaign_qty !== undefined && promo.campaign_qty !== '' && promo.campaign_qty !== null ? Number(promo.campaign_qty) : null,
    promo.sold_qty ? Number(promo.sold_qty) : 0,
    promo.max_per_customer !== undefined && promo.max_per_customer !== '' && promo.max_per_customer !== null ? Number(promo.max_per_customer) : null,
    new Date(promo.start_time),
    new Date(promo.end_time),
    promo.status || 'active'
  ]);

  await conn.query(
    `INSERT INTO product_tag_promotions 
      (product_id, tag_name, discount_type, discount_value, campaign_qty, sold_qty, max_per_customer, start_time, end_time, status)
     VALUES ?`,
    [insertValues]
  );
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
    const cacheKey = `products:list:${req.originalUrl || req.url}`;
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, ...cachedData });
    }

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
    const quality = req.query.quality || '';
    const sort = req.query.sort || 'newest';
    const lowStockOnly = req.query.low_stock === '1' || req.query.low_stock === 'true';

    if (status !== 'all' && !PRODUCT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái sản phẩm không hợp lệ' });
    }

    let where = status === 'all'
      ? `WHERE p.status IN (${PRODUCT_STATUSES.map(() => '?').join(',')})`
      : "WHERE p.status = ?";
    const params = status === 'all' ? [] : [status];
    if (status === 'all') params.push(...PRODUCT_STATUSES);

    if (req.query.ids && ids.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { total: 0, page, limit, pages: 0, total_pages: 0 },
        category: null
      });
    }

    if (keyword) {
      where += ` AND (
        p.name LIKE ?
        OR p.sku LIKE ?
        OR p.barcode LIKE ?
        OR p.active_ingredient LIKE ?
        OR p.manufacturer LIKE ?
        OR p.registration_number LIKE ?
        OR EXISTS (
          SELECT 1 FROM product_units pu_search
          WHERE pu_search.product_id = p.id AND pu_search.barcode LIKE ?
        )
      )`;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
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
      if (tag === 'flash-sale') {
        where += ` AND JSON_CONTAINS(p.tags, ?) 
          AND EXISTS (
            SELECT 1 FROM product_tag_promotions ptp 
            WHERE ptp.product_id = p.id 
              AND ptp.tag_name = 'flash-sale' 
              AND ptp.status = 'active' 
              AND ptp.start_time <= NOW() 
              AND ptp.end_time >= NOW() 
              AND (ptp.campaign_qty IS NULL OR ptp.sold_qty < ptp.campaign_qty)
          )`;
        params.push(JSON.stringify(tag));
      } else if (tag === 'deal') {
        where += ` AND JSON_CONTAINS(p.tags, ?) 
          AND EXISTS (
            SELECT 1 FROM product_tag_promotions ptp 
            WHERE ptp.product_id = p.id 
              AND ptp.tag_name = 'deal' 
              AND ptp.status = 'active' 
              AND ptp.start_time <= NOW() 
              AND ptp.end_time >= NOW() 
              AND (ptp.campaign_qty IS NULL OR ptp.sold_qty < ptp.campaign_qty)
          )
          AND NOT EXISTS (
            SELECT 1 FROM product_tag_promotions ptp_high 
            WHERE ptp_high.product_id = p.id 
              AND ptp_high.tag_name = 'flash-sale' 
              AND ptp_high.status = 'active' 
              AND ptp_high.start_time <= NOW() 
              AND ptp_high.end_time >= NOW() 
              AND (ptp_high.campaign_qty IS NULL OR ptp_high.sold_qty < ptp_high.campaign_qty)
          )`;
        params.push(JSON.stringify(tag));
      } else if (tag === 'discount') {
        where += ` AND JSON_CONTAINS(p.tags, ?) 
          AND EXISTS (
            SELECT 1 FROM product_tag_promotions ptp 
            WHERE ptp.product_id = p.id 
              AND ptp.tag_name = 'discount' 
              AND ptp.status = 'active' 
              AND ptp.start_time <= NOW() 
              AND ptp.end_time >= NOW() 
              AND (ptp.campaign_qty IS NULL OR ptp.sold_qty < ptp.campaign_qty)
          )
          AND NOT EXISTS (
            SELECT 1 FROM product_tag_promotions ptp_high 
            WHERE ptp_high.product_id = p.id 
              AND ptp_high.tag_name IN ('flash-sale', 'deal') 
              AND ptp_high.status = 'active' 
              AND ptp_high.start_time <= NOW() 
              AND ptp_high.end_time >= NOW() 
              AND (ptp_high.campaign_qty IS NULL OR ptp_high.sold_qty < ptp_high.campaign_qty)
          )`;
        params.push(JSON.stringify(tag));
      } else {
        where += ' AND JSON_CONTAINS(p.tags, ?)';
        params.push(JSON.stringify(tag));
      }
    }
    if (excludeId) {
      where += ' AND p.id != ?';
      params.push(excludeId);
    }
    if (ids.length > 0) {
      where += ` AND p.id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }
    const qualityMissingSql = `(
      p.name IS NULL OR TRIM(p.name) = ''
      OR p.category_id IS NULL
      OR p.base_unit IS NULL OR TRIM(p.base_unit) = ''
      OR p.barcode IS NULL OR TRIM(p.barcode) = ''
      OR p.retail_price IS NULL OR p.retail_price <= 0
      OR p.image_url IS NULL OR TRIM(p.image_url) = ''
      OR (
        p.requires_prescription = 1 AND (
          p.active_ingredient IS NULL OR TRIM(p.active_ingredient) = ''
          OR p.registration_number IS NULL OR TRIM(p.registration_number) = ''
          OR p.manufacturer IS NULL OR TRIM(p.manufacturer) = ''
          OR p.strength IS NULL OR TRIM(p.strength) = ''
          OR p.route_of_administration IS NULL OR TRIM(p.route_of_administration) = ''
        )
      )
    )`;
    if (quality === 'missing') {
      where += ` AND ${qualityMissingSql}`;
    } else if (quality === 'ready') {
      where += ` AND NOT ${qualityMissingSql}`;
    } else if (quality && quality !== 'all') {
      return res.status(400).json({ success: false, message: 'Bộ lọc chất lượng dữ liệu không hợp lệ' });
    }

    if (lowStockOnly) {
      where += ` AND (
        SELECT COALESCE(SUM(quantity_remaining), 0)
        FROM batch_items
        WHERE product_id = p.id AND status IN ('available', 'near_expiry')
      ) > 0 AND (
        SELECT COALESCE(SUM(quantity_remaining), 0)
        FROM batch_items
        WHERE product_id = p.id AND status IN ('available', 'near_expiry')
      ) <= p.min_stock_alert`;
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
    const hasImagesTable = await hasProductImagesTable();
    const imageUrlSelect = productImageUrlSelect(hasImagesTable);

    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.name, p.strength, p.route_of_administration, p.category_id,
              p.active_ingredient, p.registration_number, p.manufacturer, p.barcode, p.retail_price,
              p.base_unit, p.requires_prescription, p.special_control_group, p.storage_condition, p.status,
              p.min_stock_alert,
              ${imageUrlSelect},
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

    const productIds = rows.map((row) => row.id);
    let promotionsByProductId = {};
    if (productIds.length > 0) {
      const [promotions] = await pool.query(
        `SELECT * FROM product_tag_promotions
         WHERE product_id IN (${productIds.map(() => '?').join(',')})`,
        productIds
      );
      promotionsByProductId = promotions.reduce((acc, p) => {
        if (!acc[p.product_id]) acc[p.product_id] = [];
        acc[p.product_id].push(p);
        return acc;
      }, {});
    }

    const data = rows.map((r) => {
      const promotions = promotionsByProductId[r.id] || [];
      const promo_info = computeActivePromoInfo(r, promotions);
      const sellingPrice = promo_info ? promo_info.promo_price : r.retail_price;
      const discPercent = promo_info ? promo_info.discount_percent : 0;

      const normalized = normalizeProductImageFields({
        ...r,
        thumbnail: r.image_url,
        original_price: r.retail_price,
        price: sellingPrice,
        retail_price: sellingPrice,
        discount_percent: discPercent,
        promo_info,
        in_stock: Boolean(r.in_stock)
      }, req);
      return { ...normalized, ...computeProductQuality(normalized) };
    });


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

    const responsePayload = {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: totalPages,
        total_pages: totalPages
      },
      category: categoryInfo
    };

    await cache.set(cacheKey, responsePayload, 120); // TTL: 120s

    res.json({ 
      success: true, 
      ...responsePayload
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
    const hasUnitBarcode = await hasProductUnitBarcodeColumn();
    let barcodeMatch = {
      type: 'product',
      unit_name: null,
      conversion_qty: 1,
    };
    let productId = null;

    if (hasUnitBarcode) {
      const [[unitMatch]] = await pool.query(
        `SELECT product_id, unit_name, conversion_qty
           FROM product_units
          WHERE barcode = ?
          LIMIT 1`,
        [req.params.barcode]
      );
      if (unitMatch) {
        productId = Number(unitMatch.product_id);
        barcodeMatch = {
          type: 'unit',
          unit_name: unitMatch.unit_name,
          conversion_qty: Number(unitMatch.conversion_qty || 1),
        };
      }
    }

    const whereClause = productId
      ? 'p.id = ? AND p.status = \'active\''
      : 'p.barcode = ? AND p.status = \'active\'';
    const queryParam = productId || req.params.barcode;

    const [[row]] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.status, p.retail_price, p.base_unit,
              p.requires_prescription, p.image_url, p.active_ingredient, p.manufacturer,
              p.registration_number, p.description, p.min_stock_alert, p.tags,
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
       WHERE ${whereClause}
       GROUP BY p.id, p.sku, p.barcode, p.name, p.status, p.retail_price,
                p.base_unit, p.requires_prescription, p.image_url, p.active_ingredient,
                p.manufacturer, p.registration_number, p.description, p.min_stock_alert, p.tags,
                c.id, c.name, b.id, b.name`,
      [queryParam]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const [units] = await pool.query(
      `SELECT id, product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order, ${productUnitBarcodeSelect(hasUnitBarcode)}
       FROM product_units
       WHERE product_id = ?
       ORDER BY sort_order ASC`,
      [row.id]
    );

    res.json({
      success: true,
      data: {
        ...toPosProduct(row, units, req),
        barcode_match: {
          ...barcodeMatch,
          unit_name: barcodeMatch.unit_name || row.base_unit,
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
    const rawQ = String(req.query.q || '').trim();
    const q = rawQ ? `%${rawQ}%` : '';
    const limit = Math.min(20, Number(req.query.limit) || 8);

    if (!q) {
      return res.json({ success: true, data: { products: [], categories: [] } });
    }

    const hasImagesTable = await hasProductImagesTable();
    const imageUrlSelect = productImageUrlSelect(hasImagesTable);
    const [products] = await pool.query(
      `SELECT p.id, p.name, p.sku, ${imageUrlSelect}, p.retail_price
       FROM products p
       WHERE p.status = 'active'
         AND (
           p.name LIKE ?
           OR p.sku LIKE ?
           OR p.barcode LIKE ?
           OR p.active_ingredient LIKE ?
           OR p.manufacturer LIKE ?
           OR p.registration_number LIKE ?
           OR EXISTS (
             SELECT 1 FROM product_units pu_search
             WHERE pu_search.product_id = p.id AND pu_search.barcode LIKE ?
           )
         )
       ORDER BY
         CASE
           WHEN p.name = ? THEN 0
           WHEN p.sku = ? THEN 1
           WHEN p.barcode = ? THEN 2
           WHEN p.name LIKE ? THEN 3
           ELSE 4
         END,
         p.created_at DESC,
         p.id DESC
       LIMIT ?`,
      [q, q, q, q, q, q, q, rawQ, rawQ, rawQ, `${rawQ}%`, limit]
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
      data: {
        products: products.map((product) => normalizeProductImageFields(product, req)),
        categories
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/pos-search — Tìm kiếm nhanh cho POS (theo keyword/barcode/category)
router.get('/pos-search', async (req, res) => {
  try {
    const hasUnitBarcode = await hasProductUnitBarcodeColumn();
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
      if (hasUnitBarcode) {
        where += ` AND (
          p.barcode = ?
          OR EXISTS (
            SELECT 1 FROM product_units pu_barcode
            WHERE pu_barcode.product_id = p.id AND pu_barcode.barcode = ?
          )
        )`;
        params.push(barcode, barcode);
      } else {
        where += ' AND p.barcode = ?';
        params.push(barcode);
      }
    } else if (searchTerms.length > 0) {
      const searchBlocks = searchTerms.map(() => `(
        p.name LIKE ?
        OR p.sku LIKE ?
        OR p.barcode LIKE ?
        OR p.active_ingredient LIKE ?
        OR REPLACE(REPLACE(REPLACE(LOWER(p.name), ' ', ''), '-', ''), '/', '') LIKE ?
        OR REPLACE(REPLACE(REPLACE(LOWER(COALESCE(p.active_ingredient, '')), ' ', ''), '-', ''), '/', '') LIKE ?
        ${hasUnitBarcode ? `OR EXISTS (
          SELECT 1 FROM product_units pu_search
          WHERE pu_search.product_id = p.id AND pu_search.barcode LIKE ?
        )` : ''}
      )`);
      where += ` AND (${searchBlocks.join(' OR ')})`;
      searchTerms.forEach((term) => {
        const likeTerm = `%${term}%`;
        const compactTerm = `%${compactSearchText(term)}%`;
        params.push(likeTerm, likeTerm, likeTerm, likeTerm, compactTerm, compactTerm);
        if (hasUnitBarcode) params.push(likeTerm);
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
              p.registration_number, p.description, p.min_stock_alert, p.tags, c.id, c.name, b.id, b.name`;
    const having = inStockOnly ? `HAVING available_stock > 0` : '';

    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.retail_price, p.base_unit,
              p.requires_prescription, p.image_url, p.active_ingredient, p.manufacturer,
              p.registration_number, p.description, p.min_stock_alert, p.tags,
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
        `SELECT product_id, id, unit_name, conversion_qty, of_unit, retail_price, sort_order, ${productUnitBarcodeSelect(hasUnitBarcode)}
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

    const data = rows.map((row) => toPosProduct(row, unitsByProductId[row.id] || [], req));

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
    const hasUnitBarcode = await hasProductUnitBarcodeColumn();
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'product_id không hợp lệ' });
    }

    const [[row]] = await pool.query(
      `SELECT p.id, p.sku, p.barcode, p.name, p.status, p.retail_price, p.base_unit,
              p.requires_prescription, p.image_url, p.active_ingredient,
              p.registration_number, p.manufacturer, p.description, p.min_stock_alert,
              p.country_of_origin, p.tags,
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
                p.manufacturer, p.description, p.min_stock_alert, p.country_of_origin, p.tags,
                c.id, c.name, pc.id, pc.name, b.id, b.name`,
      [productId]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    const [units] = await pool.query(
      `SELECT id, product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order, ${productUnitBarcodeSelect(hasUnitBarcode)}
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
        ...toPosProduct(row, units, req),
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

// Helper to generate slug
const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^a-z0-9\s-]|_)+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// GET /products/top-searches — Dữ liệu động từ trending_searches của mg_cms
router.get('/top-searches', async (req, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 30);
    const fallbackKeywords = [
      { keyword: "Khẩu trang", slug: "khau-trang" },
      { keyword: "Nước súc miệng", slug: "nuoc-suc-mieng" },
      { keyword: "Vitamin C", slug: "vitamin-c" },
      { keyword: "Panadol", slug: "panadol" },
      { keyword: "Dầu gió", slug: "dau-gio" }
    ];

    // Truy vấn dữ liệu tìm kiếm hàng đầu từ mg_cms
    const [rows] = await pool.query(
      `SELECT keyword
       FROM mg_cms.trending_searches
       WHERE context = 'global'
         AND is_hidden = 0
         AND period_end >= CURDATE() - INTERVAL 30 DAY
       ORDER BY
         is_pinned DESC,
         pin_order ASC,
         search_count DESC
       LIMIT ?`,
      [limit]
    );

    let keywords = rows.map(row => ({
      keyword: row.keyword,
      slug: slugify(row.keyword)
    }));

    // Trộn thêm dữ liệu tĩnh nếu DB thiếu dữ liệu
    const seenKeywords = new Set(keywords.map(k => k.keyword.toLowerCase()));
    for (const fb of fallbackKeywords) {
      if (keywords.length >= limit) break;
      if (!seenKeywords.has(fb.keyword.toLowerCase())) {
        keywords.push(fb);
        seenKeywords.add(fb.keyword.toLowerCase());
      }
    }

    res.json({ success: true, data: keywords });
  } catch (err) {
    // Fallback hoàn toàn nếu có lỗi DB (ví dụ cross-db permissions)
    const limit = Math.min(50, Number(req.query.limit) || 30);
    const fallbackKeywords = [
      { keyword: "Khẩu trang", slug: "khau-trang" },
      { keyword: "Nước súc miệng", slug: "nuoc-suc-mieng" },
      { keyword: "Vitamin C", slug: "vitamin-c" },
      { keyword: "Panadol", slug: "panadol" },
      { keyword: "Dầu gió", slug: "dau-gio" }
    ];
    res.json({ success: true, data: fallbackKeywords.slice(0, limit) });
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
          ...toPosProduct(row, [], req),
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

// GET /products/:id/audit — Lịch sử thay đổi catalog của sản phẩm
router.get('/:id/audit', canWriteCatalog, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'product_id không hợp lệ' });
    }
    const [rows] = await pool.query(
      `SELECT id, action, entity_type, entity_id, user_id, request_id,
              before_data, after_data, metadata, created_at
       FROM catalog_audit_logs
       WHERE entity_type IN ('product', 'product_image')
         AND (
           (entity_type = 'product' AND entity_id = ?)
           OR JSON_EXTRACT(metadata, '$.product_id') = ?
         )
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [productId, productId, limit]
    );
    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        before_data: typeof row.before_data === 'string' ? JSON.parse(row.before_data) : row.before_data,
        after_data: typeof row.after_data === 'string' ? JSON.parse(row.after_data) : row.after_data,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /products/:id — Chi tiết sản phẩm
router.get('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const cacheKey = `products:detail:${productId}`;
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

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
    const images = await getProductImages(productId);

    const [[{ total_stock }]] = await pool.query(
      `SELECT COALESCE(SUM(quantity_remaining), 0) as total_stock 
       FROM batch_items 
       WHERE product_id = ? AND status IN ('available', 'near_expiry')`,
      [productId]
    );
    const normalizedImages = images.map((image) => ({
      ...image,
      public_url: toPublicImageUrl(image.public_url, req)
    }));
    const primaryImage = normalizedImages.find((image) => Number(image.is_primary) === 1);
    let fallbackGallery = [];
    try {
      fallbackGallery = Array.isArray(product.gallery)
        ? product.gallery
        : (product.gallery ? JSON.parse(product.gallery) : []);
    } catch (_galleryErr) {
      fallbackGallery = [];
    }
    const normalizedGallery = normalizedImages.length
      ? normalizedImages.map((image) => image.public_url)
      : fallbackGallery.map((image) => toPublicImageUrl(image, req));

    const [promotionsConfig] = await pool.query(
      `SELECT * FROM product_tag_promotions WHERE product_id = ?`,
      [productId]
    );
    const promo_info = computeActivePromoInfo(product, promotionsConfig);

    const data = {
      ...normalizeProductImageFields(product, req),
      brand: product.brand_id ? { id: product.brand_id, name: product.brand_name } : null,
      category: {
        id: product.category_id,
        name: product.category_name,
        slug: product.category_slug,
        parent: product.category_parent_id ? { id: product.category_parent_id, name: product.category_parent_name } : null
      },
      units,
      specifications,
      images: normalizedImages,
      total_stock: Number(total_stock),
      in_stock: Number(total_stock) > 0,
      image_url: primaryImage?.public_url || toPublicImageUrl(product.image_url, req),
      gallery: normalizedGallery,
      original_price: product.retail_price,
      price: promo_info ? promo_info.promo_price : product.retail_price,
      retail_price: promo_info ? promo_info.promo_price : product.retail_price,
      discount_percent: promo_info ? promo_info.discount_percent : 0,
      promo_info,
      promotions_config: promotionsConfig.map(p => ({
        tag_name: p.tag_name,
        discount_type: p.discount_type,
        discount_value: Number(p.discount_value),
        campaign_qty: p.campaign_qty,
        sold_qty: p.sold_qty,
        max_per_customer: p.max_per_customer,
        start_time: p.start_time,
        end_time: p.end_time,
        status: p.status
      }))
    };


    delete data.brand_id;
    delete data.brand_name;
    delete data.category_id;
    delete data.category_name;
    delete data.category_slug;
    delete data.category_parent_id;
    delete data.category_parent_name;

    await cache.set(cacheKey, data, 120); // TTL: 120s

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
      name, strength, route_of_administration, category_id, brand_id, active_ingredient, registration_number,
      manufacturer, requires_prescription, special_control_group, storage_condition, base_unit, retail_price, cost_price,
      min_stock_alert, image_url, gallery, description, tags, country_of_origin,
      barcode, status, unit_conversions, specifications, promotions_config
    } = req.body;

    const validationErrors = validateProductPayload(req.body, { isCreate: true });
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors[0], errors: validationErrors });
    }
    const businessErrors = await validateProductBusinessRules(req.body, { isCreate: true });
    if (businessErrors.length > 0) {
      return res.status(400).json({ success: false, message: businessErrors[0], errors: businessErrors });
    }
    const publishErrors = await validateProductPublishReadiness(req.body);
    if (publishErrors.length > 0) {
      return res.status(400).json({ success: false, message: publishErrors[0], errors: publishErrors });
    }
    const barcodeErrors = await validateGlobalBarcodeUniqueness(req.body);
    if (barcodeErrors.length > 0) {
      return res.status(409).json({ success: false, message: barcodeErrors[0], errors: barcodeErrors });
    }
    const normalizedStrength = cleanNullableText(strength);
    const normalizedRoute = cleanNullableText(route_of_administration);
    const normalizedSpecialGroup = requires_prescription ? cleanNullableText(special_control_group) : null;
    const normalizedStorage = cleanNullableText(storage_condition) || 'Điều kiện thường';
    const normalizedStatus = status || 'draft';

    await conn.query('START TRANSACTION');

    const [result] = await conn.query(
      `INSERT INTO products (
        sku, name, strength, route_of_administration, category_id, brand_id, active_ingredient, registration_number,
        manufacturer, requires_prescription, special_control_group, storage_condition, base_unit, retail_price, cost_price,
        min_stock_alert, image_url, gallery, description, tags, country_of_origin,
        barcode, status
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(), normalizedStrength, normalizedRoute, category_id, brand_id || null, cleanNullableText(active_ingredient), cleanNullableText(registration_number),
        cleanNullableText(manufacturer), requires_prescription ? 1 : 0, normalizedSpecialGroup, normalizedStorage, String(base_unit).trim(), retail_price,
        cost_price ?? 0, min_stock_alert ?? 10, cleanNullableText(image_url), gallery ? JSON.stringify(gallery) : null,
        cleanNullableText(description), tags ? JSON.stringify(tags) : null, cleanNullableText(country_of_origin),
        cleanNullableText(barcode), normalizedStatus
      ]
    );

    const productId = result.insertId;
    const sku = `MED-${productId.toString().padStart(4, '0')}`;
    await conn.query(`UPDATE products SET sku = ? WHERE id = ?`, [sku, productId]);

    if (unit_conversions && Array.isArray(unit_conversions) && unit_conversions.length > 0) {
      await insertProductUnits(conn, productId, unit_conversions);
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

    if (promotions_config && Array.isArray(promotions_config) && promotions_config.length > 0) {
      await saveProductPromotions(conn, productId, promotions_config, tags);
    }

    await writeAudit({
      action: 'product_create',
      entity_type: 'product',
      entity_id: productId,
      user_id: req.userId,
      request_id: req.requestId,
      after_data: {
        id: productId,
        sku,
        ...pickAuditProductFields({ ...req.body, status: normalizedStatus })
      },
      metadata: {
        unit_conversions_count: Array.isArray(unit_conversions) ? unit_conversions.length : 0,
        specifications_count: Array.isArray(specifications) ? specifications.length : 0
      }
    }, conn);

    await conn.query('COMMIT');
    await cache.clearByPrefix('products:');
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
      name, strength, route_of_administration, category_id, brand_id, active_ingredient, registration_number,
      manufacturer, requires_prescription, special_control_group, storage_condition, base_unit, retail_price, cost_price,
      min_stock_alert, image_url, gallery, description, tags, country_of_origin,
      barcode, status, unit_conversions, specifications, promotions_config
    } = req.body;

    const [[existing]] = await conn.query(`SELECT * FROM products WHERE id = ?`, [productId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    const validationErrors = validateProductPayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors[0], errors: validationErrors });
    }
    const businessErrors = await validateProductBusinessRules(req.body, { existingProduct: existing });
    if (businessErrors.length > 0) {
      return res.status(400).json({ success: false, message: businessErrors[0], errors: businessErrors });
    }
    const publishErrors = await validateProductPublishReadiness(req.body, existing);
    if (publishErrors.length > 0) {
      return res.status(400).json({ success: false, message: publishErrors[0], errors: publishErrors });
    }
    const barcodeErrors = await validateGlobalBarcodeUniqueness(req.body, productId);
    if (barcodeErrors.length > 0) {
      return res.status(409).json({ success: false, message: barcodeErrors[0], errors: barcodeErrors });
    }
    const nextRequiresPrescription = requires_prescription !== undefined
      ? Number(requires_prescription || 0)
      : Number(existing.requires_prescription || 0);
    const nextSpecialControlGroup = special_control_group !== undefined
      ? special_control_group
      : existing.special_control_group;

    const normalizedFields = {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(strength !== undefined ? { strength: cleanNullableText(strength) } : {}),
      ...(route_of_administration !== undefined ? { route_of_administration: cleanNullableText(route_of_administration) } : {}),
      ...(category_id !== undefined ? { category_id } : {}),
      ...(brand_id !== undefined ? { brand_id: brand_id || null } : {}),
      ...(active_ingredient !== undefined ? { active_ingredient: cleanNullableText(active_ingredient) } : {}),
      ...(registration_number !== undefined ? { registration_number: cleanNullableText(registration_number) } : {}),
      ...(manufacturer !== undefined ? { manufacturer: cleanNullableText(manufacturer) } : {}),
      ...(requires_prescription !== undefined ? { requires_prescription } : {}),
      ...(special_control_group !== undefined || requires_prescription !== undefined
        ? { special_control_group: nextRequiresPrescription === 1 ? cleanNullableText(nextSpecialControlGroup) : null }
        : {}),
      ...(storage_condition !== undefined ? { storage_condition: cleanNullableText(storage_condition) || 'Điều kiện thường' } : {}),
      ...(base_unit !== undefined ? { base_unit: String(base_unit).trim() } : {}),
      ...(retail_price !== undefined ? { retail_price } : {}),
      ...(cost_price !== undefined ? { cost_price } : {}),
      ...(min_stock_alert !== undefined ? { min_stock_alert } : {}),
      ...(image_url !== undefined ? { image_url: cleanNullableText(image_url) } : {}),
      ...(gallery !== undefined ? { gallery } : {}),
      ...(description !== undefined ? { description: cleanNullableText(description) } : {}),
      ...(tags !== undefined ? { tags } : {}),
      ...(country_of_origin !== undefined ? { country_of_origin: cleanNullableText(country_of_origin) } : {}),
      ...(barcode !== undefined ? { barcode: cleanNullableText(barcode) } : {}),
      ...(status !== undefined ? { status } : {})
    };

    await conn.query('START TRANSACTION');

    const updateFields = [];
    const updateParams = [];
    const fields = normalizedFields;

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
        await insertProductUnits(conn, productId, unit_conversions);
      }
    }

    if (specifications && Array.isArray(specifications)) {
      await conn.query(`DELETE FROM product_specifications WHERE product_id = ?`, [productId]);
      if (specifications.length > 0) {
        const specValues = specifications.map((s, index) => [productId, s.spec_key, s.spec_value, index]);
        await conn.query(`INSERT INTO product_specifications (product_id, spec_key, spec_value, sort_order) VALUES ?`, [specValues]);
      }
    }

    if (promotions_config && Array.isArray(promotions_config)) {
      await saveProductPromotions(conn, productId, promotions_config, tags !== undefined ? tags : existing.tags);
    } else if (tags !== undefined) {
      const [existingPromos] = await conn.query(`SELECT * FROM product_tag_promotions WHERE product_id = ?`, [productId]);
      await saveProductPromotions(conn, productId, existingPromos, tags);
    }

    const [[updatedProduct]] = await conn.query(`SELECT * FROM products WHERE id = ?`, [productId]);
    const beforeAudit = pickAuditProductFields(existing);
    const afterAudit = pickAuditProductFields(updatedProduct || {});
    await writeAudit({
      action: status !== undefined && Object.keys(normalizedFields).length === 1 ? 'product_status_update' : 'product_update',
      entity_type: 'product',
      entity_id: productId,
      user_id: req.userId,
      request_id: req.requestId,
      before_data: beforeAudit,
      after_data: afterAudit,
      metadata: {
        changed_fields: diffAuditFields(beforeAudit, afterAudit),
        unit_conversions_replaced: Array.isArray(unit_conversions),
        specifications_replaced: Array.isArray(specifications)
      }
    }, conn);

    await conn.query('COMMIT');
    await cache.clearByPrefix('products:');
    res.json({ success: true, message: 'Cập nhật sản phẩm thành công' });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// GET /:id/images — Danh sách ảnh sản phẩm
router.get('/:id/images', async (req, res) => {
  try {
    const images = await getProductImages(req.params.id);
    res.json({ success: true, data: images.map((image) => normalizeProductImageRecord(image, req)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /:id/images — Upload ảnh sản phẩm từ file base64 của admin
router.post('/:id/images', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!(await hasProductImagesTable())) {
      return res.status(503).json({
        success: false,
        message: 'Database chưa có bảng product_images. Vui lòng chạy migration 06_mg_catalog_product_media_gpp.sql trước khi upload ảnh.'
      });
    }
    const productId = Number(req.params.id);
    const {
      original_name,
      mime_type,
      data_base64,
      image_role = 'gallery',
      alt_text,
      is_primary = false,
      sort_order = 0
    } = req.body || {};

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'product_id không hợp lệ' });
    }
    const [[product]] = await conn.query(`SELECT id, name FROM products WHERE id = ?`, [productId]);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(mime_type)) {
      return res.status(400).json({ success: false, message: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP' });
    }
    if (!ALLOWED_PRODUCT_IMAGE_ROLES.includes(image_role)) {
      return res.status(400).json({ success: false, message: 'Vai trò ảnh sản phẩm không hợp lệ' });
    }
    if (!data_base64 || typeof data_base64 !== 'string') {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu ảnh' });
    }
    const buffer = Buffer.from(data_base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''), 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Dung lượng ảnh phải lớn hơn 0 và không quá 8MB' });
    }

    let finalBuffer = buffer;
    try {
      const Jimp = require('jimp');
      const image = await Jimp.read(buffer);
      if (image.bitmap.width > 400 || image.bitmap.height > 400) {
        image.scaleToFit(400, 400);
      }
      image.quality(80);
      finalBuffer = await image.getBufferAsync(mime_type);
    } catch (jimpErr) {
      console.error('Jimp image resize error, fallback to original buffer:', jimpErr);
    }

    const ext = mime_type === 'image/png' ? '.png' : (mime_type === 'image/webp' ? '.webp' : '.jpg');
    const uploadDir = path.join(__dirname, '..', 'uploads', 'products', String(productId));
    await fs.mkdir(uploadDir, { recursive: true });
    const baseOriginalName = path.basename(String(original_name || 'product-image'), path.extname(String(original_name || '')));
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeUploadName(baseOriginalName)}${ext}`;
    const storagePath = path.join('uploads', 'products', String(productId), fileName);
    const fullPath = path.join(__dirname, '..', storagePath);
    await fs.writeFile(fullPath, finalBuffer);
    const publicUrl = `${getPublicBaseUrl(req)}/${storagePath.split(path.sep).join('/')}`;
    const primary = is_primary ? 1 : 0;

    await conn.query('START TRANSACTION');
    if (primary) {
      await conn.query(`UPDATE product_images SET is_primary = 0, image_role = IF(image_role = 'main', 'gallery', image_role) WHERE product_id = ?`, [productId]);
    }
    const [result] = await conn.query(
      `INSERT INTO product_images
        (product_id, file_name, original_name, mime_type, file_size, storage_path, public_url,
         image_role, alt_text, is_primary, sort_order, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        fileName,
        original_name || fileName,
        mime_type,
        finalBuffer.length,
        storagePath.split(path.sep).join('/'),
        publicUrl,
        primary ? 'main' : image_role,
        alt_text || product.name,
        primary,
        Number(sort_order) || 0,
        req.userId ? Number(req.userId) : null
      ]
    );
    if (primary) {
      await conn.query(`UPDATE products SET image_url = ? WHERE id = ?`, [publicUrl, productId]);
    }
    await writeAudit({
      action: 'product_image_upload',
      entity_type: 'product_image',
      entity_id: result.insertId,
      user_id: req.userId,
      request_id: req.requestId,
      after_data: {
        id: result.insertId,
        product_id: productId,
        original_name: original_name || fileName,
        image_role: primary ? 'main' : image_role,
        is_primary: primary,
        public_url: publicUrl
      },
      metadata: { product_id: productId }
    }, conn);
    await conn.query('COMMIT');
    await cache.clearByPrefix('products:');

    const [[image]] = await pool.query(`SELECT * FROM product_images WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, data: normalizeProductImageRecord(image, req) });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// PUT /:id/images/reorder — Sắp xếp lại thứ tự ảnh sản phẩm
router.put('/:id/images/reorder', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!(await hasProductImagesTable())) {
      return res.status(503).json({
        success: false,
        message: 'Database chưa có bảng product_images. Vui lòng chạy migration 06_mg_catalog_product_media_gpp.sql trước khi quản lý ảnh.'
      });
    }
    const productId = Number(req.params.id);
    const imageIds = Array.isArray(req.body?.image_ids)
      ? req.body.image_ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'product_id không hợp lệ' });
    }
    if (!imageIds.length) {
      return res.status(400).json({ success: false, message: 'Danh sách ảnh sắp xếp không hợp lệ' });
    }

    const [existing] = await conn.query(
      `SELECT id FROM product_images WHERE product_id = ? AND id IN (${imageIds.map(() => '?').join(',')})`,
      [productId, ...imageIds]
    );
    if (existing.length !== imageIds.length) {
      return res.status(400).json({ success: false, message: 'Danh sách ảnh không thuộc cùng sản phẩm' });
    }

    await conn.query('START TRANSACTION');
    for (let index = 0; index < imageIds.length; index += 1) {
      await conn.query(`UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?`, [index, imageIds[index], productId]);
    }
    await writeAudit({
      action: 'product_image_reorder',
      entity_type: 'product_image',
      entity_id: productId,
      user_id: req.userId,
      request_id: req.requestId,
      after_data: { image_ids: imageIds },
      metadata: { product_id: productId }
    }, conn);
    await conn.query('COMMIT');
    await cache.clearByPrefix('products:');

    const images = await getProductImages(productId);
    res.json({
      success: true,
      message: 'Đã cập nhật thứ tự ảnh',
      data: images.map((image) => normalizeProductImageRecord(image, req))
    });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// PUT /:id/images/:imageId — Cập nhật metadata ảnh sản phẩm
router.put('/:id/images/:imageId', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!(await hasProductImagesTable())) {
      return res.status(503).json({
        success: false,
        message: 'Database chưa có bảng product_images. Vui lòng chạy migration 06_mg_catalog_product_media_gpp.sql trước khi quản lý ảnh.'
      });
    }
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const { image_role, alt_text, sort_order } = req.body || {};
    const [[image]] = await conn.query(
      `SELECT * FROM product_images WHERE id = ? AND product_id = ?`,
      [imageId, productId]
    );
    if (!image) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh sản phẩm' });
    if (image_role !== undefined && !ALLOWED_PRODUCT_IMAGE_ROLES.includes(image_role)) {
      return res.status(400).json({ success: false, message: 'Vai trò ảnh sản phẩm không hợp lệ' });
    }
    if (Number(image.is_primary) === 1 && image_role !== undefined && image_role !== 'main') {
      return res.status(400).json({ success: false, message: 'Ảnh chính phải giữ vai trò main. Hãy chọn ảnh chính khác trước khi đổi vai trò.' });
    }

    const fields = [];
    const params = [];
    if (alt_text !== undefined) {
      fields.push('alt_text = ?');
      params.push(cleanNullableText(alt_text));
    }
    if (sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(Number(sort_order) || 0);
    }
    if (image_role !== undefined) {
      fields.push('image_role = ?');
      params.push(image_role);
    }
    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu ảnh cần cập nhật' });
    }

    await conn.query('START TRANSACTION');
    if (image_role === 'main') {
      await conn.query(`UPDATE product_images SET is_primary = 0, image_role = IF(image_role = 'main', 'gallery', image_role) WHERE product_id = ?`, [productId]);
      fields.push('is_primary = ?');
      params.push(1);
      await conn.query(`UPDATE products SET image_url = ? WHERE id = ?`, [image.public_url, productId]);
    }
    await conn.query(`UPDATE product_images SET ${fields.join(', ')} WHERE id = ? AND product_id = ?`, [...params, imageId, productId]);
    const [[updatedImageInTx]] = await conn.query(`SELECT * FROM product_images WHERE id = ?`, [imageId]);
    await writeAudit({
      action: 'product_image_update',
      entity_type: 'product_image',
      entity_id: imageId,
      user_id: req.userId,
      request_id: req.requestId,
      before_data: image,
      after_data: updatedImageInTx,
      metadata: {
        product_id: productId,
        changed_fields: diffAuditFields(image, updatedImageInTx || {})
      }
    }, conn);
    await conn.query('COMMIT');
    await cache.clearByPrefix('products:');

    const [[updated]] = await pool.query(`SELECT * FROM product_images WHERE id = ?`, [imageId]);
    res.json({
      success: true,
      message: 'Đã cập nhật ảnh sản phẩm',
      data: normalizeProductImageRecord(updated, req)
    });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// PUT /:id/images/:imageId/primary — Chọn ảnh chính
router.put('/:id/images/:imageId/primary', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!(await hasProductImagesTable())) {
      return res.status(503).json({
        success: false,
        message: 'Database chưa có bảng product_images. Vui lòng chạy migration 06_mg_catalog_product_media_gpp.sql trước khi quản lý ảnh.'
      });
    }
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const [[image]] = await conn.query(
      `SELECT * FROM product_images WHERE id = ? AND product_id = ?`,
      [imageId, productId]
    );
    if (!image) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh sản phẩm' });

    await conn.query('START TRANSACTION');
    await conn.query(`UPDATE product_images SET is_primary = 0, image_role = IF(image_role = 'main', 'gallery', image_role) WHERE product_id = ?`, [productId]);
    await conn.query(`UPDATE product_images SET is_primary = 1, image_role = 'main' WHERE id = ?`, [imageId]);
    await conn.query(`UPDATE products SET image_url = ? WHERE id = ?`, [image.public_url, productId]);
    const [[updatedImage]] = await conn.query(`SELECT * FROM product_images WHERE id = ?`, [imageId]);
    await writeAudit({
      action: 'product_image_set_primary',
      entity_type: 'product_image',
      entity_id: imageId,
      user_id: req.userId,
      request_id: req.requestId,
      before_data: image,
      after_data: updatedImage,
      metadata: { product_id: productId }
    }, conn);
    await conn.query('COMMIT');
    await cache.clearByPrefix('products:');
    res.json({ success: true, message: 'Đã đặt ảnh chính' });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /:id/images/:imageId — Xóa metadata ảnh sản phẩm
router.delete('/:id/images/:imageId', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!(await hasProductImagesTable())) {
      return res.status(503).json({
        success: false,
        message: 'Database chưa có bảng product_images. Vui lòng chạy migration 06_mg_catalog_product_media_gpp.sql trước khi quản lý ảnh.'
      });
    }
    const [[image]] = await conn.query(
      `SELECT * FROM product_images WHERE id = ? AND product_id = ?`,
      [req.params.imageId, req.params.id]
    );
    if (!image) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh sản phẩm' });

    await conn.query('START TRANSACTION');
    await conn.query(`DELETE FROM product_images WHERE id = ?`, [image.id]);
    if (Number(image.is_primary) === 1) {
      const [[nextImage]] = await conn.query(
        `SELECT id, public_url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1`,
        [req.params.id]
      );
      if (nextImage) {
        await conn.query(`UPDATE product_images SET is_primary = 1, image_role = 'main' WHERE id = ?`, [nextImage.id]);
        await conn.query(`UPDATE products SET image_url = ? WHERE id = ?`, [nextImage.public_url, req.params.id]);
      } else {
        await conn.query(`UPDATE products SET image_url = NULL WHERE id = ?`, [req.params.id]);
      }
    }
    await writeAudit({
      action: 'product_image_delete',
      entity_type: 'product_image',
      entity_id: image.id,
      user_id: req.userId,
      request_id: req.requestId,
      before_data: image,
      metadata: { product_id: Number(req.params.id) }
    }, conn);
    await conn.query('COMMIT');
    await cache.clearByPrefix('products:');

    if (image.storage_path && !image.storage_path.includes('..')) {
      await fs.unlink(path.join(__dirname, '..', image.storage_path)).catch(() => {});
    }
    res.json({ success: true, message: 'Đã xóa ảnh sản phẩm' });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /:id — Xóa sản phẩm
router.delete('/:id', canWriteCatalog, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[existing]] = await conn.query(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }
    await conn.query('START TRANSACTION');
    await conn.query(`UPDATE products SET status = 'inactive' WHERE id = ?`, [req.params.id]);
    const [[updated]] = await conn.query(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    await writeAudit({
      action: 'product_status_update',
      entity_type: 'product',
      entity_id: Number(req.params.id),
      user_id: req.userId,
      request_id: req.requestId,
      before_data: pickAuditProductFields(existing),
      after_data: pickAuditProductFields(updated || {}),
      metadata: { reason: 'soft_delete' }
    }, conn);
    await conn.query('COMMIT');
    await cache.clearByPrefix('products:');
    res.json({ success: true, message: 'Xóa sản phẩm thành công (soft delete)' });
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_rollbackErr) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
