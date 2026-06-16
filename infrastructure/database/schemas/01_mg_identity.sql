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
  `customer_id` bigint NOT NULL COMMENT 'FK → customers.id',
  `receiver_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên người nhận hàng',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SĐT người nhận',
  `province` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tỉnh/Thành phố',
  `district` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Quận/Huyện',
  `ward` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Phường/Xã',
  `street_address` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Số nhà, tên đường, tòa nhà...',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=địa chỉ mặc định của khách',
  PRIMARY KEY (`id`),
  KEY `idx_customer_addresses_customer_id` (`customer_id`),
  KEY `idx_customer_addresses_is_default` (`customer_id`,`is_default`),
  CONSTRAINT `fk_customer_addresses_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh sách địa chỉ giao hàng của khách hàng';
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
  `full_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Họ và tên khách hàng',
  `email` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Email đăng ký tài khoản',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Số điện thoại (dùng đăng nhập & liên hệ)',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bcrypt hash của mật khẩu',
  `date_of_birth` date DEFAULT NULL COMMENT 'Ngày sinh (dùng tính tuổi và sinh nhật)',
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Giới tính',
  `loyalty_points` int NOT NULL DEFAULT '0' COMMENT 'Điểm tích luỹ (10.000đ = 1 điểm)',
  `loyalty_tier` enum('member','silver','gold','vip') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member' COMMENT 'Hạng thành viên: member(0-499đ), silver(500-1999đ), gold(2000-4999đ), vip(5000+đ)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=hoạt động, 0=đã khoá',
  `email_verified_at` datetime DEFAULT NULL COMMENT 'Thời điểm khách hàng xác thực email bằng OTP',
  `phone_verified_at` datetime DEFAULT NULL COMMENT 'Thời điểm khách hàng xác thực số điện thoại bằng OTP',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete — NULL=đang hoạt động, non-NULL=đã xoá mềm (tuân thủ Nghị định 13/2023/NĐ-CP bảo vệ DLCN)',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã khách hàng tự sinh: KH-0001, KH-0002, ... (dùng CRM, print bill)',
  `zalo_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Zalo OAuth user ID',
  `notes` text DEFAULT NULL COMMENT 'Ghi chú nội bộ',
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
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tài khoản khách hàng web và chương trình khách hàng thân thiết';
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
  `tier_code` enum('member','silver','gold','vip') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã hạng — khớp với customers.loyalty_tier',
  `tier_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên hiển thị: Thành viên, Bạc, Vàng, VIP',
  `tier_icon` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '🏆' COMMENT 'Emoji icon hạng',
  `min_spending` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Chi tiêu tối thiểu để đạt hạng này (VND)',
  `max_spending` decimal(15,2) DEFAULT NULL COMMENT 'Chi tiêu tối đa (NULL = không giới hạn — hạng VIP)',
  `points_ratio` decimal(5,2) NOT NULL DEFAULT '1.00' COMMENT 'Tỷ lệ tích điểm: 1.0 = 1đ/10.000đ, 1.5 = 1.5đ/10.000đ',
  `points_per_vnd` int NOT NULL DEFAULT '10000' COMMENT 'Số VND để tích 1 điểm theo tỷ lệ cơ sở',
  `discount_pct` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '% giảm giá tự động cho hạng (0=không giảm)',
  `description` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mô tả quyền lợi hạng thành viên',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `points_expiry_months` int DEFAULT '12' COMMENT 'Số tháng sau khi cộng thì điểm tự hết hạn (mặc định 12 tháng)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loyalty_tier_config_code` (`tier_code`),
  KEY `idx_loyalty_config_expiry` (`points_expiry_months`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cấu hình hạng thành viên loyalty — ngưỡng chi tiêu và tỷ lệ tích điểm';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loyalty_tier_config`
--

LOCK TABLES `loyalty_tier_config` WRITE;
/*!40000 ALTER TABLE `loyalty_tier_config` DISABLE KEYS */;
INSERT INTO `loyalty_tier_config` VALUES (1,'member','Thành viên','⭐',0.00,4999999.00,1.00,10000,0.00,'Hạng cơ bản, tích 1 điểm cho mỗi 10.000đ chi tiêu','2026-03-31 18:42:51',12),(2,'silver','Bạc','🥈',5000000.00,19999999.00,1.50,10000,2.00,'Chi tiêu 5tr+, tích 1.5 điểm/10.000đ, giảm 2% tự động','2026-03-31 18:42:51',12),(3,'gold','Vàng','🥇',20000000.00,49999999.00,2.00,10000,5.00,'Chi tiêu 20tr+, tích 2 điểm/10.000đ, giảm 5% tự động','2026-03-31 18:42:51',12),(4,'vip','VIP','💎',50000000.00,NULL,3.00,10000,10.00,'Chi tiêu 50tr+, tích 3 điểm/10.000đ, giảm 10% tự động, ưu tiên giao hàng','2026-03-31 18:42:51',12);
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
  `target` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SĐT hoặc email nhận OTP',
  `target_type` enum('phone','email') COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bcrypt/SHA-256 hash của mã OTP, KHÔNG lưu plaintext',
  `purpose` enum('register','reset_password','verify_email','pos_confirm') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mục đích sử dụng OTP',
  `attempts` int NOT NULL DEFAULT '0' COMMENT 'Số lần nhập sai (khoá sau 5 lần)',
  `expires_at` datetime NOT NULL COMMENT 'Thời điểm OTP hết hiệu lực (thường +5 phút)',
  `used_at` datetime DEFAULT NULL COMMENT 'Thời điểm OTP được dùng thành công (NULL=chưa dùng)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `send_count_today` int NOT NULL DEFAULT '0' COMMENT 'Số OTP đã gửi hôm nay đến target này — reset lúc 00:00 mỗi ngày',
  `last_send_at` datetime DEFAULT NULL COMMENT 'Thời điểm gửi OTP gần nhất đến target — dùng kiểm tra cooldown (ít nhất 60s giữa 2 lần gửi)',
  `blocked_until` datetime DEFAULT NULL COMMENT 'Target bị khoá nhận OTP đến thời điểm này — exponential backoff sau 3 lần thất bại',
  PRIMARY KEY (`id`),
  KEY `idx_otp_codes_target` (`target`,`target_type`),
  KEY `idx_otp_codes_purpose` (`purpose`),
  KEY `idx_otp_codes_expires_at` (`expires_at`),
  KEY `idx_otp_target_date` (`target`,`target_type`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mã OTP tạm thời cho xác thực nhiều bước';
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
  `user_type` enum('staff','customer') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Phân biệt loại user để query đúng bảng',
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SHA-256 hash của refresh token, KHÔNG lưu raw token',
  `expires_at` datetime NOT NULL COMMENT 'Thời điểm token hết hạn',
  `revoked_at` datetime DEFAULT NULL COMMENT 'Thời điểm token bị thu hồi (NULL=còn hiệu lực)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_tokens_hash` (`token_hash`),
  KEY `idx_refresh_tokens_user` (`user_id`,`user_type`),
  KEY `idx_refresh_tokens_expires_at` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Refresh token cho xác thực JWT, hỗ trợ cả staff và customer';
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
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên vai trò: admin, pharmacist, cashier, staff',
  `description` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mô tả vai trò',
  `permissions` json DEFAULT NULL COMMENT 'JSON array chứa danh sách mã quyền, VD: ["orders.view","inventory.edit"]',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng vai trò & quyền hạn nhân viên';
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
  `user_id` bigint NOT NULL COMMENT 'FK → users.id — nhân viên trực ca',
  `kiosk_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã máy POS: Kiosk #01, Kiosk #02...',
  `shift_start` datetime NOT NULL COMMENT 'Thời điểm bắt đầu ca',
  `shift_end` datetime DEFAULT NULL COMMENT 'Thời điểm kết thúc ca (NULL nếu ca đang mở)',
  `opening_cash` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Tiền mặt đầu ca kiểm đếm',
  `closing_cash` decimal(12,2) DEFAULT NULL COMMENT 'Tiền mặt cuối ca kiểm đếm',
  `total_cash_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Tổng doanh thu tiền mặt trong ca',
  `total_card_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Tổng doanh thu thẻ/visa trong ca',
  `total_qr_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Tổng doanh thu QR/chuyển khoản trong ca',
  `status` enum('open','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open' COMMENT 'Trạng thái ca: open=đang trực, closed=đã kết ca',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chú bàn giao ca',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expected_closing_cash` decimal(12,2) DEFAULT NULL COMMENT 'Tiền cuối ca theo hệ thống = opening_cash + total_cash_sales - refunds',
  `cash_difference` decimal(12,2) DEFAULT NULL COMMENT 'Chênh lệch = closing_cash - expected_closing_cash (âm=thiếu, dương=thừa)',
  `reconciliation_status` enum('pending','matched','excess','shortage','approved') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'Kết quả đối soát: matched=khớp, excess=thừa, shortage=thiếu, approved=đã duyệt',
  `approved_by` bigint DEFAULT NULL COMMENT '(Cross-schema) mg_identity.users.id — quản lý duyệt lệch ca',
  `approved_at` datetime DEFAULT NULL COMMENT 'Thời điểm quản lý duyệt lệch ca',
  `approval_note` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chú của quản lý khi duyệt lệch ca',
  PRIMARY KEY (`id`),
  KEY `idx_shifts_user_id` (`user_id`),
  KEY `idx_shifts_kiosk_id` (`kiosk_id`),
  KEY `idx_shifts_status` (`status`),
  KEY `idx_shifts_shift_start` (`shift_start`),
  CONSTRAINT `fk_shifts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ca làm việc của nhân viên tại quầy POS';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên đăng nhập (không dấu, không khoảng trắng)',
  `email` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Email làm việc',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bcrypt hash của mật khẩu, KHÔNG lưu plaintext',
  `full_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Họ và tên đầy đủ',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Số điện thoại nội bộ',
  `role_id` int NOT NULL COMMENT 'FK → roles.id',
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL ảnh đại diện',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=đang hoạt động, 0=đã khoá tài khoản',
  `last_login_at` datetime DEFAULT NULL COMMENT 'Thời điểm đăng nhập lần cuối',
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tài khoản nhân viên, dược sĩ, quản trị viên';
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
