-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: mg_cms
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `mg_cms`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `mg_cms` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `mg_cms`;

--
-- Table structure for table `articles`
--

DROP TABLE IF EXISTS `articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `articles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(400) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tiêu đề bài viết',
  `slug` varchar(450) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL slug SEO-friendly, VD: benh-gut-nguyen-nhan-va-dieu-tri',
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nội dung HTML đầy đủ của bài viết',
  `excerpt` text COLLATE utf8mb4_unicode_ci COMMENT 'Tóm tắt ngắn (200-300 ký tự), dùng hiển thị danh sách',
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL ảnh thumbnail bài viết',
  `category_id` int NOT NULL COMMENT 'FK → cms_categories.id',
  `author_id` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id — dược sĩ/admin viết bài',
  `related_product_ids` json DEFAULT NULL COMMENT 'Mảng JSON chứa ID các sản phẩm liên quan',
  `related_article_ids` json DEFAULT NULL COMMENT 'Mảng JSON chứa ID các bài viết liên quan',
  `tags` json DEFAULT NULL COMMENT 'JSON array tags, VD: ["benh-gut","acid-uric","khop"]',
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT 'draft=bản nháp, published=đã xuất bản, archived=lưu trữ',
  `published_at` datetime DEFAULT NULL COMMENT 'Thời điểm xuất bản — NULL nếu chưa publish',
  `view_count` int NOT NULL DEFAULT '0' COMMENT 'Lượt xem bài viết (tăng dần)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `content_sanitized` longtext COLLATE utf8mb4_unicode_ci COMMENT 'HTML đã qua server-side sanitizer (DOMPurify hoặc sanitize-html cho Node.js, bleach cho Python). Client PHẢI render cột này — KHÔNG ĐƯỢC render cột content thô trực tiếp.',
  `sanitized_at` datetime DEFAULT NULL COMMENT 'Thời điểm sanitize lần cuối. NULL=chưa xử lý, cần chạy lại sanitize job. Mỗi khi content thay đổi, phải sanitize lại và cập nhật cột này.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_articles_slug` (`slug`),
  KEY `idx_articles_category_id` (`category_id`),
  KEY `idx_articles_status` (`status`),
  KEY `idx_articles_published_at` (`published_at`),
  KEY `idx_articles_author_id` (`author_id`),
  FULLTEXT KEY `ft_articles_title_content` (`title`,`excerpt`),
  CONSTRAINT `fk_articles_category` FOREIGN KEY (`category_id`) REFERENCES `cms_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bài viết sức khoẻ, bệnh lý, tư văn thuốc của Nhà thuốc Minh Giang';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Seed data for table `articles` intentionally omitted.
-- Clean article data is generated from crawl-data/clean.
--

--
-- Table structure for table `banners`
--

DROP TABLE IF EXISTS `banners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `banners` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên banner (chỉ dùng quản lý nội bộ)',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL hình ảnh banner (desktop, khuyến nghị 1920×600)',
  `link_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL chuyển hướng khi click vào banner',
  `position` enum('hero','popup','sidebar') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Vị trí hiển thị: hero=banner chính, popup=cửa sổ pop-up, sidebar=bên cạnh',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `start_date` date DEFAULT NULL COMMENT 'Ngày bắt đầu hiển thị (NULL=hiển thị ngay)',
  `end_date` date DEFAULT NULL COMMENT 'Ngày kết thúc hiển thị (NULL=không giới hạn)',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'Thứ tự hiển thị (nhỏ = ưu tiên cao)',
  PRIMARY KEY (`id`),
  KEY `idx_banners_position` (`position`),
  KEY `idx_banners_is_active` (`is_active`),
  KEY `idx_banners_date_range` (`start_date`,`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Banner quảng cáo và thông báo trên website';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `banners`
--

LOCK TABLES `banners` WRITE;
/*!40000 ALTER TABLE `banners` DISABLE KEYS */;
/*!40000 ALTER TABLE `banners` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cms_categories`
--

DROP TABLE IF EXISTS `cms_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cms_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên danh mục: Tin tức y tế, Bệnh lý, Dinh dưỡng...',
  `slug` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL slug, VD: tin-tuc-y-te',
  `type` enum('article','disease','promotion') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Phân loại danh mục: article=bài viết, disease=bệnh, promotion=KM',
  `parent_id` int DEFAULT NULL COMMENT 'FK → cms_categories.id — NULL nếu là root category',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Mô tả chi tiết danh mục (chỉ dùng cho disease)',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL ảnh đại diện danh mục',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=hiển thị, 0=ẩn danh mục',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'Thứ tự sắp xếp (nhỏ hơn = lên trước)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cms_categories_slug` (`slug`),
  KEY `idx_cms_categories_type` (`type`),
  KEY `idx_cms_categories_parent_id` (`parent_id`),
  KEY `idx_cms_categories_is_active` (`is_active`),
  KEY `idx_cms_categories_sort_order` (`sort_order`),
  CONSTRAINT `fk_cms_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `cms_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục nội dung CMS phân theo loại bài viết';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cms_categories`
--

LOCK TABLES `cms_categories` WRITE;
/*!40000 ALTER TABLE `cms_categories` DISABLE KEYS */;
INSERT INTO `cms_categories` VALUES (1,'Sức khoẻ tổng quát','suc-khoe-tong-quat','article',NULL,NULL,NULL,1,0),(2,'Kiến thức bệnh lý','kien-thuc-benh-ly','disease',NULL,NULL,NULL,1,0),(3,'Tư vấn dùng thuốc','tu-van-dung-thuoc','article',NULL,NULL,NULL,1,0),(4,'Tin tức y tế','tin-tuc-y-te','article',NULL,NULL,NULL,1,0),(5,'Chương trình KM','chuong-trinh-khuyen-mai','promotion',NULL,NULL,NULL,1,0),(6,'Người cao tuổi','nguoi-cao-tuoi','article',NULL,NULL,NULL,1,0);
/*!40000 ALTER TABLE `cms_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cms_media`
--

DROP TABLE IF EXISTS `cms_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cms_media` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `original_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên file gốc khi upload',
  `stored_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên file thực tế lưu trữ (UUID + ext)',
  `file_url` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL công khai truy cập file',
  `thumbnail_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL thumbnail đã resize (chỉ có với ảnh)',
  `file_size` bigint NOT NULL COMMENT 'Kích thước file theo bytes',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MIME type: image/jpeg, image/webp, application/pdf, ...',
  `media_type` enum('image','document','video','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'image',
  `width` int DEFAULT NULL COMMENT 'Chiều rộng px (chỉ có với ảnh/video)',
  `height` int DEFAULT NULL COMMENT 'Chiều cao px (chỉ có với ảnh/video)',
  `alt_text` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Alt text SEO cho ảnh',
  `tags` json DEFAULT NULL COMMENT 'Nhãn phân loại JSON array: ["banner","product","article"]',
  `used_in` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nơi sử dụng: articles, banners, products, ...',
  `used_in_id` bigint DEFAULT NULL COMMENT 'ID của record đang dùng file này (có thể NULL)',
  `uploaded_by` bigint NOT NULL COMMENT '(Cross-schema) mg_identity.users.id — người upload',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Soft delete — 1=đã xoá khỏi thư viện',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Thời điểm soft delete',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `file_extension` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Extension thực tế của file, chữ thường, không dấu chấm (jpg, png, pdf...) — Application extract từ stored_name khi upload, validate theo whitelist TRƯỚC khi lưu DB',
  PRIMARY KEY (`id`),
  KEY `idx_cms_media_type` (`media_type`),
  KEY `idx_cms_media_uploaded_by` (`uploaded_by`),
  KEY `idx_cms_media_used_in` (`used_in`,`used_in_id`),
  KEY `idx_cms_media_deleted` (`is_deleted`),
  CONSTRAINT `chk_media_safe_extension` CHECK ((`file_extension` in (_utf8mb4'jpg',_utf8mb4'jpeg',_utf8mb4'png',_utf8mb4'webp',_utf8mb4'gif',_utf8mb4'pdf',_utf8mb4'mp4',_utf8mb4'mov',_utf8mb4'webm',_utf8mb4'csv',_utf8mb4'xlsx',_utf8mb4'xls',_utf8mb4'doc',_utf8mb4'docx')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thư viện media upload — ảnh, tài liệu, video của toàn hệ thống';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cms_media`
--

LOCK TABLES `cms_media` WRITE;
/*!40000 ALTER TABLE `cms_media` DISABLE KEYS */;
/*!40000 ALTER TABLE `cms_media` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cms_pages`
--

DROP TABLE IF EXISTS `cms_pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cms_pages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL slug: about-us, privacy-policy, return-policy, ...',
  `title` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tiêu đề trang',
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nội dung HTML/Markdown toàn trang',
  `meta_title` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SEO: <title> tag',
  `meta_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SEO: meta description',
  `meta_keywords` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SEO: meta keywords',
  `featured_image` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL ảnh đại diện trang (dùng cho social share)',
  `author_id` bigint NOT NULL COMMENT '(Cross-schema) mg_identity.users.id — người tạo',
  `published_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id — người xuất bản',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=đang hoạt động và hiện trên web',
  `show_in_footer` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=hiện link trang này trong footer',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'Thứ tự sắp xếp trong danh mục trang',
  `published_at` datetime DEFAULT NULL COMMENT 'Thời điểm xuất bản (NULL=chưa xuất bản)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cms_pages_slug` (`slug`),
  KEY `idx_cms_pages_active` (`is_active`),
  KEY `idx_cms_pages_footer` (`show_in_footer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Trang nội dung tĩnh CMS: giới thiệu, chính sách, hướng dẫn';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cms_pages`
--

LOCK TABLES `cms_pages` WRITE;
/*!40000 ALTER TABLE `cms_pages` DISABLE KEYS */;
/*!40000 ALTER TABLE `cms_pages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promotions`
--

DROP TABLE IF EXISTS `promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promotions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên chương trình: Giảm 10% tất cả Vitamin, Freeship đơn từ 500k...',
  `campaign_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tên chiến dịch (hiển thị phụ dưới mã voucher)',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã voucher nhập tay: SUMMER10 — NULL=tự động áp dụng khi đủ điều kiện',
  `type` enum('percent_discount','fixed_discount','free_shipping','buy_x_get_y') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Loại khuyến mại',
  `discount_value` decimal(10,2) NOT NULL COMMENT 'Giá trị giảm: 10 (= 10%) hoặc 50000 (= -50.000đ)',
  `min_order_value` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Giá trị đơn hàng tối thiểu để áp dụng KM',
  `max_discount_amount` decimal(12,2) DEFAULT NULL COMMENT 'Số tiền giảm tối đa (VD: giảm 10% nhưng tối đa 100.000đ) — NULL=không giới hạn',
  `applicable_to` enum('all','specific_categories','specific_products') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all' COMMENT 'Phạm vi áp dụng KM',
  `applicable_ids` json DEFAULT NULL COMMENT 'JSON array [id1, id2...] cho specific_categories hoặc specific_products',
  `gift_product_name` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tên SP quà tặng (buy_x_get_y)',
  `gift_product_qty` int NOT NULL DEFAULT '1' COMMENT 'Số lượng quà tặng',
  `applicable_channel` enum('all','web','pos') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all' COMMENT 'Kênh áp dụng: all/web/pos',
  `usage_limit` int DEFAULT NULL COMMENT 'Số lượt dùng tổng tối đa — NULL=không giới hạn',
  `usage_count` int NOT NULL DEFAULT '0' COMMENT 'Đã dùng bao nhiêu lượt (tăng mỗi khi đơn hàng áp dụng)',
  `start_date` datetime NOT NULL COMMENT 'Thời điểm bắt đầu KM',
  `end_date` datetime NOT NULL COMMENT 'Thời điểm kết thúc KM',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0=tạm dừng KM trước hạn',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promotions_code` (`code`),
  KEY `idx_promotions_is_active` (`is_active`),
  KEY `idx_promotions_date_range` (`start_date`,`end_date`),
  KEY `idx_promotions_type` (`type`),
  CONSTRAINT `chk_discount_value_non_negative` CHECK ((`discount_value` >= 0)),
  CONSTRAINT `chk_promotion_dates_valid` CHECK ((`end_date` > `start_date`)),
  CONSTRAINT `chk_usage_not_exceeded` CHECK (((`usage_limit` is null) or (`usage_count` <= `usage_limit`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chương trình khuyến mãi và mã voucher giảm giá';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promotions`
--

LOCK TABLES `promotions` WRITE;
/*!40000 ALTER TABLE `promotions` DISABLE KEYS */;
/*!40000 ALTER TABLE `promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_config`
--

DROP TABLE IF EXISTS `store_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `store_config` (
  `config_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Khoá cấu hình — dùng snake_case, phân nhóm bằng tiền tố: store_, payment_, shipping_, loyalty_, ...)',
  `config_value` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Giá trị — string, JSON, boolean (''true''/''false''), số',
  `value_type` enum('string','integer','decimal','boolean','json') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string' COMMENT 'Kiểu dữ liệu để parse đúng ở frontend/backend',
  `display_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên hiển thị cho admin UI',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mô tả chi tiết cài đặt này làm gì',
  `group_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general' COMMENT 'Nhóm cài đặt: store, payment, shipping, loyalty, notification',
  `is_public` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=cho phép guest đọc qua API public (tên nhà thuốc, địa chỉ, ...)',
  `is_editable` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=cho phép sửa từ admin UI, 0=chỉ đọc',
  `updated_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id — người cập nhật cuối',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_sensitive` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=config_value là AES-256-GCM ciphertext (API key payment gateway, SMTP password, SMS token...) — KHÔNG BAO GIỜ trả về qua public API endpoint GET /api/cms/store-config',
  `value_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SHA-256 hexdigest của plaintext gốc — dùng verify toàn vẹn mà không cần decrypt. Tính tại application layer khi lưu.',
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID duy nhất tự sinh (không phải PK)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=cấu hình đang dùng, 0=vô hiệu hóa',
  PRIMARY KEY (`config_key`),
  UNIQUE KEY `id` (`id`),
  KEY `idx_store_config_group` (`group_name`),
  KEY `idx_store_config_public` (`is_public`),
  KEY `idx_store_config_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cấu hình nhà thuốc dạng key-value — thay thế file .env cho runtime config';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_config`
--

LOCK TABLES `store_config` WRITE;
/*!40000 ALTER TABLE `store_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `store_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trending_searches`
--

DROP TABLE IF EXISTS `trending_searches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trending_searches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `keyword` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Từ khoá tìm kiếm (đã lowercase/normalize)',
  `context` enum('global','product','disease','article') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'global' COMMENT 'Ngữ cảnh: global=toàn trang, product=tìm sản phẩm, disease=tìm bệnh',
  `search_count` bigint NOT NULL DEFAULT '1' COMMENT 'Tổng số lượt tìm từ khoá này',
  `distinct_users` int NOT NULL DEFAULT '1' COMMENT 'Số người dùng khác nhau đã tìm (estimate)',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=admin ghim cố định không phụ thuộc search_count',
  `is_hidden` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=admin ẩn khỏi danh sách hot search',
  `pin_order` int NOT NULL DEFAULT '0' COMMENT 'Thứ tự hiện nếu is_pinned=1',
  `period_start` date NOT NULL COMMENT 'Ngày bắt đầu tính kỳ thống kê',
  `period_end` date NOT NULL COMMENT 'Ngày kết thúc kỳ thống kê',
  `last_searched` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Lần gần nhất có người tìm từ khoá này',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trending_keyword_context_period` (`keyword`,`context`,`period_start`),
  KEY `idx_trending_search_count` (`search_count` DESC),
  KEY `idx_trending_context` (`context`),
  KEY `idx_trending_pinned` (`is_pinned`,`pin_order`),
  KEY `idx_trending_period` (`period_start`,`period_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Từ khoá tìm kiếm phổ biến — dùng hiển thị hot search và gợi ý';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trending_searches`
--

LOCK TABLES `trending_searches` WRITE;
/*!40000 ALTER TABLE `trending_searches` DISABLE KEYS */;
/*!40000 ALTER TABLE `trending_searches` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-21 18:23:47
