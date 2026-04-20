-- =============================================================================
-- INIT SCRIPT: Khởi tạo toàn bộ database cho Hệ thống Nhà Thuốc Minh Giang
-- Phiên bản: 2.0 (Clean Schemas + Integrated Security Patches)
-- =============================================================================
--
-- Thứ tự thực thi:
--   1. mg_identity.sql     — users, customers, roles, shifts, loyalty, otp
--   2. mg_catalog.sql      — products, batches, locations, suppliers, brands
--   3. mg_order.sql        — carts, orders, order_items, returns, prescriptions
--   4. mg_cms.sql          — articles, banners, promotions, store_config
--   5. mg_notification.sql — templates, notifications
--
-- Lưu ý: Dữ liệu mẫu không còn nằm trong các file này. 
-- Để nạp dữ liệu, hãy chạy các file 99_seed_*.sql sau khi chạy script này.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 5 FILE SCHEMA HOÀN CHỈNH (Đã hợp nhất bảo mật & làm sạch dữ liệu) ───────
SOURCE mg_identity.sql;
SOURCE mg_catalog.sql;
SOURCE mg_order.sql;
SOURCE mg_cms.sql;
SOURCE mg_notification.sql;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- KIỂM TRA KẾT QUẢ
-- =============================================================================

SELECT '══════════════════════════════════════════' AS '',
       '  XÁC NHẬN KHỞI TẠO DATABASE "BẢNG TRẮNG"   ' AS '',
       '══════════════════════════════════════════' AS '';

SELECT TABLE_SCHEMA AS 'Schema',
       COUNT(*)     AS 'Số bảng hiện có'
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_SCHEMA IN ('mg_identity','mg_catalog','mg_order','mg_cms','mg_notification')
GROUP  BY TABLE_SCHEMA
ORDER  BY TABLE_SCHEMA;

SELECT 'Hệ thống đã sẵn sàng. Hãy chạy các file SEED để nạp dữ liệu nếu cần.' AS 'Ghi chú';
