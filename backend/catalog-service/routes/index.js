const router = require('express').Router();
const gatewayAuth = require('../middlewares/gatewayAuth');

router.use(gatewayAuth);

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
      'GET    /products/:id       — Chi tiết sản phẩm (public)',
      'POST   /products           — Thêm sản phẩm mới',
      'PUT    /products/:id       — Cập nhật sản phẩm',
      'DELETE /products/:id       — Ẩn sản phẩm',
      'GET    /categories         — Danh mục (public)',
      'GET    /suppliers          — Danh sách nhà cung cấp',
      'GET    /batches            — Lô nhập hàng',
      'POST   /batches            — Tạo phiếu nhập hàng mới',
      'GET    /inventory          — Tổng quan tồn kho',
      'GET    /locations          — Vị trí kệ thuốc',
      'GET    /promotions/stats   — Thống kê khuyến mãi',
    ],
  });
});

module.exports = router;
