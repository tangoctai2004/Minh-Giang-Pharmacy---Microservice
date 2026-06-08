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
      DATE_SUB(NOW(), INTERVAL MOD(seed.n * 5, 90) DAY) AS created_at,
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
