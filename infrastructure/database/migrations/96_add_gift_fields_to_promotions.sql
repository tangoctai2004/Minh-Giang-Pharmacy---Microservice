-- ============================================================
-- Migration 96: Thêm các trường Gift Campaign vào bảng promotions
-- Database: mg_cms
-- Chạy một lần duy nhất — idempotent qua IF NOT EXISTS
-- ============================================================
USE mg_cms;

-- Thêm gift_product_name nếu chưa tồn tại
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_cms'
    AND TABLE_NAME   = 'promotions'
    AND COLUMN_NAME  = 'gift_product_name'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE promotions ADD COLUMN gift_product_name VARCHAR(300) DEFAULT NULL COMMENT ''Tên SP quà tặng (buy_x_get_y)'' AFTER applicable_ids',
  'SELECT ''gift_product_name already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Thêm gift_product_qty nếu chưa tồn tại
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_cms'
    AND TABLE_NAME   = 'promotions'
    AND COLUMN_NAME  = 'gift_product_qty'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE promotions ADD COLUMN gift_product_qty INT NOT NULL DEFAULT 1 COMMENT ''Số lượng quà tặng'' AFTER gift_product_name',
  'SELECT ''gift_product_qty already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Thêm applicable_channel nếu chưa tồn tại
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_cms'
    AND TABLE_NAME   = 'promotions'
    AND COLUMN_NAME  = 'applicable_channel'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE promotions ADD COLUMN applicable_channel ENUM('all','web','pos') NOT NULL DEFAULT 'all' COMMENT 'Kênh áp dụng: all/web/pos' AFTER gift_product_qty",
  'SELECT ''applicable_channel already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Thêm campaign_name (tên chiến dịch hiển thị riêng)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_cms'
    AND TABLE_NAME   = 'promotions'
    AND COLUMN_NAME  = 'campaign_name'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE promotions ADD COLUMN campaign_name VARCHAR(200) DEFAULT NULL COMMENT ''Tên chiến dịch (hiển thị phụ dưới mã voucher)'' AFTER name',
  'SELECT ''campaign_name already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Migration 96 completed' AS status;
