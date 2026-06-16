-- MOCK HIERARCHICAL DISEASE CATEGORIES AND ARTICLE MAPPING
USE mg_cms;
SET NAMES utf8mb4;

-- Clean up any subcategories previously created to ensure idempotency
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM cms_categories WHERE type = 'disease' AND id != 2;
SET FOREIGN_KEY_CHECKS = 1;


-- 1. Insert Level-2 Disease Categories (Parent is 'kien-thuc-benh-ly' - ID 2)
INSERT INTO cms_categories (id, name, slug, type, parent_id, sort_order) VALUES
(7, 'Bệnh chuyên khoa', 'benh-chuyen-khoa', 'disease', 2, 10),
(8, 'Bệnh theo cơ thể người', 'benh-co-the-nguoi', 'disease', 2, 20),
(9, 'Bệnh mãn tính', 'benh-man-tinh', 'disease', 2, 30),
(10, 'Bệnh theo mùa', 'benh-theo-mua', 'disease', 2, 40),
(11, 'Bệnh truyền nhiễm', 'benh-truyen-nhiem', 'disease', 2, 50),
(12, 'Bệnh lạ / Bệnh hiếm gặp', 'benh-la-hiem-gap', 'disease', 2, 60),
(13, 'Bệnh theo đối tượng', 'benh-theo-doi-tuong', 'disease', 2, 70),
(14, 'Bệnh ung thư', 'benh-ung-thu', 'disease', 2, 80);

-- 2. Insert Level-3 Specialties (Parent is 'Bệnh chuyên khoa' - ID 7)
INSERT INTO cms_categories (name, slug, type, parent_id, image_url, sort_order) VALUES
('Cơ – Xương – Khớp', 'co-xuong-khop', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-co-xuong-khop.png', 10),
('Da – Tóc – Móng', 'da-toc-mong', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-da-toc-mong.png', 20),
('Hệ thần kinh', 'he-than-kinh', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-he-than-kinh.png', 30),
('Hô hấp', 'ho-hap', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-ho-hap.png', 40),
('Mắt', 'mat', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-mat.png', 50),
('Máu', 'mau', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-mau.png', 60),
('Tai – Mũi – Họng', 'tai-mui-hong', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-tai-mui-hong.png', 70),
('Nội tiết', 'noi-tiet', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-noi-tiet.png', 80),
('Răng – Hàm – Mật', 'rang-ham-mat', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-rang-ham-mat.png', 90),
('Thận – Tiết niệu', 'than-tiet-nieu', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-than-tiet-nieu.png', 100),
('Tiêu hóa – Gan mật – Tụy', 'tieu-hoa', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-tieu-hoa-gan-mat-tuy.png', 110),
('Tim mạch – Huyết áp', 'tim-mach', 'disease', 7, '../assets/images/benh-ly/benh-chuyen-khoa/icon-tim-mach-huyet-ap.png', 120);

-- 3. Insert Level-3 Anatomy/Body Parts (Parent is 'Bệnh theo cơ thể người' - ID 8)
INSERT INTO cms_categories (name, slug, type, parent_id, image_url, sort_order) VALUES
('Đầu', 'dau', 'disease', 8, '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-dau.png', 10),
('Cổ', 'co', 'disease', 8, '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-co.png', 20),
('Ngực', 'nguc', 'disease', 8, '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-nguc.png', 30),
('Bụng', 'bung', 'disease', 8, '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-bung.png', 40),
('Cơ quan sinh dục', 'sinh-duc', 'disease', 8, '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-sinhduc.png', 50),
('Tứ chi', 'tu-chi', 'disease', 8, '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-tuchi.png', 60),
('Da & Các mô', 'da', 'disease', 8, '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-da.png', 70);

-- 4. Map Articles to Level-3 Categories and add cross-reference Tags
-- We'll use subqueries to get exact ID of each level-3 category dynamically.

-- co-xuong-khop
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'co-xuong-khop'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "co-xuong-khop", "tu-chi"]'
WHERE slug IN ('glucosamine', 'noi-kho-benh-co-xuong-khop-o-nguoi-cao-tuoi', 'nguyen-nhan-gay-ra-benh-gout-nguoi-cao-tuoi-khong-nen-chu-quan', 'lam-sao-de-giup-bo-me-thoat-khoi-nhung-con-dau-nhuc-xuong-khop-hieu-qua', 'tai-sao-chung-ta-can-dung-thuoc-dieu-tri-loang-xuong');

-- da-toc-mong
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'da-toc-mong'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "da-toc-mong", "da"]'
WHERE slug IN ('04-buoc-cham-soc-da-body-muot-min-trang-sang-tai-nha', '5-cach-tri-ran-da-cho-ba-bau', 'top-05-hoat-chat-tri-nam-hieu-qua-nhat-hien-nay');

-- he-than-kinh
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'he-than-kinh'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "he-than-kinh", "dau"]'
WHERE slug IN ('dung-cho-mot-ngay-nho-nho-quen-quen', 'giam-nguy-co-mac-chung-mat-tri-nho-o-nguoi-cao-tuoi');

-- ho-hap
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'ho-hap'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "ho-hap", "nguc"]'
WHERE slug IN ('top-10-cach-lam-diu-con-ho-ngay-tai-nha', 'viem-phe-quan-va-8-trieu-chung-thuong-gap', 'viem-phoi-la-gi-10-dau-hieu-viem-phoi-nguoi-lon', 'hen-phe-quan-la-gi-cach-dieu-tri-hen-suyen-nguoi-lon');

-- tai-mui-hong
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'tai-mui-hong'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "tai-mui-hong", "co", "dau"]'
WHERE slug IN ('viem-tai-giua-nguoi-lon-va-nhung-bien-chung-nguy-hiem', 'viem-xoang-la-gi-tai-sao-benh-viem-xoang-lai-kho-chua', 'viem-amidan-la-gi-nguyen-nhan-trieu-chung-va-5-cach-dieu-tri-hieu-qua', 'trieu-chung-ung-thu-vom-hong-nhan-biet-som-de-tang-co-hoi-chua-khoi');

-- than-tiet-nieu
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'than-tiet-nieu'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "than-tiet-nieu", "bung"]'
WHERE slug IN ('5-viec-nen-lam-cham-soc-than-khoe-manh');

-- tieu-hoa
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'tieu-hoa'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "tieu-hoa", "bung"]'
WHERE slug IN ('tri-noi-tri-ngoai', 'trao-nguoc-da-day-thuc-quan', 'roi-loan-tieu-hoa', 'polyp-tui-mat', 'hoi-chung-ruot-kich-thich', 'gan-nhiem-mo-do-2', 'gan-nhiem-mo-do-1', 'gan-nhiem-mo-fld', 'dau-da-day-vi-tri-con-dau-da-day-va-06-dau-hieu-nguy-hiem', 'viem-dai-trang');

-- tim-mach
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'tim-mach'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "tim-mach", "nguc"]'
WHERE slug IN ('roi-loan-nhip-tim-co-chua-khoi-duoc-khong', 'huyet-ap-thap-la-gi-huyet-ap-100-60-la-cao-hay-thap', 'gian-tinh-mach-nguyen-nhan-trieu-chung-va-bien-phap-dieu-tri', 'oi-tuong-nao-de-bi-dot-quy-goi-ten');

-- Bệnh theo mùa (Tag-based mapping)
UPDATE articles 
SET tags = '["benh-ly", "tu-van", "suc-khoe", "tim-mach", "benh-theo-mua"]'
WHERE slug IN ('cum-mua');

UPDATE articles 
SET tags = '["benh-ly", "tu-van", "suc-khoe", "ho-hap", "benh-theo-mua"]'
WHERE slug IN ('top-10-cach-lam-diu-con-ho-ngay-tai-nha');

UPDATE articles 
SET tags = '["benh-ly", "tu-van", "suc-khoe", "benh-theo-mua"]'
WHERE slug IN ('top-10-cach-cam-thay-de-chiu-hon-khi-bi-cam-cum', 'cac-benh-thuong-gap-mua-nang-nong');

-- Bệnh truyền nhiễm (Tag-based mapping)
UPDATE articles 
SET tags = '["benh-ly", "tu-van", "suc-khoe", "benh-truyen-nhiem"]'
WHERE slug IN ('benh-soi-o-tre-em', 'benh-thuy-dau', 'bi-thuy-dau-kieng-gi', 'mun-thuy-dau-bao-lau-thi-vo', 'sot-phat-ban-o-tre-phan-biet-soi-rubella-va-cac-loai-phat-ban-khac', 'rsv-la-benh-gi-tai-sao-lai-nguy-hiem-doi-voi-tre-nho', 'cum-a-tre-em-nguyen-nhan-trieu-chung-va-cach-phong-ngua', 'bo-y-te-viet-nam-cap-nhat-khuyen-cao-phong-dich-covid-19', 'ngo-doc-botulinum');

-- Bệnh mãn tính (Tag-based mapping)
UPDATE articles 
SET tags = '["benh-ly", "tu-van", "suc-khoe", "benh-man-tinh"]'
WHERE slug IN ('tai-sao-chung-ta-can-dung-thuoc-dieu-tri-loang-xuong', 'giam-nguy-co-mac-chung-mat-tri-nho-o-nguoi-cao-tuoi', 'roi-loan-nhip-tim-co-chua-khoi-duoc-khong', 'gan-nhiem-mo-fld', 'viem-dai-trang', 'trao-nguoc-da-day-thuc-quan', 'roi-loan-tieu-hoa', 'polyp-tui-mat', 'hoi-chung-ruot-kich-thich');

-- Bệnh lạ hiếm gặp
UPDATE articles 
SET tags = '["benh-ly", "tu-van", "suc-khoe", "benh-la-hiem-gap"]'
WHERE slug IN ('ngo-doc-botulinum', 'rsv-la-benh-gi-tai-sao-lai-nguy-hiem-doi-voi-tre-nho');

-- Bệnh ung thư
UPDATE articles 
SET tags = '["benh-ly", "tu-van", "suc-khoe", "benh-ung-thu"]'
WHERE slug IN ('trieu-chung-ung-thu-vom-hong-nhan-biet-som-de-tang-co-hoi-chua-khoi', 'ung-thu-da-day');

-- Bệnh theo đối tượng
-- 5. Insert Level-3 Target Groups (Parent is 'Bệnh theo đối tượng' - ID 13)
INSERT INTO cms_categories (name, slug, type, parent_id, image_url, sort_order) VALUES
('Nam giới', 'nam-gioi', 'disease', 13, '../assets/images/benh-ly/benh-theo-doi-tuong/icon-nam-gioi.png', 10),
('Nữ giới', 'nu-gioi', 'disease', 13, '../assets/images/benh-ly/benh-theo-doi-tuong/icon-nu-gioi.png', 20),
('Trẻ em', 'tre-em', 'disease', 13, '../assets/images/benh-ly/benh-theo-doi-tuong/icon-tre-em.png', 30),
('Người cao tuổi', 'benh-nguoi-cao-tuoi', 'disease', 13, '../assets/images/benh-ly/benh-theo-doi-tuong/icon-nguoi-cao-tuoi.png', 40);

-- Map to nam-gioi
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'nam-gioi'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "benh-theo-doi-tuong", "nam-gioi"]'
WHERE slug IN ('huyet-ap-thap-la-gi-huyet-ap-100-60-la-cao-hay-thap');

-- Map to nu-gioi
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'nu-gioi'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "benh-theo-doi-tuong", "nu-gioi"]'
WHERE slug IN ('5-cach-tri-ran-da-cho-ba-bau');

-- Map to tre-em (include both tre-em and benh-truyen-nhiem tags for cross-listing)
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'tre-em'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "benh-theo-doi-tuong", "tre-em", "benh-truyen-nhiem"]'
WHERE slug IN ('benh-soi-o-tre-em', 'cum-a-tre-em-nguyen-nhan-trieu-chung-va-cach-phong-ngua', 'sot-phat-ban-o-tre-phan-biet-soi-rubella-va-cac-loai-phat-ban-khac', 'rsv-la-benh-gi-tai-sao-lai-nguy-hiem-doi-voi-tre-nho', 'benh-thuy-dau', 'bi-thuy-dau-kieng-gi', 'mun-thuy-dau-bao-lau-thi-vo');

-- Map to nguoi-cao-tuoi
UPDATE articles 
SET category_id = (SELECT id FROM cms_categories WHERE slug = 'benh-nguoi-cao-tuoi'),
    tags = '["benh-ly", "tu-van", "suc-khoe", "benh-theo-doi-tuong", "benh-nguoi-cao-tuoi"]'
WHERE slug IN ('noi-kho-benh-co-xuong-khop-o-nguoi-cao-tuoi', 'giam-nguy-co-mac-chung-mat-tri-nho-o-nguoi-cao-tuoi', 'lam-sao-de-giup-bo-me-thoat-khoi-nhung-con-dau-nhuc-xuong-khop-hieu-qua', 'xay-dung-7-thoi-quen-lanh-manh-giup-nguoi-lon-tuoi-song-vui-khoe-hon', 'tai-sao-chung-ta-can-dung-thuoc-dieu-tri-loang-xuong');

