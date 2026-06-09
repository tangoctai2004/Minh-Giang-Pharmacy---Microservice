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
        CONCAT('PH2-PO-', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL MOD(batch_no, 180) DAY), '%y%m%d'), '-', LPAD(batch_no, 4, '0')),
        supplier_for_batch,
        ELT(1 + MOD(batch_no, 8),
          'Nguyễn Minh Khang', 'Trần Gia Huy', 'Lê Bảo An', 'Phạm Thanh Bình',
          'Đỗ Hoàng Nam', 'Võ Minh Quân', 'Bùi Quốc Việt', 'Hoàng Anh Tú'
        ),
        DATE_SUB(CURDATE(), INTERVAL MOD(batch_no, 180) DAY),
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
      ON b.batch_code = CONCAT('PH2-PO-', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL MOD(seeded.batch_no, 180) DAY), '%y%m%d'), '-', LPAD(seeded.batch_no, 4, '0'))
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
