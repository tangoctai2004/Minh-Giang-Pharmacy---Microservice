-- =============================================================================
-- SCHEMA: mg_order
-- Mục đích: Quản lý toàn bộ đơn hàng — Web (online) và POS (tại quầy)
-- Bao gồm: Giỏ hàng, Đơn hàng, Chi tiết đơn, Trả hàng
-- Cross-schema references (enforce tại app layer, không tạo DB-level FK):
--   customer_id  → mg_identity.customers.id
--   staff_id     → mg_identity.users.id
--   shift_id     → mg_identity.shifts.id
--   product_id   → mg_catalog.products.id
--   batch_item_id→ mg_catalog.batch_items.id
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_order
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_order;

-- =============================================================================
-- BẢNG: carts
-- Giỏ hàng phiên mua sắm (Web only) — hỗ trợ cả guest và logged-in customer
-- =============================================================================
CREATE TABLE carts (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    -- Cross-schema: mg_identity.customers.id — NULL nếu khách chưa đăng nhập
    customer_id BIGINT                      COMMENT '(Cross-schema) mg_identity.customers.id',
    session_id  VARCHAR(100)                COMMENT 'Session ID cho khách vãng lai (guest checkout)',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_carts_customer_id (customer_id),
    INDEX idx_carts_session_id (session_id)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Giỏ hàng tạm thời, tự động hết hạn sau khoảng thời gian không hoạt động';

-- =============================================================================
-- BẢNG: cart_items
-- Từng sản phẩm trong giỏ hàng
-- =============================================================================
CREATE TABLE cart_items (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    cart_id     BIGINT          NOT NULL    COMMENT 'FK → carts.id',
    -- Cross-schema: mg_catalog.products.id
    product_id  BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_catalog.products.id',
    unit_name   VARCHAR(50)     NOT NULL    COMMENT 'Đơn vị bán: Viên, Vỉ, Hộp... theo product_units',
    quantity    INT             NOT NULL DEFAULT 1,
    unit_price  DECIMAL(12,2)   NOT NULL    COMMENT 'Giá tại thời điểm thêm vào giỏ',

    PRIMARY KEY (id),
    INDEX idx_cart_items_cart_id (cart_id),
    INDEX idx_cart_items_product_id (product_id),
    UNIQUE KEY uq_cart_items_cart_product_unit (cart_id, product_id, unit_name),

    CONSTRAINT fk_cart_items_cart
        FOREIGN KEY (cart_id) REFERENCES carts(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Chi tiết sản phẩm trong giỏ hàng';

-- =============================================================================
-- BẢNG: orders
-- Đơn hàng — bao gồm cả Web và POS trong cùng 1 bảng
-- Phân biệt bằng cột order_channel
-- =============================================================================
CREATE TABLE orders (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    order_code              VARCHAR(50)     NOT NULL    COMMENT 'Mã đơn duy nhất: WEB-9025 hoặc POS-260310-045',
    order_channel           ENUM('web','pos') NOT NULL COMMENT 'Kênh đặt hàng: web=online, pos=tại quầy',

    -- Thông tin khách hàng (snapshot tại thời điểm đặt)
    -- Cross-schema: mg_identity.customers.id
    customer_id             BIGINT                      COMMENT '(Cross-schema) mg_identity.customers.id — NULL nếu khách lạ POS',
    customer_name           VARCHAR(200)                COMMENT 'Snapshot tên KH lúc đặt (bảo toàn dù KH sau đổi tên)',
    customer_phone          VARCHAR(20)                 COMMENT 'Snapshot SĐT lúc đặt',

    -- Thông tin giao hàng (Web only)
    shipping_address        TEXT                        COMMENT 'Địa chỉ giao hàng đầy đủ — NULL với đơn POS',

    -- Thông tin nhân viên (POS only)
    -- Cross-schema: mg_identity.users.id
    staff_id                BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — nhân viên bán POS',
    kiosk_id                VARCHAR(20)                 COMMENT 'Mã kiosk POS: Kiosk #01...',
    -- Cross-schema: mg_identity.shifts.id
    shift_id                BIGINT                      COMMENT '(Cross-schema) mg_identity.shifts.id — ca làm việc',

    -- Tài chính
    subtotal                DECIMAL(15,2)   NOT NULL    COMMENT 'Tổng tiền hàng trước phí và giảm giá',
    shipping_fee            DECIMAL(12,2)   NOT NULL DEFAULT 0.00
                                                        COMMENT 'Phí vận chuyển — 0 với đơn POS',
    discount_amount         DECIMAL(12,2)   NOT NULL DEFAULT 0.00
                                                        COMMENT 'Tổng số tiền giảm giá (voucher + khuyến mãi)',
    total_amount            DECIMAL(15,2)   NOT NULL    COMMENT 'Tổng thanh toán = subtotal + shipping_fee - discount_amount',

    -- Thanh toán
    payment_method          ENUM('cash','cod','vnpay','momo','card_visa','qr_transfer') NOT NULL
                                                        COMMENT 'Phương thức thanh toán',
    payment_status          ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending'
                                                        COMMENT 'Trạng thái thanh toán',

    -- Trạng thái đơn hàng
    order_status            ENUM(
                                'pending_approval',     -- Web: chờ duyệt
                                'confirmed',            -- Đã xác nhận — POS bắt đầu ở đây
                                'picking',              -- Đang chuẩn bị hàng (pick & pack)
                                'shipping',             -- Đang vận chuyển (web)
                                'completed',            -- Hoàn tất
                                'cancelled'             -- Đã huỷ
                            ) NOT NULL DEFAULT 'pending_approval',

    -- VAT & Ghi chú
    requires_vat_invoice    TINYINT(1)      NOT NULL DEFAULT 0
                                                        COMMENT '1=khách yêu cầu xuất hoá đơn VAT',
    customer_notes          TEXT                        COMMENT 'Ghi chú của khách hàng khi đặt',
    admin_notes             TEXT                        COMMENT 'Ghi chú nội bộ của nhân viên xử lý',

    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_order_code (order_code),
    INDEX idx_orders_order_channel (order_channel),
    INDEX idx_orders_customer_id (customer_id),
    INDEX idx_orders_staff_id (staff_id),
    INDEX idx_orders_shift_id (shift_id),
    INDEX idx_orders_order_status (order_status),
    INDEX idx_orders_payment_status (payment_status),
    INDEX idx_orders_created_at (created_at)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Đơn hàng thống nhất cho cả Web và POS, phân biệt bằng order_channel';

-- =============================================================================
-- BẢNG: order_items
-- Từng dòng sản phẩm trong đơn hàng — snapshot giá và tên tại thời điểm đặt
-- Lưu batch_item_id để truy xuất lô hàng (FEFO tracking)
-- =============================================================================
CREATE TABLE order_items (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    order_id        BIGINT          NOT NULL    COMMENT 'FK → orders.id',
    -- Cross-schema: mg_catalog.products.id
    product_id      BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_catalog.products.id',
    product_name    VARCHAR(300)    NOT NULL    COMMENT 'Snapshot tên sản phẩm tại thời điểm đặt',
    unit_name       VARCHAR(50)     NOT NULL    COMMENT 'Đơn vị: Viên, Vỉ, Hộp...',
    quantity        INT             NOT NULL,
    unit_price      DECIMAL(12,2)   NOT NULL    COMMENT 'Giá bán theo đơn vị tại thời điểm đặt',
    total_price     DECIMAL(12,2)   NOT NULL    COMMENT 'quantity × unit_price',
    -- Lô hàng (FEFO tracking — Cross-schema: mg_catalog.batch_items.id)
    batch_item_id   BIGINT                      COMMENT '(Cross-schema) mg_catalog.batch_items.id — lô được xuất theo FEFO',
    lot_number      VARCHAR(100)                COMMENT 'Snapshot số lô tại thời điểm xuất kho',

    PRIMARY KEY (id),
    INDEX idx_order_items_order_id (order_id),
    INDEX idx_order_items_product_id (product_id),
    INDEX idx_order_items_batch_item_id (batch_item_id),

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Chi tiết sản phẩm trong đơn hàng, snapshot giá và lô hàng FEFO';

-- =============================================================================
-- BẢNG: returns
-- Phiếu trả hàng / hoàn tiền (Web, POS, hoặc trả về NCC)
-- =============================================================================
CREATE TABLE returns (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    return_code     VARCHAR(50)     NOT NULL    COMMENT 'Mã phiếu trả: RET-260310-001',
    order_id        BIGINT          NOT NULL    COMMENT 'FK → orders.id — đơn hàng gốc',
    order_channel   ENUM('web','pos','supplier') NOT NULL
                                                COMMENT 'Kênh trả: web/pos=trả từ KH, supplier=trả về NCC',
    reason          TEXT            NOT NULL    COMMENT 'Lý do trả hàng',
    refund_amount   DECIMAL(15,2)   NOT NULL    COMMENT 'Số tiền hoàn trả cho khách',
    refund_method   ENUM('cash','original_payment','store_credit') NOT NULL
                                                COMMENT 'Hình thức hoàn: cash=tiền mặt, original_payment=hoàn cổng, store_credit=điểm thưởng',
    status          ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
    -- Cross-schema: mg_identity.users.id
    handled_by      BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — nhân viên xử lý',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_returns_return_code (return_code),
    INDEX idx_returns_order_id (order_id),
    INDEX idx_returns_status (status),

    CONSTRAINT fk_returns_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Phiếu trả hàng và hoàn tiền cho khách hàng';

-- =============================================================================
-- BẢNG: return_items
-- Từng sản phẩm trong phiếu trả hàng
-- =============================================================================
CREATE TABLE return_items (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    return_id           BIGINT          NOT NULL    COMMENT 'FK → returns.id',
    order_item_id       BIGINT          NOT NULL    COMMENT 'FK → order_items.id — dòng hàng gốc được trả',
    quantity_returned   INT             NOT NULL    COMMENT 'Số lượng trả lại',
    return_to_stock     TINYINT(1)      NOT NULL DEFAULT 0
                                                    COMMENT '1=nhập lại kho (còn dùng được), 0=huỷ (hư hỏng)',

    PRIMARY KEY (id),
    INDEX idx_return_items_return_id (return_id),
    INDEX idx_return_items_order_item_id (order_item_id),

    CONSTRAINT fk_return_items_return
        FOREIGN KEY (return_id) REFERENCES returns(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_return_items_order_item
        FOREIGN KEY (order_item_id) REFERENCES order_items(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Chi tiết sản phẩm trong phiếu trả hàng';

-- =============================================================================
-- DỮ LIỆU MẪU: mg_order
-- =============================================================================

-- Giỏ hàng mẫu
INSERT INTO carts (customer_id, session_id) VALUES
(1, NULL),
(3, NULL),
(NULL, 'sess_abc123xyz456');

-- Sản phẩm trong giỏ hàng
INSERT INTO cart_items (cart_id, product_id, unit_name, quantity, unit_price) VALUES
(1, 1, 'Hộp',   2, 280000.00),   -- Khách 1 đang mua 2 hộp Panadol
(1, 4, 'Hộp',   1, 170000.00),   -- và 1 hộp Vitamin C
(2, 6, 'Vỉ',    3,  14000.00),   -- Khách 3 mua 3 vỉ Cetirizine
(3, 7, 'Hộp',   1, 850000.00);   -- Guest mua Blackmores

-- Đơn hàng đã hoàn thành
INSERT INTO orders (order_code, order_channel, customer_id, customer_name, customer_phone,
    shipping_address, staff_id, kiosk_id, shift_id,
    subtotal, shipping_fee, discount_amount, total_amount,
    payment_method, payment_status, order_status,
    requires_vat_invoice, customer_notes) VALUES
-- POS orders
('POS-260317-001', 'pos', NULL,     'Nguyễn Văn Bình',  '0978123456', NULL, 3, 'Kiosk #01', 1,
    325000.00, 0.00, 0.00, 325000.00,   'cash',       'paid',    'completed', 0, NULL),
('POS-260317-002', 'pos', 1,        'Nguyễn Thị Mai',   '0901111222', NULL, 3, 'Kiosk #01', 1,
    420000.00, 0.00, 42000.00, 378000.00, 'qr_transfer', 'paid', 'completed', 0, 'Khách VIP'),
('POS-260317-003', 'pos', NULL,     'Trần Thị Bảo',     '0934112233', NULL, 4, 'Kiosk #02', 3,
     80000.00, 0.00, 0.00,  80000.00,  'cash',       'paid',    'completed', 0, NULL),
-- Web orders
('WEB-260316-001', 'web', 2,        'Trần Văn Hùng',    '0912222333',
    'TP. Hồ Chí Minh, Quận Bình Thạnh, Phường 12, 45 Xô Viết Nghệ Tĩnh',
    NULL, NULL, NULL,
    850000.00, 30000.00, 0.00, 880000.00, 'cod',      'pending', 'confirmed', 0, 'Giao buổi sáng'),
('WEB-260315-001', 'web', 4,        'Phạm Công Danh',   '0934444555',
    'TP. Hồ Chí Minh, Quận Gò Vấp, Phường 12, 67 Nguyễn Văn Nghi',
    NULL, NULL, NULL,
   1700000.00, 0.00, 170000.00, 1530000.00, 'vnpay', 'paid',    'shipping',  1, 'Cần hoá đơn VAT'),
('WEB-260314-001', 'web', 5,        'Hoàng Thị Bích Ngọc','0945555666',
    'TP. Hồ Chí Minh, Quận 3, Phường 6, 15A Võ Thị Sáu',
    NULL, NULL, NULL,
    560000.00, 30000.00, 0.00, 590000.00, 'momo',     'paid',    'completed', 0, NULL);

-- Chi tiết đơn hàng (với batch_item_id để theo dõi lô FEFO)
INSERT INTO order_items (order_id, product_id, product_name, unit_name, quantity, unit_price, total_price, batch_item_id, lot_number) VALUES
-- POS-260317-001
(1, 1, 'Panadol Extra Hộp 12 viên',           'Hộp',   5, 25000.00, 125000.00,  1, 'PAN-BN-260101'),
(1, 6, 'Cetirizine 10mg Hộp 30 viên',          'Hộp',   2, 40000.00,  80000.00,  2, 'CET-DH-251201'),
(1, 9, 'Băng cuộn y tế 5cm × 5m',             'Cuộn',  12, 5000.00,  60000.00,  3, 'BAN-MV-260101'),
(1, 4, 'Vitamin C 1000mg Effervescent Hộp 20v','Viên',  24, 9000.00,  60000.00,  6, 'VTC-OPV-261001'),
-- POS-260317-002
(2, 7, 'Blackmores Bio C 1000mg Hộp 31 viên',  'Hộp',   2, 868000.00, 1736000.00, 5, 'BLK-BM-260201'),
-- WEB-260316-001
(4, 7, 'Blackmores Bio C 1000mg Hộp 31 viên',  'Hộp',   1, 850000.00, 850000.00, 5, 'BLK-BM-260201'),
-- WEB-260315-001
(5, 4, 'Vitamin C 1000mg Effervescent Hộp 20v','Hộp',   5, 170000.00, 850000.00, 6, 'VTC-OPV-261001'),
(5, 7, 'Blackmores Bio C 1000mg Hộp 31 viên',  'Hộp',   1, 850000.00, 850000.00, 5, 'BLK-BM-260201'),
-- WEB-260314-001
(6, 6, 'Cetirizine 10mg Hộp 30 viên',          'Hộp',   4, 40000.00, 160000.00, 2, 'CET-DH-251201'),
(6, 1, 'Panadol Extra Hộp 12 viên',            'Hộp',  16, 25000.00, 400000.00, 1, 'PAN-BN-260101');

-- Phiếu trả hàng mẫu
INSERT INTO returns (return_code, order_id, order_channel, reason, refund_amount, refund_method, status, handled_by) VALUES
('RET-260317-001', 6, 'web', 'Sản phẩm bị móp vỏ hộp khi giao đến, không ảnh hưởng thuốc.', 40000.00, 'original_payment', 'approved', 2),
('RET-260317-002', 1, 'pos', 'Khách mua nhầm loại, đổi sang dạng viên sủi.', 25000.00,   'cash', 'completed', 3);

-- Chi tiết trả hàng
INSERT INTO return_items (return_id, order_item_id, quantity_returned, return_to_stock) VALUES
(1, 9,  1, 1),  -- Trả 1 hộp Cetirizine, còn dùng được — nhập lại kho
(2, 1,  1, 1);  -- Trả 1 hộp Panadol, tốt — nhập lại kho


-- -----------------------------------------------------------------------------
-- PATCH -- bo sung bang/cot (da hop nhat, khong chay rieng nua)
-- -----------------------------------------------------------------------------

-- =============================================================================
-- PATCH: mg_order — Bổ sung các bảng còn thiếu
-- Bổ sung: pos_held_orders, pos_held_order_items, prescriptions
-- =============================================================================

USE mg_order;

-- =============================================================================
-- BẢNG: pos_held_orders
-- Đơn hàng tạm giữ tại POS (chưa thanh toán, chờ xử lý)
-- API: POST /api/order/cart/hold, GET /api/order/cart/held,
--      DELETE /api/order/cart/held/:holdId, POST /api/order/cart/restore/:holdId
-- =============================================================================
CREATE TABLE IF NOT EXISTS pos_held_orders (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    hold_code       VARCHAR(50)     NOT NULL    COMMENT 'Mã giữ: HOLD-260317-001',
    -- Cross-schema: mg_identity.users.id (staff POS)
    staff_id        BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_identity.users.id — nhân viên tạo đơn giữ',
    -- Cross-schema: mg_identity.shifts.id
    shift_id        BIGINT                      COMMENT '(Cross-schema) mg_identity.shifts.id — ca làm tạo đơn giữ',
    -- Cross-schema: mg_identity.customers.id (nullable — khách vãng lai)
    customer_id     BIGINT                      COMMENT '(Cross-schema) mg_identity.customers.id — NULL nếu khách vãng lai',
    customer_name   VARCHAR(200)                COMMENT 'Tên hiển thị khách (snapshot tại lúc giữ)',
    note            VARCHAR(500)                COMMENT 'Lý do giữ: "Khách đi lấy tiền", "Chờ kết quả xét nghiệm", v.v.',
    held_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    auto_release_at DATETIME                    COMMENT 'Tự động huỷ giữ sau giờ này (NULL=giữ vô thời hạn)',
    is_released     TINYINT(1)      NOT NULL DEFAULT 0  COMMENT '0=đang giữ, 1=đã giải phóng (restore/cancel)',
    released_at     DATETIME                    COMMENT 'Thời điểm giải phóng đơn giữ',
    released_note   VARCHAR(300)                COMMENT 'Lý do giải phóng: "Khách quay lại thanh toán", "Khách không mua"',

    PRIMARY KEY (id),
    UNIQUE KEY uq_held_orders_code (hold_code),
    INDEX idx_held_orders_staff_id (staff_id),
    INDEX idx_held_orders_shift_id (shift_id),
    INDEX idx_held_orders_held_at (held_at),
    INDEX idx_held_orders_released (is_released)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Đơn hàng tạm giữ tại quầy POS chưa hoàn thành thanh toán';

-- =============================================================================
-- BẢNG: pos_held_order_items
-- Chi tiết sản phẩm trong đơn hàng tạm giữ
-- =============================================================================
CREATE TABLE IF NOT EXISTS pos_held_order_items (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    hold_id         BIGINT          NOT NULL    COMMENT 'FK → pos_held_orders.id',
    -- Cross-schema: mg_catalog.products.id
    product_id      BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_catalog.products.id',
    -- Snapshot tại lúc giữ đơn (tránh thay đổi giá ảnh hưởng khi restore)
    product_name    VARCHAR(300)    NOT NULL    COMMENT 'Snapshot tên sản phẩm',
    sku             VARCHAR(100)                COMMENT 'Snapshot SKU',
    unit_name       VARCHAR(50)     NOT NULL    COMMENT 'Snapshot đơn vị: Hộp, Vỉ, Chai, v.v.',
    quantity        DECIMAL(10,3)   NOT NULL    COMMENT 'Số lượng',
    unit_price      DECIMAL(12,2)   NOT NULL    COMMENT 'Snapshot đơn giá tại lúc giữ',
    discount_amount DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT 'Khuến mại tính theo sản phẩm',
    subtotal        DECIMAL(12,2)   NOT NULL    COMMENT 'Thành tiền = quantity × unit_price - discount_amount',
    note            VARCHAR(300)                COMMENT 'Ghi chú riêng từng dòng: "Theo đơn thuốc", v.v.',

    PRIMARY KEY (id),
    INDEX idx_held_items_hold_id (hold_id),
    CONSTRAINT fk_held_items_hold
        FOREIGN KEY (hold_id) REFERENCES pos_held_orders(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Chi tiết sản phẩm trong đơn hàng POS đang tạm giữ';

-- =============================================================================
-- BẢNG: prescriptions
-- Đơn thuốc kèm theo đơn hàng (bán thuốc kê đơn theo prescription)
-- API: POST /api/catalog/prescriptions, GET /api/catalog/prescriptions/:orderId,
--      GET /api/catalog/search-prescriptions  (admin)
-- =============================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    prescription_code   VARCHAR(100)    NOT NULL    COMMENT 'Mã đơn thuốc (bệnh viện cấp hoặc tự đặt)',
    order_id            BIGINT                      COMMENT 'FK → orders.id (NULL nếu chưa gắn đơn hàng)',
    -- Cross-schema: mg_identity.customers.id
    customer_id         BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_identity.customers.id',
    patient_name        VARCHAR(200)    NOT NULL    COMMENT 'Tên bệnh nhân (có thể khác tên khách)',
    patient_dob         DATE                        COMMENT 'Ngày sinh bệnh nhân',
    patient_phone       VARCHAR(20)                 COMMENT 'SĐT bệnh nhân',
    doctor_name         VARCHAR(200)    NOT NULL    COMMENT 'Tên bác sĩ kê đơn',
    doctor_license      VARCHAR(100)                COMMENT 'Số chứng chỉ hành nghề bác sĩ',
    hospital_name       VARCHAR(300)    NOT NULL    COMMENT 'Tên cơ sở y tế',
    issue_date          DATE            NOT NULL    COMMENT 'Ngày kê đơn',
    expiry_date         DATE                        COMMENT 'Ngày hết hiệu lực đơn thuốc',
    -- Upload ảnh đơn thuốc (lưu tại CDN/object storage)
    image_url           VARCHAR(500)    NOT NULL    COMMENT 'URL ảnh đơn thuốc gốc',
    image_thumbnail_url VARCHAR(500)                COMMENT 'URL thumbnail ảnh đơn thuốc',
    diagnosis_code      VARCHAR(50)                 COMMENT 'Mã chẩn đoán ICD-10',
    diagnosis_text      VARCHAR(500)                COMMENT 'Chẩn đoán văn bản',
    notes               TEXT                        COMMENT 'Ghi chú thêm: lưu ý dị ứng, v.v.',
    status              ENUM('pending','verified','rejected','expired') NOT NULL DEFAULT 'pending'
                                                    COMMENT 'Trạng thái xác thực: pending=chờ dược sĩ kiểm tra, verified=đã xác thực',
    verified_by         BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — dược sĩ xác thực',
    verified_at         DATETIME                    COMMENT 'Thời điểm xác thực',
    rejection_reason    VARCHAR(500)                COMMENT 'Lý do từ chối nếu status=rejected',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_prescriptions_code (prescription_code),
    INDEX idx_prescriptions_order_id (order_id),
    INDEX idx_prescriptions_customer_id (customer_id),
    INDEX idx_prescriptions_status (status),
    INDEX idx_prescriptions_issue_date (issue_date),
    CONSTRAINT fk_prescriptions_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Đơn thuốc kê đơn của bác sĩ — lưu trữ và xác thực tại quầy';

-- =============================================================================
-- DỮ LIỆU MẪU — patch mg_order
-- =============================================================================

-- Đơn hàng tạm giữ tại POS
INSERT INTO pos_held_orders (hold_code, staff_id, shift_id, customer_id, customer_name, note, auto_release_at, is_released) VALUES
('HOLD-260317-001', 2, 2, 1,  'Nguyễn Thị Mai',    'Khách đi lấy tiền mặt, quay lại sau 10 phút',        '2026-03-17 11:00:00', 0),
('HOLD-260317-002', 2, 2, NULL, 'Khách vãng lai',   'Khách chờ xác nhận đơn thuốc với bác sĩ qua điện thoại', '2026-03-17 11:30:00', 0),
('HOLD-260317-003', 4, 2, 3,  'Trần Thị Thu',       'Khách chờ người nhà mang thêm tiền',                 NULL, 0),
('HOLD-260316-001', 2, 1, 2,  'Lê Văn Nam',         NULL,                                                  NULL, 1);

-- Chi tiết đơn hàng tạm giữ
INSERT INTO pos_held_order_items (hold_id, product_id, product_name, sku, unit_name, quantity, unit_price, discount_amount, subtotal) VALUES
(1, 1, 'Paracetamol 500mg Hộp 100 viên',  'PCT-500-H100', 'Hộp',   2, 25000.00, 0.00,   50000.00),
(1, 3, 'Vitamin C 1000mg',                 'VTC-1000',     'Hộp',   1, 89000.00, 5000.00, 84000.00),
(2, 5, 'Amoxicillin 500mg (kê đơn)',       'AMOX-500',     'Hộp',   1, 65000.00, 0.00,   65000.00),
(2, 6, 'Omeprazole 20mg',                  'OMP-20',       'Hộp',   2, 55000.00, 0.00,  110000.00),
(3, 2, 'Ibuprofen 200mg Vỉ 10 viên',       'IBU-200-V10',  'Vỉ',    3, 8500.00,  500.00, 25000.00),
(3, 7, 'Cetirizine 10mg',                  'CTZN-10',      'Hộp',   1, 45000.00, 0.00,   45000.00),
(4, 4, 'Aspirin 100mg',                    'ASP-100',      'Hộp',   1, 32000.00, 0.00,   32000.00);

-- Đơn thuốc kê đơn mẫu
INSERT INTO prescriptions
    (prescription_code, order_id, customer_id, patient_name, patient_dob, patient_phone,
     doctor_name, doctor_license, hospital_name, issue_date, expiry_date,
     image_url, diagnosis_code, diagnosis_text, notes, status, verified_by, verified_at)
VALUES
(
    'RX-BVND-20260315-001', 6, 1, 'Nguyễn Thị Mai', '1985-05-12', '0901234567',
    'BS. Trần Minh Tuấn', 'CCHN-029-001234', 'Bệnh viện Nhân Dân 115',
    '2026-03-15', '2026-04-15',
    'https://cdn.minhgiang.vn/prescriptions/rx-bvnd-20260315-001.jpg',
    'J06.9', 'Viêm hô hấp trên cấp không đặc hiệu',
    'Bệnh nhân có tiền sử dị ứng Penicillin',
    'verified', 3, '2026-03-15 09:30:00'
),
(
    'RX-BVQ1-20260316-002', NULL, 2, 'Lê Văn Nam', '1978-09-22', '0912345678',
    'BS. Nguyễn Thị Hoa', 'CCHN-029-005678', 'Bệnh viện Quận 1',
    '2026-03-16', '2026-04-16',
    'https://cdn.minhgiang.vn/prescriptions/rx-bvq1-20260316-002.jpg',
    'K21.0', 'Bệnh trào ngược dạ dày-thực quản có viêm thực quản',
    NULL,
    'pending', NULL, NULL
),
(
    'RX-BVCR-20260310-003', NULL, 4, 'Phạm Thị Huệ', '1962-03-08', '0933456789',
    'BS. Lê Quang Khải', 'CCHN-029-009012', 'Bệnh viện Chợ Rẫy',
    '2026-03-10', '2026-04-10',
    'https://cdn.minhgiang.vn/prescriptions/rx-bvcr-20260310-003.jpg',
    'I10', 'Tăng huyết áp nguyên phát',
    'Đơn thuốc cho 30 ngày, tái khám 10/04/2026',
    'verified', 3, '2026-03-10 14:20:00'
);
