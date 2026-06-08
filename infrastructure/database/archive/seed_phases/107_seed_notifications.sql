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
