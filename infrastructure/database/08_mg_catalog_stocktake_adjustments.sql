USE `mg_catalog`;

ALTER TABLE stock_movements
  MODIFY movement_type ENUM(
    'inbound',
    'outbound_sale',
    'outbound_return_supplier',
    'outbound_damage',
    'outbound_expiry',
    'adjustment'
  ) NOT NULL COMMENT 'Loại giao dịch kho: nhập, xuất, huỷ/hết hạn hoặc điều chỉnh kiểm kê';
