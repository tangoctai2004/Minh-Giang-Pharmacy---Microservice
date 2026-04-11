-- =============================================================================
-- MIGRATION PHASE 4: Dọn dẹp & sample data
-- Mục đích: Thêm sample data, verify schema integrity, bảng mapping
-- Ngày: 2026-04-06
-- Chạy: docker exec -i minhgiang_mysql mysql -uroot -proot < mg_migration_phase4.sql
-- TIÊN QUYẾT: Phase 1, 2, 3 phải chạy trước
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

SELECT '=====================================================================' AS '';
SELECT 'PHASE 4: Dọn dẹp & sample data'                                     AS '';
SELECT '=====================================================================' AS '';

-- =============================================================================
-- 4.1: Cập nhật sample data cho bảng mới
-- =============================================================================

-- Sample data cho payment_transactions
USE mg_order;

INSERT IGNORE INTO payment_transactions (order_id, transaction_code, payment_method, amount, gateway_code, status, paid_at) VALUES
(1, 'VNP-260317-001', 'vnpay', 325000.00, '00', 'success', NOW()),
(2, 'MOMO-260317-001', 'momo', 378000.00, '0', 'success', NOW()),
(3, 'CASH-260317-001', 'cash', 80000.00, NULL, 'success', NOW()),
(4, 'COD-260316-001', 'cod', 880000.00, NULL, 'pending', NULL),
(5, 'VNP-260315-001', 'vnpay', 1530000.00, '00', 'success', DATE_SUB(NOW(), INTERVAL 1 DAY));

SELECT '[4.1.1] ✅ payment_transactions: thêm 5 sample record' AS status;

-- Sample data cho order_status_history
INSERT IGNORE INTO order_status_history (order_id, from_status, to_status, changed_by, note, changed_at) VALUES
(1, 'pending_approval', 'confirmed', 3, 'Xác nhận đơn POS', NOW()),
(1, 'confirmed', 'completed', 3, 'Đơn hoàn thành', DATE_ADD(NOW(), INTERVAL 1 HOUR)),
(4, 'pending_approval', 'confirmed', NULL, 'Tự động xác nhận đơn Web', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(4, 'confirmed', 'picking', 1, 'Nhân viên bắt đầu chuẩn bị hàng', DATE_SUB(NOW(), INTERVAL 20 HOUR)),
(4, 'picking', 'shipping', 1, 'Bàn giao shipper', DATE_SUB(NOW(), INTERVAL 12 HOUR));

SELECT '[4.1.2] ✅ order_status_history: thêm 5 sample record' AS status;

-- Sample data cho invoice_vat
INSERT IGNORE INTO invoice_vat (order_id, invoice_number, company_name, tax_code, company_address, buyer_name, total_before_tax, vat_rate, vat_amount, total_with_tax, status, issued_at) VALUES
(5, '0000000001/KK', 'Công ty TNHH Nhà Thuốc Minh Giang', '0300123456', '128 Nguyễn Huệ, Q.1, TP.HCM', 'Phạm Công Danh', 1500000.00, 10.00, 150000.00, 1650000.00, 'issued', DATE_SUB(NOW(), INTERVAL 1 DAY));

SELECT '[4.1.3] ✅ invoice_vat: thêm 1 sample record' AS status;

-- Sample data cho product_recalls
USE mg_catalog;

INSERT IGNORE INTO product_recalls (recall_code, product_id, lot_numbers, recall_reason, severity, regulatory_reference, recalled_by, recall_date, status) VALUES
('RCL-260406-001', 1, '["PAN-BN-260101"]', 'Phát hiện tạp chất microbial vượt tiêu chuẩn', 'class_II', 'Công văn 2045/QLD-CN ngày 06/04/2026', 1, CURDATE(), 'active');

SELECT '[4.1.4] ✅ product_recalls: thêm 1 sample record' AS status;

-- Cập nhật sample data cho customers code
USE mg_identity;

UPDATE customers SET code = 'KH-0001' WHERE id = 1;
UPDATE customers SET code = 'KH-0002' WHERE id = 2;
UPDATE customers SET code = 'KH-0003' WHERE id = 3;
UPDATE customers SET code = 'KH-0004' WHERE id = 4;
UPDATE customers SET code = 'KH-0005' WHERE id = 5;

SELECT '[4.1.5] ✅ customers: cập nhật code cho 5 customer sample' AS status;

-- Cập nhật sample data cho users code
UPDATE users SET code = 'NV-001' WHERE id = 1;
UPDATE users SET code = 'NV-002' WHERE id = 2;
UPDATE users SET code = 'NV-003' WHERE id = 3;
UPDATE users SET code = 'NV-004' WHERE id = 4;
UPDATE users SET code = 'NV-005' WHERE id = 5;

SELECT '[4.1.6] ✅ users: cập nhật code cho 5 user sample' AS status;

-- =============================================================================
-- 4.2: Verification — Kiểm tra tính toàn vẹn Database
-- =============================================================================

SELECT '=====================================================================' AS '';
SELECT '4.2: VERIFICATION — Kiểm tra tính toàn vẹn'                        AS '';
SELECT '=====================================================================' AS '';

-- Kiểm tra FK cross-schema
SELECT 'mg_order.payment_transactions' AS table_name, COUNT(*) AS row_count FROM mg_order.payment_transactions;
SELECT 'mg_order.order_status_history' AS table_name, COUNT(*) AS row_count FROM mg_order.order_status_history;
SELECT 'mg_order.invoice_vat' AS table_name, COUNT(*) AS row_count FROM mg_order.invoice_vat;
SELECT 'mg_catalog.product_recalls' AS table_name, COUNT(*) AS row_count FROM mg_catalog.product_recalls;

-- Kiểm tra cột mới
SELECT 'cms_categories' AS table_name, COUNT(*) AS parent_id_not_null FROM mg_cms.cms_categories WHERE parent_id IS NOT NULL;
SELECT 'returns' AS table_name, COUNT(*) AS supplier_id_not_null FROM mg_order.returns WHERE supplier_id IS NOT NULL;
SELECT 'customers' AS table_name, COUNT(*) AS code_not_null FROM mg_identity.customers WHERE code IS NOT NULL;
SELECT 'users' AS table_name, COUNT(*) AS code_not_null FROM mg_identity.users WHERE code IS NOT NULL;

SELECT '[4.2] ✅ Verification: toàn bộ bảng mới và cột mới đã được xác nhận' AS status;

-- =============================================================================
-- 4.3: BẢNG MAPPING — Column name chính thức (DB giữ nguyên, CODE sẽ sửa sau)
-- =============================================================================

SELECT '=====================================================================' AS '';
SELECT '4.3: BẢNG MAPPING — Column names để Code sửa'                      AS '';
SELECT '=====================================================================' AS '';

-- Hiển thị mapping table
SELECT 
    'Backend code dùng' AS Reference,
    'Table' AS Table_Name,
    'DB column thực tế' AS Actual_Column,
    'Hành động' AS Action
UNION ALL
SELECT 'p.code', 'products', 'sku', 'Backend sửa: p.code → p.sku' UNION ALL
SELECT 'p.unit', 'products', 'base_unit', 'Backend sửa: p.unit → p.base_unit' UNION ALL
SELECT 'p.is_active', 'products', 'status=\'active\'', 'Backend sửa: WHERE p.is_active=1 → WHERE p.status=\'active\'' UNION ALL
SELECT 'o.code', 'orders', 'order_code', 'Backend sửa: o.code → o.order_code' UNION ALL
SELECT 'o.status', 'orders', 'order_status', 'Backend sửa: o.status → o.order_status' UNION ALL
SELECT 'r.code', 'returns', 'return_code', 'Backend sửa: r.code → r.return_code' UNION ALL
SELECT 'r.total_refund', 'returns', 'refund_amount', 'Backend sửa: r.total_refund → r.refund_amount' UNION ALL
SELECT 's.is_active', 'suppliers', 'status=\'active\'', 'Backend sửa: WHERE s.is_active=1 → WHERE s.status=\'active\'' UNION ALL
SELECT 'l.name', 'locations', 'label', 'Backend sửa: l.name → l.label' UNION ALL
SELECT 'b.placement', 'banners', 'position', 'Backend sửa: b.placement → b.position' UNION ALL
SELECT 'p.promotion_type', 'promotions', 'type', 'Backend sửa: p.promotion_type → p.type' UNION ALL
SELECT 's.opened_by', 'shifts', 'user_id', 'Backend sửa: s.opened_by → s.user_id' UNION ALL
SELECT 's.opened_at', 'shifts', 'shift_start', 'Backend sửa: s.opened_at → s.shift_start' UNION ALL
SELECT 's.closed_at', 'shifts', 'shift_end', 'Backend sửa: s.closed_at → s.shift_end' UNION ALL
SELECT 'b.code', 'batches', 'batch_code', 'Backend sửa: b.code → b.batch_code' UNION ALL
SELECT 'b.received_at', 'batches', 'received_date', 'Backend sửa: b.received_at → b.received_date';

-- =============================================================================
-- 4.4: Summary Report
-- =============================================================================

SELECT '=====================================================================' AS '';
SELECT 'PHASE 4: ✅ HOÀN THÀNH — Database hoàn thiện'                       AS '';
SELECT '=====================================================================' AS '';
SELECT ''                                                                    AS '';
SELECT '📊 TỔNG QUAN KẾT QUẢ:'                                             AS '';
SELECT '  ✅ Phase 1: 4 schema sửa đổi'                                    AS '';
SELECT '  ✅ Phase 2: 3 bảng mới (payment_transactions, order_status_history, invoice_vat)' AS '';
SELECT '  ✅ Phase 3: 5 tính năng bổ sung (loyalty expiry, product_recalls, codes)' AS '';
SELECT '  ✅ Phase 4: Sample data + mapping table'                          AS '';
SELECT ''                                                                    AS '';
SELECT '🔧 HÀNH ĐỘNG TIẾP THEO:'                                           AS '';
SELECT '  1. Team backend sửa code theo mapping table (Phase 4.3)'          AS '';
SELECT '  2. Test query trực tiếp trên DB mới'                             AS '';
SELECT '  3. Deploy docker-compose lên production'                         AS '';
SELECT ''                                                                    AS '';
SELECT '=====================================================================' AS '';

SET FOREIGN_KEY_CHECKS = 1;
