-- Minh Giang clean baseline seed.
-- Consolidated from: 100_seed_phase1_catalog_quality_cleanup.sql, 102_seed_product_sale_units.sql, 107_seed_notifications.sql, 109_seed_brand_media_cleanup.sql
-- Purpose: Setup a clean baseline store with products and articles template, but empty inventory, customers, and orders.

-- =============================================================================
-- Source: 100_seed_phase1_catalog_quality_cleanup.sql
-- =============================================================================

-- Phase 1 catalog quality cleanup.
-- Purpose: keep the 4000-product catalog, but make it presentation-ready for Minh Giang.
-- Idempotent: safe to run after 11_seed_clean_catalog_products.sql and 12_seed_clean_cms_content.sql.

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


-- =============================================================================
-- Source: 102_seed_product_sale_units.sql
-- =============================================================================

-- Phase 3 product sale-unit seed.
-- Keeps one base sale unit per product, separates unit barcodes from product barcodes,
-- and adds realistic multi-unit packs for POS barcode/unit switching demos.

USE mg_catalog;
SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase3_product_sale_units $$
CREATE PROCEDURE seed_phase3_product_sale_units()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM product_units WHERE barcode LIKE 'PH3-U-%') THEN
    START TRANSACTION;

    UPDATE product_units u
    JOIN products p ON p.id = u.product_id
    SET
      u.of_unit = p.base_unit,
      u.conversion_qty = 1,
      u.retail_price = p.retail_price,
      u.sort_order = 0,
      u.barcode = CONCAT('PH3-U-', LPAD(p.id, 6, '0'), '-BASE')
    WHERE u.product_id = p.id;

    INSERT INTO product_units (
      product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order, barcode
    )
    SELECT
      p.id,
      CASE
        WHEN p.base_unit IN ('Viên', 'Vỉ') THEN 'Hộp'
        WHEN p.base_unit IN ('Hộp', 'Bịch', 'Gói', 'Lọ', 'Chai', 'Tuýp', 'Tube', 'Cái') THEN 'Lốc'
        WHEN p.base_unit IN ('Lon') THEN 'Thùng'
        ELSE 'Bộ'
      END AS unit_name,
      CASE
        WHEN p.base_unit = 'Viên' THEN 30
        WHEN p.base_unit = 'Vỉ' THEN 3
        WHEN p.base_unit IN ('Hộp', 'Bịch', 'Gói', 'Lọ', 'Chai', 'Tuýp', 'Tube', 'Cái') THEN 6
        WHEN p.base_unit = 'Lon' THEN 24
        ELSE 5
      END AS conversion_qty,
      p.base_unit,
      ROUND(
        p.retail_price *
        CASE
          WHEN p.base_unit = 'Viên' THEN 30
          WHEN p.base_unit = 'Vỉ' THEN 3
          WHEN p.base_unit IN ('Hộp', 'Bịch', 'Gói', 'Lọ', 'Chai', 'Tuýp', 'Tube', 'Cái') THEN 6
          WHEN p.base_unit = 'Lon' THEN 24
          ELSE 5
        END *
        0.97,
        -2
      ) AS retail_price,
      10 AS sort_order,
      CONCAT('PH3-U-', LPAD(p.id, 6, '0'), '-P01') AS barcode
    FROM products p
    WHERE p.status = 'active'
      AND MOD(p.id, 5) IN (0, 1)
      AND NOT EXISTS (
        SELECT 1
        FROM product_units existing
        WHERE existing.product_id = p.id
          AND existing.barcode = CONCAT('PH3-U-', LPAD(p.id, 6, '0'), '-P01')
      );

    INSERT INTO product_units (
      product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order, barcode
    )
    SELECT
      p.id,
      CASE
        WHEN p.base_unit = 'Viên' THEN 'Vỉ'
        WHEN p.base_unit = 'Vỉ' THEN 'Hộp lớn'
        WHEN p.base_unit IN ('Hộp', 'Bịch', 'Gói', 'Lọ', 'Chai', 'Tuýp', 'Tube', 'Cái') THEN 'Thùng'
        WHEN p.base_unit = 'Lon' THEN 'Kiện'
        ELSE 'Combo'
      END AS unit_name,
      CASE
        WHEN p.base_unit = 'Viên' THEN 10
        WHEN p.base_unit = 'Vỉ' THEN 10
        WHEN p.base_unit IN ('Hộp', 'Bịch', 'Gói', 'Lọ', 'Chai', 'Tuýp', 'Tube', 'Cái') THEN 12
        WHEN p.base_unit = 'Lon' THEN 48
        ELSE 10
      END AS conversion_qty,
      p.base_unit,
      ROUND(
        p.retail_price *
        CASE
          WHEN p.base_unit = 'Viên' THEN 10
          WHEN p.base_unit = 'Vỉ' THEN 10
          WHEN p.base_unit IN ('Hộp', 'Bịch', 'Gói', 'Lọ', 'Chai', 'Tuýp', 'Tube', 'Cái') THEN 12
          WHEN p.base_unit = 'Lon' THEN 48
          ELSE 10
        END *
        0.94,
        -2
      ) AS retail_price,
      20 AS sort_order,
      CONCAT('PH3-U-', LPAD(p.id, 6, '0'), '-P02') AS barcode
    FROM products p
    WHERE p.status = 'active'
      AND MOD(p.id, 5) = 0
      AND NOT EXISTS (
        SELECT 1
        FROM product_units existing
        WHERE existing.product_id = p.id
          AND existing.barcode = CONCAT('PH3-U-', LPAD(p.id, 6, '0'), '-P02')
      );

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase3_product_sale_units();
DROP PROCEDURE IF EXISTS seed_phase3_product_sale_units;


-- =============================================================================
-- Source: 107_seed_notifications.sql
-- =============================================================================

-- Phase 8 notification seed.
-- Adds templates and realistic notification records for orders, prescriptions, returns and inventory alerts.

USE mg_notification;
SET NAMES utf8mb4;
SET @PH8_OLD_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = '';

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase8_notifications $$
CREATE PROCEDURE seed_phase8_notifications()
BEGIN
  INSERT INTO notification_templates (name, channel, subject, body_template, is_active)
  VALUES
    ('order_status_update', 'sms', NULL, 'Minh Giang Pharmacy: Don {{order_code}} dang o trang thai {{order_status}}. Ho tro: 918 An Duong Vuong, Hoa Binh.', 1),
    ('order_status_update', 'email', 'Cap nhat don hang {{order_code}}', 'Xin chao {{customer_name}}, don hang {{order_code}} cua ban dang o trang thai {{order_status}}. Nha thuoc Minh Giang - 918 An Duong Vuong, Hoa Binh.', 1),
    ('delivery_eta', 'zalo', 'Lich giao don {{order_code}}', 'Don {{order_code}} se duoc giao trong khu vuc Hoa Binh, khoang cach {{distance_km}}km tu 918 An Duong Vuong.', 1),
    ('prescription_status', 'sms', NULL, 'Minh Giang Pharmacy: Toa {{prescription_code}} dang o trang thai {{prescription_status}}.', 1),
    ('prescription_status', 'in_app', 'Trang thai toa thuoc', 'Toa {{prescription_code}}: {{prescription_status}}. Vui long theo doi huong dan cua duoc si.', 1),
    ('return_status_update', 'sms', NULL, 'Minh Giang Pharmacy: Yeu cau doi/tra {{return_code}} dang o trang thai {{return_status}}.', 1),
    ('return_status_update', 'email', 'Cap nhat doi/tra {{return_code}}', 'Yeu cau doi/tra {{return_code}} cua ban dang o trang thai {{return_status}}, so tien hoan du kien {{refund_amount}} VND.', 1),
    ('staff_pending_order', 'in_app', 'Don hang can xu ly', 'Don {{order_code}} can nhan vien xu ly: {{order_status}}.', 1),
    ('staff_rx_review', 'in_app', 'Toa thuoc can duyet', 'Toa {{prescription_code}} cua khach {{customer_name}} can duoc duoc si kiem tra.', 1),
    ('inventory_attention', 'in_app', 'Can kiem tra ton kho', 'San pham {{product_name}} tai lo {{lot_number}} can kiem tra: {{inventory_status}}.', 1)
  ON DUPLICATE KEY UPDATE
    subject = VALUES(subject),
    body_template = VALUES(body_template),
    is_active = VALUES(is_active);
END $$

DELIMITER ;

CALL seed_phase8_notifications();
DROP PROCEDURE IF EXISTS seed_phase8_notifications;

SET SQL_MODE = @PH8_OLD_SQL_MODE;


-- =============================================================================
-- Source: 109_seed_brand_media_cleanup.sql
-- =============================================================================

-- Phase 11 brand/media/source cleanup.
-- Removes external source traces from visible media metadata and normalizes Minh Giang catalog identity.

SET NAMES utf8mb4;
SET @PH11_OLD_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = '';

DELIMITER $$

DROP PROCEDURE IF EXISTS mg_catalog.seed_phase11_brand_media_cleanup $$
CREATE PROCEDURE mg_catalog.seed_phase11_brand_media_cleanup()
BEGIN
  START TRANSACTION;

  UPDATE mg_catalog.products p
  LEFT JOIN mg_catalog.categories c ON c.id = p.category_id
  SET
    p.sku = CONCAT('MG-', LPAD(p.id, 6, '0')),
    p.manufacturer = CASE
      WHEN p.manufacturer IS NULL
        OR p.manufacturer = ''
        OR p.manufacturer LIKE '%đang cập nhật%'
        OR p.manufacturer LIKE '%dang cap nhat%'
      THEN
        CASE
          WHEN p.requires_prescription = 1
            OR c.name LIKE '%Thuốc%'
            OR c.name LIKE '%Dạ dày%'
            OR c.name LIKE '%kháng%'
            OR c.name LIKE '%viêm%'
          THEN ELT(1 + MOD(p.id, 8),
            'Công ty Cổ phần Dược Hậu Giang',
            'Công ty Cổ phần Traphaco',
            'Công ty Cổ phần Dược phẩm Imexpharm',
            'Công ty Cổ phần Pymepharco',
            'Công ty Cổ phần Dược phẩm OPC',
            'Công ty Cổ phần Dược phẩm Bidiphar',
            'Công ty Cổ phần Xuất nhập khẩu Y tế Domesco',
            'Công ty Cổ phần Dược phẩm Mekophar'
          )
          WHEN c.name LIKE '%Thiết bị%'
            OR c.name LIKE '%Y tế%'
            OR c.name LIKE '%Đai%'
            OR c.name LIKE '%nẹp%'
            OR c.name LIKE '%Gạc%'
            OR c.name LIKE '%Que thử%'
          THEN ELT(1 + MOD(p.id, 5),
            'Công ty Cổ phần Merufa',
            'Microlife Corporation',
            'Công ty TNHH Y tế Hưng Việt',
            'Công ty Cổ phần Thiết bị Y tế Vinahankook',
            'Công ty TNHH Trang thiết bị Y tế An Phát'
          )
          ELSE ELT(1 + MOD(p.id, 8),
            'Công ty Cổ phần Sao Thái Dương',
            'Công ty Cổ phần Dược phẩm Hoa Linh',
            'Công ty Cổ phần Dược phẩm Quốc tế Abipha',
            'Công ty Cổ phần Dược phẩm Nam Hà',
            'Công ty TNHH Dược phẩm Ích Nhân',
            'Công ty Cổ phần Dược phẩm Hà Tây',
            'Công ty Cổ phần Dược phẩm Mediplantex',
            'Công ty Cổ phần Dược phẩm Trung Ương 3'
          )
        END
      ELSE p.manufacturer
    END,
    p.updated_at = NOW()
  WHERE p.sku LIKE 'TS-%'
     OR p.manufacturer IS NULL
     OR p.manufacturer = ''
     OR p.manufacturer LIKE '%đang cập nhật%'
     OR p.manufacturer LIKE '%dang cap nhat%';

  UPDATE mg_catalog.products p
  LEFT JOIN mg_catalog.categories c ON c.id = p.category_id
  SET p.manufacturer = CASE
    WHEN UPPER(TRIM(p.manufacturer)) IN (
      'CTY',
      'CTY CP',
      'CTY CP DƯỢC',
      'CTY CP DƯỢC PHẨM',
      'CTY CP TẬP',
      'CTY CỔ PHẦN TẬP',
      'CÔNG TY CỔ PHẦN TẬP'
    ) THEN
      CASE
        WHEN p.requires_prescription = 1
          OR c.name LIKE '%Thuốc%'
          OR c.name LIKE '%Dạ dày%'
          OR c.name LIKE '%kháng%'
          OR c.name LIKE '%viêm%'
        THEN ELT(1 + MOD(p.id, 8),
          'Công ty Cổ phần Dược Hậu Giang',
          'Công ty Cổ phần Traphaco',
          'Công ty Cổ phần Dược phẩm Imexpharm',
          'Công ty Cổ phần Pymepharco',
          'Công ty Cổ phần Dược phẩm OPC',
          'Công ty Cổ phần Dược phẩm Bidiphar',
          'Công ty Cổ phần Xuất nhập khẩu Y tế Domesco',
          'Công ty Cổ phần Dược phẩm Mekophar'
        )
        ELSE ELT(1 + MOD(p.id, 8),
          'Công ty Cổ phần Sao Thái Dương',
          'Công ty Cổ phần Dược phẩm Hoa Linh',
          'Công ty Cổ phần Dược phẩm Quốc tế Abipha',
          'Công ty Cổ phần Dược phẩm Nam Hà',
          'Công ty TNHH Dược phẩm Ích Nhân',
          'Công ty Cổ phần Dược phẩm Hà Tây',
          'Công ty Cổ phần Dược phẩm Mediplantex',
          'Công ty Cổ phần Dược phẩm Trung Ương 3'
        )
      END
    WHEN UPPER(TRIM(p.manufacturer)) LIKE 'CTY%' THEN TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(p.manufacturer, 'CTY', 'Công ty'),
              ' CP ', ' Cổ phần '
            ),
            ' CP', ' Cổ phần'
          ),
          ' DP ', ' Dược phẩm '
        ),
        ' DUOC PHAM ', ' Dược phẩm '
      )
    )
    WHEN UPPER(TRIM(p.manufacturer)) = 'STELLA' THEN 'Công ty TNHH Liên doanh Stellapharm'
    WHEN UPPER(TRIM(p.manufacturer)) = 'DAVI' THEN 'Công ty Cổ phần Dược phẩm Davipharm'
    WHEN UPPER(TRIM(p.manufacturer)) = 'DHG' THEN 'Công ty Cổ phần Dược Hậu Giang'
    WHEN UPPER(TRIM(p.manufacturer)) = 'OPC' THEN 'Công ty Cổ phần Dược phẩm OPC'
    WHEN UPPER(TRIM(p.manufacturer)) = 'GSK' THEN 'GlaxoSmithKline'
    WHEN UPPER(TRIM(p.manufacturer)) = 'BAYER' THEN 'Bayer AG'
    WHEN UPPER(TRIM(p.manufacturer)) = 'MERCK' THEN 'Merck KGaA'
    WHEN UPPER(TRIM(p.manufacturer)) = 'MEKOPHAR' THEN 'Công ty Cổ phần Dược phẩm Mekophar'
    WHEN UPPER(TRIM(p.manufacturer)) = 'BIDIPHAR' THEN 'Công ty Cổ phần Dược phẩm Bidiphar'
    WHEN UPPER(TRIM(p.manufacturer)) = 'DANAPHA' THEN 'Công ty Cổ phần Dược Danapha'
    WHEN UPPER(TRIM(p.manufacturer)) = 'DOMESCO' THEN 'Công ty Cổ phần Xuất nhập khẩu Y tế Domesco'
    WHEN UPPER(TRIM(p.manufacturer)) = 'TRAPHACO' THEN 'Công ty Cổ phần Traphaco'
    WHEN UPPER(TRIM(p.manufacturer)) = 'SANOFI' THEN 'Sanofi'
    WHEN UPPER(TRIM(p.manufacturer)) = 'PFIZER' THEN 'Pfizer'
    WHEN UPPER(TRIM(p.manufacturer)) IN (
      'CÔNG TY CỔ PHẦN DƯỢC',
      'CÔNG TY CỔ PHẦN',
      'CÔNG TY CP DƯỢC',
      'CÔNG TY',
      'CÔNG',
      'DƯỢC',
      'VIỆT',
      'NHẬT',
      'TRUNG',
      'THÁI',
      'PHIL'
    ) THEN
      CASE
        WHEN p.requires_prescription = 1
          OR c.name LIKE '%Thuốc%'
          OR c.name LIKE '%Dạ dày%'
          OR c.name LIKE '%kháng%'
          OR c.name LIKE '%viêm%'
        THEN ELT(1 + MOD(p.id, 8),
          'Công ty Cổ phần Dược Hậu Giang',
          'Công ty Cổ phần Traphaco',
          'Công ty Cổ phần Dược phẩm Imexpharm',
          'Công ty Cổ phần Pymepharco',
          'Công ty Cổ phần Dược phẩm OPC',
          'Công ty Cổ phần Dược phẩm Bidiphar',
          'Công ty Cổ phần Xuất nhập khẩu Y tế Domesco',
          'Công ty Cổ phần Dược phẩm Mekophar'
        )
        WHEN c.name LIKE '%Thiết bị%'
          OR c.name LIKE '%Y tế%'
          OR c.name LIKE '%Đai%'
          OR c.name LIKE '%nẹp%'
          OR c.name LIKE '%Gạc%'
          OR c.name LIKE '%Que thử%'
        THEN ELT(1 + MOD(p.id, 5),
          'Công ty Cổ phần Merufa',
          'Microlife Corporation',
          'Công ty TNHH Y tế Hưng Việt',
          'Công ty Cổ phần Thiết bị Y tế Vinahankook',
          'Công ty TNHH Trang thiết bị Y tế An Phát'
        )
        ELSE ELT(1 + MOD(p.id, 8),
          'Công ty Cổ phần Sao Thái Dương',
          'Công ty Cổ phần Dược phẩm Hoa Linh',
          'Công ty Cổ phần Dược phẩm Quốc tế Abipha',
          'Công ty Cổ phần Dược phẩm Nam Hà',
          'Công ty TNHH Dược phẩm Ích Nhân',
          'Công ty Cổ phần Dược phẩm Hà Tây',
          'Công ty Cổ phần Dược phẩm Mediplantex',
          'Công ty Cổ phần Dược phẩm Trung Ương 3'
        )
      END
    ELSE p.manufacturer
  END,
  p.updated_at = NOW()
  WHERE UPPER(TRIM(p.manufacturer)) IN (
    'STELLA',
    'DAVI',
    'DHG',
    'OPC',
    'GSK',
    'BAYER',
    'MERCK',
    'MEKOPHAR',
    'BIDIPHAR',
    'DANAPHA',
    'DOMESCO',
    'TRAPHACO',
    'SANOFI',
    'PFIZER',
    'CTY',
    'CTY CP',
    'CTY CP DƯỢC',
    'CTY CP DƯỢC PHẨM',
    'CTY CP TẬP',
    'CTY CỔ PHẦN TẬP',
    'CÔNG TY CỔ PHẦN TẬP',
    'CÔNG TY CỔ PHẦN DƯỢC',
    'CÔNG TY CỔ PHẦN',
    'CÔNG TY CP DƯỢC',
    'CÔNG TY',
    'CÔNG',
    'DƯỢC',
    'VIỆT',
    'NHẬT',
    'TRUNG',
    'THÁI',
    'PHIL'
  )
  OR UPPER(TRIM(p.manufacturer)) LIKE 'CTY%';

  DELETE FROM mg_catalog.product_specifications
  WHERE spec_key = 'Nguồn dữ liệu'
     OR spec_value LIKE '%trungsoncare.com%';

  UPDATE mg_cms.articles
  SET
    thumbnail_url = CONCAT('/uploads/cms/articles/minh-giang-article-', LPAD(id, 4, '0'), '.webp'),
    title = REPLACE(REPLACE(REPLACE(REPLACE(title,
      'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
      'Trung Sơn', 'Minh Giang'),
      'Trung Son Pharma', 'Minh Giang Pharmacy'),
      'Trung Son', 'Minh Giang'),
    excerpt = REPLACE(REPLACE(REPLACE(REPLACE(excerpt,
      'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
      'Trung Sơn', 'Minh Giang'),
      'Trung Son Pharma', 'Minh Giang Pharmacy'),
      'Trung Son', 'Minh Giang'),
    content = REPLACE(REPLACE(REPLACE(REPLACE(content,
      'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
      'Trung Sơn', 'Minh Giang'),
      'Trung Son Pharma', 'Minh Giang Pharmacy'),
      'Trung Son', 'Minh Giang'),
    content_sanitized = REPLACE(REPLACE(REPLACE(REPLACE(content_sanitized,
      'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
      'Trung Sơn', 'Minh Giang'),
      'Trung Son Pharma', 'Minh Giang Pharmacy'),
      'Trung Son', 'Minh Giang'),
    updated_at = NOW()
  WHERE thumbnail_url LIKE '%trungsoncare.com%'
     OR title LIKE '%Trung Sơn%'
     OR title LIKE '%Trung Son%'
     OR content LIKE '%Trung Sơn%'
     OR content LIKE '%Trung Son%'
     OR excerpt LIKE '%Trung Sơn%'
     OR excerpt LIKE '%Trung Son%'
     OR content_sanitized LIKE '%Trung Sơn%'
     OR content_sanitized LIKE '%Trung Son%';

  COMMIT;
END $$

DELIMITER ;

CALL mg_catalog.seed_phase11_brand_media_cleanup();
DROP PROCEDURE IF EXISTS mg_catalog.seed_phase11_brand_media_cleanup;
SET SQL_MODE = @PH11_OLD_SQL_MODE;

-- =============================================================================
-- DỌN DẸP SẠCH TOÀN BỘ GIAO DỊCH, LÔ HÀNG VÀ DỮ LIỆU ĐỘNG (RESET DB VỀ TRẮNG)
-- =============================================================================
USE mg_catalog;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE stock_movements;
TRUNCATE TABLE batch_items;
TRUNCATE TABLE batches;
SET FOREIGN_KEY_CHECKS = 1;

USE mg_order;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE order_items;
TRUNCATE TABLE orders;
TRUNCATE TABLE cart_items;
TRUNCATE TABLE carts;
TRUNCATE TABLE return_items;
TRUNCATE TABLE returns;
TRUNCATE TABLE prescriptions;
SET FOREIGN_KEY_CHECKS = 1;

USE mg_identity;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE loyalty_points_transactions;
TRUNCATE TABLE customer_addresses;
TRUNCATE TABLE customers;
TRUNCATE TABLE refresh_tokens;
TRUNCATE TABLE otp_codes;
SET FOREIGN_KEY_CHECKS = 1;

USE mg_notification;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE notifications;
SET FOREIGN_KEY_CHECKS = 1;

USE mg_catalog;
UPDATE suppliers SET total_purchase_value = 0.00, current_debt = 0.00;

-- Dọn dẹp bảng khuyến mãi tags và hoàn tác tag sản phẩm về mặc định cho chế độ SẠCH
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE product_tag_promotions;
SET FOREIGN_KEY_CHECKS = 1;

UPDATE `products` SET `tags` = JSON_ARRAY('y-te-may-do-duong-huyet', 'clean', 'source-review') WHERE `id` = 1;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-may-xong', 'clean', 'source-review') WHERE `id` = 2;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-ho-tro-khac', 'clean', 'source-review') WHERE `id` = 3;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-gia-dinh', 'clean', 'source-review') WHERE `id` = 5;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-khu-trung', 'clean', 'source-review') WHERE `id` = 6;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-bom-kim-tiem', 'clean', 'source-review') WHERE `id` = 7;
UPDATE `products` SET `tags` = JSON_ARRAY('sinh-ly-bao-cao-su', 'clean', 'source-review') WHERE `id` = 8;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-bang-gac', 'clean', 'source-review') WHERE `id` = 9;
UPDATE `products` SET `tags` = JSON_ARRAY('tpcn-ho-tro-chuc-nang-gan', 'clean', 'source-review') WHERE `id` = 10;
UPDATE `products` SET `tags` = JSON_ARRAY('thuoc-tang-tuan-hoan-nao', 'clean', 'source-review') WHERE `id` = 11;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-dai-nep', 'clean', 'source-review') WHERE `id` = 12;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-xe-lan', 'clean', 'source-review') WHERE `id` = 13;
UPDATE `products` SET `tags` = JSON_ARRAY('thuoc-nhuan-trang-tao-bon', 'clean', 'source-review') WHERE `id` = 14;
UPDATE `products` SET `tags` = JSON_ARRAY('ve-sinh-dung-dich', 'clean', 'source-review') WHERE `id` = 15;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-may-do-huyet-ap', 'clean', 'source-review') WHERE `id` = 16;
UPDATE `products` SET `tags` = JSON_ARRAY('rang-mieng-chi-nha-khoa', 'clean', 'source-review') WHERE `id` = 17;
UPDATE `products` SET `tags` = JSON_ARRAY('thuoc-viem-khop-thoai-hoa', 'clean', 'source-review') WHERE `id` = 18;
UPDATE `products` SET `tags` = JSON_ARRAY('my-pham-su-tam', 'clean', 'source-review') WHERE `id` = 20;
UPDATE `products` SET `tags` = JSON_ARRAY('ve-sinh-tai-mui-hong', 'clean', 'source-review') WHERE `id` = 21;
UPDATE `products` SET `tags` = JSON_ARRAY('dung-cu-phau-thuat', 'clean', 'source-review') WHERE `id` = 22;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-gay-chong', 'clean', 'source-review') WHERE `id` = 23;
UPDATE `products` SET `tags` = JSON_ARRAY('my-pham-su-rua-mat', 'clean', 'source-review') WHERE `id` = 24;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-giam-dau-ha-sot', 'clean', 'source-review') WHERE `id` = 25;
UPDATE `products` SET `tags` = JSON_ARRAY('thuoc', 'clean', 'source-review') WHERE `id` = 28;
UPDATE `products` SET `tags` = JSON_ARRAY('y-te-chong-loet', 'clean', 'source-review') WHERE `id` = 30;



