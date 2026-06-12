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
      DATE_SUB(NOW(), INTERVAL MOD(n * 5, 150) DAY) AS order_time,
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
