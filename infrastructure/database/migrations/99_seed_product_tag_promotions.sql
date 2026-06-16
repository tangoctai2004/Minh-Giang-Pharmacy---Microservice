-- Seed data for product tag promotions (Flash Sale, Deal, Discount)
USE `mg_catalog`;

-- 1. Xóa cấu hình khuyến mãi cũ của sản phẩm demo
DELETE FROM `product_tag_promotions` WHERE `product_id` IN (3, 5, 2);

-- 2. Thêm dữ liệu cấu hình khuyến mãi mới
INSERT INTO `product_tag_promotions` 
  (`product_id`, `tag_name`, `discount_type`, `discount_value`, `campaign_qty`, `sold_qty`, `max_per_customer`, `start_time`, `end_time`, `status`)
VALUES
  -- Product 3: Máy trợ thính Mimitakara -> Flash Sale giảm 20%
  (3, 'flash-sale', 'percentage', 20.00, 100, 15, 2, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
  
  -- Product 5: Ống hít Cây Búa -> Deal siêu khủng giảm còn 65.000₫ (giá gốc 85.000đ)
  (5, 'deal', 'fixed_price', 65000.00, 50, 5, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 'active'),
  
  -- Product 2: Máy xông khí dung -> Giảm giá thường 10%
  (2, 'discount', 'percentage', 10.00, NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'active');

-- 3. Cập nhật nhãn tag tương ứng trong bảng products
UPDATE `products` SET `tags` = JSON_ARRAY('flash-sale', 'y-te-ho-tro-khac', 'clean', 'source-review') WHERE `id` = 3;
UPDATE `products` SET `tags` = JSON_ARRAY('deal', 'y-te-gia-dinh', 'clean', 'source-review') WHERE `id` = 5;
UPDATE `products` SET `tags` = JSON_ARRAY('discount', 'y-te-may-xong', 'clean', 'source-review') WHERE `id` = 2;

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
