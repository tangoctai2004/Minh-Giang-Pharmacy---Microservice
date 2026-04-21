-- =============================================================================
-- SCRIPT MIGRATION: CẬP NHẬT TOÀN BỘ DANH MỤC 3 CẤP (FINAL VERSION)
-- Mapping sản phẩm tự động dựa trên từ khóa chi tiết
-- =============================================================================

USE mg_catalog;

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

TRUNCATE TABLE categories;

-- 1. THUỐC (1000)
INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES
(1000, 'Thuốc', 'thuoc', NULL, 1),
-- L2/L3
(1100, 'Thuốc dạ dày - tiêu hoá - gan mật', 'thuoc-da-day-tieu-hoa-gan-mat', 1000, 1),
(1101, 'Thuốc dạ dày', 'thuoc-da-day', 1100, 1),
(1102, 'Thuốc đầy hơi, buồn nôn', 'thuoc-day-hoi-buon-non', 1100, 2),
(1103, 'Men tiêu hoá - vi sinh', 'men-tieu-hoa-vi-sinh', 1100, 3),
(1104, 'Thuốc nhuận tràng - trị táo bón', 'thuoc-nhuan-trang-tao-bon', 1100, 4),
(1105, 'Thuốc trị tiêu chảy', 'thuoc-tri-tieu-chay', 1100, 5),
(1106, 'Thuốc trị bệnh gan - mật', 'thuoc-tri-benh-gan-mat', 1100, 6),

(1200, 'Thuốc cảm - ho - hô hấp', 'thuoc-cam-ho-ho-hap', 1000, 2),
(1201, 'Thuốc cảm', 'thuoc-cam', 1200, 1),
(1202, 'Thuốc ho - long đờm', 'thuoc-ho-long-dom', 1200, 2),
(1203, 'Thuốc trị hen suyễn - COPD', 'thuoc-tri-hen-suyen-copd', 1200, 3),

(1300, 'Thuốc giảm đau - kháng viêm - hạ sốt', 'thuoc-giam-dau-khang-viem-ha-sot', 1000, 3),
(1301, 'Thuốc giảm đau - hạ sốt', 'thuoc-giam-dau-ha-sot', 1300, 1),
(1302, 'Thuốc giảm đau xương khớp', 'thuoc-giam-dau-xuong-khop', 1300, 2),
(1303, 'Thuốc chống viêm NSAIDs', 'thuoc-chong-viem-nsaids', 1300, 3),

(1400, 'Thuốc tim mạch - huyết áp - mạch máu', 'thuoc-tim-mach-huyet-ap-mach-mau', 1000, 4),
(1401, 'Thuốc huyết áp', 'thuoc-huyet-ap', 1400, 1),
(1402, 'Thuốc tim mạch', 'thuoc-tim-mach', 1400, 2),
(1403, 'Thuốc mỡ máu - Cholesterol', 'thuoc-mo-mau-cholesterol', 1400, 3),
(1404, 'Thuốc cầm máu - Chống đông', 'thuoc-cam-mau-chong-dong', 1400, 4),
(1405, 'Thuốc trị thiếu máu (bổ máu, sắt)', 'thuoc-tri-thieu-mau', 1400, 5),
(1406, 'Thuốc tăng tuần hoàn não', 'thuoc-tang-tuan-hoan-nao', 1400, 6),

(1500, 'Thuốc bổ - vitamin - dinh dưỡng', 'thuoc-bo-vitamin-dinh-duong', 1000, 5),
(1501, 'Thuốc bổ - Vitamin', 'thuoc-bo-vitamin', 1500, 1),
(1502, 'Thuốc bổ xương khớp, canxi', 'thuoc-bo-xuong-khop-canxi', 1500, 2),
(1503, 'Siro bổ trẻ em', 'siro-bo-tre-em', 1500, 3),
(1504, 'Thuốc tăng cường đề kháng', 'thuoc-tang-cuong-de-khang', 1500, 4),
(1505, 'Thuốc bù điện giải', 'thuoc-bu-dien-giai', 1500, 5),

(1600, 'Thuốc kháng sinh - kháng virus - kháng nấm', 'thuoc-khang-sinh-virus-nam', 1000, 6),
(1601, 'Thuốc kháng sinh', 'thuoc-khang-sinh', 1600, 1),
(1602, 'Thuốc kháng virus', 'thuoc-khang-virus', 1600, 2),
(1603, 'Thuốc kháng nấm', 'thuoc-khang-nam', 1600, 3),
(1604, 'Thuốc trị giun sán', 'thuoc-tri-giun-san', 1600, 4),
(1605, 'Thuốc trị sốt rét', 'thuoc-tri-sot-ret', 1600, 5),
(1606, 'Thuốc trị lao', 'thuoc-tri-lao', 1600, 6),

(1700, 'Thuốc da liễu', 'thuoc-da-lieu', 1000, 7),
(1701, 'Thuốc bôi trị mụn', 'thuoc-bo-tri-mun', 1700, 1),
(1702, 'Thuốc bôi trị sẹo', 'thuoc-bo-tri-seo', 1700, 2),
(1703, 'Thuốc trị nấm da', 'thuoc-tri-nam-da', 1700, 3),
(1704, 'Thuốc khử trùng, sát khuẩn', 'thuoc-khu-trung-sat-khuan', 1700, 4),
(1705, 'Dầu gội trị gàu', 'dau-goi-tri-gau', 1700, 5),
(1706, 'Trị bệnh da liễu', 'tri-benh-da-lieu', 1700, 6),

(1800, 'Thuốc thần kinh - giấc ngủ - tâm thần', 'thuoc-than-kinh-giac-ngu-tam-than', 1000, 8),
(1801, 'Thuốc an thần, chống lo âu - Ngủ ngon', 'thuoc-an-than-ngu-ngon', 1800, 1),
(1802, 'Thuốc bổ não - Tuần hoàn não', 'thuoc-bo-nao', 1800, 2),
(1803, 'Thuốc trị đau nửa đầu', 'thuoc-tri-dau-nua-dau', 1800, 3),
(1804, 'Thuốc trị trầm cảm', 'thuoc-tri-tram-cam', 1800, 4),
(1805, 'Thuốc chống co giật', 'thuoc-chong-co-giat', 1800, 5),
(1806, 'Thuốc điều trị Parkinson', 'thuoc-dieu-tri-parkinson', 1800, 6),

(1900, 'Thuốc nội tiết - hormone - sinh dục', 'thuoc-noi-tiet-hormone-sinh-duc', 1000, 9),
(1901, 'Thuốc phụ khoa', 'thuoc-phu-khoa', 1900, 1),
(1902, 'Dung dịch vệ sinh phụ nữ', 'dung-dich-ve-sinh-phu-nu', 1900, 2),
(1903, 'Thuốc điều hoà kinh nguyệt', 'thuoc-dieu-hoa-kinh-nguyet', 1900, 3),
(1904, 'Thuốc tránh thai', 'thuoc-tranh-thai', 1900, 4),
(1905, 'Thuốc rối loạn cương dương - Tiền liệt', 'thuoc-roi-loan-cuong-duong', 1900, 5),
(1906, 'Thuốc trị bệnh tuyến giáp', 'thuoc-tri-benh-tuyen-giap', 1900, 6),

(1010, 'Thuốc xương khớp - gout - cơ xương', 'thuoc-xuong-khop-gout', 1000, 10),
(1011, 'Thuốc viêm khớp - Thoái hoá', 'thuoc-viem-khop-thoai-hoa', 1010, 1),
(1012, 'Thuốc trị gout', 'thuoc-tri-gout', 1010, 2),
(1013, 'Thuốc giãn cơ', 'thuoc-gian-co', 1010, 3),
(1014, 'Bổ xương khớp', 'bo-xuong-khop', 1010, 4),

(1020, 'Thuốc mắt - tai - mũi - họng', 'thuoc-mat-tai-mui-hong', 1000, 11),
(1021, 'Thuốc nhỏ mắt, tra mắt', 'thuoc-nho-mat', 1020, 1),
(1022, 'Thuốc nhỏ tai', 'thuoc-nho-tai', 1020, 2),
(1023, 'Thuốc sổ mũi - xịt mũi - viêm xoang', 'thuoc-so-mui-xit-mui', 1020, 3),
(1024, 'Viên ngậm - xịt họng - viêm họng', 'vien-ngam-xit-hong', 1020, 4),
(1025, 'Thuốc xúc miệng, bôi răng miệng', 'thuoc-xuc-mieng-rang-mieng', 1020, 5),

(1030, 'Thuốc tiểu đường - nội khoa mãn tính', 'thuoc-tieu-duong-noi-khoa', 1000, 12),
(1031, 'Thuốc tiểu đường - đái tháo đường', 'thuoc-tieu-duong-dai-thao-duong', 1030, 1),
(1032, 'Hỗ trợ hạ đường huyết', 'ho-tro-ha-duong-huyet', 1030, 2),

(1040, 'Thuốc tiêm - truyền dịch', 'thuoc-tiem-truyen-dich', 1000, 13),
(1041, 'Thuốc tiêm', 'thuoc-tiem', 1040, 1),
(1042, 'Dịch truyền - bù nước điện giải', 'dich-truyen-bu-nuoc', 1040, 2),

(1050, 'Thuốc dị ứng - say tàu xe - chống buồn nôn', 'thuoc-di-ung-say-tau-xe', 1000, 14),
(1051, 'Thuốc chống dị ứng', 'thuoc-chong-di-ung', 1050, 1),
(1052, 'Thuốc say tàu xe', 'thuoc-say-tau-xe', 1050, 2),

(1060, 'Thuốc cai nghiện - giải độc - cấp cứu', 'thuoc-cai-nghien-giai-doc', 1000, 15),
(1061, 'Thuốc cai thuốc lá, ma tuý', 'thuoc-cai-thuoc-la-ma-tuy', 1060, 1),
(1062, 'Thuốc giải độc, cấp cứu', 'thuoc-giai-doc-cap-cuu', 1060, 2),

(1070, 'Thuốc ung thư - miễn dịch - chuyên khoa', 'thuoc-ung-thu-mien-dich', 1000, 16),
(1071, 'Thuốc điều trị ung thư', 'thuoc-dieu-tri-ung-thu', 1070, 1),
(1072, 'Thuốc tăng miễn dịch', 'thuoc-tang-mien-dich', 1070, 2),
(1073, 'Thuốc điều trị bệnh tự miễn', 'thuoc-dieu-tri-benh-tu-mien', 1070, 3);

-- 2. THỰC PHẨM CHỨC NĂNG (2000)
INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES
(2000, 'Thực phẩm chức năng', 'thuc-pham-chuc-nang', NULL, 2),
(2100, 'Vitamin và khoáng chất', 'tpcn-vitamin-khoang-chat', 2000, 1),
(2101, 'Vitamin nhóm B (B1, B6, B12)', 'tpcn-vitamin-b', 2100, 1),
(2102, 'Vitamin C', 'tpcn-vitamin-c', 2100, 2),
(2103, 'Canxi và vitamin D', 'tpcn-canxi-vitamin-d', 2100, 3),
(2104, 'Vitamin E', 'tpcn-vitamin-e', 2100, 4),
(2105, 'Vitamin tổng hợp', 'tpcn-vitamin-tong-hop', 2100, 5),
(2106, 'Kẽm & Magie', 'tpcn-kem-magie', 2100, 6),

(2200, 'Hỗ trợ tiêu hoá', 'tpcn-ho-tro-tieu-hoa', 2000, 2),
(2201, 'Hỗ trợ dạ dày, tá tràng', 'tpcn-da-day-ta-trang', 2200, 1),
(2202, 'Nhuận tràng, táo bón', 'tpcn-nhuan-trang-tao-bon', 2200, 2),
(2203, 'Enzyme tiêu hoá', 'tpcn-enzyme-tieu-hoa', 2200, 3),
(2204, 'Men vi sinh', 'tpcn-men-vi-sinh', 2200, 4),
(2205, 'Chất xơ hỗ trợ tiêu hoá', 'tpcn-chat-xo-tieu-hoa', 2200, 5),
(2206, 'Hỗ trợ tiêu hoá & trao đổi chất', 'tpcn-tieu-hoa-trao-doi-chat', 2200, 6),

(2300, 'Chức năng gan, mật', 'tpcn-chuc-nang-gan-mat', 2000, 3),
(2301, 'Hỗ trợ chức năng gan', 'tpcn-ho-tro-chuc-nang-gan', 2300, 1),
(2302, 'Hỗ trợ giải rượu, cai rượu', 'tpcn-giai-ruou-cai-ruou', 2300, 2),

(2400, 'Hệ thần kinh & não bộ', 'tpcn-he-than-kinh-nao-bo', 2000, 4),
(2401, 'Hỗ trợ trí não & thần kinh', 'tpcn-ho-tro-tri-nao', 2400, 1),
(2402, 'Cải thiện trí nhớ', 'tpcn-cai-thien-tri-nho', 2400, 2),
(2403, 'Hỗ trợ giấc ngủ ngon', 'tpcn-ho-tro-giac-ngu', 2400, 3),
(2404, 'Hỗ trợ tuần hoàn máu', 'tpcn-ho-tro-tuan-hoan-mau', 2400, 4),
(2405, 'Hỗ trợ hoạt huyết', 'tpcn-ho-tro-hoat-huyet', 2400, 5),
(2406, 'Hỗ trợ thần kinh khác', 'tpcn-ho-tro-than-kinh-khac', 2400, 6),

(2500, 'Sức khoẻ tim mạch & huyết áp', 'tpcn-tim-mach-huyet-ap', 2000, 5),
(2501, 'Hỗ trợ giảm cholesterol, mỡ máu', 'tpcn-giam-cholesterol', 2500, 1),
(2502, 'Hỗ trợ huyết áp', 'tpcn-ho-tro-huyet-ap', 2500, 2),
(2503, 'Hỗ trợ mạch máu', 'tpcn-ho-tro-mach-mau', 2500, 3),
(2504, 'Ngừa xơ vữa, tai biến', 'tpcn-ngua-xo-vua-tai-bien', 2500, 4),
(2505, 'Bảo vệ tim mạch', 'tpcn-bao-ve-tim-mach', 2500, 5),

(2600, 'Hệ sinh dục & Hormone sinh dục', 'tpcn-he-sinh-duc', 2000, 6),
(2601, 'Bổ thận, tiết niệu', 'tpcn-bo-than-tiet-nieu', 2600, 1),
(2602, 'Sinh lý nữ', 'tpcn-sinh-ly-nu', 2600, 2),
(2603, 'Hỗ trợ mãn kinh & nội tiết', 'tpcn-ho-tro-man-kinh', 2600, 3),
(2604, 'Sinh lý nam', 'tpcn-sinh-ly-nam', 2600, 4),
(2605, 'Hỗ trợ tuyến tiền liệt', 'tpcn-ho-tro-tuyen-tien-liet', 2600, 5),

(2700, 'Hỗ trợ làm đẹp', 'tpcn-ho-tro-lam-dep', 2000, 7),
(2701, 'Kiểm soát cân nặng & giảm cân', 'tpcn-giam-can', 2700, 1),
(2702, 'Hỗ trợ chuyển hoá và sức khoẻ tổng quát', 'tpcn-chuyen-hoa-tong-quat', 2700, 2),
(2703, 'Chăm sóc da', 'tpcn-cham-soc-da', 2700, 3),
(2704, 'Chăm sóc tóc, móng', 'tpcn-cham-soc-toc-mong', 2700, 4),
(2705, 'Chống lão hoá', 'tpcn-chong-lao-hoa', 2700, 5),

(2800, 'Hỗ trợ xương khớp', 'tpcn-ho-tro-xuong-khop', 2000, 8),
(2801, 'Xương khớp tổng hợp', 'tpcn-xuong-khop-tong-hop', 2800, 1),
(2802, 'Giảm viêm và đau khớp', 'tpcn-giam-viem-dau-khop', 2800, 2),
(2803, 'Hỗ trợ tái tạo sụn và dịch khớp', 'tpcn-tai-tao-sun-khop', 2800, 3),

(2900, 'Hỗ trợ hô hấp', 'tpcn-ho-tro-ho-hap', 2000, 9),
(2901, 'Bổ phế, hô hấp', 'tpcn-bo-phe-ho-hap', 2900, 1),
(2902, 'Giảm ho, đau họng', 'tpcn-giam-ho-dau-hong', 2900, 2),
(2903, 'Giảm viêm đường hô hấp', 'tpcn-giam-viem-ho-hap', 2900, 3),
(2904, 'Chức năng hô hấp tổng hợp', 'tpcn-ho-hap-tong-hop', 2900, 4),
(2905, 'Kẹo ngậm giảm ho, đau họng', 'tpcn-keo-ngam-ho', 2900, 5),

(2010, 'Hỗ trợ điều trị', 'tpcn-ho-tro-dieu-tri', 2000, 10),
(2011, 'Hỗ trợ thận, tiết niệu', 'tpcn-ho-tro-than', 2010, 1),
(2012, 'Hỗ trợ đường huyết & chuyển hoá', 'tpcn-duong-huyet-chuyen-hoa', 2010, 2),
(2013, 'Hỗ trợ điều trị ung thư, chống ung thư', 'tpcn-ho-tro-ung-thu', 2010, 3),
(2014, 'Hỗ trợ điều trị trĩ', 'tpcn-ho-tro-tri', 2010, 4),
(2015, 'Hỗ trợ tuyến giáp', 'tpcn-ho-tro-tuyen-giap', 2010, 5),

(2020, 'Tăng cường sức khoẻ', 'tpcn-tang-cuong-suc-khoe', 2000, 11),
(2021, 'Tăng cường đề kháng, miễn dịch', 'tpcn-tang-cuong-de-khang', 2020, 1),
(2022, 'Hỗ trợ trao đổi chất', 'tpcn-ho-tro-trao-doi-chat', 2020, 2),
(2023, 'Dinh dưỡng tổng hợp', 'tpcn-dinh-duong-tong-hop', 2020, 3),
(2024, 'Sữa dinh dưỡng', 'tpcn-sua-dinh-duong', 2020, 4),
(2025, 'Hỗ trợ mắt & thị lực', 'tpcn-ho-tro-mat', 2020, 5),
(2026, 'Sữa cho bé', 'tpcn-sua-cho-be', 2020, 6),

(2030, 'Thảo dược tự nhiên', 'tpcn-thao-duoc-tu-nhien', 2000, 12),
(2031, 'Nhân sâm, Đông trùng hạ thảo, Nấm linh chi', 'tpcn-nhan-sam-linh-chi', 2030, 1),
(2032, 'Tảo', 'tpcn-tao', 2030, 2),
(2033, 'Thảo dược khác', 'tpcn-thao-duoc-khac', 2030, 3);

-- 3. DƯỢC MỸ PHẨM (3000)
INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES
(3000, 'Dược mỹ phẩm', 'duoc-my-pham', NULL, 3),
(3100, 'Chăm sóc da mặt', 'my-pham-cham-soc-da-mat', 3000, 1),
(3101, 'Sữa rửa mặt', 'my-pham-sua-rua-mat', 3100, 1),
(3102, 'Toner', 'my-pham-toner', 3100, 2),
(3103, 'Serum & Tinh chất dưỡng da', 'my-pham-serum', 3100, 3),
(3104, 'Kem dưỡng ẩm', 'my-pham-kem-duong-am', 3100, 4),
(3105, 'Kem, xịt chống nắng', 'my-pham-kem-chong-nang', 3100, 5),
(3106, 'Mặt nạ dưỡng da', 'my-pham-mat-na', 3100, 6),

(3200, 'Chăm sóc cơ thể', 'my-pham-cham-soc-co-the', 3000, 2),
(3201, 'Sữa tắm, xà phòng', 'my-pham-sua-tam', 3200, 1),
(3202, 'Dưỡng thể, dầu dưỡng', 'my-pham-duong-the', 3200, 2),
(3203, 'Lăn khử mùi & xịt khử mùi', 'my-pham-lan-khu-mui', 3200, 3),
(3204, 'Chống nắng cơ thể', 'my-pham-chong-nang-co-the', 3200, 4),
(3205, 'Dưỡng da tay & chân', 'my-pham-duong-da-tay-chan', 3200, 5),
(3206, 'Muối tắm - Tẩy tế bào chết', 'my-pham-tay-te-bao-chet', 3200, 6),

(3300, 'Chăm sóc tóc', 'my-pham-cham-soc-toc', 3000, 3),
(3301, 'Dầu gội & xả', 'my-pham-dau-goi-xa', 3300, 1),
(3302, 'Dầu dưỡng, serum tóc', 'my-pham-duong-toc', 3300, 2),
(3303, 'Kem ủ, mặt nạ tóc', 'my-pham-mat-na-toc', 3300, 3),
(3304, 'Trị nấm, gàu, rụng tóc', 'my-pham-tri-gau-rung-toc', 3300, 4),
(3305, 'Nhuộm tóc & phủ bạc', 'my-pham-nhuom-toc', 3300, 5),

(3400, 'Trang điểm', 'my-pham-trang-diem', 3000, 4),
(3401, 'Son, dưỡng môi', 'my-pham-son-moi', 3400, 1),
(3402, 'Trang điểm mặt', 'my-pham-trang-diem-mat', 3400, 2),

(3500, 'Chăm sóc da chuyên sâu', 'my-pham-cham-soc-da-chuyen-sau', 3000, 5),
(3501, 'Ngăn ngừa & Trị mụn', 'my-pham-tri-mun', 3500, 1),
(3502, 'Trị nám & Tàn nhang', 'my-pham-tri-nam-tan-nhang', 3500, 2),
(3503, 'Dưỡng trắng da', 'my-pham-duong-trang', 3500, 3),
(3504, 'Tái tạo & chóng lão hoá da', 'my-pham-tai-tao-da', 3500, 4),
(3505, 'Dưỡng da mắt', 'my-pham-duong-da-mat', 3500, 5),
(3506, 'Trị sẹo & mờ thâm', 'my-pham-tri-seo-tham', 3500, 6),

(3600, 'Chăm sóc da nhạy cảm', 'my-pham-da-nhay-cam', 3000, 6),
(3601, 'Dành cho da nhạy cảm', 'my-pham-da-nhay-cam-detail', 3600, 1),
(3602, 'Mỹ phẩm hữu cơ, thiên nhiên', 'my-pham-huu-co', 3600, 2),

(3700, 'Dụng cụ hỗ trợ làm đẹp', 'my-pham-dung-cu-lam-dep', 3000, 7),
(3701, 'Khăn, bông tẩy trang', 'my-pham-bong-tay-trang', 3700, 1),
(3702, 'Cọ trang điểm & Bông mút', 'my-pham-co-trang-diem', 3700, 2),
(3703, 'Dao cạo & tẩy lông', 'my-pham-dao-cao', 3700, 3),
(3704, 'Kẻ mày', 'my-pham-ke-may', 3700, 4),
(3705, 'Mascara & kẻ mắt', 'my-pham-mascara', 3700, 5);

-- 4. CHĂM SÓC CÁ NHÂN (4000)
INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES
(4000, 'Chăm sóc cá nhân', 'cham-soc-ca-nhan', NULL, 4),
(4100, 'Chăm sóc răng miệng', 'cham-soc-rang-mieng', 4000, 1),
(4101, 'Kem đánh răng, nước xúc miệng', 'rang-mieng-kem-nuoc-xuc', 4100, 1),
(4102, 'Tăm, chỉ nha khoa', 'rang-mieng-chi-nha-khoa', 4100, 2),
(4103, 'Bàn chải đánh răng', 'rang-mieng-ban-chai', 4100, 3),
(4104, 'Xịt răng miệng', 'rang-mieng-xit', 4100, 4),

(4200, 'Chăm sóc sức khoẻ sinh lý', 'cham-soc-sinh-ly', 4000, 2),
(4201, 'Bao cao su', 'sinh-ly-bao-cao-su', 4200, 1),
(4202, 'Gel bôi trơn', 'sinh-ly-gel-boi-tron', 4200, 2),

(4300, 'Thực phẩm, đồ uống', 'thuc-pham-do-uong', 4000, 3),
(4301, 'Sữa nước', 'thuc-pham-sua-nuoc', 4300, 1),
(4302, 'Kẹo cứng, kẹo dẻo', 'thuc-pham-keo', 4300, 2),
(4303, 'Nước yến tổ yến', 'thuc-pham-yen-sao', 4300, 3),
(4304, 'Nước uống, nước khoáng', 'thuc-pham-nuoc-uong', 4300, 4),
(4305, 'Đường ăn kiêng', 'thuc-pham-duong-an-kieng', 4300, 5),
(4306, 'Trà, trà thảo dược', 'thuc-pham-tra-thao-duoc', 4300, 6),

(4400, 'Vệ sinh cá nhân', 've-sinh-ca-nhan-detail', 4000, 4),
(4401, 'Vệ sinh tai, mũi, họng', 've-sinh-tai-mui-hong', 4400, 1),
(4402, 'Khăn giấy, khăn ướt', 've-sinh-khan-giay', 4400, 2),
(4403, 'Rửa tay sát khuẩn', 've-sinh-rua-tay', 4400, 3),
(4404, 'Băng vệ sinh', 've-sinh-bang-ve-sinh', 4400, 4),
(4405, 'Dung dịch vệ sinh', 've-sinh-dung-dich', 4400, 5),
(4406, 'Kem bôi phụ khoa', 've-sinh-kem-phu-khoa', 4400, 6),

(4500, 'Dầu, tinh dầu', 'dau-tinh-dau', 4000, 5),
(4501, 'Dầu & tinh dầu xông', 'tinh-dau-xong', 4500, 1),
(4502, 'Dầu & tinh dầu massage', 'tinh-dau-massage', 4500, 2),
(4503, 'Dầu & tinh dầu thiên nhiên', 'tinh-dau-thien-nhien', 4500, 3),

(4600, 'Kem, xịt côn trùng', 'kem-xit-con-trung', 4000, 6),
(4601, 'Xịt côn trùng', 'xit-con-trung', 4600, 1),
(4602, 'Kem chống côn trùng', 'kem-chong-con-trung', 4600, 2);

-- 5. MẸ & BÉ (5000)
INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES
(5000, 'Mẹ & Bé', 'me-va-be', NULL, 5),
(5100, 'Chăm sóc mẹ', 'cham-soc-me', 5000, 1),
(5101, 'Dinh dưỡng cho mẹ', 'me-dinh-duong', 5100, 1),
(5102, 'Vệ sinh & chăm sóc mẹ', 'me-ve-sinh', 5100, 2),
(5103, 'Đồ dùng cho mẹ', 'me-do-dung', 5100, 3),

(5200, 'Chăm sóc bé', 'cham-soc-be', 5000, 2),
(5201, 'Dinh dưỡng cho bé', 'be-dinh-duong', 5200, 1),
(5202, 'Vệ sinh & chăm sóc bé', 'be-ve-sinh', 5200, 2),
(5203, 'Đồ dùng cho bé', 'be-do-dung', 5200, 3);

-- 6. DỤNG CỤ Y TẾ (6000)
INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES
(6000, 'Dụng cụ y tế', 'dung-cu-y-te', NULL, 6),
(6100, 'Thiết bị theo dõi sức khoẻ', 'thiet-bi-theo-doi', 6000, 1),
(6101, 'Kit test covid', 'y-te-kit-test', 6100, 1),
(6102, 'Máy đo huyết áp', 'y-te-may-do-huyet-ap', 6100, 2),
(6103, 'Nhiệt kế', 'y-te-nhiet-ke', 6100, 3),
(6104, 'Máy đo, que, kim thử đường huyết', 'y-te-may-do-duong-huyet', 6100, 4),
(6105, 'Que thử thai', 'y-te-que-thu-thai', 6100, 5),

(6200, 'Dụng cụ y tế gia đình', 'y-te-gia-dinh', 6000, 2),
(6201, 'Băng gạc, bông y tế', 'y-te-bang-gac', 6200, 1),
(6202, 'Khử trùng, sát trùng', 'y-te-khu-trung', 6200, 2),
(6203, 'Khẩu trang y tế', 'y-te-khau-trang', 6200, 3),
(6204, 'Găng tay y tế', 'y-te-gang-tay', 6200, 4),
(6205, 'Mắt kính, tấm chắn giọt bắn', 'y-te-mat-kinh', 6200, 5),
(6206, 'Hỗ trợ giảm đau, hạ sốt', 'y-te-giam-dau-ha-sot', 6200, 6),

(6300, 'Thiết bị hỗ trợ điều trị', 'thiet-bi-ho-tro-dieu-tri', 6000, 3),
(6301, 'Máy đo SpO2', 'y-te-spo2', 6300, 1),
(6302, 'Máy xong khí dung', 'y-te-may-xong', 6300, 2),
(6303, 'Đai, nẹp, vớ y khoa', 'y-te-dai-nep', 6300, 3),
(6304, 'Thiết bị hỗ trợ điều trị khác', 'y-te-ho-tro-khac', 6300, 4),

(6400, 'Dụng cụ phẫu thuật và khám bệnh', 'dung-cu-phau-thuat', 6000, 4),
(6401, 'Bơm, Kim tiêm các loại', 'y-te-bom-kim-tiem', 6400, 1),
(6402, 'Kéo, dao mổ', 'y-te-keo-dao-mo', 6400, 2),
(6403, 'Dụng cụ phẫu thuật và khám bệnh khác', 'y-te-phau-thuat-khac', 6400, 3),

(6500, 'Thiết bị hỗ trợ vận động', 'thiet-bi-ho-tro-van-dong', 6000, 5),
(6501, 'Xe lăn', 'y-te-xe-lan', 6500, 1),
(6502, 'Nặng chống, gậy chống', 'y-te-gay-chong', 6500, 2),
(6503, 'Hỗ trợ chống loét', 'y-te-chong-loet', 6500, 3),
(6504, 'Thiết bị hỗ trợ khác', 'y-te-van-dong-khac', 6500, 4);

-- CMS / STATIC
INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES
(7000, 'Bệnh lý', 'benh-ly', NULL, 7),
(8000, 'Góc sức khoẻ', 'goc-suc-khoe', NULL, 8),
(9000, 'Tin tức', 'tin-tuc', NULL, 9),
(9999, 'Chưa phân loại', 'chua-phan-loai', NULL, 99);


-- =============================================================================
-- 3. LOGIC MAPPING SẢN PHẨM (HÀNH ĐỘNG CỰC KỲ CHI TIẾT)
-- =============================================================================

UPDATE products SET category_id = 9999;

-- THUỐC
UPDATE products SET category_id = 1101 WHERE name LIKE '%dạ dày%' OR name LIKE '%Gaviscon%' OR name LIKE '%Phosphalugel%' OR name LIKE '%Yumangel%' OR name LIKE '%Pantoloc%';
UPDATE products SET category_id = 1102 WHERE name LIKE '%đầy hơi%' OR name LIKE '%buồn nôn%' OR name LIKE '%Motilium%';
UPDATE products SET category_id = 1103 WHERE name LIKE '%Men tiêu hoá%' OR name LIKE '%BioGaia%' OR name LIKE '%Enterogermina%';
UPDATE products SET category_id = 1104 WHERE name LIKE '%nhuận tràng%' OR name LIKE '%táo bón%';
UPDATE products SET category_id = 1105 WHERE name LIKE '%tiêu chảy%';
UPDATE products SET category_id = 1106 WHERE name LIKE '%gan mật%' OR name LIKE '%bổ gan%';

UPDATE products SET category_id = 1201 WHERE name LIKE '%cảm cúm%' OR name LIKE '%Tiffy%' OR name LIKE '%Decolgen%';
UPDATE products SET category_id = 1202 WHERE name LIKE '%thuốc ho%' OR name LIKE '%Siro ho%' OR name LIKE '%long đờm%';

UPDATE products SET category_id = 1301 WHERE name LIKE '%giảm đau%' OR name LIKE '%hạ sốt%' OR name LIKE '%Hapacol%' OR name LIKE '%Paracetamol%';
UPDATE products SET category_id = 1302 WHERE name LIKE '%giảm đau xương khớp%';

UPDATE products SET category_id = 1401 WHERE name LIKE '%huyết áp%';
UPDATE products SET category_id = 1402 WHERE name LIKE '%tim mạch%';
UPDATE products SET category_id = 1405 WHERE name LIKE '%bổ máu%' OR name LIKE '%sắt%';
UPDATE products SET category_id = 1406 WHERE name LIKE '%tuần hoàn não%';

UPDATE products SET category_id = 1601 WHERE name LIKE '%kháng sinh%';

UPDATE products SET category_id = 1701 WHERE name LIKE '%trị mụn%';
UPDATE products SET category_id = 1705 WHERE name LIKE '%Dầu gội trị gàu%';

-- TPCN
UPDATE products SET category_id = 2102 WHERE name LIKE '%Vitamin C%' AND category_id = 9999;
UPDATE products SET category_id = 2103 WHERE (name LIKE '%Canxi%' OR name LIKE '%Calcium%') AND category_id = 9999;

-- DƯỢC MỸ PHẨM
UPDATE products SET category_id = 3101 WHERE name LIKE '%Sữa rửa mặt%';
UPDATE products SET category_id = 3105 WHERE name LIKE '%chống nắng%';

-- CHĂM SÓC CÁ NHÂN
UPDATE products SET category_id = 4101 WHERE name LIKE '%Kem đánh răng%' OR name LIKE '%nước xúc miệng%';

SET FOREIGN_KEY_CHECKS = 1;
