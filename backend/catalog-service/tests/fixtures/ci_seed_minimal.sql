USE mg_catalog;

INSERT INTO categories (id, name, slug, parent_id, is_active, sort_order)
VALUES
  (1000, 'Thuoc', 'thuoc', NULL, 1, 1),
  (1100, 'Thuoc da day', 'thuoc-da-day', 1000, 1, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), slug = VALUES(slug), parent_id = VALUES(parent_id), is_active = 1;

INSERT INTO suppliers (id, code, name, status)
VALUES (1, 'SUP-001', 'Nha cung cap mac dinh', 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'active';

INSERT INTO products (
  id, sku, name, category_id, requires_prescription, base_unit, retail_price, cost_price, min_stock_alert, status, barcode
)
VALUES
  (1, 'MED-0001', 'San pham mac dinh', 1100, 0, 'Hop', 100000, 70000, 5, 'active', '8930000000001')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category_id = VALUES(category_id),
  requires_prescription = VALUES(requires_prescription),
  base_unit = VALUES(base_unit),
  retail_price = VALUES(retail_price),
  status = 'active',
  barcode = VALUES(barcode);

INSERT INTO batches (
  id, batch_code, supplier_id, received_date, total_amount, paid_amount, status, created_by
)
VALUES
  (1, 'PO-CI-0001', 1, CURDATE(), 500000, 500000, 'completed', 1)
ON DUPLICATE KEY UPDATE
  supplier_id = VALUES(supplier_id),
  received_date = VALUES(received_date),
  total_amount = VALUES(total_amount),
  paid_amount = VALUES(paid_amount),
  status = VALUES(status);

INSERT INTO batch_items (
  batch_id, product_id, lot_number, expiry_date, quantity_received, quantity_remaining, cost_price, status
)
SELECT 1, 1, 'LOT-CI-0001', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 100, 80, 70000, 'available'
WHERE NOT EXISTS (
  SELECT 1 FROM batch_items WHERE batch_id = 1 AND product_id = 1 AND lot_number = 'LOT-CI-0001'
);

INSERT INTO catalog_vouchers
  (id, code, name, discount_type, discount_value, min_order_amount, usage_count, usage_limit, valid_from, valid_to, status)
VALUES
  (1, 'MINGIANG50', 'Giam 50k don tu 300k', 'fixed', 50000, 300000, 0, 200, '2026-01-01', '2028-12-31', 'active')
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  name = VALUES(name),
  status = 'active',
  valid_to = VALUES(valid_to),
  usage_count = 0;

INSERT INTO catalog_loyalty_config (id, tiers, redemption, channels)
VALUES
  (
    1,
    JSON_ARRAY(
      JSON_OBJECT('tier', 'bronze', 'points_per_10k', 1, 'min_spend', 0),
      JSON_OBJECT('tier', 'silver', 'points_per_10k', 1.5, 'min_spend', 2000000)
    ),
    JSON_OBJECT('points_to_vnd_rate', 1000, 'min_points_redeem', 100, 'max_value_per_order', 200000),
    JSON_OBJECT('web', true, 'pos', true)
  )
ON DUPLICATE KEY UPDATE
  tiers = VALUES(tiers),
  redemption = VALUES(redemption),
  channels = VALUES(channels);
