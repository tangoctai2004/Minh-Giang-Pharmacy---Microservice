-- =============================================================================
-- SCHEMA: mg_cms
-- Mục đích: Quản lý nội dung (Content Management System)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mg_cms
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mg_cms;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS trending_searches;
DROP TABLE IF EXISTS cms_pages;
DROP TABLE IF EXISTS cms_media;
DROP TABLE IF EXISTS store_config;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS banners;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS cms_categories;

-- =============================================================================
-- BẢNG: cms_categories
-- =============================================================================
CREATE TABLE cms_categories (
    id      INT             NOT NULL AUTO_INCREMENT,
    name    VARCHAR(150)    NOT NULL,
    slug    VARCHAR(200)    NOT NULL,
    type    ENUM('article','disease','promotion') NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_cms_categories_slug (slug),
    INDEX idx_cms_categories_type (type)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: articles
-- =============================================================================
CREATE TABLE articles (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    title           VARCHAR(400)    NOT NULL,
    slug            VARCHAR(450)    NOT NULL,
    content         LONGTEXT        NOT NULL,
    content_sanitized LONGTEXT        COMMENT 'HTML đã qua server-side sanitizer',
    sanitized_at    DATETIME,
    excerpt         TEXT,
    thumbnail_url   VARCHAR(500),
    category_id     INT             NOT NULL,
    author_id       BIGINT,
    tags            JSON,
    status          ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
    published_at    DATETIME,
    view_count      INT             NOT NULL DEFAULT 0,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_articles_slug (slug),
    INDEX idx_articles_category_id (category_id),
    INDEX idx_articles_status (status),
    INDEX idx_articles_published_at (published_at),
    FULLTEXT INDEX ft_articles_title_content (title, excerpt),

    CONSTRAINT fk_articles_category FOREIGN KEY (category_id) REFERENCES cms_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: banners
-- =============================================================================
CREATE TABLE banners (
    id          INT             NOT NULL AUTO_INCREMENT,
    title       VARCHAR(200)    NOT NULL,
    image_url   VARCHAR(500)    NOT NULL,
    link_url    VARCHAR(500),
    position    ENUM('hero','popup','sidebar') NOT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    start_date  DATE,
    end_date    DATE,
    sort_order  INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    INDEX idx_banners_position (position),
    INDEX idx_banners_is_active (is_active)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: promotions
-- =============================================================================
CREATE TABLE promotions (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    name                VARCHAR(200)    NOT NULL,
    code                VARCHAR(50),
    type                ENUM('percent_discount','fixed_discount','free_shipping','buy_x_get_y') NOT NULL,
    discount_value      DECIMAL(10,2)   NOT NULL,
    min_order_value     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    max_discount_amount DECIMAL(12,2),
    applicable_to       ENUM('all','specific_categories','specific_products') NOT NULL DEFAULT 'all',
    applicable_ids      JSON,
    usage_limit         INT,
    usage_count         INT             NOT NULL DEFAULT 0,
    start_date          DATETIME        NOT NULL,
    end_date            DATETIME        NOT NULL,
    is_active           TINYINT(1)      NOT NULL DEFAULT 1,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_promotions_code (code),
    INDEX idx_promotions_is_active (is_active),
    INDEX idx_promotions_date_range (start_date, end_date),

    CONSTRAINT chk_usage_not_exceeded CHECK (usage_limit IS NULL OR usage_count <= usage_limit),
    CONSTRAINT chk_discount_value_non_negative CHECK (discount_value >= 0),
    CONSTRAINT chk_promotion_dates_valid CHECK (end_date > start_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: store_config
-- =============================================================================
CREATE TABLE store_config (
    config_key      VARCHAR(100)    NOT NULL,
    config_value    TEXT            NOT NULL,
    value_type      ENUM('string','integer','decimal','boolean','json') NOT NULL DEFAULT 'string',
    display_name    VARCHAR(200)    NOT NULL,
    description     VARCHAR(500),
    group_name      VARCHAR(100)    NOT NULL DEFAULT 'general',
    is_public       TINYINT(1)      NOT NULL DEFAULT 0,
    is_editable     TINYINT(1)      NOT NULL DEFAULT 1,
    is_sensitive    TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1=config_value là AES-256-GCM ciphertext',
    value_hash      CHAR(64)        COMMENT 'SHA-256 hash của plaintext',
    updated_by      BIGINT,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (config_key),
    INDEX idx_store_config_group (group_name)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: cms_media
-- =============================================================================
CREATE TABLE cms_media (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    original_name   VARCHAR(500)    NOT NULL,
    stored_name     VARCHAR(500)    NOT NULL,
    file_url        VARCHAR(1000)   NOT NULL,
    thumbnail_url   VARCHAR(1000),
    file_size       BIGINT          NOT NULL,
    mime_type       VARCHAR(100)    NOT NULL,
    media_type      ENUM('image','document','video','other') NOT NULL DEFAULT 'image',
    file_extension  VARCHAR(10)     COMMENT 'Whitelist extension',
    width           INT,
    height          INT,
    alt_text        VARCHAR(300),
    tags            JSON,
    used_in         VARCHAR(100),
    used_in_id      BIGINT,
    uploaded_by     BIGINT          NOT NULL,
    is_deleted      TINYINT(1)      NOT NULL DEFAULT 0,
    deleted_at      DATETIME,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_cms_media_type (media_type),
    CONSTRAINT chk_media_safe_extension CHECK (file_extension IN ('jpg','jpeg','png','webp','gif','pdf','mp4','mov','webm','csv','xlsx','xls','doc','docx'))
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: cms_pages
-- =============================================================================
CREATE TABLE cms_pages (
    id              INT             NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(200)    NOT NULL,
    title           VARCHAR(300)    NOT NULL,
    content         LONGTEXT        NOT NULL,
    meta_title      VARCHAR(300),
    meta_description VARCHAR(500),
    featured_image  VARCHAR(1000),
    author_id       BIGINT          NOT NULL,
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    show_in_footer  TINYINT(1)      NOT NULL DEFAULT 0,
    sort_order      INT             NOT NULL DEFAULT 0,
    published_at    DATETIME,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_cms_pages_slug (slug)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- BẢNG: trending_searches
-- =============================================================================
CREATE TABLE trending_searches (
    id              INT             NOT NULL AUTO_INCREMENT,
    keyword         VARCHAR(300)    NOT NULL,
    context         ENUM('global','product','disease','article') NOT NULL DEFAULT 'global',
    search_count    BIGINT          NOT NULL DEFAULT 1,
    is_pinned       TINYINT(1)      NOT NULL DEFAULT 0,
    period_start    DATE            NOT NULL,
    period_end      DATE            NOT NULL,
    last_searched   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_trending_keyword_context_period (keyword, context, period_start)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
