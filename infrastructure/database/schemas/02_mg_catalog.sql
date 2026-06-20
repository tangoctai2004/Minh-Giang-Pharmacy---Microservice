-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: mg_catalog
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
-- Current Database: `mg_catalog`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `mg_catalog` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `mg_catalog`;

--
-- Table structure for table `audit_items`
--

DROP TABLE IF EXISTS `audit_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `audit_id` bigint NOT NULL COMMENT 'FK â†’ inventory_audits.id',
  `batch_item_id` bigint NOT NULL COMMENT 'FK â†’ batch_items.id',
  `product_id` bigint NOT NULL COMMENT 'FK â†’ products.id â€” denormalize Ä‘á»ƒ query nhanh',
  `system_quantity` int NOT NULL COMMENT 'Sá»‘ lÆ°á»£ng tá»“n theo há»‡ thá»‘ng táº¡i thá»i Ä‘iá»ƒm kiá»ƒm',
  `actual_quantity` int DEFAULT NULL COMMENT 'Sá»‘ lÆ°á»£ng Ä‘áº¿m thá»±c táº¿ (NULL=chÆ°a kiá»ƒm)',
  `difference_quantity` int DEFAULT NULL COMMENT 'actual - system: Ã¢m=thiáº¿u, dÆ°Æ¡ng=thá»«a',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chÃº dÃ²ng: lÃ½ do chÃªnh lá»‡ch',
  PRIMARY KEY (`id`),
  KEY `idx_audit_items_audit_id` (`audit_id`),
  KEY `idx_audit_items_batch_item_id` (`batch_item_id`),
  KEY `idx_audit_items_product_id` (`product_id`),
  CONSTRAINT `fk_audit_items_audit` FOREIGN KEY (`audit_id`) REFERENCES `inventory_audits` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_items_batch_item` FOREIGN KEY (`batch_item_id`) REFERENCES `batch_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiáº¿t tá»«ng dÃ²ng sáº£n pháº©m trong phiáº¿u kiá»ƒm kÃª';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `batch_items`
--

DROP TABLE IF EXISTS `batch_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `batch_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `batch_id` bigint NOT NULL COMMENT 'FK â†’ batches.id',
  `product_id` bigint NOT NULL COMMENT 'FK â†’ products.id',
  `lot_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Sá»‘ lÃ´ sáº£n xuáº¥t do NSX in trÃªn bao bÃ¬, VD: AMX-112',
  `manufacture_date` date DEFAULT NULL COMMENT 'NgÃ y sáº£n xuáº¥t (NSX)',
  `expiry_date` date NOT NULL COMMENT 'Háº¡n sá»­ dá»¥ng (HSD) â€” dÃ¹ng cho FEFO sorting',
  `quantity_received` int NOT NULL COMMENT 'Sá»‘ lÆ°á»£ng nháº­p vÃ o (tÃ­nh theo base_unit)',
  `quantity_remaining` int NOT NULL COMMENT 'Tá»“n kho cÃ²n láº¡i cá»§a lÃ´ nÃ y, giáº£m dáº§n khi xuáº¥t hÃ ng',
  `cost_price` decimal(15,2) NOT NULL COMMENT 'GiÃ¡ nháº­p thá»±c táº¿ cá»§a lÃ´ nÃ y (cÃ³ thá»ƒ khÃ¡c giÃ¡ cÆ¡ sá»Ÿ)',
  `clearance_discount_pct` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '% chiáº¿t kháº¥u khi thanh lÃ½ hÃ ng cáº­n HSD',
  `clearance_price` decimal(15,2) DEFAULT NULL COMMENT 'GiÃ¡ thanh lÃ½ sau chiáº¿t kháº¥u (NULL=chÆ°a Ã¡p dá»¥ng)',
  `location_id` bigint DEFAULT NULL COMMENT 'FK â†’ locations.id â€” vá»‹ trÃ­ ká»‡/tá»§ lÆ°u lÃ´ hÃ ng',
  `status` enum('available','near_expiry','expired','depleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available' COMMENT 'available=cÃ²n hÃ ng, near_expiry=cáº­n date(<90 ngÃ y), expired=háº¿t háº¡n, depleted=háº¿t hÃ ng',
  `deleted_reason` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Lý do xoá mềm — chỉ dùng khi có lệnh cơ quan quản lý. NULL = record đang hoạt động bình thường.',
  PRIMARY KEY (`id`),
  KEY `idx_batch_items_batch_id` (`batch_id`),
  KEY `idx_batch_items_fefo` (`product_id`,`status`,`expiry_date`),
  KEY `idx_batch_items_expiry_date` (`expiry_date`),
  KEY `idx_batch_items_location_id` (`location_id`),
  CONSTRAINT `fk_batch_items_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_batch_items_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_batch_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_batch_qty_bounds` CHECK (((`quantity_remaining` >= 0) and (`quantity_remaining` <= `quantity_received`)))
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiáº¿t lÃ´ hÃ ng â€” Ä‘Æ¡n vá»‹ FEFO, lÆ°u tá»“n kho tá»«ng lÃ´ theo HSD';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_batch_items_status_guard` BEFORE UPDATE ON `batch_items` FOR EACH ROW BEGIN
    
    IF NEW.expiry_date < CURDATE() AND NEW.status IN ('available', 'near_expiry') THEN
        SET NEW.status = 'expired';
    END IF;

    
    IF DATEDIFF(NEW.expiry_date, CURDATE()) BETWEEN 1 AND 90
       AND NEW.status = 'available' THEN
        SET NEW.status = 'near_expiry';
    END IF;

    
    IF NEW.status = 'available' AND NEW.expiry_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[D3-01] Vi phạm quy định: không thể đặt status=available cho lô thuốc đã hết hạn sử dụng. Tham chiếu: Thông tư 02/2018/TT-BYT và Thông tư 36/2018/TT-BYT.';
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_clearance_fefo_check` BEFORE UPDATE ON `batch_items` FOR EACH ROW BEGIN
    DECLARE older_count INT;
    
    IF NEW.clearance_discount_pct > 0 AND OLD.clearance_discount_pct = 0 THEN
        
        SELECT COUNT(*) INTO older_count
        FROM batch_items
        WHERE product_id             = NEW.product_id
          AND id                    != NEW.id
          AND status                IN ('available', 'near_expiry')
          AND expiry_date           < NEW.expiry_date
          AND clearance_discount_pct = 0;
        IF older_count > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '[D3-09] Vi phạm FEFO: có lô hàng cùng sản phẩm với HSD sớm hơn chưa được thanh lý. Phải ưu tiên thanh lý lô hết hạn sớm nhất trước để tuân thủ FEFO (First-Expire, First-Out).';
        END IF;
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_batch_items_no_hard_delete` BEFORE DELETE ON `batch_items` FOR EACH ROW BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = '[D1-02] batch_items KHÔNG thể DELETE vật lý. Dùng status=depleted khi hết hàng. Truy xuất nguồn gốc thuốc phải được bảo toàn theo quy định dược phẩm (tối thiểu 5 năm).';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `batches`
--

DROP TABLE IF EXISTS `batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `batches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `batch_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ phiáº¿u nháº­p, VD: PO-260305-001 (PO-YYMMDD-SEQ)',
  `supplier_id` bigint NOT NULL COMMENT 'FK â†’ suppliers.id',
  `delivery_person` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'TÃªn ngÆ°á»i giao hÃ ng (trÃ¬nh dÆ°á»£c viÃªn)',
  `received_date` date NOT NULL COMMENT 'NgÃ y nháº­n hÃ ng vÃ o kho',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Tá»•ng giÃ¡ trá»‹ phiáº¿u nháº­p = SUM(batch_items.cost_price Ã— quantity_received)',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'ÄÃ£ thanh toÃ¡n cho NCC â€” cÃ´ng ná»£ = total_amount - paid_amount',
  `status` enum('draft','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT 'draft=Ä‘ang nháº­p liá»‡u, completed=Ä‘Ã£ xÃ¡c nháº­n vÃ o kho',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chÃº phiáº¿u nháº­p',
  `created_by` bigint NOT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” ngÆ°á»i táº¡o phiáº¿u',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `invoice_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Số hoá đơn từ NCC — dùng cho đối chiếu thanh toán',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_batches_batch_code` (`batch_code`),
  KEY `idx_batches_supplier_id` (`supplier_id`),
  KEY `idx_batches_received_date` (`received_date`),
  KEY `idx_batches_status` (`status`),
  KEY `idx_batches_invoice_number` (`invoice_number`),
  CONSTRAINT `fk_batches_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiáº¿u nháº­p kho â€” má»—i láº§n mua hÃ ng tá»« nhÃ  cung cáº¥p';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `brands`
--

DROP TABLE IF EXISTS `brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `brands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn thÆ°Æ¡ng hiá»‡u: Abbott, Sanofi, DHG, Blackmores...',
  `slug` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL slug: abbott, sanofi, dhg-pharma',
  `logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL logo thÆ°Æ¡ng hiá»‡u',
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Quá»‘c gia xuáº¥t xá»©: Vietnam, France, Australia...',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=hiá»ƒn thá»‹ á»Ÿ trang chá»§ (homepage brands section)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_brands_slug` (`slug`),
  KEY `idx_brands_is_featured` (`is_featured`),
  KEY `idx_brands_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ThÆ°Æ¡ng hiá»‡u sáº£n pháº©m, dÃ¹ng filter danh má»¥c vÃ  mega menu';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `catalog_audit_logs`
--

DROP TABLE IF EXISTS `catalog_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `catalog_audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `request_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_audit_action` (`action`),
  KEY `idx_catalog_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_catalog_audit_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `catalog_gift_campaigns`
--

DROP TABLE IF EXISTS `catalog_gift_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `catalog_gift_campaigns` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `min_order_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `gift_product_id` bigint NOT NULL,
  `max_per_customer` int NOT NULL DEFAULT '1',
  `usage_count` int NOT NULL DEFAULT '0',
  `status` enum('active','paused','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_gifts_status` (`status`),
  KEY `fk_catalog_gifts_product` (`gift_product_id`),
  CONSTRAINT `fk_catalog_gifts_product` FOREIGN KEY (`gift_product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `catalog_idempotency_keys`
--

DROP TABLE IF EXISTS `catalog_idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `catalog_idempotency_keys` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `idempotency_scope` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `idempotency_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_data` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_idempotency_scope_key` (`idempotency_scope`,`idempotency_key`),
  KEY `idx_catalog_idempotency_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `catalog_loyalty_config`
--

DROP TABLE IF EXISTS `catalog_loyalty_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `catalog_loyalty_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tiers` json NOT NULL,
  `redemption` json NOT NULL,
  `channels` json NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `catalog_vouchers`
--

DROP TABLE IF EXISTS `catalog_vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `catalog_vouchers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount_type` enum('percent','fixed','freeship') COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount_value` decimal(15,2) NOT NULL,
  `max_discount` decimal(15,2) DEFAULT NULL,
  `min_order_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `usage_count` int NOT NULL DEFAULT '0',
  `usage_limit` int NOT NULL DEFAULT '0',
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `status` enum('active','paused','expired','used_up') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_vouchers_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn danh má»¥c, VD: Thuá»‘c khÃ¡ng sinh, Vitamin & TPCN',
  `slug` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL-friendly slug, VD: thuoc-khang-sinh',
  `parent_id` bigint DEFAULT NULL COMMENT 'FK â†’ categories.id â€” NULL náº¿u lÃ  danh má»¥c gá»‘c (root)',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'MÃ´ táº£ danh má»¥c',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'áº¢nh Ä‘áº¡i diá»‡n danh má»¥c',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=hiá»ƒn thá»‹, 0=áº©n',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'Thá»© tá»± sáº¯p xáº¿p hiá»ƒn thá»‹ (nhá» hÆ¡n = lÃªn trÆ°á»›c)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  KEY `idx_categories_parent_id` (`parent_id`),
  KEY `idx_categories_is_active` (`is_active`),
  KEY `idx_categories_sort_order` (`sort_order`),
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh má»¥c sáº£n pháº©m phÃ¢n cáº¥p, há»— trá»£ cÃ¢y Ä‘a táº§ng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `delivery_config`
--

DROP TABLE IF EXISTS `delivery_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `max_delivery_radius_km` decimal(5,1) NOT NULL DEFAULT '8.0' COMMENT 'BÃ¡n kÃ­nh giao hÃ ng tá»‘i Ä‘a (km)',
  `base_shipping_fee` decimal(10,2) NOT NULL DEFAULT '15000.00' COMMENT 'PhÃ­ giao hÃ ng máº·c Ä‘á»‹nh (VND)',
  `free_shipping_threshold` decimal(12,2) NOT NULL DEFAULT '500000.00' COMMENT 'GiÃ¡ trá»‹ Ä‘Æ¡n miá»…n phÃ­ giao hÃ ng',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=Ä‘ang há»— trá»£ giao hÃ ng',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cáº¥u hÃ¬nh giao hÃ ng nhÃ  thuá»‘c';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `delivery_timeslots`
--

DROP TABLE IF EXISTS `delivery_timeslots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_timeslots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Hiá»ƒn thá»‹: 09:00 - 12:00',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `slot_type` enum('standard','rushed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'standard' COMMENT 'standard=bÃ¬nh thÆ°á»ng, rushed=giao gáº¥p 30-60 phÃºt',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Khung giá» giao hÃ ng kháº£ dá»¥ng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_audits`
--

DROP TABLE IF EXISTS `inventory_audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_audits` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `audit_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ phiáº¿u kiá»ƒm kÃª: AUD-260317-001',
  `location_id` bigint DEFAULT NULL COMMENT 'FK â†’ locations.id â€” khu vá»±c Ä‘Æ°á»£c kiá»ƒm kÃª (NULL=toÃ n kho)',
  `total_items` int NOT NULL DEFAULT '0' COMMENT 'Tá»•ng sá»‘ dÃ²ng sáº£n pháº©m Ä‘Æ°á»£c kiá»ƒm',
  `total_missing` int NOT NULL DEFAULT '0' COMMENT 'Tá»•ng sá»‘ lÆ°á»£ng thiáº¿u so vá»›i há»‡ thá»‘ng',
  `total_surplus` int NOT NULL DEFAULT '0' COMMENT 'Tá»•ng sá»‘ lÆ°á»£ng thá»«a so vá»›i há»‡ thá»‘ng',
  `total_value_diff` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'ChÃªnh lá»‡ch giÃ¡ trá»‹ (Ã¢m=thiáº¿u, dÆ°Æ¡ng=thá»«a)',
  `status` enum('draft','reconciled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT 'draft=Ä‘ang nháº­p liá»‡u, reconciled=Ä‘Ã£ Ä‘á»‘i chiáº¿u vÃ  khoÃ¡',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chÃº phiáº¿u kiá»ƒm',
  `created_by` bigint NOT NULL COMMENT '(Cross-schema) mg_identity.users.id',
  `reconciled_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” ngÆ°á»i duyá»‡t Ä‘á»‘i chiáº¿u',
  `reconciled_at` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm hoÃ n táº¥t Ä‘á»‘i chiáº¿u',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_audits_code` (`audit_code`),
  KEY `idx_inventory_audits_location_id` (`location_id`),
  KEY `idx_inventory_audits_status` (`status`),
  KEY `idx_inventory_audits_created_at` (`created_at`),
  CONSTRAINT `fk_inventory_audits_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiáº¿u kiá»ƒm kÃª kho â€” Ä‘á»‘i chiáº¿u tá»“n kho há»‡ thá»‘ng vs. thá»±c táº¿';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_audit_reconcile_completeness` BEFORE UPDATE ON `inventory_audits` FOR EACH ROW BEGIN
    DECLARE null_count INT;
    IF NEW.status = 'reconciled' AND OLD.status = 'draft' THEN
        SELECT COUNT(*) INTO null_count
        FROM audit_items
        WHERE audit_id = NEW.id AND actual_quantity IS NULL;
        IF null_count > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '[D3-07] Không thể xác nhận đối chiếu: vẫn còn dòng kiểm kê chưa nhập số lượng thực đếm (actual_quantity = NULL). Điền đầy đủ trước khi đóng phiếu.';
        END IF;
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `zone` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Khu vá»±c kho: Rx Zone, OTC Zone, TPCN Zone, Kho Láº¡nh...',
  `cabinet` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tá»§ trong khu vá»±c: Tá»§ Rx-1, Tá»§ Láº¡nh A...',
  `shelf` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ká»‡/NgÄƒn trong tá»§: NgÄƒn 1, NgÄƒn 2, Táº§ng trÃªn...',
  `label` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'NhÃ£n hiá»ƒn thá»‹ Ä‘áº§y Ä‘á»§: VD "Rx Zone / Tá»§ Rx-1 / NgÄƒn 2"',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_locations_zone` (`zone`),
  KEY `idx_locations_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Vá»‹ trÃ­ lÆ°u trá»¯ váº­t lÃ½ trong kho dÆ°á»£c pháº©m';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `outbox_events`
--

DROP TABLE IF EXISTS `outbox_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `outbox_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'catalog.stock_deducted | catalog.batch_expired | catalog.low_stock_alert | catalog.stock_reserved',
  `aggregate_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'batch_item | product | stock_reservation',
  `aggregate_id` bigint NOT NULL COMMENT 'ID của entity gốc phát sinh event',
  `payload` json NOT NULL COMMENT 'Toàn bộ dữ liệu event để downstream service consume (không cần query lại)',
  `status` enum('pending','dispatched','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `retry_count` tinyint NOT NULL DEFAULT '0' COMMENT 'Số lần thử lại — tối đa 5 lần với exponential backoff',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT 'Thông báo lỗi lần thử gần nhất',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dispatched_at` datetime DEFAULT NULL COMMENT 'Thời điểm broker (RabbitMQ/Kafka) xác nhận nhận event thành công',
  PRIMARY KEY (`id`),
  KEY `idx_catalog_outbox_status` (`status`,`created_at`),
  KEY `idx_catalog_outbox_aggregate` (`aggregate_type`,`aggregate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Transactional Outbox Pattern — Catalog Service. Ghi event trong cùng local transaction với thay đổi DB, CDC/polling worker publish lên message broker. Đảm bảo at-least-once delivery.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_recalls`
--

DROP TABLE IF EXISTS `product_recalls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_recalls` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `recall_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã phiếu thu hồi: RCL-260406-001',
  `product_id` bigint NOT NULL COMMENT 'FK → products.id',
  `lot_numbers` json NOT NULL COMMENT 'JSON array []  các số lô bị thu hồi: ["LOT-001", "LOT-002"]',
  `recall_reason` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Lý do thu hồi: "Chứa tạp chất tối độc", "Hoạt chất dưới chuẩn", etc',
  `severity` enum('class_I','class_II','class_III') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mức độ: Class I=nguy hiểm cao, II=trung bình, III=thấp',
  `regulatory_reference` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tham chiếu pháp luật: Công văn 12345/QLD-CL, Thông tư 02/2018/TT-BYT, etc',
  `recalled_by` bigint NOT NULL COMMENT '(Cross-schema) mg_identity.users.id — người tạo phiếu thu hồi',
  `recall_date` date NOT NULL COMMENT 'Ngày phát hiện/công bố thu hồi',
  `status` enum('active','resolved') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'active=đang thu hồi, resolved=đã hoàn thành',
  `resolved_at` datetime DEFAULT NULL COMMENT 'Ngày hoàn thành thu hồi',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recalls_code` (`recall_code`),
  KEY `idx_recalls_product_id` (`product_id`),
  KEY `idx_recalls_status` (`status`),
  KEY `idx_recalls_recall_date` (`recall_date`),
  CONSTRAINT `fk_recalls_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Module thu hồi thuốc — Cục Quản lý Dược công bố định kỳ, dùng để đánh dấu lô hàng, chặn bán, xuất báo cáo';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_specifications`
--

DROP TABLE IF EXISTS `product_specifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_specifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL COMMENT 'FK â†’ products.id',
  `spec_key` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn thÃ´ng sá»‘: ThÃ nh pháº§n, Quy cÃ¡ch, Báº£o quáº£n, Chá»‰ Ä‘á»‹nh...',
  `spec_value` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'GiÃ¡ trá»‹ thÃ´ng sá»‘',
  `sort_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_product_specifications_product_id` (`product_id`),
  CONSTRAINT `fk_product_specs_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ThÃ´ng sá»‘ ká»¹ thuáº­t chi tiáº¿t sáº£n pháº©m (tab ThÃ´ng tin thÃªm)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_units`
--

DROP TABLE IF EXISTS `product_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_units` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL COMMENT 'FK â†’ products.id',
  `unit_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn Ä‘Æ¡n vá»‹ lá»›n: Vá»‰, Há»™p, Lá»‘c, ThÃ¹ng...',
  `conversion_qty` int NOT NULL COMMENT 'Sá»‘ lÆ°á»£ng base_unit trong 1 Ä‘Æ¡n vá»‹ nÃ y, VD: 10 (ViÃªn/Vá»‰)',
  `of_unit` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ÄÆ¡n vá»‹ bÃªn dÆ°á»›i trong chuá»—i quy Ä‘á»•i, VD: "ViÃªn" hoáº·c "Vá»‰"',
  `retail_price` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'GiÃ¡ bÃ¡n láº» khi bÃ¡n theo Ä‘Æ¡n vá»‹ nÃ y (thÆ°á»ng = conversion_qty Ã— retail_price)',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'Thá»© tá»± sáº¯p xáº¿p (0=nhá» nháº¥t, tÄƒng dáº§n)',
  `barcode` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MÃ£ váº¡ch riÃªng cho Ä‘Æ¡n vá»‹ bÃ¡n nÃ y náº¿u cÃ³',
  PRIMARY KEY (`id`),
  KEY `idx_product_units_product_id` (`product_id`),
  KEY `idx_product_units_barcode` (`barcode`),
  CONSTRAINT `fk_product_units_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ÄÆ¡n vá»‹ Ä‘Ã³ng gÃ³i vÃ  quy Ä‘á»•i cá»§a sáº£n pháº©m';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `sku` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ hÃ ng ná»™i bá»™, auto-generated: MED-0001, SUP-0023',
  `name` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn Ä‘áº§y Ä‘á»§: VD "Panadol Extra Há»™p 12 viÃªn"',
  `strength` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Hàm lượng/nồng độ thuốc, VD: 500mg, 10ml, 20mg/ml',
  `route_of_administration` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Đường dùng theo hồ sơ thuốc',
  `category_id` bigint NOT NULL COMMENT 'FK â†’ categories.id',
  `active_ingredient` text COLLATE utf8mb4_unicode_ci,
  `registration_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sá»‘ Ä‘Äƒng kÃ½ dÆ°á»£c â€” SÄK do Bá»™ Y táº¿ cáº¥p',
  `manufacturer` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NhÃ  sáº£n xuáº¥t, VD: GlaxoSmithKline, DHG Pharma',
  `requires_prescription` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=thuá»‘c kÃª Ä‘Æ¡n (Rx), 0=thuá»‘c OTC',
  `special_control_group` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nhóm thuốc quản lý đặc biệt theo nghiệp vụ nhà thuốc GPP',
  `storage_condition` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Điều kiện thường' COMMENT 'Điều kiện bảo quản chuẩn áp dụng cho thuốc',
  `base_unit` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ÄÆ¡n vá»‹ cÆ¡ báº£n nhá» nháº¥t: ViÃªn, GÃ³i, TuÃ½p, Chai...',
  `cost_price` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'GiÃ¡ nháº­p trÃªn 1 base_unit (tham kháº£o, giÃ¡ thá»±c trong batch_items)',
  `retail_price` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'GiÃ¡ bÃ¡n láº» máº·c Ä‘á»‹nh trÃªn 1 base_unit',
  `min_stock_alert` int NOT NULL DEFAULT '10' COMMENT 'Tá»“n kho tá»‘i thiá»ƒu â€” khi dÆ°á»›i ngÆ°á»¡ng sáº½ gá»­i cáº£nh bÃ¡o',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL áº£nh sáº£n pháº©m',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'MÃ´ táº£ chi tiáº¿t, cÃ´ng dá»¥ng, cÃ¡ch dÃ¹ng, tÃ¡c dá»¥ng phá»¥',
  `status` enum('draft','pending_review','active','inactive','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT 'draft=đang nhập, pending_review=chờ duyệt, active=đang kinh doanh, inactive=ngừng kinh doanh, rejected=từ chối',
  `barcode` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MÃ£ váº¡ch EAN-13 hoáº·c mÃ£ ná»™i bá»™, dÃ¹ng quÃ©t POS',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `brand_id` int DEFAULT NULL COMMENT 'FK â†’ brands.id',
  `tags` json DEFAULT NULL COMMENT 'JSON array tags: ["flash-sale","deal-khung","trending","exclusive"]',
  `country_of_origin` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Xuáº¥t xá»© sáº£n pháº©m: Vietnam, France, USA, Australia...',
  `is_exclusive` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=sáº£n pháº©m Ä‘á»™c quyá»n nhÃ  thuá»‘c Minh Giang',
  `sales_volume` int NOT NULL DEFAULT '0' COMMENT 'Tá»•ng sá»‘ lÆ°á»£ng Ä‘Ã£ bÃ¡n (dÃ¹ng sort=sales_volume_desc)',
  `gallery` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_sku` (`sku`),
  UNIQUE KEY `uq_products_barcode` (`barcode`),
  KEY `idx_products_category_id` (`category_id`),
  KEY `idx_products_status` (`status`),
  KEY `idx_products_requires_prescription` (`requires_prescription`),
  KEY `idx_products_route` (`route_of_administration`),
  KEY `idx_products_special_control_group` (`special_control_group`),
  KEY `idx_products_storage_condition` (`storage_condition`),
  KEY `idx_products_name` (`name`),
  KEY `idx_products_brand_id` (`brand_id`),
  KEY `idx_products_is_exclusive` (`is_exclusive`),
  KEY `idx_products_cat_status` (`category_id`,`status`),
  KEY `idx_products_brand_status` (`brand_id`,`status`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1537 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Há»“ sÆ¡ thuá»‘c master data â€” danh má»¥c sáº£n pháº©m kinh doanh';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_images`
--

DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_images` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL COMMENT 'FK → products.id',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên file lưu trong storage nội bộ',
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tên file gốc từ máy người dùng',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'image/jpeg, image/png, image/webp...',
  `file_size` bigint NOT NULL COMMENT 'Dung lượng byte',
  `storage_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Đường dẫn vật lý/tương đối trong storage',
  `public_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL public để frontend hiển thị ảnh',
  `image_role` enum('main','gallery','packaging','label','certificate') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'gallery' COMMENT 'Vai trò ảnh: chính, phụ, bao bì, nhãn, giấy tờ',
  `alt_text` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Alt text hỗ trợ accessibility/SEO',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=ảnh đại diện chính của sản phẩm',
  `sort_order` int NOT NULL DEFAULT '0',
  `uploaded_by` bigint DEFAULT NULL COMMENT 'identity.users.id nếu đi qua gateway',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_images_product_id` (`product_id`),
  KEY `idx_product_images_primary` (`product_id`,`is_primary`),
  KEY `idx_product_images_role` (`product_id`,`image_role`),
  CONSTRAINT `fk_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ảnh sản phẩm catalog: 1 ảnh chính và nhiều ảnh phụ/bao bì/nhãn';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_reviews`
--

DROP TABLE IF EXISTS `product_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_reviews` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT NOT NULL COMMENT 'FK -> products.id',
  `customer_id` BIGINT NOT NULL COMMENT 'mg_identity.customers.id - tai khoan khach hang danh gia',
  `order_id` BIGINT DEFAULT NULL COMMENT 'mg_order.orders.id - don hang xac minh da mua',
  `order_item_id` BIGINT DEFAULT NULL COMMENT 'mg_order.order_items.id - dong san pham da mua',
  `rating` TINYINT NOT NULL COMMENT 'Diem 1-5 sao',
  `title` VARCHAR(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comment` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` ENUM('pending','approved','rejected','hidden') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `is_verified_purchase` TINYINT(1) NOT NULL DEFAULT 0,
  `moderation_note` VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approved_at` DATETIME DEFAULT NULL,
  `approved_by` BIGINT DEFAULT NULL COMMENT 'mg_identity.users.id - nhan su duyet',
  `hidden_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_reviews_customer_product` (`product_id`, `customer_id`),
  KEY `idx_product_reviews_product_status` (`product_id`, `status`, `created_at`),
  KEY `idx_product_reviews_customer` (`customer_id`),
  KEY `idx_product_reviews_status` (`status`, `created_at`),
  KEY `idx_product_reviews_rating` (`rating`),
  CONSTRAINT `fk_product_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_product_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh gia san pham co xac minh mua hang va kiem duyet noi dung nha thuoc';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_tag_promotions`
--

DROP TABLE IF EXISTS `product_tag_promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_tag_promotions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL COMMENT 'Liên kết sản phẩm products.id',
  `tag_name` enum('flash-sale', 'deal', 'discount') NOT NULL COMMENT 'Loại tag khuyến mãi',
  `discount_type` enum('percentage', 'fixed_price') NOT NULL DEFAULT 'percentage' COMMENT 'percentage: giảm theo %, fixed_price: giá bán khuyến mãi cố định',
  `discount_value` decimal(15, 2) NOT NULL DEFAULT '0.00' COMMENT 'Giá trị giảm (% hoặc giá bán cố định bằng VND)',
  `campaign_qty` int DEFAULT NULL COMMENT 'Tổng số lượng mở bán khuyến mãi (NULL = không giới hạn)',
  `sold_qty` int NOT NULL DEFAULT '0' COMMENT 'Số lượng đã bán lẻ thực tế trong campaign',
  `max_per_customer` int DEFAULT NULL COMMENT 'Giới hạn mua tối đa của một khách hàng (NULL = không giới hạn)',
  `start_time` datetime NOT NULL COMMENT 'Thời gian bắt đầu campaign',
  `end_time` datetime NOT NULL COMMENT 'Thời gian kết thúc campaign',
  `status` enum('active', 'inactive', 'paused') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái hoạt động của campaign',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_tag_active_promo` (`product_id`, `tag_name`, `status`),
  CONSTRAINT `fk_tag_promotions_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết cấu hình khuyến mãi theo tag sản phẩm';
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `movement_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ phiáº¿u: PO-xxx (nháº­p), OUT-xxx (xuáº¥t)',
  `batch_item_id` bigint NOT NULL COMMENT 'FK â†’ batch_items.id â€” lÃ´ hÃ ng bá»‹ áº£nh hÆ°á»Ÿng',
  `product_id` bigint NOT NULL COMMENT 'FK â†’ products.id â€” denormalize Ä‘á»ƒ query nhanh',
  `movement_type` enum('inbound','outbound_sale','outbound_return_supplier','outbound_damage','outbound_expiry','adjustment') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Loáº¡i giao dá»‹ch kho',
  `quantity` int NOT NULL COMMENT 'Sá»‘ lÆ°á»£ng thay Ä‘á»•i: dÆ°Æ¡ng (+) lÃ  nháº­p, Ã¢m (-) lÃ  xuáº¥t',
  `reference_type` enum('purchase_order','pos_order','web_order','return','adjustment') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Loáº¡i chá»©ng tá»« tham chiáº¿u',
  `reference_id` bigint DEFAULT NULL COMMENT 'ID cá»§a chá»©ng tá»« tham chiáº¿u (Ä‘Æ¡n hÃ ng, phiáº¿u nháº­p...)',
  `reason` text COLLATE utf8mb4_unicode_ci COMMENT 'LÃ½ do giao dá»‹ch, báº¯t buá»™c vá»›i loáº¡i damage/expiry',
  `created_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” ngÆ°á»i thá»±c hiá»‡n',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_movements_batch_item_id` (`batch_item_id`),
  KEY `idx_stock_movements_product_id` (`product_id`),
  KEY `idx_stock_movements_movement_type` (`movement_type`),
  KEY `idx_stock_movements_reference` (`reference_type`,`reference_id`),
  KEY `idx_stock_movements_created_at` (`created_at`),
  KEY `idx_stock_movements_created_by` (`created_by`),
  KEY `idx_stock_movements_created_by_date` (`created_by`,`created_at`),
  CONSTRAINT `fk_stock_movements_batch_item` FOREIGN KEY (`batch_item_id`) REFERENCES `batch_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit log toÃ n bá»™ biáº¿n Ä‘á»™ng kho: nháº­p, xuáº¥t, huá»·...';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_stock_movements_immutable_upd` BEFORE UPDATE ON `stock_movements` FOR EACH ROW BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = '[D4-05] stock_movements là audit log bất biến — UPDATE không được phép. Nếu cần điều chỉnh, hãy tạo record mới với movement_type phù hợp (ví dụ: adjustment). Log dược phẩm phải được bảo toàn ít nhất 5 năm.';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_stock_movements_immutable_del` BEFORE DELETE ON `stock_movements` FOR EACH ROW BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = '[D4-05] stock_movements là audit log bất biến — DELETE không được phép. Đây là hồ sơ biến động kho theo quy định dược phẩm.';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `stock_reservations`
--

DROP TABLE IF EXISTS `stock_reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_reservations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `batch_item_id` bigint NOT NULL COMMENT 'FK → batch_items.id — lô hàng được dự trữ',
  `product_id` bigint NOT NULL COMMENT 'Denormalized FK → products.id — query nhanh không cần JOIN',
  `quantity` int NOT NULL COMMENT 'Số lượng đang dự trữ (base_unit)',
  `source_type` enum('pos_hold','web_checkout','pos_checkout') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'pos_hold=đơn giữ POS, web_checkout=giỏ hàng Web, pos_checkout=thanh toán POS đang xử lý',
  `source_id` bigint NOT NULL COMMENT 'ID của pos_held_orders.id, carts.id, hoặc order đang tạo',
  `reserved_by` bigint DEFAULT NULL COMMENT '(Cross-schema) users.id hoặc customers.id — ai tạo reservation',
  `reserved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL COMMENT 'TTL bắt buộc — sau mốc này reservation tự động vô hiệu lực; giá trị khuyến nghị: POS Hold=30 phút, Web Checkout=15 phút',
  `released_at` datetime DEFAULT NULL COMMENT 'NULL=đang dự trữ, non-NULL=đã giải phóng (thanh toán thành công hoặc huỷ)',
  `release_reason` enum('completed','cancelled','expired') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Lý do giải phóng reservation',
  PRIMARY KEY (`id`),
  KEY `idx_reservations_batch` (`batch_item_id`,`released_at`),
  KEY `idx_reservations_product` (`product_id`,`released_at`),
  KEY `idx_reservations_source` (`source_type`,`source_id`),
  KEY `idx_reservations_expires` (`expires_at`),
  KEY `idx_reservations_active_expiry` (`batch_item_id`,`released_at`,`expires_at`,`quantity`),
  CONSTRAINT `fk_reservations_batch` FOREIGN KEY (`batch_item_id`) REFERENCES `batch_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reservations_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_reservation_qty_positive` CHECK ((`quantity` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Dự trữ tồn kho tạm thời — ngăn overselling khi POS Hold & Web Checkout xảy ra đồng thời. Công thức: stock_available = quantity_remaining - SUM(active reservations chưa hết hạn)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `storage_cabinets`
--

DROP TABLE IF EXISTS `storage_cabinets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `storage_cabinets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zone_id` int NOT NULL COMMENT 'FK â†’ storage_zones.id',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ tá»§: RX-1, OTC-1, COLD-A',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn tá»§: Tá»§ Rx-1, Tá»§ Láº¡nh A',
  `shelf_count` int NOT NULL DEFAULT '0' COMMENT 'Sá»‘ ká»‡/ngÄƒn trong tá»§',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_storage_cabinets_code` (`code`),
  KEY `idx_storage_cabinets_zone_id` (`zone_id`),
  CONSTRAINT `fk_storage_cabinets_zone` FOREIGN KEY (`zone_id`) REFERENCES `storage_zones` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tá»§ thuá»‘c táº§ng 2 (Cabinet) trong má»—i khu vá»±c';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `storage_shelves`
--

DROP TABLE IF EXISTS `storage_shelves`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `storage_shelves` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cabinet_id` int NOT NULL COMMENT 'FK â†’ storage_cabinets.id',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn ká»‡: NgÄƒn 1, Táº§ng trÃªn, Táº§ng giá»¯a',
  `location_id` bigint DEFAULT NULL COMMENT 'FK â†’ locations.id â€” Ã¡nh xáº¡ 1-1 vá»›i báº£ng locations cÅ©',
  `product_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Loáº¡i thuá»‘c Æ°u tiÃªn Ä‘áº·t á»Ÿ ká»‡ nÃ y: Rx, OTC, TPCN...',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_storage_shelves_cabinet_id` (`cabinet_id`),
  KEY `idx_storage_shelves_location_id` (`location_id`),
  CONSTRAINT `fk_storage_shelves_cabinet` FOREIGN KEY (`cabinet_id`) REFERENCES `storage_cabinets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_storage_shelves_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ká»‡/NgÄƒn táº§ng 3 (Shelf) trong tá»§ â€” Ã¡nh xáº¡ sang báº£ng locations cÅ©';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `storage_zones`
--

DROP TABLE IF EXISTS `storage_zones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `storage_zones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ khu vá»±c: RX, OTC, TPCN, COLD',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn khu vá»±c: Rx Zone, OTC Zone...',
  `description` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MÃ´ táº£: Khu thuá»‘c kÃª Ä‘Æ¡n, yÃªu cáº§u kiá»ƒm soÃ¡t nhiá»‡t Ä‘á»™...',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_storage_zones_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Khu vá»±c kho táº§ng 1 (Zone)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ NCC, VD: SUP-001, SUP-002',
  `name` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn cÃ´ng ty nhÃ  cung cáº¥p',
  `contact_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'TÃªn ngÆ°á»i liÃªn há»‡ (trÃ¬nh dÆ°á»£c viÃªn)',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sá»‘ Ä‘iá»‡n thoáº¡i liÃªn há»‡',
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Email liÃªn há»‡',
  `address` text COLLATE utf8mb4_unicode_ci COMMENT 'Äá»‹a chá»‰ cÃ´ng ty nhÃ  cung cáº¥p',
  `tax_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MÃ£ sá»‘ thuáº¿ doanh nghiá»‡p',
  `total_purchase_value` decimal(20,2) NOT NULL DEFAULT '0.00' COMMENT 'Tá»•ng giÃ¡ trá»‹ Ä‘Ã£ nháº­p hÃ ng tá»« NCC (cá»™ng dá»“n)',
  `current_debt` decimal(20,2) NOT NULL DEFAULT '0.00' COMMENT 'CÃ´ng ná»£ hiá»‡n táº¡i = SUM(total_amount - paid_amount) cá»§a cÃ¡c phiáº¿u nháº­p',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'Tráº¡ng thÃ¡i há»£p tÃ¡c vá»›i NCC',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suppliers_code` (`code`),
  KEY `idx_suppliers_status` (`status`),
  KEY `idx_suppliers_current_debt` (`current_debt`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='NhÃ  cung cáº¥p thuá»‘c vÃ  thiáº¿t bá»‹ y táº¿, quáº£n lÃ½ cÃ´ng ná»£ pháº£i tráº£';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `v_supplier_debt`
--

DROP TABLE IF EXISTS `v_supplier_debt`;
/*!50001 DROP VIEW IF EXISTS `v_supplier_debt`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_supplier_debt` AS SELECT 
 1 AS `supplier_id`,
 1 AS `supplier_code`,
 1 AS `supplier_name`,
 1 AS `computed_current_debt`,
 1 AS `stored_current_debt`,
 1 AS `computed_total_purchase`,
 1 AS `stored_total_purchase`,
 1 AS `debt_drift_amount`,
 1 AS `debt_status`*/;
SET character_set_client = @saved_cs_client;

--
-- Dumping routines for database 'mg_catalog'
--

--
-- Current Database: `mg_catalog`
--

USE `mg_catalog`;

--
-- Final view structure for view `v_supplier_debt`
--

/*!50001 DROP VIEW IF EXISTS `v_supplier_debt`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_supplier_debt` AS select `s`.`id` AS `supplier_id`,`s`.`code` AS `supplier_code`,`s`.`name` AS `supplier_name`,coalesce(sum((`b`.`total_amount` - `b`.`paid_amount`)),0) AS `computed_current_debt`,`s`.`current_debt` AS `stored_current_debt`,coalesce(sum(`b`.`total_amount`),0) AS `computed_total_purchase`,`s`.`total_purchase_value` AS `stored_total_purchase`,abs((`s`.`current_debt` - coalesce(sum((`b`.`total_amount` - `b`.`paid_amount`)),0))) AS `debt_drift_amount`,(case when (abs((`s`.`current_debt` - coalesce(sum((`b`.`total_amount` - `b`.`paid_amount`)),0))) > 1000) then '⚠️ DRIFT_DETECTED — Cần đồng bộ lại' when (abs((`s`.`current_debt` - coalesce(sum((`b`.`total_amount` - `b`.`paid_amount`)),0))) > 0) then '⚠️ MINOR_DRIFT' else '✅ OK' end) AS `debt_status` from (`suppliers` `s` left join `batches` `b` on(((`b`.`supplier_id` = `s`.`id`) and (`b`.`status` = 'completed')))) group by `s`.`id`,`s`.`code`,`s`.`name`,`s`.`current_debt`,`s`.`total_purchase_value` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-21 18:23:35
