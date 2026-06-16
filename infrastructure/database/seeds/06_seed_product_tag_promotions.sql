-- Seed data for product tag promotions (Flash Sale, Deal, Discount)
USE `mg_catalog`;

-- 1. Xóa cấu hình khuyến mãi cũ của các sản phẩm liên quan
DELETE FROM `product_tag_promotions` WHERE `product_id` IN (1, 2, 3, 5, 8, 10, 12, 13, 15, 16, 20, 22, 24, 25, 28, 30);

-- 2. Thêm dữ liệu cấu hình khuyến mãi mới cho nhiều sản phẩm
INSERT INTO `product_tag_promotions` 
  (`product_id`, `tag_name`, `discount_type`, `discount_value`, `campaign_qty`, `sold_qty`, `max_per_customer`, `start_time`, `end_time`, `status`)
VALUES
  -- ==========================================
  -- FLASH SALE (5 sản phẩm)
  -- ==========================================
  -- Product 3: Máy trợ thính Mimitakara -> Flash Sale giảm 20%
  (3, 'flash-sale', 'percentage', 20.00, 100, 15, 2, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
  -- Product 16: Máy đo huyết áp Omron -> Flash Sale giảm 15%
  (16, 'flash-sale', 'percentage', 15.00, 80, 10, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
  -- Product 13: Xe lăn ONE-X 608 -> Flash Sale giảm 25%
  (13, 'flash-sale', 'percentage', 25.00, 30, 2, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
  -- Product 30: Đệm chống loét Lucass -> Flash Sale giảm 30%
  (30, 'flash-sale', 'percentage', 30.00, 50, 4, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
  -- Product 12: Vớ đùi y khoa Duomed -> Flash Sale giảm 20%
  (12, 'flash-sale', 'percentage', 20.00, 120, 18, 2, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),

  -- ==========================================
  -- DEAL SIÊU KHỦNG (5 sản phẩm)
  -- ==========================================
  -- Product 5: Ống hít Cây Búa -> Deal siêu khủng giảm còn 65.000₫ (giá gốc 85.000đ)
  (5, 'deal', 'fixed_price', 65000.00, 200, 35, 5, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 'active'),
  -- Product 8: Bao cao su Pretex -> Deal giảm còn 120.000₫ (giá gốc 200.000đ)
  (8, 'deal', 'fixed_price', 120000.00, 150, 22, 3, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 'active'),
  -- Product 28: Dầu xanh Con Ó -> Deal giảm còn 95.000₫ (giá gốc 132.000đ)
  (28, 'deal', 'fixed_price', 95000.00, 100, 18, 2, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 'active'),
  -- Product 24: Gel rửa mặt La Roche-Posay -> Deal giảm còn 499.000₫ (giá gốc 655.000đ)
  (24, 'deal', 'fixed_price', 499000.00, 50, 8, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 'active'),
  -- Product 22: Bộ mở khí quan LPC -> Deal giảm còn 1.150.000₫ (giá gốc 1.500.000đ)
  (22, 'deal', 'fixed_price', 1150000.00, 20, 1, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 'active'),

  -- ==========================================
  -- DISCOUNT - GIẢM ĐẾN 38% THÁNG CỦA NÀNG (6 sản phẩm)
  -- ==========================================
  -- Product 2: Máy xông khí dung -> Giảm 10%
  (2, 'discount', 'percentage', 10.00, NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'active'),
  -- Product 15: Gel vệ sinh phụ nữ Malatra -> Giảm 15%
  (15, 'discount', 'percentage', 15.00, NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'active'),
  -- Product 20: Xà phòng Fixderma Salyzap -> Giảm 20%
  (20, 'discount', 'percentage', 20.00, NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'active'),
  -- Product 10: Thuốc VG-5 -> Giảm 12%
  (10, 'discount', 'percentage', 12.00, NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'active'),
  -- Product 25: Miếng dán hạ sốt Aikido -> Giảm 15%
  (25, 'discount', 'percentage', 15.00, NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'active'),
  -- Product 1: Que thử đường huyết OGCare -> Giảm 18%
  (1, 'discount', 'percentage', 18.00, NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'active');

-- 3. Cập nhật nhãn tag tương ứng trong bảng products (cho phép một sản phẩm có nhiều tag để map các phần trang chủ)
UPDATE `products` SET `tags` = JSON_ARRAY('flash-sale', 'best-seller', 'exclusive', 'y-te-ho-tro-khac', 'clean', 'source-review') WHERE `id` = 3;
UPDATE `products` SET `tags` = JSON_ARRAY('flash-sale', 'exclusive', 'y-te-may-do-huyet-ap', 'clean', 'source-review') WHERE `id` = 16;
UPDATE `products` SET `tags` = JSON_ARRAY('flash-sale', 'imported', 'y-te-xe-lan', 'clean', 'source-review') WHERE `id` = 13;
UPDATE `products` SET `tags` = JSON_ARRAY('flash-sale', 'best-seller', 'y-te-chong-loet', 'clean', 'source-review') WHERE `id` = 30;
UPDATE `products` SET `tags` = JSON_ARRAY('flash-sale', 'best-seller', 'y-te-dai-nep', 'clean', 'source-review') WHERE `id` = 12;

UPDATE `products` SET `tags` = JSON_ARRAY('deal', 'y-te-gia-dinh', 'clean', 'source-review') WHERE `id` = 5;
UPDATE `products` SET `tags` = JSON_ARRAY('deal', 'exclusive', 'sinh-ly-bao-cao-su', 'clean', 'source-review') WHERE `id` = 8;
UPDATE `products` SET `tags` = JSON_ARRAY('deal', 'exclusive', 'thuoc', 'clean', 'source-review') WHERE `id` = 28;
UPDATE `products` SET `tags` = JSON_ARRAY('deal', 'exclusive', 'my-pham-su-rua-mat', 'clean', 'source-review') WHERE `id` = 24;
UPDATE `products` SET `tags` = JSON_ARRAY('deal', 'best-seller', 'dung-cu-phau-thuat', 'clean', 'source-review') WHERE `id` = 22;

UPDATE `products` SET `tags` = JSON_ARRAY('discount', 'y-te-may-xong', 'clean', 'source-review') WHERE `id` = 2;
UPDATE `products` SET `tags` = JSON_ARRAY('discount', 'best-seller', 've-sinh-dung-dich', 'clean', 'source-review') WHERE `id` = 15;
UPDATE `products` SET `tags` = JSON_ARRAY('discount', 'best-seller', 'my-pham-su-tam', 'clean', 'source-review') WHERE `id` = 20;
UPDATE `products` SET `tags` = JSON_ARRAY('discount', 'best-seller', 'tpcn-ho-tro-chuc-nang-gan', 'clean', 'source-review') WHERE `id` = 10;
UPDATE `products` SET `tags` = JSON_ARRAY('discount', 'best-seller', 'y-te-giam-dau-ha-sot', 'clean', 'source-review') WHERE `id` = 25;
UPDATE `products` SET `tags` = JSON_ARRAY('discount', 'best-seller', 'y-te-may-do-duong-huyet', 'clean', 'source-review') WHERE `id` = 1;

UPDATE `products` SET `tags` = JSON_ARRAY('exclusive', 'y-te-khu-trung', 'clean', 'source-review') WHERE `id` = 6;
UPDATE `products` SET `tags` = JSON_ARRAY('exclusive', 'thuoc-nhuan-trang-tao-bon', 'clean', 'source-review') WHERE `id` = 14;
UPDATE `products` SET `tags` = JSON_ARRAY('exclusive', 'thuoc-viem-khop-thoai-hoa', 'clean', 'source-review') WHERE `id` = 18;

UPDATE `products` SET `tags` = JSON_ARRAY('imported', 'y-te-bom-kim-tiem', 'clean', 'source-review') WHERE `id` = 7;
UPDATE `products` SET `tags` = JSON_ARRAY('imported', 'y-te-bang-gac', 'clean', 'source-review') WHERE `id` = 9;
UPDATE `products` SET `tags` = JSON_ARRAY('imported', 'thuoc-tang-tuan-hoan-nao', 'clean', 'source-review') WHERE `id` = 11;
UPDATE `products` SET `tags` = JSON_ARRAY('imported', 'rang-mieng-chi-nha-khoa', 'clean', 'source-review') WHERE `id` = 17;
UPDATE `products` SET `tags` = JSON_ARRAY('imported', 've-sinh-tai-mui-hong', 'clean', 'source-review') WHERE `id` = 21;
UPDATE `products` SET `tags` = JSON_ARRAY('imported', 'y-te-gay-chong', 'clean', 'source-review') WHERE `id` = 23;

-- 4. Khởi tạo lô hàng và tồn kho ban đầu cho toàn bộ sản phẩm đang hoạt động để chạy test
INSERT INTO `batches` (`id`, `batch_code`, `supplier_id`, `delivery_person`, `received_date`, `total_amount`, `paid_amount`, `status`, `notes`, `created_by`, `invoice_number`)
VALUES (1, 'BATCH-INIT-STOCK', 1, 'Nguyễn Văn Khoa', CURDATE(), 0, 0, 'completed', 'Khởi tạo tồn kho ban đầu cho toàn bộ sản phẩm hoạt động', 1, 'INV-INIT-001')
ON DUPLICATE KEY UPDATE `batch_code` = VALUES(`batch_code`);

DELETE FROM `batch_items` WHERE `batch_id` = 1;

INSERT INTO `batch_items` (`batch_id`, `product_id`, `lot_number`, `manufacture_date`, `expiry_date`, `quantity_received`, `quantity_remaining`, `cost_price`, `clearance_discount_pct`, `location_id`, `status`)
SELECT 
  1, 
  id, 
  CONCAT('LOT-', DATE_FORMAT(CURDATE(), '%Y%m%d'), '-', LPAD(id, 4, '0')),
  DATE_SUB(CURDATE(), INTERVAL 60 DAY),
  DATE_ADD(CURDATE(), INTERVAL 720 DAY),
  500, 
  500, 
  ROUND(retail_price * 0.7, -2),
  0.00,
  3, -- OTC Zone / Tủ OTC-1 / Tầng trên
  'available'
FROM `products`
WHERE `status` = 'active';
