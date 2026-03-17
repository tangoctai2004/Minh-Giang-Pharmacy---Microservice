const router = require('express').Router();
const gatewayAuth = require('../middlewares/gatewayAuth');

router.use(gatewayAuth);

router.use('/articles',           require('../articles/articles.routes'));
router.use('/banners',            require('../banners/banners.routes'));
router.use('/disease-categories', require('../disease_categories/disease-categories.routes'));
router.use('/promotions',         require('../promotions/promotions.routes'));
router.use('/store-config',       require('../store_config/store-config.routes'));

router.get('/', (req, res) => {
  res.json({
    service: 'cms-service',
    endpoints: [
      'GET  /articles            — Danh sách bài viết (public)',
      'GET  /articles/:id        — Chi tiết bài viết (public)',
      'POST /articles            — Đăng bài viết mới',
      'GET  /banners             — Danh sách banner (public)',
      'GET  /disease-categories  — Nhóm bệnh (public)',
      'GET  /promotions/active   — Khuyến mãi đang chạy (public)',
      'GET  /store-config/public — Cấu hình cửa hàng công khai (public)',
    ],
  });
});

module.exports = router;
