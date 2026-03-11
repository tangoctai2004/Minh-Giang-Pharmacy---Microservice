import os
import re

fe_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'
filepath = os.path.join(fe_dir, 'benh-theo-doi-tuong.html')

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace document title
content = content.replace('<title>Bệnh chuyên khoa — Nhà Thuốc Minh Giang</title>', '<title>Bệnh theo đối tượng — Nhà Thuốc Minh Giang</title>')

# Replace breadcrumb
content = content.replace('<strong style="color:#0b7a3e">Bệnh chuyên khoa</strong>', '<strong style="color:#0b7a3e">Bệnh theo đối tượng</strong>')

# Replace page title
content = content.replace('<h1 class="page-title">Bệnh chuyên khoa</h1>', '<h1 class="page-title">Bệnh theo đối tượng</h1>')
content = content.replace('<h3 class="sidebar-title">Danh sách bệnh chuyên khoa</h3>', '<h3 class="sidebar-title">Phân loại theo đối tượng</h3>')

# New Sidebar format
sidebar_html = """
                <ul class="specialty-list" id="specialtyNav">
                    <li><a href="#nam-gioi" class="active"><img src="assets/benh-ly/benh-theo-doi-tuong/icon-nam-gioi.png" alt="">Nam giới</a></li>
                    <li><a href="#nu-gioi"><img src="assets/benh-ly/benh-theo-doi-tuong/icon-nu-gioi.png" alt="">Nữ giới</a></li>
                    <li><a href="#tre-em"><img src="assets/benh-ly/benh-theo-doi-tuong/icon-tre-em.png" alt="">Trẻ em</a></li>
                    <li><a href="#nguoi-cao-tuoi"><img src="assets/benh-ly/benh-theo-doi-tuong/icon-nguoi-cao-tuoi.png" alt="">Người cao tuổi</a></li>
                </ul>
"""
content = re.sub(r'<ul class="specialty-list" id="specialtyNav">.*?</ul>', sidebar_html, content, flags=re.DOTALL)


# Content area format
content_area_html = """
            <div class="content-area">

                <div class="content-card specialty-card-content" id="nam-gioi">
                    <h2>Nam giới</h2>
                    <div class="article-grid">
                        <a href="#">Rối loạn cương dương: Nguyên nhân, Triệu chứng, Cách điều trị an toàn</a>
                        <a href="#">Viêm tuyến tiền liệt: Dấu hiệu nhận biết và Các phương pháp chữa trị</a>
                        <a href="#">Xuất tinh sớm: Đâu là nguyên nhân và cách khắc phục hiệu quả nhất?</a>
                        <a href="#">Hói đầu ở nam giới: Nguyên nhân do di truyền hay thói quen sinh hoạt?</a>
                        <a href="#">Yếu sinh lý nam: Chế độ ăn uống và các bài tập cải thiện sức khỏe</a>
                        <a href="#">Ung thư tuyến tiền liệt: Tầm soát và nhận biết sớm triệu chứng</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="nu-gioi">
                    <h2>Nữ giới</h2>
                    <div class="article-grid">
                        <a href="#">Rối loạn kinh nguyệt: Nguyên nhân do nội tiết và cách khắc phục</a>
                        <a href="#">Viêm âm đạo: Triệu chứng điển hình, cách phòng ngừa và điều trị</a>
                        <a href="#">Hội chứng buồng trứng đa nang (PCOS): Nhận biết sớm và hướng điều trị</a>
                        <a href="#">Ung thư cổ tử cung: Tầm quan trọng của việc tiêm ngừa HPV và tầm soát định kỳ</a>
                        <a href="#">Viêm lộ tuyến cổ tử cung: Dấu hiệu, Mức độ nguy hiểm và Cách chữa</a>
                        <a href="#">Khô âm đạo ở phụ nữ tiền mãn kinh: Nguyên nhân và Các giải pháp làm giảm</a>
                        <a href="#">Lạc nội mạc tử cung: Nhận diện triệu chứng đau bất thường</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="tre-em">
                    <h2>Trẻ em</h2>
                    <div class="article-grid">
                        <a href="#">Sốt phát ban ở trẻ em: Cách nhận biết, phân biệt và chăm sóc tại nhà</a>
                        <a href="#">Tay chân miệng: Nguyên nhân, Dấu hiệu nguy hiểm và Cách phòng bệnh</a>
                        <a href="#">Suy dinh dưỡng ở trẻ: Đánh giá thể trạng và Chế độ dinh dưỡng phục hồi</a>
                        <a href="#">Viêm tai giữa cấp tính ở trẻ nhỏ: Xử trí thế nào để tránh biến chứng?</a>
                        <a href="#">Bệnh sởi: Triệu chứng điển hình, Biến chứng và Lịch tiêm phòng cho bé</a>
                        <a href="#">Tiêu chảy cấp ở trẻ em: Hướng dẫn bù nước và chăm sóc đúng cách</a>
                        <a href="#">Thủy đậu: Dấu hiệu khởi phát, Diễn tiến bệnh và Cách chăm sóc giảm sẹo</a>
                        <a href="#">Rối loạn tiêu hóa ở trẻ sơ sinh: Dấu hiệu và giải pháp khắc phục an toàn</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="nguoi-cao-tuoi">
                    <h2>Người cao tuổi</h2>
                    <div class="article-grid">
                        <a href="#">Tăng huyết áp ở người già: Nguyên tắc kiểm soát và Phòng ngừa đột quỵ</a>
                        <a href="#">Đái tháo đường type 2: Biến chứng nguy hiểm và Cách quản lý đường huyết</a>
                        <a href="#">Loãng xương: Nguyên nhân thoái hóa, Biến chứng gãy xương và Cách bổ sung Canxi</a>
                        <a href="#">Bệnh Alzheimer và sa sút trí tuệ: Nhận biết dấu hiệu sớm ở người cao tuổi</a>
                        <a href="#">Thoái hóa khớp gối: Nguyên nhân gây đau nhức và Các phương pháp giảm đau</a>
                        <a href="#">Bệnh Parkinson: Triệu chứng run tay chân và Hướng điều trị cải thiện chất lượng sống</a>
                    </div>
                </div>

            </div>
"""
content = re.sub(r'<div class="content-area">.*?<!-- Extracted Bottom Sections -->', content_area_html + '\n        </div>\n\n        <!-- Extracted Bottom Sections -->', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Updated {filepath} successfully")
