-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: mg_notification
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
-- Current Database: `mg_notification`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `mg_notification` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `mg_notification`;

--
-- Table structure for table `notification_templates`
--

DROP TABLE IF EXISTS `notification_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên template định danh',
  `channel` enum('email','sms','push','in_app','zalo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'email' COMMENT 'Kênh gửi: email | sms | push | in_app | zalo (Zalo ZNS)',
  `subject` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tiêu đề email/push notification',
  `body_template` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nội dung mẫu với biến {{variable}}',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_templates_name_channel` (`name`,`channel`),
  KEY `idx_notification_templates_name` (`name`),
  KEY `idx_notification_templates_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_templates`
--

LOCK TABLES `notification_templates` WRITE;
/*!40000 ALTER TABLE `notification_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `template_id` int NOT NULL,
  `recipient_type` enum('customer','staff','admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_id` bigint NOT NULL,
  `channel` enum('email','sms','push','in_app','zalo') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint DEFAULT NULL,
  `payload` json NOT NULL,
  `status` enum('pending','sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_template_id` (`template_id`),
  KEY `idx_notifications_recipient` (`recipient_type`,`recipient_id`),
  KEY `idx_notifications_status` (`status`),
  KEY `idx_notifications_reference` (`reference_type`,`reference_id`),
  KEY `idx_notifications_created_at` (`created_at`),
  CONSTRAINT `fk_notifications_template` FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-21 18:23:52
