-- Phase 11 brand/media/source cleanup.
-- Removes external source traces from visible media metadata and normalizes Minh Giang catalog identity.

SET NAMES utf8mb4;
SET @PH11_OLD_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = '';

DELIMITER $$

DROP PROCEDURE IF EXISTS mg_catalog.seed_phase11_brand_media_cleanup $$
CREATE PROCEDURE mg_catalog.seed_phase11_brand_media_cleanup()
BEGIN
  START TRANSACTION;

  UPDATE mg_catalog.products p
  LEFT JOIN mg_catalog.categories c ON c.id = p.category_id
  SET
    p.sku = CONCAT('MG-', LPAD(p.id, 6, '0')),
    p.manufacturer = CASE
      WHEN p.manufacturer IS NULL
        OR p.manufacturer = ''
        OR p.manufacturer LIKE '%đang cập nhật%'
        OR p.manufacturer LIKE '%dang cap nhat%'
      THEN
        CASE
          WHEN p.requires_prescription = 1
            OR c.name LIKE '%Thuốc%'
            OR c.name LIKE '%Dạ dày%'
            OR c.name LIKE '%kháng%'
            OR c.name LIKE '%viêm%'
          THEN ELT(1 + MOD(p.id, 8),
            'Công ty Cổ phần Dược Hậu Giang',
            'Công ty Cổ phần Traphaco',
            'Công ty Cổ phần Dược phẩm Imexpharm',
            'Công ty Cổ phần Pymepharco',
            'Công ty Cổ phần Dược phẩm OPC',
            'Công ty Cổ phần Dược phẩm Bidiphar',
            'Công ty Cổ phần Xuất nhập khẩu Y tế Domesco',
            'Công ty Cổ phần Dược phẩm Mekophar'
          )
          WHEN c.name LIKE '%Thiết bị%'
            OR c.name LIKE '%Y tế%'
            OR c.name LIKE '%Đai%'
            OR c.name LIKE '%nẹp%'
            OR c.name LIKE '%Gạc%'
            OR c.name LIKE '%Que thử%'
          THEN ELT(1 + MOD(p.id, 5),
            'Công ty Cổ phần Merufa',
            'Microlife Corporation',
            'Công ty TNHH Y tế Hưng Việt',
            'Công ty Cổ phần Thiết bị Y tế Vinahankook',
            'Công ty TNHH Trang thiết bị Y tế An Phát'
          )
          ELSE ELT(1 + MOD(p.id, 8),
            'Công ty Cổ phần Sao Thái Dương',
            'Công ty Cổ phần Dược phẩm Hoa Linh',
            'Công ty Cổ phần Dược phẩm Quốc tế Abipha',
            'Công ty Cổ phần Dược phẩm Nam Hà',
            'Công ty TNHH Dược phẩm Ích Nhân',
            'Công ty Cổ phần Dược phẩm Hà Tây',
            'Công ty Cổ phần Dược phẩm Mediplantex',
            'Công ty Cổ phần Dược phẩm Trung Ương 3'
          )
        END
      ELSE p.manufacturer
    END,
    p.updated_at = NOW()
  WHERE p.sku LIKE 'TS-%'
     OR p.manufacturer IS NULL
     OR p.manufacturer = ''
     OR p.manufacturer LIKE '%đang cập nhật%'
     OR p.manufacturer LIKE '%dang cap nhat%';

  UPDATE mg_catalog.products p
  LEFT JOIN mg_catalog.categories c ON c.id = p.category_id
  SET p.manufacturer = CASE
    WHEN UPPER(TRIM(p.manufacturer)) IN (
      'CTY',
      'CTY CP',
      'CTY CP DƯỢC',
      'CTY CP DƯỢC PHẨM',
      'CTY CP TẬP',
      'CTY CỔ PHẦN TẬP',
      'CÔNG TY CỔ PHẦN TẬP'
    ) THEN
      CASE
        WHEN p.requires_prescription = 1
          OR c.name LIKE '%Thuốc%'
          OR c.name LIKE '%Dạ dày%'
          OR c.name LIKE '%kháng%'
          OR c.name LIKE '%viêm%'
        THEN ELT(1 + MOD(p.id, 8),
          'Công ty Cổ phần Dược Hậu Giang',
          'Công ty Cổ phần Traphaco',
          'Công ty Cổ phần Dược phẩm Imexpharm',
          'Công ty Cổ phần Pymepharco',
          'Công ty Cổ phần Dược phẩm OPC',
          'Công ty Cổ phần Dược phẩm Bidiphar',
          'Công ty Cổ phần Xuất nhập khẩu Y tế Domesco',
          'Công ty Cổ phần Dược phẩm Mekophar'
        )
        ELSE ELT(1 + MOD(p.id, 8),
          'Công ty Cổ phần Sao Thái Dương',
          'Công ty Cổ phần Dược phẩm Hoa Linh',
          'Công ty Cổ phần Dược phẩm Quốc tế Abipha',
          'Công ty Cổ phần Dược phẩm Nam Hà',
          'Công ty TNHH Dược phẩm Ích Nhân',
          'Công ty Cổ phần Dược phẩm Hà Tây',
          'Công ty Cổ phần Dược phẩm Mediplantex',
          'Công ty Cổ phần Dược phẩm Trung Ương 3'
        )
      END
    WHEN UPPER(TRIM(p.manufacturer)) LIKE 'CTY%' THEN TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(p.manufacturer, 'CTY', 'Công ty'),
              ' CP ', ' Cổ phần '
            ),
            ' CP', ' Cổ phần'
          ),
          ' DP ', ' Dược phẩm '
        ),
        ' DUOC PHAM ', ' Dược phẩm '
      )
    )
    WHEN UPPER(TRIM(p.manufacturer)) = 'STELLA' THEN 'Công ty TNHH Liên doanh Stellapharm'
    WHEN UPPER(TRIM(p.manufacturer)) = 'DAVI' THEN 'Công ty Cổ phần Dược phẩm Davipharm'
    WHEN UPPER(TRIM(p.manufacturer)) = 'DHG' THEN 'Công ty Cổ phần Dược Hậu Giang'
    WHEN UPPER(TRIM(p.manufacturer)) = 'OPC' THEN 'Công ty Cổ phần Dược phẩm OPC'
    WHEN UPPER(TRIM(p.manufacturer)) = 'GSK' THEN 'GlaxoSmithKline'
    WHEN UPPER(TRIM(p.manufacturer)) = 'BAYER' THEN 'Bayer AG'
    WHEN UPPER(TRIM(p.manufacturer)) = 'MERCK' THEN 'Merck KGaA'
    WHEN UPPER(TRIM(p.manufacturer)) = 'MEKOPHAR' THEN 'Công ty Cổ phần Dược phẩm Mekophar'
    WHEN UPPER(TRIM(p.manufacturer)) = 'BIDIPHAR' THEN 'Công ty Cổ phần Dược phẩm Bidiphar'
    WHEN UPPER(TRIM(p.manufacturer)) = 'DANAPHA' THEN 'Công ty Cổ phần Dược Danapha'
    WHEN UPPER(TRIM(p.manufacturer)) = 'DOMESCO' THEN 'Công ty Cổ phần Xuất nhập khẩu Y tế Domesco'
    WHEN UPPER(TRIM(p.manufacturer)) = 'TRAPHACO' THEN 'Công ty Cổ phần Traphaco'
    WHEN UPPER(TRIM(p.manufacturer)) = 'SANOFI' THEN 'Sanofi'
    WHEN UPPER(TRIM(p.manufacturer)) = 'PFIZER' THEN 'Pfizer'
    WHEN UPPER(TRIM(p.manufacturer)) IN (
      'CÔNG TY CỔ PHẦN DƯỢC',
      'CÔNG TY CỔ PHẦN',
      'CÔNG TY CP DƯỢC',
      'CÔNG TY',
      'CÔNG',
      'DƯỢC',
      'VIỆT',
      'NHẬT',
      'TRUNG',
      'THÁI',
      'PHIL'
    ) THEN
      CASE
        WHEN p.requires_prescription = 1
          OR c.name LIKE '%Thuốc%'
          OR c.name LIKE '%Dạ dày%'
          OR c.name LIKE '%kháng%'
          OR c.name LIKE '%viêm%'
        THEN ELT(1 + MOD(p.id, 8),
          'Công ty Cổ phần Dược Hậu Giang',
          'Công ty Cổ phần Traphaco',
          'Công ty Cổ phần Dược phẩm Imexpharm',
          'Công ty Cổ phần Pymepharco',
          'Công ty Cổ phần Dược phẩm OPC',
          'Công ty Cổ phần Dược phẩm Bidiphar',
          'Công ty Cổ phần Xuất nhập khẩu Y tế Domesco',
          'Công ty Cổ phần Dược phẩm Mekophar'
        )
        WHEN c.name LIKE '%Thiết bị%'
          OR c.name LIKE '%Y tế%'
          OR c.name LIKE '%Đai%'
          OR c.name LIKE '%nẹp%'
          OR c.name LIKE '%Gạc%'
          OR c.name LIKE '%Que thử%'
        THEN ELT(1 + MOD(p.id, 5),
          'Công ty Cổ phần Merufa',
          'Microlife Corporation',
          'Công ty TNHH Y tế Hưng Việt',
          'Công ty Cổ phần Thiết bị Y tế Vinahankook',
          'Công ty TNHH Trang thiết bị Y tế An Phát'
        )
        ELSE ELT(1 + MOD(p.id, 8),
          'Công ty Cổ phần Sao Thái Dương',
          'Công ty Cổ phần Dược phẩm Hoa Linh',
          'Công ty Cổ phần Dược phẩm Quốc tế Abipha',
          'Công ty Cổ phần Dược phẩm Nam Hà',
          'Công ty TNHH Dược phẩm Ích Nhân',
          'Công ty Cổ phần Dược phẩm Hà Tây',
          'Công ty Cổ phần Dược phẩm Mediplantex',
          'Công ty Cổ phần Dược phẩm Trung Ương 3'
        )
      END
    ELSE p.manufacturer
  END,
  p.updated_at = NOW()
  WHERE UPPER(TRIM(p.manufacturer)) IN (
    'STELLA',
    'DAVI',
    'DHG',
    'OPC',
    'GSK',
    'BAYER',
    'MERCK',
    'MEKOPHAR',
    'BIDIPHAR',
    'DANAPHA',
    'DOMESCO',
    'TRAPHACO',
    'SANOFI',
    'PFIZER',
    'CTY',
    'CTY CP',
    'CTY CP DƯỢC',
    'CTY CP DƯỢC PHẨM',
    'CTY CP TẬP',
    'CTY CỔ PHẦN TẬP',
    'CÔNG TY CỔ PHẦN TẬP',
    'CÔNG TY CỔ PHẦN DƯỢC',
    'CÔNG TY CỔ PHẦN',
    'CÔNG TY CP DƯỢC',
    'CÔNG TY',
    'CÔNG',
    'DƯỢC',
    'VIỆT',
    'NHẬT',
    'TRUNG',
    'THÁI',
    'PHIL'
  )
  OR UPPER(TRIM(p.manufacturer)) LIKE 'CTY%';

  DELETE FROM mg_catalog.product_specifications
  WHERE spec_key = 'Nguồn dữ liệu'
     OR spec_value LIKE '%trungsoncare.com%';

  UPDATE mg_cms.articles
  SET
    thumbnail_url = CONCAT('/uploads/cms/articles/minh-giang-article-', LPAD(id, 4, '0'), '.webp'),
    title = REPLACE(REPLACE(REPLACE(REPLACE(title,
      'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
      'Trung Sơn', 'Minh Giang'),
      'Trung Son Pharma', 'Minh Giang Pharmacy'),
      'Trung Son', 'Minh Giang'),
    excerpt = REPLACE(REPLACE(REPLACE(REPLACE(excerpt,
      'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
      'Trung Sơn', 'Minh Giang'),
      'Trung Son Pharma', 'Minh Giang Pharmacy'),
      'Trung Son', 'Minh Giang'),
    content = REPLACE(REPLACE(REPLACE(REPLACE(content,
      'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
      'Trung Sơn', 'Minh Giang'),
      'Trung Son Pharma', 'Minh Giang Pharmacy'),
      'Trung Son', 'Minh Giang'),
    content_sanitized = REPLACE(REPLACE(REPLACE(REPLACE(content_sanitized,
      'Trung Sơn Pharma', 'Minh Giang Pharmacy'),
      'Trung Sơn', 'Minh Giang'),
      'Trung Son Pharma', 'Minh Giang Pharmacy'),
      'Trung Son', 'Minh Giang'),
    updated_at = NOW()
  WHERE thumbnail_url LIKE '%trungsoncare.com%'
     OR title LIKE '%Trung Sơn%'
     OR title LIKE '%Trung Son%'
     OR content LIKE '%Trung Sơn%'
     OR content LIKE '%Trung Son%'
     OR excerpt LIKE '%Trung Sơn%'
     OR excerpt LIKE '%Trung Son%'
     OR content_sanitized LIKE '%Trung Sơn%'
     OR content_sanitized LIKE '%Trung Son%';

  COMMIT;
END $$

DELIMITER ;

CALL mg_catalog.seed_phase11_brand_media_cleanup();
DROP PROCEDURE IF EXISTS mg_catalog.seed_phase11_brand_media_cleanup;
SET SQL_MODE = @PH11_OLD_SQL_MODE;
