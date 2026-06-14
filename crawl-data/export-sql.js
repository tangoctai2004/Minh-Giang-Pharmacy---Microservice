#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const REPO_ROOT = path.resolve(ROOT, '..');
const CLEAN_DIR = path.join(ROOT, 'clean');
const DB_DIR = path.join(REPO_ROOT, 'infrastructure', 'database');

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function sqlString(value, maxLength = null) {
  if (value === null || value === undefined || value === '') return 'NULL';
  let text = String(value).replace(/\u0000/g, '');
  if (maxLength && text.length > maxLength) text = text.slice(0, maxLength);
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function exportText(value, maxLength = null) {
  if (value === null || value === undefined) return null;
  let text = String(value)
    .replace(/\u0000/g, '')
    .replace(/\bundefined\b/gi, ' ')
    .replace(/Thu\s+gọn/gi, ' ')
    .replace(/Thu\s+gọn/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (maxLength && text.length > maxLength) text = text.slice(0, maxLength).trim();
  return text;
}

function sqlJson(value) {

  if (value === null || value === undefined) return 'NULL';
  return sqlString(JSON.stringify(value));
}

function sqlNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(fallback);
}

function stableDigits(input, length = 8) {
  const hex = crypto.createHash('sha1').update(String(input || '')).digest('hex');
  let digits = '';
  for (let i = 0; digits.length < length; i += 8) {
    digits += String(parseInt(hex.slice(i, i + 8) || hex, 16));
  }
  return digits.slice(0, length);
}

function mimeType(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function fileName(url, fallback) {
  try {
    const parsed = new URL(url);
    const base = decodeURIComponent(path.basename(parsed.pathname)).replace(/[^\w.\-]+/g, '-');
    return base || fallback;
  } catch {
    return fallback;
  }
}

function chunkRows(rows, size = 150) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

function insertChunks(table, columns, rows, chunkSize = 150) {
  if (!rows.length) return '';
  return chunkRows(rows, chunkSize).map((chunk) => {
    const values = chunk.map((row) => `(${row.join(',')})`).join(',\n');
    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};`;
  }).join('\n\n');
}

function uniqueSku(product, used) {
  const base = String(product.sku || `TS-${stableDigits(product.source_url || product.name)}`).slice(0, 42);
  let sku = base;
  let counter = 2;
  while (used.has(sku)) {
    sku = `${base.slice(0, 42 - String(counter).length - 1)}-${counter}`;
    counter += 1;
  }
  used.add(sku);
  return sku;
}

function exportCatalogProducts() {
  const products = readJsonl(path.join(CLEAN_DIR, 'products.recommended_4000.jsonl'));
  const usedSkus = new Set();
  const productRows = [];
  const unitRows = [];
  const specRows = [];
  const imageRows = [];

  products.forEach((product, index) => {
    const id = index + 1;
    const sku = uniqueSku(product, usedSkus);
    const tags = [
      product.category?.slug,
      product.quality?.status === 'needs_review' ? 'needs-review' : 'clean',
      product.source,
    ].filter(Boolean);
    const gallery = Array.isArray(product.gallery) ? product.gallery.slice(0, 6) : [];
    const description = exportText(product.description, 5000);
    const storage = exportText(product.storage_condition || 'Điều kiện thường', 100);
    const barcode = product.barcode && /^\d{8,14}$/.test(String(product.barcode)) ? product.barcode : null;

    productRows.push([
      id,
      sqlString(sku, 50),
      sqlString(product.name, 300),
      'NULL',
      'NULL',
      sqlNumber(product.category?.id, 1000),
      sqlString(exportText(product.active_ingredient, 2500), 2500),
      sqlString(product.registration_number, 100),
      sqlString(product.manufacturer || product.brand, 300),
      product.requires_prescription ? '1' : '0',
      'NULL',
      sqlString(storage, 100),
      sqlString(product.base_unit || 'Cái', 50),
      sqlNumber(product.estimated_cost_price, 0),
      sqlNumber(product.retail_price, 0),
      '10',
      sqlString(product.image_url, 500),
      sqlString(description, 5000),
      sqlString(product.quality?.status === 'needs_review' ? 'pending_review' : 'active'),
      sqlString(barcode, 100),
      'NOW()',
      'NOW()',
      'NULL',
      sqlJson(tags),
      'NULL',
      '0',
      '0',
      sqlJson(gallery),
    ]);

    unitRows.push([
      id,
      sqlNumber(id),
      sqlString(product.base_unit || 'Cái', 50),
      '1',
      sqlString(product.base_unit || 'Cái', 50),
      sqlNumber(product.retail_price, 0),
      '0',
      sqlString(barcode, 100),
    ]);

    const specs = [
      ['Thành phần', product.sections?.ingredients || product.active_ingredient],
      ['Công dụng/Chỉ định', product.sections?.indications],
      ['Cách dùng', product.sections?.usage],
      ['Lưu ý', product.sections?.warnings],
      ['Bảo quản', product.sections?.storage],
      ['Nguồn dữ liệu', product.source_url],
    ].map(([key, value]) => [key, exportText(value, 5000)]).filter(([, value]) => value);
    specs.forEach(([key, value], specIndex) => {
      specRows.push([
        sqlNumber(id),
        sqlString(key, 150),
        sqlString(value, 5000),
        sqlNumber(specIndex + 1),
      ]);
    });

    gallery.forEach((url, imageIndex) => {
      const fallback = `product-${id}-${imageIndex + 1}.jpg`;
      imageRows.push([
        sqlNumber(id),
        sqlString(fileName(url, fallback), 255),
        sqlString(fileName(url, fallback), 255),
        sqlString(mimeType(url), 100),
        '0',
        sqlString(url, 500),
        sqlString(url, 500),
        sqlString(imageIndex === 0 ? 'main' : 'gallery'),
        sqlString(product.name, 300),
        imageIndex === 0 ? '1' : '0',
        sqlNumber(imageIndex),
        'NULL',
        'NOW()',
        'NOW()',
      ]);
    });
  });

  const sql = [
    '-- Clean catalog product seed generated from crawl-data/clean/products.recommended_4000.jsonl.',
    '-- Generated by crawl-data/export-sql.js. Do not edit rows manually; update clean data and regenerate.',
    '',
    'USE mg_catalog;',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    'TRUNCATE TABLE product_images;',
    'TRUNCATE TABLE product_specifications;',
    'TRUNCATE TABLE product_units;',
    'TRUNCATE TABLE products;',
    '',
    insertChunks('products', [
      'id', 'sku', 'name', 'strength', 'route_of_administration', 'category_id',
      'active_ingredient', 'registration_number', 'manufacturer', 'requires_prescription',
      'special_control_group', 'storage_condition', 'base_unit', 'cost_price', 'retail_price',
      'min_stock_alert', 'image_url', 'description', 'status', 'barcode', 'created_at',
      'updated_at', 'brand_id', 'tags', 'country_of_origin', 'is_exclusive', 'sales_volume', 'gallery',
    ], productRows, 120),
    '',
    insertChunks('product_units', [
      'id', 'product_id', 'unit_name', 'conversion_qty', 'of_unit', 'retail_price', 'sort_order', 'barcode',
    ], unitRows, 250),
    '',
    insertChunks('product_specifications', [
      'product_id', 'spec_key', 'spec_value', 'sort_order',
    ], specRows, 120),
    '',
    insertChunks('product_images', [
      'product_id', 'file_name', 'original_name', 'mime_type', 'file_size', 'storage_path',
      'public_url', 'image_role', 'alt_text', 'is_primary', 'sort_order', 'uploaded_by', 'created_at', 'updated_at',
    ], imageRows, 120),
    '',
    'SET FOREIGN_KEY_CHECKS = 1;',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(DB_DIR, '11_seed_clean_catalog_products.sql'), sql, 'utf8');
}

function exportCmsContent() {
  const rows = [
    ...readJsonl(path.join(CLEAN_DIR, 'articles.clean.jsonl')),
    ...readJsonl(path.join(CLEAN_DIR, 'diseases.clean.jsonl')),
  ];
  const articleRows = rows.map((article, index) => {
    const id = index + 1;
    const tags = Array.isArray(article.tags) ? article.tags : [];
    const content = exportText(article.content_sanitized || article.content_text, 20000);
    const excerpt = exportText(article.excerpt, 1000);
    return [
      id,
      sqlString(article.title, 400),
      sqlString(article.slug, 450),
      sqlString(content, null),
      sqlString(excerpt, 1000),
      sqlString(article.thumbnail_url, 500),
      sqlNumber(article.category?.id, 1),
      'NULL',
      sqlJson(tags),
      sqlString('published'),
      'NOW()',
      stableDigits(article.slug, 4),
      'NOW()',
      'NOW()',
      sqlString(content, null),
      'NOW()',
    ];
  });

  const sql = [
    '-- Clean CMS article and disease seed generated from crawl-data/clean.',
    '-- Generated by crawl-data/export-sql.js. Do not edit rows manually; update clean data and regenerate.',
    '',
    'USE mg_cms;',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    'TRUNCATE TABLE articles;',
    '',
    insertChunks('articles', [
      'id', 'title', 'slug', 'content', 'excerpt', 'thumbnail_url', 'category_id',
      'author_id', 'tags', 'status', 'published_at', 'view_count', 'created_at',
      'updated_at', 'content_sanitized', 'sanitized_at',
    ], articleRows, 40),
    '',
    'SET FOREIGN_KEY_CHECKS = 1;',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(DB_DIR, '12_seed_clean_cms_content.sql'), sql, 'utf8');
}

exportCatalogProducts();
exportCmsContent();

console.log('Generated:');
console.log(path.relative(REPO_ROOT, path.join(DB_DIR, '11_seed_clean_catalog_products.sql')));
console.log(path.relative(REPO_ROOT, path.join(DB_DIR, '12_seed_clean_cms_content.sql')));
