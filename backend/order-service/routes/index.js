const router = require('express').Router();
const gatewayAuth = require('../middlewares/gatewayAuth');

router.use(gatewayAuth);

router.use('/orders',   require('../orders/orders.routes'));
router.use('/cart',     require('../cart/cart.routes'));
router.use('/checkout', require('../checkout/checkout.routes'));
router.use('/returns',  require('../returns/returns.routes'));

router.get('/', (req, res) => {
  res.json({
    service: 'order-service',
    endpoints: [
      'GET    /orders          — Danh sách đơn hàng (admin)',
      'GET    /orders/my       — Đơn hàng của tôi (customer)',
      'GET    /orders/:id      — Chi tiết đơn hàng',
      'PUT    /orders/:id/confirm   — Xác nhận đơn',
      'PUT    /orders/:id/complete  — Hoàn thành đơn',
      'PUT    /orders/:id/cancel    — Huỷ đơn',
      'GET    /cart            — Giỏ hàng hiện tại',
      'POST   /cart/items      — Thêm sản phẩm vào giỏ',
      'PUT    /cart/items/:id  — Cập nhật số lượng',
      'DELETE /cart/items/:id  — Xoá khỏi giỏ',
      'POST   /checkout        — Đặt hàng từ giỏ hàng',
      'GET    /returns         — Danh sách đơn trả hàng',
      'POST   /returns         — Yêu cầu trả hàng',
    ],
  });
});

module.exports = router;
