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
-- Seed data for table `customer_addresses` intentionally omitted.
--

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
  `email_verified_at` datetime DEFAULT NULL COMMENT 'Thời điểm khách hàng xác thực email bằng OTP',
  `phone_verified_at` datetime DEFAULT NULL COMMENT 'Thời điểm khách hàng xác thực số điện thoại bằng OTP',
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
-- Seed data for table `customers` intentionally omitted.
--

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
  `customer_id` bigint NOT NULL COMMENT 'FK → customers.id',
  `transaction_type` enum('earn_purchase','earn_bonus','redeem','adjust_add','adjust_deduct','expire') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Loại giao dịch điểm',
  `points_change` int NOT NULL COMMENT 'Số điểm thay đổi: dương=cộng, âm=trừ',
  `description` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mô tả giao dịch điểm',
  `reference_order_id` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_order.orders.id — đơn hàng phát sinh điểm',
  `adjusted_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id — admin điều chỉnh',
  `admin_note` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chú của admin khi điều chỉnh điểm',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `idempotency_key` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UUID dùng một lần để chống duplicate request',
  `expires_at` datetime DEFAULT NULL COMMENT 'Thời điểm điểm hết hạn sử dụng',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loyalty_idempotency` (`customer_id`,`idempotency_key`),
  KEY `idx_loyalty_pts_txn_customer_id` (`customer_id`),
  KEY `idx_loyalty_pts_txn_type` (`transaction_type`),
  KEY `idx_loyalty_pts_txn_created_at` (`created_at`),
  KEY `idx_loyalty_transactions_expires_at` (`customer_id`,`expires_at`),
  CONSTRAINT `fk_loyalty_pts_txn_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử giao dịch điểm tích luỹ loyalty của từng khách hàng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Seed data for table `loyalty_points_transactions` intentionally omitted.
--

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
-- Seed data for table `otp_codes` intentionally omitted.
--

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
-- Seed data for table `refresh_tokens` intentionally omitted.
--

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
INSERT INTO `roles` VALUES (1,'admin','Quản trị viên hệ thống toàn quyền','[\"dashboard.view\", \"inventory.view\", \"inventory.edit\", \"orders.view\", \"orders.edit\", \"customers.view\", \"customers.edit\", \"reports.view\", \"settings.edit\", \"users.manage\"]','2026-03-31 18:42:51'),(2,'pharmacist','Dược sĩ quản lý thuốc và tồn kho','[\"dashboard.view\", \"inventory.view\", \"inventory.edit\", \"batches.view\", \"batches.edit\", \"products.view\", \"products.edit\", \"orders.view\"]','2026-03-31 18:42:51'),(3,'cashier','Thu ngân bán hàng tại quầy POS','[\"pos.access\", \"orders.create\", \"orders.view\", \"customers.view\"]','2026-03-31 18:42:51'),(4,'staff','Nhân viên kho nhập xuất kho','[\"inventory.view\", \"batches.view\", \"batches.edit\", \"orders.view\", \"orders.fulfillment\"]','2026-03-31 18:42:51');
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
-- Seed data for table `shifts` intentionally omitted.
--
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
INSERT INTO `users` VALUES (1,'admin','admin@minhgiangpharma.vn','$2a$12$WAgtDVLiScu3lBpM4ZcMyuB98hGVGl0x8G/u5YrFlsTUUKwD7KI/y','Nguyễn Thị Duyên','0901234567',1,NULL,1,'2026-04-20 16:33:33','2026-03-31 18:42:51','2026-04-20 16:33:33','NV-001'),(2,'duocsi_lan','thi.lan@minhgiangpharma.vn','$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy','Trần Thị Lan','0912345678',2,NULL,1,'2026-04-11 05:16:09','2026-03-31 18:42:51','2026-04-11 05:16:09','NV-002'),(3,'thungan_minh','van.minh@minhgiangpharma.vn','$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy','Lê Văn Minh','0923456789',3,NULL,1,'2026-04-12 04:43:47','2026-03-31 18:42:51','2026-04-12 04:43:47','NV-003'),(4,'nhanvien_hoa','thi.hoa@minhgiangpharma.vn','$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy','Phạm Thị Hoa','0934567890',4,NULL,1,NULL,'2026-03-31 18:42:51','2026-04-11 02:59:17','NV-004'),(5,'duocsi_tuan','manh.tuan@minhgiangpharma.vn','$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy','Đỗ Mạnh Tuấn','0945678901',2,NULL,1,'2026-04-11 03:10:39','2026-03-31 18:42:51','2026-04-11 03:10:39','NV-005');
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
