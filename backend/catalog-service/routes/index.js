const router = require('express').Router();
const gatewayAuth = require('../middlewares/gatewayAuth');

router.use(gatewayAuth);

router.use('/',           require('../reviews/reviews.routes'));
router.use('/products',   require('../products/products.routes'));
router.use('/categories', require('../categories/categories.routes'));
router.use('/suppliers',  require('../suppliers/suppliers.routes'));
router.use('/batches',    require('../batches/batches.routes'));
router.use('/inventory',  require('../inventory/inventory.routes'));
router.use('/locations',  require('../locations/locations.routes'));
router.use('/promotions', require('../promotions/promotions.routes'));

router.get('/', (req, res) => {
  res.json({
    service: 'catalog-service',
    endpoints: [
      'GET    /products           — Danh sách sản phẩm (public)',
      'GET    /products?ids=1,2   — Lấy nhiều sản phẩm theo id (public)',
      'GET    /products/:id       — Chi tiết sản phẩm (public)',
      'GET    /products/:id/reviews — Danh sách đánh giá đã duyệt (public)',
      'GET    /products/:id/reviews/summary — Tổng hợp điểm đánh giá (public)',
      'POST   /products/:id/reviews — Gửi đánh giá sau khi mua hàng',
      'GET    /admin/reviews     — Kiểm duyệt đánh giá sản phẩm',
      'GET    /products/pos-search — Tìm/scan thuốc cho POS',
      'GET    /products/pos-detail/:id — Chi tiết thuốc cho POS',
      'GET    /products/barcode/:barcode — Tra barcode cho POS',
      'POST   /products           — Thêm sản phẩm mới',
      'PUT    /products/:id       — Cập nhật sản phẩm',
      'DELETE /products/:id       — Ẩn sản phẩm',
      'GET    /categories         — Danh mục (public)',
      'GET    /categories/pos-tree — Cây danh mục gọn cho POS',
      'GET    /suppliers          — Danh sách nhà cung cấp',
      'GET    /batches            — Lô nhập hàng',
      'POST   /batches            — Tạo phiếu nhập hàng mới',
      'GET    /inventory          — Tổng quan tồn kho',
      'GET    /inventory/audits   — Lịch sử phiếu kiểm kê',
      'POST   /inventory/audits   — Tạo phiếu kiểm kê tồn kho',
      'GET    /inventory/availability — Tồn kho có thể bán cho POS',
      'POST   /inventory/reservations — Giữ tồn tạm thời cho POS/Order',
      'POST   /inventory/reservations/release — Nhả giữ tồn tạm thời',
      'GET    /locations          — Vị trí kệ thuốc',
      'GET    /promotions/active  — Khuyến mãi đang chạy (public)',
      'GET    /promotions/stats   — Thống kê khuyến mãi',
    ],
  });
});

module.exports = router;
