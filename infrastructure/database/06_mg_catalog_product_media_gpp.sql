USE mg_catalog;

-- Catalog product master extension for GPP/admin workflows.
-- Idempotent: safe to run more than once on existing developer databases.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT,
  IN p_after_column VARCHAR(64)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ',
      p_column_definition,
      IF(p_after_column IS NULL OR p_after_column = '', '', CONCAT(' AFTER `', p_after_column, '`'))
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` ADD ', p_index_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_column_if_missing(
  'products',
  'strength',
  'VARCHAR(100) NULL COMMENT ''Hàm lượng/nồng độ thuốc, VD: 500mg, 10ml, 20mg/ml''',
  'name'
);
CALL add_column_if_missing(
  'products',
  'route_of_administration',
  'VARCHAR(100) NULL COMMENT ''Đường dùng theo hồ sơ thuốc''',
  'strength'
);
CALL add_column_if_missing(
  'products',
  'special_control_group',
  'VARCHAR(100) NULL COMMENT ''Nhóm thuốc quản lý đặc biệt theo nghiệp vụ nhà thuốc GPP''',
  'requires_prescription'
);
CALL add_column_if_missing(
  'products',
  'storage_condition',
  'VARCHAR(100) NOT NULL DEFAULT ''Điều kiện thường'' COMMENT ''Điều kiện bảo quản chuẩn áp dụng cho thuốc''',
  'special_control_group'
);

ALTER TABLE products
  MODIFY route_of_administration VARCHAR(100) NULL COMMENT 'Đường dùng theo hồ sơ thuốc',
  MODIFY special_control_group VARCHAR(100) NULL COMMENT 'Nhóm thuốc quản lý đặc biệt theo nghiệp vụ nhà thuốc GPP',
  MODIFY storage_condition VARCHAR(100) NOT NULL DEFAULT 'Điều kiện thường' COMMENT 'Điều kiện bảo quản chuẩn áp dụng cho thuốc';

CALL add_column_if_missing(
  'product_units',
  'barcode',
  'VARCHAR(100) NULL COMMENT ''Mã vạch riêng cho đơn vị bán này nếu có''',
  'sort_order'
);
CALL add_index_if_missing('product_units', 'idx_product_units_barcode', 'KEY `idx_product_units_barcode` (`barcode`)');

CALL add_index_if_missing('products', 'idx_products_route', 'KEY `idx_products_route` (`route_of_administration`)');
CALL add_index_if_missing('products', 'idx_products_special_control_group', 'KEY `idx_products_special_control_group` (`special_control_group`)');
CALL add_index_if_missing('products', 'idx_products_storage_condition', 'KEY `idx_products_storage_condition` (`storage_condition`)');

CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT NOT NULL AUTO_INCREMENT,
  product_id BIGINT NOT NULL COMMENT 'FK → products.id',
  file_name VARCHAR(255) NOT NULL COMMENT 'Tên file lưu trong storage nội bộ',
  original_name VARCHAR(255) DEFAULT NULL COMMENT 'Tên file gốc từ máy người dùng',
  mime_type VARCHAR(100) NOT NULL COMMENT 'image/jpeg, image/png, image/webp...',
  file_size BIGINT NOT NULL COMMENT 'Dung lượng byte',
  storage_path VARCHAR(500) NOT NULL COMMENT 'Đường dẫn vật lý/tương đối trong storage',
  public_url VARCHAR(500) NOT NULL COMMENT 'URL public để frontend hiển thị ảnh',
  image_role ENUM('main','gallery','packaging','label','certificate') NOT NULL DEFAULT 'gallery' COMMENT 'Vai trò ảnh: chính, phụ, bao bì, nhãn, giấy tờ',
  alt_text VARCHAR(300) DEFAULT NULL COMMENT 'Alt text hỗ trợ accessibility/SEO',
  is_primary TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=ảnh đại diện chính của sản phẩm',
  sort_order INT NOT NULL DEFAULT 0,
  uploaded_by BIGINT DEFAULT NULL COMMENT 'identity.users.id nếu đi qua gateway',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_product_id (product_id),
  KEY idx_product_images_primary (product_id, is_primary),
  KEY idx_product_images_role (product_id, image_role),
  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ảnh sản phẩm catalog: 1 ảnh chính và nhiều ảnh phụ/bao bì/nhãn';

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
