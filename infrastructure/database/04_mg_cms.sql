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
  `title` varchar(400) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TiÃªu Ä‘á» bÃ i viáº¿t',
  `slug` varchar(450) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL slug SEO-friendly, VD: benh-gut-nguyen-nhan-va-dieu-tri',
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ná»™i dung HTML Ä‘áº§y Ä‘á»§ cá»§a bÃ i viáº¿t',
  `excerpt` text COLLATE utf8mb4_unicode_ci COMMENT 'TÃ³m táº¯t ngáº¯n (200-300 kÃ½ tá»±), dÃ¹ng hiá»ƒn thá»‹ danh sÃ¡ch',
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL áº£nh thumbnail bÃ i viáº¿t',
  `category_id` int NOT NULL COMMENT 'FK â†’ cms_categories.id',
  `author_id` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” dÆ°á»£c sÄ©/admin viáº¿t bÃ i',
  `tags` json DEFAULT NULL COMMENT 'JSON array tags, VD: ["benh-gut","acid-uric","khop"]',
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT 'draft=báº£n nhÃ¡p, published=Ä‘Ã£ xuáº¥t báº£n, archived=lÆ°u trá»¯',
  `published_at` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm xuáº¥t báº£n â€” NULL náº¿u chÆ°a publish',
  `view_count` int NOT NULL DEFAULT '0' COMMENT 'LÆ°á»£t xem bÃ i viáº¿t (tÄƒng dáº§n)',
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
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='BÃ i viáº¿t sá»©c khoáº», bá»‡nh lÃ½, tÆ° váº¥n thuá»‘c cá»§a NhÃ  thuá»‘c Minh Giang';
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
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn banner (chá»‰ dÃ¹ng quáº£n lÃ½ ná»™i bá»™)',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL hÃ¬nh áº£nh banner (desktop, khuyáº¿n nghá»‹ 1920Ã—600)',
  `link_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL chuyá»ƒn hÆ°á»›ng khi click vÃ o banner',
  `position` enum('hero','popup','sidebar') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Vá»‹ trÃ­ hiá»ƒn thá»‹: hero=banner chÃ­nh, popup=cá»­a sá»• pop-up, sidebar=bÃªn cáº¡nh',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `start_date` date DEFAULT NULL COMMENT 'NgÃ y báº¯t Ä‘áº§u hiá»ƒn thá»‹ (NULL=hiá»ƒn thá»‹ ngay)',
  `end_date` date DEFAULT NULL COMMENT 'NgÃ y káº¿t thÃºc hiá»ƒn thá»‹ (NULL=khÃ´ng giá»›i háº¡n)',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'Thá»© tá»± hiá»ƒn thá»‹ (nhá» = Æ°u tiÃªn cao)',
  PRIMARY KEY (`id`),
  KEY `idx_banners_position` (`position`),
  KEY `idx_banners_is_active` (`is_active`),
  KEY `idx_banners_date_range` (`start_date`,`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Banner quáº£ng cÃ¡o vÃ  thÃ´ng bÃ¡o trÃªn website';
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
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn danh má»¥c: Tin tá»©c y táº¿, Bá»‡nh lÃ½, Dinh dÆ°á»¡ng...',
  `slug` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL slug, VD: tin-tuc-y-te',
  `type` enum('article','disease','promotion') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'PhÃ¢n loáº¡i danh má»¥c: article=bÃ i viáº¿t, disease=bá»‡nh, promotion=KM',
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh má»¥c ná»™i dung CMS phÃ¢n theo loáº¡i bÃ i viáº¿t';
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
  `original_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn file gá»‘c khi upload',
  `stored_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn file thá»±c táº¿ lÆ°u trá»¯ (UUID + ext)',
  `file_url` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL cÃ´ng khai truy cáº­p file',
  `thumbnail_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL thumbnail Ä‘Ã£ resize (chá»‰ cÃ³ vá»›i áº£nh)',
  `file_size` bigint NOT NULL COMMENT 'KÃ­ch thÆ°á»›c file theo bytes',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MIME type: image/jpeg, image/webp, application/pdf, ...',
  `media_type` enum('image','document','video','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'image',
  `width` int DEFAULT NULL COMMENT 'Chiá»u rá»™ng px (chá»‰ cÃ³ vá»›i áº£nh/video)',
  `height` int DEFAULT NULL COMMENT 'Chiá»u cao px (chá»‰ cÃ³ vá»›i áº£nh/video)',
  `alt_text` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Alt text SEO cho áº£nh',
  `tags` json DEFAULT NULL COMMENT 'NhÃ£n phÃ¢n loáº¡i JSON array: ["banner","product","article"]',
  `used_in` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NÆ¡i sá»­ dá»¥ng: articles, banners, products, ...',
  `used_in_id` bigint DEFAULT NULL COMMENT 'ID cá»§a record Ä‘ang dÃ¹ng file nÃ y (cÃ³ thá»ƒ NULL)',
  `uploaded_by` bigint NOT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” ngÆ°á»i upload',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Soft delete â€” 1=Ä‘Ã£ xoÃ¡ khá»i thÆ° viá»‡n',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm soft delete',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `file_extension` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Extension thực tế của file, chữ thường, không dấu chấm (jpg, png, pdf...) — Application extract từ stored_name khi upload, validate theo whitelist TRƯỚC khi lưu DB',
  PRIMARY KEY (`id`),
  KEY `idx_cms_media_type` (`media_type`),
  KEY `idx_cms_media_uploaded_by` (`uploaded_by`),
  KEY `idx_cms_media_used_in` (`used_in`,`used_in_id`),
  KEY `idx_cms_media_deleted` (`is_deleted`),
  CONSTRAINT `chk_media_safe_extension` CHECK ((`file_extension` in (_utf8mb4'jpg',_utf8mb4'jpeg',_utf8mb4'png',_utf8mb4'webp',_utf8mb4'gif',_utf8mb4'pdf',_utf8mb4'mp4',_utf8mb4'mov',_utf8mb4'webm',_utf8mb4'csv',_utf8mb4'xlsx',_utf8mb4'xls',_utf8mb4'doc',_utf8mb4'docx')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ThÆ° viá»‡n media upload â€” áº£nh, tÃ i liá»‡u, video cá»§a toÃ n há»‡ thá»‘ng';
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
  `title` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TiÃªu Ä‘á» trang',
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ná»™i dung HTML/Markdown toÃ n trang',
  `meta_title` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SEO: <title> tag',
  `meta_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SEO: meta description',
  `meta_keywords` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SEO: meta keywords',
  `featured_image` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL áº£nh Ä‘áº¡i diá»‡n trang (dÃ¹ng cho social share)',
  `author_id` bigint NOT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” ngÆ°á»i táº¡o',
  `published_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” ngÆ°á»i xuáº¥t báº£n',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=Ä‘ang hoáº¡t Ä‘á»™ng vÃ  hiá»‡n trÃªn web',
  `show_in_footer` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=hiá»‡n link trang nÃ y trong footer',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'Thá»© tá»± sáº¯p xáº¿p trong danh má»¥c trang',
  `published_at` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm xuáº¥t báº£n (NULL=chÆ°a xuáº¥t báº£n)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cms_pages_slug` (`slug`),
  KEY `idx_cms_pages_active` (`is_active`),
  KEY `idx_cms_pages_footer` (`show_in_footer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Trang ná»™i dung tÄ©nh CMS: giá»›i thiá»‡u, chÃ­nh sÃ¡ch, hÆ°á»›ng dáº«n';
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
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn chÆ°Æ¡ng trÃ¬nh: Giáº£m 10% táº¥t cáº£ Vitamin, Freeship Ä‘Æ¡n tá»« 500k...',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MÃ£ voucher nháº­p tay: SUMMER10 â€” NULL=tá»± Ä‘á»™ng Ã¡p dá»¥ng khi Ä‘á»§ Ä‘iá»u kiá»‡n',
  `type` enum('percent_discount','fixed_discount','free_shipping','buy_x_get_y') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Loáº¡i khuyáº¿n mÃ£i',
  `discount_value` decimal(10,2) NOT NULL COMMENT 'GiÃ¡ trá»‹ giáº£m: 10 (= 10%) hoáº·c 50000 (= -50.000Ä‘)',
  `min_order_value` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'GiÃ¡ trá»‹ Ä‘Æ¡n hÃ ng tá»‘i thiá»ƒu Ä‘á»ƒ Ã¡p dá»¥ng KM',
  `max_discount_amount` decimal(12,2) DEFAULT NULL COMMENT 'Sá»‘ tiá»n giáº£m tá»‘i Ä‘a (VD: giáº£m 10% nhÆ°ng tá»‘i Ä‘a 100.000Ä‘) â€” NULL=khÃ´ng giá»›i háº¡n',
  `applicable_to` enum('all','specific_categories','specific_products') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all' COMMENT 'Pháº¡m vi Ã¡p dá»¥ng KM',
  `applicable_ids` json DEFAULT NULL COMMENT 'JSON array [id1, id2...] cho specific_categories hoáº·c specific_products',
  `usage_limit` int DEFAULT NULL COMMENT 'Sá»‘ lÆ°á»£t dÃ¹ng tá»•ng tá»‘i Ä‘a â€” NULL=khÃ´ng giá»›i háº¡n',
  `usage_count` int NOT NULL DEFAULT '0' COMMENT 'ÄÃ£ dÃ¹ng bao nhiÃªu lÆ°á»£t (tÄƒng má»—i khi Ä‘Æ¡n hÃ ng Ã¡p dá»¥ng)',
  `start_date` datetime NOT NULL COMMENT 'Thá»i Ä‘iá»ƒm báº¯t Ä‘áº§u KM',
  `end_date` datetime NOT NULL COMMENT 'Thá»i Ä‘iá»ƒm káº¿t thÃºc KM',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0=táº¡m dá»«ng KM trÆ°á»›c háº¡n',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promotions_code` (`code`),
  KEY `idx_promotions_is_active` (`is_active`),
  KEY `idx_promotions_date_range` (`start_date`,`end_date`),
  KEY `idx_promotions_type` (`type`),
  CONSTRAINT `chk_discount_value_non_negative` CHECK ((`discount_value` >= 0)),
  CONSTRAINT `chk_promotion_dates_valid` CHECK ((`end_date` > `start_date`)),
  CONSTRAINT `chk_usage_not_exceeded` CHECK (((`usage_limit` is null) or (`usage_count` <= `usage_limit`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ChÆ°Æ¡ng trÃ¬nh khuyáº¿n mÃ£i vÃ  mÃ£ voucher giáº£m giÃ¡';
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
  `config_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'KhoÃ¡ cáº¥u hÃ¬nh â€” dÃ¹ng snake_case, phÃ¢n nhÃ³m báº±ng tiá»n tá»‘: store_, payment_, shipping_, loyalty_, ...)',
  `config_value` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'GiÃ¡ trá»‹ â€” string, JSON, boolean (''true''/''false''), sá»‘',
  `value_type` enum('string','integer','decimal','boolean','json') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string' COMMENT 'Kiá»ƒu dá»¯ liá»‡u Ä‘á»ƒ parse Ä‘Ãºng á»Ÿ frontend/backend',
  `display_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn hiá»ƒn thá»‹ cho admin UI',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MÃ´ táº£ chi tiáº¿t cÃ i Ä‘áº·t nÃ y lÃ m gÃ¬',
  `group_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general' COMMENT 'NhÃ³m cÃ i Ä‘áº·t: store, payment, shipping, loyalty, notification',
  `is_public` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=cho phÃ©p guest Ä‘á»c qua API public (tÃªn nhÃ  thuá»‘c, Ä‘á»‹a chá»‰, ...)',
  `is_editable` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0=chá»‰ Ä‘á»c, khÃ´ng cho phÃ©p sá»­a tá»« admin UI',
  `updated_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” ngÆ°á»i cáº­p nháº­t cuá»‘i',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cáº¥u hÃ¬nh nhÃ  thuá»‘c dáº¡ng key-value â€” thay tháº¿ file .env cho runtime config';
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
  `keyword` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tá»« khoÃ¡ tÃ¬m kiáº¿m (Ä‘Ã£ lowercase/normalize)',
  `context` enum('global','product','disease','article') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'global' COMMENT 'Ngá»¯ cáº£nh: global=toÃ n trang, product=tÃ¬m sáº£n pháº©m, disease=tÃ¬m bá»‡nh',
  `search_count` bigint NOT NULL DEFAULT '1' COMMENT 'Tá»•ng sá»‘ lÆ°á»£t tÃ¬m tá»« khoÃ¡ nÃ y',
  `distinct_users` int NOT NULL DEFAULT '1' COMMENT 'Sá»‘ ngÆ°á»i dÃ¹ng khÃ¡c nhau Ä‘Ã£ tÃ¬m (estimate)',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=admin ghim cá»‘ Ä‘á»‹nh khÃ´ng phá»¥ thuá»™c search_count',
  `is_hidden` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=admin áº©n khá»i danh sÃ¡ch hot search',
  `pin_order` int NOT NULL DEFAULT '0' COMMENT 'Thá»© tá»± hiá»‡n náº¿u is_pinned=1',
  `period_start` date NOT NULL COMMENT 'NgÃ y báº¯t Ä‘áº§u tÃ­nh ká»³ thá»‘ng kÃª',
  `period_end` date NOT NULL COMMENT 'NgÃ y káº¿t thÃºc ká»³ thá»‘ng kÃª',
  `last_searched` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Láº§n gáº§n nháº¥t cÃ³ ngÆ°á»i tÃ¬m tá»« khoÃ¡ nÃ y',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trending_keyword_context_period` (`keyword`,`context`,`period_start`),
  KEY `idx_trending_search_count` (`search_count` DESC),
  KEY `idx_trending_context` (`context`),
  KEY `idx_trending_pinned` (`is_pinned`,`pin_order`),
  KEY `idx_trending_period` (`period_start`,`period_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tá»« khoÃ¡ tÃ¬m kiáº¿m phá»• biáº¿n â€” dÃ¹ng hiá»ƒn thá»‹ hot search vÃ  gá»£i Ã½';
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
