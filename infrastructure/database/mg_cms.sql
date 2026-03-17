-- =============================================================================
-- SCHEMA: mg_cms
-- Mục đích: Quản lý nội dung (Content Management System)
-- Bao gồm: Bài viết sức khoẻ, Danh mục CMS, Banner, Chương trình khuyến mãi
-- Cross-schema references:
--   author_id → mg_identity.users.id (enforce tại app layer)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_cms
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_cms;

-- =============================================================================
-- BẢNG: cms_categories
-- Danh mục nội dung CMS (bài viết, bệnh, khuyến mãi)
-- =============================================================================
CREATE TABLE cms_categories (
    id      INT             NOT NULL AUTO_INCREMENT,
    name    VARCHAR(150)    NOT NULL    COMMENT 'Tên danh mục: Tin tức y tế, Bệnh lý, Dinh dưỡng...',
    slug    VARCHAR(200)    NOT NULL    COMMENT 'URL slug, VD: tin-tuc-y-te',
    type    ENUM('article','disease','promotion') NOT NULL
                                        COMMENT 'Phân loại danh mục: article=bài viết, disease=bệnh, promotion=KM',

    PRIMARY KEY (id),
    UNIQUE KEY uq_cms_categories_slug (slug),
    INDEX idx_cms_categories_type (type)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Danh mục nội dung CMS phân theo loại bài viết';

-- =============================================================================
-- BẢNG: articles
-- Bài viết sức khoẻ, bệnh lý, tư vấn dược
-- Hỗ trợ SEO với slug và excerpt
-- =============================================================================
CREATE TABLE articles (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    title           VARCHAR(400)    NOT NULL    COMMENT 'Tiêu đề bài viết',
    slug            VARCHAR(450)    NOT NULL    COMMENT 'URL slug SEO-friendly, VD: benh-gut-nguyen-nhan-va-dieu-tri',
    content         LONGTEXT        NOT NULL    COMMENT 'Nội dung HTML đầy đủ của bài viết',
    excerpt         TEXT                        COMMENT 'Tóm tắt ngắn (200-300 ký tự), dùng hiển thị danh sách',
    thumbnail_url   VARCHAR(500)                COMMENT 'URL ảnh thumbnail bài viết',
    category_id     INT             NOT NULL    COMMENT 'FK → cms_categories.id',
    -- Cross-schema: mg_identity.users.id
    author_id       BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — dược sĩ/admin viết bài',
    tags            JSON                        COMMENT 'JSON array tags, VD: ["benh-gut","acid-uric","khop"]',
    status          ENUM('draft','published','archived') NOT NULL DEFAULT 'draft'
                                                COMMENT 'draft=bản nháp, published=đã xuất bản, archived=lưu trữ',
    published_at    DATETIME                    COMMENT 'Thời điểm xuất bản — NULL nếu chưa publish',
    view_count      INT             NOT NULL DEFAULT 0
                                                COMMENT 'Lượt xem bài viết (tăng dần)',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_articles_slug (slug),
    INDEX idx_articles_category_id (category_id),
    INDEX idx_articles_status (status),
    INDEX idx_articles_published_at (published_at),
    INDEX idx_articles_author_id (author_id),
    -- Full-text search trên tiêu đề và nội dung
    FULLTEXT INDEX ft_articles_title_content (title, excerpt),

    CONSTRAINT fk_articles_category
        FOREIGN KEY (category_id) REFERENCES cms_categories(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Bài viết sức khoẻ, bệnh lý, tư vấn thuốc của Nhà thuốc Minh Giang';

-- =============================================================================
-- BẢNG: banners
-- Banner quảng cáo hiển thị trên website client
-- =============================================================================
CREATE TABLE banners (
    id          INT             NOT NULL AUTO_INCREMENT,
    title       VARCHAR(200)    NOT NULL    COMMENT 'Tên banner (chỉ dùng quản lý nội bộ)',
    image_url   VARCHAR(500)    NOT NULL    COMMENT 'URL hình ảnh banner (desktop, khuyến nghị 1920×600)',
    link_url    VARCHAR(500)                COMMENT 'URL chuyển hướng khi click vào banner',
    position    ENUM('hero','popup','sidebar') NOT NULL
                                            COMMENT 'Vị trí hiển thị: hero=banner chính, popup=cửa sổ pop-up, sidebar=bên cạnh',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    start_date  DATE                        COMMENT 'Ngày bắt đầu hiển thị (NULL=hiển thị ngay)',
    end_date    DATE                        COMMENT 'Ngày kết thúc hiển thị (NULL=không giới hạn)',
    sort_order  INT             NOT NULL DEFAULT 0
                                            COMMENT 'Thứ tự hiển thị (nhỏ = ưu tiên cao)',

    PRIMARY KEY (id),
    INDEX idx_banners_position (position),
    INDEX idx_banners_is_active (is_active),
    INDEX idx_banners_date_range (start_date, end_date)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Banner quảng cáo và thông báo trên website';

-- =============================================================================
-- BẢNG: promotions
-- Chương trình khuyến mãi — hỗ trợ nhiều loại: % giảm, tiền giảm, freeship, mua X tặng Y
-- =============================================================================
CREATE TABLE promotions (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    name                VARCHAR(200)    NOT NULL    COMMENT 'Tên chương trình: Giảm 10% tất cả Vitamin, Freeship đơn từ 500k...',
    code                VARCHAR(50)                 COMMENT 'Mã voucher nhập tay: SUMMER10 — NULL=tự động áp dụng khi đủ điều kiện',
    type                ENUM(
                            'percent_discount',     -- Giảm theo %
                            'fixed_discount',       -- Giảm số tiền cố định
                            'free_shipping',        -- Miễn phí vận chuyển
                            'buy_x_get_y'           -- Mua X tặng Y
                        ) NOT NULL                  COMMENT 'Loại khuyến mãi',
    discount_value      DECIMAL(10,2)   NOT NULL    COMMENT 'Giá trị giảm: 10 (= 10%) hoặc 50000 (= -50.000đ)',
    min_order_value     DECIMAL(12,2)   NOT NULL DEFAULT 0.00
                                                    COMMENT 'Giá trị đơn hàng tối thiểu để áp dụng KM',
    max_discount_amount DECIMAL(12,2)               COMMENT 'Số tiền giảm tối đa (VD: giảm 10% nhưng tối đa 100.000đ) — NULL=không giới hạn',
    applicable_to       ENUM('all','specific_categories','specific_products') NOT NULL DEFAULT 'all'
                                                    COMMENT 'Phạm vi áp dụng KM',
    applicable_ids      JSON                        COMMENT 'JSON array [id1, id2...] cho specific_categories hoặc specific_products',
    usage_limit         INT                         COMMENT 'Số lượt dùng tổng tối đa — NULL=không giới hạn',
    usage_count         INT             NOT NULL DEFAULT 0
                                                    COMMENT 'Đã dùng bao nhiêu lượt (tăng mỗi khi đơn hàng áp dụng)',
    start_date          DATETIME        NOT NULL    COMMENT 'Thời điểm bắt đầu KM',
    end_date            DATETIME        NOT NULL    COMMENT 'Thời điểm kết thúc KM',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1
                                                    COMMENT '0=tạm dừng KM trước hạn',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_promotions_code (code),
    INDEX idx_promotions_is_active (is_active),
    INDEX idx_promotions_date_range (start_date, end_date),
    INDEX idx_promotions_type (type)
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  COMMENT='Chương trình khuyến mãi và mã voucher giảm giá';

-- =============================================================================
-- DỮ LIỆU MẪU: mg_cms
-- =============================================================================

-- Danh mục CMS
INSERT INTO cms_categories (name, slug, type) VALUES
('Kiến thức bệnh lý',   'kien-thuc-benh-ly',    'disease'),
('Thực phẩm & Dinh dưỡng', 'thuc-pham-dinh-duong', 'article'),
('Tư vấn dùng thuốc',   'tu-van-dung-thuoc',    'article'),
('Tin tức y tế',        'tin-tuc-y-te',         'article'),
('Chương trình KM',     'chuong-trinh-khuyen-mai', 'promotion');

-- Bài viết sức khoẻ
INSERT INTO articles (title, slug, content, excerpt, thumbnail_url, category_id, author_id, tags, status, published_at, view_count) VALUES
(
    'Bệnh gút: Nguyên nhân, triệu chứng và cách điều trị hiệu quả',
    'benh-gut-nguyen-nhan-trieu-chung-dieu-tri',
    '<h2>Bệnh gút là gì?</h2><p>Bệnh gút (gout) là một dạng viêm khớp do tích tụ tinh thể urat trong khớp, gây ra những cơn đau dữ dội, đặc biệt là ở ngón chân cái...</p><h2>Nguyên nhân</h2><p>Bệnh gút xảy ra khi nồng độ axit uric trong máu quá cao (tăng acid uric máu)...</p>',
    'Bệnh gút là dạng viêm khớp phổ biến do tích tụ tinh thể urat, gây đau dữ dội. Tìm hiểu nguyên nhân, triệu chứng và phương pháp điều trị hiệu quả.',
    '/assets/images/benh-ly/benh-gut.jpg',
    1, 2,
    '["benh-gut","acid-uric","viem-khop","dieu-tri"]',
    'published', '2026-03-01 08:00:00', 1250
),
(
    'Vitamin C: Lợi ích sức khoẻ và liều dùng khuyến nghị',
    'vitamin-c-loi-ich-suc-khoe-lieu-dung',
    '<h2>Vitamin C là gì?</h2><p>Vitamin C (axit ascorbic) là một vitamin tan trong nước thiết yếu cho nhiều chức năng cơ thể...</p>',
    'Vitamin C đóng vai trò quan trọng trong hệ miễn dịch, tổng hợp collagen và chống oxy hóa. Tìm hiểu liều dùng và nguồn thực phẩm giàu Vitamin C.',
    '/assets/images/vitamin-c.jpg',
    2, 2,
    '["vitamin-c","suc-de-khang","collagen","chong-oxy-hoa"]',
    'published', '2026-03-05 09:00:00', 890
),
(
    'Hướng dẫn sử dụng kháng sinh đúng cách — Không tự ý dùng',
    'huong-dan-su-dung-khang-sinh-dung-cach',
    '<h2>Tầm quan trọng của việc dùng kháng sinh đúng cách</h2><p>Kháng sinh là thuốc chỉ có tác dụng với vi khuẩn, không có tác dụng với virus...</p>',
    'Lạm dụng kháng sinh gây kháng thuốc nguy hiểm. Hướng dẫn dùng đúng liều, đúng thời gian và khi nào cần gặp bác sĩ.',
    '/assets/images/khang-sinh.jpg',
    3, 2,
    '["khang-sinh","khang-thuoc","amoxicillin","dung-thuoc-dung-cach"]',
    'published', '2026-03-10 10:00:00', 2100
),
(
    'Nhà thuốc Minh Giang khai trương chi nhánh mới tại Quận 1',
    'minh-giang-khai-truong-chi-nhanh-quan-1',
    '<p>Nhà thuốc Minh Giang vui mừng thông báo khai trương chi nhánh mới tại 128 Nguyễn Huệ, Quận 1, TP.HCM...</p>',
    'Chào mừng chi nhánh mới của Nhà thuốc Minh Giang tại Quận 1 - phục vụ khách hàng từ 07:00 đến 22:00 hàng ngày.',
    '/assets/images/khai-truong.jpg',
    4, 1,
    '["khai-truong","chi-nhanh-moi","quan-1"]',
    'published', '2026-03-15 07:00:00', 345
),
(
    'Thuốc hạ sốt: Paracetamol hay Ibuprofen — Khi nào dùng loại nào?',
    'ha-sot-paracetamol-hay-ibuprofen',
    '<h2>Paracetamol</h2><p>Paracetamol an toàn cho mọi lứa tuổi, dùng được cho phụ nữ mang thai...</p><h2>Ibuprofen</h2><p>Ibuprofen có thêm tác dụng kháng viêm, hiệu quả hơn với đau do viêm...</p>',
    'So sánh chi tiết Paracetamol và Ibuprofen: cơ chế, chỉ định, chống chỉ định để dùng đúng thuốc hạ sốt.',
    '/assets/images/ha-sot.jpg',
    3, 5,
    '["ha-sot","paracetamol","ibuprofen","giam-dau"]',
    'published', '2026-03-12 08:30:00', 1680
),
('Bệnh tiểu đường type 2: Chế độ ăn uống và lối sống',
    'benh-tieu-duong-type-2-che-do-an-uong',
    '<p>Bệnh tiểu đường type 2 ngày càng phổ biến...</p>',
    'Kiểm soát đường huyết hiệu quả qua chế độ ăn uống lành mạnh và luyện tập thể dục.',
    '/assets/images/tieu-duong.jpg',
    1, 2,
    '["tieu-duong","duong-huyet","che-do-an"]',
    'draft', NULL, 0);

-- Banner quảng cáo
INSERT INTO banners (title, image_url, link_url, position, is_active, start_date, end_date, sort_order) VALUES
('Khai trương Chi nhánh Quận 1 — Giảm 20%',    '/assets/images/banner-khai-truong.jpg', '/khai-truong.html',          'hero',    1, '2026-03-15', '2026-03-31', 1),
('Mùa hè khỏe mạnh — Ưu đãi Vitamin C',         '/assets/images/banner-vitamin-c.jpg',   '/client/category.html?cat=9', 'hero',    1, '2026-03-01', '2026-04-30', 2),
('Tư vấn dược miễn phí — Chat với Dược sĩ',     '/assets/images/banner-tuvan.jpg',       '/client/chat.html',           'sidebar', 1, NULL,         NULL,         1),
('Flash Sale Vitamin mỗi thứ 6 — Giảm đến 30%', '/assets/images/popup-friday-sale.jpg', '/client/category.html?cat=3', 'popup',   1, '2026-03-14', '2026-04-18', 1);

-- Chương trình khuyến mãi
INSERT INTO promotions (name, code, type, discount_value, min_order_value, max_discount_amount, applicable_to, applicable_ids, usage_limit, usage_count, start_date, end_date, is_active) VALUES
(
    'Khai trương Chi nhánh Q1 — Giảm 20% tất cả',
    'KHAITUONG20',
    'percent_discount',
    20.00, 0.00, 500000.00,
    'all', NULL,
    500, 47,
    '2026-03-15 00:00:00', '2026-03-31 23:59:59',
    1
),
(
    'Freeship cho đơn từ 500.000đ',
    NULL,
    'free_shipping',
    0.00, 500000.00, NULL,
    'all', NULL,
    NULL, 0,
    '2026-01-01 00:00:00', '2026-12-31 23:59:59',
    1
),
(
    'Giảm 10% cho nhóm Vitamin & TPCN',
    'VITAMIN10',
    'percent_discount',
    10.00, 200000.00, 200000.00,
    'specific_categories', '[3]',
    200, 38,
    '2026-03-01 00:00:00', '2026-04-30 23:59:59',
    1
),
(
    'Thành viên VIP — Giảm 15% mọi đơn hàng',
    'VIP15',
    'percent_discount',
    15.00, 0.00, 300000.00,
    'all', NULL,
    NULL, 0,
    '2026-01-01 00:00:00', '2026-12-31 23:59:59',
    1
),
(
    'Mua 2 Hộp Panadol tặng 1 Hộp',
    NULL,
    'buy_x_get_y',
    1.00, 0.00, NULL,
    'specific_products', '[1]',
    100, 15,
    '2026-03-10 00:00:00', '2026-03-31 23:59:59',
    1
);


-- -----------------------------------------------------------------------------
-- PATCH -- bo sung bang/cot (da hop nhat, khong chay rieng nua)
-- -----------------------------------------------------------------------------

-- =============================================================================
-- PATCH: mg_cms — Bổ sung các bảng còn thiếu
-- Bổ sung: store_config, cms_media, cms_pages, trending_searches
-- =============================================================================

USE mg_cms;

-- =============================================================================
-- BẢNG: store_config
-- Cấu hình nhà thuốc dạng key-value linh hoạt (cài đặt hệ thống)
-- API: GET /api/cms/store-config, PUT /api/cms/store-config
--      GET /api/cms/store-config/:key
-- =============================================================================
CREATE TABLE IF NOT EXISTS store_config (
    config_key      VARCHAR(100)    NOT NULL    COMMENT 'Khoá cấu hình — dùng snake_case, phân nhóm bằng tiền tố: store_, payment_, shipping_, loyalty_, ...)',
    config_value    TEXT            NOT NULL    COMMENT 'Giá trị — string, JSON, boolean (''true''/''false''), số',
    value_type      ENUM('string','integer','decimal','boolean','json') NOT NULL DEFAULT 'string'
                                                COMMENT 'Kiểu dữ liệu để parse đúng ở frontend/backend',
    display_name    VARCHAR(200)    NOT NULL    COMMENT 'Tên hiển thị cho admin UI',
    description     VARCHAR(500)                COMMENT 'Mô tả chi tiết cài đặt này làm gì',
    group_name      VARCHAR(100)    NOT NULL DEFAULT 'general'
                                                COMMENT 'Nhóm cài đặt: store, payment, shipping, loyalty, notification',
    is_public       TINYINT(1)      NOT NULL DEFAULT 0
                                                COMMENT '1=cho phép guest đọc qua API public (tên nhà thuốc, địa chỉ, ...)',
    is_editable     TINYINT(1)      NOT NULL DEFAULT 1
                                                COMMENT '0=chỉ đọc, không cho phép sửa từ admin UI',
    updated_by      BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — người cập nhật cuối',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (config_key),
    INDEX idx_store_config_group (group_name),
    INDEX idx_store_config_public (is_public)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Cấu hình nhà thuốc dạng key-value — thay thế file .env cho runtime config';

-- =============================================================================
-- BẢNG: cms_media
-- Quản lý media upload (ảnh sản phẩm, banner, ảnh bài viết, v.v.)
-- API: POST /api/cms/upload, GET /api/cms/media, DELETE /api/cms/media/:id
-- =============================================================================
CREATE TABLE IF NOT EXISTS cms_media (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    original_name   VARCHAR(500)    NOT NULL    COMMENT 'Tên file gốc khi upload',
    stored_name     VARCHAR(500)    NOT NULL    COMMENT 'Tên file thực tế lưu trữ (UUID + ext)',
    file_url        VARCHAR(1000)   NOT NULL    COMMENT 'URL công khai truy cập file',
    thumbnail_url   VARCHAR(1000)               COMMENT 'URL thumbnail đã resize (chỉ có với ảnh)',
    file_size       BIGINT          NOT NULL    COMMENT 'Kích thước file theo bytes',
    mime_type       VARCHAR(100)    NOT NULL    COMMENT 'MIME type: image/jpeg, image/webp, application/pdf, ...',
    media_type      ENUM('image','document','video','other') NOT NULL DEFAULT 'image',
    width           INT                         COMMENT 'Chiều rộng px (chỉ có với ảnh/video)',
    height          INT                         COMMENT 'Chiều cao px (chỉ có với ảnh/video)',
    alt_text        VARCHAR(300)                COMMENT 'Alt text SEO cho ảnh',
    tags            JSON                        COMMENT 'Nhãn phân loại JSON array: ["banner","product","article"]',
    -- Usage tracking
    used_in         VARCHAR(100)                COMMENT 'Nơi sử dụng: articles, banners, products, ...',
    used_in_id      BIGINT                      COMMENT 'ID của record đang dùng file này (có thể NULL)',
    -- Cross-schema: mg_identity.users.id
    uploaded_by     BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_identity.users.id — người upload',
    is_deleted      TINYINT(1)      NOT NULL DEFAULT 0  COMMENT 'Soft delete — 1=đã xoá khỏi thư viện',
    deleted_at      DATETIME                    COMMENT 'Thời điểm soft delete',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_cms_media_type (media_type),
    INDEX idx_cms_media_uploaded_by (uploaded_by),
    INDEX idx_cms_media_used_in (used_in, used_in_id),
    INDEX idx_cms_media_deleted (is_deleted)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Thư viện media upload — ảnh, tài liệu, video của toàn hệ thống';

-- =============================================================================
-- BẢNG: cms_pages
-- Trang nội dung tĩnh: Giới thiệu, Chính sách đổi trả, Bảo mật, ...
-- API: GET /api/cms/pages, GET /api/cms/pages/:slug
--      POST /api/cms/pages, PUT /api/cms/pages/:id, DELETE /api/cms/pages/:id
-- =============================================================================
CREATE TABLE IF NOT EXISTS cms_pages (
    id              INT             NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(200)    NOT NULL    COMMENT 'URL slug: about-us, privacy-policy, return-policy, ...',
    title           VARCHAR(300)    NOT NULL    COMMENT 'Tiêu đề trang',
    content         LONGTEXT        NOT NULL    COMMENT 'Nội dung HTML/Markdown toàn trang',
    meta_title      VARCHAR(300)                COMMENT 'SEO: <title> tag',
    meta_description VARCHAR(500)              COMMENT 'SEO: meta description',
    meta_keywords   VARCHAR(300)                COMMENT 'SEO: meta keywords',
    featured_image  VARCHAR(1000)               COMMENT 'URL ảnh đại diện trang (dùng cho social share)',
    -- Cross-schema: mg_identity.users.id
    author_id       BIGINT          NOT NULL    COMMENT '(Cross-schema) mg_identity.users.id — người tạo',
    published_by    BIGINT                      COMMENT '(Cross-schema) mg_identity.users.id — người xuất bản',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1  COMMENT '1=đang hoạt động và hiện trên web',
    show_in_footer  TINYINT(1)      NOT NULL DEFAULT 0  COMMENT '1=hiện link trang này trong footer',
    sort_order      INT             NOT NULL DEFAULT 0   COMMENT 'Thứ tự sắp xếp trong danh mục trang',
    published_at    DATETIME                    COMMENT 'Thời điểm xuất bản (NULL=chưa xuất bản)',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_cms_pages_slug (slug),
    INDEX idx_cms_pages_active (is_active),
    INDEX idx_cms_pages_footer (show_in_footer)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Trang nội dung tĩnh CMS: giới thiệu, chính sách, hướng dẫn';

-- =============================================================================
-- BẢNG: trending_searches
-- Theo dõi từ khoá tìm kiếm phổ biến theo ngữ cảnh
-- API: GET /api/cms/trending-searches, PUT /api/cms/trending-searches/:id (admin)
--      POST /api/catalog/search (ghi nhận mỗi lần search)
-- =============================================================================
CREATE TABLE IF NOT EXISTS trending_searches (
    id              INT             NOT NULL AUTO_INCREMENT,
    keyword         VARCHAR(300)    NOT NULL    COMMENT 'Từ khoá tìm kiếm (đã lowercase/normalize)',
    context         ENUM('global','product','disease','article') NOT NULL DEFAULT 'global'
                                                COMMENT 'Ngữ cảnh: global=toàn trang, product=tìm sản phẩm, disease=tìm bệnh',
    search_count    BIGINT          NOT NULL DEFAULT 1
                                                COMMENT 'Tổng số lượt tìm từ khoá này',
    distinct_users  INT             NOT NULL DEFAULT 1
                                                COMMENT 'Số người dùng khác nhau đã tìm (estimate)',
    is_pinned       TINYINT(1)      NOT NULL DEFAULT 0
                                                COMMENT '1=admin ghim cố định không phụ thuộc search_count',
    is_hidden       TINYINT(1)      NOT NULL DEFAULT 0
                                                COMMENT '1=admin ẩn khỏi danh sách hot search',
    pin_order       INT             NOT NULL DEFAULT 0
                                                COMMENT 'Thứ tự hiện nếu is_pinned=1',
    period_start    DATE            NOT NULL    COMMENT 'Ngày bắt đầu tính kỳ thống kê',
    period_end      DATE            NOT NULL    COMMENT 'Ngày kết thúc kỳ thống kê',
    last_searched   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                COMMENT 'Lần gần nhất có người tìm từ khoá này',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_trending_keyword_context_period (keyword, context, period_start),
    INDEX idx_trending_search_count (search_count DESC),
    INDEX idx_trending_context (context),
    INDEX idx_trending_pinned (is_pinned, pin_order),
    INDEX idx_trending_period (period_start, period_end)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  COMMENT='Từ khoá tìm kiếm phổ biến — dùng hiển thị hot search và gợi ý';

-- =============================================================================
-- DỮ LIỆU MẪU — patch mg_cms
-- =============================================================================

-- store_config: cấu hình nhà thuốc
INSERT INTO store_config (config_key, config_value, value_type, display_name, description, group_name, is_public) VALUES
-- Thông tin cửa hàng (public)
('store_name',              'Nhà Thuốc Minh Giang',                          'string',  'Tên nhà thuốc',            'Tên hiển thị trên website và hoá đơn',            'store',       1),
('store_tagline',           'Chăm sóc sức khoẻ tận tâm',                     'string',  'Tagline',                  'Khẩu hiệu ngắn của nhà thuốc',                    'store',       1),
('store_phone',             '028 1234 5678',                                  'string',  'SĐT nhà thuốc',            'Số điện thoại chính hiển thị trên website',        'store',       1),
('store_email',             'info@minhgiang.vn',                              'string',  'Email liên hệ',            'Email liên hệ công khai',                         'store',       1),
('store_address',           '123 Đường Nguyễn Trãi, Quận 5, TP. Hồ Chí Minh', 'string','Địa chỉ cửa hàng',          'Địa chỉ đầy đủ nhà thuốc chính',                  'store',       1),
('store_logo_url',          'https://cdn.minhgiang.vn/logo/logo-main.png',   'string',  'URL logo',                 'Đường dẫn logo chính độ phân giải cao',           'store',       1),
('store_favicon_url',       'https://cdn.minhgiang.vn/logo/favicon.ico',     'string',  'URL favicon',              'Favicon trình duyệt',                             'store',       1),
('store_opening_hours',     '{"mon_fri":"07:00-21:00","sat_sun":"07:30-20:00"}', 'json', 'Giờ mở cửa',              'Giờ mở cửa theo ngày JSON',                       'store',       1),
('store_google_maps_url',   'https://maps.google.com/?q=...',                'string',  'URL Google Maps',          'Link Google Maps nhà thuốc',                      'store',       1),
-- Vận chuyển
('shipping_free_from',      '500000',                                         'integer', 'Miễn phí từ',             'Giá trị đơn hàng tối thiểu được miễn phí ship (VND)', 'shipping',  1),
('shipping_base_fee',       '30000',                                          'integer', 'Phí giao hàng cơ bản',    'Phí ship mặc định nếu chưa đủ điều kiện (VND)',    'shipping',    1),
('shipping_express_fee',    '50000',                                          'integer', 'Phí giao nhanh',          'Phí giao hàng nhanh 2 giờ (VND)',                 'shipping',    1),
-- Thanh toán
('payment_cod_enabled',     'true',                                           'boolean', 'Cho phép COD',            'Bật/tắt hình thức thanh toán tiền mặt khi nhận hàng', 'payment',  0),
('payment_vnpay_enabled',   'true',                                           'boolean', 'Cho phép VNPay',          'Bật/tắt cổng thanh toán VNPay',                   'payment',    0),
('payment_momo_enabled',    'true',                                           'boolean', 'Cho phép MoMo',           'Bật/tắt ví điện tử MoMo',                         'payment',    0),
-- Loyalty
('loyalty_enabled',         'true',                                           'boolean', 'Bật loyalty points',      'Bật/tắt toàn bộ hệ thống tích điểm',              'loyalty',    1),
('loyalty_base_vnd',        '10000',                                          'integer', 'VND/1 điểm',              'Cứ bao nhiêu VND thì được 1 điểm cơ bản',         'loyalty',    1),
('loyalty_min_redeem',      '100',                                            'integer', 'Điểm tối thiểu đổi',      'Số điểm tối thiểu để được phép đổi',              'loyalty',    1),
('loyalty_redeem_rate',     '200',                                            'integer', 'VND/điểm khi đổi',        '1 điểm đổi được bao nhiêu VND giảm giá',          'loyalty',    1),
-- Tính năng
('feature_prescription_required', 'true',                                    'boolean', 'Yêu cầu đơn thuốc Rx',   'Bắt buộc upload đơn thuốc khi mua thuốc kê đơn',  'feature',    0),
('feature_review_enabled',  'true',                                           'boolean', 'Bật đánh giá sản phẩm',  'Cho phép khách hàng đánh giá sản phẩm',           'feature',    1),
('feature_chat_enabled',    'false',                                          'boolean', 'Bật chat tư vấn',        'Bật tính năng chat trực tuyến với dược sĩ',       'feature',    1);

-- cms_pages: trang tĩnh
INSERT INTO cms_pages (slug, title, content, meta_title, meta_description, author_id, published_by, is_active, show_in_footer, sort_order, published_at) VALUES
(
    'gioi-thieu',
    'Giới Thiệu Nhà Thuốc Minh Giang',
    '<h1>Giới Thiệu</h1><p>Nhà Thuốc Minh Giang được thành lập năm 2010, chuyên cung cấp các loại thuốc chính hãng, thực phẩm chức năng và thiết bị y tế chất lượng cao.</p><p>Với đội ngũ dược sĩ tâm huyết và hệ thống kho lạnh đạt chuẩn GDP, chúng tôi cam kết mang đến sản phẩm đảm bảo chất lượng và tư vấn sức khỏe chuyên nghiệp.</p>',
    'Giới Thiệu - Nhà Thuốc Minh Giang',
    'Nhà Thuốc Minh Giang - chuyên cung cấp thuốc chính hãng, thực phẩm chức năng và thiết bị y tế chất lượng cao tại TP.HCM',
    1, 1, 1, 1, 1, '2026-01-01 08:00:00'
),
(
    'chinh-sach-doi-tra',
    'Chính Sách Đổi Trả',
    '<h1>Chính Sách Đổi Trả</h1><h2>Điều kiện đổi trả</h2><ul><li>Sản phẩm còn nguyên vẹn, chưa mở bao bì</li><li>Còn trong thời hạn 7 ngày kể từ ngày mua</li><li>Có hoá đơn mua hàng</li></ul><h2>Hàng không được đổi trả</h2><ul><li>Thuốc kê đơn đã mở bao bì</li><li>Sản phẩm đã sử dụng</li><li>Hàng khuyến mại đặc biệt</li></ul>',
    'Chính Sách Đổi Trả - Nhà Thuốc Minh Giang',
    'Chính sách đổi trả hàng tại Nhà Thuốc Minh Giang — rõ ràng, minh bạch, bảo vệ quyền lợi khách hàng',
    1, 1, 1, 1, 2, '2026-01-01 08:00:00'
),
(
    'chinh-sach-bao-mat',
    'Chính Sách Bảo Mật',
    '<h1>Chính Sách Bảo Mật</h1><p>Nhà Thuốc Minh Giang cam kết bảo vệ thông tin cá nhân của khách hàng theo quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP).</p><h2>Thông tin chúng tôi thu thập</h2><ul><li>Họ tên, số điện thoại, địa chỉ email</li><li>Địa chỉ giao hàng</li><li>Lịch sử đơn hàng và đơn thuốc (bảo mật tuyệt đối)</li></ul>',
    'Chính Sách Bảo Mật - Nhà Thuốc Minh Giang',
    'Chính sách bảo mật thông tin cá nhân tại Nhà Thuốc Minh Giang',
    1, 1, 1, 1, 3, '2026-01-01 08:00:00'
),
(
    'huong-dan-mua-hang',
    'Hướng Dẫn Mua Hàng',
    '<h1>Hướng Dẫn Mua Hàng Online</h1><ol><li>Tìm sản phẩm qua thanh tìm kiếm hoặc danh mục</li><li>Thêm sản phẩm vào giỏ hàng</li><li>Điền thông tin giao hàng</li><li>Chọn phương thức thanh toán</li><li>Xác nhận đơn hàng</li></ol><p>Sau khi đặt hàng, chúng tôi sẽ xác nhận qua SMS trong vòng 15 phút.</p>',
    'Hướng Dẫn Mua Hàng - Nhà Thuốc Minh Giang',
    'Hướng dẫn chi tiết cách mua hàng online tại Nhà Thuốc Minh Giang',
    1, 1, 1, 1, 4, '2026-01-01 08:00:00'
),
(
    'tuyen-dung',
    'Tuyển Dụng',
    '<h1>Cơ Hội Nghề Nghiệp</h1><p>Nhà Thuốc Minh Giang luôn tìm kiếm những dược sĩ tâm huyết gia nhập đội ngũ. Gửi CV về email <a href="mailto:hr@minhgiang.vn">hr@minhgiang.vn</a></p><h2>Vị trí đang tuyển</h2><ul><li>Dược sĩ tư vấn (Full-time)</li><li>Nhân viên kho (Part-time)</li><li>Lập trình viên (Back-end Node.js)</li></ul>',
    'Tuyển Dụng - Nhà Thuốc Minh Giang',
    'Cơ hội nghề nghiệp tại Nhà Thuốc Minh Giang',
    1, NULL, 0, 0, 5, NULL
);

-- trending_searches: từ khoá hot
INSERT INTO trending_searches (keyword, context, search_count, distinct_users, is_pinned, pin_order, period_start, period_end) VALUES
('paracetamol',         'product',  8542, 3201, 1, 1,  '2026-03-01', '2026-03-31'),
('vitamin c',           'product',  6234, 2890, 1, 2,  '2026-03-01', '2026-03-31'),
('viêm họng',          'disease',  4521, 1988, 0, 0,  '2026-03-01', '2026-03-31'),
('omeprazol',           'product',  3892, 1754, 0, 0,  '2026-03-01', '2026-03-31'),
('khẩu trang',         'product',  3401, 1600, 0, 0,  '2026-03-01', '2026-03-31'),
('dầu gió',            'product',  2987, 1342, 1, 3,  '2026-03-01', '2026-03-31'),
('đau dạ dày',         'disease',  2654, 1189, 0, 0,  '2026-03-01', '2026-03-31'),
('amoxicillin',         'product',  2103, 890,  0, 0,  '2026-03-01', '2026-03-31'),
('collagen',            'product',  1987, 876,  0, 0,  '2026-03-01', '2026-03-31'),
('huyết áp',           'disease',  1876, 820,  0, 0,  '2026-03-01', '2026-03-31'),
('ibuprofen',           'product',  1654, 743,  0, 0,  '2026-03-01', '2026-03-31'),
('siro ho',             'product',  1543, 712,  0, 0,  '2026-03-01', '2026-03-31'),
('thuốc ngủ',          'product',  1234, 678,  0, 0,  '2026-03-01', '2026-03-31'),
('khai trương',         'global',   987,  543,  0, 0,  '2026-03-01', '2026-03-31'),
('đơn thuốc online',   'global',   876,  432,  0, 0,  '2026-03-01', '2026-03-31');

-- cms_media: media mẫu
INSERT INTO cms_media (original_name, stored_name, file_url, thumbnail_url, file_size, mime_type, media_type, width, height, alt_text, used_in, uploaded_by) VALUES
('banner-khai-truong.jpg',     'banner-khairtruong-uuid1234.jpg', 'https://cdn.minhgiang.vn/banners/banner-khai-truong.jpg',     'https://cdn.minhgiang.vn/banners/thumb-banner-khai-truong.jpg',     524288, 'image/jpeg',  'image', 1920, 600,  'Banner khai trương nhà thuốc Minh Giang',     'banners', 1),
('logo-main.png',              'logo-main-uuid5678.png',          'https://cdn.minhgiang.vn/logo/logo-main.png',                  NULL,                                                                   45678,  'image/png',   'image', 400,  120,  'Logo chính nhà thuốc Minh Giang',             'store',   1),
('paracetamol-500mg.jpg',      'prod-pct500-uuidabcd.jpg',        'https://cdn.minhgiang.vn/products/paracetamol-500mg.jpg',      'https://cdn.minhgiang.vn/products/thumb-paracetamol-500mg.jpg',     92160,  'image/jpeg',  'image', 800,  800,  'Paracetamol 500mg Hộp 100 viên',             'products', 1),
('vitamin-c-1000.jpg',         'prod-vtc1000-uuidefgh.jpg',       'https://cdn.minhgiang.vn/products/vitamin-c-1000.jpg',         'https://cdn.minhgiang.vn/products/thumb-vitamin-c-1000.jpg',        81920,  'image/jpeg',  'image', 800,  800,  'Vitamin C 1000mg Emergen-C',                  'products', 1),
('banner-vitamin-mua-he.jpg',  'banner-vitamin-uuid9012.jpg',     'https://cdn.minhgiang.vn/banners/banner-vitamin-mua-he.jpg',   'https://cdn.minhgiang.vn/banners/thumb-banner-vitamin-mua-he.jpg',  614400, 'image/jpeg',  'image', 1920, 600,  'Banner khuyến mãi Vitamin mùa hè',            'banners', 1),
('rx-bvnd-20260315-001.jpg',   'rx-bvnd-uuid3456.jpg',            'https://cdn.minhgiang.vn/prescriptions/rx-bvnd-20260315-001.jpg', NULL,                                                              204800, 'image/jpeg',  'image', 1200, 1600, 'Đơn thuốc BV Nhân Dân 115 - Nguyễn Thị Mai', 'prescriptions', 3);
