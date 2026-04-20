-- =============================================================================
-- SEED ĐẦY ĐỦ: mg_catalog
-- Bao gồm: suppliers, locations, brands, categories, products (từ file cào),
--           batches, batch_items, stock_movements, product_units
-- Chạy trong DBeaver: Chọn tất cả (Cmd+A) → Option+X (Execute Script)
-- =============================================================================

USE mg_catalog;

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- =============================================================================
-- 1. CATEGORIES (danh mục phân cấp)
--    Đây là dữ liệu từ mg_catalog.sql gốc, cần có trước khi insert products
-- =============================================================================
INSERT IGNORE INTO categories (id, name, slug, parent_id, description, is_active, sort_order) VALUES
(1,   'Thuốc kê đơn (Rx)',                    'thuoc-ke-don',                    NULL, 'Thuốc cần có đơn bác sĩ khi mua',                     1, 1),
(2,   'Thuốc không kê đơn (OTC)',              'thuoc-khong-ke-don',              NULL, 'Thuốc mua tự do không cần đơn',                       1, 2),
(3,   'Vitamin & Thực Phẩm Chức Năng',         'vitamin-tpcn',                    NULL, 'Bổ sung dinh dưỡng, tăng cường sức khoẻ',             1, 3),
(4,   'Thiết bị y tế',                         'thiet-bi-y-te',                   NULL, 'Máy đo huyết áp, nhiệt kế, băng gạc...',              1, 4),
(5,   'Kháng sinh',                            'thuoc-khang-sinh',                1,    'Amoxicillin, Azithromycin, Ciprofloxacin...',          1, 1),
(6,   'Hạ sốt, giảm đau',                     'ha-sot-giam-dau',                 2,    'Paracetamol, Ibuprofen và các nhóm giảm đau khác',    1, 1),
(7,   'Tiêu hoá',                              'thuoc-tieu-hoa',                  2,    'Thuốc dạ dày, chống nôn, nhuận tràng...',             1, 2),
(8,   'Vitamin tổng hợp',                      'vitamin-tong-hop',                3,    'Multivitamin và khoáng chất tổng hợp',                1, 1),
(9,   'Vitamin C',                             'vitamin-c',                       3,    'Bổ sung Vitamin C dạng viên và nước',                 1, 2),
(10,  'Băng gạc & Cầm máu',                   'bang-gac-cam-mau',                4,    'Băng y tế, gạc, bông cồn, cầm máu',                  1, 1),
(11,  'Giảm đau hạ sốt',                       'giam-dau-ha-sot',                 2,    'Thuốc giảm đau, hạ sốt thông thường',                 1, 3),
(12,  'Tai, mũi, họng',                        'tai-mui-hong',                    2,    'Thuốc điều trị tai mũi họng',                         1, 4),
(13,  'Mắt',                                   'mat',                             2,    'Thuốc nhỏ mắt, dưỡng mắt',                           1, 5),
(14,  'Tim mạch, huyết áp',                   'tim-mach-huyet-ap',               1,    'Thuốc tim mạch, điều hòa huyết áp',                  1, 2),
(15,  'Tim mạch',                              'tim-mach',                        1,    'Thuốc điều trị bệnh tim mạch',                        1, 3),
(16,  'Thần kinh',                             'than-kinh',                       1,    'Thuốc điều trị thần kinh',                            1, 4),
(17,  'Xương khớp',                            'xuong-khop',                      1,    'Thuốc điều trị xương khớp',                           1, 5),
(18,  'Sắt, vitamin bà bầu',                  'sat-vitamin-ba-bau',              3,    'Bổ sung sắt, vitamin cho bà bầu',                     1, 3),
(19,  'Canxi & Vitamin D',                     'canxi-vitamin-d',                 3,    'Bổ sung canxi và vitamin D',                          1, 4),
(20,  'Da liễu',                               'da-lieu',                         2,    'Thuốc điều trị da liễu',                              1, 6),
(21,  'Dị ứng',                                'di-ung',                          2,    'Thuốc kháng dị ứng',                                  1, 7),
(22,  'Hô hấp',                                'ho-hap',                          1,    'Thuốc điều trị hô hấp',                               1, 6),
(23,  'Mỡ máu, tim mạch',                     'mo-mau-tim-mach',                 1,    'Thuốc điều trị mỡ máu',                               1, 7),
(24,  'Tiểu đường',                            'tieu-duong',                      1,    'Thuốc điều trị tiểu đường',                           1, 8),
(25,  'Kháng sinh thế hệ mới',                'khang-sinh-the-he-moi',           1,    'Kháng sinh thế hệ 2, 3, 4',                           1, 9),
(26,  'Sức khoẻ phụ nữ',                      'suc-khoe-phu-nu',                 3,    'Sản phẩm dành cho phụ nữ',                            1, 5),
(27,  'Sức khoẻ nam',                          'suc-khoe-nam',                    3,    'Sản phẩm dành cho nam giới',                          1, 6),
(28,  'Trẻ em',                                'tre-em',                          3,    'Sản phẩm dành cho trẻ em',                            1, 7),
(29,  'Người cao tuổi',                        'nguoi-cao-tuoi',                  3,    'Sản phẩm dành cho người cao tuổi',                    1, 8),
(30,  'Thực phẩm chức năng',                   'thuc-pham-chuc-nang',             3,    'Thực phẩm bảo vệ sức khoẻ',                           1, 9),
(31,  'Men tiêu hoá',                          'men-tieu-hoa',                    2,    'Men vi sinh, enzyme tiêu hoá',                        1, 8),
(32,  'Đau dạ dày',                            'dau-da-day',                      2,    'Thuốc điều trị đau dạ dày',                           1, 9),
(33,  'Gan mật',                               'gan-mat',                         2,    'Thuốc bảo vệ gan mật',                                1, 10),
(34,  'Sát khuẩn, khử trùng',                 'sat-khuan-khu-trung',             2,    'Dung dịch sát khuẩn, khử trùng',                     1, 11),
(35,  'Nội tiết',                              'noi-tiet',                        1,    'Thuốc nội tiết',                                      1, 10),
(36,  'Ung thư',                               'ung-thu',                         1,    'Thuốc điều trị ung thư',                              1, 11),
(37,  'Dịch truyền',                           'dich-truyen',                     1,    'Dung dịch truyền tĩnh mạch',                          1, 12),
(38,  'Mắt, tai',                              'mat-tai',                         2,    'Thuốc điều trị mắt và tai',                           1, 12),
(39,  'Bổ não',                                'bo-nao',                          2,    'Thuốc bổ não, tăng cường trí nhớ',                   1, 13),
(40,  'Bổ phổi',                               'bo-phoi',                         2,    'Thuốc điều trị bệnh phổi',                            1, 14),
(41,  'Thuốc ho, đờm',                        'thuoc-ho-dom',                    2,    'Thuốc trị ho, long đờm',                              1, 15),
(42,  'Sản phẩm dưỡng da',                    'san-pham-duong-da',               4,    'Kem dưỡng, serum, toner...',                          1, 2),
(43,  'Chống nắng',                            'chong-nang',                      4,    'Kem chống nắng SPF các loại',                         1, 3),
(44,  'Tẩy tế bào chết',                      'tay-te-bao-chet',                 4,    'Sản phẩm tẩy da chết',                                1, 4),
(45,  'Thuốc mỡ da',                           'thuoc-mo-da',                     1,    'Thuốc bôi điều trị da liễu',                          1, 13),
(46,  'Thuốc dạ dày - ruột',                  'thuoc-da-day-ruot',               2,    'Thuốc tiêu hoá đường ruột',                           1, 16),
(47,  'Thuốc bổ gan',                          'thuoc-bo-gan',                    2,    'Thuốc bảo vệ và phục hồi gan',                        1, 17),
(48,  'Sốt xuất huyết',                        'sot-xuat-huyet',                  2,    'Thuốc điều trị sốt xuất huyết',                       1, 18),
(49,  'Khớp',                                  'khop',                            1,    'Thuốc điều trị bệnh khớp',                            1, 14),
(50,  'Dị ứng da',                             'di-ung-da',                       2,    'Thuốc trị dị ứng da, mề đay',                         1, 19),
(51,  'Ký sinh trùng',                         'ky-sinh-trung',                   1,    'Thuốc điều trị ký sinh trùng',                        1, 15),
(52,  'Thần kinh ngoại biên',                 'than-kinh-ngoai-bien',            1,    'Thuốc điều trị thần kinh ngoại biên',                 1, 16),
(53,  'Nhỏ mắt',                               'nho-mat',                         2,    'Thuốc nhỏ mắt các loại',                              1, 20),
(54,  'Tiêu chảy',                             'tieu-chay',                       2,    'Thuốc điều trị tiêu chảy',                            1, 21),
(55,  'Táo bón',                               'tao-bon',                         2,    'Thuốc điều trị táo bón',                              1, 22),
(56,  'Ho, cảm',                               'ho-cam',                          2,    'Thuốc trị ho, cảm cúm',                               1, 23),
(57,  'Nhức đầu',                              'nhuc-dau',                        2,    'Thuốc trị nhức đầu',                                  1, 24),
(58,  'Tiểu đường tuýp 2',                    'tieu-duong-tuyp-2',               1,    'Thuốc điều trị tiểu đường tuýp 2',                    1, 17),
(59,  'Vitamin nhóm B',                        'vitamin-nhom-b',                  3,    'Bổ sung vitamin nhóm B',                              1, 10),
(60,  'Rối loạn thần kinh',                   'roi-loan-than-kinh',              1,    'Thuốc điều trị rối loạn thần kinh',                   1, 18),
(61,  'Dịch truyền tĩnh mạch',               'dich-truyen-tinh-mach',           1,    'Các loại dịch truyền',                                1, 19),
(62,  'Dị ứng, kháng histamin',               'di-ung-khang-histamin',           2,    'Thuốc kháng histamin, chống dị ứng',                  1, 25),
(63,  'Thần kinh trung ương',                 'than-kinh-trung-uong',            1,    'Thuốc an thần, chống động kinh',                      1, 20),
(64,  'Cơ xương khớp',                        'co-xuong-khop',                   2,    'Thuốc giảm đau cơ khớp OTC',                          1, 26),
(65,  'Khoáng chất',                           'khoang-chat',                     3,    'Bổ sung khoáng chất thiết yếu',                       1, 11),
(66,  'Hỗ trợ tiêu hoá',                      'ho-tro-tieu-hoa',                 3,    'Men vi sinh, probiotic',                              1, 12),
(67,  'Bổ sung dinh dưỡng',                   'bo-sung-dinh-duong',              3,    'Sản phẩm bổ sung dinh dưỡng cho trẻ',                 1, 13),
(68,  'Corticosteroid',                        'corticosteroid',                  1,    'Thuốc nhóm corticosteroid',                           1, 21),
(69,  'Bổ sung dinh dưỡng trẻ em',           'bo-sung-dinh-duong-tre-em',        3,    'Dinh dưỡng bổ sung cho trẻ',                          1, 14),
(70,  'Thận, tiết niệu',                      'than-tiet-nieu',                  1,    'Thuốc điều trị thận, tiết niệu',                     1, 22),
(71,  'Dưỡng tóc, da',                        'duong-toc-da',                    3,    'Sản phẩm chăm sóc tóc và da',                        1, 15),
(72,  'Bổ sung collagen',                      'bo-sung-collagen',                3,    'Sản phẩm bổ sung collagen',                           1, 16),
(73,  'Omega-3',                               'omega-3',                         3,    'Bổ sung Omega-3, DHA',                                1, 17),
(74,  'Giảm cân',                              'giam-can',                        3,    'Sản phẩm hỗ trợ giảm cân',                            1, 18),
(75,  'Bổ máu',                                'bo-mau',                          3,    'Sản phẩm bổ sung sắt, axit folic',                    1, 19),
(76,  'Kháng khuẩn da',                        'khang-khuan-da',                  2,    'Thuốc kháng khuẩn bôi ngoài da',                      1, 27),
(77,  'Thuốc viêm xoang',                     'thuoc-viem-xoang',                2,    'Điều trị viêm xoang mũi',                             1, 28),
(78,  'Thực phẩm bảo vệ sức khoẻ',           'thuc-pham-bao-ve-suc-khoe',        3,    'TPBVSK các loại',                                     1, 20),
(79,  'Đường tiêu hoá, lợi khuẩn',           'duong-tieu-hoa-loi-khuan',         3,    'Probiotic, lợi khuẩn tiêu hoá',                       1, 21),
(80,  'Bổ sung magie',                        'bo-sung-magie',                    3,    'Bổ sung khoáng magie',                                1, 22),
(81,  'Sức khoẻ tổng thể',                   'suc-khoe-tong-the',                3,    'Sản phẩm bổ sung sức khoẻ toàn diện',                 1, 23),
(82,  'Tiết niệu',                             'tiet-nieu',                       1,    'Thuốc điều trị bệnh tiết niệu',                       1, 23),
(83,  'Bệnh gút',                              'benh-gut',                        1,    'Thuốc điều trị bệnh gút',                             1, 24),
(84,  'Tuyến giáp',                            'tuyen-giap',                      1,    'Thuốc điều trị tuyến giáp',                           1, 25),
(85,  'Sản phụ khoa',                         'san-phu-khoa',                    1,    'Thuốc điều trị sản phụ khoa',                         1, 26),
(86,  'Huyết học',                             'huyet-hoc',                       1,    'Thuốc điều trị bệnh huyết học',                       1, 27),
(87,  'Thuốc gây mê, tiền mê',               'thuoc-gay-me-tien-me',            1,    'Thuốc dùng trong gây mê, tiền mê',                    1, 28),
(88,  'Thuốc miễn dịch',                      'thuoc-mien-dich',                 1,    'Thuốc điều hoà miễn dịch',                            1, 29),
(89,  'Rối loạn nhịp tim',                    'roi-loan-nhip-tim',               1,    'Thuốc điều trị rối loạn nhịp tim',                    1, 30),
(90,  'Trĩ, tĩnh mạch',                       'tri-tinh-mach',                   2,    'Thuốc điều trị trĩ, suy tĩnh mạch',                  1, 29),
(91,  'Nhuận tràng',                           'nhuan-trang',                     2,    'Thuốc nhuận tràng trị táo bón',                       1, 30),
(92,  'Cơ thể, tổng hợp',                     'co-the-tong-hop',                 3,    'Sản phẩm hỗ trợ toàn diện',                           1, 24),
(93,  'Bổ não, trí nhớ',                      'bo-nao-tri-nho',                  3,    'Sản phẩm bổ não, tăng trí nhớ',                       1, 25),
(94,  'Tim mạch, TPCN',                       'tim-mach-tpcn',                   3,    'TPCN hỗ trợ tim mạch',                                1, 26),
(95,  'Xương khớp, TPCN',                     'xuong-khop-tpcn',                 3,    'TPCN hỗ trợ xương khớp',                              1, 27),
(96,  'Đẹp da, TPCN',                         'dep-da-tpcn',                     3,    'TPCN làm đẹp da',                                     1, 28),
(97,  'Mắt, TPCN',                            'mat-tpcn',                        3,    'TPCN bổ mắt',                                         1, 29),
(98,  'Sức khoẻ sinh lý nam',               'suc-khoe-sinh-ly-nam',             3,    'TPCN hỗ trợ sức khoẻ sinh lý',                        1, 30),
(99,  'Hỗ trợ gan',                           'ho-tro-gan',                      3,    'Bổ sung hỗ trợ chức năng gan',                        1, 31),
(100, 'Thuốc bôi ngoài da',                  'thuoc-boi-ngoai-da',              2,    'Thuốc bôi điều trị ngoài da',                         1, 31),
(101, 'Bệnh về mắt',                          'benh-ve-mat',                     1,    'Thuốc điều trị bệnh về mắt',                          1, 32),
(102, 'Tai mũi họng chuyên sâu',             'tai-mui-hong-chuyen-sau',         1,    'Thuốc Rx điều trị tai mũi họng',                      1, 33),
(103, 'Vitamin tóc',                           'vitamin-toc',                     3,    'Bổ sung vitamin cho tóc',                             1, 32),
(104, 'Sức khoẻ sinh lý nữ',               'suc-khoe-sinh-ly-nu',              3,    'TPCN hỗ trợ sức khoẻ sinh lý nữ',                     1, 33),
(105, 'Sụn khớp, bổ khớp',                   'sun-khop-bo-khop',                3,    'TPCN bổ sung sụn khớp',                               1, 34),
(106, 'Hỗ trợ gút',                           'ho-tro-gut',                      3,    'TPCN hỗ trợ điều trị gút',                            1, 35),
(107, 'Xương khớp nâng cao',                 'xuong-khop-nang-cao',             3,    'TPCN xương khớp cao cấp',                             1, 36),
(108, 'Bổ phổi, hô hấp',                     'bo-phoi-ho-hap',                  3,    'TPCN hỗ trợ hô hấp',                                  1, 37),
(109, 'Ung thư, TPCN',                        'ung-thu-tpcn',                    3,    'TPCN hỗ trợ bệnh ung thư',                            1, 38),
(110, 'Long đờm, ho',                         'long-dom-ho',                     3,    'TPCN hỗ trợ long đờm, giảm ho',                       1, 39),
(111, 'Trĩ, TPCN',                            'tri-tpcn',                        3,    'TPCN hỗ trợ điều trị trĩ',                            1, 40),
(112, 'Viêm họng, ho',                        'viem-hong-ho',                    2,    'Kẹo ngậm, sản phẩm hỗ trợ viêm họng',                1, 32),
(113, 'Thuốc bổ máu',                         'thuoc-bo-mau',                    1,    'Thuốc điều trị thiếu máu',                            1, 34),
(114, 'Sử dụng trong bệnh viện',             'su-dung-benh-vien',               1,    'Thuốc dành cho sử dụng nội trú',                      1, 35),
(115, 'Rối loạn lipid máu',                  'roi-loan-lipid-mau',              1,    'Thuốc điều trị rối loạn lipid',                       1, 36),
(116, 'Phẫu thuật, gây mê',                  'phau-thuat-gay-me',               1,    'Thuốc hỗ trợ phẫu thuật',                             1, 37),
(117, 'Bệnh gút, TPCN',                       'benh-gut-tpcn',                   3,    'TPCN hỗ trợ bệnh gút',                                1, 41),
(118, 'Thiếu máu',                             'thieu-mau',                       1,    'Thuốc điều trị thiếu máu',                            1, 38),
(119, 'Kẽm, selenium',                        'kem-selenium',                    3,    'Bổ sung kẽm và selenium',                             1, 42),
(120, 'Thuốc nhỏ mũi',                        'thuoc-nho-mui',                   2,    'Thuốc nhỏ mũi các loại',                              1, 33),
(121, 'Bổ sung Men',                           'bo-sung-men',                     3,    'Bổ sung men tiêu hoá',                                1, 43),
(122, 'Rối loạn tiền đình',                  'roi-loan-tien-dinh',              1,    'Thuốc điều trị rối loạn tiền đình',                   1, 39),
(123, 'Mật ong, thảo dược',                  'mat-ong-thao-duoc',               2,    'Sản phẩm từ thiên nhiên',                             1, 34),
(124, 'Sức khoẻ hô hấp',                     'suc-khoe-ho-hap',                 3,    'Sản phẩm hỗ trợ hô hấp',                              1, 44),
(125, 'Tai mũi họng TPCN',                   'tai-mui-hong-tpcn',               3,    'TPCN hỗ trợ tai mũi họng',                            1, 45),
(126, 'Thực phẩm bảo vệ tim',               'thuc-pham-bao-ve-tim',             3,    'TPCN bảo vệ tim mạch',                                1, 46),
(127, 'Ngủ, stress',                           'ngu-stress',                      3,    'Sản phẩm hỗ trợ giấc ngủ, giảm stress',               1, 47),
(128, 'Da mặt chuyên sâu',                   'da-mat-chuyen-sau',               4,    'Sản phẩm chăm sóc da mặt cao cấp',                    1, 5),
(129, 'Toner, xịt khoáng',                   'toner-xit-khoang',                4,    'Toner, xịt khoáng chăm sóc da',                       1, 6),
(130, 'Sữa rửa mặt',                          'sua-rua-mat',                     4,    'Sữa rửa mặt các loại',                                1, 7),
(131, 'Mặt nạ',                                'mat-na',                          4,    'Mặt nạ dưỡng da',                                    1, 8),
(132, 'Kem nền, phấn phủ',                    'kem-nen-phan-phu',                4,    'Sản phẩm trang điểm',                                 1, 9),
(133, 'Chống nắng chuyên sâu',               'chong-nang-chuyen-sau',           4,    'Kem chống nắng cao cấp',                              1, 10),
(134, 'Tẩy trang',                             'tay-trang',                       4,    'Tẩy trang, nước micellar',                            1, 11),
(135, 'Kem dưỡng',                             'kem-duong',                       4,    'Kem dưỡng ẩm, dưỡng da',                              1, 12),
(136, 'Serum, essence',                        'serum-essence',                   4,    'Serum, essence cao cấp',                              1, 13),
(137, 'Dầu gội, dưỡng tóc',                  'dau-goi-duong-toc',               4,    'Sản phẩm chăm sóc tóc',                               1, 14),
(138, 'Sửa tắm, sửa rửa tay',               'sua-tam-sua-rua-tay',             4,    'Sản phẩm vệ sinh cá nhân',                            1, 15),
(139, 'Kem dưỡng tay, chân',                 'kem-duong-tay-chan',               4,    'Kem dưỡng tay và chân',                               1, 16),
(140, 'Sản phẩm làm trắng',                  'san-pham-lam-trang',              4,    'Sản phẩm làm trắng da',                               1, 17),
(141, 'Trị mụn',                               'tri-mun',                         4,    'Sản phẩm trị mụn',                                    1, 18),
(142, 'Chống lão hoá',                        'chong-lao-hoa',                   4,    'Sản phẩm chống lão hoá',                              1, 19),
(143, 'Dưỡng môi',                             'duong-moi',                       4,    'Son dưỡng, kem dưỡng môi',                            1, 20),
(144, 'Lăn khử mùi',                          'lan-khu-mui',                     4,    'Lăn khử mùi, xịt thơm',                              1, 21),
(145, 'Kem chân tay',                          'kem-chan-tay',                    4,    'Kem dưỡng chân, tay',                                 1, 22),
(146, 'Kem trị sẹo',                          'kem-tri-seo',                     4,    'Sản phẩm trị sẹo',                                    1, 23),
(147, 'Dưỡng da toàn thân',                  'duong-da-toan-than',              4,    'Kem, lotion dưỡng da toàn thân',                      1, 24),
(148, 'Điều trị da liễu',                     'dieu-tri-da-lieu',                4,    'Sản phẩm điều trị bệnh da liễu',                      1, 25),
(149, 'Gel trị mụn',                          'gel-tri-mun',                     4,    'Gel bôi trị mụn',                                     1, 26),
(150, 'Nước hoa hồng',                        'nuoc-hoa-hong',                   4,    'Nước hoa hồng dưỡng da',                              1, 27),
(151, 'Kem chống nắng cao cấp',              'kem-chong-nang-cao-cap',           4,    'Kem chống nắng cao cấp nhập khẩu',                    1, 28),
(152, 'Xịt dưỡng',                            'xit-duong',                       4,    'Xịt dưỡng tóc, da',                                   1, 29),
(153, 'Thuốc trị nấm da',                    'thuoc-tri-nam-da',                 2,    'Thuốc điều trị nấm da',                               1, 35),
(154, 'Kem dưỡng ẩm',                         'kem-duong-am',                    4,    'Kem dưỡng ẩm chuyên dụng',                            1, 30),
(155, 'Dầu dưỡng',                             'dau-duong',                       4,    'Dầu dưỡng tóc và da',                                 1, 31),
(156, 'Nước muối sinh lý',                    'nuoc-muoi-sinh-ly',               2,    'Nước muối sinh lý NaCl 0.9%',                         1, 36),
(157, 'Hỗ trợ thụ thai',                      'ho-tro-thu-thai',                 3,    'Sản phẩm hỗ trợ khả năng sinh sản',                   1, 48),
(158, 'Sản phẩm chăm sóc sau sinh',         'san-pham-cham-soc-sau-sinh',        3,    'Sản phẩm dành cho mẹ sau sinh',                       1, 49),
(159, 'Sản phẩm cho mẹ bầu',                'san-pham-cho-me-bau',              3,    'Sản phẩm chăm sóc bà bầu',                            1, 50),
(160, 'Pin, dụng cụ y tế',                   'pin-dung-cu-y-te',                4,    'Dụng cụ y tế và phụ kiện',                            1, 32),
(161, 'Thực phẩm sức khoẻ',                  'thuc-pham-suc-khoe',              4,    'Thực phẩm chăm sóc sức khoẻ',                         1, 33),
(162, 'Thiết bị đo lường',                   'thiet-bi-do-luong',               4,    'Máy đo huyết áp, đường huyết...',                     1, 34),
(163, 'Phụ kiện y tế',                        'phu-kien-y-te',                   4,    'Phụ kiện và dụng cụ y tế',                            1, 35),
(164, 'Bộ test nhanh',                        'bo-test-nhanh',                    4,    'Bộ test nhanh các loại',                              1, 36),
(165, 'Máy đo đường huyết',                  'may-do-duong-huyet',              4,    'Máy và que thử đường huyết',                          1, 37),
(166, 'Sản phẩm răng miệng',                 'san-pham-rang-mieng',             4,    'Sản phẩm vệ sinh răng miệng',                         1, 38),
(167, 'Băng dán vết thương',                 'bang-dan-vet-thuong',             4,    'Băng cuộn, băng dán y tế',                            1, 39),
(168, 'Bông, gạc y tế',                       'bong-gac-y-te',                   4,    'Bông gòn, gạc y tế',                                  1, 40),
(169, 'Dụng cụ phun thuốc',                  'dung-cu-phun-thuoc',              4,    'Máy phun thuốc, nebulizer',                           1, 41),
(170, 'Sản phẩm yến sào',                    'san-pham-yen-sao',                3,    'Yến sào và các sản phẩm từ yến',                      1, 51),
(171, 'Kẹo, thực phẩm',                      'keo-thuc-pham',                   4,    'Kẹo, thực phẩm dinh dưỡng',                           1, 42),
(172, 'Nước uống, đồ uống',                  'nuoc-uong-do-uong',               4,    'Nước uống có lợi cho sức khoẻ',                        1, 43),
(173, 'Sản phẩm chăm sóc tóc',              'san-pham-cham-soc-toc',            4,    'Dầu gội, xả, kem tóc',                               1, 44),
(174, 'Thuốc bổ mắt',                         'thuoc-bo-mat',                    3,    'TPCN bổ mắt, sáng mắt',                               1, 52),
(175, 'Sản phẩm thảo dược',                  'san-pham-thao-duoc',              3,    'Sản phẩm từ thảo dược thiên nhiên',                    1, 53),
(176, 'Sản phẩm hữu cơ',                     'san-pham-huu-co',                 4,    'Sản phẩm organic, hữu cơ',                            1, 45),
(177, 'Sản phẩm từ sữa',                     'san-pham-tu-sua',                 4,    'Sản phẩm dinh dưỡng từ sữa',                          1, 46),
(178, 'Băng vệ sinh',                          'bang-ve-sinh',                    4,    'Băng vệ sinh, tampon',                                1, 47),
(179, 'Vệ sinh phụ nữ',                       've-sinh-phu-nu',                  4,    'Sản phẩm vệ sinh phụ nữ',                             1, 48),
(180, 'Sản phẩm massage',                    'san-pham-massage',                4,    'Dụng cụ và sản phẩm massage',                         1, 49),
(181, 'Tinh dầu',                              'tinh-dau',                        4,    'Tinh dầu thiên nhiên',                                1, 50),
(182, 'Sản phẩm bảo vệ',                     'san-pham-bao-ve',                 4,    'Găng tay, khẩu trang y tế',                           1, 51),
(183, 'Nhiệt kế',                              'nhiet-ke',                        4,    'Nhiệt kế các loại',                                   1, 52),
(184, 'Máy huyết áp',                         'may-huyet-ap',                    4,    'Máy đo huyết áp',                                     1, 53),
(185, 'Cân điện tử',                          'can-dien-tu',                     4,    'Cân điện tử sức khoẻ',                                1, 54),
(186, 'Đệm, nẹp, đai',                       'dem-nep-dai',                     4,    'Đệm, nẹp, đai hỗ trợ',                               1, 55),
(187, 'Ghế, giường bệnh nhân',              'ghe-giuong-benh-nhan',             4,    'Thiết bị phục hồi chức năng',                         1, 56),
(188, 'Văn phòng phẩm y tế',                'van-phong-pham-y-te',             4,    'Các vật tư y tế văn phòng',                           1, 57),
(189, 'Thuốc bổ tổng hợp',                   'thuoc-bo-tong-hop',               3,    'Vitamin tổng hợp, khoáng chất',                       1, 54),
(190, 'Chăm sóc bé',                          'cham-soc-be',                     4,    'Sản phẩm chăm sóc trẻ sơ sinh',                       1, 58),
(191, 'Sản phẩm kháng khuẩn',               'san-pham-khang-khuan',             4,    'Gel rửa tay, khẩu trang kháng khuẩn',                 1, 59),
(192, 'Dụng cụ y tế gia đình',             'dung-cu-y-te-gia-dinh',            4,    'Dụng cụ y tế dùng tại nhà',                           1, 60),
(193, 'Dụng cụ uống thuốc',                 'dung-cu-uong-thuoc',              4,    'Dụng cụ hỗ trợ uống thuốc',                           1, 61),
(194, 'Sản phẩm chăm sóc da sau điều trị', 'cham-soc-da-sau-dieu-tri',         4,    'Sản phẩm phục hồi da sau trị liệu',                   1, 62),
(195, 'Sản phẩm mẹ và bé',                  'san-pham-me-va-be',               4,    'Sản phẩm dành cho mẹ và bé',                          1, 63),
(196, 'Sản phẩm dinh dưỡng',               'san-pham-dinh-duong',              3,    'Sản phẩm bổ sung dinh dưỡng',                         1, 55),
(197, 'Vitamin E',                             'vitamin-e',                       3,    'Bổ sung Vitamin E',                                   1, 56),
(198, 'Bổ sung Coenzyme Q10',               'bo-sung-coenzyme-q10',             3,    'Bổ sung CoQ10 cho tim mạch',                          1, 57),
(199, 'Băng bó, cố định vết thương',        'bang-bo-co-dinh-vet-thuong',       4,    'Băng bó, cố định gân, cơ, xương',                     1, 64),
(200, 'Dụng cụ kiểm tra mắt',               'dung-cu-kiem-tra-mat',             4,    'Kính bảo hộ và dụng cụ kiểm tra mắt',                 1, 65),
(201, 'Khẩu trang y tế',                     'khau-trang-y-te',                 4,    'Khẩu trang phòng dịch bệnh',                          1, 66),
(202, 'Ống tiêm, kim tiêm',                  'ong-tiem-kim-tiem',               4,    'Ống tiêm và kim tiêm y tế',                           1, 67),
(203, 'Bộ truyền dịch',                       'bo-truyen-dich',                  4,    'Bộ dây truyền dịch tĩnh mạch',                        1, 68),
(204, 'Sản phẩm nhà bếp',                    'san-pham-nha-bep',                4,    'Sản phẩm dinh dưỡng cho gia đình',                    1, 69),
(205, 'Sản phẩm chống muỗi',                'san-pham-chong-muoi',              4,    'Kem, tinh dầu chống muỗi',                            1, 70),
(206, 'Sản phẩm chống côn trùng',          'san-pham-chong-con-trung',         4,    'Sản phẩm diệt côn trùng, phòng ngừa',                 1, 71),
(207, 'Nước nhỏ mắt',                         'nuoc-nho-mat',                    4,    'Nước nhỏ mắt dưỡng ẩm',                              1, 72),
(208, 'Dụng cụ y tế chuyên dụng',          'dung-cu-y-te-chuyen-dung',         4,    'Thiết bị y tế chuyên nghiệp',                         1, 73),
(209, 'Kim tiêm đặc biệt',                   'kim-tiem-dac-biet',               4,    'Kim tiêm chuyên dụng',                                1, 74),
(210, 'Sản phẩm vết thương',                'san-pham-vet-thuong',              4,    'Sản phẩm chăm sóc vết thương',                        1, 75);

-- =============================================================================
-- 2. SUPPLIERS (Nhà cung cấp)
-- =============================================================================
INSERT IGNORE INTO suppliers (id, code, name, contact_name, phone, email, address, tax_code, total_purchase_value, current_debt, status) VALUES
(1, 'SUP-001', 'Công ty TNHH Dược phẩm Merap',            'Nguyễn Trí Dũng',   '02839012345', 'duoc@merap.com.vn',       '128 Nguyễn Văn Trỗi, Q.Phú Nhuận, TP.HCM',    '0300615980', 145000000.00, 12500000.00, 'active'),
(2, 'SUP-002', 'Công ty CP Dược Hậu Giang (DHG Pharma)',   'Lê Thị Phương',     '07103821016', 'order@dhgpharma.vn',      'KCN Trà Nóc, Bình Thủy, Cần Thơ',             '1800218985',  98000000.00,  8000000.00, 'active'),
(3, 'SUP-003', 'Công ty CP Pymepharco',                    'Đỗ Văn Tân',        '02573829999', 'sales@pymepharco.vn',     '166-170 Nguyễn Huệ, TP. Tuy Hòa, Phú Yên',   '4200166699',  67000000.00,  5000000.00, 'active'),
(4, 'SUP-004', 'Công ty CP Dược Phẩm OPV',                 'Phạm Hồng Nhung',   '02439724725', 'opv@opv.com.vn',          '13 Đào Duy Anh, Đống Đa, Hà Nội',             '0101243888',  34000000.00,  0.00,       'active'),
(5, 'SUP-005', 'Công ty TNHH Dược Phẩm TW1 (Pharmedic)',   'Trần Minh Khoa',    '02838245789', 'info@pharmedic.com.vn',   '268 Tô Hiến Thành, Q.10, TP.HCM',             '0300374753',  21000000.00,  2100000.00, 'active'),
(6, 'SUP-006', 'Công ty TNHH Zuellig Pharma Việt Nam',     'Nguyễn Thị Bích',   '02839204999', 'vn@zuelligpharma.com',   '93 Đường 3/2, Q.10, TP.HCM',                  '0301215987',  89000000.00,  0.00,       'active'),
(7, 'SUP-007', 'Công ty CP Y Dược Việt Nam YDUOCVN',       'Phan Văn Minh',      '024 35742222', 'info@yduocvn.com',       '12 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',       '0100230488',  45000000.00,  3200000.00, 'active'),
(8, 'SUP-008', 'Công ty TNHH Sanofi-Aventis Việt Nam',      'Trịnh Thu Thảo',    '028 39327788', 'vietnam@sanofi.com',     '10 Hàm Nghi, Q.1, TP.HCM',                    '0302234109', 112000000.00,  0.00,       'active');

-- =============================================================================
-- 3. LOCATIONS (Vị trí kho)
-- =============================================================================
INSERT IGNORE INTO locations (id, zone, cabinet, shelf, label, is_active) VALUES
(1,  'Rx Zone',        'Tủ Rx-1',         'Ngăn 1',       'Rx Zone / Tủ Rx-1 / Ngăn 1',           1),
(2,  'Rx Zone',        'Tủ Rx-1',         'Ngăn 2',       'Rx Zone / Tủ Rx-1 / Ngăn 2',           1),
(3,  'OTC Zone',       'Tủ OTC-1',        'Tầng trên',    'OTC Zone / Tủ OTC-1 / Tầng trên',      1),
(4,  'OTC Zone',       'Tủ OTC-1',        'Tầng giữa',    'OTC Zone / Tủ OTC-1 / Tầng giữa',      1),
(5,  'OTC Zone',       'Tủ OTC-2',        'Tầng trên',    'OTC Zone / Tủ OTC-2 / Tầng trên',      1),
(6,  'TPCN Zone',      'Tủ TPCN-1',       'Ngăn 1',       'TPCN Zone / Tủ TPCN-1 / Ngăn 1',      1),
(7,  'Kho Lạnh',       'Tủ Lạnh A',       'Ngăn trên',    'Kho Lạnh / Tủ Lạnh A / Ngăn trên',    1),
(8,  'OTC Zone',       'Quầy trưng bày',  'Kệ 1',         'OTC / Quầy trưng bày / Kệ 1',          1),
(9,  'Rx Zone',        'Tủ Rx-2',         'Ngăn 1',       'Rx Zone / Tủ Rx-2 / Ngăn 1',           1),
(10, 'TPCN Zone',      'Tủ TPCN-2',       'Ngăn 1',       'TPCN Zone / Tủ TPCN-2 / Ngăn 1',      1),
(11, 'OTC Zone',       'Tủ OTC-3',        'Tầng dưới',    'OTC Zone / Tủ OTC-3 / Tầng dưới',     1),
(12, 'Kho Lạnh',       'Tủ Lạnh B',       'Ngăn dưới',    'Kho Lạnh / Tủ Lạnh B / Ngăn dưới',   1);

-- =============================================================================
-- 4. BRANDS (Thương hiệu)
-- =============================================================================
INSERT IGNORE INTO brands (id, name, slug, logo_url, country, is_featured, is_active, sort_order) VALUES
(1,  'Abbott',          'abbott',           NULL, 'USA',          1, 1, 1),
(2,  'Sanofi',          'sanofi',           NULL, 'France',       1, 1, 2),
(3,  'DHG Pharma',      'dhg-pharma',       NULL, 'Vietnam',      1, 1, 3),
(4,  'Pymepharco',      'pymepharco',       NULL, 'Vietnam',      1, 1, 4),
(5,  'Blackmores',      'blackmores',       NULL, 'Australia',    1, 1, 5),
(6,  'GlaxoSmithKline', 'glaxosmithkline',  NULL, 'UK',           1, 1, 6),
(7,  'Traphaco',        'traphaco',         NULL, 'Vietnam',      1, 1, 7),
(8,  'AstraZeneca',     'astrazeneca',      NULL, 'UK',           1, 1, 8),
(9,  'Takeda',          'takeda',           NULL, 'Japan',        0, 1, 9),
(10, 'Novartis',        'novartis',         NULL, 'Switzerland',  0, 1, 10),
(11, 'Bayer',           'bayer',            NULL, 'Germany',      0, 1, 11),
(12, 'Roche',           'roche',            NULL, 'Switzerland',  0, 1, 12),
(13, 'Pfizer',          'pfizer',           NULL, 'USA',          0, 1, 13),
(14, 'Merap',           'merap',            NULL, 'Vietnam',      0, 1, 14),
(15, 'OPV',             'opv',              NULL, 'Vietnam',      0, 1, 15),
(16, 'Pharmedic',       'pharmedic',        NULL, 'Vietnam',      0, 1, 16),
(17, 'Bioderma',        'bioderma',         NULL, 'France',       0, 1, 17),
(18, 'La Roche-Posay',  'la-roche-posay',   NULL, 'France',       0, 1, 18),
(19, 'Vichy',           'vichy',            NULL, 'France',       0, 1, 19),
(20, 'Eucerin',         'eucerin',          NULL, 'Germany',      0, 1, 20);

-- =============================================================================
-- 5. NẠP SẢN PHẨM từ file cào (99_seed_trungson_real.sql)
-- =============================================================================
SOURCE /docker-entrypoint-initdb.d/99_seed_trungson_real.sql;

-- =============================================================================
-- 6. BATCHES (Phiếu nhập kho mẫu — dùng product_id từ dữ liệu cào)
-- =============================================================================
INSERT IGNORE INTO batches (id, batch_code, supplier_id, delivery_person, received_date, total_amount, paid_amount, status, notes, created_by) VALUES
(1, 'PO-260401-001', 1, 'Nguyễn Văn An',    '2026-04-01', 45000000.00, 45000000.00, 'completed', 'Nhập hàng tháng 4 - lô thuốc OTC',   1),
(2, 'PO-260401-002', 2, 'Lê Minh Phong',    '2026-04-01', 32000000.00, 20000000.00, 'completed', 'Nhập kháng sinh và vitamin tháng 4',  1),
(3, 'PO-260405-001', 3, 'Trần Thu Hiền',    '2026-04-05', 28000000.00, 28000000.00, 'completed', 'Nhập TPCN và thuốc bổ',               1),
(4, 'PO-260410-001', 6, 'Phạm Thị Lan',     '2026-04-10', 51000000.00,  0.00,       'completed', 'Nhập hàng nhập khẩu – AstraZeneca',   2),
(5, 'PO-260415-001', 8, 'Đinh Văn Hải',     '2026-04-15', 19500000.00, 19500000.00, 'completed', 'Nhập Sanofi – kháng sinh và huyết áp',2);

-- =============================================================================
-- 7. BATCH_ITEMS (Chi tiết lô hàng — tồn kho thực tế)
--    Chọn 30 sản phẩm đại diện từ dữ liệu cào (product id 1..30)
-- =============================================================================
INSERT IGNORE INTO batch_items (batch_id, product_id, lot_number, manufacture_date, expiry_date, quantity_received, quantity_remaining, cost_price, location_id, status) VALUES
-- Lô 1: OTC phổ biến
(1,  1,  'LOT-P001-A',  '2025-10-01', '2027-10-01',  200, 185, 122500.00, 3,  'available'),
(1,  2,  'LOT-P002-A',  '2025-11-01', '2027-11-01',  150, 140,   5950.00, 3,  'available'),
(1,  3,  'LOT-P003-A',  '2025-09-01', '2027-09-01',  100,  95, 203000.00, 2,  'available'),
(1,  4,  'LOT-P004-A',  '2026-01-01', '2028-01-01',   80,  75, 288400.00, 6,  'available'),
(1,  5,  'LOT-P005-A',  '2025-12-01', '2027-12-01',   60,  58, 556500.00, 6,  'available'),
-- Lô 2: kháng sinh, vitamin
(2,  6,  'LOT-P006-A',  '2026-02-01', '2028-02-01',  120, 115, 1085000.00,11, 'available'),
(2,  7,  'LOT-P007-A',  '2025-08-01', '2027-02-01',  200, 198,  472500.00, 3,  'available'),
(2,  8,  'LOT-P008-A',  '2026-01-01', '2028-01-01',   80,  78,   10500.00, 9,  'available'),
(2,  9,  'LOT-P009-A',  '2025-10-01', '2027-10-01',  100,  97, 103600.00, 6,  'available'),
(2, 10,  'LOT-P010-A',  '2026-03-01', '2028-03-01',   90,  89, 703892.00, 6,  'available'),
-- Lô 3: TPCN
(3, 11,  'LOT-P011-A',  '2025-11-01', '2027-11-01',  150, 148, 203000.00, 5,  'available'),
(3, 12,  'LOT-P012-A',  '2026-01-15', '2028-01-15',  100,  99, 203000.00, 5,  'available'),
(3, 13,  'LOT-P013-A',  '2025-09-01', '2027-09-01',   80,  78, 203000.00, 5,  'available'),
(3, 14,  'LOT-P014-A',  '2026-02-01', '2028-02-01',  120, 118,  65100.00, 3,  'available'),
(3, 15,  'LOT-P015-A',  '2025-10-01', '2027-10-01',   60,  59, 203000.00, 2,  'available'),
-- Lô 4: Nhập khẩu
(4, 16,  'LOT-P016-A',  '2025-12-01', '2027-12-01',   50,  49, 203000.00, 2,  'available'),
(4, 17,  'LOT-P017-A',  '2026-01-01', '2028-01-01',   80,  78,  18900.00, 8,  'available'),
(4, 18,  'LOT-P018-A',  '2025-11-01', '2027-11-01',  100,  97, 203000.00, 2,  'available'),
(4, 19,  'LOT-P019-A',  '2026-03-01', '2028-03-01',   60,  60, 980000.00, 6,  'available'),
(4, 20,  'LOT-P020-A',  '2026-01-01', '2028-01-01',   90,  88,  31500.00, 4,  'available'),
-- Lô 5: Sanofi
(5, 21,  'LOT-P021-A',  '2026-02-01', '2028-02-01',  200, 199,  31500.00, 4,  'available'),
(5, 22,  'LOT-P022-A',  '2025-10-01', '2027-10-01',  100,  98, 203000.00, 2,  'available'),
(5, 23,  'LOT-P023-A',  '2026-01-01', '2028-01-01',   60,  60,  32900.00, 7,  'available'),
(5, 24,  'LOT-P024-A',  '2026-02-01', '2028-02-01',   50,  50, 309400.00, 6,  'available'),
(5, 25,  'LOT-P025-A',  '2025-09-01', '2027-09-01',   80,  79,   4900.00, 8,  'available');

-- =============================================================================
-- 8. STOCK_MOVEMENTS (Lịch sử nhập/xuất kho mẫu)
-- =============================================================================
INSERT IGNORE INTO stock_movements (movement_code, batch_item_id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by) VALUES
('PO-260401-001', 1,  1,  'inbound',       200, 'purchase_order', 1, NULL, 1),
('PO-260401-001', 2,  2,  'inbound',       150, 'purchase_order', 1, NULL, 1),
('PO-260401-001', 3,  3,  'inbound',       100, 'purchase_order', 1, NULL, 1),
('PO-260401-001', 4,  4,  'inbound',        80, 'purchase_order', 1, NULL, 1),
('PO-260401-001', 5,  5,  'inbound',        60, 'purchase_order', 1, NULL, 1),
('PO-260401-002', 6,  6,  'inbound',       120, 'purchase_order', 2, NULL, 1),
('PO-260401-002', 7,  7,  'inbound',       200, 'purchase_order', 2, NULL, 1),
('PO-260401-002', 8,  8,  'inbound',        80, 'purchase_order', 2, NULL, 1),
('PO-260405-001', 11, 11, 'inbound',       150, 'purchase_order', 3, NULL, 1),
('PO-260405-001', 12, 12, 'inbound',       100, 'purchase_order', 3, NULL, 1),
-- Xuất bán mẫu
('OUT-260402-001', 1,  1, 'outbound_sale', -15, 'pos_order',      1, NULL, 3),
('OUT-260402-002', 2,  2, 'outbound_sale', -10, 'pos_order',      2, NULL, 3),
('OUT-260403-001', 7,  7, 'outbound_sale', -2,  'web_order',      1, NULL, 3),
('OUT-260403-002', 9,  9, 'outbound_sale', -3,  'pos_order',      3, NULL, 3),
('OUT-260404-001', 20, 20,'outbound_sale', -1,  'pos_order',      4, NULL, 3);

SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ Đã nạp đầy đủ dữ liệu cho mg_catalog!' AS status;
SELECT COUNT(*) AS tong_san_pham FROM products;
SELECT COUNT(*) AS tong_lo_hang FROM batch_items;
SELECT COUNT(*) AS tong_nha_cung_cap FROM suppliers;
