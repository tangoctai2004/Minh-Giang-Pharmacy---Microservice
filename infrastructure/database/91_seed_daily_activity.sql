-- Phase 12 daily pharmacy activity seed.
-- Adds today's inbound stock, POS/web sales, stock outflows, loyalty and notifications.

SET NAMES utf8mb4;
SET @PH12_OLD_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = '';

DELIMITER $$

DROP PROCEDURE IF EXISTS mg_order.seed_phase12_today_pharmacy_activity $$
CREATE PROCEDURE mg_order.seed_phase12_today_pharmacy_activity()
BEGIN
  DECLARE today_key VARCHAR(8);
  DECLARE customer_count INT DEFAULT 0;
  DECLARE sellable_product_count INT DEFAULT 0;
  DECLARE supplier_count INT DEFAULT 0;
  DECLARE location_count INT DEFAULT 0;
  DECLARE order_template_sms INT DEFAULT NULL;
  DECLARE order_template_email INT DEFAULT NULL;
  DECLARE staff_template INT DEFAULT NULL;

  SET today_key = DATE_FORMAT(CURDATE(), '%Y%m%d');

  SELECT COUNT(*) INTO customer_count FROM mg_identity.customers WHERE is_active = 1;
  SELECT COUNT(*) INTO supplier_count FROM mg_catalog.suppliers WHERE status = 'active';
  SELECT COUNT(*) INTO location_count FROM mg_catalog.locations WHERE is_active = 1;

  SELECT COUNT(*) INTO sellable_product_count
  FROM mg_catalog.products p
  WHERE p.status = 'active'
    AND p.requires_prescription = 0
    AND EXISTS (
      SELECT 1
      FROM mg_catalog.batch_items bi
      WHERE bi.product_id = p.id
        AND bi.status IN ('available', 'near_expiry')
        AND bi.quantity_remaining >= 5
    );

  IF customer_count = 0 OR supplier_count = 0 OR location_count = 0 OR sellable_product_count < 60 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 12 seed requires customers, suppliers, locations and sellable products.';
  END IF;

  SELECT id INTO order_template_sms
  FROM mg_notification.notification_templates
  WHERE name = 'order_status_update' AND channel = 'sms' AND is_active = 1
  LIMIT 1;

  SELECT id INTO order_template_email
  FROM mg_notification.notification_templates
  WHERE name = 'order_status_update' AND channel = 'email' AND is_active = 1
  LIMIT 1;

  SELECT id INTO staff_template
  FROM mg_notification.notification_templates
  WHERE name = 'staff_pending_order' AND channel = 'in_app' AND is_active = 1
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM mg_order.orders
    WHERE order_code LIKE CONCAT('PH12-%-', today_key, '-%')
  ) THEN
    START TRANSACTION;

    CREATE TEMPORARY TABLE tmp_ph12_suppliers AS
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM mg_catalog.suppliers
    WHERE status = 'active';

    CREATE TEMPORARY TABLE tmp_ph12_locations AS
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM mg_catalog.locations
    WHERE is_active = 1;

    CREATE TEMPORARY TABLE tmp_ph12_customers AS
    SELECT id, full_name, phone, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM mg_identity.customers
    WHERE is_active = 1;

    CREATE TEMPORARY TABLE tmp_ph12_products AS
    SELECT
      p.id,
      p.name,
      p.retail_price,
      p.cost_price,
      p.base_unit,
      ROW_NUMBER() OVER (ORDER BY p.sales_volume DESC, p.id) AS rn
    FROM mg_catalog.products p
    WHERE p.status = 'active'
      AND p.requires_prescription = 0
      AND EXISTS (
        SELECT 1
        FROM mg_catalog.batch_items bi
        WHERE bi.product_id = p.id
          AND bi.status IN ('available', 'near_expiry')
          AND bi.quantity_remaining >= 5
      );

    CREATE TEMPORARY TABLE tmp_ph12_batch_seed AS
    SELECT
      n,
      CONVERT(CONCAT('PH12-IN-', today_key, '-', LPAD(n, 3, '0')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS batch_code,
      1 + MOD(n, supplier_count) AS supplier_rn
    FROM (
      SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3
    ) seq;

    INSERT INTO mg_catalog.batches (
      batch_code, supplier_id, delivery_person, received_date,
      total_amount, paid_amount, status, notes, created_by, invoice_number, created_at, updated_at
    )
    SELECT
      seed.batch_code,
      s.id,
      ELT(seed.n, 'Nguyễn Văn Hậu', 'Trần Minh Quân', 'Lê Thanh Duy'),
      CURDATE(),
      0,
      0,
      'completed',
      'Seed Phase 12 - nhập hàng bổ sung trong ngày tại Nhà Thuốc Minh Giang.',
      2,
      CONCAT('INV-PH12-', today_key, '-', LPAD(seed.n, 3, '0')),
      TIMESTAMP(CURDATE(), MAKETIME(7 + seed.n, 15, 0)),
      NOW()
    FROM tmp_ph12_batch_seed seed
    JOIN tmp_ph12_suppliers s ON s.rn = seed.supplier_rn;

    CREATE TEMPORARY TABLE tmp_ph12_inbound_items AS
    SELECT
      b.id AS batch_id,
      p.id AS product_id,
      p.cost_price,
      40 + MOD(seed.n * 17, 80) AS quantity_received,
      1 + MOD(seed.n, location_count) AS location_rn,
      CONCAT('PH12-', today_key, '-LOT-', LPAD(seed.n, 3, '0')) AS lot_number,
      TIMESTAMP(CURDATE(), MAKETIME(8 + MOD(seed.n, 3), MOD(seed.n * 7, 60), 0)) AS created_at
    FROM (
      SELECT ones.n + tens.n * 10 + 1 AS n
      FROM (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) ones
      JOIN (SELECT 0 n UNION ALL SELECT 1) tens
    ) seed
    JOIN tmp_ph12_batch_seed bs ON bs.n = 1 + MOD(seed.n, 3)
    JOIN mg_catalog.batches b ON b.batch_code = bs.batch_code
    JOIN tmp_ph12_products p ON p.rn = 1 + MOD(seed.n * 11, sellable_product_count)
    WHERE seed.n <= 20;

    INSERT INTO mg_catalog.batch_items (
      batch_id, product_id, lot_number, manufacture_date, expiry_date,
      quantity_received, quantity_remaining, cost_price,
      clearance_discount_pct, clearance_price, location_id, status
    )
    SELECT
      item.batch_id,
      item.product_id,
      item.lot_number,
      DATE_SUB(CURDATE(), INTERVAL 45 + MOD(item.product_id, 90) DAY),
      DATE_ADD(CURDATE(), INTERVAL 420 + MOD(item.product_id, 360) DAY),
      item.quantity_received,
      item.quantity_received,
      item.cost_price,
      0,
      NULL,
      loc.id,
      'available'
    FROM tmp_ph12_inbound_items item
    JOIN tmp_ph12_locations loc ON loc.rn = item.location_rn;

    INSERT INTO mg_catalog.stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH12-IN-MOV-', LPAD(bi.id, 8, '0')),
      bi.id,
      bi.product_id,
      'inbound',
      bi.quantity_received,
      'batch',
      bi.batch_id,
      'Seed Phase 12 - nhập hàng trong ngày.',
      2,
      inbound.created_at
    FROM tmp_ph12_inbound_items inbound
    JOIN mg_catalog.batch_items bi
      ON bi.batch_id = inbound.batch_id
     AND bi.product_id = inbound.product_id
     AND bi.lot_number = inbound.lot_number;

    UPDATE mg_catalog.batches b
    JOIN (
      SELECT batch_id, SUM(quantity_received * cost_price) AS total_amount
      FROM mg_catalog.batch_items
      WHERE lot_number LIKE CONCAT('PH12-', today_key, '-LOT-%')
      GROUP BY batch_id
    ) totals ON totals.batch_id = b.id
    SET b.total_amount = totals.total_amount,
        b.paid_amount = totals.total_amount
    WHERE b.batch_code LIKE CONCAT('PH12-IN-', today_key, '-%');

    CREATE TEMPORARY TABLE tmp_ph12_order_seed AS
    SELECT
      n,
      CONVERT(CONCAT(CASE WHEN n <= 24 THEN 'PH12-POS-' ELSE 'PH12-WEB-' END, today_key, '-', LPAD(n, 3, '0')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS order_code,
      CASE WHEN n <= 24 THEN 'pos' ELSE 'web' END AS order_channel,
      1 + MOD(n * 5, customer_count) AS customer_rn,
      CASE
        WHEN n <= 20 THEN 'completed'
        WHEN n <= 24 THEN 'confirmed'
        WHEN n <= 28 THEN 'shipping'
        WHEN n <= 32 THEN 'completed'
        ELSE 'pending_approval'
      END AS order_status,
      TIMESTAMP(CURDATE(), MAKETIME(8 + FLOOR(n / 4), MOD(n * 11, 60), 0)) AS created_at,
      1 + MOD(n, 8) AS distance_km
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

    INSERT INTO mg_order.orders (
      order_code, order_channel, customer_id, customer_name, customer_phone,
      shipping_address, staff_id, kiosk_id, shift_id, subtotal, shipping_fee,
      discount_amount, total_amount, payment_method, payment_status, order_status,
      requires_vat_invoice, customer_notes, created_at, updated_at
    )
    SELECT
      seed.order_code,
      seed.order_channel,
      CASE WHEN seed.order_channel = 'web' OR MOD(seed.n, 3) <> 0 THEN c.id ELSE NULL END,
      CASE WHEN seed.order_channel = 'web' OR MOD(seed.n, 3) <> 0 THEN c.full_name ELSE 'Khách vãng lai' END,
      CASE WHEN seed.order_channel = 'web' OR MOD(seed.n, 3) <> 0 THEN c.phone ELSE NULL END,
      CASE
        WHEN seed.order_channel = 'web' THEN CONCAT(
          ELT(1 + MOD(seed.n, 8), '918', '72', '105', '156', '203', '44', '31', '128'),
          ' đường ',
          ELT(1 + MOD(seed.n, 7), 'An Dương Vương', 'Cù Chính Lan', 'Trần Hưng Đạo', 'Chi Lăng', 'Lê Thánh Tông', 'Đà Giang', 'Điện Biên Phủ'),
          ', ',
          ELT(1 + MOD(seed.n, 5), 'Phường Hữu Nghị', 'Phường Đồng Tiến', 'Phường Phương Lâm', 'Phường Tân Thịnh', 'Phường Dân Chủ'),
          ', Thành phố Hòa Bình, Tỉnh Hòa Bình | Ship từ Nhà Thuốc Minh Giang - 918 An Dương Vương, Thành phố Hòa Bình | Khoảng cách ước tính: ',
          seed.distance_km, 'km'
        )
        ELSE 'Khách mua trực tiếp tại Nhà Thuốc Minh Giang - 918 An Dương Vương, Thành phố Hòa Bình'
      END,
      CASE WHEN seed.order_channel = 'pos' THEN 3 ELSE NULL END,
      CASE WHEN seed.order_channel = 'pos' THEN CONCAT('KIOSK-', 1 + MOD(seed.n, 3)) ELSE NULL END,
      NULL,
      50000,
      0,
      CASE WHEN MOD(seed.n, 9) = 0 THEN 10000 ELSE 0 END,
      50000,
      CASE
        WHEN seed.order_channel = 'pos' THEN ELT(1 + MOD(seed.n, 3), 'cash', 'card_visa', 'qr_transfer')
        ELSE 'cod'
      END,
      CASE WHEN seed.order_status = 'pending_approval' THEN 'pending' ELSE 'paid' END,
      seed.order_status,
      0,
      CASE
        WHEN seed.order_channel = 'web' THEN 'Đơn phát sinh hôm nay trong khu vực giao hàng Hòa Bình.'
        ELSE 'Giao dịch POS phát sinh hôm nay tại quầy.'
      END,
      seed.created_at,
      seed.created_at
    FROM tmp_ph12_order_seed seed
    JOIN tmp_ph12_customers c ON c.rn = seed.customer_rn;

    CREATE TEMPORARY TABLE tmp_ph12_orders AS
    SELECT
      o.*,
      ROW_NUMBER() OVER (ORDER BY o.id) AS rn
    FROM mg_order.orders o
    WHERE o.order_code LIKE CONCAT('PH12-%-', today_key, '-%');

    CREATE TEMPORARY TABLE tmp_ph12_sale_items AS
    SELECT
      o.id AS order_id,
      o.rn AS order_rn,
      line_no,
      p.id AS product_id,
      p.name AS product_name,
      p.base_unit,
      p.retail_price,
      1 + MOD(o.rn + line_no, 2) AS quantity
    FROM tmp_ph12_orders o
    JOIN (SELECT 1 line_no UNION ALL SELECT 2) ln
    JOIN tmp_ph12_products p ON p.rn = 1 + MOD(o.rn * 7 + ln.line_no * 13, sellable_product_count);

    CREATE TEMPORARY TABLE tmp_ph12_sale_items_batched AS
    SELECT
      seed.*,
      bi.id AS batch_item_id,
      bi.lot_number
    FROM tmp_ph12_sale_items seed
    JOIN (
      SELECT ranked.*
      FROM (
        SELECT
          bi.*,
          ROW_NUMBER() OVER (PARTITION BY bi.product_id ORDER BY bi.expiry_date ASC, bi.id ASC) AS rn
        FROM mg_catalog.batch_items bi
        WHERE bi.status IN ('available', 'near_expiry')
          AND bi.quantity_remaining >= 5
      ) ranked
      WHERE ranked.rn = 1
    ) bi ON bi.product_id = seed.product_id;

    INSERT INTO mg_order.order_items (
      order_id, product_id, product_name, unit_name, quantity,
      unit_price, total_price, batch_item_id, lot_number, prescription_id
    )
    SELECT
      order_id,
      product_id,
      product_name,
      base_unit,
      quantity,
      retail_price,
      quantity * retail_price,
      batch_item_id,
      lot_number,
      NULL
    FROM tmp_ph12_sale_items_batched;

    UPDATE mg_order.orders o
    JOIN (
      SELECT order_id, SUM(total_price) AS subtotal
      FROM mg_order.order_items
      WHERE order_id IN (SELECT id FROM tmp_ph12_orders)
      GROUP BY order_id
    ) totals ON totals.order_id = o.id
    SET
      o.subtotal = totals.subtotal,
      o.shipping_fee = CASE
        WHEN o.order_channel = 'web' AND totals.subtotal >= 300000 THEN 0
        WHEN o.order_channel = 'web' THEN 15000
        ELSE 0
      END,
      o.total_amount = GREATEST(0, totals.subtotal + CASE
        WHEN o.order_channel = 'web' AND totals.subtotal >= 300000 THEN 0
        WHEN o.order_channel = 'web' THEN 15000
        ELSE 0
      END - o.discount_amount),
      o.updated_at = o.created_at
    WHERE o.order_code LIKE CONCAT('PH12-%-', today_key, '-%');

    INSERT INTO mg_catalog.stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH12-OUT-', LPAD(oi.id, 8, '0')),
      oi.batch_item_id,
      oi.product_id,
      'outbound_sale',
      -oi.quantity,
      CASE WHEN o.order_channel = 'pos' THEN 'pos_order' ELSE 'web_order' END,
      o.id,
      'Seed Phase 12 - xuất kho bán thuốc hôm nay.',
      COALESCE(o.staff_id, 2),
      o.created_at
    FROM mg_order.order_items oi
    JOIN mg_order.orders o ON o.id = oi.order_id
    WHERE o.order_code LIKE CONCAT('PH12-%-', today_key, '-%')
      AND o.order_status IN ('picking', 'shipping', 'completed');

    UPDATE mg_catalog.batch_items bi
    JOIN (
      SELECT oi.batch_item_id, SUM(oi.quantity) AS sold_qty
      FROM mg_order.order_items oi
      JOIN mg_order.orders o ON o.id = oi.order_id
      WHERE o.order_code LIKE CONCAT('PH12-%-', today_key, '-%')
        AND o.order_status IN ('picking', 'shipping', 'completed')
      GROUP BY oi.batch_item_id
    ) sold ON sold.batch_item_id = bi.id
    SET
      bi.quantity_remaining = GREATEST(0, bi.quantity_remaining - sold.sold_qty),
      bi.status = CASE
        WHEN GREATEST(0, bi.quantity_remaining - sold.sold_qty) = 0 THEN 'depleted'
        WHEN bi.expiry_date < CURDATE() THEN 'expired'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90 THEN 'near_expiry'
        ELSE bi.status
      END;

    INSERT INTO mg_identity.loyalty_points_transactions (
      customer_id, transaction_type, points_change, description, reference_order_id, created_at
    )
    SELECT
      o.customer_id,
      'earn_purchase',
      FLOOR(o.total_amount / 10000),
      CONCAT('Tích điểm mua hàng hôm nay tại Minh Giang - Đơn ', o.order_code),
      o.id,
      o.created_at
    FROM mg_order.orders o
    WHERE o.order_code LIKE CONCAT('PH12-%-', today_key, '-%')
      AND o.customer_id IS NOT NULL
      AND o.order_status = 'completed'
      AND FLOOR(o.total_amount / 10000) > 0;

    UPDATE mg_identity.customers c
    JOIN (
      SELECT customer_id, SUM(FLOOR(total_amount / 10000)) AS points
      FROM mg_order.orders
      WHERE order_code LIKE CONCAT('PH12-%-', today_key, '-%')
        AND customer_id IS NOT NULL
        AND order_status = 'completed'
      GROUP BY customer_id
    ) earned ON earned.customer_id = c.id
    SET c.loyalty_points = c.loyalty_points + earned.points;

    IF order_template_sms IS NOT NULL AND order_template_email IS NOT NULL THEN
      INSERT INTO mg_notification.notifications (
        template_id, recipient_type, recipient_id, channel,
        reference_type, reference_id, payload, status, sent_at, created_at
      )
      SELECT
        CASE WHEN o.order_channel = 'web' THEN order_template_email ELSE order_template_sms END,
        'customer',
        o.customer_id,
        CASE WHEN o.order_channel = 'web' THEN 'email' ELSE 'sms' END,
        'order',
        o.id,
        JSON_OBJECT(
          'source_phase', 'phase12_today',
          'order_code', o.order_code,
          'order_status', o.order_status,
          'order_channel', o.order_channel,
          'customer_name', o.customer_name,
          'store_address', '918 An Dương Vương, Thành phố Hòa Bình',
          'total_amount', o.total_amount
        ),
        CASE WHEN o.order_status = 'pending_approval' THEN 'pending' ELSE 'sent' END,
        CASE WHEN o.order_status = 'pending_approval' THEN NULL ELSE DATE_ADD(o.created_at, INTERVAL 5 MINUTE) END,
        DATE_ADD(o.created_at, INTERVAL 2 MINUTE)
      FROM mg_order.orders o
      WHERE o.order_code LIKE CONCAT('PH12-%-', today_key, '-%')
        AND o.customer_id IS NOT NULL;
    END IF;

    IF staff_template IS NOT NULL THEN
      INSERT INTO mg_notification.notifications (
        template_id, recipient_type, recipient_id, channel,
        reference_type, reference_id, payload, status, sent_at, created_at
      )
      SELECT
        staff_template,
        'staff',
        2,
        'in_app',
        'order',
        o.id,
        JSON_OBJECT(
          'source_phase', 'phase12_today',
          'notification_group', 'today_staff_order_queue',
          'order_code', o.order_code,
          'order_status', o.order_status,
          'order_channel', o.order_channel,
          'store_address', '918 An Dương Vương, Thành phố Hòa Bình'
        ),
        'pending',
        NULL,
        DATE_ADD(o.created_at, INTERVAL 1 MINUTE)
      FROM mg_order.orders o
      WHERE o.order_code LIKE CONCAT('PH12-%-', today_key, '-%')
        AND o.order_status IN ('pending_approval', 'confirmed', 'shipping');
    END IF;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL mg_order.seed_phase12_today_pharmacy_activity();
DROP PROCEDURE IF EXISTS mg_order.seed_phase12_today_pharmacy_activity;
SET SQL_MODE = @PH12_OLD_SQL_MODE;
