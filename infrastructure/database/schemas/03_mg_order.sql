-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: mg_order
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
-- Current Database: `mg_order`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `mg_order` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `mg_order`;

--
-- Table structure for table `cart_items`
--

DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cart_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `product_name` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Sản phẩm mới' COMMENT 'Product snapshot name',
  `product_sku` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT '' COMMENT 'Product snapshot SKU',
  `thumbnail` text COLLATE utf8mb4_unicode_ci COMMENT 'Product snapshot image URL',
  `unit_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price` decimal(12,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart_items_cart_product_unit` (`cart_id`,`product_id`,`unit_name`),
  KEY `idx_cart_items_cart_id` (`cart_id`),
  KEY `idx_cart_items_product_id` (`product_id`),
  CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cart_items`
--

LOCK TABLES `cart_items` WRITE;
/*!40000 ALTER TABLE `cart_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `carts`
--

DROP TABLE IF EXISTS `carts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint DEFAULT NULL,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_carts_customer_id` (`customer_id`),
  KEY `idx_carts_session_id` (`session_id`),
  KEY `idx_carts_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `carts`
--

LOCK TABLES `carts` WRITE;
/*!40000 ALTER TABLE `carts` DISABLE KEYS */;
/*!40000 ALTER TABLE `carts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_internal_notes`
--

DROP TABLE IF EXISTS `order_internal_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_internal_notes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_notes_order` (`order_id`),
  CONSTRAINT `fk_order_notes_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_internal_notes`
--

LOCK TABLES `order_internal_notes` WRITE;
/*!40000 ALTER TABLE `order_internal_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_internal_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `product_name` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  `batch_item_id` bigint DEFAULT NULL,
  `lot_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prescription_id` bigint DEFAULT NULL COMMENT 'BẮT BUỘC cho thuốc Rx',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_id` (`order_id`),
  KEY `idx_order_items_product_id` (`product_id`),
  KEY `idx_order_items_batch_item_id` (`batch_item_id`),
  KEY `idx_order_items_prescription` (`prescription_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_prescription` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET @saved_sql_mode       = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_rx_dispensing_check` BEFORE INSERT ON `order_items` FOR EACH ROW BEGIN
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
/*!50003 SET @saved_sql_mode       = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_rx_dispensing_update` AFTER INSERT ON `order_items` FOR EACH ROW BEGIN
    IF NEW.prescription_id IS NOT NULL THEN
        UPDATE prescriptions SET dispensed_qty = dispensed_qty + NEW.quantity WHERE id = NEW.prescription_id;
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `order_promotions`
--

DROP TABLE IF EXISTS `order_promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_promotions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `promotion_id` bigint NOT NULL,
  `promo_code_snapshot` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `promo_name_snapshot` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `promo_type_snapshot` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount_value_snapshot` decimal(10,2) NOT NULL,
  `discount_applied` decimal(12,2) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_promotions_order` (`order_id`),
  CONSTRAINT `fk_order_promotions_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_discount_applied_non_negative` CHECK ((`discount_applied` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_promotions`
--

LOCK TABLES `order_promotions` WRITE;
/*!40000 ALTER TABLE `order_promotions` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_channel` enum('web','pos') COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint DEFAULT NULL,
  `customer_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shipping_address` text COLLATE utf8mb4_unicode_ci,
  `staff_id` bigint DEFAULT NULL,
  `kiosk_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shift_id` bigint DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL,
  `shipping_fee` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL,
  `payment_method` enum('cash','cod','vnpay','momo','card_visa','qr_transfer') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_status` enum('pending','paid','failed','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `order_status` enum('pending_approval','confirmed','picking','shipping','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending_approval',
  `requires_vat_invoice` tinyint(1) NOT NULL DEFAULT '0',
  `customer_notes` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_order_code` (`order_code`),
  KEY `idx_orders_order_channel` (`order_channel`),
  KEY `idx_orders_customer_id` (`customer_id`),
  KEY `idx_orders_staff_id` (`staff_id`),
  KEY `idx_orders_shift_id` (`shift_id`),
  KEY `idx_orders_order_status` (`order_status`),
  KEY `idx_orders_payment_status` (`payment_status`),
  KEY `idx_orders_created_at` (`created_at`),
  KEY `idx_orders_active` (`is_active`),
  CONSTRAINT `chk_order_discount_bounds` CHECK (((`discount_amount` >= 0) and (`discount_amount` <= (`subtotal` + `shipping_fee`)))),
  CONSTRAINT `chk_order_shipping_non_negative` CHECK ((`shipping_fee` >= 0)),
  CONSTRAINT `chk_order_subtotal_positive` CHECK ((`subtotal` > 0)),
  CONSTRAINT `chk_order_total_non_negative` CHECK ((`total_amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `outbox_events`
--

DROP TABLE IF EXISTS `outbox_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `outbox_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aggregate_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aggregate_id` bigint NOT NULL,
  `payload` json NOT NULL,
  `status` enum('pending','dispatched','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `retry_count` tinyint NOT NULL DEFAULT '0',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dispatched_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_outbox_status` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `outbox_events`
--

LOCK TABLES `outbox_events` WRITE;
/*!40000 ALTER TABLE `outbox_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `outbox_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pos_held_order_items`
--

DROP TABLE IF EXISTS `pos_held_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_held_order_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `hold_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `product_name` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `current_unit_price` decimal(12,2) DEFAULT NULL,
  `price_discrepancy` decimal(12,2) DEFAULT NULL,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(12,2) NOT NULL,
  `note` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_held_items_hold_id` (`hold_id`),
  CONSTRAINT `fk_held_items_hold` FOREIGN KEY (`hold_id`) REFERENCES `pos_held_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pos_held_order_items`
--

LOCK TABLES `pos_held_order_items` WRITE;
/*!40000 ALTER TABLE `pos_held_order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `pos_held_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pos_held_orders`
--

DROP TABLE IF EXISTS `pos_held_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_held_orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `hold_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `staff_id` bigint NOT NULL,
  `shift_id` bigint DEFAULT NULL,
  `customer_id` bigint DEFAULT NULL,
  `customer_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `held_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `auto_release_at` datetime DEFAULT NULL,
  `is_released` tinyint(1) NOT NULL DEFAULT '0',
  `released_at` datetime DEFAULT NULL,
  `released_note` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_held_orders_code` (`hold_code`),
  KEY `idx_held_orders_staff_id` (`staff_id`),
  KEY `idx_held_orders_shift_id` (`shift_id`),
  KEY `idx_held_orders_released` (`is_released`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pos_held_orders`
--

LOCK TABLES `pos_held_orders` WRITE;
/*!40000 ALTER TABLE `pos_held_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `pos_held_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prescriptions`
--

DROP TABLE IF EXISTS `prescriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prescriptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `prescription_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` bigint DEFAULT NULL,
  `customer_id` bigint NOT NULL,
  `patient_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_dob` date DEFAULT NULL,
  `patient_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doctor_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `doctor_license` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hospital_name` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issue_date` date NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_sha256` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Hash toàn vẹn ảnh',
  `verified_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_dispensing_qty` int DEFAULT NULL COMMENT 'Giới hạn số lượng phát',
  `dispensed_qty` int NOT NULL DEFAULT '0',
  `diagnosis_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `diagnosis_text` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','verified','rejected','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `verified_by` bigint DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prescriptions_code` (`prescription_code`),
  UNIQUE KEY `uq_prescriptions_image_hash` (`image_sha256`),
  KEY `idx_prescriptions_order_id` (`order_id`),
  KEY `idx_prescriptions_customer_id` (`customer_id`),
  KEY `idx_prescriptions_status` (`status`),
  CONSTRAINT `fk_prescriptions_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prescriptions`
--

LOCK TABLES `prescriptions` WRITE;
/*!40000 ALTER TABLE `prescriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `prescriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `return_items`
--

DROP TABLE IF EXISTS `return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `return_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `return_id` bigint NOT NULL,
  `order_item_id` bigint NOT NULL,
  `quantity_returned` int NOT NULL,
  `return_to_stock` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_return_items_return_id` (`return_id`),
  KEY `idx_return_items_order_item_id` (`order_item_id`),
  CONSTRAINT `fk_return_items_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_return_items_return` FOREIGN KEY (`return_id`) REFERENCES `returns` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `return_items`
--

LOCK TABLES `return_items` WRITE;
/*!40000 ALTER TABLE `return_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `return_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `returns`
--

DROP TABLE IF EXISTS `returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `returns` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `return_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` bigint NOT NULL,
  `order_channel` enum('web','pos','supplier') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `refund_amount` decimal(15,2) NOT NULL,
  `refund_method` enum('cash','original_payment','store_credit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','approved','rejected','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `handled_by` bigint DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_returns_return_code` (`return_code`),
  KEY `idx_returns_order_id` (`order_id`),
  KEY `idx_returns_status` (`status`),
  KEY `idx_returns_active` (`is_active`),
  CONSTRAINT `fk_returns_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `returns`
--

LOCK TABLES `returns` WRITE;
/*!40000 ALTER TABLE `returns` DISABLE KEYS */;
/*!40000 ALTER TABLE `returns` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-21 18:23:44
