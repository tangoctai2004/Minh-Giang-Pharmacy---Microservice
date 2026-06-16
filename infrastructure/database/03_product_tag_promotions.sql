USE `mg_catalog`;

DROP TABLE IF EXISTS `product_tag_promotions`;

CREATE TABLE `product_tag_promotions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL COMMENT 'Liên kết sản phẩm products.id',
  `tag_name` enum('flash-sale', 'deal', 'discount') NOT NULL COMMENT 'Loại tag khuyến mãi',
  `discount_type` enum('percentage', 'fixed_price') NOT NULL DEFAULT 'percentage' COMMENT 'percentage: giảm theo %, fixed_price: giá bán khuyến mãi cố định',
  `discount_value` decimal(15, 2) NOT NULL DEFAULT '0.00' COMMENT 'Giá trị giảm (% hoặc giá bán cố định bằng VND)',
  `campaign_qty` int DEFAULT NULL COMMENT 'Tổng số lượng mở bán khuyến mãi (NULL = không giới hạn)',
  `sold_qty` int NOT NULL DEFAULT '0' COMMENT 'Số lượng đã bán lẻ thực tế trong campaign',
  `max_per_customer` int DEFAULT NULL COMMENT 'Giới hạn mua tối đa của một khách hàng (NULL = không giới hạn)',
  `start_time` datetime NOT NULL COMMENT 'Thời gian bắt đầu campaign',
  `end_time` datetime NOT NULL COMMENT 'Thời gian kết thúc campaign',
  `status` enum('active', 'inactive', 'paused') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái hoạt động của campaign',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_tag_active_promo` (`product_id`, `tag_name`, `status`),
  CONSTRAINT `fk_tag_promotions_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết cấu hình khuyến mãi theo tag sản phẩm';
