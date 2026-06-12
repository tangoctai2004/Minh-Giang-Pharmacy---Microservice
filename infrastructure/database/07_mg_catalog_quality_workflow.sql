USE mg_catalog;

ALTER TABLE products
  MODIFY COLUMN status ENUM('draft','pending_review','active','inactive','rejected')
  COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft'
  COMMENT 'draft=đang nhập, pending_review=chờ duyệt, active=đang kinh doanh, inactive=ngừng kinh doanh, rejected=từ chối';

