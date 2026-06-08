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
