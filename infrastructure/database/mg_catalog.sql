-- =============================================================================
-- SCHEMA: mg_catalog
-- Mục đích: Quản lý Danh Mục, Sản Phẩm (Thuốc), Kho Hàng, Nhà Cung Cấp
-- Phụ thuộc: mg_identity (users.id được tham chiếu qua cross-schema comment)
-- Cần tạo SAU mg_identity
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_catalog
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_catalog;

-- =============================================================================
-- BẢNG: categories
-- Phân cấp danh mục sản phẩm (dạng cây đa cấp - Adjacency List)
-- VD: Thuốc kê đơn > Kháng sinh > Penicillin
-- =============================================================================
CREATE TABLE categories (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150)    NOT NULL    COMMENT 'Tên danh mục, VD: Thuốc kháng sinh, Vitamin & TPCN',
    slug        VARCHAR(200)    NOT NULL    COMMENT 'URL-friendly slug, VD: thuoc-khang-sinh',
    parent_id   BIGINT                      COMMENT 'FK → categories.id — NULL nếu là danh mục gốc (root)',
    description TEXT                        COMMENT 'Mô tả danh mục',
    image_url   VARCHAR(500)                COMMENT 'Ảnh đại diện danh mục',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1   COMMENT '1=hiển thị, 0=ẩn',
    sort_order  INT             NOT NULL DEFAULT 0   COMMENT 'Thứ tự sắp xếp hiển thị (nhỏ hơn = lên trước)',
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
  COLLATE utf8mb4_unicode_ci
  COMMENT='Danh mục sản phẩm phân cấp, hỗ trợ cây đa tầng';

-- =============================================================================
-- BẢNG: suppliers
-- Nhà cung cấp thuốc và dụng cụ y tế
-- Tạo trước bảng batches vì batches tham chiếu suppliers.id
-- =============================================================================
CREATE TABLE suppliers (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    code                    VARCHAR(20)     NOT NULL    COMMENT 'Mã NCC, VD: SUP-001, SUP-002',
    name                    VARCHAR(300)    NOT NULL    COMMENT 'Tên công ty nhà cung cấp',
    contact_name            VARCHAR(150)                COMMENT 'Tên người liên hệ (trình dược viên)',
    phone                   VARCHAR(20)                 COMMENT 'Số điện thoại liên hệ',
    email                   VARCHAR(150)                COMMENT 'Email liên hệ',
    address                 TEXT                        COMMENT 'Địa chỉ công ty nhà cung cấp',
    tax_code                VARCHAR(50)                 COMMENT 'Mã số thuế doanh nghiệp',
    total_purchase_value    DECIMAL(20,2)   NOT NULL DEFAULT 0.00
                                                        COMMENT 'Tổng giá trị đã nhập hàng từ NCC (cộng dồn)',
    current_debt            DECIMAL(20,2)   NOT NULL DEFAULT 0.00
                                                        COMMENT 'Công nợ hiện tại = SUM(total_amount - paid_amount) của các phiếu nhập',
    status                  ENUM('active','inactive') NOT NULL DEFAULT 'active'
                                                        COMMENT 'Trạng thái hợp tác với NCC',
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_suppliers_code (code),
    INDEX idx_suppliers_status (status),
    INDEX idx_suppliers_current_debt (current_debt)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Nhà cung cấp thuốc và thiết bị y tế, quản lý công nợ phải trả';

-- =============================================================================
-- BẢNG: locations
-- Vị trí vật lý trong kho (Khu → Tủ → Kệ)
-- =============================================================================
CREATE TABLE locations (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    zone        VARCHAR(100)    NOT NULL    COMMENT 'Khu vực kho: Rx Zone, OTC Zone, TPCN Zone, Kho Lạnh...',
    cabinet     VARCHAR(100)    NOT NULL    COMMENT 'Tủ trong khu vực: Tủ Rx-1, Tủ Lạnh A...',
    shelf       VARCHAR(100)    NOT NULL    COMMENT 'Kệ/Ngăn trong tủ: Ngăn 1, Ngăn 2, Tầng trên...',
    label       VARCHAR(200)    NOT NULL    COMMENT 'Nhãn hiển thị đầy đủ: VD "Rx Zone / Tủ Rx-1 / Ngăn 2"',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    INDEX idx_locations_zone (zone),
    INDEX idx_locations_is_active (is_active)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Vị trí lưu trữ vật lý trong kho dược phẩm';

-- =============================================================================
-- BẢNG: products
-- Master Data sản phẩm — "Hồ sơ thuốc" (không chứa thông tin tồn kho)
-- Tồn kho thực tế lưu trong batch_items.quantity_remaining
-- =============================================================================
CREATE TABLE products (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    sku                     VARCHAR(50)     NOT NULL    COMMENT 'Mã hàng nội bộ, auto-generated: MED-0001, SUP-0023',
    name                    VARCHAR(300)    NOT NULL    COMMENT 'Tên đầy đủ: VD "Panadol Extra Hộp 12 viên"',
    category_id             BIGINT          NOT NULL    COMMENT 'FK → categories.id',
    active_ingredient       VARCHAR(500)                COMMENT 'Hoạt chất: VD "Paracetamol 500mg + Caffeine 65mg"',
    registration_number     VARCHAR(100)                COMMENT 'Số đăng ký dược — SĐK do Bộ Y tế cấp',
    manufacturer            VARCHAR(300)                COMMENT 'Nhà sản xuất, VD: GlaxoSmithKline, DHG Pharma',
    requires_prescription   TINYINT(1)      NOT NULL DEFAULT 0
                                                        COMMENT '1=thuốc kê đơn (Rx), 0=thuốc OTC',
    base_unit               VARCHAR(50)     NOT NULL    COMMENT 'Đơn vị cơ bản nhỏ nhất: Viên, Gói, Tuýp, Chai...',
    cost_price              DECIMAL(15,2)   NOT NULL DEFAULT 0.00
                                                        COMMENT 'Giá nhập trên 1 base_unit (tham khảo, giá thực trong batch_items)',
    retail_price            DECIMAL(15,2)   NOT NULL DEFAULT 0.00
                                                        COMMENT 'Giá bán lẻ mặc định trên 1 base_unit',
    min_stock_alert         INT             NOT NULL DEFAULT 10
                                                        COMMENT 'Tồn kho tối thiểu — khi dưới ngưỡng sẽ gửi cảnh báo',
    image_url               VARCHAR(500)                COMMENT 'URL ảnh sản phẩm',
    description             TEXT                        COMMENT 'Mô tả chi tiết, công dụng, cách dùng, tác dụng phụ',
    status                  ENUM('active','inactive') NOT NULL DEFAULT 'active'
                                                        COMMENT 'Trạng thái kinh doanh sản phẩm',
    barcode                 VARCHAR(100)                COMMENT 'Mã vạch EAN-13 hoặc mã nội bộ, dùng quét POS',
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_products_sku (sku),
    UNIQUE KEY uq_products_barcode (barcode),
    INDEX idx_products_category_id (category_id),
    INDEX idx_products_status (status),
    INDEX idx_products_requires_prescription (requires_prescription),
    INDEX idx_products_name (name),                     -- Full-text tìm kiếm theo tên

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Hồ sơ thuốc master data — danh mục sản phẩm kinh doanh';

-- =============================================================================
-- BẢNG: product_units
-- Quy đổi đơn vị đóng gói (1 sản phẩm có nhiều đơn vị bán)
-- VD: Panadol Extra: Viên (cơ bản) → Vỉ (10 viên) → Hộp (12 viên)
-- =============================================================================
CREATE TABLE product_units (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    product_id      BIGINT          NOT NULL    COMMENT 'FK → products.id',
    unit_name       VARCHAR(50)     NOT NULL    COMMENT 'Tên đơn vị lớn: Vỉ, Hộp, Lốc, Thùng...',
    conversion_qty  INT             NOT NULL    COMMENT 'Số lượng base_unit trong 1 đơn vị này, VD: 10 (Viên/Vỉ)',
    of_unit         VARCHAR(50)     NOT NULL    COMMENT 'Đơn vị bên dưới trong chuỗi quy đổi, VD: "Viên" hoặc "Vỉ"',
    retail_price    DECIMAL(15,2)   NOT NULL DEFAULT 0.00
                                                COMMENT 'Giá bán lẻ khi bán theo đơn vị này (thường = conversion_qty × retail_price)',
    sort_order      INT             NOT NULL DEFAULT 0
                                                COMMENT 'Thứ tự sắp xếp (0=nhỏ nhất, tăng dần)',

    PRIMARY KEY (id),
    INDEX idx_product_units_product_id (product_id),

    CONSTRAINT fk_product_units_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Đơn vị đóng gói và quy đổi của sản phẩm';

-- =============================================================================
-- BẢNG: batches
-- Phiếu nhập kho (Purchase Order) — mỗi lần nhập hàng từ NCC tạo 1 batch
-- =============================================================================
CREATE TABLE batches (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    batch_code      VARCHAR(50)     NOT NULL    COMMENT 'Mã phiếu nhập, VD: PO-260305-001 (PO-YYMMDD-SEQ)',
    supplier_id     BIGINT          NOT NULL    COMMENT 'FK → suppliers.id',
    delivery_person VARCHAR(150)                COMMENT 'Tên người giao hàng (trình dược viên)',
    received_date   DATE            NOT NULL    COMMENT 'Ngày nhận hàng vào kho',
    total_amount    DECIMAL(15,2)   NOT NULL DEFAULT 0.00
                                                COMMENT 'Tổng giá trị phiếu nhập = SUM(batch_items.cost_price × quantity_received)',
    paid_amount     DECIMAL(15,2)   NOT NULL DEFAULT 0.00
                                                COMMENT 'Đã thanh toán cho NCC — công nợ = total_amount - paid_amount',
    status          ENUM('draft','completed') NOT NULL DEFAULT 'draft'
                                                COMMENT 'draft=đang nhập liệu, completed=đã xác nhận vào kho',
    notes           TEXT                        COMMENT 'Ghi chú phiếu nhập',
    -- Cross-schema FK: tham chiếu mg_identity.users.id
    -- Không khai báo FOREIGN KEY do khác schema, enforce tại application layer
    created_by      BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_identity.users.id — người tạo phiếu',
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
  COLLATE utf8mb4_unicode_ci
  COMMENT='Phiếu nhập kho — mỗi lần mua hàng từ nhà cung cấp';

-- =============================================================================
-- BẢNG: batch_items
-- Chi tiết từng dòng thuốc trong phiếu nhập — đây là đơn vị quản lý lô hàng
-- QUAN TRỌNG: quantity_remaining là nguồn chân lý cho tồn kho từng lô
-- Index trên expiry_date để hỗ trợ FEFO query hiệu quả
-- =============================================================================
CREATE TABLE batch_items (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    batch_id                BIGINT          NOT NULL    COMMENT 'FK → batches.id',
    product_id              BIGINT          NOT NULL    COMMENT 'FK → products.id',
    lot_number              VARCHAR(100)    NOT NULL    COMMENT 'Số lô sản xuất do NSX in trên bao bì, VD: AMX-112',
    manufacture_date        DATE                        COMMENT 'Ngày sản xuất (NSX)',
    expiry_date             DATE            NOT NULL    COMMENT 'Hạn sử dụng (HSD) — dùng cho FEFO sorting',
    quantity_received       INT             NOT NULL    COMMENT 'Số lượng nhập vào (tính theo base_unit)',
    quantity_remaining      INT             NOT NULL    COMMENT 'Tồn kho còn lại của lô này, giảm dần khi xuất hàng',
    cost_price              DECIMAL(15,2)   NOT NULL    COMMENT 'Giá nhập thực tế của lô này (có thể khác giá cơ sở)',
    clearance_discount_pct  DECIMAL(5,2)    NOT NULL DEFAULT 0.00
                                                        COMMENT '% chiết khấu khi thanh lý hàng cận HSD',
    clearance_price         DECIMAL(15,2)               COMMENT 'Giá thanh lý sau chiết khấu (NULL=chưa áp dụng)',
    location_id             BIGINT                      COMMENT 'FK → locations.id — vị trí kệ/tủ lưu lô hàng',
    status                  ENUM('available','near_expiry','expired','depleted') NOT NULL DEFAULT 'available'
                                                        COMMENT 'available=còn hàng, near_expiry=cận date(<90 ngày), expired=hết hạn, depleted=hết hàng',

    PRIMARY KEY (id),
    INDEX idx_batch_items_batch_id (batch_id),
    -- Index composite quan trọng nhất: FEFO query = WHERE product_id = ? AND status = 'available' ORDER BY expiry_date ASC
    INDEX idx_batch_items_fefo (product_id, status, expiry_date),
    INDEX idx_batch_items_expiry_date (expiry_date),
    INDEX idx_batch_items_location_id (location_id),

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
  COLLATE utf8mb4_unicode_ci
  COMMENT='Chi tiết lô hàng — đơn vị FEFO, lưu tồn kho từng lô theo HSD';

-- =============================================================================
-- BẢNG: stock_movements
-- Audit log toàn bộ lịch sử nhập/xuất kho
-- Mỗi lần tăng/giảm quantity_remaining trong batch_items đều ghi 1 dòng ở đây
-- =============================================================================
CREATE TABLE stock_movements (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    movement_code   VARCHAR(50)     NOT NULL    COMMENT 'Mã phiếu: PO-xxx (nhập), OUT-xxx (xuất)',
    batch_item_id   BIGINT          NOT NULL    COMMENT 'FK → batch_items.id — lô hàng bị ảnh hưởng',
    product_id      BIGINT          NOT NULL    COMMENT 'FK → products.id — denormalize để query nhanh',
    movement_type   ENUM(
                        'inbound',                      -- Nhập kho từ NCC
                        'outbound_sale',                -- Xuất bán (POS hoặc Web)
                        'outbound_return_supplier',     -- Trả hàng cho NCC
                        'outbound_damage',              -- Xuất huỷ hư hỏng
                        'outbound_expiry'               -- Xuất huỷ hết hạn
                    ) NOT NULL                  COMMENT 'Loại giao dịch kho',
    quantity        INT             NOT NULL    COMMENT 'Số lượng thay đổi: dương (+) là nhập, âm (-) là xuất',
    reference_type  ENUM('purchase_order','pos_order','web_order','return','adjustment')
                                                COMMENT 'Loại chứng từ tham chiếu',
    reference_id    BIGINT                      COMMENT 'ID của chứng từ tham chiếu (đơn hàng, phiếu nhập...)',
    reason          TEXT                        COMMENT 'Lý do giao dịch, bắt buộc với loại damage/expiry',
    -- Cross-schema: mg_identity.users.id
    created_by      BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — người thực hiện',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_stock_movements_batch_item_id (batch_item_id),
    INDEX idx_stock_movements_product_id (product_id),
    INDEX idx_stock_movements_movement_type (movement_type),
    INDEX idx_stock_movements_reference (reference_type, reference_id),
    INDEX idx_stock_movements_created_at (created_at),

    CONSTRAINT fk_stock_movements_batch_item
        FOREIGN KEY (batch_item_id) REFERENCES batch_items(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Audit log toàn bộ biến động kho: nhập, xuất, huỷ...';

-- =============================================================================
-- DỮ LIỆU MẪU: mg_catalog
-- =============================================================================

-- Danh mục sản phẩm (phân cấp 2 tầng)
INSERT INTO categories (name, slug, parent_id, description, is_active, sort_order) VALUES
('Thuốc kê đơn (Rx)',       'thuoc-ke-don',         NULL, 'Thuốc cần có đơn bác sĩ khi mua',                     1, 1),
('Thuốc không kê đơn (OTC)','thuoc-khong-ke-don',   NULL, 'Thuốc mua tự do không cần đơn',                       1, 2),
('Vitamin & Thực Phẩm Chức Năng', 'vitamin-tpcn',   NULL, 'Bổ sung dinh dưỡng, tăng cường sức khoẻ',             1, 3),
('Thiết bị y tế',           'thiet-bi-y-te',        NULL, 'Máy đo huyết áp, nhiệt kế, băng gạc...',              1, 4),
('Kháng sinh',              'thuoc-khang-sinh',     1,    'Amoxicillin, Azithromycin, Ciprofloxacin...',          1, 1),
('Hạ sốt, giảm đau',       'ha-sot-giam-dau',      2,    'Paracetamol, Ibuprofen và các nhóm giảm đau khác',    1, 1),
('Tiêu hoá',                'thuoc-tieu-hoa',       2,    'Thuốc dạ dày, chống nôn, nhuận tràng...',             1, 2),
('Vitamin tổng hợp',        'vitamin-tong-hop',     3,    'Multivitamin và khoáng chất tổng hợp',                1, 1),
('Vitamin C',               'vitamin-c',            3,    'Bổ sung Vitamin C dạng viên và nước',                 1, 2),
('Băng gạc & Cầm máu',     'bang-gac-cam-mau',     4,    'Băng y tế, gạc, bông cồn, cầm máu',                  1, 1);

-- Nhà cung cấp
INSERT INTO suppliers (code, name, contact_name, phone, email, address, tax_code, total_purchase_value, current_debt, status) VALUES
('SUP-001', 'Công ty TNHH Dược phẩm Merap',          'Nguyễn Trí Dũng',  '02839012345', 'duoc@merap.com.vn',    '128 Nguyễn Văn Trỗi, Q.Phú Nhuận, TP.HCM', '0300615980', 145000000.00, 12500000.00, 'active'),
('SUP-002', 'Công ty CP Dược Hậu Giang (DHG Pharma)', 'Lê Thị Phương',   '07103821016', 'order@dhgpharma.vn',   'Khu Công Nghiệp Trà Nóc, Bình Thủy, Cần Thơ', '1800218985',  98000000.00,  8000000.00, 'active'),
('SUP-003', 'Công ty CP Pymepharco',                  'Đỗ Văn Tân',      '02573829999', 'sales@pymepharco.vn',  '166-170 Nguyễn Huệ, TP. Tuy Hòa, Phú Yên', '4200166699',  67000000.00,  5000000.00, 'active'),
('SUP-004', 'Công ty CP Dược Phẩm OPV',               'Phạm Hồng Nhung', '02439724725', 'opv@opv.com.vn',       '13 Đào Duy Anh, Đống Đa, Hà Nội',           '0101243888',  34000000.00,  0.00,       'active'),
('SUP-005', 'Công ty TNHH Dược Phẩm TW1 (Pharmedic)', 'Trần Minh Khoa',  '02838245789', 'info@pharmedic.com.vn','268 Tô Hiến Thành, Q.10, TP.HCM',           '0300374753',  21000000.00,  2100000.00, 'active');

-- Vị trí kho
INSERT INTO locations (zone, cabinet, shelf, label, is_active) VALUES
('Rx Zone',   'Tủ Rx-1',    'Ngăn 1',       'Rx Zone / Tủ Rx-1 / Ngăn 1',       1),
('Rx Zone',   'Tủ Rx-1',    'Ngăn 2',       'Rx Zone / Tủ Rx-1 / Ngăn 2',       1),
('OTC Zone',  'Tủ OTC-1',   'Tầng trên',    'OTC Zone / Tủ OTC-1 / Tầng trên',  1),
('OTC Zone',  'Tủ OTC-1',   'Tầng giữa',    'OTC Zone / Tủ OTC-1 / Tầng giữa',  1),
('OTC Zone',  'Tủ OTC-2',   'Tầng trên',    'OTC Zone / Tủ OTC-2 / Tầng trên',  1),
('TPCN Zone', 'Tủ TPCN-1',  'Ngăn 1',       'TPCN Zone / Tủ TPCN-1 / Ngăn 1',  1),
('Kho Lạnh',  'Tủ Lạnh A',  'Ngăn trên',    'Kho Lạnh / Tủ Lạnh A / Ngăn trên',1),
('OTC Zone',  'Quầy trưng bày','Kệ 1',      'OTC / Quầy trưng bày / Kệ 1',      1);

-- Sản phẩm (thuốc) master data
INSERT INTO products (sku, name, category_id, active_ingredient, registration_number, manufacturer, requires_prescription, base_unit, cost_price, retail_price, min_stock_alert, barcode, description, status) VALUES
('MED-0001', 'Panadol Extra Hộp 12 viên',           6, 'Paracetamol 500mg + Caffeine 65mg',    'VN-18043-14',   'GlaxoSmithKline',            0, 'Viên', 18000.00,  25000.00,  20, '8935049500016', 'Thuốc hạ sốt, giảm đau. Hiệu quả hơn paracetamol thông thường nhờ có caffeine tăng cường tác dụng.', 'active'),
('MED-0002', 'Amoxicillin 500mg Hộp 100 viên',      5, 'Amoxicillin 500mg',                    'VD-19965-16',   'DHG Pharma',                 1, 'Viên', 1200.00,   2000.00,   30, '8936025470012', 'Kháng sinh nhóm Penicillin, điều trị nhiễm trùng đường hô hấp, tiết niệu. Cần đơn bác sĩ.', 'active'),
('MED-0003', 'Omeprazole 20mg Hộp 30 viên',         7, 'Omeprazole 20mg',                      'VD-21789-18',   'Pymepharco',                 1, 'Viên', 2500.00,   4500.00,   20, '8935008910023', 'Giảm tiết acid dạ dày, điều trị loét dạ dày tá tràng, trào ngược thực quản.', 'active'),
('MED-0004', 'Vitamin C 1000mg Effervescent Hộp 20 viên', 9, 'Ascorbic Acid 1000mg',           'VD-30012-19',   'OPV',                        0, 'Viên', 5000.00,   9000.00,   15, '8936000780034', 'Bổ sung Vitamin C dạng sủi bọt. Hỗ trợ tăng đề kháng, đẹp da.', 'active'),
('MED-0005', 'Actifed Syrup Lọ 100ml',              2, 'Triprolidine HCl 1.25mg + Pseudoephedrine HCl 30mg', 'VN-10234-09', 'GlaxoSmithKline', 0, 'Chai', 45000.00,  65000.00,  10, '8935049500054', 'Thuốc thông mũi, chống dị ứng viêm mũi dị ứng.', 'active'),
('MED-0006', 'Cetirizine 10mg Hộp 30 viên',         2, 'Cetirizine HCl 10mg',                  'VD-18876-15',   'DHG Pharma',                 0, 'Viên', 800.00,    1500.00,   25, '8936025470067', 'Thuốc kháng histamin thế hệ 2, chống dị ứng, không gây buồn ngủ nhiều.', 'active'),
('MED-0007', 'Blackmores Bio C 1000mg Hộp 31 viên', 9, 'Ascorbic Acid 1000mg (Natural Source)', 'VD-30123-20', 'Blackmores (Australia)',     0, 'Viên', 18000.00,  28000.00,  10, '9300807007072', 'Vitamin C tự nhiên từ quả Acerola, hấp thụ tốt hơn Vitamin C tổng hợp.', 'active'),
('MED-0008', 'Azithromycin 500mg Hộp 3 viên',       5, 'Azithromycin 500mg',                   'VD-22345-18',   'Pharmedic',                  1, 'Viên', 25000.00,  40000.00,  15, '8935049600089', 'Kháng sinh điều trị nhiễm trùng đường hô hấp, viêm phổi, viêm xoang. Cần đơn bác sĩ.', 'active'),
('MED-0009', 'Băng cuộn y tế 5cm × 5m (Cuộn)',      10, NULL,                                   NULL,            'Medic Việt Nam',             0, 'Cuộn',2500.00,   5000.00,   50, '8936000500091', 'Băng cuộn cotton y tế tiệt trùng, dùng băng bó vết thương.', 'active'),
('SUP-0001', 'Nhiệt kế điện tử Microlife MT850',    4, NULL,                                    NULL,            'Microlife (Switzerland)',    0, 'Cái', 95000.00,  155000.00, 5,  '7640049520100', 'Nhiệt kế điện tử kẹp nách, đo trong 10 giây, độ chính xác ±0.1°C.', 'active');

-- Đơn vị đóng gói
INSERT INTO product_units (product_id, unit_name, conversion_qty, of_unit, retail_price, sort_order) VALUES
(1, 'Hộp',  12,  'Viên',  280000.00, 1),   -- Panadol: 12 Viên = 1 Hộp
(2, 'Vỉ',   10,  'Viên',   18000.00, 1),   -- Amoxicillin: 10 Viên = 1 Vỉ
(2, 'Hộp',  100, 'Viên',  175000.00, 2),   -- Amoxicillin: 100 Viên = 1 Hộp
(3, 'Hộp',  30,  'Viên',  125000.00, 1),   -- Omeprazole: 30 Viên = 1 Hộp
(4, 'Hộp',  20,  'Viên',  170000.00, 1),   -- Vitamin C effervescent: 20 Viên = 1 Hộp
(6, 'Vỉ',   10,  'Viên',   14000.00, 1),   -- Cetirizine: 10 Viên = 1 Vỉ
(6, 'Hộp',  30,  'Viên',   40000.00, 2),   -- Cetirizine: 30 Viên = 1 Hộp
(7, 'Hộp',  31,  'Viên',  850000.00, 1),   -- Blackmores: 31 Viên = 1 Hộp
(8, 'Hộp',  3,   'Viên',  115000.00, 1);   -- Azithromycin: 3 Viên = 1 Hộp

-- Phiếu nhập kho
INSERT INTO batches (batch_code, supplier_id, delivery_person, received_date, total_amount, paid_amount, status, notes, created_by) VALUES
('PO-260301-001', 1, 'Nguyễn Văn An',   '2026-03-01', 12500000.00, 12500000.00, 'completed', 'Nhập hàng đầu tháng 3',          1),
('PO-260305-001', 2, 'Lê Minh Phong',   '2026-03-05',  8750000.00,  5000000.00, 'completed', 'Nhập kháng sinh và vitamin',     1),
('PO-260310-001', 3, 'Trần Thu Hiền',   '2026-03-10',  6200000.00,  6200000.00, 'completed', 'Nhập thuốc OTC các loại',        1),
('PO-260315-001', 1, 'Nguyễn Văn An',   '2026-03-15',  9800000.00,  0.00,       'completed', 'Nhập bổ sung Panadol và kháng sinh', 2),
('PO-260317-001', 4, 'Phạm Quốc Bảo',   '2026-03-17',  3100000.00,  3100000.00, 'completed', 'Nhập vitamin C OPV',             2);

-- Chi tiết lô hàng (batch_items) — nguồn chân lý tồn kho
INSERT INTO batch_items (batch_id, product_id, lot_number, manufacture_date, expiry_date, quantity_received, quantity_remaining, cost_price, location_id, status) VALUES
-- Phiếu PO-260301-001
(1, 1, 'PAN-BN-260101', '2026-01-01', '2028-01-01',  200, 156, 18000.00, 3, 'available'),  -- Panadol Extra
(1, 6, 'CET-DH-251201', '2025-12-01', '2027-12-01',  300, 245, 800.00,   4, 'available'),  -- Cetirizine
(1, 9, 'BAN-MV-260101', '2026-01-01', '2028-06-01',  100,  82, 2500.00,  8, 'available'),  -- Băng cuộn
-- Phiếu PO-260305-001
(2, 2, 'AMX-DH-260115', '2026-01-15', '2028-01-15',  500, 420, 1200.00,  1, 'available'),  -- Amoxicillin
(2, 7, 'BLK-BM-260201', '2026-02-01', '2028-02-01',   50,  38, 18000.00, 6, 'available'),  -- Blackmores Vit C
(2, 4, 'VTC-OPV-261001','2026-10-01', '2028-09-30',  150, 112, 5000.00,  5, 'available'),  -- Vitamin C 1000mg
-- Phiếu PO-260310-001
(3, 3, 'OMP-PY-260201', '2026-02-01', '2028-02-01',  120,  98, 2500.00,  2, 'available'),  -- Omeprazole
(3, 5, 'ACT-GS-260201', '2026-02-01', '2027-08-01',   40,  31, 45000.00, 4, 'available'),  -- Actifed Syrup
(3, 8, 'AZI-PM-260115', '2026-01-15', '2028-01-15',   60,  52, 25000.00, 1, 'available'),  -- Azithromycin
-- Phiếu PO-260315-001 (lô mới nhập)
(4, 1, 'PAN-BN-260201', '2026-02-01', '2028-02-01',  300, 300, 18000.00, 3, 'available'),  -- Panadol lô mới
(4, 2, 'AMX-DH-260215', '2026-02-15', '2028-02-15',  400, 400, 1200.00,  1, 'available'),  -- Amoxicillin lô mới
-- Phiếu PO-260317-001
(5, 4, 'VTC-OPV-260201','2026-02-01', '2027-10-01',  200, 200, 5000.00,  5, 'available');  -- Vitamin C lô mới

-- Lịch sử xuất nhập kho mẫu
INSERT INTO stock_movements (movement_code, batch_item_id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by) VALUES
('PO-260301-001', 1,  1, 'inbound',       200, 'purchase_order', 1, NULL, 1),
('PO-260301-001', 2,  6, 'inbound',       300, 'purchase_order', 1, NULL, 1),
('PO-260305-001', 4,  2, 'inbound',       500, 'purchase_order', 2, NULL, 1),
('OUT-260310-001',1,  1, 'outbound_sale', -12, 'pos_order',      1, NULL, 3),
('OUT-260310-002',4,  2, 'outbound_sale',  -5, 'web_order',      1, NULL, 3),
('OUT-260312-001',2,  6, 'outbound_sale', -10, 'pos_order',      2, NULL, 3),
('OUT-260315-001',7,  3, 'outbound_sale',  -3, 'pos_order',      3, NULL, 3);


-- -----------------------------------------------------------------------------
-- PATCH -- bo sung bang/cot (da hop nhat, khong chay rieng nua)
-- -----------------------------------------------------------------------------

-- =============================================================================
-- PATCH: mg_catalog — Bổ sung các bảng và cột còn thiếu
-- Bổ sung: brands, product_specifications, storage hierarchy (zones/cabinets/shelves),
--          inventory_audits, audit_items, delivery_config, delivery_timeslots
--          Thêm cột vào products: brand_id, tags, country_of_origin, is_exclusive
-- =============================================================================

USE mg_catalog;

-- =============================================================================
-- BẢNG: brands
-- Thương hiệu sản phẩm — dùng ở filter client, mega menu, trang chủ
-- API: GET /api/catalog/brands, GET /api/cms/brands?featured=true
-- =============================================================================
CREATE TABLE IF NOT EXISTS brands (
    id          INT             NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150)    NOT NULL    COMMENT 'Tên thương hiệu: Abbott, Sanofi, DHG, Blackmores...',
    slug        VARCHAR(200)    NOT NULL    COMMENT 'URL slug: abbott, sanofi, dhg-pharma',
    logo_url    VARCHAR(500)                COMMENT 'URL logo thương hiệu',
    country     VARCHAR(100)                COMMENT 'Quốc gia xuất xứ: Vietnam, France, Australia...',
    is_featured TINYINT(1)      NOT NULL DEFAULT 0   COMMENT '1=hiển thị ở trang chủ (homepage brands section)',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    sort_order  INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_brands_slug (slug),
    INDEX idx_brands_is_featured (is_featured),
    INDEX idx_brands_is_active (is_active)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Thương hiệu sản phẩm, dùng filter danh mục và mega menu';

-- =============================================================================
-- Thêm cột vào bảng products
-- brand_id, tags, country_of_origin, is_exclusive — dùng ở trang client category
-- API: GET /api/catalog/products?tag=flash-sale&origin=imported&is_exclusive=true
-- =============================================================================
ALTER TABLE products
    ADD COLUMN brand_id         INT                     COMMENT 'FK → brands.id',
    ADD COLUMN tags             JSON                    COMMENT 'JSON array tags: ["flash-sale","deal-khung","trending","exclusive"]',
    ADD COLUMN country_of_origin VARCHAR(100)           COMMENT 'Xuất xứ sản phẩm: Vietnam, France, USA, Australia...',
    ADD COLUMN is_exclusive     TINYINT(1) NOT NULL DEFAULT 0
                                                        COMMENT '1=sản phẩm độc quyền nhà thuốc Minh Giang',
    ADD COLUMN sales_volume     INT NOT NULL DEFAULT 0  COMMENT 'Tổng số lượng đã bán (dùng sort=sales_volume_desc)',
    ADD INDEX idx_products_brand_id (brand_id),
    ADD INDEX idx_products_is_exclusive (is_exclusive);

-- =============================================================================
-- BẢNG: product_specifications
-- Thông số chi tiết sản phẩm — dùng ở trang Product Detail
-- API: GET /api/catalog/products/{productId}/specifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_specifications (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    product_id  BIGINT          NOT NULL    COMMENT 'FK → products.id',
    spec_key    VARCHAR(150)    NOT NULL    COMMENT 'Tên thông số: Thành phần, Quy cách, Bảo quản, Chỉ định...',
    spec_value  TEXT            NOT NULL    COMMENT 'Giá trị thông số',
    sort_order  INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    INDEX idx_product_specifications_product_id (product_id),
    CONSTRAINT fk_product_specs_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Thông số kỹ thuật chi tiết sản phẩm (tab Thông tin thêm)';

-- =============================================================================
-- BẢNG: storage_zones
-- Tầng 1 phân cấp kho: Khu vực (Rx Zone, OTC Zone, TPCN Zone, Kho Lạnh)
-- API: GET /api/catalog-service/storage/zones
-- =============================================================================
CREATE TABLE IF NOT EXISTS storage_zones (
    id          INT             NOT NULL AUTO_INCREMENT,
    code        VARCHAR(50)     NOT NULL    COMMENT 'Mã khu vực: RX, OTC, TPCN, COLD',
    name        VARCHAR(100)    NOT NULL    COMMENT 'Tên khu vực: Rx Zone, OTC Zone...',
    description VARCHAR(300)                COMMENT 'Mô tả: Khu thuốc kê đơn, yêu cầu kiểm soát nhiệt độ...',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    UNIQUE KEY uq_storage_zones_code (code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Khu vực kho tầng 1 (Zone)';

-- =============================================================================
-- BẢNG: storage_cabinets
-- Tầng 2 phân cấp kho: Tủ thuốc trong từng khu vực
-- API: GET /api/catalog-service/storage/zones/:zone_id/cabinets
-- =============================================================================
CREATE TABLE IF NOT EXISTS storage_cabinets (
    id          INT             NOT NULL AUTO_INCREMENT,
    zone_id     INT             NOT NULL    COMMENT 'FK → storage_zones.id',
    code        VARCHAR(50)     NOT NULL    COMMENT 'Mã tủ: RX-1, OTC-1, COLD-A',
    name        VARCHAR(100)    NOT NULL    COMMENT 'Tên tủ: Tủ Rx-1, Tủ Lạnh A',
    shelf_count INT             NOT NULL DEFAULT 0  COMMENT 'Số kệ/ngăn trong tủ',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    UNIQUE KEY uq_storage_cabinets_code (code),
    INDEX idx_storage_cabinets_zone_id (zone_id),
    CONSTRAINT fk_storage_cabinets_zone
        FOREIGN KEY (zone_id) REFERENCES storage_zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Tủ thuốc tầng 2 (Cabinet) trong mỗi khu vực';

-- =============================================================================
-- BẢNG: storage_shelves
-- Tầng 3 phân cấp kho: Kệ/Ngăn trong mỗi tủ — link về bảng locations cũ
-- API: GET /api/catalog-service/storage/cabinets/:cabinet_id/shelves
-- =============================================================================
CREATE TABLE IF NOT EXISTS storage_shelves (
    id          INT             NOT NULL AUTO_INCREMENT,
    cabinet_id  INT             NOT NULL    COMMENT 'FK → storage_cabinets.id',
    name        VARCHAR(100)    NOT NULL    COMMENT 'Tên kệ: Ngăn 1, Tầng trên, Tầng giữa',
    -- Tham chiếu về bảng locations cũ để backward-compat với batch_items.location_id
    location_id BIGINT                      COMMENT 'FK → locations.id — ánh xạ 1-1 với bảng locations cũ',
    product_type VARCHAR(100)               COMMENT 'Loại thuốc ưu tiên đặt ở kệ này: Rx, OTC, TPCN...',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    INDEX idx_storage_shelves_cabinet_id (cabinet_id),
    INDEX idx_storage_shelves_location_id (location_id),
    CONSTRAINT fk_storage_shelves_cabinet
        FOREIGN KEY (cabinet_id) REFERENCES storage_cabinets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_storage_shelves_location
        FOREIGN KEY (location_id) REFERENCES locations(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Kệ/Ngăn tầng 3 (Shelf) trong tủ — ánh xạ sang bảng locations cũ';

-- =============================================================================
-- BẢNG: inventory_audits
-- Phiếu kiểm kê kho — đối chiếu tồn kho hệ thống vs. thực tế
-- API: GET/POST /api/catalog/audits
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory_audits (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    audit_code      VARCHAR(50)     NOT NULL    COMMENT 'Mã phiếu kiểm kê: AUD-260317-001',
    location_id     BIGINT                      COMMENT 'FK → locations.id — khu vực được kiểm kê (NULL=toàn kho)',
    total_items     INT             NOT NULL DEFAULT 0   COMMENT 'Tổng số dòng sản phẩm được kiểm',
    total_missing   INT             NOT NULL DEFAULT 0   COMMENT 'Tổng số lượng thiếu so với hệ thống',
    total_surplus   INT             NOT NULL DEFAULT 0   COMMENT 'Tổng số lượng thừa so với hệ thống',
    total_value_diff DECIMAL(15,2)  NOT NULL DEFAULT 0.00
                                                        COMMENT 'Chênh lệch giá trị (âm=thiếu, dương=thừa)',
    status          ENUM('draft','reconciled') NOT NULL DEFAULT 'draft'
                                                        COMMENT 'draft=đang nhập liệu, reconciled=đã đối chiếu và khoá',
    notes           TEXT                        COMMENT 'Ghi chú phiếu kiểm',
    -- Cross-schema: mg_identity.users.id
    created_by      BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_identity.users.id',
    reconciled_by   BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — người duyệt đối chiếu',
    reconciled_at   DATETIME                    COMMENT 'Thời điểm hoàn tất đối chiếu',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_audits_code (audit_code),
    INDEX idx_inventory_audits_location_id (location_id),
    INDEX idx_inventory_audits_status (status),
    INDEX idx_inventory_audits_created_at (created_at),
    CONSTRAINT fk_inventory_audits_location
        FOREIGN KEY (location_id) REFERENCES locations(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Phiếu kiểm kê kho — đối chiếu tồn kho hệ thống vs. thực tế';

-- =============================================================================
-- BẢNG: audit_items
-- Từng dòng sản phẩm trong phiếu kiểm kê
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_items (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    audit_id            BIGINT          NOT NULL    COMMENT 'FK → inventory_audits.id',
    batch_item_id       BIGINT          NOT NULL    COMMENT 'FK → batch_items.id',
    product_id          BIGINT          NOT NULL    COMMENT 'FK → products.id — denormalize để query nhanh',
    system_quantity     INT             NOT NULL    COMMENT 'Số lượng tồn theo hệ thống tại thời điểm kiểm',
    actual_quantity     INT                         COMMENT 'Số lượng đếm thực tế (NULL=chưa kiểm)',
    difference_quantity INT                         COMMENT 'actual - system: âm=thiếu, dương=thừa',
    notes               TEXT                        COMMENT 'Ghi chú dòng: lý do chênh lệch',

    PRIMARY KEY (id),
    INDEX idx_audit_items_audit_id (audit_id),
    INDEX idx_audit_items_batch_item_id (batch_item_id),
    INDEX idx_audit_items_product_id (product_id),
    CONSTRAINT fk_audit_items_audit
        FOREIGN KEY (audit_id) REFERENCES inventory_audits(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_audit_items_batch_item
        FOREIGN KEY (batch_item_id) REFERENCES batch_items(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_audit_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Chi tiết từng dòng sản phẩm trong phiếu kiểm kê';

-- =============================================================================
-- BẢNG: delivery_config
-- Cấu hình giao hàng — đơn giản là 1 bản ghi cấu hình hệ thống
-- API: GET/PATCH /api/catalog-service/delivery-config
-- =============================================================================
CREATE TABLE IF NOT EXISTS delivery_config (
    id                      INT             NOT NULL AUTO_INCREMENT,
    max_delivery_radius_km  DECIMAL(5,1)    NOT NULL DEFAULT 8.0  COMMENT 'Bán kính giao hàng tối đa (km)',
    base_shipping_fee       DECIMAL(10,2)   NOT NULL DEFAULT 15000.00 COMMENT 'Phí giao hàng mặc định (VND)',
    free_shipping_threshold DECIMAL(12,2)   NOT NULL DEFAULT 500000.00 COMMENT 'Giá trị đơn miễn phí giao hàng',
    is_enabled              TINYINT(1)      NOT NULL DEFAULT 1    COMMENT '1=đang hỗ trợ giao hàng',
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Cấu hình giao hàng nhà thuốc';

-- =============================================================================
-- BẢNG: delivery_timeslots
-- Khung giờ giao hàng khả dụng
-- API: GET/PATCH /api/catalog-service/delivery-timeslots
-- =============================================================================
CREATE TABLE IF NOT EXISTS delivery_timeslots (
    id          INT             NOT NULL AUTO_INCREMENT,
    label       VARCHAR(100)    NOT NULL    COMMENT 'Hiển thị: 09:00 - 12:00',
    start_time  TIME            NOT NULL,
    end_time    TIME            NOT NULL,
    slot_type   ENUM('standard','rushed') NOT NULL DEFAULT 'standard'
                                            COMMENT 'standard=bình thường, rushed=giao gấp 30-60 phút',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    sort_order  INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Khung giờ giao hàng khả dụng';

-- =============================================================================
-- DỮ LIỆU MẪU — patch mg_catalog
-- =============================================================================

-- Thương hiệu
INSERT INTO brands (name, slug, country, is_featured, is_active, sort_order) VALUES
('GlaxoSmithKline',     'glaxosmithkline',  'United Kingdom',   1, 1, 1),
('DHG Pharma',          'dhg-pharma',       'Vietnam',          1, 1, 2),
('Pymepharco',          'pymepharco',       'Vietnam',          1, 1, 3),
('Blackmores',          'blackmores',       'Australia',        1, 1, 4),
('Abbott',              'abbott',           'USA',              1, 1, 5),
('Sanofi',              'sanofi',           'France',           1, 1, 6),
('OPV',                 'opv',              'Vietnam',          0, 1, 7),
('Pharmedic',           'pharmedic',        'Vietnam',          0, 1, 8),
('Microlife',           'microlife',        'Switzerland',      0, 1, 9);

-- Cập nhật brand_id và tags cho products
UPDATE products SET brand_id = 1, tags = JSON_ARRAY('flash-sale','giam-dau-ha-sot'), country_of_origin = 'United Kingdom' WHERE sku = 'MED-0001';
UPDATE products SET brand_id = 2, tags = JSON_ARRAY('khang-sinh'), country_of_origin = 'Vietnam' WHERE sku = 'MED-0002';
UPDATE products SET brand_id = 3, tags = JSON_ARRAY('tieu-hoa'), country_of_origin = 'Vietnam' WHERE sku = 'MED-0003';
UPDATE products SET brand_id = 7, tags = JSON_ARRAY('deal-khung','vitamin'), country_of_origin = 'Vietnam' WHERE sku = 'MED-0004';
UPDATE products SET brand_id = 1, tags = JSON_ARRAY('otc'), country_of_origin = 'United Kingdom' WHERE sku = 'MED-0005';
UPDATE products SET brand_id = 2, tags = JSON_ARRAY('di-ung'), country_of_origin = 'Vietnam' WHERE sku = 'MED-0006';
UPDATE products SET brand_id = 4, tags = JSON_ARRAY('trending','vitamin','is_exclusive'), country_of_origin = 'Australia', is_exclusive = 1 WHERE sku = 'MED-0007';
UPDATE products SET brand_id = 8, tags = JSON_ARRAY('khang-sinh'), country_of_origin = 'Vietnam' WHERE sku = 'MED-0008';
UPDATE products SET brand_id = NULL, tags = JSON_ARRAY('bang-gac'), country_of_origin = 'Vietnam' WHERE sku = 'MED-0009';
UPDATE products SET brand_id = 9, tags = JSON_ARRAY('thiet-bi-y-te'), country_of_origin = 'Switzerland', is_exclusive = 1 WHERE sku = 'SUP-0001';

-- Thông số kỹ thuật sản phẩm mẫu
INSERT INTO product_specifications (product_id, spec_key, spec_value, sort_order) VALUES
(1, 'Thành phần',       'Paracetamol 500mg, Caffeine 65mg',                 1),
(1, 'Quy cách',         'Hộp 12 viên nén bao phim',                         2),
(1, 'Bảo quản',         'Để nơi khô ráo, nhiệt độ dưới 30°C, tránh ánh sáng', 3),
(1, 'Chỉ định',         'Hạ sốt, giảm đau đầu, đau cơ, đau răng, đau bụng kinh', 4),
(2, 'Thành phần',       'Amoxicillin (dạng trihydrate) 500mg',              1),
(2, 'Quy cách',         'Hộp 10 vỉ × 10 viên nang cứng',                   2),
(2, 'Bảo quản',         'Bảo quản ở nhiệt độ không quá 25°C',              3),
(2, 'Chỉ định',         'Nhiễm trùng đường hô hấp, tiết niệu, da và mô mềm', 4),
(7, 'Thành phần',       'Vitamin C (từ Acerola) 1000mg',                    1),
(7, 'Quy cách',         'Hộp 31 viên nén bao phim',                         2),
(7, 'Bảo quản',         'Nơi khô, mát, tránh ánh sáng và độ ẩm',           3),
(7, 'Xuất xứ',          'Blackmores Ltd, Australia — Tiêu chuẩn GMP TGA',  4);

-- Phân cấp kho: Zones
INSERT INTO storage_zones (code, name, description, is_active) VALUES
('RX',   'Rx Zone',    'Khu vực thuốc kê đơn — yêu cầu kiểm soát truy cập dược sĩ', 1),
('OTC',  'OTC Zone',   'Khu vực thuốc không kê đơn — khách hàng có thể xem',         1),
('TPCN', 'TPCN Zone',  'Khu vực Thực Phẩm Chức Năng và Vitamin',                       1),
('COLD', 'Kho Lạnh',   'Khu vực bảo quản lạnh (2-8°C) — vaccine, thuốc sinh học',    1);

-- Phân cấp kho: Cabinets
INSERT INTO storage_cabinets (zone_id, code, name, shelf_count, is_active) VALUES
(1, 'RX-1',     'Tủ Rx-1',          2, 1),
(2, 'OTC-1',    'Tủ OTC-1',         2, 1),
(2, 'OTC-2',    'Tủ OTC-2',         1, 1),
(2, 'OTC-DISP', 'Quầy trưng bày',   1, 1),
(3, 'TPCN-1',   'Tủ TPCN-1',        1, 1),
(4, 'COLD-A',   'Tủ Lạnh A',        1, 1);

-- Phân cấp kho: Shelves — ánh xạ 1-1 sang bảng locations cũ
INSERT INTO storage_shelves (cabinet_id, name, location_id, product_type, is_active) VALUES
(1, 'Ngăn 1',       1, 'Kháng sinh Rx',       1),
(1, 'Ngăn 2',       2, 'Tim mạch, HA Rx',     1),
(2, 'Tầng trên',    3, 'Hạ sốt, Giảm đau',    1),
(2, 'Tầng giữa',    4, 'Tiêu hoá, Dị ứng',    1),
(3, 'Tầng trên',    5, 'Ho, Cảm cúm',          1),
(5, 'Ngăn 1',       6, 'Vitamin & TPCN',        1),
(6, 'Ngăn trên',    7, 'Thuốc lạnh',            1),
(4, 'Kệ 1',         8, 'Trưng bày OTC',         1);

-- Phiếu kiểm kê mẫu
INSERT INTO inventory_audits (audit_code, location_id, total_items, total_missing, total_surplus, total_value_diff, status, created_by) VALUES
('AUD-260301-001', 1, 5, 2, 0, -3600.00, 'reconciled', 2),
('AUD-260315-001', 3, 8, 0, 1, 18000.00, 'reconciled', 2),
('AUD-260317-001', NULL, 26, 3, 1, -12000.00, 'draft', 2);

-- Chi tiết kiểm kê mẫu
INSERT INTO audit_items (audit_id, batch_item_id, product_id, system_quantity, actual_quantity, difference_quantity, notes) VALUES
(1, 4, 2, 30, 28, -2, 'Phát hiện 2 viên bị vỡ khi kiểm kê'),
(1, 1, 1, 15, 15,  0, NULL),
(2, 6, 4, 10,  11,  1, 'Tìm được hộp để sai vị trí từ đợt nhập trước'),
(3, 1, 1, 156, 155, -1, NULL),
(3, 2, 6, 245, 245,  0, NULL);

-- Cấu hình giao hàng
INSERT INTO delivery_config (max_delivery_radius_km, base_shipping_fee, free_shipping_threshold, is_enabled) VALUES
(8.0, 15000.00, 500000.00, 1);

-- Khung giờ giao hàng
INSERT INTO delivery_timeslots (label, start_time, end_time, slot_type, is_active, sort_order) VALUES
('09:00 - 12:00', '09:00:00', '12:00:00', 'standard', 1, 1),
('14:00 - 17:00', '14:00:00', '17:00:00', 'standard', 1, 2),
('17:00 - 20:00', '17:00:00', '20:00:00', 'standard', 1, 3),
('Giao gấp 30-60 phút', '00:00:00', '23:59:59', 'rushed',   1, 4);
