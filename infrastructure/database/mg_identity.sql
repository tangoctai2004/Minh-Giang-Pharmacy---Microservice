-- =============================================================================
-- SCHEMA: mg_identity
-- Mục đích: Xác thực & Phân quyền cho toàn hệ thống Nhà Thuốc Minh Giang
-- Bao gồm: Nhân viên, Vai trò, Khách hàng web, Địa chỉ, Ca làm việc, Refresh Token
-- Tạo TRƯỚC nhất vì các schema khác tham chiếu đến users.id và customers.id
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_identity
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_identity;

-- =============================================================================
-- BẢNG: roles
-- Lưu các vai trò và quyền hạn trong hệ thống
-- =============================================================================
CREATE TABLE roles (
    id          INT             NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)     NOT NULL    COMMENT 'Tên vai trò: admin, pharmacist, cashier, staff',
    description VARCHAR(200)                COMMENT 'Mô tả vai trò',
    permissions JSON                        COMMENT 'JSON array chứa danh sách mã quyền, VD: ["orders.view","inventory.edit"]',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Bảng vai trò & quyền hạn nhân viên';

-- =============================================================================
-- BẢNG: users
-- Tài khoản nhân viên và quản trị viên
-- =============================================================================
CREATE TABLE users (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    username        VARCHAR(100)    NOT NULL    COMMENT 'Tên đăng nhập (không dấu, không khoảng trắng)',
    email           VARCHAR(200)    NOT NULL    COMMENT 'Email làm việc',
    password_hash   VARCHAR(255)    NOT NULL    COMMENT 'Bcrypt hash của mật khẩu, KHÔNG lưu plaintext',
    full_name       VARCHAR(200)    NOT NULL    COMMENT 'Họ và tên đầy đủ',
    phone           VARCHAR(20)                 COMMENT 'Số điện thoại nội bộ',
    role_id         INT             NOT NULL    COMMENT 'FK → roles.id',
    avatar_url      VARCHAR(500)                COMMENT 'URL ảnh đại diện',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1   COMMENT '1=đang hoạt động, 0=đã khoá tài khoản',
    last_login_at   DATETIME                    COMMENT 'Thời điểm đăng nhập lần cuối',
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
-- Tài khoản khách hàng web — chương trình loyalty
-- =============================================================================
CREATE TABLE customers (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    full_name       VARCHAR(200)    NOT NULL    COMMENT 'Họ và tên khách hàng',
    email           VARCHAR(200)    NOT NULL    COMMENT 'Email đăng ký tài khoản',
    phone           VARCHAR(20)     NOT NULL    COMMENT 'Số điện thoại (dùng đăng nhập & liên hệ)',
    password_hash   VARCHAR(255)    NOT NULL    COMMENT 'Bcrypt hash của mật khẩu',
    date_of_birth   DATE                        COMMENT 'Ngày sinh (dùng tính tuổi và sinh nhật)',
    gender          ENUM('male','female','other') COMMENT 'Giới tính',
    loyalty_points  INT             NOT NULL DEFAULT 0   COMMENT 'Điểm tích luỹ (10.000đ = 1 điểm)',
    loyalty_tier    ENUM('member','silver','gold','vip') NOT NULL DEFAULT 'member'
                                                COMMENT 'Hạng thành viên: member(0-499đ), silver(500-1999đ), gold(2000-4999đ), vip(5000+đ)',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1   COMMENT '1=hoạt động, 0=đã khoá',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_customers_email (email),
    UNIQUE KEY uq_customers_phone (phone),
    INDEX idx_customers_loyalty_tier (loyalty_tier),
    INDEX idx_customers_is_active (is_active)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Tài khoản khách hàng web và chương trình khách hàng thân thiết';

-- =============================================================================
-- BẢNG: customer_addresses
-- Địa chỉ giao hàng của khách hàng (1 khách có nhiều địa chỉ)
-- =============================================================================
CREATE TABLE customer_addresses (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    customer_id     BIGINT          NOT NULL    COMMENT 'FK → customers.id',
    receiver_name   VARCHAR(200)    NOT NULL    COMMENT 'Tên người nhận hàng',
    phone           VARCHAR(20)     NOT NULL    COMMENT 'SĐT người nhận',
    province        VARCHAR(100)    NOT NULL    COMMENT 'Tỉnh/Thành phố',
    district        VARCHAR(100)    NOT NULL    COMMENT 'Quận/Huyện',
    ward            VARCHAR(100)    NOT NULL    COMMENT 'Phường/Xã',
    street_address  TEXT            NOT NULL    COMMENT 'Số nhà, tên đường, tòa nhà...',
    is_default      TINYINT(1)      NOT NULL DEFAULT 0   COMMENT '1=địa chỉ mặc định của khách',

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
-- Ca làm việc của nhân viên tại quầy POS
-- =============================================================================
CREATE TABLE shifts (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    user_id             BIGINT          NOT NULL    COMMENT 'FK → users.id — nhân viên trực ca',
    kiosk_id            VARCHAR(20)     NOT NULL    COMMENT 'Mã máy POS: Kiosk #01, Kiosk #02...',
    shift_start         DATETIME        NOT NULL    COMMENT 'Thời điểm bắt đầu ca',
    shift_end           DATETIME                    COMMENT 'Thời điểm kết thúc ca (NULL nếu ca đang mở)',
    opening_cash        DECIMAL(12,2)   NOT NULL DEFAULT 0.00  COMMENT 'Tiền mặt đầu ca kiểm đếm',
    closing_cash        DECIMAL(12,2)               COMMENT 'Tiền mặt cuối ca kiểm đếm',
    total_cash_sales    DECIMAL(12,2)   NOT NULL DEFAULT 0.00  COMMENT 'Tổng doanh thu tiền mặt trong ca',
    total_card_sales    DECIMAL(12,2)   NOT NULL DEFAULT 0.00  COMMENT 'Tổng doanh thu thẻ/visa trong ca',
    total_qr_sales      DECIMAL(12,2)   NOT NULL DEFAULT 0.00  COMMENT 'Tổng doanh thu QR/chuyển khoản trong ca',
    status              ENUM('open','closed') NOT NULL DEFAULT 'open'
                                                    COMMENT 'Trạng thái ca: open=đang trực, closed=đã kết ca',
    notes               TEXT                        COMMENT 'Ghi chú bàn giao ca',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

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

-- =============================================================================
-- BẢNG: refresh_tokens
-- Lưu refresh token để duy trì đăng nhập (JWT pattern)
-- =============================================================================
CREATE TABLE refresh_tokens (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    user_id     BIGINT          NOT NULL    COMMENT 'ID user (staff hoặc customer) sở hữu token',
    user_type   ENUM('staff','customer') NOT NULL  COMMENT 'Phân biệt loại user để query đúng bảng',
    token_hash  VARCHAR(255)    NOT NULL    COMMENT 'SHA-256 hash của refresh token, KHÔNG lưu raw token',
    expires_at  DATETIME        NOT NULL    COMMENT 'Thời điểm token hết hạn',
    revoked_at  DATETIME                    COMMENT 'Thời điểm token bị thu hồi (NULL=còn hiệu lực)',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_tokens_hash (token_hash),
    INDEX idx_refresh_tokens_user (user_id, user_type),
    INDEX idx_refresh_tokens_expires_at (expires_at)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Refresh token cho xác thực JWT, hỗ trợ cả staff và customer';

-- =============================================================================
-- DỮ LIỆU MẪU: mg_identity
-- =============================================================================

-- Các vai trò trong hệ thống
INSERT INTO roles (name, description, permissions) VALUES
('Quản trị viên','Quản trị viên hệ thống toàn quyền',
    '["dashboard.view","inventory.view","inventory.edit","orders.view","orders.edit","customers.view","customers.edit","reports.view","settings.edit","users.manage"]'),
('Dược sĩ',     'Dược sĩ — quản lý thuốc và tồn kho',
    '["dashboard.view","inventory.view","inventory.edit","batches.view","batches.edit","products.view","products.edit","orders.view"]'),
('Thu ngân',    'Thu ngân — bán hàng tại quầy POS',
    '["pos.access","orders.create","orders.view","customers.view"]'),
('Nhân viên kho','Nhân viên kho — nhập/xuất kho',
    '["inventory.view","batches.view","batches.edit","orders.view","orders.fulfillment"]');

-- Tài khoản nhân viên
INSERT INTO users (username, email, password_hash, full_name, phone, role_id, is_active) VALUES
('admin',       'admin@minhgiangpharma.vn',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiPfl5.wBBJbMuYH5xN4Utz5A8uK', 'Nguyễn Minh Giang',    '0901234567', 1, 1),
('duocsi_lan',  'thi.lan@minhgiangpharma.vn',  '$2b$12$KmPqRsTuVwXyZaBcDeFgHi5MKLPqrsTuvWXYz0123456789ABCDEf', 'Trần Thị Lan',         '0912345678', 2, 1),
('thugan_minh', 'van.minh@minhgiangpharma.vn', '$2b$12$NoPqRSTuvWXYzaBCDEFghiJKLMNopqrsTUVWXYZ0123456ABCDEF', 'Lê Văn Minh',          '0923456789', 3, 1),
('nhanvien_hoa','thi.hoa@minhgiangpharma.vn',  '$2b$12$QrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOp', 'Phạm Thị Hoa',         '0934567890', 4, 1),
('duocsi_tuan', 'manh.tuan@minhgiangpharma.vn','$2b$12$TuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRs', 'Đỗ Mạnh Tuấn',         '0945678901', 2, 1);

-- Khách hàng web
INSERT INTO customers (full_name, email, phone, password_hash, date_of_birth, gender, loyalty_points, loyalty_tier) VALUES
('Nguyễn Thị Mai',      'mai.nguyen@gmail.com',     '0901111222', '$2b$12$AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWx', '1990-05-15', 'female',   1250, 'silver'),
('Trần Văn Hùng',       'hung.tran@gmail.com',       '0912222333', '$2b$12$BcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXy', '1985-08-22', 'male',     3800, 'gold'),
('Lê Thị Thu Hương',    'thuhuong.le@gmail.com',     '0923333444', '$2b$12$CdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz', '1995-11-30', 'female',    320, 'member'),
('Phạm Công Danh',      'danh.pham@gmail.com',       '0934444555', '$2b$12$DeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZa', '1978-03-10', 'male',     5600, 'vip'),
('Hoàng Thị Bích Ngọc', 'bichnoc.hoang@gmail.com',  '0945555666', '$2b$12$EfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYzAb', '2000-07-04', 'female',    890, 'silver'),
('Vũ Tiến Dũng',        'tiendung.vu@gmail.com',     '0956666777', '$2b$12$FgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZaBc', '1992-01-25', 'male',      150, 'member'),
('Đặng Thị Kim Oanh',   'kimoanh.dang@gmail.com',    '0967777888', '$2b$12$GhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYzAbCd', '1988-09-18', 'female',   2100, 'gold');

-- Địa chỉ khách hàng
INSERT INTO customer_addresses (customer_id, receiver_name, phone, province, district, ward, street_address, is_default) VALUES
(1, 'Nguyễn Thị Mai',       '0901111222', 'TP. Hồ Chí Minh', 'Quận 1',       'Phường Bến Nghé',   '12 Nguyễn Huệ',            1),
(1, 'Nguyễn Thị Mai',       '0901111222', 'TP. Hồ Chí Minh', 'Quận 7',       'Phường Tân Phú',    '89/3 Nguyễn Thị Thập',     0),
(2, 'Trần Văn Hùng',        '0912222333', 'TP. Hồ Chí Minh', 'Quận Bình Thạnh','Phường 12',       '45 Xô Viết Nghệ Tĩnh',     1),
(3, 'Lê Thị Thu Hương',     '0923333444', 'TP. Hồ Chí Minh', 'Quận 10',      'Phường 11',         '234 Ba Tháng Hai',          1),
(4, 'Phạm Công Danh',       '0934444555', 'TP. Hồ Chí Minh', 'Quận Gò Vấp',  'Phường 12',         '67 Nguyễn Văn Nghi',       1),
(5, 'Hoàng Thị Bích Ngọc',  '0945555666', 'TP. Hồ Chí Minh', 'Quận 3',       'Phường 6',          '15A Võ Thị Sáu',            1);

-- Ca làm việc mẫu
INSERT INTO shifts (user_id, kiosk_id, shift_start, shift_end, opening_cash, closing_cash, total_cash_sales, total_card_sales, total_qr_sales, status) VALUES
(3, 'Kiosk #01', '2026-03-17 07:00:00', '2026-03-17 15:00:00', 5000000.00, 8250000.00, 3125000.00, 650000.00,  475000.00,  'closed'),
(3, 'Kiosk #01', '2026-03-17 15:00:00', NULL,                  5000000.00, NULL,        0.00,        0.00,       0.00,       'open'),
(4, 'Kiosk #02', '2026-03-17 07:00:00', '2026-03-17 15:00:00', 3000000.00, 5680000.00, 2500000.00, 180000.00,  0.00,       'closed');


-- -----------------------------------------------------------------------------
-- PATCH -- bo sung bang/cot (da hop nhat, khong chay rieng nua)
-- -----------------------------------------------------------------------------

-- =============================================================================
-- PATCH: mg_identity — Bổ sung các bảng và cột còn thiếu
-- Bổ sung: loyalty_tier_config, loyalty_points_transactions, otp_codes
--          Thêm cột vào shifts: cash_difference, reconciliation_status, approved_by
-- =============================================================================

USE mg_identity;

-- =============================================================================
-- BẢNG: loyalty_tier_config
-- Cấu hình ngưỡng và tỷ lệ điểm của từng hạng thành viên
-- API: GET /api/identity/loyalty-tiers, PUT /api/order-service/promotions/loyalty/tiers/:tier_id
-- =============================================================================
CREATE TABLE IF NOT EXISTS loyalty_tier_config (
    id                  INT             NOT NULL AUTO_INCREMENT,
    tier_code           ENUM('member','silver','gold','vip') NOT NULL
                                                        COMMENT 'Mã hạng — khớp với customers.loyalty_tier',
    tier_name           VARCHAR(100)    NOT NULL        COMMENT 'Tên hiển thị: Thành viên, Bạc, Vàng, VIP',
    tier_icon           VARCHAR(20)     NOT NULL DEFAULT '🥈'
                                                        COMMENT 'Emoji icon hạng',
    min_spending        DECIMAL(15,2)   NOT NULL DEFAULT 0.00
                                                        COMMENT 'Chi tiêu tối thiểu để đạt hạng này (VND)',
    max_spending        DECIMAL(15,2)               COMMENT 'Chi tiêu tối đa (NULL = không giới hạn — hạng VIP)',
    points_ratio        DECIMAL(5,2)    NOT NULL DEFAULT 1.00
                                                        COMMENT 'Tỷ lệ tích điểm: 1.0 = 1đ/10.000đ, 1.5 = 1.5đ/10.000đ',
    points_per_vnd      INT             NOT NULL DEFAULT 10000
                                                        COMMENT 'Số VND để tích 1 điểm theo tỷ lệ cơ sở',
    discount_pct        DECIMAL(5,2)    NOT NULL DEFAULT 0.00
                                                        COMMENT '% giảm giá tự động cho hạng (0=không giảm)',
    description         VARCHAR(300)                COMMENT 'Mô tả quyền lợi hạng thành viên',
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_loyalty_tier_config_code (tier_code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Cấu hình hạng thành viên loyalty — ngưỡng chi tiêu và tỷ lệ tích điểm';

-- =============================================================================
-- BẢNG: loyalty_points_transactions
-- Lịch sử từng giao dịch điểm tích luỹ của khách hàng
-- API: GET /api/identity/points-history?customer_id=, POST /api/identity/points/adjust
-- =============================================================================
CREATE TABLE IF NOT EXISTS loyalty_points_transactions (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    customer_id     BIGINT          NOT NULL    COMMENT 'FK → customers.id',
    transaction_type ENUM(
                        'earn_purchase',    -- Tích điểm từ mua hàng
                        'earn_bonus',       -- Thưởng điểm (sinh nhật, sự kiện)
                        'redeem',           -- Đổi điểm lấy tiền giảm giá
                        'adjust_add',       -- Admin cộng điểm thủ công
                        'adjust_deduct',    -- Admin trừ điểm thủ công
                        'expire'            -- Điểm hết hạn sử dụng
                    ) NOT NULL              COMMENT 'Loại giao dịch điểm',
    points_change   INT             NOT NULL    COMMENT 'Số điểm thay đổi: dương=cộng, âm=trừ',
    points_balance  INT             NOT NULL    COMMENT 'Số điểm sau giao dịch này',
    description     VARCHAR(300)    NOT NULL    COMMENT 'Mô tả: "Mua hàng WEB-260316-001", "Thưởng sinh nhật", "Đổi 500đ trừ tiền hàng"',
    -- Cross-schema: mg_order.orders.id (nullable, chỉ có khi giao dịch liên quan đơn hàng)
    reference_order_id BIGINT               COMMENT '(Cross-schema) mg_order.orders.id — đơn hàng phát sinh điểm',
    -- Admin thực hiện điều chỉnh (nullable, chỉ có với adjust_add/adjust_deduct)
    adjusted_by     BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — admin điều chỉnh',
    admin_note      TEXT                        COMMENT 'Ghi chú của admin khi điều chỉnh điểm',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_loyalty_pts_txn_customer_id (customer_id),
    INDEX idx_loyalty_pts_txn_type (transaction_type),
    INDEX idx_loyalty_pts_txn_created_at (created_at),
    CONSTRAINT fk_loyalty_pts_txn_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Lịch sử giao dịch điểm tích luỹ loyalty của từng khách hàng';

-- =============================================================================
-- BẢNG: otp_codes
-- Lưu OTP tạm thời cho xác thực đăng ký, đổi mật khẩu, xác nhận POS
-- API: POST /api/identity/send-otp, POST /api/identity/verify-otp
-- =============================================================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    target      VARCHAR(200)    NOT NULL    COMMENT 'SĐT hoặc email nhận OTP',
    target_type ENUM('phone','email') NOT NULL,
    otp_hash    VARCHAR(255)    NOT NULL    COMMENT 'Bcrypt/SHA-256 hash của mã OTP, KHÔNG lưu plaintext',
    purpose     ENUM(
                    'register',         -- Xác thực đăng ký tài khoản
                    'reset_password',   -- Đặt lại mật khẩu
                    'verify_email',     -- Xác thực email
                    'pos_confirm'       -- Xác nhận thao tác nhạy cảm tại POS
                ) NOT NULL              COMMENT 'Mục đích sử dụng OTP',
    attempts    INT             NOT NULL DEFAULT 0   COMMENT 'Số lần nhập sai (khoá sau 5 lần)',
    expires_at  DATETIME        NOT NULL    COMMENT 'Thời điểm OTP hết hiệu lực (thường +5 phút)',
    used_at     DATETIME                    COMMENT 'Thời điểm OTP được dùng thành công (NULL=chưa dùng)',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_otp_codes_target (target, target_type),
    INDEX idx_otp_codes_purpose (purpose),
    INDEX idx_otp_codes_expires_at (expires_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Mã OTP tạm thời cho xác thực nhiều bước';

-- =============================================================================
-- Thêm cột vào bảng shifts
-- cash_difference, reconciliation_status, approved_by — dùng cho tính năng đối soát ca
-- API: PATCH /api/identity/shifts/:shiftId/approve-compensation | approve-excess
-- =============================================================================
ALTER TABLE shifts
    ADD COLUMN expected_closing_cash  DECIMAL(12,2)
                                            COMMENT 'Tiền cuối ca theo hệ thống = opening_cash + total_cash_sales - refunds',
    ADD COLUMN cash_difference        DECIMAL(12,2)
                                            COMMENT 'Chênh lệch = closing_cash - expected_closing_cash (âm=thiếu, dương=thừa)',
    ADD COLUMN reconciliation_status  ENUM('pending','matched','excess','shortage','approved') DEFAULT 'pending'
                                            COMMENT 'Kết quả đối soát: matched=khớp, excess=thừa, shortage=thiếu, approved=đã duyệt',
    ADD COLUMN approved_by            BIGINT
                                            COMMENT '(Cross-schema) mg_identity.users.id — quản lý duyệt lệch ca',
    ADD COLUMN approved_at            DATETIME
                                            COMMENT 'Thời điểm quản lý duyệt lệch ca',
    ADD COLUMN approval_note          TEXT  COMMENT 'Ghi chú của quản lý khi duyệt lệch ca';

-- =============================================================================
-- DỮ LIỆU MẪU — patch mg_identity
-- =============================================================================

-- Cấu hình hạng thành viên
INSERT INTO loyalty_tier_config (tier_code, tier_name, tier_icon, min_spending, max_spending, points_ratio, points_per_vnd, discount_pct, description) VALUES
('member', 'Thành viên',  '⭐',  0.00,           4999999.00,  1.0, 10000, 0.0,  'Hạng cơ bản, tích 1 điểm cho mỗi 10.000đ chi tiêu'),
('silver', 'Bạc',         '🥈',  5000000.00,    19999999.00,  1.5, 10000, 2.0,  'Chi tiêu 5tr+, tích 1.5 điểm/10.000đ, giảm 2% tự động'),
('gold',   'Vàng',        '🥇',  20000000.00,   49999999.00,  2.0, 10000, 5.0,  'Chi tiêu 20tr+, tích 2 điểm/10.000đ, giảm 5% tự động'),
('vip',    'VIP',         '💎',  50000000.00,   NULL,          3.0, 10000, 10.0, 'Chi tiêu 50tr+, tích 3 điểm/10.000đ, giảm 10% tự động, ưu tiên giao hàng');

-- Lịch sử điểm loyalty mẫu
INSERT INTO loyalty_points_transactions (customer_id, transaction_type, points_change, points_balance, description, reference_order_id) VALUES
(1,  'earn_purchase',  125, 125,   'Mua hàng WEB-260101-001 — 1.250.000đ × 1đ/10.000đ',    NULL),
(1,  'earn_purchase',  85,  210,   'Mua hàng POS-260215-001 — 850.000đ × 1đ/10.000đ',     NULL),
(1,  'earn_bonus',     50,  260,   'Thưởng điểm sinh nhật tháng 5',                         NULL),
(1,  'earn_purchase',  99,  359,   'Mua hàng WEB-260314-001 — 590.000đ × 1.5đ/10.000đ', 6),
(1,  'earn_purchase',  75,  434,   'Mua hàng POS-260317-002 — 378.000đ × 1.5đ/10.000đ',  2),
(2,  'earn_purchase',  380, 380,   'Mua hàng WEB-260316-001 — 880.000đ × 1.5đ/10.000đ',  4),
(4,  'earn_purchase',  153, 5753,  'Mua hàng WEB-260315-001 — 1.530.000đ × 1đ/10.000đ', 5),
(3,  'earn_purchase',  32,  32,    'Mua hàng đầu tiên',                                    NULL),
(5,  'earn_purchase',  89,  89,    'Mua hàng — 890.000 điểm tích luỹ',                    NULL),
(2,  'adjust_add',     20,  400,   'Thưởng điểm do review sản phẩm',  NULL);

-- Cập nhật reconciliation cho ca mẫu ca 1 (đã đóng)
UPDATE shifts
SET expected_closing_cash = 5000000.00 + 3125000.00,
    cash_difference = 8250000.00 - (5000000.00 + 3125000.00),
    reconciliation_status = 'matched',
    approved_by = 1,
    approved_at = '2026-03-17 15:10:00',
    approval_note = 'Khớp tiền, duyệt đóng ca'
WHERE id = 1;

UPDATE shifts
SET expected_closing_cash = 3000000.00 + 2500000.00,
    cash_difference = 5680000.00 - (3000000.00 + 2500000.00),
    reconciliation_status = 'surplus',
    approved_by = 1,
    approved_at = '2026-03-17 15:35:00',
    approval_note = 'Thừa 180.000đ — khả năng khách thối tiền chênh lẻ, ghi nhập quỹ'
WHERE id = 3;
