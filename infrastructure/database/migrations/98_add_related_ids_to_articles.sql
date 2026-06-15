-- ============================================================
-- Migration 98: Thêm các trường bài viết và sản phẩm liên quan vào bảng articles
-- Database: mg_cms
-- Chạy một lần duy nhất — idempotent qua IF NOT EXISTS
-- ============================================================
USE mg_cms;

-- Thêm related_product_ids nếu chưa tồn tại
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_cms'
    AND TABLE_NAME   = 'articles'
    AND COLUMN_NAME  = 'related_product_ids'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE articles ADD COLUMN related_product_ids JSON DEFAULT NULL COMMENT ''Mảng JSON chứa ID các sản phẩm liên quan'' AFTER author_id',
  'SELECT ''related_product_ids already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Thêm related_article_ids nếu chưa tồn tại
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_cms'
    AND TABLE_NAME   = 'articles'
    AND COLUMN_NAME  = 'related_article_ids'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE articles ADD COLUMN related_article_ids JSON DEFAULT NULL COMMENT ''Mảng JSON chứa ID các bài viết liên quan'' AFTER related_product_ids',
  'SELECT ''related_article_ids already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Migration 98 completed' AS status;
