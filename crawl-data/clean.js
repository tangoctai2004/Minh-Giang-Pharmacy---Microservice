#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const REPO_ROOT = path.resolve(ROOT, '..');
const DATA_DIR = path.join(ROOT, 'data');
const CLEAN_DIR = path.join(ROOT, 'clean');
const REPORTS_DIR = path.join(CLEAN_DIR, 'reports');
const CATALOG_SEED = path.join(REPO_ROOT, 'infrastructure', 'database', '10_seed_full_catalog.sql');
const CMS_SCHEMA = path.join(REPO_ROOT, 'infrastructure', 'database', '04_mg_cms.sql');

const PRODUCT_LIMIT_FOR_SEED_REVIEW = 4000;

const IMAGE_NOISE = [
  'favicon',
  'logo',
  '/flag/',
  '/customer/',
  '/payment/',
  '/icons/',
  'qr-',
  'googleplay',
  'appstore',
  'dmca',
  'bo-cong-thuong',
  'btn-gotop',
  'tsbear',
  'design/themes',
];

const CONTENT_NOISE_MARKERS = [
  'Hệ thống nhà thuốc:',
  'Ngôn ngữ:',
  'Giỏ hàng',
  'Danh sách yêu thích',
  'Đăng nhập',
  'Theo dõi đơn hàng',
  'Tải ứng dụng',
  'Hỗ trợ thanh toán',
  'Kết nối với chúng tôi',
  'Về chúng tôi',
  '©',
  'Công ty TNHH Trung Sơn',
  'Inline script',
];

const PROMOTION_WORDS = [
  'khuyến mãi',
  'ưu đãi',
  'siêu sale',
  'hotdeal',
  'cào mã',
  'tích luỹ doanh số',
  'tích lũy doanh số',
  'khách hàng thành viên',
  'đặt hàng online',
  'khai trương',
  'tuyển dụng',
];

const CATEGORY_ALIASES = new Map([
  ['bang-ve-sinh', 've-sinh-bang-ve-sinh'],
  ['dung-dich-ve-sinh', 've-sinh-dung-dich'],
  ['khan-giay-khan-uot', 've-sinh-khan-giay'],
  ['rua-tay-sat-khuan', 've-sinh-rua-tay'],
  ['bao-cao-su', 'sinh-ly-bao-cao-su'],
  ['gel-boi-tron', 'sinh-ly-gel-boi-tron'],
  ['bang-gac-bong-y-te', 'y-te-bang-gac'],
  ['may-do-que-kim-thu-duong-huyet', 'y-te-may-do-duong-huyet'],
  ['may-do-huyet-ap', 'y-te-may-do-huyet-ap'],
  ['nhiet-ke', 'y-te-nhiet-ke'],
  ['khau-trang', 'y-te-khau-trang'],
  ['ngua-mun-tri-mun', 'my-pham-tri-mun'],
  ['tri-seo-mo-tham', 'my-pham-tri-seo-tham'],
  ['sua-rua-mat-sua-kem-gel', 'my-pham-sua-rua-mat'],
  ['kem-duong-am', 'my-pham-kem-duong-am'],
  ['kem-chong-nang', 'my-pham-kem-chong-nang'],
  ['mat-ong', 'thuc-pham-do-uong'],
  ['dau-tinh-dau-massage', 'my-pham-duong-the'],
  ['thuoc-giam-mo-mau-cholesterol', 'thuoc-mo-mau-cholesterol'],
  ['thuoc-bo-xuong-khop-canxi', 'thuoc-bo-xuong-khop-canxi'],
  ['dau-ca-omega-dha-epa', 'tpcn-ho-tro-tri-nao'],
]);

const UNIT_MAP = new Map([
  ['01', 'Cái'],
  ['1', 'Cái'],
  ['cai', 'Cái'],
  ['cái', 'Cái'],
  ['hop', 'Hộp'],
  ['hộp', 'Hộp'],
  ['vi', 'Vỉ'],
  ['vỉ', 'Vỉ'],
  ['vien', 'Viên'],
  ['viên', 'Viên'],
  ['chai', 'Chai'],
  ['lo', 'Lọ'],
  ['lọ', 'Lọ'],
  ['tui', 'Túi'],
  ['túi', 'Túi'],
  ['bich', 'Bịch'],
  ['bịch', 'Bịch'],
  ['goi', 'Gói'],
  ['gói', 'Gói'],
  ['tuyp', 'Tuýp'],
  ['tuýp', 'Tuýp'],
  ['ong', 'Ống'],
  ['ống', 'Ống'],
  ['bo', 'Bộ'],
  ['bộ', 'Bộ'],
  ['cay', 'Cây'],
  ['cây', 'Cây'],
  ['mieng', 'Miếng'],
  ['miếng', 'Miếng'],
  ['thung', 'Thùng'],
  ['thùng', 'Thùng'],
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return { _parse_error: error.message, _line: index + 1, _raw: line };
      }
    });
}

function writeJsonl(file, rows) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stripTags(value = '') {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value = '') {
  return stripTags(value)
    .replace(/\bXem thêm\b/gi, ' ')
    .replace(/\bThu gọn\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stableDigits(input, length = 8) {
  const hex = crypto.createHash('sha1').update(String(input || '')).digest('hex');
  let digits = '';
  for (let i = 0; digits.length < length; i += 8) {
    digits += String(parseInt(hex.slice(i, i + 8) || hex, 16));
  }
  return digits.slice(0, length);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function isGoodImageUrl(value) {
  const url = normalizeUrl(value);
  if (!url) return false;
  const lower = url.toLowerCase();
  if (!/^https?:\/\/(www\.)?(trungsoncare\.com|cdn\.trungsoncare\.com)\//.test(lower)) return false;
  if (!/\.(jpe?g|png|webp)(\?|$)/i.test(lower)) return false;
  if (IMAGE_NOISE.some((marker) => lower.includes(marker))) return false;
  return lower.includes('/images/detailed/') || lower.includes('/storage/uploads/');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeUnit(value, fallback = 'Cái') {
  const raw = cleanText(value || '').trim();
  if (!raw) return fallback;
  const key = raw.toLowerCase();
  const ascii = slugify(raw).replace(/-/g, '');
  return UNIT_MAP.get(key) || UNIT_MAP.get(ascii) || raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function cleanMaybeName(value, productName = '') {
  const text = cleanText(value || '');
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('cách tra cứu') || lower === 'null' || lower === 'undefined') return null;
  if (text.length > 120) return null;
  const compactProduct = slugify(productName);
  const compactText = slugify(text);
  if (compactProduct && compactText && compactProduct.includes(compactText) && compactText.length > 30) return null;
  if (compactProduct && compactText && compactText.includes(compactProduct.slice(0, 40))) return null;
  return text;
}

function cleanRegistration(value) {
  const text = cleanText(value || '');
  if (!text) return null;
  if (/cách tra cứu|dang cap nhat|đang cập nhật|không có/i.test(text)) return null;
  if (!/\d/.test(text)) return null;
  if (text.length > 100) return null;
  return text;
}

function parseCatalogCategories() {
  const sql = fs.readFileSync(CATALOG_SEED, 'utf8');
  const start = sql.indexOf('INSERT INTO `categories` VALUES');
  const end = sql.indexOf(';', start);
  const block = sql.slice(start, end + 1);
  const regex = /\((\d+),'((?:''|[^'])*)','((?:''|[^'])*)',([^,)]*)/g;
  return [...block.matchAll(regex)].map((match) => ({
    id: Number(match[1]),
    name: match[2].replace(/''/g, "'"),
    slug: match[3],
    parent_id: match[4] === 'NULL' ? null : Number(match[4]),
  }));
}

function parseCmsCategories() {
  const sql = fs.readFileSync(CMS_SCHEMA, 'utf8');
  const start = sql.indexOf('INSERT INTO `cms_categories` VALUES');
  const end = sql.indexOf(';', start);
  const block = sql.slice(start, end + 1);
  const regex = /\((\d+),'((?:''|[^'])*)','((?:''|[^'])*)','((?:''|[^'])*)'/g;
  return [...block.matchAll(regex)].map((match) => ({
    id: Number(match[1]),
    name: match[2].replace(/''/g, "'"),
    slug: match[3],
    type: match[4],
  }));
}

function buildCategoryMapper(categories) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const byNameSlug = new Map(categories.map((category) => [slugify(category.name), category]));
  const children = new Map();
  for (const category of categories) {
    if (!children.has(category.parent_id)) children.set(category.parent_id, []);
    children.get(category.parent_id).push(category);
  }

  function descendants(root) {
    if (!root) return categories;
    const out = [];
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      out.push(current);
      for (const child of children.get(current.id) || []) stack.push(child);
    }
    return out;
  }

  function scoreCategory(category, haystack, deepestSegmentSlug) {
    let score = 0;
    if (deepestSegmentSlug === category.slug || deepestSegmentSlug === slugify(category.name)) score += 1000;
    if (haystack.includes(` ${category.slug} `)) score += 500;
    if (haystack.includes(` ${slugify(category.name)} `)) score += 450;
    const slugParts = category.slug.split('-').filter((part) => part.length > 2);
    for (const part of slugParts) {
      if (haystack.includes(part)) score += 10;
    }
    score += category.parent_id ? 20 : 0;
    score += category.slug.length / 100;
    return score;
  }

  return function mapProductCategory(row) {
    const segments = (row.category_path || [])
      .map((segment) => cleanText(segment))
      .filter((segment) => segment && !/^trang chủ$/i.test(segment));
    const slugs = segments.map(slugify);
    for (let i = slugs.length - 1; i >= 0; i -= 1) {
      const alias = CATEGORY_ALIASES.get(slugs[i]);
      if (alias && bySlug.has(alias)) return { ...bySlug.get(alias), matched_by: 'category_path_alias' };
      if (bySlug.has(slugs[i])) return { ...bySlug.get(slugs[i]), matched_by: 'category_path_slug' };
      if (byNameSlug.has(slugs[i])) return { ...byNameSlug.get(slugs[i]), matched_by: 'category_path_name' };
    }

    const deepest = slugs.at(-1) || '';
    const root = byNameSlug.get(slugs[0]) || bySlug.get(slugs[0]) || null;
    const candidateCategories = descendants(root);
    const haystack = ` ${[
      row.name,
      row.slug,
      row.source_url,
      ...(row.category_path || []),
      row.active_ingredient,
      row.description,
    ].map(slugify).join(' ')} `;

    let best = null;
    for (const category of candidateCategories) {
      const score = scoreCategory(category, haystack, deepest);
      if (!best || score > best.score) best = { category, score };
    }
    if (best && best.score >= 80) return { ...best.category, matched_by: 'fuzzy_category_text', score: best.score };
    if (root) return { ...root, matched_by: 'root_category_fallback' };

    const mappedSlug = row.mapped_category?.slug;
    if (mappedSlug && bySlug.has(mappedSlug)) {
      const category = bySlug.get(mappedSlug);
      return { ...category, matched_by: 'existing_mapped_category_fallback' };
    }
    return null;
  };
}

function cmsCategoryFor(row, cmsCategories, forcedDisease = false) {
  const bySlug = new Map(cmsCategories.map((category) => [category.slug, category]));
  const haystack = slugify([row.title, row.slug, row.source_url, ...(row.tags || [])].join(' '));
  if (forcedDisease || haystack.includes('benh-ly') || haystack.includes('trieu-chung') || haystack.includes('dieu-tri')) {
    return bySlug.get('kien-thuc-benh-ly');
  }
  if (haystack.includes('thuoc') || haystack.includes('duoc')) return bySlug.get('tu-van-dung-thuoc');
  if (haystack.includes('nguoi-cao-tuoi') || haystack.includes('huyet-ap') || haystack.includes('loang-xuong')) {
    return bySlug.get('nguoi-cao-tuoi');
  }
  if (haystack.includes('tin-tuc') || haystack.includes('bo-y-te')) return bySlug.get('tin-tuc-y-te');
  return bySlug.get('suc-khoe-tong-quat');
}

function cleanSections(sections = {}) {
  const out = {};
  for (const [key, value] of Object.entries(sections || {})) {
    const text = cleanText(value);
    if (text && text.length >= 8) out[key] = text;
  }
  return out;
}

function cleanProduct(row, mapCategory, seen) {
  const issues = [];
  const reviewFlags = [];
  if (row._parse_error) return { rejected: true, issues: ['json_parse_error'], row };

  const name = cleanText(row.name);
  if (!name || name.length < 5) issues.push('missing_or_short_name');

  const sourceUrl = normalizeUrl(row.source_url);
  if (!sourceUrl) issues.push('missing_source_url');

  const category = mapCategory(row);
  if (!category) issues.push('missing_mapped_category');

  const images = unique([row.image_url, ...(row.gallery || [])].filter(isGoodImageUrl));
  if (!images.length) issues.push('missing_product_image');

  const retailPrice = Number(row.retail_price || 0);
  if (!Number.isFinite(retailPrice) || retailPrice <= 0) issues.push('missing_or_invalid_price');

  const description = cleanText(row.description);
  if (description.length < 80) issues.push('description_too_short');
  if (/Hệ thống nhà thuốc|Giỏ hàng|Đăng nhập|Tải ứng dụng/.test(description.slice(0, 500))) {
    issues.push('description_contains_layout_noise');
  }

  const fingerprint = slugify(`${name}-${row.barcode_suggested || ''}`);
  const duplicateKey = row.barcode_suggested && /^\d{8,14}$/.test(String(row.barcode_suggested))
    ? `barcode:${row.barcode_suggested}`
    : `name:${fingerprint}`;
  if (seen.has(duplicateKey)) issues.push('duplicate_product');
  seen.add(duplicateKey);

  const activeIngredient = cleanText(row.active_ingredient);
  const isMedicine = category && (category.slug.startsWith('thuoc') || category.parent_id === 1000);
  if (isMedicine && activeIngredient.length < 8) reviewFlags.push('medicine_missing_active_ingredient');

  const brand = cleanMaybeName(row.brand, name);
  const manufacturer = cleanMaybeName(row.manufacturer, name);
  if (!brand && !manufacturer) reviewFlags.push('missing_brand_or_manufacturer');

  const unit = normalizeUnit(row.base_unit || row.packaging);
  if (!row.base_unit && !row.packaging) reviewFlags.push('missing_base_unit');

  const clean = {
    source: row.source || 'trungsoncare',
    source_url: sourceUrl,
    crawled_at: row.crawled_at || null,
    sku: row.sku_suggested || `TS-${stableDigits(sourceUrl || name, 8)}`,
    barcode: /^\d{8,14}$/.test(String(row.barcode_suggested || '')) ? String(row.barcode_suggested) : null,
    name,
    slug: row.slug || slugify(name),
    category: {
      id: category?.id || null,
      name: category?.name || null,
      slug: category?.slug || null,
      matched_by: category?.matched_by || null,
    },
    source_category_path: row.category_path || [],
    retail_price: Math.round(retailPrice),
    estimated_cost_price: Math.round(retailPrice * 0.7),
    image_url: images[0] || null,
    gallery: images,
    brand,
    manufacturer,
    base_unit: unit,
    packaging: cleanText(row.packaging || unit),
    registration_number: cleanRegistration(row.registration_number),
    active_ingredient: activeIngredient || null,
    description,
    sections: cleanSections(row.sections),
    requires_prescription: Boolean(row.requires_prescription),
    storage_condition: cleanSections(row.sections).storage || 'Điều kiện thường',
    quality: {
      status: issues.length ? 'rejected' : (reviewFlags.length ? 'needs_review' : 'clean'),
      issues,
      review_flags: reviewFlags,
      score: Math.max(0, 100 - issues.length * 25 - reviewFlags.length * 6),
    },
  };

  return { rejected: issues.length > 0, clean, issues, reviewFlags };
}

function extractMainText(row) {
  const title = cleanText(row.title);
  let text = cleanText(row.content_sanitized || row.content || row.description || '');
  if (title) {
    const titleNeedle = title.toLowerCase().slice(0, Math.min(32, title.length));
    const titleIndex = text.toLowerCase().indexOf(titleNeedle);
    if (titleIndex > 0) text = text.slice(titleIndex);
  }
  for (const marker of ['Bài viết liên quan', 'Sản phẩm liên quan', 'Có thể bạn quan tâm', 'Tải ứng dụng', 'Hỗ trợ thanh toán', 'Kết nối với chúng tôi', '©']) {
    const index = text.indexOf(marker);
    if (index > 500) text = text.slice(0, index);
  }
  text = text.replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '');
  return text.replace(/\s+/g, ' ').trim();
}

function cleanArticleLike(row, cmsCategories, type) {
  const issues = [];
  const reviewFlags = [];
  if (row._parse_error) return { rejected: true, issues: ['json_parse_error'], row };

  const title = cleanText(row.title);
  if (!title || title.length < 10) issues.push('missing_or_short_title');

  const sourceUrl = normalizeUrl(row.source_url);
  if (!sourceUrl) issues.push('missing_source_url');

  const titleSlug = slugify(title);
  if (PROMOTION_WORDS.some((word) => title.toLowerCase().includes(word))) issues.push('promotion_or_non_medical_content');

  const contentText = extractMainText(row);
  const excerpt = cleanText(row.excerpt);
  const thumbnail = isGoodImageUrl(row.thumbnail_url) ? normalizeUrl(row.thumbnail_url) : null;
  if (!thumbnail) reviewFlags.push('missing_or_suspicious_thumbnail');

  const earlyText = contentText.slice(0, 800);
  const noiseHits = CONTENT_NOISE_MARKERS.filter((marker) => earlyText.includes(marker));
  if (noiseHits.length >= 3) issues.push('content_contains_layout_noise');
  if (contentText.length < 600) issues.push('content_too_short_after_clean');
  if (titleSlug && !slugify(contentText).includes(titleSlug.slice(0, 25))) reviewFlags.push('title_not_found_in_clean_content');

  const category = cmsCategoryFor(row, cmsCategories, type === 'disease');
  const clean = {
    source: row.source || 'trungsoncare',
    source_url: sourceUrl,
    crawled_at: row.crawled_at || null,
    type,
    title,
    slug: row.slug || slugify(title),
    thumbnail_url: thumbnail,
    excerpt: excerpt && !CONTENT_NOISE_MARKERS.some((marker) => excerpt.includes(marker))
      ? excerpt.slice(0, 500)
      : contentText.slice(0, 300),
    content_text: contentText,
    content_sanitized: `<p>${contentText.split(/\n{2,}/).map((p) => cleanText(p)).filter(Boolean).join('</p><p>')}</p>`,
    text_length: contentText.length,
    tags: unique([...(row.tags || []), type === 'disease' ? 'benh-ly' : null, 'suc-khoe']),
    category: {
      id: category?.id || null,
      name: category?.name || null,
      slug: category?.slug || null,
      type: category?.type || null,
    },
    quality: {
      status: issues.length ? 'rejected' : (reviewFlags.length ? 'needs_review' : 'clean'),
      issues,
      review_flags: reviewFlags,
      score: Math.max(0, 100 - issues.length * 30 - reviewFlags.length * 8),
    },
  };
  return { rejected: issues.length > 0, clean, issues, reviewFlags };
}

function countBy(rows, getter) {
  const out = {};
  for (const row of rows) {
    const key = getter(row) || 'unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function issueCounts(results) {
  const out = {};
  for (const result of results) {
    for (const issue of [...(result.issues || []), ...(result.reviewFlags || [])]) {
      out[issue] = (out[issue] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function selectBalancedProducts(products, limit) {
  const sorted = [...products].sort((a, b) => b.quality.score - a.quality.score);
  const buckets = new Map();
  for (const product of sorted) {
    const slug = product.category.slug || 'unknown';
    if (!buckets.has(slug)) buckets.set(slug, []);
    buckets.get(slug).push(product);
  }
  const selected = [];
  while (selected.length < limit) {
    let pushed = false;
    for (const bucket of buckets.values()) {
      const next = bucket.shift();
      if (next) {
        selected.push(next);
        pushed = true;
        if (selected.length >= limit) break;
      }
    }
    if (!pushed) break;
  }
  return selected;
}

function main() {
  ensureDir(CLEAN_DIR);
  ensureDir(REPORTS_DIR);

  const categories = parseCatalogCategories();
  const cmsCategories = parseCmsCategories();
  const mapCategory = buildCategoryMapper(categories);

  const rawProducts = readJsonl(path.join(DATA_DIR, 'products.jsonl'));
  const rawArticles = readJsonl(path.join(DATA_DIR, 'articles.jsonl'));
  const rawDiseases = readJsonl(path.join(DATA_DIR, 'diseases.jsonl'));

  const seenProducts = new Set();
  const productResults = rawProducts.map((row) => cleanProduct(row, mapCategory, seenProducts));
  const articleResults = rawArticles.map((row) => cleanArticleLike(row, cmsCategories, 'article'));
  const diseaseResults = rawDiseases.map((row) => cleanArticleLike(row, cmsCategories, 'disease'));

  const productsClean = productResults.filter((result) => !result.rejected).map((result) => result.clean);
  const productsRejected = productResults.filter((result) => result.rejected).map((result) => ({
    source_url: result.row?.source_url || result.clean?.source_url,
    name: result.row?.name || result.clean?.name,
    issues: result.issues,
  }));
  const productsReview = productsClean.filter((row) => row.quality.status === 'needs_review');

  const articlesClean = articleResults.filter((result) => !result.rejected).map((result) => result.clean);
  const articlesRejected = articleResults.filter((result) => result.rejected).map((result) => ({
    source_url: result.row?.source_url || result.clean?.source_url,
    title: result.row?.title || result.clean?.title,
    issues: result.issues,
  }));
  const articlesReview = articlesClean.filter((row) => row.quality.status === 'needs_review');

  const diseasesClean = diseaseResults.filter((result) => !result.rejected).map((result) => result.clean);
  const diseasesRejected = diseaseResults.filter((result) => result.rejected).map((result) => ({
    source_url: result.row?.source_url || result.clean?.source_url,
    title: result.row?.title || result.clean?.title,
    issues: result.issues,
  }));
  const diseasesReview = diseasesClean.filter((row) => row.quality.status === 'needs_review');

  const recommendedProducts = selectBalancedProducts(
    productsClean.filter((product) => product.quality.status !== 'rejected'),
    PRODUCT_LIMIT_FOR_SEED_REVIEW,
  );

  writeJsonl(path.join(CLEAN_DIR, 'products.clean.jsonl'), productsClean);
  writeJsonl(path.join(CLEAN_DIR, 'products.rejected.jsonl'), productsRejected);
  writeJsonl(path.join(CLEAN_DIR, 'products.needs_review.jsonl'), productsReview);
  writeJsonl(path.join(CLEAN_DIR, 'products.recommended_4000.jsonl'), recommendedProducts);
  writeJsonl(path.join(CLEAN_DIR, 'articles.clean.jsonl'), articlesClean);
  writeJsonl(path.join(CLEAN_DIR, 'articles.rejected.jsonl'), articlesRejected);
  writeJsonl(path.join(CLEAN_DIR, 'articles.needs_review.jsonl'), articlesReview);
  writeJsonl(path.join(CLEAN_DIR, 'diseases.clean.jsonl'), diseasesClean);
  writeJsonl(path.join(CLEAN_DIR, 'diseases.rejected.jsonl'), diseasesRejected);
  writeJsonl(path.join(CLEAN_DIR, 'diseases.needs_review.jsonl'), diseasesReview);

  const report = {
    generated_at: new Date().toISOString(),
    policy: {
      product_limit_for_seed_review: PRODUCT_LIMIT_FOR_SEED_REVIEW,
      seed_sql_generated: false,
      notes: [
        'Clean files are review artifacts only. Do not import into DB until SQL seed is generated separately.',
        'products.recommended_4000.jsonl is balanced across categories for the next seed step.',
      ],
    },
    category_check: {
      catalog_categories_loaded: categories.length,
      root_categories: categories.filter((category) => category.parent_id === null).map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })),
      cms_categories_loaded: cmsCategories.length,
    },
    products: {
      raw: rawProducts.length,
      clean: productsClean.length,
      needs_review: productsReview.length,
      rejected: productsRejected.length,
      recommended_for_seed_review: recommendedProducts.length,
      issue_counts: issueCounts(productResults),
      by_category: countBy(productsClean, (row) => row.category.slug),
      by_root_category: countBy(productsClean, (row) => {
        const category = categories.find((item) => item.id === row.category.id);
        let current = category;
        while (current?.parent_id) current = categories.find((item) => item.id === current.parent_id);
        return current?.name;
      }),
      samples_needing_review: productsReview.slice(0, 30).map((row) => ({
        name: row.name,
        source_url: row.source_url,
        category: row.category.slug,
        flags: row.quality.review_flags,
      })),
      samples_rejected: productsRejected.slice(0, 30),
    },
    articles: {
      raw: rawArticles.length,
      clean: articlesClean.length,
      needs_review: articlesReview.length,
      rejected: articlesRejected.length,
      issue_counts: issueCounts(articleResults),
      by_category: countBy(articlesClean, (row) => row.category.slug),
      samples_needing_review: articlesReview.slice(0, 20).map((row) => ({
        title: row.title,
        source_url: row.source_url,
        flags: row.quality.review_flags,
        text_length: row.text_length,
      })),
      samples_rejected: articlesRejected.slice(0, 20),
    },
    diseases: {
      raw: rawDiseases.length,
      clean: diseasesClean.length,
      needs_review: diseasesReview.length,
      rejected: diseasesRejected.length,
      issue_counts: issueCounts(diseaseResults),
      by_category: countBy(diseasesClean, (row) => row.category.slug),
      samples_needing_review: diseasesReview.slice(0, 20).map((row) => ({
        title: row.title,
        source_url: row.source_url,
        flags: row.quality.review_flags,
        text_length: row.text_length,
      })),
      samples_rejected: diseasesRejected.slice(0, 20),
    },
  };

  const reportPath = path.join(REPORTS_DIR, `quality-summary-${Date.now()}.json`);
  writeJson(path.join(CLEAN_DIR, 'quality-summary.json'), report);
  writeJson(reportPath, report);

  console.log(JSON.stringify({
    products: report.products,
    articles: report.articles,
    diseases: report.diseases,
    report: path.relative(ROOT, reportPath),
  }, null, 2));
}

main();
