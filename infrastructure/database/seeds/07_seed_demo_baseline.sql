-- Minh Giang demo baseline seed.
-- Consolidated from: 100_seed_phase1_catalog_quality_cleanup.sql, 101_seed_inventory_batches.sql, 102_seed_product_sale_units.sql, 103_seed_customers_loyalty.sql, 104_seed_orders.sql, 105_seed_prescriptions.sql, 106_seed_returns_after_sales.sql, 107_seed_notifications.sql, 109_seed_brand_media_cleanup.sql
-- Generated to simplify the main database seed pipeline.

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
-- Source: 101_seed_inventory_batches.sql
-- =============================================================================

-- Phase 2 inventory seed.
-- Builds realistic purchase batches, FEFO batch items, and inbound stock movements.
-- Idempotent guard: if PH2 batches already exist, this file does not create duplicates.

USE mg_catalog;
SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase2_inventory_batches $$
CREATE PROCEDURE seed_phase2_inventory_batches()
BEGIN
  DECLARE batch_no INT DEFAULT 1;
  DECLARE supplier_count INT DEFAULT 0;
  DECLARE location_count INT DEFAULT 0;
  DECLARE supplier_for_batch BIGINT DEFAULT NULL;

  SELECT COUNT(*) INTO supplier_count FROM suppliers WHERE status = 'active';
  SELECT COUNT(*) INTO location_count FROM locations WHERE is_active = 1;

  IF location_count = 0 AND EXISTS (SELECT 1 FROM locations) THEN
    UPDATE locations SET is_active = 1;
    SELECT COUNT(*) INTO location_count FROM locations WHERE is_active = 1;
  END IF;

  IF supplier_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 2 seed requires at least one active supplier.';
  END IF;

  IF location_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 2 seed requires at least one active location.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_code LIKE 'PH2-PO-%') THEN
    START TRANSACTION;

    WHILE batch_no <= 400 DO
      SELECT id INTO supplier_for_batch
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
        FROM suppliers
        WHERE status = 'active'
      ) supplier_rank
      WHERE rn = 1 + MOD(batch_no - 1, supplier_count);

      INSERT INTO batches (
        batch_code, supplier_id, delivery_person, received_date,
        total_amount, paid_amount, status, notes, created_by, invoice_number
      ) VALUES (
        CONCAT('PH2-PO-', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL MOD(batch_no, 7) DAY), '%y%m%d'), '-', LPAD(batch_no, 4, '0')),
        supplier_for_batch,
        ELT(1 + MOD(batch_no, 8),
          'Nguyễn Minh Khang', 'Trần Gia Huy', 'Lê Bảo An', 'Phạm Thanh Bình',
          'Đỗ Hoàng Nam', 'Võ Minh Quân', 'Bùi Quốc Việt', 'Hoàng Anh Tú'
        ),
        DATE_SUB(CURDATE(), INTERVAL MOD(batch_no, 7) DAY),
        0,
        0,
        'completed',
        'Seed Phase 2 - phiếu nhập kho ban đầu cho dữ liệu demo nhà thuốc.',
        1,
        CONCAT('INV-PH2-', LPAD(batch_no, 5, '0'))
      );

      SET batch_no = batch_no + 1;
    END WHILE;

    INSERT INTO batch_items (
      batch_id, product_id, lot_number, manufacture_date, expiry_date,
      quantity_received, quantity_remaining, cost_price, clearance_discount_pct,
      clearance_price, location_id, status
    )
    SELECT
      b.id AS batch_id,
      seeded.product_id,
      CONCAT('LOT-', LPAD(seeded.product_id, 5, '0'), '-', seeded.slot_no, '-', DATE_FORMAT(seeded.expiry_date, '%y%m')) AS lot_number,
      seeded.manufacture_date,
      seeded.expiry_date,
      seeded.quantity_received,
      seeded.quantity_remaining,
      seeded.cost_price,
      CASE WHEN seeded.status = 'near_expiry' THEN 10.00 ELSE 0.00 END AS clearance_discount_pct,
      CASE WHEN seeded.status = 'near_expiry' THEN ROUND(seeded.retail_price * 0.90, -2) ELSE NULL END AS clearance_price,
      loc.id AS location_id,
      seeded.status
    FROM (
      SELECT
        expanded.product_id,
        expanded.retail_price,
        expanded.cost_price,
        expanded.slot_no,
        expanded.product_rn,
        CASE
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) = 0 THEN 'expired'
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) IN (1, 2) THEN 'depleted'
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) IN (3, 4, 5) THEN 'near_expiry'
          ELSE 'available'
        END AS status,
        CASE
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) = 0
            THEN DATE_SUB(CURDATE(), INTERVAL (15 + MOD(expanded.product_id, 120)) DAY)
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) IN (3, 4, 5)
            THEN DATE_ADD(CURDATE(), INTERVAL (25 + MOD(expanded.product_id + expanded.slot_no, 55)) DAY)
          ELSE DATE_ADD(CURDATE(), INTERVAL (180 + MOD(expanded.product_id * 7 + expanded.slot_no * 31, 720)) DAY)
        END AS expiry_date,
        CASE
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) = 0
            THEN DATE_SUB(DATE_SUB(CURDATE(), INTERVAL (15 + MOD(expanded.product_id, 120)) DAY), INTERVAL 540 DAY)
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) IN (3, 4, 5)
            THEN DATE_SUB(DATE_ADD(CURDATE(), INTERVAL (25 + MOD(expanded.product_id + expanded.slot_no, 55)) DAY), INTERVAL 540 DAY)
          ELSE DATE_SUB(DATE_ADD(CURDATE(), INTERVAL (180 + MOD(expanded.product_id * 7 + expanded.slot_no * 31, 720)) DAY), INTERVAL 540 DAY)
        END AS manufacture_date,
        20 + MOD(expanded.product_id * 13 + expanded.slot_no * 17, 181) AS quantity_received,
        CASE
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) IN (1, 2) THEN 0
          WHEN MOD(expanded.product_id + expanded.slot_no, 20) = 0
            THEN LEAST(5 + MOD(expanded.product_id, 30), 20 + MOD(expanded.product_id * 13 + expanded.slot_no * 17, 181))
          ELSE GREATEST(
            1,
            FLOOR((20 + MOD(expanded.product_id * 13 + expanded.slot_no * 17, 181)) * (55 + MOD(expanded.product_id + expanded.slot_no, 40)) / 100)
          )
        END AS quantity_remaining,
        1 + MOD(expanded.product_rn + expanded.slot_no * 37, 400) AS batch_no,
        1 + MOD(expanded.product_id + expanded.slot_no * 11, location_count) AS location_rn
      FROM (
        SELECT
          p.id AS product_id,
          p.retail_price,
          GREATEST(p.cost_price, ROUND(p.retail_price * 0.70, -2)) AS cost_price,
          product_rank.product_rn,
          slot_numbers.slot_no
        FROM products p
        JOIN (
          SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS product_rn
          FROM products
          WHERE status = 'active'
        ) product_rank ON product_rank.id = p.id
        JOIN (
          SELECT 1 AS slot_no
          UNION ALL SELECT 2
          UNION ALL SELECT 3
        ) slot_numbers
          ON slot_numbers.slot_no <= CASE
            WHEN MOD(p.id, 3) = 0 THEN 3
            WHEN MOD(p.id, 3) = 1 THEN 2
            ELSE 1
          END
        WHERE p.status = 'active'
      ) expanded
    ) seeded
    JOIN batches b
      ON b.batch_code = CONCAT('PH2-PO-', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL MOD(seeded.batch_no, 7) DAY), '%y%m%d'), '-', LPAD(seeded.batch_no, 4, '0'))
    JOIN (
      SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
      FROM locations
      WHERE is_active = 1
    ) loc ON loc.rn = seeded.location_rn;

    INSERT INTO stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH2-IN-', LPAD(bi.id, 8, '0')) AS movement_code,
      bi.id,
      bi.product_id,
      'inbound',
      bi.quantity_received,
      'purchase_order',
      bi.batch_id,
      'Seed Phase 2 - nhập kho ban đầu theo lô.',
      1,
      b.received_date
    FROM batch_items bi
    JOIN batches b ON b.id = bi.batch_id
    WHERE b.batch_code LIKE 'PH2-PO-%';

    UPDATE batches b
    JOIN (
      SELECT batch_id, SUM(quantity_received * cost_price) AS total_amount
      FROM batch_items
      GROUP BY batch_id
    ) totals ON totals.batch_id = b.id
    SET
      b.total_amount = totals.total_amount,
      b.paid_amount = ROUND(totals.total_amount * CASE
        WHEN MOD(b.id, 5) = 0 THEN 0.60
        WHEN MOD(b.id, 5) = 1 THEN 0.80
        ELSE 1.00
      END, 0)
    WHERE b.batch_code LIKE 'PH2-PO-%';

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase2_inventory_batches();
DROP PROCEDURE IF EXISTS seed_phase2_inventory_batches;


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
-- Source: 103_seed_customers_loyalty.sql
-- =============================================================================

-- Phase 4 customer, address, and loyalty seed.
-- Creates realistic CRM/customer data for web checkout, profile, loyalty, and admin CRM demos.

USE mg_identity;
SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase4_customers_loyalty $$
CREATE PROCEDURE seed_phase4_customers_loyalty()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE code LIKE 'MG-CUS-%') THEN
    START TRANSACTION;

    INSERT INTO customers (
      full_name, email, phone, password_hash, date_of_birth, gender,
      loyalty_points, loyalty_tier, is_active, created_at, updated_at,
      deleted_at, code, zalo_id
    )
    SELECT
      CONCAT(
        ELT(1 + MOD(n, 12), 'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Phan', 'Vũ'),
        ' ',
        ELT(1 + MOD(n * 3, 14), 'Minh', 'Thanh', 'Gia', 'Bảo', 'Anh', 'Thu', 'Ngọc', 'Hoài', 'Quốc', 'Khánh', 'Kim', 'Hà', 'Tuấn', 'Linh'),
        ' ',
        ELT(1 + MOD(n * 7, 16), 'An', 'Bình', 'Chi', 'Dung', 'Hạnh', 'Huy', 'Khang', 'Lan', 'Long', 'Mai', 'Nam', 'Nhi', 'Phúc', 'Quân', 'Tâm', 'Vy')
      ) AS full_name,
      CONCAT('khachhang', LPAD(n, 3, '0'), '@minhgiangpharma.vn') AS email,
      CONCAT('09', LPAD(10000000 + n, 8, '0')) AS phone,
      '$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy' AS password_hash,
      DATE_SUB(CURDATE(), INTERVAL (22 + MOD(n, 48)) YEAR) AS date_of_birth,
      ELT(1 + MOD(n, 3), 'female', 'male', 'other') AS gender,
      CASE
        WHEN MOD(n, 20) = 0 THEN 6200 + MOD(n * 37, 1800)
        WHEN MOD(n, 10) IN (0, 1) THEN 2200 + MOD(n * 29, 2200)
        WHEN MOD(n, 4) = 0 THEN 600 + MOD(n * 23, 1100)
        ELSE 25 + MOD(n * 17, 420)
      END AS loyalty_points,
      CASE
        WHEN MOD(n, 20) = 0 THEN 'vip'
        WHEN MOD(n, 10) IN (0, 1) THEN 'gold'
        WHEN MOD(n, 4) = 0 THEN 'silver'
        ELSE 'member'
      END AS loyalty_tier,
      CASE WHEN MOD(n, 37) = 0 THEN 0 ELSE 1 END AS is_active,
      DATE_SUB(NOW(), INTERVAL MOD(n * 5, 7) DAY) AS created_at,
      DATE_SUB(NOW(), INTERVAL MOD(n * 3, 7) DAY) AS updated_at,
      NULL AS deleted_at,
      CONCAT('MG-CUS-', LPAD(n, 4, '0')) AS code,
      CASE WHEN MOD(n, 5) = 0 THEN CONCAT('zalo_mg_', LPAD(n, 4, '0')) ELSE NULL END AS zalo_id
    FROM (
      SELECT ones.n + tens.n * 10 + 1 AS n
      FROM (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) ones
      JOIN (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
        UNION ALL SELECT 10 UNION ALL SELECT 11
      ) tens
      ORDER BY n
    ) seq
    WHERE n <= 120;

    INSERT INTO customer_addresses (
      customer_id, receiver_name, phone, province, district, ward, street_address, is_default
    )
    SELECT
      c.id,
      c.full_name,
      c.phone,
      'Tỉnh Hòa Bình' AS province,
      'Thành phố Hòa Bình' AS district,
      ELT(1 + MOD(seq.slot_no + c.id * 3, 8),
        'Phường Hữu Nghị', 'Phường Đồng Tiến', 'Phường Phương Lâm', 'Phường Tân Thịnh',
        'Phường Dân Chủ', 'Phường Thái Bình', 'Phường Thịnh Lang', 'Xã Sủ Ngòi'
      ) AS ward,
      CONCAT(
        12 + MOD(c.id * 17 + seq.slot_no * 9, 260),
        ' ',
        ELT(1 + MOD(c.id + seq.slot_no, 10),
          'đường An Dương Vương', 'đường Cù Chính Lan', 'đường Trần Hưng Đạo',
          'đường Chi Lăng', 'đường Lê Thánh Tông', 'đường Đà Giang',
          'đường Điện Biên Phủ', 'đường Hòa Bình', 'đường Nguyễn Huệ', 'đường Lý Thường Kiệt'
        )
      ) AS street_address,
      CASE WHEN seq.slot_no = 1 THEN 1 ELSE 0 END AS is_default
    FROM customers c
    JOIN (
      SELECT 1 AS slot_no
      UNION ALL SELECT 2
    ) seq ON seq.slot_no <= CASE WHEN MOD(c.id, 3) = 0 THEN 2 ELSE 1 END
    WHERE c.code LIKE 'MG-CUS-%';

    INSERT INTO loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      c.id,
      'earn_bonus',
      GREATEST(20, FLOOR(c.loyalty_points * 0.45)),
      'Tặng điểm chào mừng thành viên Minh Giang',
      NULL,
      1,
      'Seed Phase 4 - điểm chào mừng khách hàng.',
      DATE_SUB(c.created_at, INTERVAL -1 DAY),
      CONCAT('PH4-WELCOME-', c.code),
      DATE_ADD(c.created_at, INTERVAL 12 MONTH)
    FROM customers c
    WHERE c.code LIKE 'MG-CUS-%';

    INSERT INTO loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      c.id,
      'adjust_add',
      GREATEST(10, FLOOR(c.loyalty_points * 0.35)),
      'Điều chỉnh cộng điểm từ chương trình chăm sóc khách hàng',
      NULL,
      1,
      'Seed Phase 4 - mô phỏng chăm sóc khách hàng thân thiết.',
      DATE_SUB(NOW(), INTERVAL MOD(c.id * 7, 7) DAY),
      CONCAT('PH4-ADJUST-', c.code),
      DATE_ADD(NOW(), INTERVAL 12 MONTH)
    FROM customers c
    WHERE c.code LIKE 'MG-CUS-%' AND c.loyalty_points >= 100;

    INSERT INTO loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      c.id,
      'redeem',
      -LEAST(120, GREATEST(20, FLOOR(c.loyalty_points * 0.12))),
      'Quy đổi điểm giảm giá tại quầy',
      NULL,
      NULL,
      NULL,
      DATE_SUB(NOW(), INTERVAL MOD(c.id * 11, 7) DAY),
      CONCAT('PH4-REDEEM-', c.code),
      NULL
    FROM customers c
    WHERE c.code LIKE 'MG-CUS-%' AND c.loyalty_points >= 300 AND MOD(c.id, 3) = 0;

    INSERT INTO loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      c.id,
      'expire',
      -LEAST(80, GREATEST(10, FLOOR(c.loyalty_points * 0.08))),
      'Điểm hết hạn theo chính sách 12 tháng',
      NULL,
      NULL,
      NULL,
      DATE_SUB(NOW(), INTERVAL MOD(c.id * 13, 7) DAY),
      CONCAT('PH4-EXPIRE-', c.code),
      DATE_SUB(NOW(), INTERVAL 1 DAY)
    FROM customers c
    WHERE c.code LIKE 'MG-CUS-%' AND c.loyalty_points >= 500 AND MOD(c.id, 7) = 0;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase4_customers_loyalty();
DROP PROCEDURE IF EXISTS seed_phase4_customers_loyalty;

UPDATE customer_addresses a
JOIN customers c ON c.id = a.customer_id
SET
  a.province = 'Tỉnh Hòa Bình',
  a.district = 'Thành phố Hòa Bình',
  a.ward = ELT(1 + MOD(a.id + c.id * 3, 8),
    'Phường Hữu Nghị', 'Phường Đồng Tiến', 'Phường Phương Lâm', 'Phường Tân Thịnh',
    'Phường Dân Chủ', 'Phường Thái Bình', 'Phường Thịnh Lang', 'Xã Sủ Ngòi'
  ),
  a.street_address = CONCAT(
    12 + MOD(c.id * 17 + a.id * 9, 260),
    ' ',
    ELT(1 + MOD(c.id + a.id, 10),
      'đường An Dương Vương', 'đường Cù Chính Lan', 'đường Trần Hưng Đạo',
      'đường Chi Lăng', 'đường Lê Thánh Tông', 'đường Đà Giang',
      'đường Điện Biên Phủ', 'đường Hòa Bình', 'đường Nguyễn Huệ', 'đường Lý Thường Kiệt'
    )
  )
WHERE c.code LIKE 'MG-CUS-%';

USE mg_catalog;

UPDATE delivery_config
SET
  max_delivery_radius_km = 8.0,
  base_shipping_fee = 15000.00,
  free_shipping_threshold = 300000.00,
  is_enabled = 1
WHERE id = 1;


-- =============================================================================
-- Source: 104_seed_orders.sql
-- =============================================================================

-- Phase 5 order seed.
-- Creates realistic POS/web orders around the main store:
-- Nhà Thuốc Minh Giang, 918 An Dương Vương, Thành phố Hòa Bình.

USE mg_order;
SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase5_orders $$
CREATE PROCEDURE seed_phase5_orders()
BEGIN
  DECLARE customer_count INT DEFAULT 0;
  DECLARE product_count INT DEFAULT 0;

  SELECT COUNT(*) INTO customer_count
  FROM mg_identity.customers
  WHERE code LIKE 'MG-CUS-%' AND deleted_at IS NULL;

  SELECT COUNT(*) INTO product_count
  FROM mg_catalog.products p
  WHERE p.status = 'active'
    AND p.requires_prescription = 0
    AND EXISTS (
      SELECT 1
      FROM mg_catalog.batch_items bi
      WHERE bi.product_id = p.id
        AND bi.status IN ('available', 'near_expiry')
        AND bi.quantity_remaining >= 3
    );

  IF customer_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 5 seed requires Phase 4 customers.';
  END IF;

  IF product_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 5 seed requires Phase 2 inventory with sellable non-Rx products.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_code LIKE 'PH5-%') THEN
    START TRANSACTION;

    CREATE TEMPORARY TABLE tmp_phase5_order_seed AS
    SELECT
      n,
      CASE WHEN MOD(n, 5) IN (0, 1) THEN 'web' ELSE 'pos' END AS order_channel,
      CONVERT(
        CONCAT(CASE WHEN MOD(n, 5) IN (0, 1) THEN 'PH5-WEB-' ELSE 'PH5-POS-' END, LPAD(n, 5, '0'))
        USING utf8mb4
      ) COLLATE utf8mb4_unicode_ci AS order_code,
      1 + MOD(n * 7, customer_count) AS customer_rn,
      1 + MOD(n, 8) AS distance_km,
      DATE_SUB(NOW(), INTERVAL MOD(n, 7) DAY) AS order_time,
      CASE
        WHEN MOD(n, 10) = 0 THEN 'cancelled'
        WHEN MOD(n, 10) = 1 THEN 'pending_approval'
        WHEN MOD(n, 10) = 2 THEN 'confirmed'
        WHEN MOD(n, 10) = 3 THEN 'picking'
        WHEN MOD(n, 10) = 4 THEN 'shipping'
        ELSE 'completed'
      END AS order_status
    FROM (
      SELECT ones.n + tens.n * 10 + hundreds.n * 100 + 1 AS n
      FROM (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) ones
      JOIN (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) tens
      JOIN (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2
      ) hundreds
    ) seq
    WHERE n <= 300;

    CREATE TEMPORARY TABLE tmp_phase5_customers AS
    SELECT
      c.*,
      ROW_NUMBER() OVER (ORDER BY c.id) AS rn
    FROM mg_identity.customers c
    WHERE c.code LIKE 'MG-CUS-%' AND c.deleted_at IS NULL;

    CREATE TEMPORARY TABLE tmp_phase5_products AS
    SELECT
      p.id,
      p.name,
      p.retail_price,
      p.base_unit,
      ROW_NUMBER() OVER (ORDER BY p.id) AS rn
    FROM mg_catalog.products p
    WHERE p.status = 'active'
      AND p.requires_prescription = 0
      AND EXISTS (
        SELECT 1
        FROM mg_catalog.batch_items bi
        WHERE bi.product_id = p.id
          AND bi.status IN ('available', 'near_expiry')
          AND bi.quantity_remaining >= 3
      );

    INSERT INTO orders (
      order_code, order_channel, customer_id, customer_name, customer_phone,
      shipping_address, staff_id, kiosk_id, shift_id, subtotal, shipping_fee,
      discount_amount, total_amount, payment_method, payment_status, order_status,
      requires_vat_invoice, customer_notes, created_at, updated_at
    )
    SELECT
      seed.order_code,
      seed.order_channel,
      CASE WHEN seed.order_channel = 'web' OR MOD(seed.n, 4) != 0 THEN c.id ELSE NULL END AS customer_id,
      CASE WHEN seed.order_channel = 'web' OR MOD(seed.n, 4) != 0 THEN c.full_name ELSE 'Khách vãng lai' END AS customer_name,
      CASE WHEN seed.order_channel = 'web' OR MOD(seed.n, 4) != 0 THEN c.phone ELSE NULL END AS customer_phone,
      CASE
        WHEN seed.order_channel = 'web' THEN CONCAT(
          a.street_address, ', ', a.ward, ', ', a.district, ', ', a.province,
          ' | Ship từ Nhà Thuốc Minh Giang - 918 An Dương Vương, Thành phố Hòa Bình',
          ' | Khoảng cách ước tính: ', seed.distance_km, 'km'
        )
        ELSE 'Nhận tại quầy - Nhà Thuốc Minh Giang, 918 An Dương Vương, Thành phố Hòa Bình'
      END AS shipping_address,
      CASE WHEN seed.order_channel = 'pos' THEN 3 ELSE NULL END AS staff_id,
      CASE WHEN seed.order_channel = 'pos' THEN CONCAT('KIOSK-', 1 + MOD(seed.n, 3)) ELSE NULL END AS kiosk_id,
      NULL AS shift_id,
      1.00 AS subtotal,
      CASE
        WHEN seed.order_channel = 'web' AND seed.distance_km > 5 THEN 15000 + ((seed.distance_km - 5) * 10000)
        ELSE 0
      END AS shipping_fee,
      0.00 AS discount_amount,
      1.00 AS total_amount,
      CASE
        WHEN seed.order_channel = 'pos' THEN ELT(1 + MOD(seed.n, 3), 'cash', 'card_visa', 'qr_transfer')
        ELSE ELT(1 + MOD(seed.n, 3), 'cod', 'vnpay', 'momo')
      END AS payment_method,
      CASE
        WHEN seed.order_status = 'cancelled' THEN 'refunded'
        WHEN seed.order_status = 'pending_approval' THEN 'pending'
        ELSE 'paid'
      END AS payment_status,
      seed.order_status,
      CASE WHEN MOD(seed.n, 19) = 0 THEN 1 ELSE 0 END AS requires_vat_invoice,
      CASE
        WHEN seed.order_channel = 'web' THEN 'Địa chỉ giao hàng nằm trong khu vực hỗ trợ quanh 918 An Dương Vương, Hòa Bình.'
        ELSE 'Đơn POS tại quầy 918 An Dương Vương, Hòa Bình.'
      END AS customer_notes,
      seed.order_time,
      seed.order_time
    FROM tmp_phase5_order_seed seed
    JOIN tmp_phase5_customers c ON c.rn = seed.customer_rn
    LEFT JOIN mg_identity.customer_addresses a ON a.customer_id = c.id AND a.is_default = 1;

    CREATE TEMPORARY TABLE tmp_phase5_item_seed AS
    SELECT
      seed.order_code,
      slots.slot_no,
      1 + MOD(seed.n * 17 + slots.slot_no * 97, product_count) AS product_rn,
      CASE
        WHEN seed.order_status IN ('pending_approval', 'cancelled') THEN 1
        ELSE 1 + MOD(seed.n + slots.slot_no, 3)
      END AS quantity
    FROM tmp_phase5_order_seed seed
    JOIN (
      SELECT 1 AS slot_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    ) slots ON slots.slot_no <= CASE
      WHEN MOD(seed.n, 4) = 0 THEN 4
      WHEN MOD(seed.n, 4) = 1 THEN 3
      WHEN MOD(seed.n, 4) = 2 THEN 2
      ELSE 1
    END;

    INSERT INTO order_items (
      order_id, product_id, product_name, unit_name, quantity,
      unit_price, total_price, batch_item_id, lot_number, prescription_id
    )
    SELECT
      o.id,
      p.id,
      p.name,
      p.base_unit,
      item.quantity,
      p.retail_price,
      item.quantity * p.retail_price,
      bi.id,
      bi.lot_number,
      NULL
    FROM tmp_phase5_order_seed seed
    JOIN orders o ON o.order_code = seed.order_code
    JOIN (
      SELECT 1 AS slot_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    ) slots ON slots.slot_no <= CASE
      WHEN MOD(seed.n, 4) = 0 THEN 4
      WHEN MOD(seed.n, 4) = 1 THEN 3
      WHEN MOD(seed.n, 4) = 2 THEN 2
      ELSE 1
    END
    JOIN tmp_phase5_item_seed item ON item.order_code = seed.order_code AND item.slot_no = slots.slot_no
    JOIN tmp_phase5_products p ON p.rn = item.product_rn
    JOIN (
      SELECT ranked.*
      FROM (
        SELECT
          bi.*,
          ROW_NUMBER() OVER (PARTITION BY bi.product_id ORDER BY bi.expiry_date ASC, bi.id ASC) AS rn
        FROM mg_catalog.batch_items bi
        WHERE bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining >= 3
      ) ranked
      WHERE ranked.rn = 1
    ) bi ON bi.product_id = p.id;

    UPDATE orders o
    JOIN (
      SELECT order_id, SUM(total_price) AS subtotal
      FROM order_items
      GROUP BY order_id
    ) totals ON totals.order_id = o.id
    SET
      o.subtotal = totals.subtotal,
      o.shipping_fee = CASE
        WHEN o.order_channel = 'web' AND totals.subtotal >= 300000 THEN 0
        ELSE o.shipping_fee
      END,
      o.discount_amount = CASE
        WHEN MOD(CAST(RIGHT(o.order_code, 5) AS UNSIGNED), 8) = 0
          THEN LEAST(50000, totals.subtotal + o.shipping_fee)
        ELSE 0
      END,
      o.total_amount = GREATEST(
        0,
        totals.subtotal
        + CASE WHEN o.order_channel = 'web' AND totals.subtotal >= 300000 THEN 0 ELSE o.shipping_fee END
        - CASE
            WHEN MOD(CAST(RIGHT(o.order_code, 5) AS UNSIGNED), 8) = 0
              THEN LEAST(50000, totals.subtotal + o.shipping_fee)
            ELSE 0
          END
      )
    WHERE o.order_code LIKE 'PH5-%';

    INSERT INTO order_promotions (
      order_id, promotion_id, promo_code_snapshot, promo_name_snapshot,
      promo_type_snapshot, discount_value_snapshot, discount_applied, applied_at
    )
    SELECT
      o.id,
      1,
      'MINGIANG50',
      'Giảm 50k cho đơn từ 300k',
      'fixed',
      50000,
      o.discount_amount,
      o.created_at
    FROM orders o
    WHERE o.order_code LIKE 'PH5-%' AND o.discount_amount > 0;

    INSERT INTO mg_catalog.stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH5-OUT-', LPAD(oi.id, 8, '0')),
      oi.batch_item_id,
      oi.product_id,
      'outbound_sale',
      -oi.quantity,
      CASE WHEN o.order_channel = 'pos' THEN 'pos_order' ELSE 'web_order' END,
      o.id,
      'Seed Phase 5 - xuất kho theo đơn hàng lịch sử.',
      COALESCE(o.staff_id, 1),
      o.created_at
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.order_code LIKE 'PH5-%'
      AND o.order_status IN ('picking', 'shipping', 'completed');

    UPDATE mg_catalog.batch_items bi
    JOIN (
      SELECT oi.batch_item_id, SUM(oi.quantity) AS sold_qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_code LIKE 'PH5-%'
        AND o.order_status IN ('picking', 'shipping', 'completed')
      GROUP BY oi.batch_item_id
    ) sold ON sold.batch_item_id = bi.id
    SET
      bi.quantity_remaining = GREATEST(0, bi.quantity_remaining - sold.sold_qty),
      bi.status = CASE
        WHEN GREATEST(0, bi.quantity_remaining - sold.sold_qty) = 0 THEN 'depleted'
        ELSE bi.status
      END;

    INSERT INTO mg_identity.loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      o.customer_id,
      'earn_purchase',
      FLOOR(o.total_amount / 10000),
      CONCAT('Tích điểm mua hàng - đơn ', o.order_code),
      o.id,
      NULL,
      NULL,
      o.created_at,
      CONCAT('PH5-EARN-', o.order_code),
      DATE_ADD(o.created_at, INTERVAL 12 MONTH)
    FROM orders o
    WHERE o.order_code LIKE 'PH5-%'
      AND o.order_status = 'completed'
      AND o.customer_id IS NOT NULL
      AND FLOOR(o.total_amount / 10000) > 0;

    UPDATE mg_identity.customers c
    JOIN (
      SELECT customer_id, SUM(FLOOR(total_amount / 10000)) AS points_earned
      FROM orders
      WHERE order_code LIKE 'PH5-%'
        AND order_status = 'completed'
        AND customer_id IS NOT NULL
      GROUP BY customer_id
    ) earned ON earned.customer_id = c.id
    SET c.loyalty_points = c.loyalty_points + earned.points_earned
    WHERE c.code LIKE 'MG-CUS-%';

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase5_orders();
DROP PROCEDURE IF EXISTS seed_phase5_orders;


-- =============================================================================
-- Source: 105_seed_prescriptions.sql
-- =============================================================================

-- Phase 6 prescription/Rx seed.
-- Adds prescription records and attaches verified prescriptions to historical Rx order items.

USE mg_order;
SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase6_prescriptions $$
CREATE PROCEDURE seed_phase6_prescriptions()
BEGIN
  DECLARE rx_product_count INT DEFAULT 0;
  DECLARE eligible_order_count INT DEFAULT 0;

  SELECT COUNT(*) INTO rx_product_count
  FROM mg_catalog.products p
  WHERE p.status = 'active'
    AND p.requires_prescription = 1
    AND EXISTS (
      SELECT 1
      FROM mg_catalog.batch_items bi
      WHERE bi.product_id = p.id
        AND bi.status IN ('available', 'near_expiry')
        AND bi.quantity_remaining >= 2
    );

  SELECT COUNT(*) INTO eligible_order_count
  FROM orders
  WHERE order_code LIKE 'PH5-%'
    AND customer_id IS NOT NULL
    AND order_status IN ('confirmed', 'picking', 'shipping', 'completed');

  IF rx_product_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 6 seed requires active Rx products with sellable stock.';
  END IF;

  IF eligible_order_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 6 seed requires Phase 5 customer orders.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM prescriptions WHERE prescription_code LIKE 'PH6-RX-%') THEN
    START TRANSACTION;

    CREATE TEMPORARY TABLE tmp_phase6_rx_products AS
    SELECT
      p.id,
      p.name,
      p.retail_price,
      p.base_unit,
      ROW_NUMBER() OVER (ORDER BY p.id) AS rn
    FROM mg_catalog.products p
    WHERE p.status = 'active'
      AND p.requires_prescription = 1
      AND EXISTS (
        SELECT 1
        FROM mg_catalog.batch_items bi
        WHERE bi.product_id = p.id
          AND bi.status IN ('available', 'near_expiry')
          AND bi.quantity_remaining >= 2
      );

    CREATE TEMPORARY TABLE tmp_phase6_orders AS
    SELECT
      o.*,
      ROW_NUMBER() OVER (ORDER BY o.created_at DESC, o.id) AS rn
    FROM orders o
    WHERE o.order_code LIKE 'PH5-%'
      AND o.customer_id IS NOT NULL
      AND o.order_status IN ('confirmed', 'picking', 'shipping', 'completed');

    CREATE TEMPORARY TABLE tmp_phase6_prescription_seed AS
    SELECT
      n,
      CONVERT(CONCAT('PH6-RX-', LPAD(n, 4, '0')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS prescription_code,
      CASE
        WHEN n <= 35 THEN 'verified'
        WHEN n <= 45 THEN 'pending'
        WHEN n <= 53 THEN 'expired'
        ELSE 'rejected'
      END AS status,
      1 + MOD(n * 5, eligible_order_count) AS order_rn,
      1 + MOD(n * 7, rx_product_count) AS rx_product_rn,
      CASE WHEN n <= 30 THEN 1 + MOD(n, 2) ELSE 0 END AS dispense_qty
    FROM (
      SELECT ones.n + tens.n * 10 + 1 AS n
      FROM (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) ones
      JOIN (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
      ) tens
    ) seq
    WHERE n <= 60;

    INSERT INTO prescriptions (
      prescription_code, order_id, customer_id, patient_name, patient_dob, patient_phone,
      doctor_name, doctor_license, hospital_name, issue_date, expiry_date,
      image_url, image_sha256, verified_image_url, max_dispensing_qty, dispensed_qty,
      diagnosis_code, diagnosis_text, notes, status, verified_by, verified_at,
      rejection_reason, created_at, updated_at
    )
    SELECT
      seed.prescription_code,
      NULL AS order_id,
      o.customer_id,
      COALESCE(o.customer_name, c.full_name) AS patient_name,
      c.date_of_birth,
      COALESCE(o.customer_phone, c.phone) AS patient_phone,
      ELT(1 + MOD(seed.n, 8),
        'BS. Nguyễn Minh Khoa', 'BS. Trần Thu Hà', 'BS. Lê Quốc Bảo', 'BS. Phạm Ngọc Lan',
        'BS. Hoàng Đức Anh', 'BS. Vũ Thanh Huyền', 'BS. Đỗ Gia Khánh', 'BS. Bùi Mai Phương'
      ) AS doctor_name,
      CONCAT('CCHN-', LPAD(24000 + seed.n, 6, '0')) AS doctor_license,
      ELT(1 + MOD(seed.n, 5),
        'Bệnh viện Đa khoa tỉnh Hòa Bình',
        'Trung tâm Y tế Thành phố Hòa Bình',
        'Phòng khám Đa khoa Hữu Nghị',
        'Bệnh viện Y học cổ truyền Hòa Bình',
        'Phòng khám Minh An Hòa Bình'
      ) AS hospital_name,
      CASE
        WHEN seed.status = 'expired' THEN DATE_SUB(CURDATE(), INTERVAL 45 DAY)
        ELSE DATE_SUB(CURDATE(), INTERVAL MOD(seed.n * 3, 18) DAY)
      END AS issue_date,
      CASE
        WHEN seed.status = 'expired' THEN DATE_SUB(CURDATE(), INTERVAL 5 + MOD(seed.n, 20) DAY)
        ELSE DATE_ADD(CURDATE(), INTERVAL 10 + MOD(seed.n, 45) DAY)
      END AS expiry_date,
      CONCAT('/uploads/prescriptions/ph6-rx-', LPAD(seed.n, 4, '0'), '.jpg') AS image_url,
      SHA2(CONCAT('PH6-RX-', seed.n, '-image'), 256) AS image_sha256,
      CASE WHEN seed.status = 'verified'
        THEN CONCAT('/uploads/prescriptions/verified/ph6-rx-', LPAD(seed.n, 4, '0'), '.jpg')
        ELSE NULL
      END AS verified_image_url,
      CASE WHEN seed.status = 'verified' THEN 6 ELSE NULL END AS max_dispensing_qty,
      0 AS dispensed_qty,
      ELT(1 + MOD(seed.n, 6), 'I10', 'J45', 'E11', 'K29', 'M10', 'H10') AS diagnosis_code,
      ELT(1 + MOD(seed.n, 6),
        'Tăng huyết áp cần điều trị theo đơn',
        'Hen phế quản cần kiểm soát triệu chứng',
        'Đái tháo đường type 2 cần theo dõi thuốc',
        'Viêm dạ dày cần điều trị ngắn ngày',
        'Gout cần kiểm soát acid uric',
        'Viêm kết mạc cần thuốc theo chỉ định'
      ) AS diagnosis_text,
      CASE
        WHEN seed.status = 'pending' THEN 'Chờ dược sĩ kiểm tra ảnh toa và thông tin bệnh nhân.'
        WHEN seed.status = 'rejected' THEN 'Ảnh toa mờ hoặc thiếu chữ ký/bác sĩ.'
        WHEN seed.status = 'expired' THEN 'Toa đã quá hạn sử dụng, cần khách cập nhật toa mới.'
        ELSE 'Toa hợp lệ, đã được dược sĩ xác minh.'
      END AS notes,
      seed.status,
      CASE WHEN seed.status = 'verified' THEN 2 ELSE NULL END AS verified_by,
      CASE WHEN seed.status = 'verified' THEN DATE_SUB(NOW(), INTERVAL MOD(seed.n, 12) HOUR) ELSE NULL END AS verified_at,
      CASE WHEN seed.status = 'rejected' THEN 'Ảnh toa không đủ thông tin để đối chiếu.' ELSE NULL END AS rejection_reason,
      DATE_SUB(NOW(), INTERVAL MOD(seed.n * 5, 7) DAY) AS created_at,
      NOW() AS updated_at
    FROM tmp_phase6_prescription_seed seed
    JOIN tmp_phase6_orders o ON o.rn = seed.order_rn
    JOIN mg_identity.customers c ON c.id = o.customer_id;

    CREATE TEMPORARY TABLE tmp_phase6_rx_item_seed AS
    SELECT
      o.id AS order_id,
      p.id AS product_id,
      p.name AS product_name,
      p.base_unit AS unit_name,
      seed.dispense_qty AS quantity,
      p.retail_price AS unit_price,
      seed.dispense_qty * p.retail_price AS total_price,
      bi.id AS batch_item_id,
      bi.lot_number,
      pr.id AS prescription_id
    FROM tmp_phase6_prescription_seed seed
    JOIN prescriptions pr ON pr.prescription_code = seed.prescription_code
    JOIN tmp_phase6_orders o ON o.rn = seed.order_rn
    JOIN tmp_phase6_rx_products p ON p.rn = seed.rx_product_rn
    JOIN (
      SELECT ranked.*
      FROM (
        SELECT
          bi.*,
          ROW_NUMBER() OVER (PARTITION BY bi.product_id ORDER BY bi.expiry_date ASC, bi.id ASC) AS rn
        FROM mg_catalog.batch_items bi
        WHERE bi.status IN ('available', 'near_expiry') AND bi.quantity_remaining >= 2
      ) ranked
      WHERE ranked.rn = 1
    ) bi ON bi.product_id = p.id
    WHERE seed.status = 'verified'
      AND seed.dispense_qty > 0;

    INSERT INTO order_items (
      order_id, product_id, product_name, unit_name, quantity,
      unit_price, total_price, batch_item_id, lot_number, prescription_id
    )
    SELECT
      order_id, product_id, product_name, unit_name, quantity,
      unit_price, total_price, batch_item_id, lot_number, prescription_id
    FROM tmp_phase6_rx_item_seed;

    UPDATE prescriptions pr
    JOIN (
      SELECT prescription_id, order_id, SUM(quantity) AS dispensed_qty
      FROM order_items
      WHERE prescription_id IS NOT NULL
      GROUP BY prescription_id, order_id
    ) usage_rows ON usage_rows.prescription_id = pr.id
    SET pr.order_id = usage_rows.order_id
    WHERE pr.prescription_code LIKE 'PH6-RX-%';

    UPDATE orders o
    JOIN (
      SELECT order_id, SUM(total_price) AS subtotal
      FROM order_items
      GROUP BY order_id
    ) totals ON totals.order_id = o.id
    SET
      o.subtotal = totals.subtotal,
      o.discount_amount = CASE
        WHEN o.discount_amount > 0 THEN LEAST(o.discount_amount, totals.subtotal + o.shipping_fee)
        ELSE 0
      END,
      o.total_amount = GREATEST(0, totals.subtotal + o.shipping_fee - CASE
        WHEN o.discount_amount > 0 THEN LEAST(o.discount_amount, totals.subtotal + o.shipping_fee)
        ELSE 0
      END),
      o.updated_at = NOW()
    WHERE o.order_code LIKE 'PH5-%';

    INSERT INTO mg_catalog.stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH6-RX-OUT-', LPAD(oi.id, 8, '0')),
      oi.batch_item_id,
      oi.product_id,
      'outbound_sale',
      -oi.quantity,
      CASE WHEN o.order_channel = 'pos' THEN 'pos_order' ELSE 'web_order' END,
      o.id,
      'Seed Phase 6 - xuất kho thuốc kê đơn đã xác minh toa.',
      COALESCE(o.staff_id, 2),
      o.created_at
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.prescription_id IS NOT NULL
      AND o.order_status IN ('picking', 'shipping', 'completed');

    UPDATE mg_catalog.batch_items bi
    JOIN (
      SELECT oi.batch_item_id, SUM(oi.quantity) AS rx_sold_qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.prescription_id IS NOT NULL
        AND o.order_status IN ('picking', 'shipping', 'completed')
      GROUP BY oi.batch_item_id
    ) sold ON sold.batch_item_id = bi.id
    SET
      bi.quantity_remaining = GREATEST(0, bi.quantity_remaining - sold.rx_sold_qty),
      bi.status = CASE
        WHEN GREATEST(0, bi.quantity_remaining - sold.rx_sold_qty) = 0 THEN 'depleted'
        ELSE bi.status
      END;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase6_prescriptions();
DROP PROCEDURE IF EXISTS seed_phase6_prescriptions;


-- =============================================================================
-- Source: 106_seed_returns_after_sales.sql
-- =============================================================================

-- Phase 7 after-sales return/refund seed.
-- Adds realistic customer return cases for completed Minh Giang orders.

USE mg_order;
SET NAMES utf8mb4;
SET @PH7_OLD_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = '';

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase7_returns_after_sales $$
CREATE PROCEDURE seed_phase7_returns_after_sales()
BEGIN
  DECLARE eligible_item_count INT DEFAULT 0;

  SELECT COUNT(*) INTO eligible_item_count
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.order_code LIKE 'PH5-%'
    AND o.order_status = 'completed'
    AND o.payment_status = 'paid'
    AND oi.batch_item_id IS NOT NULL
    AND oi.prescription_id IS NULL
    AND oi.quantity > 0;

  IF eligible_item_count < 36 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 7 seed requires at least 36 completed paid non-Rx order items.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM returns WHERE return_code LIKE 'PH7-RET-%') THEN
    START TRANSACTION;

    CREATE TEMPORARY TABLE tmp_phase7_return_seed AS
    SELECT
      n,
      CONVERT(CONCAT('PH7-RET-', LPAD(n, 4, '0')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS return_code,
      CASE
        WHEN n <= 18 THEN 'completed'
        WHEN n <= 26 THEN 'approved'
        WHEN n <= 32 THEN 'pending'
        ELSE 'rejected'
      END AS status,
      CASE
        WHEN n <= 18 THEN
          ELT(1 + MOD(n, 5),
            'Khách đổi trả do mua nhầm quy cách, bao bì còn nguyên niêm phong.',
            'Khách trả một phần đơn web trong ngày do không còn nhu cầu sử dụng.',
            'Sản phẩm giao nhầm biến thể, dược sĩ đã đối chiếu và chấp nhận hoàn.',
            'Khách phát hiện trùng thuốc đã mua trước đó, hàng còn đủ điều kiện nhập lại.',
            'Hoàn trả sau tư vấn tại quầy, sản phẩm chưa mở hộp.'
          )
        WHEN n <= 26 THEN
          ELT(1 + MOD(n, 4),
            'Đã duyệt yêu cầu đổi hàng, đang chờ khách mang sản phẩm tới nhà thuốc.',
            'Đã duyệt hoàn tiền qua phương thức thanh toán ban đầu.',
            'Đã duyệt đổi sang sản phẩm cùng nhóm, chờ kiểm tra bao bì.',
            'Đã duyệt trả hàng do giao thiếu phụ kiện đi kèm.'
          )
        WHEN n <= 32 THEN
          ELT(1 + MOD(n, 3),
            'Khách vừa gửi yêu cầu trả hàng, chờ dược sĩ kiểm tra điều kiện.',
            'Chờ đối chiếu ảnh sản phẩm và hóa đơn mua hàng.',
            'Chờ xác nhận tình trạng niêm phong trước khi duyệt.'
          )
        ELSE
          ELT(1 + MOD(n, 3),
            'Từ chối do sản phẩm đã mở nắp/rách tem niêm phong.',
            'Từ chối do quá thời hạn đổi trả của nhà thuốc.',
            'Từ chối do sản phẩm không đúng lô đã bán trong hệ thống.'
          )
      END AS reason,
      CASE
        WHEN n <= 18 THEN
          CASE
            WHEN MOD(n, 4) = 0 THEN 'store_credit'
            WHEN MOD(n, 3) = 0 THEN 'original_payment'
            ELSE 'cash'
          END
        WHEN n <= 26 THEN
          CASE WHEN MOD(n, 2) = 0 THEN 'original_payment' ELSE 'cash' END
        WHEN n <= 32 THEN
          CASE WHEN MOD(n, 2) = 0 THEN 'store_credit' ELSE 'cash' END
        ELSE 'cash'
      END AS refund_method,
      CASE
        WHEN n <= 18 THEN 1
        ELSE 0
      END AS is_completed,
      CASE
        WHEN n <= 18 AND MOD(n, 4) <> 0 THEN 1
        ELSE 0
      END AS return_to_stock
    FROM (
      SELECT ones.n + tens.n * 10 + 1 AS n
      FROM (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) ones
      JOIN (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
      ) tens
    ) seq
    WHERE n <= 36;

    CREATE TEMPORARY TABLE tmp_phase7_candidate_items AS
    SELECT
      ranked.*,
      ROW_NUMBER() OVER (ORDER BY ranked.created_at DESC, ranked.order_id, ranked.order_item_id) AS rn
    FROM (
      SELECT
        o.id AS order_id,
        o.order_code,
        o.order_channel,
        o.created_at,
        oi.id AS order_item_id,
        oi.product_id,
        oi.batch_item_id,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY oi.id) AS item_rn
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_code LIKE 'PH5-%'
        AND o.order_status = 'completed'
        AND o.payment_status = 'paid'
        AND oi.batch_item_id IS NOT NULL
        AND oi.prescription_id IS NULL
        AND oi.quantity > 0
    ) ranked
    WHERE ranked.item_rn = 1;

    CREATE TEMPORARY TABLE tmp_phase7_return_items AS
    SELECT
      seed.n,
      seed.return_code,
      seed.status,
      seed.reason,
      seed.refund_method,
      seed.return_to_stock,
      ci.order_id,
      ci.order_channel,
      ci.order_item_id,
      ci.product_id,
      ci.batch_item_id,
      1 AS quantity_returned,
      ci.unit_price AS refund_amount
    FROM tmp_phase7_return_seed seed
    JOIN tmp_phase7_candidate_items ci ON ci.rn = seed.n;

    INSERT INTO returns (
      return_code, order_id, order_channel, reason, refund_amount,
      refund_method, status, handled_by, created_at, updated_at
    )
    SELECT
      return_code,
      order_id,
      order_channel,
      reason,
      CASE WHEN status = 'rejected' THEN 0 ELSE refund_amount END,
      refund_method,
      status,
      CASE WHEN status IN ('approved', 'completed', 'rejected') THEN 2 + MOD(n, 4) ELSE NULL END,
      DATE_SUB(NOW(), INTERVAL 1 + MOD(n * 3, 7) DAY),
      NOW()
    FROM tmp_phase7_return_items;

    INSERT INTO return_items (
      return_id, order_item_id, quantity_returned, return_to_stock
    )
    SELECT
      r.id,
      seed.order_item_id,
      seed.quantity_returned,
      seed.return_to_stock
    FROM tmp_phase7_return_items seed
    JOIN returns r ON r.return_code = seed.return_code;

    INSERT INTO mg_catalog.stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH7-RET-STOCK-', LPAD(r.id, 8, '0')),
      seed.batch_item_id,
      seed.product_id,
      'adjustment',
      seed.quantity_returned,
      'customer_return',
      r.id,
      'Seed Phase 7 - nhập lại kho từ đơn trả hàng đủ điều kiện bán lại.',
      COALESCE(r.handled_by, 2),
      r.updated_at
    FROM tmp_phase7_return_items seed
    JOIN returns r ON r.return_code = seed.return_code
    WHERE seed.status = 'completed'
      AND seed.return_to_stock = 1;

    UPDATE mg_catalog.batch_items bi
    JOIN (
      SELECT batch_item_id, SUM(quantity_returned) AS returned_qty
      FROM tmp_phase7_return_items
      WHERE status = 'completed'
        AND return_to_stock = 1
      GROUP BY batch_item_id
    ) returned ON returned.batch_item_id = bi.id
    SET
      bi.quantity_remaining = LEAST(bi.quantity_received, bi.quantity_remaining + returned.returned_qty),
      bi.status = CASE
        WHEN bi.expiry_date < CURDATE() THEN 'expired'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90 THEN 'near_expiry'
        WHEN LEAST(bi.quantity_received, bi.quantity_remaining + returned.returned_qty) > 0 THEN 'available'
        ELSE bi.status
      END;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase7_returns_after_sales();
DROP PROCEDURE IF EXISTS seed_phase7_returns_after_sales;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase7_returns_channel_mix $$
CREATE PROCEDURE seed_phase7_returns_channel_mix()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM returns WHERE return_code LIKE 'PH7-MIX-%') THEN
    START TRANSACTION;

    CREATE TEMPORARY TABLE tmp_phase7_mix_seed AS
    SELECT
      n,
      CONVERT(CONCAT('PH7-MIX-', LPAD(n, 4, '0')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS return_code,
      CONVERT(CASE WHEN n <= 6 THEN 'pos' ELSE 'web' END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS target_channel,
      CASE WHEN n <= 6 THEN 'completed' ELSE 'pending' END AS status,
      CASE WHEN n <= 4 THEN 1 ELSE 0 END AS return_to_stock,
      CASE
        WHEN n <= 6 THEN 'Hoàn tất đổi/trả tại quầy 918 An Dương Vương, dược sĩ đã kiểm tra sản phẩm.'
        ELSE 'Yêu cầu trả hàng web trong bán kính giao Hòa Bình, chờ khách gửi ảnh xác minh.'
      END AS reason,
      CASE
        WHEN n <= 6 THEN 'cash'
        WHEN MOD(n, 2) = 0 THEN 'original_payment'
        ELSE 'store_credit'
      END AS refund_method
    FROM (
      SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
      UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
    ) seq;

    CREATE TEMPORARY TABLE tmp_phase7_mix_candidates AS
    SELECT
      ranked.*,
      ROW_NUMBER() OVER (PARTITION BY ranked.order_channel ORDER BY ranked.created_at DESC, ranked.order_id, ranked.order_item_id) AS channel_rn
    FROM (
      SELECT
        o.id AS order_id,
        o.order_channel,
        o.created_at,
        oi.id AS order_item_id,
        oi.product_id,
        oi.batch_item_id,
        oi.quantity,
        oi.unit_price,
        ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY oi.id) AS item_rn
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_code LIKE 'PH5-%'
        AND o.order_status = 'completed'
        AND o.payment_status = 'paid'
        AND oi.batch_item_id IS NOT NULL
        AND oi.prescription_id IS NULL
        AND oi.quantity > 0
        AND NOT EXISTS (
          SELECT 1 FROM return_items existing_ri WHERE existing_ri.order_item_id = oi.id
        )
    ) ranked
    WHERE ranked.item_rn = 1;

    CREATE TEMPORARY TABLE tmp_phase7_mix_items AS
    SELECT
      seed.n,
      seed.return_code,
      seed.status,
      seed.reason,
      seed.refund_method,
      seed.return_to_stock,
      ci.order_id,
      ci.order_channel,
      ci.order_item_id,
      ci.product_id,
      ci.batch_item_id,
      1 AS quantity_returned,
      ci.unit_price AS refund_amount
    FROM tmp_phase7_mix_seed seed
    JOIN tmp_phase7_mix_candidates ci
      ON ci.order_channel = seed.target_channel
     AND ci.channel_rn = CASE WHEN seed.target_channel = 'pos' THEN seed.n ELSE seed.n - 6 END;

    IF (SELECT COUNT(*) FROM tmp_phase7_mix_items) < 12 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Phase 7 mix seed requires 6 POS and 6 web return candidates.';
    END IF;

    INSERT INTO returns (
      return_code, order_id, order_channel, reason, refund_amount,
      refund_method, status, handled_by, created_at, updated_at
    )
    SELECT
      return_code,
      order_id,
      order_channel,
      reason,
      refund_amount,
      refund_method,
      status,
      CASE WHEN status = 'completed' THEN 3 ELSE NULL END,
      DATE_SUB(NOW(), INTERVAL 1 + MOD(n * 2, 7) DAY),
      NOW()
    FROM tmp_phase7_mix_items;

    INSERT INTO return_items (
      return_id, order_item_id, quantity_returned, return_to_stock
    )
    SELECT
      r.id,
      seed.order_item_id,
      seed.quantity_returned,
      seed.return_to_stock
    FROM tmp_phase7_mix_items seed
    JOIN returns r ON r.return_code = seed.return_code;

    INSERT INTO mg_catalog.stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH7-MIX-STOCK-', LPAD(r.id, 8, '0')),
      seed.batch_item_id,
      seed.product_id,
      'adjustment',
      seed.quantity_returned,
      'customer_return',
      r.id,
      'Seed Phase 7 - nhập lại kho từ đổi trả POS đủ điều kiện bán lại.',
      COALESCE(r.handled_by, 3),
      r.updated_at
    FROM tmp_phase7_mix_items seed
    JOIN returns r ON r.return_code = seed.return_code
    WHERE seed.status = 'completed'
      AND seed.return_to_stock = 1;

    UPDATE mg_catalog.batch_items bi
    JOIN (
      SELECT batch_item_id, SUM(quantity_returned) AS returned_qty
      FROM tmp_phase7_mix_items
      WHERE status = 'completed'
        AND return_to_stock = 1
      GROUP BY batch_item_id
    ) returned ON returned.batch_item_id = bi.id
    SET
      bi.quantity_remaining = LEAST(bi.quantity_received, bi.quantity_remaining + returned.returned_qty),
      bi.status = CASE
        WHEN bi.expiry_date < CURDATE() THEN 'expired'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90 THEN 'near_expiry'
        WHEN LEAST(bi.quantity_received, bi.quantity_remaining + returned.returned_qty) > 0 THEN 'available'
        ELSE bi.status
      END;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase7_returns_channel_mix();
DROP PROCEDURE IF EXISTS seed_phase7_returns_channel_mix;
SET SQL_MODE = @PH7_OLD_SQL_MODE;


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
  DECLARE customer_count INT DEFAULT 0;
  DECLARE order_count INT DEFAULT 0;

  SELECT COUNT(*) INTO customer_count FROM mg_identity.customers;
  SELECT COUNT(*) INTO order_count FROM mg_order.orders WHERE order_code LIKE 'PH5-%';

  IF customer_count = 0 OR order_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 8 seed requires identity customers and Phase 5 orders.';
  END IF;

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

  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.source_phase')) = 'phase8'
  ) THEN
    START TRANSACTION;

    CREATE TEMPORARY TABLE tmp_ph8_order_templates AS
    SELECT name, channel, id
    FROM notification_templates
    WHERE name IN ('order_status_update', 'delivery_eta', 'staff_pending_order')
      AND is_active = 1;

    CREATE TEMPORARY TABLE tmp_ph8_rx_templates AS
    SELECT name, channel, id
    FROM notification_templates
    WHERE name IN ('prescription_status', 'staff_rx_review')
      AND is_active = 1;

    CREATE TEMPORARY TABLE tmp_ph8_return_templates AS
    SELECT name, channel, id
    FROM notification_templates
    WHERE name = 'return_status_update'
      AND is_active = 1;

    CREATE TEMPORARY TABLE tmp_ph8_inventory_templates AS
    SELECT name, channel, id
    FROM notification_templates
    WHERE name = 'inventory_attention'
      AND is_active = 1;

    INSERT INTO notifications (
      template_id, recipient_type, recipient_id, channel,
      reference_type, reference_id, payload, status, sent_at, created_at
    )
    SELECT
      tmpl.id,
      'customer',
      o.customer_id,
      tmpl.channel,
      'order',
      o.id,
      JSON_OBJECT(
        'source_phase', 'phase8',
        'notification_group', 'customer_order',
        'order_code', o.order_code,
        'order_status', o.order_status,
        'order_channel', o.order_channel,
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'store_name', 'Nhà Thuốc Minh Giang',
        'store_address', '918 An Dương Vương, Thành phố Hòa Bình',
        'total_amount', o.total_amount
      ),
      CASE
        WHEN o.order_status IN ('pending_approval', 'confirmed') THEN 'pending'
        WHEN MOD(o.id, 23) = 0 THEN 'failed'
        ELSE 'sent'
      END,
      CASE
        WHEN o.order_status IN ('pending_approval', 'confirmed') OR MOD(o.id, 23) = 0 THEN NULL
        ELSE DATE_ADD(o.created_at, INTERVAL 5 MINUTE)
      END,
      DATE_ADD(o.created_at, INTERVAL 2 MINUTE)
    FROM mg_order.orders o
    JOIN tmp_ph8_order_templates tmpl
      ON tmpl.name = 'order_status_update'
     AND tmpl.channel = CASE WHEN o.order_channel = 'web' THEN 'email' ELSE 'sms' END
    WHERE o.order_code LIKE 'PH5-%'
      AND o.customer_id IS NOT NULL
    ORDER BY o.created_at DESC
    LIMIT 140;

    INSERT INTO notifications (
      template_id, recipient_type, recipient_id, channel,
      reference_type, reference_id, payload, status, sent_at, created_at
    )
    SELECT
      tmpl.id,
      'customer',
      o.customer_id,
      tmpl.channel,
      'delivery',
      o.id,
      JSON_OBJECT(
        'source_phase', 'phase8',
        'notification_group', 'customer_delivery',
        'order_code', o.order_code,
        'order_status', o.order_status,
        'distance_km', 1 + MOD(o.id, 8),
        'store_address', '918 An Dương Vương, Thành phố Hòa Bình',
        'delivery_area', 'Thành phố Hòa Bình, bán kính tối đa 8km'
      ),
      CASE WHEN o.order_status = 'shipping' THEN 'pending' ELSE 'sent' END,
      CASE WHEN o.order_status = 'shipping' THEN NULL ELSE DATE_ADD(o.created_at, INTERVAL 12 MINUTE) END,
      DATE_ADD(o.created_at, INTERVAL 10 MINUTE)
    FROM mg_order.orders o
    JOIN tmp_ph8_order_templates tmpl ON tmpl.name = 'delivery_eta' AND tmpl.channel = 'zalo'
    WHERE o.order_code LIKE 'PH5-%'
      AND o.order_channel = 'web'
      AND o.customer_id IS NOT NULL
      AND o.order_status IN ('shipping', 'completed')
    ORDER BY o.created_at DESC
    LIMIT 45;

    INSERT INTO notifications (
      template_id, recipient_type, recipient_id, channel,
      reference_type, reference_id, payload, status, sent_at, created_at
    )
    SELECT
      tmpl.id,
      'customer',
      pr.customer_id,
      tmpl.channel,
      'prescription',
      pr.id,
      JSON_OBJECT(
        'source_phase', 'phase8',
        'notification_group', 'customer_prescription',
        'prescription_code', pr.prescription_code,
        'prescription_status', pr.status,
        'patient_name', pr.patient_name,
        'hospital_name', pr.hospital_name,
        'store_address', '918 An Dương Vương, Thành phố Hòa Bình'
      ),
      CASE WHEN pr.status = 'pending' THEN 'pending' WHEN pr.status = 'rejected' AND MOD(pr.id, 2) = 0 THEN 'failed' ELSE 'sent' END,
      CASE WHEN pr.status = 'pending' OR (pr.status = 'rejected' AND MOD(pr.id, 2) = 0) THEN NULL ELSE DATE_ADD(pr.created_at, INTERVAL 8 MINUTE) END,
      DATE_ADD(pr.created_at, INTERVAL 5 MINUTE)
    FROM mg_order.prescriptions pr
    JOIN tmp_ph8_rx_templates tmpl
      ON tmpl.name = 'prescription_status'
     AND tmpl.channel = CASE WHEN pr.status IN ('verified', 'rejected') THEN 'sms' ELSE 'in_app' END
    WHERE pr.prescription_code LIKE 'PH6-RX-%';

    INSERT INTO notifications (
      template_id, recipient_type, recipient_id, channel,
      reference_type, reference_id, payload, status, sent_at, created_at
    )
    SELECT
      tmpl.id,
      'customer',
      o.customer_id,
      tmpl.channel,
      'return',
      r.id,
      JSON_OBJECT(
        'source_phase', 'phase8',
        'notification_group', 'customer_return',
        'return_code', r.return_code,
        'return_status', r.status,
        'refund_amount', r.refund_amount,
        'refund_method', r.refund_method,
        'order_code', o.order_code,
        'store_address', '918 An Dương Vương, Thành phố Hòa Bình'
      ),
      CASE WHEN r.status IN ('pending', 'approved') THEN 'pending' ELSE 'sent' END,
      CASE WHEN r.status IN ('pending', 'approved') THEN NULL ELSE DATE_ADD(r.created_at, INTERVAL 15 MINUTE) END,
      DATE_ADD(r.created_at, INTERVAL 6 MINUTE)
    FROM mg_order.returns r
    JOIN mg_order.orders o ON o.id = r.order_id
    JOIN tmp_ph8_return_templates tmpl
      ON tmpl.name = 'return_status_update'
     AND tmpl.channel = CASE WHEN r.order_channel = 'web' THEN 'email' ELSE 'sms' END
    WHERE r.return_code LIKE 'PH7-RET-%'
       OR r.return_code LIKE 'PH7-MIX-%';

    INSERT INTO notifications (
      template_id, recipient_type, recipient_id, channel,
      reference_type, reference_id, payload, status, sent_at, created_at
    )
    SELECT
      tmpl.id,
      'staff',
      CASE WHEN o.order_status = 'pending_approval' THEN 2 ELSE 3 END,
      tmpl.channel,
      'order',
      o.id,
      JSON_OBJECT(
        'source_phase', 'phase8',
        'notification_group', 'staff_order_queue',
        'order_code', o.order_code,
        'order_status', o.order_status,
        'order_channel', o.order_channel,
        'customer_name', o.customer_name,
        'shipping_address', o.shipping_address
      ),
      'pending',
      NULL,
      DATE_ADD(o.created_at, INTERVAL 1 MINUTE)
    FROM mg_order.orders o
    JOIN tmp_ph8_order_templates tmpl ON tmpl.name = 'staff_pending_order' AND tmpl.channel = 'in_app'
    WHERE o.order_code LIKE 'PH5-%'
      AND o.order_status IN ('pending_approval', 'confirmed', 'picking')
    ORDER BY o.created_at DESC
    LIMIT 70;

    INSERT INTO notifications (
      template_id, recipient_type, recipient_id, channel,
      reference_type, reference_id, payload, status, sent_at, created_at
    )
    SELECT
      tmpl.id,
      'staff',
      2,
      tmpl.channel,
      'prescription',
      pr.id,
      JSON_OBJECT(
        'source_phase', 'phase8',
        'notification_group', 'staff_rx_queue',
        'prescription_code', pr.prescription_code,
        'customer_name', pr.patient_name,
        'prescription_status', pr.status,
        'hospital_name', pr.hospital_name,
        'store_address', '918 An Dương Vương, Thành phố Hòa Bình'
      ),
      'pending',
      NULL,
      DATE_ADD(pr.created_at, INTERVAL 2 MINUTE)
    FROM mg_order.prescriptions pr
    JOIN tmp_ph8_rx_templates tmpl ON tmpl.name = 'staff_rx_review' AND tmpl.channel = 'in_app'
    WHERE pr.prescription_code LIKE 'PH6-RX-%'
      AND pr.status = 'pending';

    INSERT INTO notifications (
      template_id, recipient_type, recipient_id, channel,
      reference_type, reference_id, payload, status, sent_at, created_at
    )
    SELECT
      tmpl.id,
      'admin',
      1,
      tmpl.channel,
      'batch_item',
      bi.id,
      JSON_OBJECT(
        'source_phase', 'phase8',
        'notification_group', 'inventory_attention',
        'product_id', p.id,
        'product_name', p.name,
        'lot_number', bi.lot_number,
        'inventory_status', bi.status,
        'quantity_remaining', bi.quantity_remaining,
        'expiry_date', bi.expiry_date,
        'store_address', '918 An Dương Vương, Thành phố Hòa Bình'
      ),
      CASE WHEN bi.status = 'expired' THEN 'sent' ELSE 'pending' END,
      CASE WHEN bi.status = 'expired' THEN NOW() ELSE NULL END,
      NOW()
    FROM mg_catalog.batch_items bi
    JOIN mg_catalog.products p ON p.id = bi.product_id
    JOIN tmp_ph8_inventory_templates tmpl ON tmpl.name = 'inventory_attention' AND tmpl.channel = 'in_app'
    WHERE bi.status IN ('near_expiry', 'expired')
    ORDER BY bi.expiry_date ASC, bi.quantity_remaining ASC, bi.id
    LIMIT 80;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase8_notifications();
DROP PROCEDURE IF EXISTS seed_phase8_notifications;

UPDATE notifications
SET payload = JSON_SET(payload, '$.store_address', '918 An Dương Vương, Thành phố Hòa Bình')
WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.source_phase')) = 'phase8'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.notification_group')) = 'staff_rx_queue'
  AND JSON_SEARCH(payload, 'one', '%918 An Dương Vương%') IS NULL;

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

-- =============================================================================
-- NẠP ĐÁNH GIÁ SẢN PHẨM MẪU (PRODUCT REVIEWS)
-- =============================================================================
USE mg_catalog;
DELETE FROM `product_reviews` WHERE `product_id` IN (1, 2, 3, 5, 10, 12, 15, 20, 22, 25, 30);

INSERT INTO `product_reviews` (`product_id`, `customer_id`, `rating`, `comment`, `status`, `created_at`, `updated_at`)
VALUES
  (1, 1, 5, 'Thuốc ho rất nhạy, bé nhà mình uống 2 ngày là đỡ hẳn. Sẽ ủng hộ nhà thuốc tiếp.', 'approved', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
  (1, 2, 4, 'Sản phẩm tốt, đóng gói cẩn thận, giao hàng nhanh.', 'approved', DATE_SUB(NOW(), INTERVAL 3 DAY), NOW()),
  (2, 3, 5, 'Máy xông khí dung dùng êm, dễ sử dụng cho cả người già và trẻ nhỏ.', 'approved', DATE_SUB(NOW(), INTERVAL 4 DAY), NOW()),
  (3, 4, 5, 'Máy trợ thính Mimitalara nghe rất rõ, không bị rè. Bố mình rất ưng ý.', 'approved', DATE_SUB(NOW(), INTERVAL 5 DAY), NOW()),
  (3, 5, 4, 'Chất lượng tốt so với tầm giá, nhân viên tư vấn nhiệt tình.', 'approved', DATE_SUB(NOW(), INTERVAL 1 DAY), NOW()),
  (5, 6, 5, 'Ống hít Cây Búa mùi thơm dễ chịu, giảm nghẹt mũi tức thì. Deal siêu khủng giá quá rẻ!', 'approved', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
  (5, 7, 5, 'Đóng gói đẹp, sản phẩm chất lượng, giao hàng siêu tốc.', 'approved', DATE_SUB(NOW(), INTERVAL 6 DAY), NOW()),
  (10, 8, 4, 'Sản phẩm dùng tốt, hiệu quả nhanh.', 'approved', DATE_SUB(NOW(), INTERVAL 3 DAY), NOW()),
  (12, 9, 5, 'Nước súc miệng thơm mát, sạch khuẩn. Rất đáng mua.', 'approved', DATE_SUB(NOW(), INTERVAL 4 DAY), NOW()),
  (15, 10, 5, 'Khẩu trang dày dặn, quai đeo êm tai không bị đau.', 'approved', DATE_SUB(NOW(), INTERVAL 5 DAY), NOW()),
  (20, 11, 4, 'Dược sĩ tư vấn rất kỹ về cách dùng thuốc kê đơn, thái độ phục vụ tốt.', 'approved', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
  (22, 12, 5, 'Men vi sinh tốt cho tiêu hóa, cải thiện tình trạng đầy hơi của mình.', 'approved', DATE_SUB(NOW(), INTERVAL 1 DAY), NOW()),
  (25, 13, 5, 'Vitamin tổng hợp dùng một tuần thấy người khỏe khoắn hơn hẳn.', 'approved', DATE_SUB(NOW(), INTERVAL 3 DAY), NOW()),
  (30, 14, 5, 'Kem bôi da giảm ngứa rất nhanh, bôi vào mát dịu.', 'approved', DATE_SUB(NOW(), INTERVAL 4 DAY), NOW())
ON DUPLICATE KEY UPDATE `comment` = VALUES(`comment`);

SET SQL_MODE = @PH11_OLD_SQL_MODE;
