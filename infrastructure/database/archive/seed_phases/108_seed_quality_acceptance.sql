-- Phase 9 seed quality acceptance checks.
-- This file intentionally fails when the demo dataset violates core pharmacy rules.

SET NAMES utf8mb4;
SET @PH9_OLD_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = '';

DELIMITER $$

DROP PROCEDURE IF EXISTS mg_notification.seed_phase9_quality_acceptance $$
CREATE PROCEDURE mg_notification.seed_phase9_quality_acceptance()
BEGIN
  CREATE TEMPORARY TABLE tmp_phase9_checks (
    check_name VARCHAR(120) NOT NULL,
    failed_count BIGINT NOT NULL,
    details VARCHAR(500) NOT NULL
  );

  INSERT INTO tmp_phase9_checks
  SELECT
    'catalog_active_product_count',
    CASE WHEN COUNT(*) = 3000 THEN 0 ELSE 1 END,
    CONCAT('active_products=', COUNT(*), ', expected=3000')
  FROM mg_catalog.products
  WHERE status = 'active';

  INSERT INTO tmp_phase9_checks
  SELECT
    'catalog_active_required_fields',
    COUNT(*),
    'Active products must have manufacturer, active_ingredient and registration_number'
  FROM mg_catalog.products
  WHERE status = 'active'
    AND (
      manufacturer IS NULL OR manufacturer = ''
      OR active_ingredient IS NULL OR active_ingredient = ''
      OR registration_number IS NULL OR registration_number = ''
    );

  INSERT INTO tmp_phase9_checks
  SELECT
    'catalog_old_brand_text',
    (
      SELECT COUNT(*) FROM mg_catalog.products
      WHERE BINARY name LIKE '%Trung Sơn%' OR BINARY name LIKE '%Trung Son%'
         OR BINARY description LIKE '%Trung Sơn%' OR BINARY description LIKE '%Trung Son%'
         OR BINARY tags LIKE '%trungson%'
    )
    + (
      SELECT COUNT(*) FROM mg_cms.articles
      WHERE BINARY title LIKE '%Trung Sơn%' OR BINARY title LIKE '%Trung Son%'
         OR BINARY content LIKE '%Trung Sơn%' OR BINARY content LIKE '%Trung Son%'
         OR BINARY tags LIKE '%trungson%'
    ),
    'Visible seed text must use Minh Giang branding'
  ;

  INSERT INTO tmp_phase9_checks
  SELECT
    'catalog_source_trace_cleanup',
    (
      SELECT COUNT(*) FROM mg_catalog.products
      WHERE sku LIKE 'TS-%'
         OR manufacturer LIKE '%đang cập nhật%'
         OR manufacturer LIKE '%dang cap nhat%'
    )
    + (
      SELECT COUNT(*) FROM mg_catalog.product_specifications
      WHERE spec_key = 'Nguồn dữ liệu'
         OR spec_value LIKE '%trungsoncare.com%'
    )
    + (
      SELECT COUNT(*) FROM mg_cms.articles
      WHERE thumbnail_url LIKE '%trungsoncare.com%'
    )
    + (
      SELECT COUNT(*) FROM mg_catalog.products
      WHERE UPPER(TRIM(manufacturer)) LIKE 'CTY%'
         OR UPPER(TRIM(manufacturer)) IN (
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
        'CÔNG TY CỔ PHẦN DƯỢC',
        'CÔNG TY CỔ PHẦN',
        'CÔNG TY CỔ PHẦN TẬP',
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
    ),
    'Catalog SKU/source metadata and CMS thumbnails must not expose blocked reference-source traces'
  ;

  INSERT INTO tmp_phase9_checks
  SELECT
    'inventory_quantity_bounds',
    COUNT(*),
    'Batch remaining quantity must stay between 0 and received quantity'
  FROM mg_catalog.batch_items
  WHERE quantity_remaining < 0
     OR quantity_remaining > quantity_received;

  INSERT INTO tmp_phase9_checks
  SELECT
    'inventory_expired_not_sellable',
    COUNT(*),
    'Expired batches must not be available or near_expiry'
  FROM mg_catalog.batch_items
  WHERE expiry_date < CURDATE()
    AND status IN ('available', 'near_expiry')
    AND quantity_remaining > 0;

  INSERT INTO tmp_phase9_checks
  SELECT
    'product_unit_barcode_quality',
    (
      SELECT COUNT(*) FROM mg_catalog.product_units
      WHERE barcode IS NULL OR barcode = '' OR retail_price <= 0 OR conversion_qty <= 0
    )
    + (
      SELECT COUNT(*)
      FROM mg_catalog.product_units pu
      JOIN mg_catalog.products p ON p.barcode = pu.barcode
    )
    + (
      SELECT COUNT(*)
      FROM (
        SELECT barcode
        FROM mg_catalog.product_units
        GROUP BY barcode
        HAVING COUNT(*) > 1
      ) dup
    ),
    'Product unit barcode/price/conversion must be valid and unique'
  ;

  INSERT INTO tmp_phase9_checks
  SELECT
    'customer_address_scope',
    COUNT(*),
    'Seed customers must be scoped to Thanh pho Hoa Binh'
  FROM mg_identity.customer_addresses
  WHERE province <> 'Tỉnh Hòa Bình'
     OR district <> 'Thành phố Hòa Bình';

  INSERT INTO tmp_phase9_checks
  SELECT
    'delivery_config_scope',
    CASE
      WHEN COUNT(*) > 0
       AND MIN(max_delivery_radius_km) = 8.0
       AND MIN(is_enabled) = 1 THEN 0
      ELSE 1
    END,
    'Delivery config must be enabled with 8km max radius from 918 An Duong Vuong'
  FROM mg_catalog.delivery_config;

  INSERT INTO tmp_phase9_checks
  SELECT
    'web_order_shipping_scope',
    COUNT(*),
    'Web orders must ship only in Hoa Binh scope'
  FROM mg_order.orders
  WHERE order_code LIKE 'PH5-%'
    AND order_channel = 'web'
    AND shipping_address NOT LIKE '%Hòa Bình%';

  INSERT INTO tmp_phase9_checks
  SELECT
    'order_total_consistency',
    COUNT(*),
    'Order subtotal and total_amount must match order_items'
  FROM mg_order.orders o
  JOIN (
    SELECT order_id, SUM(total_price) AS item_subtotal
    FROM mg_order.order_items
    GROUP BY order_id
  ) totals ON totals.order_id = o.id
  WHERE o.order_code LIKE 'PH5-%'
    AND (
      ABS(o.subtotal - totals.item_subtotal) > 0.01
      OR ABS(o.total_amount - GREATEST(0, totals.item_subtotal + o.shipping_fee - o.discount_amount)) > 0.01
    );

  INSERT INTO tmp_phase9_checks
  SELECT
    'prescription_dispensing_rules',
    (
      SELECT COUNT(*)
      FROM mg_order.order_items oi
      JOIN mg_order.prescriptions pr ON pr.id = oi.prescription_id
      WHERE pr.status <> 'verified'
         OR pr.expiry_date < CURDATE()
         OR pr.dispensed_qty > pr.max_dispensing_qty
    ),
    'Rx order items must use verified, unexpired prescriptions within dispensing limit'
  ;

  INSERT INTO tmp_phase9_checks
  SELECT
    'return_rules',
    (
      SELECT COUNT(*)
      FROM mg_order.return_items ri
      JOIN mg_order.returns r ON r.id = ri.return_id
      JOIN mg_order.order_items oi ON oi.id = ri.order_item_id
      WHERE (r.return_code LIKE 'PH7-RET-%' OR r.return_code LIKE 'PH7-MIX-%')
        AND (
          oi.prescription_id IS NOT NULL
          OR ri.quantity_returned > oi.quantity
          OR (r.status <> 'completed' AND ri.return_to_stock = 1)
          OR (r.status = 'rejected' AND r.refund_amount <> 0)
        )
    ),
    'Returns must not break Rx, quantity, refund or restock rules'
  ;

  INSERT INTO tmp_phase9_checks
  SELECT
    'notification_template_count',
    CASE WHEN COUNT(*) >= 10 THEN 0 ELSE 1 END,
    CONCAT('templates=', COUNT(*), ', expected>=10')
  FROM mg_notification.notification_templates;

  INSERT INTO tmp_phase9_checks
  SELECT
    'notification_references',
    (
      SELECT COUNT(*)
      FROM mg_notification.notifications n
      LEFT JOIN mg_notification.notification_templates t ON t.id = n.template_id
      WHERE JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.source_phase')) = 'phase8'
        AND t.id IS NULL
    )
    + (
      SELECT COUNT(*)
      FROM mg_notification.notifications n
      LEFT JOIN mg_order.orders o ON o.id = n.reference_id
      WHERE JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.source_phase')) = 'phase8'
        AND n.reference_type IN ('order', 'delivery')
        AND o.id IS NULL
    )
    + (
      SELECT COUNT(*)
      FROM mg_notification.notifications n
      LEFT JOIN mg_order.prescriptions pr ON pr.id = n.reference_id
      WHERE JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.source_phase')) = 'phase8'
        AND n.reference_type = 'prescription'
        AND pr.id IS NULL
    )
    + (
      SELECT COUNT(*)
      FROM mg_notification.notifications n
      LEFT JOIN mg_order.returns r ON r.id = n.reference_id
      WHERE JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.source_phase')) = 'phase8'
        AND n.reference_type = 'return'
        AND r.id IS NULL
    )
    + (
      SELECT COUNT(*)
      FROM mg_notification.notifications n
      LEFT JOIN mg_catalog.batch_items bi ON bi.id = n.reference_id
      WHERE JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.source_phase')) = 'phase8'
        AND n.reference_type = 'batch_item'
        AND bi.id IS NULL
    ),
    'Notification templates and references must resolve'
  ;

  INSERT INTO tmp_phase9_checks
  SELECT
    'notification_payload_rules',
    (
      SELECT COUNT(*)
      FROM mg_notification.notifications
      WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.source_phase')) = 'phase8'
        AND JSON_SEARCH(payload, 'one', '%918 An Dương Vương%') IS NULL
    )
    + (
      SELECT COUNT(*)
      FROM mg_notification.notifications
      WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.source_phase')) = 'phase8'
        AND status = 'sent'
        AND sent_at IS NULL
    )
    + (
      SELECT COUNT(*)
      FROM mg_notification.notifications
      WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.source_phase')) = 'phase8'
        AND status = 'pending'
        AND sent_at IS NOT NULL
    ),
    'Phase 8 notifications must include store address and sane sent_at values'
  ;

  SELECT check_name, failed_count, details
  FROM tmp_phase9_checks
  ORDER BY failed_count DESC, check_name;

  IF EXISTS (SELECT 1 FROM tmp_phase9_checks WHERE failed_count > 0) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 9 seed quality acceptance failed. See failed_count values above.';
  END IF;
END $$

DELIMITER ;

CALL mg_notification.seed_phase9_quality_acceptance();
DROP PROCEDURE IF EXISTS mg_notification.seed_phase9_quality_acceptance;
SET SQL_MODE = @PH9_OLD_SQL_MODE;
