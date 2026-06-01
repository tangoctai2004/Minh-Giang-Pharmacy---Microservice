-- Migration: Add is_active for soft delete compliance in mg_order
USE `mg_order`;

ALTER TABLE `carts` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `cart_items` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `orders` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `order_items` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `returns` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `return_items` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;

-- Thêm index để tối ưu query
CREATE INDEX `idx_carts_active` ON `carts`(`is_active`);
CREATE INDEX `idx_orders_active` ON `orders`(`is_active`);
CREATE INDEX `idx_returns_active` ON `returns`(`is_active`);
