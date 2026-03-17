-- =============================================================================
-- SCHEMA: mg_notification
-- Mục đích: Quản lý thông báo đa kênh (email, SMS, push, in-app)
-- Bao gồm: Template thông báo, Hàng đợi gửi thông báo
-- Phụ thuộc: Không có DB-level FK sang schema khác (enforce tại app layer)
-- Được thiết kế để nhận events qua RabbitMQ từ các service khác
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_notification
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_notification;

-- =============================================================================
-- BẢNG: notification_templates
-- Template thông báo cho từng sự kiện nghiệp vụ
-- Hỗ trợ biến động {{variable}} để render nội dung thực tế
-- =============================================================================
CREATE TABLE notification_templates (
    id              INT             NOT NULL AUTO_INCREMENT,
    name            VARCHAR(100)    NOT NULL    COMMENT 'Tên template định danh, VD: order_confirmed, low_stock_alert',
    channel         ENUM('email','sms','push','in_app') NOT NULL
                                                COMMENT 'Kênh gửi thông báo',
    subject         VARCHAR(300)                COMMENT 'Tiêu đề email/push notification (NULL với SMS)',
    body_template   TEXT            NOT NULL    COMMENT 'Nội dung mẫu với biến {{tên_biến}}, VD: "Đơn hàng {{order_code}} đã được xác nhận"',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    UNIQUE KEY uq_notification_templates_name_channel (name, channel),
    INDEX idx_notification_templates_name (name),
    INDEX idx_notification_templates_is_active (is_active)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Template nội dung thông báo cho từng sự kiện và kênh gửi';

-- =============================================================================
-- BẢNG: notifications
-- Hàng đợi gửi thông báo — mỗi dòng là 1 thông báo cụ thể cần gửi
-- Service này consume events từ RabbitMQ → tạo dòng ở đây → gửi đi
-- =============================================================================
CREATE TABLE notifications (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    template_id         INT             NOT NULL    COMMENT 'FK → notification_templates.id',
    recipient_type      ENUM('customer','staff','admin') NOT NULL
                                                    COMMENT 'Loại người nhận để lấy thông tin liên hệ đúng',
    -- Cross-schema: mg_identity.customers.id hoặc mg_identity.users.id
    recipient_id        BIGINT          NOT NULL    COMMENT '(Cross-schema) ID của người nhận theo recipient_type',
    channel             ENUM('email','sms','push','in_app') NOT NULL,
    reference_type      VARCHAR(50)                 COMMENT 'Loại đối tượng tham chiếu: order, batch, product, shift...',
    reference_id        BIGINT                      COMMENT 'ID của đối tượng tham chiếu',
    payload             JSON            NOT NULL    COMMENT 'Dữ liệu thực tế điền vào template, VD: {"order_code":"WEB-001","total":"500000"}',
    status              ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending'
                                                    COMMENT 'Trạng thái gửi: pending=chờ gửi, sent=đã gửi, failed=thất bại',
    sent_at             DATETIME                    COMMENT 'Thời điểm gửi thành công',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_notifications_template_id (template_id),
    INDEX idx_notifications_recipient (recipient_type, recipient_id),
    INDEX idx_notifications_status (status),
    INDEX idx_notifications_reference (reference_type, reference_id),
    INDEX idx_notifications_created_at (created_at),

    CONSTRAINT fk_notifications_template
        FOREIGN KEY (template_id) REFERENCES notification_templates(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Hàng đợi thông báo chờ gửi và lịch sử gửi thông báo';

-- =============================================================================
-- DỮ LIỆU MẪU: mg_notification
-- =============================================================================

-- Templates thông báo
INSERT INTO notification_templates (name, channel, subject, body_template, is_active) VALUES
-- Xác nhận đơn hàng Online
(
    'order_confirmed',
    'email',
    'Nhà thuốc Minh Giang — Đơn hàng {{order_code}} đã được xác nhận',
    'Xin chào {{customer_name}},\n\nĐơn hàng {{order_code}} của bạn đã được xác nhận và đang được chuẩn bị.\n\nGiá trị đơn: {{total_amount}} VNĐ\nDự kiến giao: {{estimated_delivery}}\n\nCảm ơn bạn đã tin tưởng Nhà thuốc Minh Giang!\n\nHotline: 1800 6821',
    1
),
(
    'order_confirmed',
    'sms',
    NULL,
    'NhaThuocMinhGiang: Don hang {{order_code}} da xac nhan. Tong tien: {{total_amount}}d. Theo doi: minhgiangpharma.vn/don-hang',
    1
),
-- Đơn hàng đang giao
(
    'order_shipping',
    'email',
    'Đơn hàng {{order_code}} đang trên đường giao đến bạn',
    'Xin chào {{customer_name}},\n\nĐơn hàng {{order_code}} đã được bàn giao cho đơn vị vận chuyển và đang trên đường đến địa chỉ của bạn.\n\nMã theo dõi: {{tracking_code}}\n\nDự kiến nhận: Hôm nay hoặc ngày mai.',
    1
),
-- Đơn hàng hoàn thành
(
    'order_completed',
    'email',
    'Đơn hàng {{order_code}} đã giao thành công — Đánh giá sản phẩm nhé!',
    'Xin chào {{customer_name}},\n\nĐơn hàng {{order_code}} đã được giao thành công.\n\nBạn nhận được {{loyalty_points_earned}} điểm thưởng. Tổng điểm: {{total_loyalty_points}}\n\nHãy chia sẻ trải nghiệm của bạn để giúp các khách hàng khác nhé!',
    1
),
-- Cảnh báo tồn kho thấp
(
    'low_stock_alert',
    'in_app',
    'Cảnh báo: Tồn kho thấp — {{product_name}}',
    'Sản phẩm {{product_name}} (SKU: {{sku}}) đang có tồn kho thấp.\n\nTồn hiện tại: {{current_stock}} {{base_unit}}\nNgưỡng cảnh báo: {{min_stock_alert}} {{base_unit}}\n\nVui lòng kiểm tra và lên đơn nhập hàng.',
    1
),
-- Cảnh báo hàng cận hạn
(
    'expiry_alert',
    'in_app',
    'Cảnh báo: Hàng cận hạn sử dụng — {{product_name}}',
    'Lô hàng {{lot_number}} của sản phẩm {{product_name}} sắp hết hạn.\n\nHạn sử dụng: {{expiry_date}}\nSố lượng còn lại: {{quantity_remaining}} {{base_unit}}\nVị trí: {{location_label}}\n\nVui lòng xem xét thanh lý hoặc trả NCC.',
    1
),
-- Thông báo kết ca
(
    'shift_close_summary',
    'email',
    'Tổng kết ca làm việc — Kiosk {{kiosk_id}} — {{shift_date}}',
    'Kính gửi Quản lý,\n\nCa làm việc tại {{kiosk_id}} vừa kết thúc:\n- Nhân viên: {{staff_name}}\n- Giờ làm: {{shift_start}} - {{shift_end}}\n- Doanh thu tiền mặt: {{total_cash}}đ\n- Doanh thu thẻ/QR: {{total_card_qr}}đ\n- Tổng doanh thu: {{total_sales}}đ\n- Số đơn: {{order_count}} đơn',
    1
),
-- Chào mừng khách hàng mới
(
    'customer_welcome',
    'email',
    'Chào mừng đến với Nhà thuốc Minh Giang, {{customer_name}}!',
    'Xin chào {{customer_name}},\n\nCảm ơn bạn đã đăng ký tài khoản tại Nhà thuốc Minh Giang.\n\nTài khoản của bạn đã được tạo thành công với:\n- Email: {{email}}\n- Hạng thành viên: Member\n\nSử dụng mã WELCOME10 để nhận ưu đãi 10% cho đơn hàng đầu tiên!\n\nMinhGiang Pharmacy — Sức khoẻ cho mọi nhà.',
    1
),
-- OTP đặt lại mật khẩu
(
    'password_reset_otp',
    'sms',
    NULL,
    'MinhGiang: Ma xac nhan dat lai mat khau cua ban la {{otp_code}}. Co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.',
    1
);

-- Thông báo mẫu đã gửi
INSERT INTO notifications (template_id, recipient_type, recipient_id, channel, reference_type, reference_id, payload, status, sent_at) VALUES
(
    1, 'customer', 2, 'email', 'order', 4,
    '{"customer_name":"Trần Văn Hùng","order_code":"WEB-260316-001","total_amount":"880.000","estimated_delivery":"18/03/2026"}',
    'sent', '2026-03-16 14:32:00'
),
(
    2, 'customer', 2, 'sms', 'order', 4,
    '{"order_code":"WEB-260316-001","total_amount":"880,000"}',
    'sent', '2026-03-16 14:32:05'
),
(
    5, 'staff', 2, 'in_app', 'product', 6,
    '{"product_name":"Cetirizine 10mg Hộp 30 viên","sku":"MED-0006","current_stock":"245","base_unit":"Viên","min_stock_alert":"25"}',
    'sent', '2026-03-17 07:15:00'
),
(
    4, 'customer', 4, 'email', 'order', 5,
    '{"customer_name":"Phạm Công Danh","order_code":"WEB-260315-001","loyalty_points_earned":"153","total_loyalty_points":"5753"}',
    'sent', '2026-03-16 20:00:00'
),
(
    7, 'admin', 1, 'email', 'shift', 1,
    '{"kiosk_id":"Kiosk #01","staff_name":"Lê Văn Minh","shift_date":"17/03/2026","shift_start":"07:00","shift_end":"15:00","total_cash":"3.125.000","total_card_qr":"1.125.000","total_sales":"4.250.000","order_count":"12"}',
    'sent', '2026-03-17 15:05:00'
),
(
    6, 'staff', 2, 'in_app', 'batch_item', 8,
    '{"product_name":"Actifed Syrup Lọ 100ml","lot_number":"ACT-GS-260201","expiry_date":"01/08/2027","quantity_remaining":"31","base_unit":"Chai","location_label":"OTC Zone / Tủ OTC-1 / Tầng giữa"}',
    'pending', NULL
),
(
    8, 'customer', 3, 'email', 'customer', 3,
    '{"customer_name":"Lê Thị Thu Hương","email":"thuhuong.le@gmail.com"}',
    'sent', '2026-03-17 10:23:00'
);


-- -----------------------------------------------------------------------------
-- PATCH -- bo sung bang/cot (da hop nhat, khong chay rieng nua)
-- -----------------------------------------------------------------------------

-- =============================================================================
-- PATCH: mg_notification — Bổ sung kênh Zalo và mẫu thông báo Zalo
-- ALTER: notification_templates.channel + notifications.channel
-- =============================================================================

USE mg_notification;

-- =============================================================================
-- ALTER notification_templates — thêm 'zalo' vào ENUM channel
-- MySQL yêu cầu liệt kê lại toàn bộ giá trị ENUM khi MODIFY
-- =============================================================================
ALTER TABLE notification_templates
    MODIFY COLUMN channel
        ENUM('email','sms','push','in_app','zalo') NOT NULL DEFAULT 'email'
        COMMENT 'Kênh gửi: email | sms | push | in_app | zalo (Zalo ZNS)';

-- =============================================================================
-- ALTER notifications — thêm 'zalo' vào ENUM channel
-- =============================================================================
ALTER TABLE notifications
    MODIFY COLUMN channel
        ENUM('email','sms','push','in_app','zalo') NOT NULL
        COMMENT 'Kênh đã gửi: email | sms | push | in_app | zalo';

-- =============================================================================
-- Bổ sung 4 mẫu thông báo kênh Zalo (Zalo ZNS — Zalo Notification Service)
-- ZNS yêu cầu nội dung template được Zalo phê duyệt, dùng placeholder {{key}}
-- =============================================================================
INSERT INTO notification_templates (name, channel, subject, body_template, is_active) VALUES

-- Xác nhận đặt hàng qua Zalo
('order_confirm_zalo', 'zalo',
 'Xác nhận đơn hàng {{order_code}}',
 'Xin chào {{customer_name}},\n\nNhà Thuốc Minh Giang xác nhận đã nhận đơn hàng {{order_code}} của bạn.\n\n📦 Tổng tiền: {{total_amount}}đ\n🚚 Dự kiến giao: {{expected_delivery}}\n\nTheo dõi đơn hàng: {{tracking_url}}\nHỗ trợ: 028 1234 5678',
 1),

-- Thông báo giao hàng đang vận chuyển qua Zalo
('shipping_update_zalo', 'zalo',
 'Đơn hàng {{order_code}} đang được giao',
 'Xin chào {{customer_name}},\n\nĐơn hàng {{order_code}} của bạn đang trên đường giao đến địa chỉ:\n📍 {{delivery_address}}\n\n🕐 Dự kiến: {{expected_time}}\n👤 Tài xế: {{driver_name}} — {{driver_phone}}\n\nVui lòng giữ điện thoại để nhận hàng.\nHỗ trợ: 028 1234 5678',
 1),

-- Nhắc tái mua thuốc định kỳ qua Zalo (upsell/retention)
('refill_reminder_zalo', 'zalo',
 'Nhắc lấy thuốc định kỳ — {{product_name}}',
 'Xin chào {{customer_name}},\n\nTheo lịch uống thuốc, bạn sắp hết {{product_name}}.\n\n💊 Sản phẩm: {{product_name}}\n🔢 Số lượng gợi ý: {{suggest_qty}}\n💰 Giá: {{price}}đ\n\nĐặt ngay để giao tận nhà hôm nay: {{order_link}}\n\nCần tư vấn? Chat với dược sĩ: {{chat_link}}',
 1),

-- Voucher / khuyến mãi đặc biệt gửi qua Zalo
('promotion_voucher_zalo', 'zalo',
 'Ưu đãi đặc biệt dành riêng cho bạn 🎁',
 'Xin chào {{customer_name}},\n\nNhà Thuốc Minh Giang gửi tặng bạn ưu đãi đặc biệt:\n\n🎁 MÃ GIẢM GIÁ: {{voucher_code}}\n💰 Giảm: {{discount_amount}}\n📅 Hiệu lực: {{valid_from}} — {{valid_to}}\n📋 Điều kiện: {{condition_text}}\n\nÁp dụng ngay: {{shop_url}}\n\nMọi thắc mắc liên hệ: 028 1234 5678',
 1);
