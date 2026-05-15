-- =============================================================================
-- SCHEMA: mg_order
-- Mục đích: Quản lý toàn bộ đơn hàng — Web (online) và POS (tại quầy)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_order
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_order;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS order_promotions;
DROP TABLE IF EXISTS order_internal_notes;
DROP TABLE IF EXISTS returns;
DROP TABLE IF EXISTS return_items;
DROP TABLE IF EXISTS pos_held_order_items;
DROP TABLE IF EXISTS pos_held_orders;
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS outbox_events;

-- =============================================================================
-- BẢNG: carts
-- =============================================================================
CREATE TABLE carts (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    customer_id BIGINT,
    session_id  VARCHAR(100),
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_carts_customer_id (customer_id),
    INDEX idx_carts_session_id (session_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: cart_items
-- =============================================================================
CREATE TABLE cart_items (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    cart_id     BIGINT          NOT NULL,
    product_id  BIGINT          NOT NULL,
    unit_name   VARCHAR(50)     NOT NULL,
    quantity    INT             NOT NULL DEFAULT 1,
    unit_price  DECIMAL(12,2)   NOT NULL,

    PRIMARY KEY (id),
    INDEX idx_cart_items_cart_id (cart_id),
    INDEX idx_cart_items_product_id (product_id),
    UNIQUE KEY uq_cart_items_cart_product_unit (cart_id, product_id, unit_name),

    CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: orders
-- =============================================================================
CREATE TABLE orders (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    order_code              VARCHAR(50)     NOT NULL,
    order_channel           ENUM('web','pos') NOT NULL,
    customer_id             BIGINT,
    customer_name           VARCHAR(200),
    customer_phone          VARCHAR(20),
    shipping_address        TEXT,
    staff_id                BIGINT,
    kiosk_id                VARCHAR(20),
    shift_id                BIGINT,
    subtotal                DECIMAL(15,2)   NOT NULL,
    shipping_fee            DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    discount_amount         DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total_amount            DECIMAL(15,2)   NOT NULL,
    payment_method          ENUM('cash','cod','vnpay','momo','card_visa','qr_transfer') NOT NULL,
    payment_status          ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
    order_status            ENUM('pending_approval','confirmed','picking','shipping','completed','cancelled') NOT NULL DEFAULT 'pending_approval',
    requires_vat_invoice    TINYINT(1)      NOT NULL DEFAULT 0,
    customer_notes          TEXT,
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
    INDEX idx_orders_created_at (created_at),

    CONSTRAINT chk_order_total_non_negative CHECK (total_amount >= 0),
    CONSTRAINT chk_order_discount_bounds CHECK (discount_amount >= 0 AND discount_amount <= subtotal + shipping_fee),
    CONSTRAINT chk_order_subtotal_positive CHECK (subtotal > 0),
    CONSTRAINT chk_order_shipping_non_negative CHECK (shipping_fee >= 0)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: prescriptions
-- =============================================================================
CREATE TABLE prescriptions (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    prescription_code   VARCHAR(100)    NOT NULL,
    order_id            BIGINT,
    customer_id         BIGINT          NOT NULL,
    patient_name        VARCHAR(200)    NOT NULL,
    patient_dob         DATE,
    patient_phone       VARCHAR(20),
    doctor_name         VARCHAR(200)    NOT NULL,
    doctor_license      VARCHAR(100),
    hospital_name       VARCHAR(300)    NOT NULL,
    issue_date          DATE            NOT NULL,
    expiry_date         DATE,
    image_url           VARCHAR(500)    NOT NULL,
    image_sha256        CHAR(64)        COMMENT 'Hash toàn vẹn ảnh',
    verified_image_url  VARCHAR(500),
    max_dispensing_qty  INT             COMMENT 'Giới hạn số lượng phát',
    dispensed_qty       INT             NOT NULL DEFAULT 0,
    diagnosis_code      VARCHAR(50),
    diagnosis_text      VARCHAR(500),
    notes               TEXT,
    status              ENUM('pending','verified','rejected','expired') NOT NULL DEFAULT 'pending',
    verified_by         BIGINT,
    verified_at         DATETIME,
    rejection_reason    VARCHAR(500),
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_prescriptions_code (prescription_code),
    UNIQUE KEY uq_prescriptions_image_hash (image_sha256),
    INDEX idx_prescriptions_order_id (order_id),
    INDEX idx_prescriptions_customer_id (customer_id),
    INDEX idx_prescriptions_status (status),
    
    CONSTRAINT fk_prescriptions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: order_items
-- =============================================================================
CREATE TABLE order_items (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    order_id        BIGINT          NOT NULL,
    product_id      BIGINT          NOT NULL,
    product_name    VARCHAR(300)    NOT NULL,
    unit_name       VARCHAR(50)     NOT NULL,
    quantity        INT             NOT NULL,
    unit_price      DECIMAL(12,2)   NOT NULL,
    total_price     DECIMAL(12,2)   NOT NULL,
    batch_item_id   BIGINT,
    lot_number      VARCHAR(100),
    prescription_id BIGINT          COMMENT 'BẮT BUỘC cho thuốc Rx',

    PRIMARY KEY (id),
    INDEX idx_order_items_order_id (order_id),
    INDEX idx_order_items_product_id (product_id),
    INDEX idx_order_items_batch_item_id (batch_item_id),
    INDEX idx_order_items_prescription (prescription_id),

    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_order_items_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Triggers for Rx dispensing
DROP TRIGGER IF EXISTS trg_rx_dispensing_check;
DELIMITER $$
CREATE TRIGGER trg_rx_dispensing_check
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    DECLARE current_dispensed INT;
    DECLARE max_qty INT;
    DECLARE prx_status VARCHAR(20);
    DECLARE prx_expiry DATE;

    IF NEW.prescription_id IS NOT NULL THEN
        SELECT dispensed_qty, max_dispensing_qty, status, expiry_date
        INTO current_dispensed, max_qty, prx_status, prx_expiry
        FROM prescriptions WHERE id = NEW.prescription_id;

        IF prx_status != 'verified' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Đơn thuốc chưa được xác thực.';
        END IF;
        IF prx_expiry IS NOT NULL AND prx_expiry < CURDATE() THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Đơn thuốc đã hết hạn.';
        END IF;
        IF max_qty IS NOT NULL AND (current_dispensed + NEW.quantity) > max_qty THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số lượng phát vượt quá giới hạn đơn thuốc.';
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_rx_dispensing_update;
DELIMITER $$
CREATE TRIGGER trg_rx_dispensing_update
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    IF NEW.prescription_id IS NOT NULL THEN
        UPDATE prescriptions SET dispensed_qty = dispensed_qty + NEW.quantity WHERE id = NEW.prescription_id;
    END IF;
END$$
DELIMITER ;

-- =============================================================================
-- BẢNG: returns
-- =============================================================================
CREATE TABLE returns (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    return_code     VARCHAR(50)     NOT NULL,
    order_id        BIGINT          NOT NULL,
    order_channel   ENUM('web','pos','supplier') NOT NULL,
    reason          TEXT            NOT NULL,
    refund_amount   DECIMAL(15,2)   NOT NULL,
    refund_method   ENUM('cash','original_payment','store_credit') NOT NULL,
    status          ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
    handled_by      BIGINT,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_returns_return_code (return_code),
    INDEX idx_returns_order_id (order_id),
    INDEX idx_returns_status (status),

    CONSTRAINT fk_returns_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: return_items
-- =============================================================================
CREATE TABLE return_items (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    return_id           BIGINT          NOT NULL,
    order_item_id       BIGINT          NOT NULL,
    quantity_returned   INT             NOT NULL,
    return_to_stock     TINYINT(1)      NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    INDEX idx_return_items_return_id (return_id),
    INDEX idx_return_items_order_item_id (order_item_id),

    CONSTRAINT fk_return_items_return FOREIGN KEY (return_id) REFERENCES returns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_return_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: pos_held_orders
-- =============================================================================
CREATE TABLE pos_held_orders (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    hold_code       VARCHAR(50)     NOT NULL,
    staff_id        BIGINT          NOT NULL,
    shift_id        BIGINT,
    customer_id     BIGINT,
    customer_name   VARCHAR(200),
    note            VARCHAR(500),
    held_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    auto_release_at DATETIME,
    is_released     TINYINT(1)      NOT NULL DEFAULT 0,
    released_at     DATETIME,
    released_note   VARCHAR(300),

    PRIMARY KEY (id),
    UNIQUE KEY uq_held_orders_code (hold_code),
    INDEX idx_held_orders_staff_id (staff_id),
    INDEX idx_held_orders_shift_id (shift_id),
    INDEX idx_held_orders_released (is_released)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: pos_held_order_items
-- =============================================================================
CREATE TABLE pos_held_order_items (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    hold_id         BIGINT          NOT NULL,
    product_id      BIGINT          NOT NULL,
    product_name    VARCHAR(300)    NOT NULL,
    sku             VARCHAR(100),
    unit_name       VARCHAR(50)     NOT NULL,
    quantity        DECIMAL(10,3)   NOT NULL,
    unit_price      DECIMAL(12,2)   NOT NULL,
    current_unit_price DECIMAL(12,2),
    price_discrepancy  DECIMAL(12,2),
    discount_amount DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    subtotal        DECIMAL(12,2)   NOT NULL,
    note            VARCHAR(300),

    PRIMARY KEY (id),
    INDEX idx_held_items_hold_id (hold_id),
    CONSTRAINT fk_held_items_hold FOREIGN KEY (hold_id) REFERENCES pos_held_orders(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: order_promotions (Audit trail)
-- =============================================================================
CREATE TABLE order_promotions (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    order_id                BIGINT          NOT NULL,
    promotion_id            BIGINT          NOT NULL,
    promo_code_snapshot     VARCHAR(50),
    promo_name_snapshot     VARCHAR(200)    NOT NULL,
    promo_type_snapshot     VARCHAR(50)     NOT NULL,
    discount_value_snapshot DECIMAL(10,2)   NOT NULL,
    discount_applied        DECIMAL(12,2)   NOT NULL,
    applied_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_order_promotions_order (order_id),
    CONSTRAINT chk_discount_applied_non_negative CHECK (discount_applied >= 0),
    CONSTRAINT fk_order_promotions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: order_internal_notes
-- =============================================================================
CREATE TABLE order_internal_notes (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    order_id    BIGINT          NOT NULL,
    note        TEXT            NOT NULL,
    created_by  BIGINT          NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_order_notes_order (order_id),
    CONSTRAINT fk_order_notes_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: outbox_events
-- =============================================================================
CREATE TABLE outbox_events (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    event_type      VARCHAR(100)    NOT NULL,
    aggregate_type  VARCHAR(50)     NOT NULL,
    aggregate_id    BIGINT          NOT NULL,
    payload         JSON            NOT NULL,
    status          ENUM('pending','dispatched','failed') NOT NULL DEFAULT 'pending',
    retry_count     TINYINT         NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dispatched_at   DATETIME,

    PRIMARY KEY (id),
    INDEX idx_order_outbox_status (status, created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
