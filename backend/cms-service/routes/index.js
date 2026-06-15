/**
 * routes/index.js — Router gốc của CMS Service
 *
 * Tất cả request đi qua gatewayAuth để extract user context từ header
 * (x-user-id, x-user-role, x-user-type) được inject bởi API Gateway.
 *
 * Endpoints:
 *   /articles           — Bài viết sức khoẻ
 *   /banners            — Banner quảng cáo (hero/popup/sidebar)
 *   /categories         — Danh mục CMS (article/disease/promotion)
 *   /promotions         — Chương trình khuyến mãi & voucher
 *   /store-config       — Cấu hình nhà thuốc
 *   /pages              — Trang tĩnh (về chúng tôi, chính sách...)
 *   /media              — Thư viện media
 *   /trending-searches  — Từ khoá tìm kiếm phổ biến
 */
const router = require('express').Router();
const gatewayAuth = require('../middlewares/gatewayAuth');

// Inject user context từ gateway headers vào req
router.use(gatewayAuth);

// ─── Content modules ────────────────────────────────────────────────────────
router.use('/articles',          require('../articles/articles.routes'));
router.use('/banners',           require('../banners/banners.routes'));
router.use('/categories',        require('../categories/categories.routes'));
router.use('/diseases',           require('../diseases/diseases.routes'));
router.use('/disease-categories', require('../disease_categories/disease-categories.routes'));
router.use('/promotions',        require('../promotions/promotions.routes'));
router.use('/loyalty',           require('../loyalty/loyalty.routes'));
router.use('/store-config',      require('../store_config/store-config.routes'));
router.use('/pages',             require('../pages/pages.routes'));
router.use('/media',             require('../media/media.routes'));
router.use('/trending-searches', require('../trending_searches/trending-searches.routes'));

// ─── Service index ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    service: 'cms-service',
    version: '2.0.0',
    endpoints: [
      // ── Articles ──────────────────────────────────────────────────────────
      'GET    /articles                    — Danh sách bài viết đã publish (public, filter, phân trang)',
      'GET    /articles/admin              — Tất cả bài viết (admin/manager)',
      'GET    /articles/:idOrSlug          — Chi tiết bài viết (public)',
      'POST   /articles                    — Tạo bài viết mới (admin/manager)',
      'PUT    /articles/:id                — Cập nhật bài viết (admin/manager)',
      'DELETE /articles/:id                — Soft delete bài viết (admin/manager)',
      // ── Banners ───────────────────────────────────────────────────────────
      'GET    /banners                     — Banners đang active (public, ?position=hero|popup|sidebar)',
      'GET    /banners/admin               — Tất cả banners (admin)',
      'POST   /banners                     — Tạo banner (admin)',
      'PUT    /banners/:id                 — Cập nhật banner (admin)',
      'DELETE /banners/:id                 — Ẩn banner (admin)',
      // ── Categories ────────────────────────────────────────────────────────
      'GET    /categories                  — Danh mục CMS (public, ?type=article|disease|promotion)',
      'GET    /categories/tree             — Cây danh mục phân cấp (public)',
      'GET    /categories/:id              — Chi tiết danh mục (public)',
      'POST   /categories                  — Tạo danh mục (admin/manager)',
      'PUT    /categories/:id              — Cập nhật danh mục (admin/manager)',
      'DELETE /categories/:id              — Ẩn danh mục (admin)',
      // ── Promotions ────────────────────────────────────────────────────────
      'GET    /promotions/stats            — Thống kê dashboard (admin)',
      'GET    /promotions/active           — KM đang chạy (public)',
      'GET    /promotions/validate/:code   — Validate mã voucher (public)',
      'GET    /promotions/export           — Xuất CSV (admin)',
      'GET    /promotions                  — Tất cả KM có filter/page (admin)',
      'GET    /promotions/:id              — Chi tiết KM (admin)',
      'POST   /promotions                  — Tạo KM mới (admin)',
      'PUT    /promotions/:id              — Cập nhật KM (admin)',
      'PUT    /promotions/:id/toggle       — Bật/tắt KM (admin)',
      'POST   /promotions/:id/clone        — Nhân bản KM (admin)',
      'DELETE /promotions/:id              — Tắt KM (admin)',
      // ── Loyalty ──────────────────────────────────────────────────────────
      'GET    /loyalty/tiers               — Cấu hình hạng thành viên (admin)',
      'PUT    /loyalty/tiers               — Lưu cấu hình hạng (admin)',
      'GET    /loyalty/stats               — Phân bổ KH theo hạng (admin)',
      'GET    /loyalty/config              — Cấu hình quy đổi điểm (admin)',
      'PUT    /loyalty/config              — Lưu cấu hình quy đổi (admin)',
      // ── Store Config ──────────────────────────────────────────────────────
      'GET    /store-config/public         — Config công khai (public)',
      'GET    /store-config                — Tất cả config (admin)',
      'POST   /store-config                — Tạo config key (admin)',
      'PUT    /store-config/:key           — Cập nhật config (admin)',
      'DELETE /store-config/:key           — Vô hiệu config (admin)',
      // ── Pages ─────────────────────────────────────────────────────────────
      'GET    /pages                       — Danh sách trang tĩnh (public)',
      'GET    /pages/footer                — Trang hiển thị footer (public)',
      'GET    /pages/:slug                 — Nội dung trang theo slug (public)',
      'GET    /pages/admin/:id             — Chi tiết trang (admin)',
      'POST   /pages                       — Tạo trang tĩnh (admin)',
      'PUT    /pages/:id                   — Cập nhật trang (admin)',
      'DELETE /pages/:id                   — Ẩn trang (admin)',
      // ── Media ─────────────────────────────────────────────────────────────
      'GET    /media                       — Danh sách media (staff+)',
      'GET    /media/admin/stats           — Thống kê thư viện (admin)',
      'GET    /media/:id                   — Chi tiết media (staff+)',
      'POST   /media                       — Đăng ký metadata media (manager+)',
      'DELETE /media/:id                   — Soft delete media (admin)',
      // ── Trending Searches ─────────────────────────────────────────────────
      'GET    /trending-searches           — Top hot search (public)',
      'POST   /trending-searches/track     — Ghi nhận lượt tìm kiếm (public)',
      'GET    /trending-searches/admin     — Tất cả keyword (admin)',
      'PUT    /trending-searches/:id/pin   — Ghim/bỏ ghim keyword (admin)',
      'PUT    /trending-searches/:id/hide  — Ẩn/hiện keyword (admin)',
      'DELETE /trending-searches/:id       — Xoá keyword (admin)',
    ],
  });
});

module.exports = router;
