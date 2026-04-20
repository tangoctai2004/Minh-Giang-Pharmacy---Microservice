-- =============================================================================
-- SCHEMA: mg_notification
-- Mục đích: Quản lý thông báo đa kênh (email, SMS, push, in-app, zalo)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_notification
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_notification;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS notification_templates;

-- =============================================================================
-- BẢNG: notification_templates
-- =============================================================================
CREATE TABLE notification_templates (
    id              INT             NOT NULL AUTO_INCREMENT,
    name            VARCHAR(100)    NOT NULL    COMMENT 'Tên template định danh',
    channel         ENUM('email','sms','push','in_app','zalo') NOT NULL DEFAULT 'email'
                                                COMMENT 'Kênh gửi: email | sms | push | in_app | zalo (Zalo ZNS)',
    subject         VARCHAR(300)                COMMENT 'Tiêu đề email/push notification',
    body_template   TEXT            NOT NULL    COMMENT 'Nội dung mẫu với biến {{variable}}',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    UNIQUE KEY uq_notification_templates_name_channel (name, channel),
    INDEX idx_notification_templates_name (name),
    INDEX idx_notification_templates_is_active (is_active)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: notifications
-- =============================================================================
CREATE TABLE notifications (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    template_id         INT             NOT NULL,
    recipient_type      ENUM('customer','staff','admin') NOT NULL,
    recipient_id        BIGINT          NOT NULL,
    channel             ENUM('email','sms','push','in_app','zalo') NOT NULL,
    reference_type      VARCHAR(50),
    reference_id        BIGINT,
    payload             JSON            NOT NULL,
    status              ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
    sent_at             DATETIME,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_notifications_template_id (template_id),
    INDEX idx_notifications_recipient (recipient_type, recipient_id),
    INDEX idx_notifications_status (status),
    INDEX idx_notifications_reference (reference_type, reference_id),
    INDEX idx_notifications_created_at (created_at),

    CONSTRAINT fk_notifications_template FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
