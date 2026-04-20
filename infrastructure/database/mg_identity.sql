-- =============================================================================
-- SCHEMA: mg_identity
-- Mục đích: Xác thực & Phân quyền cho toàn hệ thống Nhà Thuốc Minh Giang
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_identity
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_identity;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS loyalty_points_transactions;
DROP TABLE IF EXISTS loyalty_tier_config;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS customer_addresses;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

-- =============================================================================
-- BẢNG: roles
-- =============================================================================
CREATE TABLE roles (
    id          INT             NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)     NOT NULL    COMMENT 'Tên vai trò: admin, pharmacist, cashier, staff',
    description VARCHAR(200)                COMMENT 'Mô tả vai trò',
    permissions JSON                        COMMENT 'JSON array chứa danh sách mã quyền',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Bảng vai trò & quyền hạn nhân viên';

-- =============================================================================
-- BẢNG: users
-- =============================================================================
CREATE TABLE users (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    username        VARCHAR(100)    NOT NULL    COMMENT 'Tên đăng nhập',
    email           VARCHAR(200)    NOT NULL    COMMENT 'Email làm việc',
    password_hash   VARCHAR(255)    NOT NULL    COMMENT 'Bcrypt hash của mật khẩu',
    full_name       VARCHAR(200)    NOT NULL    COMMENT 'Họ và tên đầy đủ',
    phone           VARCHAR(20)                 COMMENT 'Số điện thoại nội bộ',
    role_id         INT             NOT NULL    COMMENT 'FK → roles.id',
    avatar_url      VARCHAR(500)                COMMENT 'URL ảnh đại diện',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    last_login_at   DATETIME,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email),
    INDEX idx_users_role_id (role_id),
    INDEX idx_users_is_active (is_active),

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Tài khoản nhân viên, dược sĩ, quản trị viên';

-- =============================================================================
-- BẢNG: customers
-- =============================================================================
CREATE TABLE customers (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    full_name       VARCHAR(200)    NOT NULL,
    email           VARCHAR(200)    NOT NULL,
    phone           VARCHAR(20)     NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    date_of_birth   DATE,
    gender          ENUM('male','female','other'),
    loyalty_points  INT             NOT NULL DEFAULT 0,
    loyalty_tier    ENUM('member','silver','gold','vip') NOT NULL DEFAULT 'member',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    deleted_at      DATETIME        COMMENT 'Soft delete — tuân thủ Nghị định 13/2023/NĐ-CP bảo vệ DLCN',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_customers_email (email),
    UNIQUE KEY uq_customers_phone (phone),
    INDEX idx_customers_loyalty_tier (loyalty_tier),
    INDEX idx_customers_is_active (is_active),
    INDEX idx_customers_deleted_at (deleted_at),
    
    CONSTRAINT chk_loyalty_points_non_negative
        CHECK (loyalty_points >= 0)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Tài khoản khách hàng web và chương trình khách hàng thân thiết';

-- Trigger: chặn hard DELETE tài khoản khách hàng
DROP TRIGGER IF EXISTS trg_customers_no_hard_delete;
DELIMITER $$
CREATE TRIGGER trg_customers_no_hard_delete
BEFORE DELETE ON customers
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'customers KHÔNG được DELETE vật lý — hãy đặt deleted_at để xoá mềm.';
END$$
DELIMITER ;

-- =============================================================================
-- BẢNG: customer_addresses
-- =============================================================================
CREATE TABLE customer_addresses (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    customer_id     BIGINT          NOT NULL,
    receiver_name   VARCHAR(200)    NOT NULL,
    phone           VARCHAR(20)     NOT NULL,
    province        VARCHAR(100)    NOT NULL,
    district        VARCHAR(100)    NOT NULL,
    ward            VARCHAR(100)    NOT NULL,
    street_address  TEXT            NOT NULL,
    is_default      TINYINT(1)      NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    INDEX idx_customer_addresses_customer_id (customer_id),
    INDEX idx_customer_addresses_is_default (customer_id, is_default),

    CONSTRAINT fk_customer_addresses_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Danh sách địa chỉ giao hàng của khách hàng';

-- =============================================================================
-- BẢNG: shifts
-- =============================================================================
CREATE TABLE shifts (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    user_id                 BIGINT          NOT NULL,
    kiosk_id                VARCHAR(20)     NOT NULL,
    shift_start             DATETIME        NOT NULL,
    shift_end               DATETIME,
    opening_cash            DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    closing_cash            DECIMAL(12,2),
    total_cash_sales        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total_card_sales        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total_qr_sales          DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    expected_closing_cash   DECIMAL(12,2)   COMMENT 'Tiền cuối ca theo hệ thống',
    cash_difference         DECIMAL(12,2)   COMMENT 'Chênh lệch = closing_cash - expected_closing_cash',
    reconciliation_status   ENUM('pending','matched','excess','shortage','approved') DEFAULT 'pending',
    approved_by             BIGINT          COMMENT '(Cross-schema) mg_identity.users.id',
    approved_at             DATETIME,
    approval_note           TEXT,
    status                  ENUM('open','closed') NOT NULL DEFAULT 'open',
    notes                   TEXT,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_shifts_user_id (user_id),
    INDEX idx_shifts_kiosk_id (kiosk_id),
    INDEX idx_shifts_status (status),
    INDEX idx_shifts_shift_start (shift_start),

    CONSTRAINT fk_shifts_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Ca làm việc của nhân viên tại quầy POS';

-- Trigger: chặn mở 2 ca trên cùng kiosk
DROP TRIGGER IF EXISTS trg_shifts_one_open_per_kiosk;
DELIMITER $$
CREATE TRIGGER trg_shifts_one_open_per_kiosk
BEFORE INSERT ON shifts
FOR EACH ROW
BEGIN
    DECLARE open_count INT;
    SELECT COUNT(*) INTO open_count FROM shifts WHERE kiosk_id = NEW.kiosk_id AND status = 'open';
    IF open_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Kiosk này đang có ca đang mở. Vui lòng đóng ca hiện tại trước khi mở ca mới.';
    END IF;
END$$
DELIMITER ;

-- =============================================================================
-- BẢNG: refresh_tokens
-- =============================================================================
CREATE TABLE refresh_tokens (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    user_id     BIGINT          NOT NULL COMMENT '⚠️ CẢNH BÁO: Phải query kèm user_type vì staff/customer ID không độc lập',
    user_type   ENUM('staff','customer') NOT NULL,
    token_hash  VARCHAR(255)    NOT NULL,
    expires_at  DATETIME        NOT NULL,
    revoked_at  DATETIME,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_tokens_hash (token_hash),
    INDEX idx_refresh_tokens_user (user_id, user_type),
    INDEX idx_refresh_tokens_expires_at (expires_at)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Refresh token cho xác thực JWT';

-- =============================================================================
-- BẢNG: loyalty_tier_config
-- =============================================================================
CREATE TABLE loyalty_tier_config (
    id                  INT             NOT NULL AUTO_INCREMENT,
    tier_code           ENUM('member','silver','gold','vip') NOT NULL,
    tier_name           VARCHAR(100)    NOT NULL,
    tier_icon           VARCHAR(20)     NOT NULL DEFAULT '⭐',
    min_spending        DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    max_spending        DECIMAL(15,2),
    points_ratio        DECIMAL(5,2)    NOT NULL DEFAULT 1.00,
    points_per_vnd      INT             NOT NULL DEFAULT 10000,
    discount_pct        DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    description         VARCHAR(300),
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_loyalty_tier_config_code (tier_code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Cấu hình hạng thành viên loyalty';

-- =============================================================================
-- BẢNG: loyalty_points_transactions
-- =============================================================================
CREATE TABLE loyalty_points_transactions (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    customer_id     BIGINT          NOT NULL,
    transaction_type ENUM('earn_purchase','earn_bonus','redeem','adjust_add','adjust_deduct','expire') NOT NULL,
    points_change   INT             NOT NULL,
    idempotency_key VARCHAR(128)    COMMENT 'UUID chống duplicate request',
    description     VARCHAR(300)    NOT NULL,
    reference_order_id BIGINT,
    adjusted_by     BIGINT,
    admin_note      TEXT,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_loyalty_idempotency (customer_id, idempotency_key),
    INDEX idx_loyalty_pts_txn_customer_id (customer_id),
    INDEX idx_loyalty_pts_txn_type (transaction_type),
    INDEX idx_loyalty_pts_txn_created_at (created_at),
    CONSTRAINT fk_loyalty_pts_txn_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Lịch sử giao dịch điểm tích luỹ loyalty';

-- =============================================================================
-- BẢNG: otp_codes
-- =============================================================================
CREATE TABLE otp_codes (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    target      VARCHAR(200)    NOT NULL,
    target_type ENUM('phone','email') NOT NULL,
    otp_hash    VARCHAR(255)    NOT NULL,
    purpose     ENUM('register','reset_password','verify_email','pos_confirm') NOT NULL,
    attempts    INT             NOT NULL DEFAULT 0,
    send_count_today INT        NOT NULL DEFAULT 0,
    last_send_at DATETIME,
    blocked_until DATETIME,
    expires_at  DATETIME        NOT NULL,
    used_at     DATETIME,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_otp_codes_target (target, target_type),
    INDEX idx_otp_target_date (target, target_type, created_at),
    INDEX idx_otp_codes_purpose (purpose),
    INDEX idx_otp_codes_expires_at (expires_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Mã OTP tạm thời cho xác thực nhiều bước';

-- Trigger: vô hiệu hoá OTP cũ khi tạo OTP mới
DROP TRIGGER IF EXISTS trg_otp_invalidate_previous;
DELIMITER $$
CREATE TRIGGER trg_otp_invalidate_previous
BEFORE INSERT ON otp_codes
FOR EACH ROW
BEGIN
    UPDATE otp_codes
    SET used_at = NOW()
    WHERE target = NEW.target AND target_type = NEW.target_type AND purpose = NEW.purpose
      AND used_at IS NULL AND expires_at > NOW();
END$$
DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;
