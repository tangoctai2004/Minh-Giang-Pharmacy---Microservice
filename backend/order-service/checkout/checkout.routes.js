const router = require('express').Router();

/**
 * Checkout Route
 * POST /checkout — Đặt hàng từ giỏ hàng hoặc POS
 *
 * Flow:
 * 1. Validate body { items, shipping_address, payment_method, promotion_code? }
 * 2. Kiểm tra tồn kho thực tế (catalog-service) hoặc stock_reservations
 * 3. Tính lại giá, kiểm tra mã KM (cms-service)
 * 4. Tạo orders + order_items trong transaction
 * 5. Ghi outbox_events để trừ tồn kho (catalog-service) async
 * 6. Ghi outbox_events để thông báo (notification-service) async
 * 7. Trả về { orderId, code, total_amount, ... }
 */
router.post('/', (req, res) => {
  res.status(501).json({ success: false, message: 'TODO: implement POST /checkout' });
});

module.exports = router;
