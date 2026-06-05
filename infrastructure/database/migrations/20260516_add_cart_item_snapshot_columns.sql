-- Migration: Add product snapshot fields used by client cart
USE `mg_order`;

ALTER TABLE `cart_items`
  ADD COLUMN `product_name` VARCHAR(300) NOT NULL DEFAULT 'Sản phẩm mới' AFTER `product_id`,
  ADD COLUMN `product_sku` VARCHAR(100) DEFAULT '' AFTER `product_name`,
  ADD COLUMN `thumbnail` TEXT AFTER `product_sku`;
