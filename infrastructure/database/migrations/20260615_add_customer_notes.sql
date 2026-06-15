USE mg_identity;

SET @add_notes := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE customers ADD COLUMN notes text DEFAULT NULL COMMENT \'Ghi chú nội bộ\' AFTER zalo_id',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_identity'
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'notes'
);
PREPARE stmt FROM @add_notes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
