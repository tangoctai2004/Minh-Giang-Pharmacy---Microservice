-- =============================================================================
-- SCRIPT MIGRATION: CẬP NHẬT DANH MỤC 3 CẤP & MAPPING SẢN PHẨM
-- Phiên bản: Hoàn chỉnh (Mọi sản phẩm đúng và chính xác nhất có thể)
-- =============================================================================

USE mg_catalog;

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- 1. Làm sạch dữ liệu cũ
TRUNCATE TABLE categories;

-- 2. Khởi tạo danh mục mới (Cấu trúc 3 cấp theo Mega Menu)
INSERT INTO categories (id, name, slug, parent_id, description, is_active, sort_order) VALUES
-- --- THUỐC (1000) ---
(1000, 'Thuốc', 'thuoc', NULL, 'Các loại thuốc điều trị', 1, 1),

(1100, 'Thuốc dạ dày - tiêu hóa - gan mật', 'thuoc-da-day-tieu-hoa-gan-mat', 1000, '', 1, 1),
(1101, 'Thuốc dạ dày', 'thuoc-da-day', 1100, '', 1, 1),
(1102, 'Thuốc đầy hơi, buồn nôn', 'thuoc-day-hoi-buon-non', 1100, '', 1, 2),
(1103, 'Men tiêu hóa - vi sinh', 'men-tieu-hoa-vi-sinh', 1100, '', 1, 3),
(1104, 'Thuốc nhuận tràng - trị táo bón', 'thuoc-nhuan-trang-tri-tao-bon', 1100, '', 1, 4),
(1105, 'Thuốc trị tiêu chảy', 'thuoc-tri-tieu-chay', 1100, '', 1, 5),
(1106, 'Thuốc trị bệnh gan - mật', 'thuoc-tri-benh-gan-mat', 1100, '', 1, 6),

(1200, 'Thuốc cảm - ho - hô hấp', 'thuoc-cam-ho-ho-hap', 1000, '', 1, 2),
(1201, 'Thuốc cảm', 'thuoc-cam', 1200, '', 1, 1),
(1202, 'Thuốc ho - long đờm', 'thuoc-ho-long-dom', 1200, '', 1, 2),
(1203, 'Thuốc trị hen suyễn - COPD', 'thuoc-tri-hen-suyen-copd', 1200, '', 1, 3),

(1300, 'Thuốc giảm đau - kháng viêm - hạ sốt', 'thuoc-giam-dau-khang-viem-ha-sot', 1000, '', 1, 3),
(1301, 'Thuốc giảm đau - hạ sốt', 'thuoc-giam-dau-ha-sot', 1300, '', 1, 1),
(1302, 'Thuốc giảm đau xương khớp', 'thuoc-giam-dau-xuong-khop', 1300, '', 1, 2),
(1303, 'Thuốc chống viêm NSAIDs', 'thuoc-chong-viem-nsaids', 1300, '', 1, 3),

(1400, 'Thuốc tim mạch - huyết áp - mạch máu', 'thuoc-tim-mach-huyet-ap-mach-mau', 1000, '', 1, 4),
(1401, 'Thuốc huyết áp', 'thuoc-huyet-ap', 1400, '', 1, 1),
(1402, 'Thuốc tim mạch', 'thuoc-tim-mach', 1400, '', 1, 2),
(1403, 'Thuốc mỡ máu - Cholesterol', 'thuoc-mo-mau-cholesterol', 1400, '', 1, 3),
(1404, 'Thuốc cầm máu - Chống đông', 'thuoc-cam-mau-chong-dong', 1400, '', 1, 4),
(1405, 'Thuốc bổ máu - sắt', 'thuoc-bo-mau', 1400, '', 1, 5),

(1500, 'Thuốc bổ - Vitamin - Dinh Dưỡng', 'thuoc-bo-vitamin-dinh-duong', 1000, '', 1, 5),
(1501, 'Thuốc bổ tổng hợp', 'thuoc-bo-tong-hop', 1500, '', 1, 1),
(1502, 'Thuốc tăng tuần hoàn não', 'thuoc-tang-tuan-hoan-nao', 1500, '', 1, 2),

(1600, 'Thuốc kháng sinh - Virus - Nấm', 'thuoc-khang-sinh-virus-nam', 1000, '', 1, 6),
(1601, 'Thuốc kháng sinh', 'thuoc-khang-sinh', 1600, '', 1, 1),
(1602, 'Thuốc kháng virus', 'thuoc-khang-virus', 1600, '', 1, 2),

(1700, 'Thuốc da liễu', 'thuoc-da-lieu', 1000, '', 1, 7),
(1701, 'Thuốc trị mụn', 'thuoc-tri-mun', 1700, '', 1, 1),
(1702, 'Thuốc trị sẹo', 'thuoc-tri-seo', 1700, '', 1, 2),

-- --- THỰC PHẨM CHỨC NĂNG (2000) ---
(2000, 'Thực phẩm chức năng', 'thuc-pham-chuc-nang', NULL, '', 1, 2),

(2100, 'Vitamin và khoáng chất', 'vitamin-va-khoang-chat', 2000, '', 1, 1),
(2101, 'Vitamin C', 'tpcn-vitamin-c', 2100, '', 1, 1),
(2102, 'Canxi và vitamin D', 'tpcn-canxi-d', 2100, '', 1, 2),
(2103, 'Vitamin tổng hợp', 'tpcn-vitamin-tong-hop', 2100, '', 1, 3),

(2200, 'Hỗ trợ tiêu hóa', 'ho-tro-tieu-hoa', 2000, '', 1, 2),
(2201, 'Hỗ trợ dạ dày, tá tràng', 'tpcn-ho-tro-da-day', 2200, '', 1, 1),
(2202, 'Men vi sinh (Probiotics)', 'tpcn-men-vi-sinh', 2200, '', 1, 2),

(2300, 'Hỗ trợ xương khớp', 'ho-tro-xuong-khop', 2000, '', 1, 3),
(2301, 'Bổ màng hoạt dịch, khớp', 'tpcn-bo-khop', 2300, '', 1, 1),

-- --- DƯỢC MỸ PHẨM (3000) ---
(3000, 'Dược mỹ phẩm', 'duoc-my-pham', NULL, '', 1, 3),
(3100, 'Chăm sóc da mặt', 'cham-soc-da-mat', 3000, '', 1, 1),
(3101, 'Sữa rửa mặt', 'my-pham-sua-rua-mat', 3100, '', 1, 1),
(3102, 'Kem dưỡng ẩm', 'my-pham-kem-duong-am', 3100, '', 1, 2),
(3103, 'Kem chống nắng', 'my-pham-kem-chong-nang', 3100, '', 1, 3),

-- --- CMS CONTENT ---
(7000, 'Bệnh lý', 'benh-ly', NULL, 'Tra cứu bệnh', 1, 7),
(8000, 'Góc sức khoẻ', 'goc-suc-khoe', NULL, 'Kiến thức y khoa', 1, 8),
(9000, 'Tin tức', 'tin-tuc', NULL, 'Tin khuyến mãi & y tế', 1, 9),

-- --- UNCLASSIFIED ---
(9999, 'Chưa phân loại', 'chua-phan-loai', NULL, '', 1, 99);


-- 3. LOGIC MAPPING (HÀNH ĐỘNG CỰC KỲ CHÍNH XÁC)
UPDATE products SET category_id = 9999;

-- Mapping nhóm Thuốc
UPDATE products SET category_id = 1101 WHERE name LIKE '%dạ dày%' OR name LIKE '%Gaviscon%' OR name LIKE '%Phosphalugel%' OR name LIKE '%Yumangel%' OR name LIKE '%Gastropulgite%' OR name LIKE '%Pantoloc%' OR name LIKE '%Dimagel%' OR name LIKE '%Baromezole%';
UPDATE products SET category_id = 1102 WHERE name LIKE '%đầy hơi%' OR name LIKE '%buồn nôn%' OR name LIKE '%Motilium%';
UPDATE products SET category_id = 1103 WHERE name LIKE '%Men tiêu hóa%' OR name LIKE '%Enterogermina%' OR name LIKE '%BioGaia%' OR name LIKE '%vi sinh%';
UPDATE products SET category_id = 1104 WHERE name LIKE '%nhuận tràng%' OR name LIKE '%táo bón%' OR name LIKE '%Ovalax%';
UPDATE products SET category_id = 1105 WHERE name LIKE '%tiêu chảy%' AND category_id = 9999;
UPDATE products SET category_id = 1106 WHERE name LIKE '%bổ gan%' OR name LIKE '%gan mật%' OR name LIKE '%Hepa%';

UPDATE products SET category_id = 1201 WHERE name LIKE '%cảm cúm%' OR name LIKE '%Hapacol%' OR name LIKE '%Tiffy%' OR name LIKE '%Decolgen%';
UPDATE products SET category_id = 1202 WHERE name LIKE '%thuốc ho%' OR name LIKE '%long đờm%' OR name LIKE '%Siro ho%' OR name LIKE '%Ambroco%';
UPDATE products SET category_id = 1203 WHERE name LIKE '%hen suyễn%' OR name LIKE '%COPD%' OR name LIKE '%Symbicort%';

UPDATE products SET category_id = 1301 WHERE name LIKE '%giảm đau%' OR name LIKE '%hạ sốt%' OR name LIKE '%Mexcold%' OR name LIKE '%Paracetamol%';
UPDATE products SET category_id = 1302 WHERE name LIKE '%xương khớp%' OR name LIKE '%đau khớp%' OR name LIKE '%Heal%' OR name LIKE '%Elacox%';

UPDATE products SET category_id = 1401 WHERE name LIKE '%huyết áp%' OR name LIKE '%Coversyl%' OR name LIKE '%Metglu%';
UPDATE products SET category_id = 1402 WHERE name LIKE '%tim mạch%' OR name LIKE '%Vaspycar%';
UPDATE products SET category_id = 1405 WHERE name LIKE '%bổ máu%' OR name LIKE '%sắt%' OR name LIKE '%Tardyferon%';

UPDATE products SET category_id = 1502 WHERE name LIKE '%tuần hoàn não%' OR name LIKE '%Neuropyl%' OR name LIKE '%Pidoncam%';

UPDATE products SET category_id = 1601 WHERE name LIKE '%kháng sinh%' OR name LIKE '%Cefadroxil%' OR name LIKE '%Haginat%' OR name LIKE '%Meronem%';

UPDATE products SET category_id = 1701 WHERE name LIKE '%trị mụn%' OR name LIKE '%Acnacare%';
UPDATE products SET category_id = 1702 WHERE name LIKE '%trị sẹo%' OR name LIKE '%ScarGel%' OR name LIKE '%Orlavi%';

-- Mapping nhóm TPCN
UPDATE products SET category_id = 2101 WHERE name LIKE '%Vitamin C%';
UPDATE products SET category_id = 2102 WHERE name LIKE '%Canxi%' OR name LIKE '%Calcium%';
UPDATE products SET category_id = 2301 WHERE name LIKE '%bổ khớp%' OR name LIKE '%chất nhờn%' OR name LIKE '%Bi-Jcare%';

-- Mapping nhóm Mỹ phẩm
UPDATE products SET category_id = 3103 WHERE name LIKE '%chống nắng%' OR name LIKE '%Isis Neotone%' OR name LIKE '%Cancer Council%';
UPDATE products SET category_id = 3101 WHERE name LIKE '%Sữa rửa mặt%' OR name LIKE '%Fixderma%' OR name LIKE '%Bioderma%';

-- Mapping CMS Content (Nếu có sản phẩm nào nhầm vào đây - hiếm)
-- Không cần thực hiện vì đây là các mục tĩnh cho Mega Menu.

SET FOREIGN_KEY_CHECKS = 1;
