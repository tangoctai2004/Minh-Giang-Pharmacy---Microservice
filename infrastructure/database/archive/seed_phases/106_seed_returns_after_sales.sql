-- Phase 7 after-sales return/refund seed.
-- Adds realistic customer return cases for completed Minh Giang orders.

USE mg_order;
SET NAMES utf8mb4;
SET @PH7_OLD_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = '';

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase7_returns_after_sales $$
CREATE PROCEDURE seed_phase7_returns_after_sales()
BEGIN
  DECLARE eligible_item_count INT DEFAULT 0;

  SELECT COUNT(*) INTO eligible_item_count
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.order_code LIKE 'PH5-%'
    AND o.order_status = 'completed'
    AND o.payment_status = 'paid'
    AND oi.batch_item_id IS NOT NULL
    AND oi.prescription_id IS NULL
    AND oi.quantity > 0;

  IF eligible_item_count < 36 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Phase 7 seed requires at least 36 completed paid non-Rx order items.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM returns WHERE return_code LIKE 'PH7-RET-%') THEN
    START TRANSACTION;

    CREATE TEMPORARY TABLE tmp_phase7_return_seed AS
    SELECT
      n,
      CONVERT(CONCAT('PH7-RET-', LPAD(n, 4, '0')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS return_code,
      CASE
        WHEN n <= 18 THEN 'completed'
        WHEN n <= 26 THEN 'approved'
        WHEN n <= 32 THEN 'pending'
        ELSE 'rejected'
      END AS status,
      CASE
        WHEN n <= 18 THEN
          ELT(1 + MOD(n, 5),
            'Khách đổi trả do mua nhầm quy cách, bao bì còn nguyên niêm phong.',
            'Khách trả một phần đơn web trong ngày do không còn nhu cầu sử dụng.',
            'Sản phẩm giao nhầm biến thể, dược sĩ đã đối chiếu và chấp nhận hoàn.',
            'Khách phát hiện trùng thuốc đã mua trước đó, hàng còn đủ điều kiện nhập lại.',
            'Hoàn trả sau tư vấn tại quầy, sản phẩm chưa mở hộp.'
          )
        WHEN n <= 26 THEN
          ELT(1 + MOD(n, 4),
            'Đã duyệt yêu cầu đổi hàng, đang chờ khách mang sản phẩm tới nhà thuốc.',
            'Đã duyệt hoàn tiền qua phương thức thanh toán ban đầu.',
            'Đã duyệt đổi sang sản phẩm cùng nhóm, chờ kiểm tra bao bì.',
            'Đã duyệt trả hàng do giao thiếu phụ kiện đi kèm.'
          )
        WHEN n <= 32 THEN
          ELT(1 + MOD(n, 3),
            'Khách vừa gửi yêu cầu trả hàng, chờ dược sĩ kiểm tra điều kiện.',
            'Chờ đối chiếu ảnh sản phẩm và hóa đơn mua hàng.',
            'Chờ xác nhận tình trạng niêm phong trước khi duyệt.'
          )
        ELSE
          ELT(1 + MOD(n, 3),
            'Từ chối do sản phẩm đã mở nắp/rách tem niêm phong.',
            'Từ chối do quá thời hạn đổi trả của nhà thuốc.',
            'Từ chối do sản phẩm không đúng lô đã bán trong hệ thống.'
          )
      END AS reason,
      CASE
        WHEN n <= 18 THEN
          CASE
            WHEN MOD(n, 4) = 0 THEN 'store_credit'
            WHEN MOD(n, 3) = 0 THEN 'original_payment'
            ELSE 'cash'
          END
        WHEN n <= 26 THEN
          CASE WHEN MOD(n, 2) = 0 THEN 'original_payment' ELSE 'cash' END
        WHEN n <= 32 THEN
          CASE WHEN MOD(n, 2) = 0 THEN 'store_credit' ELSE 'cash' END
        ELSE 'cash'
      END AS refund_method,
      CASE
        WHEN n <= 18 THEN 1
        ELSE 0
      END AS is_completed,
      CASE
        WHEN n <= 18 AND MOD(n, 4) <> 0 THEN 1
        ELSE 0
      END AS return_to_stock
    FROM (
      SELECT ones.n + tens.n * 10 + 1 AS n
      FROM (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) ones
      JOIN (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
      ) tens
    ) seq
    WHERE n <= 36;

    CREATE TEMPORARY TABLE tmp_phase7_candidate_items AS
    SELECT
      ranked.*,
      ROW_NUMBER() OVER (ORDER BY ranked.created_at DESC, ranked.order_id, ranked.order_item_id) AS rn
    FROM (
      SELECT
        o.id AS order_id,
        o.order_code,
        o.order_channel,
        o.created_at,
        oi.id AS order_item_id,
        oi.product_id,
        oi.batch_item_id,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY oi.id) AS item_rn
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_code LIKE 'PH5-%'
        AND o.order_status = 'completed'
        AND o.payment_status = 'paid'
        AND oi.batch_item_id IS NOT NULL
        AND oi.prescription_id IS NULL
        AND oi.quantity > 0
    ) ranked
    WHERE ranked.item_rn = 1;

    CREATE TEMPORARY TABLE tmp_phase7_return_items AS
    SELECT
      seed.n,
      seed.return_code,
      seed.status,
      seed.reason,
      seed.refund_method,
      seed.return_to_stock,
      ci.order_id,
      ci.order_channel,
      ci.order_item_id,
      ci.product_id,
      ci.batch_item_id,
      1 AS quantity_returned,
      ci.unit_price AS refund_amount
    FROM tmp_phase7_return_seed seed
    JOIN tmp_phase7_candidate_items ci ON ci.rn = seed.n;

    INSERT INTO returns (
      return_code, order_id, order_channel, reason, refund_amount,
      refund_method, status, handled_by, created_at, updated_at
    )
    SELECT
      return_code,
      order_id,
      order_channel,
      reason,
      CASE WHEN status = 'rejected' THEN 0 ELSE refund_amount END,
      refund_method,
      status,
      CASE WHEN status IN ('approved', 'completed', 'rejected') THEN 2 + MOD(n, 4) ELSE NULL END,
      DATE_SUB(NOW(), INTERVAL 2 + MOD(n * 3, 45) DAY),
      NOW()
    FROM tmp_phase7_return_items;

    INSERT INTO return_items (
      return_id, order_item_id, quantity_returned, return_to_stock
    )
    SELECT
      r.id,
      seed.order_item_id,
      seed.quantity_returned,
      seed.return_to_stock
    FROM tmp_phase7_return_items seed
    JOIN returns r ON r.return_code = seed.return_code;

    INSERT INTO mg_catalog.stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH7-RET-STOCK-', LPAD(r.id, 8, '0')),
      seed.batch_item_id,
      seed.product_id,
      'adjustment',
      seed.quantity_returned,
      'customer_return',
      r.id,
      'Seed Phase 7 - nhập lại kho từ đơn trả hàng đủ điều kiện bán lại.',
      COALESCE(r.handled_by, 2),
      r.updated_at
    FROM tmp_phase7_return_items seed
    JOIN returns r ON r.return_code = seed.return_code
    WHERE seed.status = 'completed'
      AND seed.return_to_stock = 1;

    UPDATE mg_catalog.batch_items bi
    JOIN (
      SELECT batch_item_id, SUM(quantity_returned) AS returned_qty
      FROM tmp_phase7_return_items
      WHERE status = 'completed'
        AND return_to_stock = 1
      GROUP BY batch_item_id
    ) returned ON returned.batch_item_id = bi.id
    SET
      bi.quantity_remaining = LEAST(bi.quantity_received, bi.quantity_remaining + returned.returned_qty),
      bi.status = CASE
        WHEN bi.expiry_date < CURDATE() THEN 'expired'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90 THEN 'near_expiry'
        WHEN LEAST(bi.quantity_received, bi.quantity_remaining + returned.returned_qty) > 0 THEN 'available'
        ELSE bi.status
      END;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase7_returns_after_sales();
DROP PROCEDURE IF EXISTS seed_phase7_returns_after_sales;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_phase7_returns_channel_mix $$
CREATE PROCEDURE seed_phase7_returns_channel_mix()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM returns WHERE return_code LIKE 'PH7-MIX-%') THEN
    START TRANSACTION;

    CREATE TEMPORARY TABLE tmp_phase7_mix_seed AS
    SELECT
      n,
      CONVERT(CONCAT('PH7-MIX-', LPAD(n, 4, '0')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS return_code,
      CONVERT(CASE WHEN n <= 6 THEN 'pos' ELSE 'web' END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS target_channel,
      CASE WHEN n <= 6 THEN 'completed' ELSE 'pending' END AS status,
      CASE WHEN n <= 4 THEN 1 ELSE 0 END AS return_to_stock,
      CASE
        WHEN n <= 6 THEN 'Hoàn tất đổi/trả tại quầy 918 An Dương Vương, dược sĩ đã kiểm tra sản phẩm.'
        ELSE 'Yêu cầu trả hàng web trong bán kính giao Hòa Bình, chờ khách gửi ảnh xác minh.'
      END AS reason,
      CASE
        WHEN n <= 6 THEN 'cash'
        WHEN MOD(n, 2) = 0 THEN 'original_payment'
        ELSE 'store_credit'
      END AS refund_method
    FROM (
      SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
      UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
    ) seq;

    CREATE TEMPORARY TABLE tmp_phase7_mix_candidates AS
    SELECT
      ranked.*,
      ROW_NUMBER() OVER (PARTITION BY ranked.order_channel ORDER BY ranked.created_at DESC, ranked.order_id, ranked.order_item_id) AS channel_rn
    FROM (
      SELECT
        o.id AS order_id,
        o.order_channel,
        o.created_at,
        oi.id AS order_item_id,
        oi.product_id,
        oi.batch_item_id,
        oi.quantity,
        oi.unit_price,
        ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY oi.id) AS item_rn
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_code LIKE 'PH5-%'
        AND o.order_status = 'completed'
        AND o.payment_status = 'paid'
        AND oi.batch_item_id IS NOT NULL
        AND oi.prescription_id IS NULL
        AND oi.quantity > 0
        AND NOT EXISTS (
          SELECT 1 FROM return_items existing_ri WHERE existing_ri.order_item_id = oi.id
        )
    ) ranked
    WHERE ranked.item_rn = 1;

    CREATE TEMPORARY TABLE tmp_phase7_mix_items AS
    SELECT
      seed.n,
      seed.return_code,
      seed.status,
      seed.reason,
      seed.refund_method,
      seed.return_to_stock,
      ci.order_id,
      ci.order_channel,
      ci.order_item_id,
      ci.product_id,
      ci.batch_item_id,
      1 AS quantity_returned,
      ci.unit_price AS refund_amount
    FROM tmp_phase7_mix_seed seed
    JOIN tmp_phase7_mix_candidates ci
      ON ci.order_channel = seed.target_channel
     AND ci.channel_rn = CASE WHEN seed.target_channel = 'pos' THEN seed.n ELSE seed.n - 6 END;

    IF (SELECT COUNT(*) FROM tmp_phase7_mix_items) < 12 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Phase 7 mix seed requires 6 POS and 6 web return candidates.';
    END IF;

    INSERT INTO returns (
      return_code, order_id, order_channel, reason, refund_amount,
      refund_method, status, handled_by, created_at, updated_at
    )
    SELECT
      return_code,
      order_id,
      order_channel,
      reason,
      refund_amount,
      refund_method,
      status,
      CASE WHEN status = 'completed' THEN 3 ELSE NULL END,
      DATE_SUB(NOW(), INTERVAL 1 + MOD(n * 2, 20) DAY),
      NOW()
    FROM tmp_phase7_mix_items;

    INSERT INTO return_items (
      return_id, order_item_id, quantity_returned, return_to_stock
    )
    SELECT
      r.id,
      seed.order_item_id,
      seed.quantity_returned,
      seed.return_to_stock
    FROM tmp_phase7_mix_items seed
    JOIN returns r ON r.return_code = seed.return_code;

    INSERT INTO mg_catalog.stock_movements (
      movement_code, batch_item_id, product_id, movement_type,
      quantity, reference_type, reference_id, reason, created_by, created_at
    )
    SELECT
      CONCAT('PH7-MIX-STOCK-', LPAD(r.id, 8, '0')),
      seed.batch_item_id,
      seed.product_id,
      'adjustment',
      seed.quantity_returned,
      'customer_return',
      r.id,
      'Seed Phase 7 - nhập lại kho từ đổi trả POS đủ điều kiện bán lại.',
      COALESCE(r.handled_by, 3),
      r.updated_at
    FROM tmp_phase7_mix_items seed
    JOIN returns r ON r.return_code = seed.return_code
    WHERE seed.status = 'completed'
      AND seed.return_to_stock = 1;

    UPDATE mg_catalog.batch_items bi
    JOIN (
      SELECT batch_item_id, SUM(quantity_returned) AS returned_qty
      FROM tmp_phase7_mix_items
      WHERE status = 'completed'
        AND return_to_stock = 1
      GROUP BY batch_item_id
    ) returned ON returned.batch_item_id = bi.id
    SET
      bi.quantity_remaining = LEAST(bi.quantity_received, bi.quantity_remaining + returned.returned_qty),
      bi.status = CASE
        WHEN bi.expiry_date < CURDATE() THEN 'expired'
        WHEN DATEDIFF(bi.expiry_date, CURDATE()) <= 90 THEN 'near_expiry'
        WHEN LEAST(bi.quantity_received, bi.quantity_remaining + returned.returned_qty) > 0 THEN 'available'
        ELSE bi.status
      END;

    COMMIT;
  END IF;
END $$

DELIMITER ;

CALL seed_phase7_returns_channel_mix();
DROP PROCEDURE IF EXISTS seed_phase7_returns_channel_mix;
SET SQL_MODE = @PH7_OLD_SQL_MODE;
