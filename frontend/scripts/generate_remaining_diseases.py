import os
import re

fe_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'

pages_data = {
    'benh-man-tinh.html': {
        'title': 'Bệnh mãn tính',
        'articles': [
            {'img': 'mt_tieu-duong.png', 'title': 'Tiểu đường type 2: Nguyên nhân, Biến chứng và Cách kiểm soát', 'desc': 'Tiểu đường type 2 là bệnh mạn tính phổ biến, gây ra do cơ thể kháng insulin...'},
            {'img': 'mt_huyet-ap-cao.png', 'title': 'Huyết áp cao: Kẻ giết người thầm lặng và cách phòng ngừa đột quỵ', 'desc': 'Tăng huyết áp không có triệu chứng rõ ràng nhưng có thể dẫn đến nhồi máu cơ tim...'},
            {'img': 'mt_hen-suyen.png', 'title': 'Hen phế quản (Hen suyễn): Dấu hiệu nhận biết và Thuốc điều trị', 'desc': 'Hen suyễn là bệnh viêm mãn tính đường hô hấp gây ho, tức ngực, khó thở...'},
            {'img': 'mt_gut.png', 'title': 'Bệnh Gout: Nguyên nhân gây đau nhức khớp và Chế độ ăn kiêng', 'desc': 'Gout là một dạng viêm khớp do rối loạn chuyển hóa axit uric trong cơ thể...'},
            {'img': 'mt_copd.png', 'title': 'Phổi tắc nghẽn mạn tính (COPD): Triệu chứng và Phương pháp giảm nhẹ', 'desc': 'COPD thường gặp ở người hút thuốc, làm suy giảm chức năng hô hấp...'},
        ]
    },
    'benh-theo-mua.html': {
        'title': 'Bệnh theo mùa',
        'articles': [
            {'img': 'tm_cam-cum.png', 'title': 'Cảm cúm mùa lạnh: Phân biệt với cảm lạnh thông thường', 'desc': 'Cúm mùa lây lan nhanh qua đường hô hấp, gây sốt, ho, đau họng, nhức mỏi...'},
            {'img': 'tm_sot-xuat-huyet.png', 'title': 'Sốt xuất huyết: Dấu hiệu nguy hiểm cần nhập viện ngay', 'desc': 'Sốt xuất huyết do muỗi vằn truyền bệnh, thường bùng phát vào mùa mưa...'},
            {'img': 'tm_viem-khop-mua-lanh.png', 'title': 'Đau nhức xương khớp khi trời lạnh: Cách giữ ấm và chữa trị', 'desc': 'Không khí lạnh làm mạch máu co lại, gây giảm máu nuôi khớp dẫn đến đau mỏi...'},
            {'img': 'tm_di-ung-thoi-tiet.png', 'title': 'Dị ứng thời tiết: Tại sao chuyển mùa lại nổi mề đay mẩn ngứa?', 'desc': 'Sự thay đổi nhiệt độ, độ ẩm đột ngột khiến cơ thể phản ứng và nổi mẩn...'},
            {'img': 'tm_say-nang.png', 'title': 'Say nắng, cảm nắng mùa hè: Cách sơ cứu tránh sốc nhiệt', 'desc': 'Tiếp xúc lâu với nắng nóng có thể gây say nắng, cần được hạ nhiệt ngay lập tức...'},
        ]
    },
    'benh-ung-thu.html': {
        'title': 'Bệnh ung thư',
        'articles': [
            {'img': 'ut_ung-thu-gan.png', 'title': 'Ung thư gan: Nguyên nhân, Triệu chứng sớm và Tầm soát', 'desc': 'Ung thư gan thường tiến triển âm thầm, liên quan nhiều đến viêm gan B, C và rượu bia...'},
            {'img': 'ut_ung-thu-phoi.png', 'title': 'Ung thư phổi: Khói thuốc lá và các yếu tố nguy cơ hàng đầu', 'desc': 'Bệnh ung thư phổi có tỉ lệ tử vong cao nhất, ho dai dẳng là dấu hiệu cảnh báo sớm...'},
            {'img': 'ut_ung-thu-vu.png', 'title': 'Ung thư vú: Cách tự khám tại nhà và Ý nghĩa của Mammogram', 'desc': 'Phụ nữ nên tầm soát ung thư vú định kỳ để phát hiện sớm các khối u bất thường...'},
            {'img': 'ut_ung-thu-da-day.png', 'title': 'Ung thư dạ dày: Dấu hiệu, Chẩn đoán và Phương pháp phẫu thuật', 'desc': 'Vi khuẩn HP, thói quen ăn mặn, độ ăn chua cay là yếu tố nguy cơ của ung thư dạ dày...'},
            {'img': 'ut_ung-thu-dai-trang.png', 'title': 'Ung thư đại trực tràng: Polyp đại tràng và Triệu chứng tiêu hóa', 'desc': 'Đau bụng, đi ngoài ra máu là dấu hiệu cảnh báo ung thư ruột cực kỳ quan trọng...'},
        ]
    },
    'benh-la.html': {
        'title': 'Bệnh lạ / Bệnh hiếm gặp',
        'articles': [
            {'img': 'la_progeria.png', 'title': 'Hội chứng Progeria (Lão hóa sớm): Nguyên nhân và Cuộc sống bệnh nhi', 'desc': 'Progeria là một rối loạn di truyền hiếm gặp khiến trẻ em già đi nhanh chóng...'},
            {'img': 'la_nguoi-go.png', 'title': 'Hội chứng người gỗ (FOP): Biến cơ bắp thành xương', 'desc': 'Fibrodysplasia ossificans progressiva là bệnh hiếm khiến các mô mềm biến thành xương...'},
            {'img': 'la_tay-alien.png', 'title': 'Hội chứng "Bàn tay ma" (Alien Hand Syndrome): Nhận thức và Phản xạ', 'desc': 'Một tay của bệnh nhân dường như có suy nghĩ riêng và tự thực hiện các hành động...'},
            {'img': 'la_hypertrichosis.png', 'title': 'Hội chứng người sói (Hypertrichosis): Nguyên nhân mọc lông bất thường', 'desc': 'Tình trạng lông tóc phát triển quá mức trên toàn bộ cơ thể từ khi mới sinh ra...'},
        ]
    }
}

for page, data in pages_data.items():
    filepath = os.path.join(fe_dir, page)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Title & Breadcrumbs
    content = content.replace('Bệnh truyền nhiễm', data['title'])
    
    # 2. Main Articles
    articles_html = ''
    for art in data['articles']:
        articles_html += f'''
                    <a href="#" class="article-card-main">
                        <img src="assets/benh-ly/{art['img']}" alt="{art['title']}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <div class="article-card-content">
                            <span class="article-category">{data['title']}</span>
                            <h3>{art['title']}</h3>
                            <p>{art['desc']}</p>
                        </div>
                    </a>
'''
    
    content = re.sub(r'<div class="main-articles-grid">.*?</div>\s*<!-- Right Sidebar: Tin', f'<div class="main-articles-grid">\n{articles_html}                </div>\n            </div>\n\n            <!-- Right Sidebar: Tin', content, flags=re.DOTALL)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Successfully generated all disease subpages.")
