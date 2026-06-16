-- ============================================================
-- Seed 97: Dữ liệu demo cho bảng promotions (Vouchers + Gift Campaigns)
-- Chạy sau migration 96
-- ============================================================
USE mg_cms;

-- Xóa demo cũ nếu có (chỉ xóa các bản ghi demo)
DELETE FROM promotions WHERE code IN (
  'MINGIANG50','FREESHIP99','DOCTORVIP','TET2026',
  'SUMMER20','WELCOME10'
) OR name LIKE 'Gift:%';

-- ── VOUCHERS ──────────────────────────────────────────────────
INSERT INTO promotions
  (name, campaign_name, code, type, discount_value,
   min_order_value, max_discount_amount,
   applicable_to, usage_limit, usage_count,
   start_date, end_date, is_active, applicable_channel)
VALUES
-- 1. Khai trương Cơ sở 3
('Giảm 50% Khai Trương', 'Khai trương Cơ sở 3 - Q.7', 'MINGIANG50',
 'percent_discount', 50, 500000, 200000,
 'all', 100, 72,
 DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY),
 1, 'all'),

-- 2. Freeship tháng 3
('Miễn Phí Vận Chuyển', 'Miễn phí vận chuyển tháng này', 'FREESHIP99',
 'free_shipping', 30000, 299000, 30000,
 'all', 500, 120,
 DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 22 DAY),
 1, 'web'),

-- 3. Doctor VIP
('Giảm 15% Thành Viên Vàng', 'Ưu đãi dành riêng cho Thành viên Vàng+', 'DOCTORVIP',
 'percent_discount', 15, 1000000, NULL,
 'all', 100, 31,
 DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 112 DAY),
 1, 'all'),

-- 4. Tết 2026 (đã hết hạn)
('Giảm 100k Tết Bính Ngọ', 'Voucher Tết Bính Ngọ', 'TET2026',
 'fixed_discount', 100000, 800000, NULL,
 'all', 200, 200,
 DATE_SUB(NOW(), INTERVAL 180 DAY), DATE_SUB(NOW(), INTERVAL 150 DAY),
 0, 'all'),

-- 5. Summer 20%
('Giảm 20% Hè 2026', 'Khuyến mãi mùa hè', 'SUMMER20',
 'percent_discount', 20, 300000, 150000,
 'all', 300, 0,
 NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY),
 1, 'all'),

-- 6. Chào mừng khách mới
('Giảm 10% Đơn Đầu Tiên', 'Ưu đãi khách hàng mới', 'WELCOME10',
 'percent_discount', 10, 150000, NULL,
 'all', NULL, 89,
 DATE_SUB(NOW(), INTERVAL 90 DAY), DATE_ADD(NOW(), INTERVAL 275 DAY),
 1, 'web');

-- ── GIFT CAMPAIGNS (buy_x_get_y) ─────────────────────────────
INSERT INTO promotions
  (name, campaign_name, code, type, discount_value,
   min_order_value, max_discount_amount,
   applicable_to, usage_limit, usage_count,
   start_date, end_date, is_active, applicable_channel,
   gift_product_name, gift_product_qty)
VALUES
-- Gift 1: Đang chạy
('Gift: Thuốc Bổ + Nước Súc Miệng', NULL, NULL,
 'buy_x_get_y', 0, 500000, NULL,
 'all', NULL, 84,
 DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 21 DAY),
 1, 'all',
 'Nước Súc Miệng Listerine 250ml', 1),

-- Gift 2: Đang chạy
('Gift: Vitamin Tổng Hợp + Vitamin C', NULL, NULL,
 'buy_x_get_y', 0, 0, NULL,
 'specific_categories', NULL, 27,
 DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_ADD(NOW(), INTERVAL 17 DAY),
 1, 'pos',
 'Vitamin C DHG 1000mg', 1),

-- Gift 3: Đã kết thúc
('Gift: Tim Mạch + Sổ Sức Khỏe', NULL, NULL,
 'buy_x_get_y', 0, 1000000, NULL,
 'all', NULL, 156,
 DATE_SUB(NOW(), INTERVAL 120 DAY), DATE_SUB(NOW(), INTERVAL 90 DAY),
 0, 'all',
 'Sổ Tay Sức Khỏe Minh Giang', 1),

-- Gift 4: Đã kết thúc
('Gift: Kem Chống Nắng + Son Dưỡng', NULL, NULL,
 'buy_x_get_y', 0, 0, NULL,
 'all', NULL, 92,
 DATE_SUB(NOW(), INTERVAL 165 DAY), DATE_SUB(NOW(), INTERVAL 105 DAY),
 0, 'web',
 'Son Dưỡng SPF15', 1);

SELECT CONCAT('Đã seed ', COUNT(*), ' promotions') AS result FROM promotions;
