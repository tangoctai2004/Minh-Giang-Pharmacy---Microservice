-- =============================================================================
-- MIGRATION PHASE 2: Thêm bảng nghiệp vụ thiếu
-- Mục đích: payment_transactions, order_status_history, invoice_vat
-- Ngày: 2026-04-06
-- Chạy: docker exec -i minhgiang_mysql mysql -uroot -proot < mg_migration_phase2.sql
-- TIÊN QUYẾT: Phase 1 phải chạy trước
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

SELECT '=====================================================================' AS '';
SELECT 'PHASE 2: Thêm bảng nghiệp vụ thiếu'                                 AS '';
SELECT '=====================================================================' AS '';

-- =============================================================================
-- 2.1: mg_order.payment_transactions — Ghi nhận giao dịch thanh toán
-- =============================================================================

USE mg_order;

CREATE TABLE IF NOT EXISTS payment_transactions (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    order_id        BIGINT          NOT NULL    COMMENT 'FK → orders.id',
    transaction_code VARCHAR(100)   NOT NULL    COMMENT 'Mã giao dịch từ cổng: VNP-260406-123456, etc',
    payment_method  ENUM('cash','cod','vnpay','momo','card_visa','qr_transfer') NOT NULL,
    amount          DECIMAL(15,2)   NOT NULL    COMMENT 'Số tiền giao dịch',
    
    -- Gateway response
    gateway_code    VARCHAR(50)                 COMMENT 'Mã trả về từ cổng thanh toán',
    gateway_message TEXT                        COMMENT 'Thông điệp chi tiết từ cổng',
    gateway_response JSON                       COMMENT 'Full response từ cổng (lưu lại để audit)',
    
    -- Trạng thái
    status          ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending'
                                                COMMENT 'pending=chờ xác nhận, success=đã thanh toán, failed=thất bại, refunded=hoàn tiền',
    
    paid_at         DATETIME                    COMMENT 'Thời điểm thanh toán thành công',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_payment_order_id (order_id),
    INDEX idx_payment_status (status),
    INDEX idx_payment_transaction_code (transaction_code),
    INDEX idx_payment_created_at (created_at),

    CONSTRAINT fk_payment_transactions_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Ghi nhận lịch sử giao dịch thanh toán, support partial refund và reconcile cổng';

SELECT '[2.1] ✅ payment_transactions: tạo bảng thành công' AS status;

-- =============================================================================
-- 2.2: mg_order.order_status_history — Truy vết lịch sử trạng thái đơn
-- =============================================================================

CREATE TABLE IF NOT EXISTS order_status_history (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    order_id        BIGINT          NOT NULL    COMMENT 'FK → orders.id',
    from_status     VARCHAR(50)     NOT NULL    COMMENT 'Trạng thái cũ (pending_approval, confirmed, picking, shipping, completed, cancelled)',
    to_status       VARCHAR(50)     NOT NULL    COMMENT 'Trạng thái mới',
    changed_by      BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — ai thay đổi',
    note            TEXT                        COMMENT 'Lý do đổi trạng thái',
    changed_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_status_history_order_id (order_id),
    INDEX idx_status_history_changed_at (changed_at),
    INDEX idx_status_history_changed_by (changed_by),

    CONSTRAINT fk_status_history_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Lịch sử thay đổi trạng thái đơn hàng — truy vết ai, khi nào, từ→đến, lý do';

SELECT '[2.2] ✅ order_status_history: tạo bảng thành công' AS status;

-- =============================================================================
-- 2.3: mg_order.invoice_vat — Hóa đơn VAT
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_vat (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    order_id        BIGINT          NOT NULL    COMMENT 'FK → orders.id',
    invoice_number  VARCHAR(50)     NOT NULL    COMMENT 'Số hóa đơn được cấp (VD: 0000000001/KK)',
    
    -- Thông tin đơn vị phát hành
    company_name    VARCHAR(300)    NOT NULL    COMMENT 'Tên nhà thuốc (Công ty TNHH Nhà Thuốc Minh Giang)',
    tax_code        VARCHAR(50)     NOT NULL    COMMENT 'Mã số thuế doanh nghiệp của nhà thuốc',
    company_address TEXT            NOT NULL    COMMENT 'Địa chỉ đầy đủ',
    
    -- Thông tin người mua
    buyer_name      VARCHAR(200)    NOT NULL    COMMENT 'Tên khách hàng / công ty mua',
    buyer_tax_code  VARCHAR(50)                 COMMENT 'Mã số thuế của khách (nếu là doanh nghiệp)',
    buyer_address   TEXT                        COMMENT 'Địa chỉ khách mua',
    
    -- Chi tiết tiền
    total_before_tax DECIMAL(15,2)  NOT NULL    COMMENT 'Tổng tiền trước thuế',
    vat_rate        DECIMAL(4,2)    NOT NULL    COMMENT 'Tỷ lệ VAT (VD: 10.00 = 10%)',
    vat_amount      DECIMAL(15,2)   NOT NULL    COMMENT 'Số tiền VAT = total_before_tax × vat_rate / 100',
    total_with_tax  DECIMAL(15,2)   NOT NULL    COMMENT 'Tổng tiền bao gồm VAT',
    
    -- Trạng thái
    status          ENUM('pending','issued','cancelled') NOT NULL DEFAULT 'pending'
                                                COMMENT 'pending=chờ xuất, issued=đã phát hành, cancelled=đã huỷ',
    issued_at       DATETIME                    COMMENT 'Thời điểm xuất hoá đơn (khi status=issued)',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_invoice_number (invoice_number),
    INDEX idx_invoice_order_id (order_id),
    INDEX idx_invoice_status (status),
    INDEX idx_invoice_issued_at (issued_at),

    CONSTRAINT fk_invoice_vat_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Hóa đơn VAT theo Thông tư 78/2021/TT-BTC — xuất khi khách requires_vat_invoice=1';

SELECT '[2.3] ✅ invoice_vat: tạo bảng thành công' AS status;

-- =============================================================================

SELECT '=====================================================================' AS '';
SELECT 'PHASE 2: ✅ HOÀN THÀNH — 3 bảng mới được tạo'                       AS '';
SELECT '=====================================================================' AS '';

SET FOREIGN_KEY_CHECKS = 1;
