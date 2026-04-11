-- =============================================================================
-- MIGRATION PHASE 3: Bổ sung tính năng domain dược phẩm
-- Mục đích: Loyalty expiry, product recalls, customer/user codes
-- Ngày: 2026-04-06
-- Chạy: docker exec -i minhgiang_mysql mysql -uroot -proot < mg_migration_phase3.sql
-- TIÊN QUYẾT: Phase 1, 2 phải chạy trước
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

SELECT '=====================================================================' AS '';
SELECT 'PHASE 3: Bổ sung tính năng domain dược phẩm'                        AS '';
SELECT '=====================================================================' AS '';

-- =============================================================================
-- 3.1: mg_identity — Bổ sung hạn sử dụng loyalty points
-- =============================================================================

USE mg_identity;

-- Thêm cột expiry policy vào loyalty_tier_config
ALTER TABLE loyalty_tier_config ADD COLUMN (
    points_expiry_months INT DEFAULT 12
                                    COMMENT 'Số tháng sau khi cộng thì điểm tự hết hạn (mặc định 12 tháng)'
);

ALTER TABLE loyalty_tier_config ADD INDEX idx_loyalty_config_expiry (points_expiry_months);

-- Thêm cột expires_at vào loyalty_points_transactions
ALTER TABLE loyalty_points_transactions ADD COLUMN (
    expires_at      DATETIME                    COMMENT 'Thời điểm điểm hết hạn sử dụng — NULL nếu là giao dịch trừ điểm hoặc không có hạn'
);

ALTER TABLE loyalty_points_transactions ADD INDEX idx_loyalty_transactions_expires_at (customer_id, expires_at);

SELECT '[3.1] ✅ Loyalty points: đã thêm expiry policy (points_expiry_months) và expires_at' AS status;

-- Thêm cột code cho customers
ALTER TABLE customers ADD COLUMN (
    code            VARCHAR(20) UNIQUE  COMMENT 'Mã khách hàng tự sinh: KH-0001, KH-0002, ... (dùng CRM, print bill)'
);

ALTER TABLE customers ADD INDEX idx_customers_code (code);

SELECT '[3.2] ✅ customers: đã thêm code (UNIQUE VARCHAR(20))' AS status;

-- Thêm cột code cho users
ALTER TABLE users ADD COLUMN (
    code            VARCHAR(20) UNIQUE  COMMENT 'Mã nhân viên tự sinh: NV-001, NV-002, ... (dùng bảng lương, in phiếu)'
);

ALTER TABLE users ADD INDEX idx_users_code (code);

SELECT '[3.3] ✅ users: đã thêm code (UNIQUE VARCHAR(20))' AS status;

-- =============================================================================
-- 3.2: mg_catalog.product_recalls — Module thu hồi thuốc
-- =============================================================================

USE mg_catalog;

CREATE TABLE IF NOT EXISTS product_recalls (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    recall_code     VARCHAR(100)    NOT NULL    COMMENT 'Mã phiếu thu hồi: RCL-260406-001',
    product_id      BIGINT          NOT NULL    COMMENT 'FK → products.id',
    lot_numbers     JSON            NOT NULL    COMMENT 'JSON array []  các số lô bị thu hồi: ["LOT-001", "LOT-002"]',
    recall_reason   TEXT            NOT NULL    COMMENT 'Lý do thu hồi: "Chứa tạp chất tối độc", "Hoạt chất dưới chuẩn", etc',
    
    -- Phân loại theo quy định
    severity        ENUM('class_I','class_II','class_III') NOT NULL
                                                COMMENT 'Mức độ: Class I=nguy hiểm cao, II=trung bình, III=thấp',
    regulatory_reference VARCHAR(200)          COMMENT 'Tham chiếu pháp luật: Công văn 12345/QLD-CL, Thông tư 02/2018/TT-BYT, etc',
    
    -- Tracking
    recalled_by     BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_identity.users.id — người tạo phiếu thu hồi',
    recall_date     DATE            NOT NULL    COMMENT 'Ngày phát hiện/công bố thu hồi',
    status          ENUM('active','resolved') NOT NULL DEFAULT 'active'
                                                COMMENT 'active=đang thu hồi, resolved=đã hoàn thành',
    resolved_at     DATETIME                    COMMENT 'Ngày hoàn thành thu hồi',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_recalls_code (recall_code),
    INDEX idx_recalls_product_id (product_id),
    INDEX idx_recalls_status (status),
    INDEX idx_recalls_recall_date (recall_date),

    CONSTRAINT fk_recalls_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Module thu hồi thuốc — Cục Quản lý Dược công bố định kỳ, dùng để đánh dấu lô hàng, chặn bán, xuất báo cáo';

SELECT '[3.4] ✅ product_recalls: tạo bảng thành công' AS status;

-- =============================================================================

SELECT '=====================================================================' AS '';
SELECT 'PHASE 3: ✅ HOÀN THÀNH — 5 tính năng mới được bổ sung'               AS '';
SELECT '=====================================================================' AS '';

SET FOREIGN_KEY_CHECKS = 1;
