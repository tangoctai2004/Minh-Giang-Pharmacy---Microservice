-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: mg_identity
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
-- Current Database: `mg_identity`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `mg_identity` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `mg_identity`;

--
-- Table structure for table `customer_addresses`
--

DROP TABLE IF EXISTS `customer_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_addresses` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT 'FK â†’ customers.id',
  `receiver_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn ngÆ°á»i nháº­n hÃ ng',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SÄT ngÆ°á»i nháº­n',
  `province` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tá»‰nh/ThÃ nh phá»‘',
  `district` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Quáº­n/Huyá»‡n',
  `ward` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'PhÆ°á»ng/XÃ£',
  `street_address` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Sá»‘ nhÃ , tÃªn Ä‘Æ°á»ng, tÃ²a nhÃ ...',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=Ä‘á»‹a chá»‰ máº·c Ä‘á»‹nh cá»§a khÃ¡ch',
  PRIMARY KEY (`id`),
  KEY `idx_customer_addresses_customer_id` (`customer_id`),
  KEY `idx_customer_addresses_is_default` (`customer_id`,`is_default`),
  CONSTRAINT `fk_customer_addresses_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh sÃ¡ch Ä‘á»‹a chá»‰ giao hÃ ng cá»§a khÃ¡ch hÃ ng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_addresses`
--

LOCK TABLES `customer_addresses` WRITE;
/*!40000 ALTER TABLE `customer_addresses` DISABLE KEYS */;
INSERT INTO `customer_addresses` VALUES (1,1,'Nguyá»…n Thá»‹ Mai','0901111222','TP. Há»“ ChÃ­ Minh','Quáº­n 1','PhÆ°á»ng Báº¿n NghÃ©','12 Nguyá»…n Huá»‡',1),(2,1,'Nguyá»…n Thá»‹ Mai','0901111222','TP. Há»“ ChÃ­ Minh','Quáº­n 7','PhÆ°á»ng TÃ¢n PhÃº','89/3 Nguyá»…n Thá»‹ Tháº­p',0),(3,2,'Tráº§n VÄƒn HÃ¹ng','0912222333','TP. Há»“ ChÃ­ Minh','Quáº­n BÃ¬nh Tháº¡nh','PhÆ°á»ng 12','45 XÃ´ Viáº¿t Nghá»‡ TÄ©nh',1),(4,3,'LÃª Thá»‹ Thu HÆ°Æ¡ng','0923333444','TP. Há»“ ChÃ­ Minh','Quáº­n 10','PhÆ°á»ng 11','234 Ba ThÃ¡ng Hai',1),(5,4,'Pháº¡m CÃ´ng Danh','0934444555','TP. Há»“ ChÃ­ Minh','Quáº­n GÃ² Váº¥p','PhÆ°á»ng 12','67 Nguyá»…n VÄƒn Nghi',1),(6,5,'HoÃ ng Thá»‹ BÃ­ch Ngá»c','0945555666','TP. Há»“ ChÃ­ Minh','Quáº­n 3','PhÆ°á»ng 6','15A VÃµ Thá»‹ SÃ¡u',1),(10,9,'Tạ Ngọc Tài','0959259650','Hòa Bình','Thành phố Hòa Bình','Phường Hòa Bình','918, Tổ 7, Thái Bình',0),(11,11,'Test','0999887766','Hòa Bình','TP Hòa Bình','Phường Phương Lâm','123 Cù Chính Lan',0);
/*!40000 ALTER TABLE `customer_addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `full_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Há» vÃ  tÃªn khÃ¡ch hÃ ng',
  `email` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Email Ä‘Äƒng kÃ½ tÃ i khoáº£n',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Sá»‘ Ä‘iá»‡n thoáº¡i (dÃ¹ng Ä‘Äƒng nháº­p & liÃªn há»‡)',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bcrypt hash cá»§a máº­t kháº©u',
  `date_of_birth` date DEFAULT NULL COMMENT 'NgÃ y sinh (dÃ¹ng tÃ­nh tuá»•i vÃ  sinh nháº­t)',
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Giá»›i tÃ­nh',
  `loyalty_points` int NOT NULL DEFAULT '0' COMMENT 'Äiá»ƒm tÃ­ch luá»¹ (10.000Ä‘ = 1 Ä‘iá»ƒm)',
  `loyalty_tier` enum('member','silver','gold','vip') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member' COMMENT 'Háº¡ng thÃ nh viÃªn: member(0-499Ä‘), silver(500-1999Ä‘), gold(2000-4999Ä‘), vip(5000+Ä‘)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=hoáº¡t Ä‘á»™ng, 0=Ä‘Ã£ khoÃ¡',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete — NULL=đang hoạt động, non-NULL=đã xoá mềm (tuân thủ Nghị định 13/2023/NĐ-CP bảo vệ DLCN)',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã khách hàng tự sinh: KH-0001, KH-0002, ... (dùng CRM, print bill)',
  `zalo_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Zalo OAuth user ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_email` (`email`),
  UNIQUE KEY `uq_customers_phone` (`phone`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_customers_zalo_id` (`zalo_id`),
  KEY `idx_customers_loyalty_tier` (`loyalty_tier`),
  KEY `idx_customers_is_active` (`is_active`),
  KEY `idx_customers_deleted_at` (`deleted_at`),
  KEY `idx_customers_code` (`code`),
  CONSTRAINT `chk_loyalty_points_non_negative` CHECK ((`loyalty_points` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TÃ i khoáº£n khÃ¡ch hÃ ng web vÃ  chÆ°Æ¡ng trÃ¬nh khÃ¡ch hÃ ng thÃ¢n thiáº¿t';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'Nguyá»…n Thá»‹ Mai','mai.nguyen@gmail.com','0901111222','$2a$10$qeLbnjEpBI0enZt6UprO1Os/Hnz04kWQvVrQlK..iO.gOyGRXY3/W','1990-05-15','female',1250,'silver',1,'2026-03-31 18:42:51','2026-04-10 11:40:19',NULL,'KH-0001',NULL),(2,'Trần Văn Hùng','hung.tran@gmail.com','0912222333','$2a$10$qeLbnjEpBI0enZt6UprO1Os/Hnz04kWQvVrQlK..iO.gOyGRXY3/W','1985-08-22','male',3800,'gold',1,'2026-03-31 18:42:51','2026-04-12 05:22:45',NULL,'KH-0002',NULL),(3,'LÃª Thá»‹ Thu HÆ°Æ¡ng','thuhuong.le@gmail.com','0923333444','$2a$10$qeLbnjEpBI0enZt6UprO1Os/Hnz04kWQvVrQlK..iO.gOyGRXY3/W','1995-11-30','female',320,'member',1,'2026-03-31 18:42:51','2026-04-10 11:40:19',NULL,'KH-0003',NULL),(4,'Pháº¡m CÃ´ng Danh','danh.pham@gmail.com','0934444555','$2a$10$qeLbnjEpBI0enZt6UprO1Os/Hnz04kWQvVrQlK..iO.gOyGRXY3/W','1978-03-10','male',5600,'vip',1,'2026-03-31 18:42:51','2026-04-10 11:40:19',NULL,'KH-0004',NULL),(5,'HoÃ ng Thá»‹ BÃ­ch Ngá»c','bichnoc.hoang@gmail.com','0945555666','$2a$10$qeLbnjEpBI0enZt6UprO1Os/Hnz04kWQvVrQlK..iO.gOyGRXY3/W','2000-07-04','female',890,'silver',1,'2026-03-31 18:42:51','2026-04-10 11:40:19',NULL,'KH-0005',NULL),(6,'VÅ© Tiáº¿n DÅ©ng','tiendung.vu@gmail.com','0956666777','$2a$10$qeLbnjEpBI0enZt6UprO1Os/Hnz04kWQvVrQlK..iO.gOyGRXY3/W','1992-01-25','male',150,'member',1,'2026-03-31 18:42:51','2026-04-10 11:40:19',NULL,NULL,NULL),(7,'Äáº·ng Thá»‹ Kim Oanh','kimoanh.dang@gmail.com','0967777888','$2a$10$qeLbnjEpBI0enZt6UprO1Os/Hnz04kWQvVrQlK..iO.gOyGRXY3/W','1988-09-18','female',2100,'gold',1,'2026-03-31 18:42:51','2026-04-10 11:40:19',NULL,NULL,NULL),(8,'Trần Văn Test','test@gmail.com','0999000111','$2a$10$5bkmV3zpC0jKxcT.aTmFKuzcswsNzLJlDgCWDlpHT9aPuw/oFCYta',NULL,NULL,0,'member',1,'2026-04-10 11:56:58','2026-04-10 11:56:58',NULL,NULL,NULL),(9,'Tạ Ngọc Tài','tangoctai2004@icloud.com','0969259650','$2a$10$uPcglsd6agQHunNe0nFaS.qdsO8b5ydS/BjzrOz7qtnGVi.R/1yVW',NULL,'female',0,'member',1,'2026-04-11 03:24:52','2026-04-14 01:30:00',NULL,NULL,NULL),(10,'Nguyễn Thị Phương','phuong.test@gmail.com','0978888888','$2a$10$.PZcbE1lTSaKWc7BjDOqE.JpONRFBC0hySwP.OcwO.RO0agkrpA3e',NULL,NULL,0,'member',1,'2026-04-11 04:14:25','2026-04-11 04:14:34','2026-04-11 04:14:34',NULL,NULL),(11,'Test Verified2','testcheck@test.com','0999887766','$2a$10$kK3ddMJm/kQBP1GOjFS6p.wLnkY02IVO368efjjUPW/87Sc4PSCT2',NULL,NULL,0,'member',1,'2026-04-11 05:38:58','2026-04-11 05:44:06',NULL,NULL,NULL),(12,'RegTest','regtest_26043@test.com','092919255','$2a$10$6KQPBokq7r0MVqgYXBHL1uL1sfnrrK0ilVqRiE8mY9ek504rcPv5C',NULL,NULL,0,'member',0,'2026-04-11 05:44:05','2026-04-12 05:23:32',NULL,NULL,NULL),(13,'Nguyễn Thị Duyên','duyennguyenthi1979@gmail.com','0982493356','$2a$10$YINEXqSKw8mS37spHikC8eQSLqamFu2M0m9MwooVq4W2i2wPV7oUS',NULL,'female',0,'member',1,'2026-04-12 04:41:55','2026-04-12 05:13:01',NULL,NULL,NULL),(14,'RegTest','regtest_20450@test.com','09715155','$2a$10$Q7l59Ge3oHVVyZdIZCzNTuVpl7vM8tkO4SMoNAGVo02Jm6ojzmUja',NULL,NULL,0,'member',1,'2026-04-20 16:04:39','2026-04-20 16:04:39',NULL,NULL,NULL),(15,'Test Verified2','regtest_3691@test.com','092226155','$2a$10$HACCb5.HW.aI/kc.1QO7buzLnYoLRFb4WqgHiDUc6HzEmbcL7yaBS',NULL,NULL,0,'member',1,'2026-04-20 16:05:17','2026-04-20 16:05:18',NULL,NULL,NULL),(16,'Test Verified2','regtest_791@test.com','091311755','$2a$10$YIb4QAXa4HoBA4t1dhqcGOi/Q6Q0.UcdTek.Cx.LG.VIc9H7mPAqu',NULL,NULL,0,'member',1,'2026-04-20 16:05:50','2026-04-20 16:05:51',NULL,NULL,NULL),(17,'Hải Ngô','haingovan25@gmail.com','0972156856','$2a$10$uWx17UML7XuKfmOW1ChB0.hs.Xkne1CzSEavZA8xg6SbcsdHhhMRa',NULL,NULL,0,'member',1,'2026-04-20 16:06:26','2026-04-20 16:06:26',NULL,NULL,NULL);
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_customers_no_hard_delete` BEFORE DELETE ON `customers` FOR EACH ROW BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = '[D1-05/D4-02] customers KHÔNG được DELETE vật lý — đặt deleted_at = NOW() để xoá mềm. Yêu cầu: Nghị định 13/2023/NĐ-CP & khả năng truy xuất đơn hàng lịch sử.';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `loyalty_points_transactions`
--

DROP TABLE IF EXISTS `loyalty_points_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_points_transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL COMMENT 'FK â†’ customers.id',
  `transaction_type` enum('earn_purchase','earn_bonus','redeem','adjust_add','adjust_deduct','expire') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Loáº¡i giao dá»‹ch Ä‘iá»ƒm',
  `points_change` int NOT NULL COMMENT 'Sá»‘ Ä‘iá»ƒm thay Ä‘á»•i: dÆ°Æ¡ng=cá»™ng, Ã¢m=trá»«',
  `description` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ´ táº£: "Mua hÃ ng WEB-260316-001", "ThÆ°á»Ÿng sinh nháº­t", "Äá»•i 500Ä‘ trá»« tiá»n hÃ ng"',
  `reference_order_id` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_order.orders.id â€” Ä‘Æ¡n hÃ ng phÃ¡t sinh Ä‘iá»ƒm',
  `adjusted_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” admin Ä‘iá»u chá»‰nh',
  `admin_note` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chÃº cá»§a admin khi Ä‘iá»u chá»‰nh Ä‘iá»ƒm',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `idempotency_key` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UUID dùng một lần để chống duplicate request (race condition đổi điểm) — NULL cho giao dịch hệ thống',
  `expires_at` datetime DEFAULT NULL COMMENT 'Thời điểm điểm hết hạn sử dụng — NULL nếu là giao dịch trừ điểm hoặc không có hạn',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loyalty_idempotency` (`customer_id`,`idempotency_key`),
  KEY `idx_loyalty_pts_txn_customer_id` (`customer_id`),
  KEY `idx_loyalty_pts_txn_type` (`transaction_type`),
  KEY `idx_loyalty_pts_txn_created_at` (`created_at`),
  KEY `idx_loyalty_transactions_expires_at` (`customer_id`,`expires_at`),
  CONSTRAINT `fk_loyalty_pts_txn_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lá»‹ch sá»­ giao dá»‹ch Ä‘iá»ƒm tÃ­ch luá»¹ loyalty cá»§a tá»«ng khÃ¡ch hÃ ng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loyalty_points_transactions`
--

LOCK TABLES `loyalty_points_transactions` WRITE;
/*!40000 ALTER TABLE `loyalty_points_transactions` DISABLE KEYS */;
INSERT INTO `loyalty_points_transactions` VALUES (1,1,'earn_purchase',125,'Mua hÃ ng WEB-260101-001 â€” 1.250.000Ä‘ Ã— 1Ä‘/10.000Ä‘',NULL,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(2,1,'earn_purchase',85,'Mua hÃ ng POS-260215-001 â€” 850.000Ä‘ Ã— 1Ä‘/10.000Ä‘',NULL,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(3,1,'earn_bonus',50,'ThÆ°á»Ÿng Ä‘iá»ƒm sinh nháº­t thÃ¡ng 5',NULL,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(4,1,'earn_purchase',99,'Mua hÃ ng WEB-260314-001 â€” 590.000Ä‘ Ã— 1.5Ä‘/10.000Ä‘',6,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(5,1,'earn_purchase',75,'Mua hÃ ng POS-260317-002 â€” 378.000Ä‘ Ã— 1.5Ä‘/10.000Ä‘',2,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(6,2,'earn_purchase',380,'Mua hÃ ng WEB-260316-001 â€” 880.000Ä‘ Ã— 1.5Ä‘/10.000Ä‘',4,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(7,4,'earn_purchase',153,'Mua hÃ ng WEB-260315-001 â€” 1.530.000Ä‘ Ã— 1Ä‘/10.000Ä‘',5,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(8,3,'earn_purchase',32,'Mua hÃ ng Ä‘áº§u tiÃªn',NULL,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(9,5,'earn_purchase',89,'Mua hÃ ng â€” 890.000 Ä‘iá»ƒm tÃ­ch luá»¹',NULL,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL),(10,2,'adjust_add',20,'ThÆ°á»Ÿng Ä‘iá»ƒm do review sáº£n pháº©m',NULL,NULL,NULL,'2026-03-31 18:42:51',NULL,NULL);
/*!40000 ALTER TABLE `loyalty_points_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loyalty_tier_config`
--

DROP TABLE IF EXISTS `loyalty_tier_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_tier_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tier_code` enum('member','silver','gold','vip') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ háº¡ng â€” khá»›p vá»›i customers.loyalty_tier',
  `tier_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn hiá»ƒn thá»‹: ThÃ nh viÃªn, Báº¡c, VÃ ng, VIP',
  `tier_icon` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ðŸ¥ˆ' COMMENT 'Emoji icon háº¡ng',
  `min_spending` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Chi tiÃªu tá»‘i thiá»ƒu Ä‘á»ƒ Ä‘áº¡t háº¡ng nÃ y (VND)',
  `max_spending` decimal(15,2) DEFAULT NULL COMMENT 'Chi tiÃªu tá»‘i Ä‘a (NULL = khÃ´ng giá»›i háº¡n â€” háº¡ng VIP)',
  `points_ratio` decimal(5,2) NOT NULL DEFAULT '1.00' COMMENT 'Tá»· lá»‡ tÃ­ch Ä‘iá»ƒm: 1.0 = 1Ä‘/10.000Ä‘, 1.5 = 1.5Ä‘/10.000Ä‘',
  `points_per_vnd` int NOT NULL DEFAULT '10000' COMMENT 'Sá»‘ VND Ä‘á»ƒ tÃ­ch 1 Ä‘iá»ƒm theo tá»· lá»‡ cÆ¡ sá»Ÿ',
  `discount_pct` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '% giáº£m giÃ¡ tá»± Ä‘á»™ng cho háº¡ng (0=khÃ´ng giáº£m)',
  `description` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MÃ´ táº£ quyá»n lá»£i háº¡ng thÃ nh viÃªn',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `points_expiry_months` int DEFAULT '12' COMMENT 'Số tháng sau khi cộng thì điểm tự hết hạn (mặc định 12 tháng)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loyalty_tier_config_code` (`tier_code`),
  KEY `idx_loyalty_config_expiry` (`points_expiry_months`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cáº¥u hÃ¬nh háº¡ng thÃ nh viÃªn loyalty â€” ngÆ°á»¡ng chi tiÃªu vÃ  tá»· lá»‡ tÃ­ch Ä‘iá»ƒm';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loyalty_tier_config`
--

LOCK TABLES `loyalty_tier_config` WRITE;
/*!40000 ALTER TABLE `loyalty_tier_config` DISABLE KEYS */;
INSERT INTO `loyalty_tier_config` VALUES (1,'member','ThÃ nh viÃªn','â­',0.00,4999999.00,1.00,10000,0.00,'Háº¡ng cÆ¡ báº£n, tÃ­ch 1 Ä‘iá»ƒm cho má»—i 10.000Ä‘ chi tiÃªu','2026-03-31 18:42:51',12),(2,'silver','Báº¡c','ðŸ¥ˆ',5000000.00,19999999.00,1.50,10000,2.00,'Chi tiÃªu 5tr+, tÃ­ch 1.5 Ä‘iá»ƒm/10.000Ä‘, giáº£m 2% tá»± Ä‘á»™ng','2026-03-31 18:42:51',12),(3,'gold','VÃ ng','ðŸ¥‡',20000000.00,49999999.00,2.00,10000,5.00,'Chi tiÃªu 20tr+, tÃ­ch 2 Ä‘iá»ƒm/10.000Ä‘, giáº£m 5% tá»± Ä‘á»™ng','2026-03-31 18:42:51',12),(4,'vip','VIP','ðŸ’Ž',50000000.00,NULL,3.00,10000,10.00,'Chi tiÃªu 50tr+, tÃ­ch 3 Ä‘iá»ƒm/10.000Ä‘, giáº£m 10% tá»± Ä‘á»™ng, Æ°u tiÃªn giao hÃ ng','2026-03-31 18:42:51',12);
/*!40000 ALTER TABLE `loyalty_tier_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `otp_codes`
--

DROP TABLE IF EXISTS `otp_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_codes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `target` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SÄT hoáº·c email nháº­n OTP',
  `target_type` enum('phone','email') COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bcrypt/SHA-256 hash cá»§a mÃ£ OTP, KHÃ”NG lÆ°u plaintext',
  `purpose` enum('register','reset_password','verify_email','pos_confirm') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Má»¥c Ä‘Ã­ch sá»­ dá»¥ng OTP',
  `attempts` int NOT NULL DEFAULT '0' COMMENT 'Sá»‘ láº§n nháº­p sai (khoÃ¡ sau 5 láº§n)',
  `expires_at` datetime NOT NULL COMMENT 'Thá»i Ä‘iá»ƒm OTP háº¿t hiá»‡u lá»±c (thÆ°á»ng +5 phÃºt)',
  `used_at` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm OTP Ä‘Æ°á»£c dÃ¹ng thÃ nh cÃ´ng (NULL=chÆ°a dÃ¹ng)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `send_count_today` int NOT NULL DEFAULT '0' COMMENT 'Số OTP đã gửi hôm nay đến target này — reset lúc 00:00 mỗi ngày',
  `last_send_at` datetime DEFAULT NULL COMMENT 'Thời điểm gửi OTP gần nhất đến target — dùng kiểm tra cooldown (ít nhất 60s giữa 2 lần gửi)',
  `blocked_until` datetime DEFAULT NULL COMMENT 'Target bị khoá nhận OTP đến thời điểm này — exponential backoff sau 3 lần thất bại',
  PRIMARY KEY (`id`),
  KEY `idx_otp_codes_target` (`target`,`target_type`),
  KEY `idx_otp_codes_purpose` (`purpose`),
  KEY `idx_otp_codes_expires_at` (`expires_at`),
  KEY `idx_otp_target_date` (`target`,`target_type`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='MÃ£ OTP táº¡m thá»i cho xÃ¡c thá»±c nhiá»u bÆ°á»›c';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `otp_codes`
--

LOCK TABLES `otp_codes` WRITE;
/*!40000 ALTER TABLE `otp_codes` DISABLE KEYS */;
INSERT INTO `otp_codes` VALUES (3,'0901234567','phone','$2a$10$qIKstjaETWY6bHvRphccAOrOxjlrlMNNy/iC2fgiQTzVYQ84kniAi','register',0,'2026-04-19 10:36:30','2026-04-19 10:33:28','2026-04-19 10:31:30',0,NULL,NULL);
/*!40000 ALTER TABLE `otp_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL COMMENT '⚠️ CẢNH BÁO NAMESPACE: LUÔN query kèm điều kiện user_type. user_id KHÔNG unique giữa staff (mg_identity.users) và customer (mg_identity.customers) vì cả hai bắt đầu từ id=1. SAI: WHERE user_id=? | ĐÚNG: WHERE user_id=? AND user_type=?',
  `user_type` enum('staff','customer') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'PhÃ¢n biá»‡t loáº¡i user Ä‘á»ƒ query Ä‘Ãºng báº£ng',
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SHA-256 hash cá»§a refresh token, KHÃ”NG lÆ°u raw token',
  `expires_at` datetime NOT NULL COMMENT 'Thá»i Ä‘iá»ƒm token háº¿t háº¡n',
  `revoked_at` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm token bá»‹ thu há»“i (NULL=cÃ²n hiá»‡u lá»±c)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_tokens_hash` (`token_hash`),
  KEY `idx_refresh_tokens_user` (`user_id`,`user_type`),
  KEY `idx_refresh_tokens_expires_at` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Refresh token cho xÃ¡c thá»±c JWT, há»— trá»£ cáº£ staff vÃ  customer';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
INSERT INTO `refresh_tokens` VALUES (1,1,'staff','3989783a1b489d0dc9f0d52ba6a889c7b6185c8d551dfc2503347c14a7753b7a','2026-05-10 11:43:10',NULL,'2026-04-10 11:43:10'),(2,1,'staff','f99e7629fcb3f08d2dffe14026d8199545ffb6536f41919ca4b4efce3bacbd94','2026-05-10 11:48:21',NULL,'2026-04-10 11:48:21'),(3,8,'customer','279b6944bd2bbef6e0a242367436edd0276ee85663db5286b81d08092a3a1336','2026-05-10 11:56:58',NULL,'2026-04-10 11:56:58'),(4,1,'staff','24a607b0cefdddce26d84f1d90355917fe51aada89bc8de7a46764b8a58f754b','2026-05-10 12:01:41',NULL,'2026-04-10 12:01:41'),(5,1,'staff','22aa2e5e46f3ac1f4f77b3ef0bd4a7d2b1001f167d4e16bda4e2d4b19edd73cc','2026-05-10 12:02:57','2026-04-10 12:03:17','2026-04-10 12:02:57'),(6,1,'staff','84b98974f8aa016cb9723b40875b845047a5ac0ee74f3230929ffc8da492d180','2026-05-10 12:05:43',NULL,'2026-04-10 12:05:43'),(7,1,'customer','c969a3f893754330f65374c9368b0d76eb231632abe86b72e017184b4e70582a','2026-05-10 13:33:08',NULL,'2026-04-10 13:33:08'),(8,1,'customer','614fc58f21d2c980e5df6492c0e9b5c639d2c5b02305cca77429ea08f76d3afd','2026-05-10 13:33:15',NULL,'2026-04-10 13:33:15'),(9,1,'staff','8b558e9e49c19f46fea14a9129c671a9bc21709beecf4277b89e7bad6d995bdf','2026-05-10 13:33:25',NULL,'2026-04-10 13:33:25'),(10,2,'staff','69fc6850e65eeb98b624fdc7a96e3602040d44b8333b8aefb44ed571cefebfb2','2026-05-10 13:35:43',NULL,'2026-04-10 13:35:43'),(11,2,'staff','f1e34a437525c86df7136156d2d6cc942001e90a6dba6d680be7c9d1ea26040e','2026-05-10 13:43:35',NULL,'2026-04-10 13:43:35'),(12,2,'staff','142010fe84ea45c9500dc8ebea508774cf31e5b9f87736445c777bbe2587570c','2026-05-10 13:43:57',NULL,'2026-04-10 13:43:57'),(13,1,'staff','016711192727dc09dfb7164ca9137ce3a9ba52f2b01718e38916c3acd8efa2b6','2026-05-11 03:04:52',NULL,'2026-04-11 03:04:52'),(14,1,'staff','91680e91281b3b01c9481f9e34f52c681b1162be082432f7cc5a633f52c7c5ca','2026-05-11 03:05:06',NULL,'2026-04-11 03:05:06'),(15,3,'staff','19d75f0aa8f78ddf50f2e927d9db705ada1035197099cc3626d2cb83ac374fc1','2026-05-11 03:05:22',NULL,'2026-04-11 03:05:22'),(16,1,'staff','0ab667720ce898e9f86ed9a15f8dab9c51b5a684398e693da403bb1efe8e881a','2026-05-11 03:06:38',NULL,'2026-04-11 03:06:38'),(17,1,'customer','5dd07177805e17e919deffb3c82bf40f09bfb97efecab2ab24d647276a6a3e61','2026-05-11 03:07:11',NULL,'2026-04-11 03:07:11'),(18,2,'staff','a31cf9321aeb29d9270bdced610a897612189e1d2928897d4b46e68e19146e62','2026-05-11 03:09:37',NULL,'2026-04-11 03:09:37'),(19,2,'staff','1f72b89bb8a534bea3edb61ebc708e1efdc714957d8eff96dfb0232ea6053486','2026-05-11 03:10:06',NULL,'2026-04-11 03:10:06'),(20,5,'staff','abc9997b6c29538bdccff1eb7fd8afaa42d587ccc84d9d96d4eb5682b2cdae2b','2026-05-11 03:10:39',NULL,'2026-04-11 03:10:39'),(21,1,'staff','7824aced62fc53a3bd99634f0657d449c7f6a9a9b7a8357bd7eae74b96607b2a','2026-05-11 03:13:07',NULL,'2026-04-11 03:13:07'),(22,9,'customer','b95b21a75499429ff787bdb9321e3ea405a5c780f9b3efbb2268128c77d0c48f','2026-05-11 03:24:52',NULL,'2026-04-11 03:24:52'),(23,9,'customer','b13bd4835fa43209d9b2e79095a0f354a774316ca98052239ff23897f3e0c3bb','2026-05-11 03:30:57',NULL,'2026-04-11 03:30:57'),(24,9,'customer','954fffcfb213fa50477fc2ae96051950f09a09a21e3ea5ba4b19c2b1c131efb4','2026-05-11 03:37:08',NULL,'2026-04-11 03:37:08'),(25,9,'customer','800c553bdc430187b5ae11afa2da037c7c1beeb20feb8c3c32be38fed1f4d0e4','2026-05-11 03:42:00',NULL,'2026-04-11 03:42:00'),(26,9,'customer','660f7b3886ceeb2e0505d871594ec1ae3ff8ee4965ecc4cfba1196b70d274345','2026-05-11 03:43:05',NULL,'2026-04-11 03:43:05'),(27,9,'customer','457c2465ae5ef3cbbfa0c3ac0c10fd77360585378d390f4480a71c1ce5dc4083','2026-05-11 03:45:43',NULL,'2026-04-11 03:45:43'),(28,9,'customer','1f21418f3655f710b16e7a249afa836a03feab07ac9431c623a2cfac00c5c487','2026-05-11 03:46:15',NULL,'2026-04-11 03:46:15'),(29,9,'customer','dff0f93f7599728fedad2a790ae97970f1b7638a3f55fc6a9e05377f27af9f3a','2026-05-11 03:48:18',NULL,'2026-04-11 03:48:18'),(30,9,'customer','9576da39139e6447ac376c0566888b3b186e529bc478142f7ae8bc9da379fb92','2026-05-11 03:48:25',NULL,'2026-04-11 03:48:25'),(31,1,'staff','c182f70df80dfcd4633641734404c204e823256c821ed0badd5655c6e714a3e9','2026-05-11 04:06:31',NULL,'2026-04-11 04:06:31'),(32,1,'staff','667728ffcbb45f6a19800ea43ac5292f790f918f59cc4517506e311abdf62022','2026-05-11 04:07:03',NULL,'2026-04-11 04:07:03'),(33,3,'staff','f1ad55b8a9bc5f303cff36514cb0b31a7f3afdef753ef791f31cef2d0ef15623','2026-05-11 04:12:56',NULL,'2026-04-11 04:12:56'),(34,9,'customer','be327c634c37d18cd60ee6f4b67d579d9a7e465380d3a8f5dc7b4c869fd3a390','2026-05-11 04:29:29',NULL,'2026-04-11 04:29:29'),(35,9,'customer','3634c0913ca2f92d5ad2b32c5b314cbb45c33b7621520955ba37f69d2d12c310','2026-05-11 04:45:30',NULL,'2026-04-11 04:45:30'),(36,1,'customer','f0bc59c2ae9172bb4444cd751c392030d6d6cf602302724e1e56bf92c66d5b05','2026-05-11 04:48:28',NULL,'2026-04-11 04:48:28'),(37,4,'customer','aa0a379244821ba803016d4ba87711ff60a8ef9ee5041faa7bb4639ef5beb5c7','2026-05-11 05:11:08',NULL,'2026-04-11 05:11:08'),(38,3,'staff','1c716246dd47458506bd6d341307f9c17e36d83e8db76d57f72870e080438acf','2026-05-11 05:15:36',NULL,'2026-04-11 05:15:36'),(39,2,'staff','3f8f51df74a84e61f774007adb8010defe2674548ab3d0a09b66b5ba3a872a6b','2026-05-11 05:16:09',NULL,'2026-04-11 05:16:09'),(40,9,'customer','d63aeb820c4e67762d8712b9e436da411fea1cd243a2e6d221e98c9a34cfaafc','2026-05-11 05:36:32',NULL,'2026-04-11 05:36:32'),(41,1,'staff','b71af29641f3d6f00b515a59446e2193e1625851fba98450e29f5cd9c595c8f8','2026-05-11 05:37:11',NULL,'2026-04-11 05:37:11'),(43,1,'staff','1b052bc883ee821097b0825270e754b937ea095a768611e85af420c92b0a6f9c','2026-05-11 05:37:35',NULL,'2026-04-11 05:37:35'),(44,1,'staff','6648ec7825c142d2706af40762dc7afa9ca7a8a349ade3654e21249204b5b0a1','2026-05-11 05:37:49',NULL,'2026-04-11 05:37:49'),(47,1,'staff','3cee18100a9a36e3ee27ac1d8b7c2e9727db77681d3284efc874312ec0b6b0ad','2026-05-11 05:38:39',NULL,'2026-04-11 05:38:39'),(48,1,'staff','42d38dd45676c185da914fb061ee64023b9e7aeffaca450f68bc9f1fb55f567c','2026-05-11 05:38:39',NULL,'2026-04-11 05:38:39'),(49,1,'staff','d4bdc2488aaa6d7516484be0139e2d63451104c5c26ab683097a18f78f5523e9','2026-05-11 05:38:39',NULL,'2026-04-11 05:38:39'),(50,11,'customer','f89573ff46753bea6a8c823e1e4f085b3f8f8092ff443919118cc2baa0baa4d5','2026-05-11 05:38:58',NULL,'2026-04-11 05:38:58'),(51,11,'customer','2012ead5fc5bfb7e9d638548ebd8c8d5230083143ad0fbcc6577884259cc7ea4','2026-05-11 05:38:58',NULL,'2026-04-11 05:38:58'),(52,11,'customer','0fc69a018c2768de728b0662258259531a585815beeeec43f74ca8f9ea2d1159','2026-05-11 05:39:22',NULL,'2026-04-11 05:39:22'),(53,11,'customer','640bd7c09fdaee7f2dd7069b7f5dbeb7f74b5d8f794f182c78a6301691ac3363','2026-05-11 05:39:22',NULL,'2026-04-11 05:39:22'),(54,1,'staff','5e67cfa81449d78098322aef2d762426f1ddee1ddadbd1f9d1ddc7062c11c354','2026-05-11 05:39:23',NULL,'2026-04-11 05:39:23'),(55,11,'customer','31765f56c053fbe37ed67152673b3a4bf7e0ecb23ed3029cd0f4e774dc414fb7','2026-05-11 05:39:23',NULL,'2026-04-11 05:39:23'),(56,11,'customer','597a9987d59e04d5545b420d4629e88d783e858e48937303cc94cc516d497bae','2026-05-11 05:39:43','2026-04-11 05:39:44','2026-04-11 05:39:43'),(57,1,'staff','cd1351fc2c91a366a917dfd76bd81712c91a7a42210a5aa0bddf2dd9a09c0fd6','2026-05-11 05:39:44',NULL,'2026-04-11 05:39:44'),(58,1,'staff','cea3b829011902acf7ca7c91dbabda4803a8ec25c2233d5c11810511a892f2b9','2026-05-11 05:39:58',NULL,'2026-04-11 05:39:58'),(59,1,'staff','f082e793c82660a26bc68a23cf70876413f354305b22b24f5b0ff2361e010cd9','2026-05-11 05:41:21',NULL,'2026-04-11 05:41:21'),(60,11,'customer','a4c4caa97092afd5aa89621b4faf9819ff7309345532d64bfa665b14e320fe74','2026-05-11 05:41:41',NULL,'2026-04-11 05:41:41'),(61,1,'staff','23e0b5debbccc7fafce454b3f0e705e0cbdb640630e65d0d489a53d269eacec6','2026-05-11 05:41:42',NULL,'2026-04-11 05:41:42'),(62,1,'staff','18ad065fa89c3f7f1448f84233724052262653ea800bd3877b4d54e2ea427495','2026-05-11 05:42:05',NULL,'2026-04-11 05:42:05'),(63,1,'staff','26295d14578e9063b929ea5389946fe6b08dc1266e0b07d2fa73185d339dcdd8','2026-05-11 05:43:30',NULL,'2026-04-11 05:43:30'),(64,1,'staff','bd131f29b11e53cebbc9cdfc46335d04f4ececa61fb82b862e330e8bd0a61a6b','2026-05-11 05:43:30',NULL,'2026-04-11 05:43:30'),(65,1,'staff','155917ee635cbd2aba6be99abd259fd464c23c76098683f71bf031f981b1a428','2026-05-11 05:43:31',NULL,'2026-04-11 05:43:31'),(66,11,'customer','4959865e8d65c0b6b0a437d7f4fbad0580081765e920716951ab93431c76fc13','2026-05-11 05:43:31','2026-04-11 05:43:32','2026-04-11 05:43:31'),(67,1,'staff','1c05b45cc21fbc944649c391373ef9e787bdec0c0f8af04ae53125805b3e8917','2026-05-11 05:44:04',NULL,'2026-04-11 05:44:04'),(68,1,'staff','aac785f094856c46b60b103297b956416c51bf80b5273f0b1a7a18ec6a88dfdd','2026-05-11 05:44:04',NULL,'2026-04-11 05:44:04'),(69,1,'staff','278be3fe4470091f9530605d1d6eecaee7231b66fe888059237d99464f8e1b81','2026-05-11 05:44:05',NULL,'2026-04-11 05:44:05'),(70,12,'customer','d630347ce5f40bac744c962f1f55b4b18eeaa323c3609ad31f213f53769845e7','2026-05-11 05:44:05',NULL,'2026-04-11 05:44:05'),(71,11,'customer','303d711e9fb76ae7a5889ada95eed36e07544d4bacb821a60320841d62d2aa64','2026-05-11 05:44:05','2026-04-11 05:44:06','2026-04-11 05:44:05'),(72,1,'staff','e6459ae19225557d070259e971a312c33281fb711844dea39b5ebf0645766379','2026-05-11 11:52:28',NULL,'2026-04-11 11:52:28'),(73,1,'staff','9ef8c8b0f57906602b1a068bf5fe8429fc32b161709b597bfe6c8f0a95bcabef','2026-05-11 12:00:54',NULL,'2026-04-11 12:00:54'),(74,9,'customer','b449e649482c4ccc1748fb51c7864d0f2b453c7e03e5e978a7a4acc6284016bb','2026-05-12 04:40:50',NULL,'2026-04-12 04:40:50'),(75,13,'customer','f1271bd0be0da46fba90cd067692633cea1510a53bb3bc84406d13d59caa0f6c','2026-05-12 04:41:55',NULL,'2026-04-12 04:41:55'),(76,1,'staff','313f402973505c7df237c29397aedbff1f324cfca90fe88eb11554c8a6b325c4','2026-05-12 04:43:22',NULL,'2026-04-12 04:43:22'),(77,3,'staff','1f2e4f2605794fc117ee0568d8e30ccf7fca8b08197a01435189d8ec4bd86b8e','2026-05-12 04:43:47',NULL,'2026-04-12 04:43:47'),(78,1,'staff','1f918df6727c2d977311d3017ceb74c0aafe620edc9e2ed8a83e427570becf7b','2026-05-12 04:45:18',NULL,'2026-04-12 04:45:18'),(79,9,'customer','1328c0cf6410616b4bfeb8c7bc95553bf50ad4d9aff01a55f3f865762c32831b','2026-05-12 06:44:06',NULL,'2026-04-12 06:44:06'),(80,9,'customer','112ecc4b5c4dbe819365578143a96383f3f8827f5fd17b0bc9dc1a4a973174a0','2026-05-12 07:00:43',NULL,'2026-04-12 07:00:43'),(81,9,'customer','8a49c2a6220b7b25e486933067fba7a7ccbf00a387c6855d5cae5377c2aaffa6','2026-05-14 01:27:38',NULL,'2026-04-14 01:27:38'),(82,1,'staff','ec17efb0abf34b4b213dd547f4421bf7cf14cb30a1305a5eb666abaac5155b1c','2026-05-14 01:27:45',NULL,'2026-04-14 01:27:45'),(83,9,'customer','5b7f6c314bb699efa064a4d3bae51cbff748c3b9490467b94dd8ece56d5a8eff','2026-05-14 01:27:50',NULL,'2026-04-14 01:27:50'),(84,1,'staff','4b9a42a1b4f73317bb4db02bec34dcba3f02b400a2b05493684e5ab1c14dcf9b','2026-05-15 16:50:02',NULL,'2026-04-15 16:50:02'),(85,9,'customer','068b78714c9e47e039cf9c987fd268e526b192417693b12e456ae76cbbb5b37c','2026-05-20 11:32:37',NULL,'2026-04-20 11:32:37'),(86,9,'customer','69d9748b5ae1f58f803d58fc9790d4bbf1051807389b234996f5733863fb96f2','2026-05-20 16:02:58',NULL,'2026-04-20 16:02:58'),(87,1,'staff','4e2c8064124d6254f2eb425701af8a8b93c085e6aa813e957f7e49d22e27a7ce','2026-05-20 16:04:38',NULL,'2026-04-20 16:04:38'),(88,1,'staff','f99cf16f4bb06433010d40f4f04d600eab99d9f3a021b5773e9cad4ed186ba98','2026-05-20 16:04:39',NULL,'2026-04-20 16:04:39'),(89,1,'staff','2ea2ca75ed9a8cfe9eb97f3a9601afc2304174e31978a6d7f9275846bb51d3bf','2026-05-20 16:04:39',NULL,'2026-04-20 16:04:39'),(90,14,'customer','5acc23fc653e54bfe7a8a66a307e5980d32e4fe26b3545b4881811aa6e0aa4c6','2026-05-20 16:04:39',NULL,'2026-04-20 16:04:39'),(91,1,'staff','6c5297087fa6d75480ccb02d52a5fab53b8f27edb22a7b348dd24cf16e61b1f0','2026-05-20 16:05:15',NULL,'2026-04-20 16:05:15'),(92,1,'staff','65ee5cac88cf1aa07c50c5d3b4ea0ca89482a90dec460e63ff64cc7e70cb840c','2026-05-20 16:05:16',NULL,'2026-04-20 16:05:16'),(93,1,'staff','d86107f928b2eb95f2e1f500a05546234b4cf3aaecaf73300f4fa463828c1c62','2026-05-20 16:05:16',NULL,'2026-04-20 16:05:16'),(94,15,'customer','1ee2d7b2d638f78384f2848da480d85b5bbdf8e434557c90443b3ca4690c54e9','2026-05-20 16:05:17',NULL,'2026-04-20 16:05:17'),(95,15,'customer','dfacf7ad087d3e86dd1b3e7ff633042a636a28287cdcfc1eb9ca76e4aebb6855','2026-05-20 16:05:17','2026-04-20 16:05:18','2026-04-20 16:05:17'),(96,1,'staff','c3fd1058e027f0be82c612cd026a8ed0058f4bff78c7bf8f903fb43887c20dba','2026-05-20 16:05:49',NULL,'2026-04-20 16:05:49'),(97,1,'staff','fab9e2c6ac59ed1698a2e7a13d75ffba74e36e7bcf4ea48dcea1bee3ca97a4d5','2026-05-20 16:05:49',NULL,'2026-04-20 16:05:49'),(98,1,'staff','65146441e7072d52d0f63048d601a34ccb84138bc2d982e49f70c7459a18d7db','2026-05-20 16:05:50',NULL,'2026-04-20 16:05:50'),(99,16,'customer','8b8fc7ed0d8dd07aeae1a779ca5b9e0f25a04548c03ba0b304cd2db8afc8b8cb','2026-05-20 16:05:50',NULL,'2026-04-20 16:05:50'),(100,16,'customer','e50efc2f7e7b9853599923a585bc20c4a80310a702bfcb9510d02280191a5d56','2026-05-20 16:05:50','2026-04-20 16:05:51','2026-04-20 16:05:50'),(101,17,'customer','cec678a9bd72c7b87682f18c0be0586bba59f87a30945f0da438a209f9b1d936','2026-05-20 16:06:26',NULL,'2026-04-20 16:06:26'),(102,1,'staff','6655544191ae6732e23d06be0d432549620061eb881285b7f36ecb7c6bcc645c','2026-05-20 16:32:35',NULL,'2026-04-20 16:32:35'),(103,1,'staff','14391650b49152efc96c3ca10e191137b500c47d081e68300d220785709c5ad9','2026-05-20 16:33:33',NULL,'2026-04-20 16:33:33');
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn vai trÃ²: admin, pharmacist, cashier, staff',
  `description` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MÃ´ táº£ vai trÃ²',
  `permissions` json DEFAULT NULL COMMENT 'JSON array chá»©a danh sÃ¡ch mÃ£ quyá»n, VD: ["orders.view","inventory.edit"]',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Báº£ng vai trÃ² & quyá»n háº¡n nhÃ¢n viÃªn';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin','Quáº£n trá»‹ viÃªn há»‡ thá»‘ng toÃ n quyá»n','[\"dashboard.view\", \"inventory.view\", \"inventory.edit\", \"orders.view\", \"orders.edit\", \"customers.view\", \"customers.edit\", \"reports.view\", \"settings.edit\", \"users.manage\"]','2026-03-31 18:42:51'),(2,'pharmacist','DÆ°á»£c sÄ© â€” quáº£n lÃ½ thuá»‘c vÃ  tá»“n kho','[\"dashboard.view\", \"inventory.view\", \"inventory.edit\", \"batches.view\", \"batches.edit\", \"products.view\", \"products.edit\", \"orders.view\"]','2026-03-31 18:42:51'),(3,'cashier','Thu ngÃ¢n â€” bÃ¡n hÃ ng táº¡i quáº§y POS','[\"pos.access\", \"orders.create\", \"orders.view\", \"customers.view\"]','2026-03-31 18:42:51'),(4,'staff','NhÃ¢n viÃªn kho â€” nháº­p/xuáº¥t kho','[\"inventory.view\", \"batches.view\", \"batches.edit\", \"orders.view\", \"orders.fulfillment\"]','2026-03-31 18:42:51');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL COMMENT 'FK â†’ users.id â€” nhÃ¢n viÃªn trá»±c ca',
  `kiosk_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MÃ£ mÃ¡y POS: Kiosk #01, Kiosk #02...',
  `shift_start` datetime NOT NULL COMMENT 'Thá»i Ä‘iá»ƒm báº¯t Ä‘áº§u ca',
  `shift_end` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm káº¿t thÃºc ca (NULL náº¿u ca Ä‘ang má»Ÿ)',
  `opening_cash` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Tiá»n máº·t Ä‘áº§u ca kiá»ƒm Ä‘áº¿m',
  `closing_cash` decimal(12,2) DEFAULT NULL COMMENT 'Tiá»n máº·t cuá»‘i ca kiá»ƒm Ä‘áº¿m',
  `total_cash_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Tá»•ng doanh thu tiá»n máº·t trong ca',
  `total_card_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Tá»•ng doanh thu tháº»/visa trong ca',
  `total_qr_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Tá»•ng doanh thu QR/chuyá»ƒn khoáº£n trong ca',
  `status` enum('open','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open' COMMENT 'Tráº¡ng thÃ¡i ca: open=Ä‘ang trá»±c, closed=Ä‘Ã£ káº¿t ca',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chÃº bÃ n giao ca',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expected_closing_cash` decimal(12,2) DEFAULT NULL COMMENT 'Tiá»n cuá»‘i ca theo há»‡ thá»‘ng = opening_cash + total_cash_sales - refunds',
  `cash_difference` decimal(12,2) DEFAULT NULL COMMENT 'ChÃªnh lá»‡ch = closing_cash - expected_closing_cash (Ã¢m=thiáº¿u, dÆ°Æ¡ng=thá»«a)',
  `reconciliation_status` enum('pending','matched','excess','shortage','approved') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'Káº¿t quáº£ Ä‘á»‘i soÃ¡t: matched=khá»›p, excess=thá»«a, shortage=thiáº¿u, approved=Ä‘Ã£ duyá»‡t',
  `approved_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id â€” quáº£n lÃ½ duyá»‡t lá»‡ch ca',
  `approved_at` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm quáº£n lÃ½ duyá»‡t lá»‡ch ca',
  `approval_note` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chÃº cá»§a quáº£n lÃ½ khi duyá»‡t lá»‡ch ca',
  PRIMARY KEY (`id`),
  KEY `idx_shifts_user_id` (`user_id`),
  KEY `idx_shifts_kiosk_id` (`kiosk_id`),
  KEY `idx_shifts_status` (`status`),
  KEY `idx_shifts_shift_start` (`shift_start`),
  CONSTRAINT `fk_shifts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ca lÃ m viá»‡c cá»§a nhÃ¢n viÃªn táº¡i quáº§y POS';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
INSERT INTO `shifts` VALUES (1,3,'Kiosk #01','2026-03-17 07:00:00','2026-03-17 15:00:00',5000000.00,8250000.00,3125000.00,650000.00,475000.00,'closed',NULL,'2026-03-31 18:42:51','2026-03-31 18:42:51',8125000.00,125000.00,'matched',1,'2026-03-17 15:10:00','Khá»›p tiá»n, duyá»‡t Ä‘Ã³ng ca'),(2,3,'Kiosk #01','2026-03-17 15:00:00','2026-04-12 04:59:05',5000000.00,6000000.00,0.00,0.00,0.00,'closed',NULL,'2026-03-31 18:42:51','2026-04-12 04:59:05',NULL,NULL,'pending',NULL,NULL,NULL),(3,4,'Kiosk #02','2026-03-17 07:00:00','2026-03-17 15:00:00',3000000.00,5680000.00,2500000.00,180000.00,0.00,'closed',NULL,'2026-03-31 18:42:51','2026-03-31 18:42:51',5500000.00,180000.00,'excess',1,'2026-03-17 15:35:00','Thá»«a 180.000Ä‘ â€” kháº£ nÄƒng khÃ¡ch thá»‘i tiá»n chÃªnh láº», ghi nháº­p quá»¹'),(4,3,'Kiosk #03','2026-04-11 04:13:11','2026-04-11 04:13:29',3000000.00,5250000.00,0.00,0.00,0.00,'closed','Tất cả các giao dịch bình thường','2026-04-11 04:13:11','2026-04-11 04:13:29',NULL,NULL,'pending',NULL,NULL,NULL),(5,1,'POS-TEST','2026-04-11 05:39:44','2026-04-11 05:41:21',500000.00,600000.00,0.00,0.00,0.00,'closed','Test close','2026-04-11 05:39:44','2026-04-11 05:41:21',NULL,NULL,'pending',NULL,NULL,NULL),(6,1,'TEST-7329','2026-04-11 05:44:06','2026-04-11 05:44:06',100000.00,150000.00,0.00,0.00,0.00,'closed',NULL,'2026-04-11 05:44:06','2026-04-11 05:44:06',NULL,NULL,'pending',NULL,NULL,NULL),(7,1,'1','2026-04-12 04:59:19',NULL,150000.00,NULL,0.00,0.00,0.00,'open',NULL,'2026-04-12 04:59:19','2026-04-12 04:59:19',NULL,NULL,'pending',NULL,NULL,NULL),(8,1,'TEST-13548','2026-04-20 16:04:41','2026-04-20 16:04:41',100000.00,150000.00,0.00,0.00,0.00,'closed',NULL,'2026-04-20 16:04:41','2026-04-20 16:04:41',NULL,NULL,'pending',NULL,NULL,NULL),(9,1,'TEST-5365','2026-04-20 16:05:18','2026-04-20 16:05:18',100000.00,150000.00,0.00,0.00,0.00,'closed',NULL,'2026-04-20 16:05:18','2026-04-20 16:05:18',NULL,NULL,'pending',NULL,NULL,NULL),(10,1,'TEST-27172','2026-04-20 16:05:51','2026-04-20 16:05:51',100000.00,150000.00,0.00,0.00,0.00,'closed',NULL,'2026-04-20 16:05:51','2026-04-20 16:05:51',NULL,NULL,'pending',NULL,NULL,NULL);
/*!40000 ALTER TABLE `shifts` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_shifts_one_open_per_kiosk` BEFORE INSERT ON `shifts` FOR EACH ROW BEGIN
    DECLARE open_count INT;
    SELECT COUNT(*) INTO open_count
    FROM shifts
    WHERE kiosk_id = NEW.kiosk_id AND status = 'open';
    IF open_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[D2-04] Kiosk này đang có ca đang mở. Vui lòng đóng ca hiện tại trước khi mở ca mới.';
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'TÃªn Ä‘Äƒng nháº­p (khÃ´ng dáº¥u, khÃ´ng khoáº£ng tráº¯ng)',
  `email` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Email lÃ m viá»‡c',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bcrypt hash cá»§a máº­t kháº©u, KHÃ”NG lÆ°u plaintext',
  `full_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Há» vÃ  tÃªn Ä‘áº§y Ä‘á»§',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sá»‘ Ä‘iá»‡n thoáº¡i ná»™i bá»™',
  `role_id` int NOT NULL COMMENT 'FK â†’ roles.id',
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL áº£nh Ä‘áº¡i diá»‡n',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=Ä‘ang hoáº¡t Ä‘á»™ng, 0=Ä‘Ã£ khoÃ¡ tÃ i khoáº£n',
  `last_login_at` datetime DEFAULT NULL COMMENT 'Thá»i Ä‘iá»ƒm Ä‘Äƒng nháº­p láº§n cuá»‘i',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã nhân viên tự sinh: NV-001, NV-002, ... (dùng bảng lương, in phiếu)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_users_role_id` (`role_id`),
  KEY `idx_users_is_active` (`is_active`),
  KEY `idx_users_code` (`code`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TÃ i khoáº£n nhÃ¢n viÃªn, dÆ°á»£c sÄ©, quáº£n trá»‹ viÃªn';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin@minhgiangpharma.vn','$2a$12$WAgtDVLiScu3lBpM4ZcMyuB98hGVGl0x8G/u5YrFlsTUUKwD7KI/y','Nguyễn Thị Duyên','0901234567',1,NULL,1,'2026-04-20 16:33:33','2026-03-31 18:42:51','2026-04-20 16:33:33','NV-001'),(2,'duocsi_lan','thi.lan@minhgiangpharma.vn','$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy','Tráº§n Thá»‹ Lan','0912345678',2,NULL,1,'2026-04-11 05:16:09','2026-03-31 18:42:51','2026-04-11 05:16:09','NV-002'),(3,'thugan_minh','van.minh@minhgiangpharma.vn','$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy','LÃª VÄƒn Minh','0923456789',3,NULL,1,'2026-04-12 04:43:47','2026-03-31 18:42:51','2026-04-12 04:43:47','NV-003'),(4,'nhanvien_hoa','thi.hoa@minhgiangpharma.vn','$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy','Pháº¡m Thá»‹ Hoa','0934567890',4,NULL,1,NULL,'2026-03-31 18:42:51','2026-04-11 02:59:17','NV-004'),(5,'duocsi_tuan','manh.tuan@minhgiangpharma.vn','$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy','Äá»— Máº¡nh Tuáº¥n','0945678901',2,NULL,1,'2026-04-11 03:10:39','2026-03-31 18:42:51','2026-04-11 03:10:39','NV-005'),(6,'nhanvien_test','test@minhgiang.vn','$2a$10$rjUmtebKyfVdVb94a0WrlekLHY1QD3DI9pM6AaiI7cFmEIIAz4wF2','Nhân Viên Test','0999888777',3,NULL,1,NULL,'2026-04-10 13:52:08','2026-04-10 13:52:08',NULL),(7,'staff_api_test_01_u','staff01u@minhgiang.vn','$2a$10$lIGJaurdSerRSkK4SnmQKeJhCo/d46a9r7tXzPoVNCZrfdaoYDMQS','Staff API Updated','0900000099',3,NULL,1,NULL,'2026-04-10 13:56:35','2026-04-10 14:00:13',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-21 18:23:29
