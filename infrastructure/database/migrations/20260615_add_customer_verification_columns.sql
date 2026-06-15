USE mg_identity;

SET @add_email_verified_at := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE customers ADD COLUMN email_verified_at datetime DEFAULT NULL COMMENT ''Thời điểm khách hàng xác thực email bằng OTP'' AFTER is_active',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_identity'
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'email_verified_at'
);
PREPARE stmt FROM @add_email_verified_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_phone_verified_at := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE customers ADD COLUMN phone_verified_at datetime DEFAULT NULL COMMENT ''Thời điểm khách hàng xác thực số điện thoại bằng OTP'' AFTER email_verified_at',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'mg_identity'
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'phone_verified_at'
);
PREPARE stmt FROM @add_phone_verified_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE customers
SET email_verified_at = COALESCE(email_verified_at, created_at, NOW())
WHERE deleted_at IS NULL
  AND is_active = 1
  AND email IS NOT NULL
  AND email_verified_at IS NULL;

UPDATE customers
SET phone_verified_at = COALESCE(phone_verified_at, created_at, NOW())
WHERE deleted_at IS NULL
  AND is_active = 1
  AND phone IS NOT NULL
  AND phone_verified_at IS NULL;
