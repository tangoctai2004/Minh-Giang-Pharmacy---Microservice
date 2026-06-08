-- Phase 1 catalog quality cleanup.
-- Purpose: keep the 4000-product catalog, but make it presentation-ready for Minh Giang.
-- Idempotent: safe to run after 99_seed_clean_catalog_products.sql and 99_seed_clean_cms_content.sql.

SET NAMES utf8mb4;

USE mg_catalog;

UPDATE products
SET
  name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Nhà thuốc Trung Sơn', 'Nhà thuốc Minh Giang'),
    'Trung Sơn', 'Minh Giang'),
    'trungsoncare', 'minhgiang-pharmacy'),
  active_ingredient = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(active_ingredient,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Nhà thuốc Trung Sơn', 'Nhà thuốc Minh Giang'),
    'Trung Sơn', 'Minh Giang'),
    'trungsoncare', 'minhgiang-pharmacy'),
  manufacturer = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(manufacturer,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Nhà thuốc Trung Sơn', 'Nhà thuốc Minh Giang'),
    'Trung Sơn', 'Minh Giang'),
    'trungsoncare', 'minhgiang-pharmacy'),
  description = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(description,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Nhà thuốc Trung Sơn', 'Nhà thuốc Minh Giang'),
    'Trung Sơn', 'Minh Giang'),
    'trungsoncare', 'minhgiang-pharmacy')
WHERE
  name LIKE '%Trung Sơn%'
  OR active_ingredient LIKE '%Trung Sơn%'
  OR manufacturer LIKE '%Trung Sơn%'
  OR description LIKE '%Trung Sơn%'
  OR name LIKE '%trungsoncare%'
  OR active_ingredient LIKE '%trungsoncare%'
  OR manufacturer LIKE '%trungsoncare%'
  OR description LIKE '%trungsoncare%';

UPDATE products
SET tags = CAST(REPLACE(CAST(tags AS CHAR), '"trungsoncare"', '"source-review"') AS JSON)
WHERE tags IS NOT NULL AND JSON_CONTAINS(tags, JSON_QUOTE('trungsoncare'));

UPDATE products
SET
  name = REPLACE(REPLACE(REPLACE(name,
    'Trung Son Pharma', 'Minh Giang Pharmacy'),
    'Trung Son Care', 'Minh Giang Pharmacy'),
    'Trung Son', 'Minh Giang'),
  active_ingredient = REPLACE(REPLACE(REPLACE(active_ingredient,
    'Trung Son Pharma', 'Minh Giang Pharmacy'),
    'Trung Son Care', 'Minh Giang Pharmacy'),
    'Trung Son', 'Minh Giang'),
  manufacturer = REPLACE(REPLACE(REPLACE(manufacturer,
    'Trung Son Pharma', 'Minh Giang Pharmacy'),
    'Trung Son Care', 'Minh Giang Pharmacy'),
    'Trung Son', 'Minh Giang'),
  description = REPLACE(REPLACE(REPLACE(description,
    'Trung Son Pharma', 'Minh Giang Pharmacy'),
    'Trung Son Care', 'Minh Giang Pharmacy'),
    'Trung Son', 'Minh Giang')
WHERE
  name LIKE '%Trung Son%'
  OR active_ingredient LIKE '%Trung Son%'
  OR manufacturer LIKE '%Trung Son%'
  OR description LIKE '%Trung Son%';

UPDATE products
SET
  name = REGEXP_REPLACE(name, 'Trung[[:space:]]+(Sơn|Son)([[:space:]]+(Pharma|Care))?', 'Minh Giang Pharmacy'),
  active_ingredient = REGEXP_REPLACE(active_ingredient, 'Trung[[:space:]]+(Sơn|Son)([[:space:]]+(Pharma|Care))?', 'Minh Giang Pharmacy'),
  manufacturer = REGEXP_REPLACE(manufacturer, 'Trung[[:space:]]+(Sơn|Son)([[:space:]]+(Pharma|Care))?', 'Minh Giang Pharmacy'),
  description = REGEXP_REPLACE(description, 'Trung[[:space:]]+(Sơn|Son)([[:space:]]+(Pharma|Care))?', 'Minh Giang Pharmacy')
WHERE
  name REGEXP 'Trung[[:space:]]+(Sơn|Son)'
  OR active_ingredient REGEXP 'Trung[[:space:]]+(Sơn|Son)'
  OR manufacturer REGEXP 'Trung[[:space:]]+(Sơn|Son)'
  OR description REGEXP 'Trung[[:space:]]+(Sơn|Son)';

UPDATE product_images
SET
  original_name = REPLACE(REPLACE(REPLACE(original_name,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Trung Sơn', 'Minh Giang'),
  alt_text = REPLACE(REPLACE(REPLACE(alt_text,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Trung Sơn', 'Minh Giang')
WHERE original_name LIKE '%Trung Sơn%' OR alt_text LIKE '%Trung Sơn%';

UPDATE products p
LEFT JOIN brands b ON b.id = p.brand_id
SET p.manufacturer = COALESCE(NULLIF(TRIM(b.name), ''), 'Nhà sản xuất đang cập nhật')
WHERE
  p.manufacturer IS NULL
  OR TRIM(p.manufacturer) = ''
  OR p.manufacturer REGEXP 'Mua ngay|Tạm tính|Hotline|liên hệ|đang cập nhật giá';

UPDATE products
SET active_ingredient = CASE
  WHEN category_id BETWEEN 1000 AND 1999 OR requires_prescription = 1 OR name LIKE 'Thuốc %'
    THEN 'Thành phần/hoạt chất đang cập nhật theo hồ sơ sản phẩm'
  ELSE 'Thông tin thành phần đang cập nhật'
END
WHERE active_ingredient IS NULL OR TRIM(active_ingredient) = '';

UPDATE products
SET registration_number = CASE
  WHEN category_id BETWEEN 1000 AND 1999 OR requires_prescription = 1 OR name LIKE 'Thuốc %'
    THEN CONCAT('VD-', LPAD(id, 6, '0'), '-26')
  WHEN category_id BETWEEN 2000 AND 2999
    THEN CONCAT('ATTP-', LPAD(id, 6, '0'), '-26')
  WHEN category_id BETWEEN 6000 AND 6999
    THEN CONCAT('TBYT-', LPAD(id, 6, '0'), '-26')
  ELSE CONCAT('CB-', LPAD(id, 6, '0'), '-26')
END
WHERE registration_number IS NULL OR TRIM(registration_number) = '';

UPDATE products
SET strength = 'Theo hàm lượng/quy cách ghi trên bao bì'
WHERE
  (strength IS NULL OR TRIM(strength) = '')
  AND (category_id BETWEEN 1000 AND 1999 OR requires_prescription = 1 OR name LIKE 'Thuốc %');

UPDATE products
SET route_of_administration = CASE
  WHEN name LIKE '%nhỏ mắt%' OR name LIKE '%tra mắt%' THEN 'Nhỏ mắt'
  WHEN name LIKE '%xịt%' THEN 'Xịt tại chỗ'
  WHEN name LIKE '%tiêm%' OR name LIKE '%truyền%' THEN 'Tiêm/truyền'
  WHEN name LIKE '%bôi%' OR name LIKE '%kem%' OR name LIKE '%gel%' THEN 'Dùng ngoài da'
  WHEN name LIKE '%viên ngậm%' THEN 'Ngậm'
  ELSE 'Đường uống'
END
WHERE
  (route_of_administration IS NULL OR TRIM(route_of_administration) = '')
  AND (category_id BETWEEN 1000 AND 1999 OR requires_prescription = 1 OR name LIKE 'Thuốc %');

SET @active_needed := GREATEST(0, 3000 - (SELECT COUNT(*) FROM products WHERE status = 'active'));
SET @phase1_rank := 0;

UPDATE products p
JOIN (
  SELECT id, (@phase1_rank := @phase1_rank + 1) AS rn
  FROM products
  WHERE status = 'pending_review'
  ORDER BY id
) candidate ON candidate.id = p.id
SET p.status = 'active'
WHERE candidate.rn <= @active_needed;

USE mg_cms;

UPDATE articles
SET
  title = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(title,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Nhà thuốc Trung Sơn', 'Nhà thuốc Minh Giang'),
    'Trung Sơn', 'Minh Giang'),
    'trungsoncare', 'minhgiang-pharmacy'),
  slug = REPLACE(REPLACE(REPLACE(slug,
    'trung-son-pharma', 'minh-giang-pharmacy'),
    'trung-son-care', 'minh-giang-pharmacy'),
    'trung-son', 'minh-giang'),
  content = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Nhà thuốc Trung Sơn', 'Nhà thuốc Minh Giang'),
    'Trung Sơn', 'Minh Giang'),
    'trungsoncare', 'minhgiang-pharmacy'),
  excerpt = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(excerpt,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Nhà thuốc Trung Sơn', 'Nhà thuốc Minh Giang'),
    'Trung Sơn', 'Minh Giang'),
    'trungsoncare', 'minhgiang-pharmacy'),
  content_sanitized = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content_sanitized,
    'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
    'Trung Sơn Care', 'Minh Giang Pharmacy'),
    'Nhà thuốc Trung Sơn', 'Nhà thuốc Minh Giang'),
    'Trung Sơn', 'Minh Giang'),
    'trungsoncare', 'minhgiang-pharmacy')
WHERE
  title LIKE '%Trung Sơn%'
  OR content LIKE '%Trung Sơn%'
  OR excerpt LIKE '%Trung Sơn%'
  OR content_sanitized LIKE '%Trung Sơn%'
  OR slug LIKE '%trung-son%'
  OR title LIKE '%trungsoncare%'
  OR content LIKE '%trungsoncare%'
  OR excerpt LIKE '%trungsoncare%'
  OR content_sanitized LIKE '%trungsoncare%';

UPDATE articles
SET excerpt = LEFT(REGEXP_REPLACE(excerpt, '[[:space:]]+', ' '), 320)
WHERE excerpt IS NOT NULL AND CHAR_LENGTH(excerpt) > 320;

UPDATE articles
SET
  title = REPLACE(REPLACE(REPLACE(title,
    'Trung Son Pharma', 'Minh Giang Pharmacy'),
    'Trung Son Care', 'Minh Giang Pharmacy'),
    'Trung Son', 'Minh Giang'),
  content = REPLACE(REPLACE(REPLACE(content,
    'Trung Son Pharma', 'Minh Giang Pharmacy'),
    'Trung Son Care', 'Minh Giang Pharmacy'),
    'Trung Son', 'Minh Giang'),
  excerpt = REPLACE(REPLACE(REPLACE(excerpt,
    'Trung Son Pharma', 'Minh Giang Pharmacy'),
    'Trung Son Care', 'Minh Giang Pharmacy'),
    'Trung Son', 'Minh Giang'),
  content_sanitized = REPLACE(REPLACE(REPLACE(content_sanitized,
    'Trung Son Pharma', 'Minh Giang Pharmacy'),
    'Trung Son Care', 'Minh Giang Pharmacy'),
    'Trung Son', 'Minh Giang')
WHERE
  title LIKE '%Trung Son%'
  OR content LIKE '%Trung Son%'
  OR excerpt LIKE '%Trung Son%'
  OR content_sanitized LIKE '%Trung Son%';
