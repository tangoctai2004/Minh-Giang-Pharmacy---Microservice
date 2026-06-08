-- Phase 4 customer, address, and loyalty seed.
-- Creates realistic CRM/customer data for web checkout, profile, loyalty, and admin CRM demos.

USE mg_identity;
SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase4_customers_loyalty $$
CREATE PROCEDURE seed_phase4_customers_loyalty()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE code LIKE 'MG-CUS-%') THEN
    START TRANSACTION;

    INSERT INTO customers (
      full_name, email, phone, password_hash, date_of_birth, gender,
      loyalty_points, loyalty_tier, is_active, created_at, updated_at,
      deleted_at, code, zalo_id
    )
    SELECT
      CONCAT(
        ELT(1 + MOD(n, 12), 'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Phan', 'Vũ'),
        ' ',
        ELT(1 + MOD(n * 3, 14), 'Minh', 'Thanh', 'Gia', 'Bảo', 'Anh', 'Thu', 'Ngọc', 'Hoài', 'Quốc', 'Khánh', 'Kim', 'Hà', 'Tuấn', 'Linh'),
        ' ',
        ELT(1 + MOD(n * 7, 16), 'An', 'Bình', 'Chi', 'Dung', 'Hạnh', 'Huy', 'Khang', 'Lan', 'Long', 'Mai', 'Nam', 'Nhi', 'Phúc', 'Quân', 'Tâm', 'Vy')
      ) AS full_name,
      CONCAT('khachhang', LPAD(n, 3, '0'), '@minhgiangpharma.vn') AS email,
      CONCAT('09', LPAD(10000000 + n, 8, '0')) AS phone,
      '$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy' AS password_hash,
      DATE_SUB(CURDATE(), INTERVAL (22 + MOD(n, 48)) YEAR) AS date_of_birth,
      ELT(1 + MOD(n, 3), 'female', 'male', 'other') AS gender,
      CASE
        WHEN MOD(n, 20) = 0 THEN 6200 + MOD(n * 37, 1800)
        WHEN MOD(n, 10) IN (0, 1) THEN 2200 + MOD(n * 29, 2200)
        WHEN MOD(n, 4) = 0 THEN 600 + MOD(n * 23, 1100)
        ELSE 25 + MOD(n * 17, 420)
      END AS loyalty_points,
      CASE
        WHEN MOD(n, 20) = 0 THEN 'vip'
        WHEN MOD(n, 10) IN (0, 1) THEN 'gold'
        WHEN MOD(n, 4) = 0 THEN 'silver'
        ELSE 'member'
      END AS loyalty_tier,
      CASE WHEN MOD(n, 37) = 0 THEN 0 ELSE 1 END AS is_active,
      DATE_SUB(NOW(), INTERVAL MOD(n * 5, 210) DAY) AS created_at,
      DATE_SUB(NOW(), INTERVAL MOD(n * 3, 90) DAY) AS updated_at,
      NULL AS deleted_at,
      CONCAT('MG-CUS-', LPAD(n, 4, '0')) AS code,
      CASE WHEN MOD(n, 5) = 0 THEN CONCAT('zalo_mg_', LPAD(n, 4, '0')) ELSE NULL END AS zalo_id
    FROM (
      SELECT ones.n + tens.n * 10 + 1 AS n
      FROM (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) ones
      JOIN (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
        UNION ALL SELECT 10 UNION ALL SELECT 11
      ) tens
      ORDER BY n
    ) seq
    WHERE n <= 120;

    INSERT INTO customer_addresses (
      customer_id, receiver_name, phone, province, district, ward, street_address, is_default
    )
    SELECT
      c.id,
      c.full_name,
      c.phone,
      'Tỉnh Hòa Bình' AS province,
      'Thành phố Hòa Bình' AS district,
      ELT(1 + MOD(seq.slot_no + c.id * 3, 8),
        'Phường Hữu Nghị', 'Phường Đồng Tiến', 'Phường Phương Lâm', 'Phường Tân Thịnh',
        'Phường Dân Chủ', 'Phường Thái Bình', 'Phường Thịnh Lang', 'Xã Sủ Ngòi'
      ) AS ward,
      CONCAT(
        12 + MOD(c.id * 17 + seq.slot_no * 9, 260),
        ' ',
        ELT(1 + MOD(c.id + seq.slot_no, 10),
          'đường An Dương Vương', 'đường Cù Chính Lan', 'đường Trần Hưng Đạo',
          'đường Chi Lăng', 'đường Lê Thánh Tông', 'đường Đà Giang',
          'đường Điện Biên Phủ', 'đường Hòa Bình', 'đường Nguyễn Huệ', 'đường Lý Thường Kiệt'
        )
      ) AS street_address,
      CASE WHEN seq.slot_no = 1 THEN 1 ELSE 0 END AS is_default
    FROM customers c
    JOIN (
      SELECT 1 AS slot_no
      UNION ALL SELECT 2
    ) seq ON seq.slot_no <= CASE WHEN MOD(c.id, 3) = 0 THEN 2 ELSE 1 END
    WHERE c.code LIKE 'MG-CUS-%';

    INSERT INTO loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      c.id,
      'earn_bonus',
      GREATEST(20, FLOOR(c.loyalty_points * 0.45)),
      'Tặng điểm chào mừng thành viên Minh Giang',
      NULL,
      1,
      'Seed Phase 4 - điểm chào mừng khách hàng.',
      DATE_SUB(c.created_at, INTERVAL -1 DAY),
      CONCAT('PH4-WELCOME-', c.code),
      DATE_ADD(c.created_at, INTERVAL 12 MONTH)
    FROM customers c
    WHERE c.code LIKE 'MG-CUS-%';

    INSERT INTO loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      c.id,
      'adjust_add',
      GREATEST(10, FLOOR(c.loyalty_points * 0.35)),
      'Điều chỉnh cộng điểm từ chương trình chăm sóc khách hàng',
      NULL,
      1,
      'Seed Phase 4 - mô phỏng chăm sóc khách hàng thân thiết.',
      DATE_SUB(NOW(), INTERVAL MOD(c.id * 7, 120) DAY),
      CONCAT('PH4-ADJUST-', c.code),
      DATE_ADD(NOW(), INTERVAL 12 MONTH)
    FROM customers c
    WHERE c.code LIKE 'MG-CUS-%' AND c.loyalty_points >= 100;

    INSERT INTO loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      c.id,
      'redeem',
      -LEAST(120, GREATEST(20, FLOOR(c.loyalty_points * 0.12))),
      'Quy đổi điểm giảm giá tại quầy',
      NULL,
      NULL,
      NULL,
      DATE_SUB(NOW(), INTERVAL MOD(c.id * 11, 80) DAY),
      CONCAT('PH4-REDEEM-', c.code),
      NULL
    FROM customers c
    WHERE c.code LIKE 'MG-CUS-%' AND c.loyalty_points >= 300 AND MOD(c.id, 3) = 0;

    INSERT INTO loyalty_points_transactions (
      customer_id, transaction_type, points_change, description,
      reference_order_id, adjusted_by, admin_note, created_at,
      idempotency_key, expires_at
    )
    SELECT
      c.id,
      'expire',
      -LEAST(80, GREATEST(10, FLOOR(c.loyalty_points * 0.08))),
      'Điểm hết hạn theo chính sách 12 tháng',
      NULL,
      NULL,
      NULL,
      DATE_SUB(NOW(), INTERVAL MOD(c.id * 13, 60) DAY),
      CONCAT('PH4-EXPIRE-', c.code),
      DATE_SUB(NOW(), INTERVAL 1 DAY)
    FROM customers c
    WHERE c.code LIKE 'MG-CUS-%' AND c.loyalty_points >= 500 AND MOD(c.id, 7) = 0;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase4_customers_loyalty();
DROP PROCEDURE IF EXISTS seed_phase4_customers_loyalty;

UPDATE customer_addresses a
JOIN customers c ON c.id = a.customer_id
SET
  a.province = 'Tỉnh Hòa Bình',
  a.district = 'Thành phố Hòa Bình',
  a.ward = ELT(1 + MOD(a.id + c.id * 3, 8),
    'Phường Hữu Nghị', 'Phường Đồng Tiến', 'Phường Phương Lâm', 'Phường Tân Thịnh',
    'Phường Dân Chủ', 'Phường Thái Bình', 'Phường Thịnh Lang', 'Xã Sủ Ngòi'
  ),
  a.street_address = CONCAT(
    12 + MOD(c.id * 17 + a.id * 9, 260),
    ' ',
    ELT(1 + MOD(c.id + a.id, 10),
      'đường An Dương Vương', 'đường Cù Chính Lan', 'đường Trần Hưng Đạo',
      'đường Chi Lăng', 'đường Lê Thánh Tông', 'đường Đà Giang',
      'đường Điện Biên Phủ', 'đường Hòa Bình', 'đường Nguyễn Huệ', 'đường Lý Thường Kiệt'
    )
  )
WHERE c.code LIKE 'MG-CUS-%';

USE mg_catalog;

UPDATE delivery_config
SET
  max_delivery_radius_km = 8.0,
  base_shipping_fee = 15000.00,
  free_shipping_threshold = 300000.00,
  is_enabled = 1
WHERE id = 1;
