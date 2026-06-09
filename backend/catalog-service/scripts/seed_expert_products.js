const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * EXPERT PHARMACIST PRODUCT SEEDER v2.0
 * ======================================
 * Bộ từ điển phân loại sản phẩm cực kỳ chi tiết
 * Sử dụng kiến thức dược lý chuyên sâu để mapping chính xác
 * 
 * Chiến lược phân loại (theo thứ tự ưu tiên):
 * 1. Hoạt chất (Active Ingredient) - Chính xác nhất
 * 2. Tên sản phẩm - Keyword matching
 * 3. Mô tả sản phẩm - Fallback
 * 4. Nhà sản xuất / Thương hiệu - Cuối cùng
 */

// =====================================================================
// BỘ TỪ ĐIỂN PHÂN LOẠI DƯỢC LÝ CHUYÊN SÂU
// Mỗi rule gồm: categoryId, keywords (tất cả lowercase)
// Rules được sắp xếp từ CỤ THỂ đến CHUNG để tránh phân loại sai
// =====================================================================

const CLASSIFICATION_RULES = [
  // ====================================================================
  // PRIORITY RULES - Brand/Product overrides (xử lý trước tất cả)
  // Các sản phẩm có hoạt chất đa nghĩa cần match tên thương hiệu trước
  // ====================================================================
  { id: 1101, _priority: true, keywords: ['gaviscon'] },
  { id: 4404, _priority: true, keywords: ['kotex', 'diana băng', 'laurier'] },
  { id: 2604, _priority: true, keywords: ['welson for men', 'rocket 1h', 'alipas', 'testovim', 'adamfor'] },
  { id: 2801, _priority: true, keywords: ['bewel heal', 'jex natural', 'hoàng thống phong'] },
  { id: 2602, _priority: true, keywords: ['sâm angela', 'bảo xuân', 'thiên nữ vương', 'dim for her', 'evening primrose'] },
  { id: 2031, _priority: true, keywords: ['green bird', 'kẹo hồng sâm'] },
  { id: 4302, _priority: true, keywords: ['playmore', 'kẹo xí muội', 'kẹo chanh muối', 'kẹo himalaya'] },
  { id: 2905, _priority: true, keywords: ['pulmoll', 'zecuf herbal'] },
  { id: 1503, _priority: true, keywords: ['upkid', 'pediakid', 'fitobimbi'] },
  { id: 4104, _priority: true, keywords: ['hi-kids', 'xịt chống sâu răng'] },
  { id: 3104, _priority: true, keywords: ['ezerra cream', 'bioderma atoderm', 'saforelle'] },
  { id: 3601, _priority: true, keywords: ['bioderma sensibio'] },
  { id: 6302, _priority: true, keywords: ['b.well', 'máy xông mũi'] },
  { id: 6104, _priority: true, keywords: ['medismart', 'que thử đường huyết'] },
  { id: 6303, _priority: true, keywords: ['đai lưng pro', 'bonbone', 'bó gối', 'nẹp chống xoay', 'túi treo tay'] },
  { id: 6401, _priority: true, keywords: ['dây truyền dịch', 'dây thông tiểu', 'kim tiêm tiểu đường', 'omnican'] },
  { id: 6403, _priority: true, keywords: ['dụng cụ nghiền thuốc', 'dụng cụ cắt thuốc', 'hộp phân liều', 'phân liều thuốc'] },
  { id: 4402, _priority: true, keywords: ['khăn ướt mamamy', 'khăn giấy ướt trung sơn'] },
  { id: 3106, _priority: true, keywords: ['mặt nạ đất sét', 'mặt nạ bùn non', 'avander'] }, // Mặt nạ
  { id: 3401, _priority: true, keywords: ['fixderma lip', 'son dưỡng'] }, // Son dưỡng môi
  { id: 3205, _priority: true, keywords: ['vaseline'] }, // Dưỡng da tay chân

  // --- Nhóm Vitamin & Khoáng chất TPCN (Ưu tiên hiển thị Menu) ---
  { id: 2101, _priority: true, keywords: ['tpbvsk vitamin b', 'hỗ trợ vitamin b', 'bổ sung vitamin b', 'magne-b6', 'magne b6'] },
  { id: 2102, _priority: true, keywords: ['vitamin c', 'sủi c', 'tpbvsk vitamin c', 'viên sủi vitamin c'] },
  { id: 2103, _priority: true, keywords: ['tpbvsk canxi', 'tpbvsk calcium', 'bổ sung canxi', 'calciumboston', 'cancium'] },
  { id: 2104, _priority: true, keywords: ['vitamin e 400', 'enat 400', 'tpbvsk vitamin e'] },
  { id: 2105, _priority: true, keywords: ['berocca', 'bổ sung vitamin tổng hợp', 'vitamin tổng hợp tpcn', 'multivitamin tpcn', 'enervon viên'] },
  { id: 2106, _priority: true, keywords: ['tpbvsk kẽm', 'tpbvsk magnesi', 'zinc tpcn', 'magnesium tpcn'] },


  // ====================================================================
  // NHÓM 1: THUỐC (1000) 
  // ====================================================================

  // --- 1.1 Thuốc dạ dày - tiêu hoá - gan mật (1100) ---
  // 1101: Thuốc dạ dày
  { id: 1101, keywords: ['omeprazol', 'esomeprazol', 'pantoprazol', 'rabeprazol', 'lansoprazol', 'ranitidine', 'famotidine', 'cimetidine', 'sucralfate', 'gaviscon', 'phosphalugel', 'yumangel', 'gastropulgite', 'maalox', 'nexium', 'pantoloc', 'nolpaza', 'pariet', 'emanera', 'baromezole', 'meyerpanzol', 'prazopro', 'viêm thực quản trào ngược', 'loét dạ dày', 'loét tá tràng', 'trào ngược dạ dày', 'bơm proton', 'ức chế bơm proton', 'thuốc dạ dày', 'viêm loét dạ dày', 'zollinger'] },
  // 1102: Thuốc đầy hơi, buồn nôn  
  { id: 1102, keywords: ['domperidone', 'motilium', 'simethicone', 'metoclopramide', 'ondansetron', 'trimebutin', 'agitritine', 'đầy hơi', 'buồn nôn', 'khó tiêu', 'chống nôn', 'chống buồn nôn', 'co thắt dạ dày', 'hội chứng ruột kích thích'] },
  // 1103: Men tiêu hoá - vi sinh
  { id: 1103, keywords: ['men tiêu hoá', 'enterogermina', 'biogaia', 'probiotics', 'probio', 'lactomin', 'bioflora', 'smecta', 'diosmectite', 'lactobacillus', 'men vi sinh', 'vi khuẩn có lợi', 'hệ vi sinh', 'rối loạn tiêu hóa do loạn khuẩn', 'enzyme tiêu hóa', 'dizzo', 'fungal diastase', 'papain'] },
  // 1104: Thuốc nhuận tràng - trị táo bón
  { id: 1104, keywords: ['bisacodyl', 'ovalax', 'duphalac', 'lactulose', 'sorbitol', 'macrogol', 'forlax', 'natri picosulfat', 'nhuận tràng', 'trị táo bón', 'điều trị táo bón', 'làm sạch ruột', 'táo bón'] },
  // 1105: Thuốc trị tiêu chảy
  { id: 1105, keywords: ['loperamide', 'hydrasec', 'racecadotril', 'berberin', 'trị tiêu chảy', 'thuốc tiêu chảy', 'điều trị tiêu chảy', 'chống tiêu chảy'] },
  // 1106: Thuốc trị bệnh gan - mật
  { id: 1106, keywords: ['silymarin', 'arginin', 'boganic', 'hepa', 'hepatyca', 'livolin', 'cigenol', 'lubirine', 'ornithine', 'aspartate', 'cardus marianus', 'bổ gan', 'gan mật', 'gan nhiễm mỡ', 'xơ gan', 'chức năng gan', 'bảo vệ gan', 'giải độc gan', 'tăng amoni huyết', 'thuốc gan'] },

  // --- 1.2 Thuốc cảm - ho - hô hấp (1200) ---
  // 1201: Thuốc cảm
  { id: 1201, keywords: ['tiffy', 'decolgen', 'ameflu', 'coldacmin', 'rhumenol', 'neozep', 'cảm cúm', 'thuốc cảm', 'giải cảm', 'triệu chứng cảm', 'cảm lạnh'] },
  // 1202: Thuốc ho - long đờm
  { id: 1202, keywords: ['ambroxol', 'bromhexin', 'acetylcystein', 'acemuc', 'prospan', 'guaifenesin', 'dextromethorphan', 'terbutaline', 'carbocisteine', 'thuốc ho', 'siro ho', 'long đờm', 'tiêu đờm', 'thuốc ho khan', 'giảm ho', 'ho có đờm', 'thuốc trị ho'] },
  // 1203: Thuốc trị hen suyễn - COPD
  { id: 1203, keywords: ['budesonide', 'formoterol', 'symbicort', 'salbutamol', 'ventolin', 'seretide', 'salmeterol', 'fluticasone', 'montelukast', 'singulair', 'ipratropium', 'theophylline', 'bambuterol', 'hen suyễn', 'hen phế quản', 'copd', 'phổi tắc nghẽn', 'viêm phế quản mạn', 'giãn phế quản'] },

  // --- 1.3 Thuốc giảm đau - kháng viêm - hạ sốt (1300) ---
  // 1301: Thuốc giảm đau - hạ sốt
  { id: 1301, keywords: ['paracetamol', 'acetaminophen', 'hapacol', 'panadol', 'efferalgan', 'mexcold', 'tylenol', 'doliprane', 'giảm đau', 'hạ sốt', 'đau đầu', 'đau răng', 'đau bụng kinh', 'nhức đầu'] },
  // 1303: Thuốc chống viêm NSAIDs
  { id: 1303, keywords: ['diclofenac', 'celecoxib', 'meloxicam', 'mobic', 'voltaren', 'ibuprofen', 'piroxicam', 'naproxen', 'indomethacin', 'ketoprofen', 'etoricoxib', 'arcoxia', 'etodolac', 'elacox', 'nsaid', 'chống viêm không steroid', 'kháng viêm'] },
  // 1302: Thuốc giảm đau xương khớp (xử lý sau NSAIDs)
  { id: 1302, keywords: ['glucosamine', 'aussamin', 'artrodar', 'chondroitin', 'diacerein', 'glucosamin', 'giảm đau xương khớp', 'thoái hóa khớp', 'bổ khớp'] },

  // --- 1.4 Thuốc tim mạch - huyết áp - mạch máu (1400) ---
  // 1401: Thuốc huyết áp
  { id: 1401, keywords: ['amlodipine', 'perindopril', 'coversyl', 'losartan', 'telmisartan', 'valsartan', 'irbesartan', 'enalapril', 'enap', 'lisinopril', 'captopril', 'nifedipine', 'felodipine', 'bisoprolol', 'atenolol', 'metoprolol', 'carvedilol', 'nebivolol', 'hydrochlorothiazide', 'indapamide', 'furosemide', 'spironolactone', 'candesartan', 'olmesartan', 'alfuzosin', 'xatral', 'huyết áp', 'tăng huyết áp', 'điều trị tăng huyết áp', 'lợi tiểu', 'chẹn kênh canxi', 'ức chế ace', 'thuốc hạ áp'] },
  // 1402: Thuốc tim mạch
  { id: 1402, keywords: ['trimetazidine', 'vaspycar', 'vastarel', 'digoxin', 'nicorandil', 'nicomen', 'ivabradine', 'procoralan', 'isosorbide', 'nitroglycerin', 'amiodarone', 'propafenone', 'tim mạch', 'đau thắt ngực', 'suy tim', 'thiếu máu cơ tim', 'rối loạn nhịp tim'] },
  // 1403: Thuốc mỡ máu - Cholesterol
  { id: 1403, keywords: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'lipitor', 'crestor', 'fenofibrate', 'gemfibrozil', 'ezetimibe', 'mỡ máu', 'cholesterol', 'statin', 'hạ lipid', 'rối loạn lipid'] },
  // 1404: Thuốc cầm máu - Chống đông
  { id: 1404, keywords: ['warfarin', 'clopidogrel', 'plavix', 'rivaroxaban', 'dabigatran', 'enoxaparin', 'heparin', 'cầm máu', 'chống đông', 'chống kết tập tiểu cầu', 'kháng đông', 'phòng huyết khối', 'aspirin 81'] },
  // 1405: Thuốc trị thiếu máu (bổ máu, sắt)
  { id: 1405, keywords: ['tardyferon', 'ferrous', 'fumarat', 'acid folic', 'folic acid', 'sắt', 'bổ máu', 'thiếu sắt', 'thiếu máu', 'bổ sung sắt', 'erythropoietin'] },
  // 1406: Thuốc tăng tuần hoàn não
  { id: 1406, keywords: ['piracetam', 'pidoncam', 'citicoline', 'vinpocetine', 'ginkgo biloba', 'tanakan', 'tuần hoàn não', 'hoạt huyết', 'thiếu máu não', 'suy giảm trí nhớ', 'chóng mặt', 'galantamine', 'monine', 'donepezil', 'aricept', 'alzheimer', 'sa sút trí tuệ'] },

  // --- 1.5 Thuốc bổ - vitamin - dinh dưỡng (1500) ---
  // 1501: Thuốc bổ - Vitamin (Dành cho các hoạt chất đặc thù thuốc chưa vào 21xx)
  { id: 1501, keywords: ['thiamin', 'pyridoxine', 'cyanocobalamin', 'vitamin pp', 'alpha chymotrypsin', 'alphachymotrypsin', 'thiếu vitamin', 'magne-b6', 'maxizorb e'] },
  // 1502: Thuốc bổ xương khớp, canxi (Dành cho biệt dược đặc trị)
  { id: 1502, keywords: ['calcium corbiere', 'ostelin', 'alendronic', 'alendronate', 'risedronate', 'zoledronic', 'ibandronic', 'aronatboston', 'maxlen', 'residron', 'jointmeno', 'aclasta', 'loãng xương', 'dự phòng loãng xương', 'bổ xương', 'phòng loãng xương'] },
  // 1503: Siro bổ trẻ em
  { id: 1503, keywords: ['pediakid', 'siro bổ', 'siro atisyrup', 'kiện nhi', 'trẻ biếng ăn', 'bé biếng ăn', 'upkid', 'fitobimbi'] },
  // 1504: Thuốc tăng cường đề kháng
  { id: 1504, keywords: ['thymomodulin', 'imunoglukan', 'tăng đề kháng', 'tăng miễn dịch'] },
  // 1505: Thuốc bù điện giải
  { id: 1505, keywords: ['oresol', 'bù điện giải', 'bù nước điện giải'] },

  // --- 1.6 Thuốc kháng sinh - kháng virus - kháng nấm (1600) ---
  // 1601: Thuốc kháng sinh
  { id: 1601, keywords: ['amoxicillin', 'cefadroxil', 'cefuroxime', 'zinnat', 'haginat', 'augmentin', 'clarithromycin', 'azithromycin', 'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'metronidazol', 'clindamycin', 'clindastad', 'doxycycline', 'gentamicin', 'erythromycin', 'rifampicin', 'agifamcin', 'oxacilin', 'euvioxcin', 'cephalexin', 'cefixime', 'ceftriaxone', 'piperacillin', 'meropenem', 'imipenem', 'pimenem', 'kháng sinh', 'nhiễm khuẩn', 'điều trị nhiễm khuẩn'] },
  // 1602: Thuốc kháng virus
  { id: 1602, keywords: ['acyclovir', 'valacyclovir', 'tamiflu', 'oseltamivir', 'entecavir', 'tenofovir', 'kháng virus', 'viêm gan b mạn', 'viêm gan b'] },
  // 1603: Thuốc kháng nấm
  { id: 1603, keywords: ['itraconazole', 'fluconazole', 'ketoconazole', 'ketoconazol', 'ketovazol', 'clotrimazole', 'calcrem', 'terbinafine', 'nystatin', 'kháng nấm', 'trị nấm', 'nấm da', 'nấm ngoài da', 'trị các bệnh nấm'] },
  // 1604: Thuốc trị giun sán
  { id: 1604, keywords: ['mebendazole', 'fugacar', 'zentel', 'albendazole', 'pyrantel', 'giun sán', 'tẩy giun'] },

  // --- 1.7 Thuốc da liễu (1700) ---
  // 1701: Thuốc bôi trị mụn
  { id: 1701, keywords: ['adapalene', 'klenzit', 'megaduo', 'derma forte', 'tretinoin', 'benzoyl peroxide', 'oxy 5', 'oxy 10', 'acnes medical', 'trị mụn', 'mụn trứng cá', 'mụn bọc', 'mụn sưng đỏ', 'bôi trị mụn', 'trị mụn bọc', 'điều trị mụn', 'gel bôi mụn', 'kem trị mụn', 'hiteen phil'] },
  // 1702: Thuốc bôi trị sẹo
  { id: 1702, keywords: ['scargel', 'dermatix', 'hiruscar', 'contractubex', 'trị sẹo', 'mờ sẹo', 'liền sẹo', 'somaderm', 'miếng dán mụn'] },
  // 1703: Thuốc trị nấm da (-> redirect to 1603 nếu là thuốc, hoặc giữ nếu kem bôi da liễu)
  { id: 1703, keywords: ['thuốc trị nấm da'] },
  // 1704: Thuốc khử trùng, sát khuẩn
  { id: 1704, keywords: ['povidone-iodine', 'povidine', 'chlorhexidine', 'betadine', 'cồn 70', 'cồn 90', 'cồn y tế', 'alcool 70', 'alcool 90', 'ethanol', 'nano bạc', 'sát trùng', 'sát khuẩn', 'khử trùng ngoài da', 'rửa vết thương', 'súc miệng sát khuẩn', 'medoral', 'gel healit', 'làm lành vết thương'] },
  // 1706: Trị bệnh da liễu
  { id: 1706, keywords: ['prednison', 'prednisolon', 'dexamethasone', 'hydrocortisone', 'corticoid', 'sodermix', 'viêm da cơ địa', 'chàm sữa', 'ghẻ ngứa', 'diethyl phtalat', 'thuốc mỡ d.e.p', 'biafine', 'phỏng', 'vết thương ngoài da', 'levigatus'] },

  // --- 1.8 Thuốc thần kinh - giấc ngủ - tâm thần (1800) ---
  // 1801: Thuốc an thần, chống lo âu - Ngủ ngon
  { id: 1801, keywords: ['rotunda', 'seduxen', 'diazepam', 'alprazolam', 'lorazepam', 'zolpidem', 'an thần', 'ngủ ngon', 'mất ngủ', 'chống lo âu'] },
  // 1802: Thuốc bổ não
  { id: 1802, keywords: ['thuốc bổ não', 'dasbrain', 'omega 3 não', 'dha não', 'sáng mắt traphaco', 'mỏi mắt', 'tobicom'] },
  // 1804: Thuốc trị trầm cảm
  { id: 1804, keywords: ['paroxetine', 'parokey', 'tianeptine', 'stablon', 'mirtazapine', 'mirzaten', 'sertraline', 'fluoxetine', 'escitalopram', 'venlafaxine', 'duloxetine', 'trầm cảm', 'chống trầm cảm', 'rối loạn ám ảnh cưỡng bức'] },
  // 1805: Thuốc chống co giật / động kinh
  { id: 1805, keywords: ['valproat', 'dalekine', 'carbamazepine', 'tegretol', 'levetiracetam', 'levetstad', 'phenytoin', 'gabapentin', 'epigaba', 'pregabalin', 'topiramate', 'lamotrigine', 'động kinh', 'co giật', 'chống co giật', 'chống động kinh'] },
  // 1806: Thuốc điều trị Parkinson / sa sút trí tuệ khác
  { id: 1806, keywords: ['levodopa', 'carbidopa', 'selegiline', 'rasagiline', 'parkinson', 'memantine'] },

  // --- 1.9 Thuốc nội tiết - hormone - sinh dục (1900) ---
  // 1901: Thuốc phụ khoa
  { id: 1901, keywords: ['polygynax', 'canesten', 'tergynan', 'gynecosid', 'đặt âm đạo', 'phụ khoa', 'viêm âm đạo', 'visanne', 'dienogest', 'lạc nội mạc tử cung'] },
  // 1903: Thuốc điều hoà kinh nguyệt
  { id: 1903, keywords: ['thuốc điều hoà kinh', 'điều hòa kinh nguyệt', 'rối loạn kinh nguyệt', 'estradiol', 'valiera'] },
  // 1904: Thuốc tránh thai
  { id: 1904, keywords: ['rigevidon', 'postinor', 'new choice', 'tránh thai', 'tránh thai khẩn cấp', 'levonorgestrel'] },
  // 1905: Thuốc rối loạn cương dương - Tiền liệt
  { id: 1905, keywords: ['sildenafil', 'viagra', 'tadalafil', 'cialis', 'rối loạn cương', 'cường dương', 'permixon', 'tuyến tiền liệt', 'phì đại tiền liệt'] },
  // 1906: Thuốc trị bệnh tuyến giáp
  { id: 1906, keywords: ['levothyroxine', 'disthyrox', 'berlthyrox', 'methimazole', 'thyrozol', 'propylthiouracil', 'basethyrox', 'tuyến giáp', 'suy giáp', 'cường giáp', 'thiểu năng tuyến giáp', 'tăng năng tuyến giáp'] },

  // --- 1.10 Thuốc xương khớp - gout - cơ xương (1010) ---
  // 1011: Thuốc viêm khớp - Thoái hoá
  { id: 1011, keywords: ['viêm khớp', 'thoái hoá khớp', 'khô khớp', 'viêm khớp dạng thấp', 'glupain', 'thuốc khớp'] },
  // 1012: Thuốc trị gout
  { id: 1012, keywords: ['colchicine', 'allopurinol', 'zyloric', 'febuxostat', 'gout', 'acid uric', 'tăng acid uric'] },
  // 1013: Thuốc giãn cơ
  { id: 1013, keywords: ['methocarbamol', 'mycotrova', 'eperisone', 'waisan', 'strecalis', 'thiocolchicoside', 'giãn cơ', 'co thắt cơ', 'tăng trương lực cơ', 'bong gân'] },

  // --- 1.11 Thuốc mắt - tai - mũi - họng (1020) ---
  // 1021: Thuốc nhỏ mắt, tra mắt
  { id: 1021, keywords: ['natri hyaluronat', 'v.rohto', 'rohto', 'tobrex', 'tobramycin', 'vitol ', 'osla', 'nhỏ mắt', 'tra mắt', 'khô mắt', 'nhỏ mắt', 'nước mắt nhân tạo', 'rửa mắt', 'eyemiru'] },
  // 1023: Thuốc sổ mũi - xịt mũi - viêm xoang
  { id: 1023, keywords: ['otrivin', 'xisat', 'coldi-b', 'xylometazoline', 'oxymetazoline', 'naphazoline', 'fluticasone mũi', 'xịt mũi', 'sổ mũi', 'viêm xoang', 'rửa mũi', 'nghẹt mũi', 'thuốc nhỏ mũi'] },
  // 1024: Viên ngậm - xịt họng - viêm họng
  { id: 1024, keywords: ['strepsils', 'dorithricin', 'eugica', 'dichlorobenzyl', 'amylmetacresol', 'viên ngậm', 'xịt họng', 'viêm họng', 'đau họng', 'dịu họng', 'viêm amidan', 'viacol', 'kamistad', 'lidocaine miệng', 'niêm mạc miệng'] },
  // 1025: Thuốc xúc miệng, bôi răng miệng
  { id: 1025, keywords: ['nước súc miệng thuốc', 'súc họng', 'betadine gargle'] },

  // --- 1.12 Thuốc tiểu đường (1030) ---
  // 1031: Thuốc tiểu đường - đái tháo đường
  { id: 1031, keywords: ['metformin', 'metglu', 'glimepiride', 'diamicron', 'gliclazide', 'glibenclamide', 'sitagliptin', 'januvia', 'empagliflozin', 'jardiance', 'dapagliflozin', 'forxiga', 'insulin', 'acarbose', 'pioglitazone', 'tiểu đường', 'đái tháo đường', 'đường huyết', 'hạ đường huyết'] },

  // --- 1.13 Thuốc tiêm - truyền dịch (1040) ---
  // 1041: Thuốc tiêm
  { id: 1041, keywords: ['lidocain tiêm', 'lidocaine tiêm', 'dung dịch tiêm', 'thuốc tiêm', 'gây tê tại chỗ'] },
  // 1042: Dịch truyền - bù nước điện giải
  { id: 1042, keywords: ['dịch truyền', 'natri clorid 0,9', 'natri clorid 0.9', 'glucose 5%', 'ringer lactat', 'smoflipid', 'periolimel', 'tiêm truyền', 'truyền tĩnh mạch', 'dinh dưỡng đường tĩnh mạch'] },

  // --- 1.14 Thuốc dị ứng - say tàu xe (1050) ---
  // 1051: Thuốc chống dị ứng
  { id: 1051, keywords: ['loratadine', 'cetirizine', 'levocetirizine', 'xyzal', 'desloratadin', 'deslora', 'fexofenadine', 'fatelmed', 'ebastine', 'meyerbastin', 'bilastine', 'timbivo', 'clanoz', 'lonitez', 'alimemazin', 'theratussin', 'cyproheptadin', 'peritol', 'kháng histamin', 'dị ứng', 'viêm mũi dị ứng', 'mày đay', 'mề đay', 'chống dị ứng', 'thuốc dị ứng'] },
  // 1052: Thuốc say tàu xe
  { id: 1052, keywords: ['dimenhydrinate', 'say tàu xe', 'say xe', 'chống say xe'] },

  // --- 1.15 Thuốc ung thư (1070) ---
  // 1071: Thuốc điều trị ung thư
  { id: 1071, keywords: ['anastrozole', 'arimidex', 'letrozole', 'femara', 'tamoxifen', 'doxorubicin', 'cisplatin', 'cyclophosphamide', 'methotrexate', 'imatinib', 'ung thư', 'điều trị ung thư', 'ung thư vú'] },
  // 1073: Thuốc điều trị bệnh tự miễn / corticoid
  { id: 1073, keywords: ['prednisone', 'prednisolone', 'methylprednisolone', 'thuốc bệnh tự miễn', 'ức chế miễn dịch', 'lupus'] },

  // --- Thuốc chuyên khoa khác ---
  // Thuốc suy tĩnh mạch / trĩ -> 1000 (Thuốc chung)
  { id: 1402, keywords: ['diosmin', 'hesperidin', 'apidimin', 'flaben', 'hesmin', 'hemoral', 'suy tĩnh mạch', 'trĩ cấp', 'mạch bạch huyết'] },
  // Thuốc tâm thần phân liệt
  { id: 1801, keywords: ['risperidone', 'risperdal', 'quetiapine', 'olanzapine', 'haloperidol', 'tâm thần phân liệt'] },
  // Thuốc nhược cơ
  { id: 1501, keywords: ['pyridostigmin', 'meshannon', 'nhược cơ', 'tắt ruột do liệt'] },
  // Thuốc phù nề
  { id: 1303, keywords: ['alpha chymotrypsin', 'alphachymotrypsin', 'phù nề sau chấn thương'] },


  // ====================================================================
  // NHÓM 2: THỰC PHẨM CHỨC NĂNG (2000)
  // ====================================================================
  // 2101: Vitamin nhóm B
  { id: 2101, keywords: ['tpbvsk vitamin b', 'hỗ trợ vitamin b'] },
  // 2102: Vitamin C (TPCN)
  { id: 2102, keywords: ['tpbvsk vitamin c', 'viên sủi vitamin c'] },
  // 2103: Canxi và vitamin D (TPCN)
  { id: 2103, keywords: ['tpbvsk canxi', 'tpbvsk calcium', 'bổ sung canxi'] },
  // 2105: Vitamin tổng hợp (TPCN)
  { id: 2105, keywords: ['berocca', 'viên sủi bổ sung', 'bổ sung vitamin tổng hợp'] },
  // 2204: Men vi sinh (TPCN)
  { id: 2204, keywords: ['tpbvsk biogaia', 'optibac', 'bioflor'] },
  // 2301: Hỗ trợ chức năng gan (TPCN)
  { id: 2301, keywords: ['tpbvsk gan', 'hỗ trợ chức năng gan', 'giải độc gan tpcn'] },
  // 2401: Hỗ trợ trí não (TPCN)
  { id: 2401, keywords: ['hỗ trợ trí não', 'cải thiện trí nhớ', 'bổ não tpcn'] },
  // 2403: Hỗ trợ giấc ngủ (TPCN)
  { id: 2403, keywords: ['hỗ trợ giấc ngủ', 'ngủ ngon tpcn'] },
  // 2404: Hỗ trợ tuần hoàn máu (TPCN)
  { id: 2404, keywords: ['nattoenzym', 'nattokinase', 'hỗ trợ tuần hoàn', 'ngăn huyết khối', 'phòng đột quỵ'] },
  // 2501: Hỗ trợ cholesterol / mỡ máu (TPCN)
  { id: 2501, keywords: ['hỗ trợ cholesterol', 'giảm mỡ máu tpcn'] },
  // 2601: Bổ thận, tiết niệu (TPCN)
  { id: 2601, keywords: ['tpbvsk thận', 'bổ thận', 'kim tiền thảo', 'sỏi thận', 'sỏi tiết niệu', 'lợi tiểu tpcn'] },
  // 2602: Sinh lý nữ (TPCN)
  { id: 2602, keywords: ['sâm angela', 'bảo xuân', 'sinh lý nữ', 'nội tiết tố nữ', 'cân bằng nội tiết nữ', 'dim for her', 'thiên nữ vương', 'evening primrose', 'hoa anh thảo', 'tiền mãn kinh', 'mãn kinh'] },
  // 2603: Hỗ trợ mãn kinh
  { id: 2603, keywords: ['triệu chứng mãn kinh', 'opcrilati', 'trinh nữ hoàng cung', 'u xơ tử cung'] },
  // 2604: Sinh lý nam (TPCN)
  { id: 2604, keywords: ['rocket 1h', 'alipas', 'welson for men', 'sinh lý nam', 'testosterone', 'maca', 'tráng dương', 'bổ thận tráng dương', 'testovim', 'adamfor'] },
  // 2701: Kiểm soát cân nặng (TPCN)
  { id: 2701, keywords: ['giảm cân', 'trà giảm cân', 'kiểm soát cân nặng'] },
  // 2703: Chăm sóc da (TPCN)
  { id: 2703, keywords: ['collagen nucos', 'collagen uống', 'be white', 'đẹp da uống', 'chống lão hóa uống', 'beauty gsv'] },
  // 2704: Chăm sóc tóc (TPCN)
  { id: 2704, keywords: ['qik hair', 'giảm rụng tóc uống', 'mọc tóc uống'] },
  // 2801: Xương khớp tổng hợp (TPCN)
  { id: 2801, keywords: ['jex', 'bewel heal', 'glucosamine tpcn', 'tpbvsk xương khớp', 'hỗ trợ xương khớp', 'hoàng thống phong', 'thoái hóa khớp tpcn', 'chất nhờn cho khớp'] },
  // 2901: Bổ phế, hô hấp (TPCN)
  { id: 2901, keywords: ['bổ phế', 'hỗ trợ phổi', 'hô hấp tpcn'] },
  // 2905: Kẹo ngậm giảm ho (TPCN)
  { id: 2905, keywords: ['pulmoll', 'kẹo ngậm ho', 'kẹo ho', 'giảm ho kẹo', 'dịu họng kẹo', 'zecuf herbal'] },
  // 2012: Hỗ trợ đường huyết (TPCN)
  { id: 2012, keywords: ['hỗ trợ đường huyết', 'hỗ trợ tiểu đường tpcn', 'đường ăn kiêng', 'huxol', 'equal stevia', 'tạo ngọt ít năng lượng'] },
  // 2014: Hỗ trợ trĩ (TPCN)
  { id: 2014, keywords: ['hỗ trợ trĩ tpcn'] },
  // 2021: Tăng cường đề kháng (TPCN)
  { id: 2021, keywords: ['tăng cường đề kháng tpcn', 'bio squalene', 'squalene', 'vitatree'] },
  // 2025: Hỗ trợ mắt & thị lực (TPCN)
  { id: 2025, keywords: ['bổ mắt tpcn', 'mediusa eye', 'vitahealth eye', 'advanced eyecare', 'dưỡng mắt khỏe', 'giảm mỏi mắt uống'] },
  // 2031: Nhân sâm, yến sào (TPCN)
  { id: 2031, keywords: ['nhân sâm', 'đông trùng hạ thảo', 'linh chi', 'yến sào', 'hồng sâm', 'green bird', 'nước yến', 'kẹo hồng sâm'] },
  // 2033: Thảo dược khác (TPCN)
  { id: 2033, keywords: ['mật ong nghệ', 'bột nước mát', 'thanh nhiệt', 'trà gừng', 'thảo dược', 'hòa hãn linh', 'ra mồ hôi nhiều'] },

  // ====================================================================
  // NHÓM 3: DƯỢC MỸ PHẨM (3000)
  // ====================================================================
  // 3101: Sữa rửa mặt
  { id: 3101, keywords: ['sữa rửa mặt', 'cleanser', 'cetaphil gentle', 'cerave foaming', 'rửa mặt'] },
  // 3103: Serum & Tinh chất
  { id: 3103, keywords: ['serum', 'tinh chất dưỡng', 'tinh chất kiều xuân'] },
  // 3104: Kem dưỡng ẩm
  { id: 3104, keywords: ['kem dưỡng ẩm', 'kem dưỡng da', 'ezerra cream', 'bioderma atoderm', 'saforelle', 'dưỡng ẩm', 'moisturise', 'moisturising cream', 'nourishing cream', 'làm mềm da'] },
  // 3105: Kem, xịt chống nắng
  { id: 3105, keywords: ['chống nắng', 'sunscreen', 'spf', 'la roche-posay', 'anessa', 'neotone radiance'] },
  // 3106: Mặt nạ dưỡng da
  { id: 3106, keywords: ['mặt nạ', 'mặt nạ đất sét', 'mặt nạ bùn non', 'avander'] },
  // 3201: Sữa tắm (Dược mỹ phẩm)
  { id: 3201, keywords: ['sữa tắm', 'clinxy', 'tắm vệ sinh khô', 'gel tắm'] },
  // 3203: Lăn khử mùi
  { id: 3203, keywords: ['lăn khử mùi', 'aquaselin', 'khử mùi nách'] },
  // 3301: Dầu gội & xả (DMỸ PHẨM)
  { id: 3301, keywords: ['dầu gội', 'dầu xả', 'selsun'] },
  // 3401: Son, dưỡng môi
  { id: 3401, keywords: ['son dưỡng', 'dưỡng môi', 'lip balm', 'fixderma lip'] },
  // 3501: Trị mụn chuyên sâu (DMỸ PHẨM)
  { id: 3501, keywords: ['serum trị mụn', 'kem bôi mụn derma'] },
  // 3506: Trị sẹo & mờ thâm (DMỸ PHẨM)
  { id: 3506, keywords: ['mờ thâm kem'] },
  // 3601: Da nhạy cảm
  { id: 3601, keywords: ['da nhạy cảm', 'nước tẩy trang', 'bioderma sensibio', 'tẩy trang'] },
  // 3701: Khăn, bông tẩy trang
  { id: 3701, keywords: ['bông tẩy trang', 'khăn tẩy trang'] },
  // 3205: Dưỡng da tay & chân
  { id: 3205, keywords: ['dưỡng ẩm vaseline', 'sáp dưỡng ẩm', 'vaseline'] },

  // ====================================================================
  // NHÓM 4: CHĂM SÓC CÁ NHÂN (4000)
  // ====================================================================
  // 4101: Kem đánh răng, nước xúc miệng
  { id: 4101, keywords: ['kem đánh răng', 'nước súc miệng', 'nước xúc miệng', 'listerine', 'sensodyne', 'p/s '] },
  // 4102: Tăm, chỉ nha khoa
  { id: 4102, keywords: ['tăm chỉ', 'chỉ nha khoa', 'tăm nha khoa', 'okamura'] },
  // 4104: Xịt răng miệng
  { id: 4104, keywords: ['xịt răng miệng', 'xịt chống sâu răng', 'hi-kids'] },
  // 4201: Bao cao su
  { id: 4201, keywords: ['bao cao su', 'durex', 'sagami', 'okamoto'] },
  // 4202: Gel bôi trơn
  { id: 4202, keywords: ['gel bôi trơn', 'lubricant'] },
  // 4301: Sữa nước
  { id: 4301, keywords: ['sữa nước', 'sữa fontactiv', 'sữa dinh dưỡng'] },
  // 4302: Kẹo cứng, kẹo dẻo
  { id: 4302, keywords: ['kẹo xí muội', 'kẹo chanh muối', 'kẹo himalaya', 'playmore', 'kẹo cứng', 'kẹo dẻo'] },
  // 4303: Nước yến tổ yến
  { id: 4303, keywords: ['nước yến', 'yến sào nước'] },
  // 4305: Đường ăn kiêng
  { id: 4305, keywords: ['đường ăn kiêng', 'stevia', 'tạo ngọt'] },
  // 4306: Trà, trà thảo dược
  { id: 4306, keywords: ['trà gừng', 'trà thảo dược', 'nước mát herbal'] },
  // 4401: Vệ sinh tai, mũi, họng
  { id: 4401, keywords: ['vệ sinh tai', 'vệ sinh mũi', 'nước muối sinh lý'] },
  // 4402: Khăn giấy, khăn ướt
  { id: 4402, keywords: ['khăn giấy', 'khăn ướt', 'khăn ướt mamamy', 'trung sơn care'] },
  // 4403: Rửa tay sát khuẩn
  { id: 4403, keywords: ['rửa tay', 'gel rửa tay'] },
  // 4404: Băng vệ sinh
  { id: 4404, keywords: ['băng vệ sinh', 'kotex', 'diana', 'laurier'] },
  // 4405: Dung dịch vệ sinh
  { id: 4405, keywords: ['dung dịch vệ sinh', 'lactacyd', 'dạ hương', 'vệ sinh phụ nữ'] },
  // 4501: Dầu & tinh dầu xông
  { id: 4501, keywords: ['dầu gió', 'tinh dầu bạch đàn', 'tinh dầu bạc hà', 'tinh dầu thiên nhiên', 'kutieskin', 'tinh dầu tràm', 'tinh dầu khuynh diệp'] },
  // 4502: Dầu & tinh dầu massage
  { id: 4502, keywords: ['dầu massage', 'dầu lăn', 'fresh on barley', 'baby massage oil'] },
  // 4601: Xịt côn trùng
  { id: 4601, keywords: ['xịt côn trùng', 'xịt muỗi', 'chống muỗi', 'đuổi muỗi'] },

  // ====================================================================
  // NHÓM 5: MẸ & BÉ (5000)
  // ====================================================================
  // 5101: Dinh dưỡng cho mẹ
  { id: 5101, keywords: ['dinh dưỡng cho mẹ', 'vitamin bà bầu', 'sữa bà bầu'] },
  // 5201: Dinh dưỡng cho bé
  { id: 5201, keywords: ['sữa cho bé', 'sữa bột trẻ em'] },
  // 5202: Vệ sinh & chăm sóc bé
  { id: 5202, keywords: ['chăm sóc bé', 'tã', 'bỉm', 'dầu massage bé'] },

  // ====================================================================
  // NHÓM 6: DỤNG CỤ Y TẾ (6000)
  // ====================================================================
  // 6101: Kit test
  { id: 6101, keywords: ['kit test', 'test covid', 'test nhanh'] },
  // 6102: Máy đo huyết áp
  { id: 6102, keywords: ['máy đo huyết áp', 'omron'] },
  // 6103: Nhiệt kế
  { id: 6103, keywords: ['nhiệt kế', 'thân nhiệt', 'aurora hmp'] },
  // 6104: Máy đo đường huyết
  { id: 6104, keywords: ['máy đo đường huyết', 'que thử đường huyết', 'medismart', 'kim tiêm tiểu đường', 'omnican'] },
  // 6105: Que thử thai
  { id: 6105, keywords: ['que thử thai', 'amestick'] },
  // 6201: Băng gạc, bông y tế
  { id: 6201, keywords: ['băng gạc', 'bông y tế', 'urgo', 'băng keo', 'băng cá nhân', 'gạc tẩm cồn', 'quick-nurse', 'multidex', 'băng keo lụa'] },
  // 6202: Khử trùng, sát trùng (DCYT)
  { id: 6202, keywords: ['dung dịch sát khuẩn', 'cồn sát khuẩn'] },
  // 6203: Khẩu trang y tế
  { id: 6203, keywords: ['khẩu trang'] },
  // 6301: Máy đo SpO2
  { id: 6301, keywords: ['spo2', 'máy đo oxy'] },
  // 6302: Máy xông khí dung
  { id: 6302, keywords: ['máy xông', 'khí dung', 'nebulizer', 'b.well'] },
  // 6303: Đai, nẹp, vớ y khoa
  { id: 6303, keywords: ['đai lưng', 'đai chống gù', 'nẹp', 'bó gối', 'túi treo tay', 'dây thở oxy', 'bonbone', 'pro hard slim'] },
  // 6401: Bơm, Kim tiêm
  { id: 6401, keywords: ['kim tiêm', 'bơm tiêm', 'dây truyền dịch', 'dây thông tiểu', 'foley'] },
  // 6403: Dụng cụ y tế khác
  { id: 6403, keywords: ['dụng cụ nghiền thuốc', 'dụng cụ cắt thuốc', 'hộp phân liều', 'phân liều thuốc'] },
];


const DB_CONFIG = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'mg_catalog',
    charset: 'utf8mb4'
};

/**
 * Phân loại sản phẩm dựa trên bộ từ điển chuyên gia
 * Ưu tiên: Hoạt chất → Tên → Mô tả
 */
function classifyProduct(product) {
    const name = (product.name || '').toLowerCase();
    const ingredient = (product.active_ingredient || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();
    const combined = `${name} ${ingredient} ${desc}`;

    // === BƯỚC 0: PRIORITY RULES - check TÊN + MÔ TẢ trước (không check hoạt chất) ===
    // Priority rules nằm ở đầu mảng, trước comment "NHÓM 1: THUỐC"
    for (const rule of CLASSIFICATION_RULES) {
        if (rule._priority) {
            for (const kw of rule.keywords) {
                if (name.includes(kw) || desc.includes(kw)) {
                    return rule.id;
                }
            }
        }
    }

    // === BƯỚC 1: Match theo hoạt chất (general rules) ===
    for (const rule of CLASSIFICATION_RULES) {
        if (rule._priority) continue; // đã xử lý ở bước 0
        for (const kw of rule.keywords) {
            if (ingredient.includes(kw)) {
                return rule.id;
            }
        }
    }

    // === BƯỚC 2: Match theo tên sản phẩm (general rules) ===
    for (const rule of CLASSIFICATION_RULES) {
        if (rule._priority) continue;
        for (const kw of rule.keywords) {
            if (name.includes(kw)) {
                return rule.id;
            }
        }
    }

    // === BƯỚC 3: Match theo mô tả (general rules) ===
    for (const rule of CLASSIFICATION_RULES) {
        if (rule._priority) continue;
        for (const kw of rule.keywords) {
            if (desc.includes(kw)) {
                return rule.id;
            }
        }
    }


    // === BƯỚC 4: Fallback thông minh - phân vào cấp 1 phù hợp ===
    
    // Thuốc kê đơn / Thuốc nói chung
    if (combined.includes('thuốc') || combined.includes('viên nén') || combined.includes('viên nang')) {
        // Phân tích kỹ hơn để gán vào đúng nhóm
        if (combined.includes('vitamin')) return 1501;
        if (combined.includes('khớp') || combined.includes('xương')) return 1011;
        if (combined.includes('mắt') || combined.includes('nhỏ mắt')) return 1021;
        if (combined.includes('mũi') || combined.includes('họng')) return 1024;
        if (combined.includes('dạ dày') || combined.includes('tiêu hóa')) return 1101;
        if (combined.includes('da') || combined.includes('bôi')) return 1706;
        return 1501; // Thuốc bổ - Vitamin (fallback an toàn nhất cho thuốc không rõ)
    }
    
    // TPCN
    if (combined.includes('tpbvsk') || combined.includes('thực phẩm bảo vệ') || combined.includes('thực phẩm chức năng') || combined.includes('hỗ trợ')) {
        if (combined.includes('xương') || combined.includes('khớp')) return 2801;
        if (combined.includes('gan')) return 2301;
        if (combined.includes('trí nhớ') || combined.includes('não')) return 2401;
        if (combined.includes('mắt')) return 2025;
        if (combined.includes('da') || combined.includes('đẹp da')) return 2703;
        if (combined.includes('tóc')) return 2704;
        if (combined.includes('ho') || combined.includes('họng')) return 2902;
        if (combined.includes('tiêu hóa')) return 2203;
        if (combined.includes('miễn dịch') || combined.includes('đề kháng')) return 2021;
        return 2021; // Tăng cường sức khỏe chung (fallback TPCN)
    }
    
    // Mỹ phẩm / Chăm sóc da
    if (combined.includes('kem') || combined.includes('serum') || combined.includes('dưỡng da') || combined.includes('mỹ phẩm')) {
        if (combined.includes('chống nắng') || combined.includes('spf')) return 3105;
        if (combined.includes('dưỡng ẩm') || combined.includes('moistur')) return 3104;
        if (combined.includes('mụn')) return 3501;
        if (combined.includes('trắng') || combined.includes('sáng da')) return 3503;
        return 3104; // Kem dưỡng ẩm (fallback mỹ phẩm)
    }
    
    // Dụng cụ / TBYT
    if (combined.includes('máy') || combined.includes('dụng cụ') || combined.includes('thiết bị') || combined.includes('đai') || combined.includes('nẹp')) {
        return 6403; // Dụng cụ y tế khác
    }
    
    // Vệ sinh cá nhân
    if (combined.includes('vệ sinh') || combined.includes('khăn') || combined.includes('rửa tay')) {
        return 4403;
    }

    // Sữa & dinh dưỡng
    if (combined.includes('sữa')) {
        return 4301;
    }

    // Kẹo & thực phẩm
    if (combined.includes('kẹo') || combined.includes('thực phẩm')) {
        return 4302;
    }
    
    // Viên uống không rõ -> TPCN tăng cường sức khỏe
    if (combined.includes('viên uống')) {
        return 2021;
    }

    // Cuối cùng - gán vào TPCN tăng cường sức khoẻ chung
    return 2021;
}

async function seedRealProducts() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  EXPERT PHARMACIST PRODUCT SEEDER v2.0                      ║');
    console.log('║  Phân loại sản phẩm theo kiến thức dược lý chuyên sâu       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Đã kết nối Database.');

        // 1. Dọn dẹp
        console.log('🧹 Đang làm sạch bảng products...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('TRUNCATE TABLE products');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        // 2. Đọc file JSON
        const jsonPath = path.join(__dirname, '../../../du lieu test/ts_products_real.json');
        console.log(`📂 Đang đọc dữ liệu từ: ${jsonPath}`);
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const allProducts = JSON.parse(rawData);
        
        // Lọc trùng SKU
        const seenSkus = new Set();
        const products = allProducts.filter(p => {
            if (seenSkus.has(p.sku)) return false;
            seenSkus.add(p.sku);
            return true;
        });

        console.log(`📦 Tìm thấy ${allProducts.length} sản phẩm, sau khi lọc trùng còn ${products.length} sản phẩm.`);

        // 3. Mapping & Filtering
        const finalProducts = [];
        const categoryCounts = {};
        let uncategorizedList = [];

        for (const p of products) {
            const catId = classifyProduct(p);

            categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;

            if (catId === 9999) {
                uncategorizedList.push(p.name);
            }

            finalProducts.push([
                p.sku,
                p.name,
                catId,
                p.active_ingredient || '',
                p.registration_number || '',
                p.manufacturer || '',
                p.requires_prescription || 0,
                p.base_unit || 'Đơn vị',
                p.cost_price || 0,
                p.retail_price || 0,
                p.image_url || '',
                p.description || '',
                'active',
                p.barcode || '',
                JSON.stringify(p.gallery || [])
            ]);
        }

        // 4. Batch Insert
        console.log('🚀 Đang thực hiện Batch Insert...');
        const query = `INSERT IGNORE INTO products 
            (sku, name, category_id, active_ingredient, registration_number, manufacturer, requires_prescription, base_unit, cost_price, retail_price, image_url, description, status, barcode, gallery) 
            VALUES ?`;
        
        const chunkSize = 100;
        let totalInserted = 0;
        for (let i = 0; i < finalProducts.length; i += chunkSize) {
            const chunk = finalProducts.slice(i, i + chunkSize);
            try {
                const [result] = await connection.query(query, [chunk]);
                totalInserted += result.affectedRows;
                console.log(`  ✓ Chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(finalProducts.length/chunkSize)} (${result.affectedRows} sp)`);
            } catch (chunkErr) {
                console.error(`  ❌ Lỗi chunk ${Math.floor(i/chunkSize) + 1}:`, chunkErr.message);
            }
        }

        console.log('\n══════════════════════════════════════════════════');
        console.log(`✅ HOÀN THÀNH! Tổng số sản phẩm đã nạp: ${totalInserted}`);
        console.log(`   Chưa phân loại (9999): ${uncategorizedList.length}`);
        console.log('\n📊 Top 15 Danh mục nhiều sản phẩm nhất:');
        const sorted = Object.entries(categoryCounts).sort((a,b) => b[1] - a[1]).slice(0, 15);
        sorted.forEach(([id, count]) => console.log(`   ID ${id}: ${count} sp`));

        if (uncategorizedList.length > 0) {
            console.log('\n⚠️ Sản phẩm chưa phân loại:');
            uncategorizedList.forEach(name => console.log(`   - ${name}`));
        }

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

seedRealProducts();
