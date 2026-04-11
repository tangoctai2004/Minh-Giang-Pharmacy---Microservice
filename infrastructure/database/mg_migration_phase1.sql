-- =============================================================================
-- MIGRATION PHASE 1: Sửa schema hiện có
-- Mục đích: Bổ sung cột và thay đổi constraint cho category nhiều cấp + trả NCC
-- Ngày: 2026-04-06
-- Chạy: docker exec -i minhgiang_mysql mysql -uroot -proot < mg_migration_phase1.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

SELECT '=====================================================================' AS '';
SELECT 'PHASE 1: Sửa schema hiện có'                                         AS '';
SELECT '=====================================================================' AS '';

-- =============================================================================
-- 1.1: mg_cms.cms_categories — Bổ sung cột cho category đa cấp
-- =============================================================================

USE mg_cms;

-- Thêm các cột hỗ trợ category đa cấp
ALTER TABLE cms_categories ADD COLUMN (
    parent_id       INT             COMMENT 'FK → cms_categories.id — NULL nếu là root category',
    description     TEXT            COMMENT 'Mô tả chi tiết danh mục (chỉ dùng cho disease)',
    image_url       VARCHAR(500)    COMMENT 'URL ảnh đại diện danh mục',
    is_active       TINYINT(1) NOT NULL DEFAULT 1
                                    COMMENT '1=hiển thị, 0=ẩn danh mục',
    sort_order      INT NOT NULL DEFAULT 0
                                    COMMENT 'Thứ tự sắp xếp (nhỏ hơn = lên trước)'
);

-- Thêm FK self-reference cho parent_id
ALTER TABLE cms_categories
    ADD CONSTRAINT fk_cms_categories_parent
        FOREIGN KEY (parent_id) REFERENCES cms_categories(id)
        ON UPDATE CASCADE ON DELETE SET NULL;

-- Thêm index cho query hiệu quả
ALTER TABLE cms_categories
    ADD INDEX idx_cms_categories_parent_id (parent_id),
    ADD INDEX idx_cms_categories_is_active (is_active),
    ADD INDEX idx_cms_categories_sort_order (sort_order);

SELECT '[1.1] ✅ cms_categories: đã thêm parent_id (self-FK), description, image_url, is_active, sort_order' AS status;

-- =============================================================================
-- 1.2: mg_order.returns — Sửa conflict order_channel='supplier'
-- =============================================================================

USE mg_order;

-- Sửa order_id thành nullable (để support trả hàng cho NCC mà không liên quan đơn hàng)
ALTER TABLE returns MODIFY order_id BIGINT NULL COMMENT 'FK → orders.id — NULL nếu là phiếu trả cho NCC';

-- Thêm supplier_id cho trường hợp trả hàng cho NCC
ALTER TABLE returns ADD COLUMN (
    supplier_id     BIGINT          COMMENT '(Cross-schema) mg_catalog.suppliers.id — dùng khi order_channel=supplier, NULL với đơn hàng từ khách'
);

-- Thêm index cho query nhanh
ALTER TABLE returns ADD INDEX idx_returns_supplier_id (supplier_id);

SELECT '[1.2] ✅ returns: đã sửa order_id → nullable, thêm supplier_id' AS status;

-- =============================================================================
-- 1.3: mg_cms.store_config — Thêm id và is_active
-- =============================================================================

USE mg_cms;

-- Thêm id column (nếu chưa có)
ALTER TABLE store_config ADD COLUMN (
    id              INT AUTO_INCREMENT UNIQUE COMMENT 'ID duy nhất tự sinh (không phải PK)',
    is_active       TINYINT(1) NOT NULL DEFAULT 1
                                COMMENT '1=cấu hình đang dùng, 0=vô hiệu hóa'
);

-- Thêm index để query nhanh theo is_active
ALTER TABLE store_config ADD INDEX idx_store_config_is_active (is_active);

SELECT '[1.3] ✅ store_config: đã thêm id (AUTO_INCREMENT UNIQUE) và is_active' AS status;

-- =============================================================================
-- 1.4: mg_catalog.batches — Thêm cột invoice_number
-- =============================================================================

USE mg_catalog;

-- Thêm invoice_number
ALTER TABLE batches ADD COLUMN (
    invoice_number  VARCHAR(100)    COMMENT 'Số hoá đơn từ NCC — dùng cho đối chiếu thanh toán'
);

-- Thêm index để query theo số hoá đơn
ALTER TABLE batches ADD INDEX idx_batches_invoice_number (invoice_number);

SELECT '[1.4] ✅ batches: đã thêm invoice_number' AS status;

-- =============================================================================

SELECT '=====================================================================' AS '';
SELECT 'PHASE 1: ✅ HOÀN THÀNH — 4 sửa đổi schema đã áp dụng thành công'    AS '';
SELECT '=====================================================================' AS '';

SET FOREIGN_KEY_CHECKS = 1;
