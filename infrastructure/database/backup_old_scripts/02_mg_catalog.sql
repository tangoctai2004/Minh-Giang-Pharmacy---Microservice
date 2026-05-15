-- =============================================================================
-- SCHEMA: mg_catalog
-- Mục đích: Quản lý Danh Mục, Sản Phẩm (Thuốc), Kho Hàng, Nhà Cung Cấp
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_catalog
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_catalog;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS delivery_timeslots;
DROP TABLE IF EXISTS delivery_config;
DROP TABLE IF EXISTS audit_items;
DROP TABLE IF EXISTS inventory_audits;
DROP TABLE IF EXISTS storage_shelves;
DROP TABLE IF EXISTS storage_cabinets;
DROP TABLE IF EXISTS storage_zones;
DROP TABLE IF EXISTS stock_reservations;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS batch_items;
DROP TABLE IF EXISTS batches;
DROP TABLE IF EXISTS product_specifications;
DROP TABLE IF EXISTS product_units;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS categories;

-- =============================================================================
-- BẢNG: categories
-- =============================================================================
CREATE TABLE categories (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150)    NOT NULL,
    slug        VARCHAR(200)    NOT NULL,
    parent_id   BIGINT,
    description TEXT,
    image_url   VARCHAR(500),
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    sort_order  INT             NOT NULL DEFAULT 0,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_slug (slug),
    INDEX idx_categories_parent_id (parent_id),
    INDEX idx_categories_is_active (is_active),
    INDEX idx_categories_sort_order (sort_order),

    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id) REFERENCES categories(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: suppliers
-- =============================================================================
CREATE TABLE suppliers (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    code                    VARCHAR(20)     NOT NULL,
    name                    VARCHAR(300)    NOT NULL,
    contact_name            VARCHAR(150),
    phone                   VARCHAR(20),
    email                   VARCHAR(150),
    address                 TEXT,
    tax_code                VARCHAR(50),
    total_purchase_value    DECIMAL(20,2)   NOT NULL DEFAULT 0.00,
    current_debt            DECIMAL(20,2)   NOT NULL DEFAULT 0.00,
    status                  ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_suppliers_code (code),
    INDEX idx_suppliers_status (status),
    INDEX idx_suppliers_current_debt (current_debt)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: locations
-- =============================================================================
CREATE TABLE locations (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    zone        VARCHAR(100)    NOT NULL,
    cabinet     VARCHAR(100)    NOT NULL,
    shelf       VARCHAR(100)    NOT NULL,
    label       VARCHAR(200)    NOT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    INDEX idx_locations_zone (zone),
    INDEX idx_locations_is_active (is_active)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: brands
-- =============================================================================
CREATE TABLE brands (
    id          INT             NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150)    NOT NULL,
    slug        VARCHAR(200)    NOT NULL,
    logo_url    VARCHAR(500),
    country     VARCHAR(100),
    is_featured TINYINT(1)      NOT NULL DEFAULT 0,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    sort_order  INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_brands_slug (slug),
    INDEX idx_brands_is_featured (is_featured),
    INDEX idx_brands_is_active (is_active)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: products
-- =============================================================================
CREATE TABLE products (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    sku                     VARCHAR(50)     NOT NULL,
    name                    VARCHAR(300)    NOT NULL,
    category_id             BIGINT          NOT NULL,
    brand_id                INT,
    active_ingredient       VARCHAR(500),
    registration_number     VARCHAR(100),
    manufacturer            VARCHAR(300),
    requires_prescription   TINYINT(1)      NOT NULL DEFAULT 0,
    base_unit               VARCHAR(50)     NOT NULL,
    cost_price              DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    retail_price            DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    min_stock_alert         INT             NOT NULL DEFAULT 10,
    image_url               VARCHAR(500),
    gallery                 JSON,
    description             TEXT,
    tags                    JSON,
    country_of_origin       VARCHAR(100),
    is_exclusive            TINYINT(1)      NOT NULL DEFAULT 0,
    sales_volume            INT             NOT NULL DEFAULT 0,
    status                  ENUM('active','inactive') NOT NULL DEFAULT 'active',
    barcode                 VARCHAR(100),
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_products_sku (sku),
    UNIQUE KEY uq_products_barcode (barcode),
    INDEX idx_products_category_id (category_id),
    INDEX idx_products_brand_id (brand_id),
    INDEX idx_products_status (status),
    INDEX idx_products_requires_prescription (requires_prescription),
    INDEX idx_products_is_exclusive (is_exclusive),
    INDEX idx_products_name (name),

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: product_units
-- =============================================================================
CREATE TABLE product_units (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    product_id      BIGINT          NOT NULL,
    unit_name       VARCHAR(50)     NOT NULL,
    conversion_qty  INT             NOT NULL,
    of_unit         VARCHAR(50)     NOT NULL,
    retail_price    DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    sort_order      INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    INDEX idx_product_units_product_id (product_id),

    CONSTRAINT fk_product_units_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: product_specifications
-- =============================================================================
CREATE TABLE product_specifications (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    product_id  BIGINT          NOT NULL,
    spec_key    VARCHAR(150)    NOT NULL,
    spec_value  TEXT            NOT NULL,
    sort_order  INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    INDEX idx_product_specs_product_id (product_id),

    CONSTRAINT fk_product_specs_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: batches
-- =============================================================================
CREATE TABLE batches (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    batch_code      VARCHAR(50)     NOT NULL,
    supplier_id     BIGINT          NOT NULL,
    delivery_person VARCHAR(150),
    received_date   DATE            NOT NULL,
    total_amount    DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    paid_amount     DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    status          ENUM('draft','completed') NOT NULL DEFAULT 'draft',
    notes           TEXT,
    created_by      BIGINT          NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_batches_batch_code (batch_code),
    INDEX idx_batches_supplier_id (supplier_id),
    INDEX idx_batches_received_date (received_date),
    INDEX idx_batches_status (status),

    CONSTRAINT fk_batches_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: batch_items
-- =============================================================================
CREATE TABLE batch_items (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    batch_id                BIGINT          NOT NULL,
    product_id              BIGINT          NOT NULL,
    lot_number              VARCHAR(100)    NOT NULL,
    manufacture_date        DATE,
    expiry_date             DATE            NOT NULL,
    quantity_received       INT             NOT NULL,
    quantity_remaining      INT             NOT NULL,
    cost_price              DECIMAL(15,2)   NOT NULL,
    clearance_discount_pct  DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    clearance_price         DECIMAL(15,2),
    location_id             BIGINT,
    status                  ENUM('available','near_expiry','expired','depleted') NOT NULL DEFAULT 'available',
    deleted_reason          VARCHAR(300)    COMMENT 'Soft delete reason',

    PRIMARY KEY (id),
    INDEX idx_batch_items_batch_id (batch_id),
    INDEX idx_batch_items_fefo (product_id, status, expiry_date),
    INDEX idx_batch_items_expiry_date (expiry_date),
    INDEX idx_batch_items_location_id (location_id),

    CONSTRAINT chk_batch_qty_bounds
        CHECK (quantity_remaining >= 0 AND quantity_remaining <= quantity_received),
    CONSTRAINT fk_batch_items_batch
        FOREIGN KEY (batch_id) REFERENCES batches(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_batch_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_batch_items_location
        FOREIGN KEY (location_id) REFERENCES locations(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Triggers for batch_items
DROP TRIGGER IF EXISTS trg_batch_items_status_guard;
DELIMITER $$
CREATE TRIGGER trg_batch_items_status_guard
BEFORE UPDATE ON batch_items
FOR EACH ROW
BEGIN
    IF NEW.expiry_date < CURDATE() AND NEW.status IN ('available', 'near_expiry') THEN
        SET NEW.status = 'expired';
    END IF;
    IF DATEDIFF(NEW.expiry_date, CURDATE()) BETWEEN 1 AND 90 AND NEW.status = 'available' THEN
        SET NEW.status = 'near_expiry';
    END IF;
    IF NEW.status = 'available' AND NEW.expiry_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không thể đặt status=available cho lô thuốc đã hết hạn.';
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_batch_items_no_hard_delete;
DELIMITER $$
CREATE TRIGGER trg_batch_items_no_hard_delete
BEFORE DELETE ON batch_items
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'batch_items KHÔNG thể DELETE vật lý. Dùng soft delete.';
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_clearance_fefo_check;
DELIMITER $$
CREATE TRIGGER trg_clearance_fefo_check
BEFORE UPDATE ON batch_items
FOR EACH ROW
BEGIN
    DECLARE older_count INT;
    IF NEW.clearance_discount_pct > 0 AND OLD.clearance_discount_pct = 0 THEN
        SELECT COUNT(*) INTO older_count FROM batch_items
        WHERE product_id = NEW.product_id AND id != NEW.id AND status IN ('available', 'near_expiry')
          AND expiry_date < NEW.expiry_date AND clearance_discount_pct = 0;
        IF older_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vi phạm FEFO: Có lô hàng HSD sớm hơn chưa được thanh lý.';
        END IF;
    END IF;
END$$
DELIMITER ;

-- =============================================================================
-- BẢNG: stock_movements
-- =============================================================================
CREATE TABLE stock_movements (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    movement_code   VARCHAR(50)     NOT NULL,
    batch_item_id   BIGINT          NOT NULL,
    product_id      BIGINT          NOT NULL,
    movement_type   ENUM('inbound','outbound_sale','outbound_return_supplier','outbound_damage','outbound_expiry') NOT NULL,
    quantity        INT             NOT NULL,
    reference_type  ENUM('purchase_order','pos_order','web_order','return','adjustment'),
    reference_id    BIGINT,
    reason          TEXT,
    created_by      BIGINT,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_stock_movements_batch_item_id (batch_item_id),
    INDEX idx_stock_movements_product_id (product_id),
    INDEX idx_stock_movements_movement_type (movement_type),
    INDEX idx_stock_movements_reference (reference_type, reference_id),
    INDEX idx_stock_movements_created_by (created_by),
    INDEX idx_stock_movements_created_at (created_at),

    CONSTRAINT fk_stock_movements_batch_item
        FOREIGN KEY (batch_item_id) REFERENCES batch_items(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Triggers for immutable stock_movements
DROP TRIGGER IF EXISTS trg_stock_movements_immutable_upd;
DELIMITER $$
CREATE TRIGGER trg_stock_movements_immutable_upd
BEFORE UPDATE ON stock_movements
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movements là audit log bất biến — UPDATE không được phép.';
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_stock_movements_immutable_del;
DELIMITER $$
CREATE TRIGGER trg_stock_movements_immutable_del
BEFORE DELETE ON stock_movements
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movements là audit log bất biến — DELETE không được phép.';
END$$
DELIMITER ;

-- =============================================================================
-- BẢNG: stock_reservations
-- =============================================================================
CREATE TABLE stock_reservations (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    batch_item_id   BIGINT          NOT NULL,
    product_id      BIGINT          NOT NULL,
    quantity        INT             NOT NULL,
    source_type     ENUM('pos_hold','web_checkout','pos_checkout') NOT NULL,
    source_id       BIGINT          NOT NULL,
    reserved_by     BIGINT,
    reserved_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME        NOT NULL,
    released_at     DATETIME,
    release_reason  ENUM('completed','cancelled','expired'),

    PRIMARY KEY (id),
    INDEX idx_reservations_batch (batch_item_id, released_at),
    INDEX idx_reservations_product (product_id, released_at),
    INDEX idx_reservations_source (source_type, source_id),
    INDEX idx_reservations_expires (expires_at),

    CONSTRAINT chk_reservation_qty_positive CHECK (quantity > 0),
    CONSTRAINT fk_reservations_batch FOREIGN KEY (batch_item_id) REFERENCES batch_items(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reservations_product FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: storage hierarchy
-- =============================================================================
CREATE TABLE storage_zones (
    id          INT             NOT NULL AUTO_INCREMENT,
    code        VARCHAR(20)     NOT NULL,
    name        VARCHAR(100)    NOT NULL,
    description VARCHAR(300),
    temp_min    DECIMAL(5,1),
    temp_max    DECIMAL(5,1),
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_storage_zones_code (code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE storage_cabinets (
    id          INT             NOT NULL AUTO_INCREMENT,
    zone_id     INT             NOT NULL,
    code        VARCHAR(20)     NOT NULL,
    name        VARCHAR(100)    NOT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_storage_cabinets_code (code),
    INDEX idx_storage_cabinets_zone (zone_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE storage_shelves (
    id          INT             NOT NULL AUTO_INCREMENT,
    cabinet_id  INT             NOT NULL,
    code        VARCHAR(20)     NOT NULL,
    name        VARCHAR(100)    NOT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_storage_shelves_code (code),
    INDEX idx_storage_shelves_cabinet (cabinet_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: inventory_audits
-- =============================================================================
CREATE TABLE inventory_audits (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    audit_code      VARCHAR(50)     NOT NULL,
    audited_by      BIGINT          NOT NULL,
    audit_date      DATE            NOT NULL,
    status          ENUM('draft','completed','reconciled') NOT NULL DEFAULT 'draft',
    notes           TEXT,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_audits_code (audit_code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS trg_audit_reconcile_completeness;
DELIMITER $$
CREATE TRIGGER trg_audit_reconcile_completeness
BEFORE UPDATE ON inventory_audits
FOR EACH ROW
BEGIN
    DECLARE null_count INT;
    IF NEW.status = 'reconciled' AND OLD.status = 'draft' THEN
        SELECT COUNT(*) INTO null_count FROM audit_items WHERE audit_id = NEW.id AND actual_quantity IS NULL;
        IF null_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không thể xác nhận: vẫn còn dòng chưa nhập số lượng.';
        END IF;
    END IF;
END$$
DELIMITER ;

CREATE TABLE audit_items (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    audit_id            BIGINT          NOT NULL,
    batch_item_id       BIGINT          NOT NULL,
    product_id          BIGINT          NOT NULL,
    system_quantity     INT             NOT NULL,
    actual_quantity     INT,
    discrepancy         INT,
    note                TEXT,

    PRIMARY KEY (id),
    INDEX idx_audit_items_audit_id (audit_id),
    INDEX idx_audit_items_product_id (product_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: delivery_config
-- =============================================================================
CREATE TABLE delivery_config (
    id                  INT             NOT NULL AUTO_INCREMENT,
    method_code         VARCHAR(50)     NOT NULL,
    method_name         VARCHAR(150)    NOT NULL,
    base_fee            DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    free_from_amount    DECIMAL(12,2),
    estimated_minutes   INT,
    is_active           TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_delivery_config_code (method_code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE delivery_timeslots (
    id          INT             NOT NULL AUTO_INCREMENT,
    label       VARCHAR(100)    NOT NULL,
    start_time  TIME            NOT NULL,
    end_time    TIME            NOT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
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
    INDEX idx_catalog_outbox_status (status, created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: catalog_vouchers
-- =============================================================================
CREATE TABLE catalog_vouchers (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    code                VARCHAR(50)     NOT NULL,
    name                VARCHAR(255)    NOT NULL,
    discount_type       ENUM('percent','fixed','freeship') NOT NULL,
    discount_value      DECIMAL(15,2)   NOT NULL,
    max_discount        DECIMAL(15,2),
    min_order_amount    DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    usage_count         INT             NOT NULL DEFAULT 0,
    usage_limit         INT             NOT NULL DEFAULT 0,
    valid_from          DATE,
    valid_to            DATE,
    status              ENUM('active','paused','expired','used_up') NOT NULL DEFAULT 'active',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_catalog_vouchers_code (code),
    INDEX idx_catalog_vouchers_status (status),
    INDEX idx_catalog_vouchers_valid (valid_from, valid_to)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: catalog_gift_campaigns
-- =============================================================================
CREATE TABLE catalog_gift_campaigns (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    name                VARCHAR(255)    NOT NULL,
    min_order_amount    DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    gift_product_id     BIGINT          NOT NULL,
    max_per_customer    INT             NOT NULL DEFAULT 1,
    usage_count         INT             NOT NULL DEFAULT 0,
    status              ENUM('active','paused','expired') NOT NULL DEFAULT 'active',
    valid_from          DATE,
    valid_to            DATE,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_catalog_gifts_status (status),
    INDEX idx_catalog_gifts_valid (valid_from, valid_to),
    CONSTRAINT fk_catalog_gifts_product
        FOREIGN KEY (gift_product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: catalog_loyalty_config
-- =============================================================================
CREATE TABLE catalog_loyalty_config (
    id                  INT             NOT NULL AUTO_INCREMENT,
    tiers               JSON            NOT NULL,
    redemption          JSON            NOT NULL,
    channels            JSON            NOT NULL,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: catalog_audit_logs
-- =============================================================================
CREATE TABLE catalog_audit_logs (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    action          VARCHAR(100)    NOT NULL,
    entity_type     VARCHAR(100)    NOT NULL,
    entity_id       BIGINT,
    user_id         BIGINT,
    request_id      VARCHAR(64),
    before_data     JSON,
    after_data      JSON,
    metadata        JSON,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_catalog_audit_action (action),
    INDEX idx_catalog_audit_entity (entity_type, entity_id),
    INDEX idx_catalog_audit_created (created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: catalog_idempotency_keys
-- =============================================================================
CREATE TABLE catalog_idempotency_keys (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    idempotency_scope   VARCHAR(100)    NOT NULL,
    idempotency_key     VARCHAR(120)    NOT NULL,
    request_hash        VARCHAR(64),
    response_data       JSON            NOT NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_catalog_idempotency_scope_key (idempotency_scope, idempotency_key),
    INDEX idx_catalog_idempotency_created (created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO catalog_vouchers
    (code, name, discount_type, discount_value, max_discount, min_order_amount, usage_count, usage_limit, valid_from, valid_to, status)
VALUES
    ('MINGIANG50', 'Giam 50k don tu 300k', 'fixed', 50000, NULL, 300000, 0, 200, '2026-01-01', '2026-12-31', 'active')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

INSERT INTO catalog_loyalty_config (id, tiers, redemption, channels)
VALUES
    (
      1,
      JSON_ARRAY(
        JSON_OBJECT('tier', 'bronze', 'points_per_10k', 1, 'min_spend', 0),
        JSON_OBJECT('tier', 'silver', 'points_per_10k', 1.5, 'min_spend', 2000000),
        JSON_OBJECT('tier', 'gold', 'points_per_10k', 2, 'min_spend', 10000000),
        JSON_OBJECT('tier', 'diamond', 'points_per_10k', 3, 'min_spend', 50000000)
      ),
      JSON_OBJECT('points_to_vnd_rate', 1000, 'min_points_redeem', 100, 'max_value_per_order', 200000),
      JSON_OBJECT('web', true, 'pos', true)
    )
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- =============================================================================
-- VIEW: v_supplier_debt
-- =============================================================================
CREATE OR REPLACE VIEW v_supplier_debt AS
SELECT
    s.id AS supplier_id, s.code AS supplier_code, s.name AS supplier_name,
    COALESCE(SUM(b.total_amount - b.paid_amount), 0) AS computed_current_debt,
    s.current_debt AS stored_current_debt,
    CASE
        WHEN ABS(s.current_debt - COALESCE(SUM(b.total_amount - b.paid_amount), 0)) > 1000 THEN '⚠️ DRIFT'
        ELSE '✅ OK'
    END AS debt_status
FROM suppliers s
LEFT JOIN batches b ON b.supplier_id = s.id AND b.status = 'completed'
GROUP BY s.id, s.code, s.name, s.current_debt;

SET FOREIGN_KEY_CHECKS = 1;
