-- =============================================================================
-- INIT SCRIPT: Khởi tạo toàn bộ database cho Hệ thống Nhà Thuốc Minh Giang
-- Phiên bản: HOÀN CHỈNH (base schemas + tất cả patch migrations)
-- =============================================================================
--
-- Thứ tự thực thi:
--   5 file hoàn chỉnh — mỗi file là base schema + patch đã hợp nhất
--
--   mg_identity.sql     — users, customers, roles, shifts, loyalty, otp
--   mg_catalog.sql      — products, batches, locations, suppliers, brands,
--                         storage hierarchy, inventory_audits, delivery
--   mg_order.sql        — carts, orders, order_items, returns,
--                         pos_held_orders, prescriptions
--   mg_cms.sql          — articles, banners, promotions, store_config,
--                         cms_media, cms_pages, trending_searches
--   mg_notification.sql — notification_templates (+ zalo), notifications
--
-- ============================================================================
-- CÁCH CHẠY
-- ============================================================================
--
-- OPTION A — MySQL CLI tương tác (SOURCE hoạt động khi chạy từ thư mục gốc dự án):
--   > cd "/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy"
--   > mysql -uroot -proot
--   mysql> SOURCE infrastructure/database/00_init_all.sql
--
-- OPTION B — Pipe từng file vào Docker exec (chạy xong mỗi lệnh trước khi chạy tiếp):
--   PROJ="/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy"
--   for f in 01 02 03 04 05 06 07 08 09 10; do
--     docker exec -i minhgiang_mysql mysql -uroot -proot \
--       < "$PROJ/infrastructure/database/${f}_*.sql"
--   done
--
-- OPTION C — Script shell tiện lợi (xem infrastructure/database/run_all.sh):
--   bash infrastructure/database/run_all.sh
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 5 FILE HOÀN CHỈNH (base + patch đã hợp nhất) ───────────────────────────
SOURCE infrastructure/database/mg_identity.sql;
SOURCE infrastructure/database/mg_catalog.sql;
SOURCE infrastructure/database/mg_order.sql;
SOURCE infrastructure/database/mg_cms.sql;
SOURCE infrastructure/database/mg_notification.sql;

-- ── SECURITY PATCHES (27 fixes: 9 CRITICAL + 13 HIGH + 5 MEDIUM) ─────────────
SOURCE infrastructure/database/mg_security_patches.sql;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- KIỂM TRA KẾT QUẢ: liệt kê tất cả bảng và số bản ghi mẫu trong 5 schemas
-- =============================================================================

SELECT '══════════════════════════════════════════' AS '',
       '  XÁC NHẬN KHỞI TẠO DATABASE HOÀN TẤT   ' AS '',
       '══════════════════════════════════════════' AS '';

SELECT CONCAT('Schema: ', TABLE_SCHEMA) AS 'Schema',
       TABLE_NAME                       AS 'Bảng',
       TABLE_ROWS                       AS 'Rows (approx)',
       CREATE_TIME                      AS 'Tạo lúc'
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_SCHEMA IN ('mg_identity','mg_catalog','mg_order','mg_cms','mg_notification')
ORDER  BY TABLE_SCHEMA, TABLE_NAME;

-- Tổng bảng theo schema
SELECT TABLE_SCHEMA AS 'Schema',
       COUNT(*)     AS 'Số bảng'
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_SCHEMA IN ('mg_identity','mg_catalog','mg_order','mg_cms','mg_notification')
GROUP  BY TABLE_SCHEMA
ORDER  BY TABLE_SCHEMA;

-- Tổng cộng
SELECT COUNT(*) AS 'TỔNG SỐ BẢNG TRONG 5 SCHEMAS'
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_SCHEMA IN ('mg_identity','mg_catalog','mg_order','mg_cms','mg_notification');
