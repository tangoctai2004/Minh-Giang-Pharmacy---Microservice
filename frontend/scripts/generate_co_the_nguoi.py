import os
import re

fe_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'
filepath = os.path.join(fe_dir, 'benh-co-the-nguoi.html')

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace document title
content = content.replace('<title>Bệnh chuyên khoa — Nhà Thuốc Minh Giang</title>', '<title>Bệnh theo cơ thể người — Nhà Thuốc Minh Giang</title>')

# Replace breadcrumb
content = content.replace('<strong style="color:#0b7a3e">Bệnh chuyên khoa</strong>', '<strong style="color:#0b7a3e">Bệnh theo cơ thể người</strong>')

# Replace page title
content = content.replace('<h1 class="page-title">Bệnh chuyên khoa</h1>', '<h1 class="page-title">Bệnh theo cơ thể người</h1>')
content = content.replace('<h3 class="sidebar-title">Danh sách bệnh chuyên khoa</h3>', '<h3 class="sidebar-title">Phân loại theo cơ thể người</h3>')

# New Sidebar format
sidebar_html = """
                <ul class="specialty-list" id="specialtyNav">
                    <li><a href="#dau" class="active"><img src="assets/benh-ly/benh-theo-co-the-nguoi/icon-dau.png" alt="">Đầu</a></li>
                    <li><a href="#co"><img src="assets/benh-ly/benh-theo-co-the-nguoi/icon-co.png" alt="">Cổ</a></li>
                    <li><a href="#nguc"><img src="assets/benh-ly/benh-theo-co-the-nguoi/icon-nguc.png" alt="">Ngực</a></li>
                    <li><a href="#bung"><img src="assets/benh-ly/benh-theo-co-the-nguoi/icon-bung.png" alt="">Bụng</a></li>
                    <li><a href="#sinh-duc"><img src="assets/benh-ly/benh-theo-co-the-nguoi/icon-sinhduc.png" alt="">Cơ quan sinh dục</a></li>
                    <li><a href="#tu-chi"><img src="assets/benh-ly/benh-theo-co-the-nguoi/icon-tuchi.png" alt="">Tứ chi</a></li>
                    <li><a href="#da"><img src="assets/benh-ly/benh-theo-co-the-nguoi/icon-da.png" alt="">Da & Các mô</a></li>
                </ul>
"""
content = re.sub(r'<ul class="specialty-list" id="specialtyNav">.*?</ul>', sidebar_html, content, flags=re.DOTALL)


# Content area format
content_area_html = """
            <div class="content-area">

                <div class="content-card specialty-card-content" id="dau">
                    <h2>Đầu</h2>
                    <div class="article-grid">
                        <a href="#">Phân biệt Rối loạn tiền đình và Thiếu máu não: Triệu chứng, Nguyên nhân và Cách xử lý</a>
                        <a href="#">Nhức đầu: Nguyên nhân, triệu chứng và cách điều trị hiệu quả</a>
                        <a href="#">Tai biến mạch máu não là gì? Cách phòng tránh tử vong khi xuất hiện đột quỵ</a>
                        <a href="#">Đau đầu mãn tính: 05 cách giảm đau đầu hiệu quả tại nhà</a>
                        <a href="#">Viêm xoang là gì? Tại sao bệnh viêm xoang lại khó chữa?</a>
                        <a href="#">Viêm Tai Giữa Ở Người Lớn Và Những Biến Chứng Nguy Hiểm</a>
                        <a href="#">Đục thủy tinh thể: Nguyên nhân, triệu chứng, chẩn đoán và cách điều trị hiệu quả</a>
                        <a href="#">Viêm giác mạc: Nguyên nhân, triệu chứng và cách điều trị hiệu quả</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="co">
                    <h2>Cổ</h2>
                    <div class="article-grid">
                        <a href="#">Bướu cổ: Nguyên nhân, Triệu Chứng Và Cách Điều Trị Hiệu Quả</a>
                        <a href="#">Cường Giáp: Hướng Dẫn Nhận Biết, Điều Trị Và Phòng Ngừa Hiệu Quả</a>
                        <a href="#">Đau họng: Nguyên nhân, triệu chứng và cách điều trị hiệu quả tại nhà</a>
                        <a href="#">Viêm amidan là gì? Nguyên nhân, triệu chứng và 5 cách điều trị hiệu quả</a>
                        <a href="#">Viêm họng là gì? Top 05 cách trị viêm họng nhanh chóng tại nhà</a>
                        <a href="#">Thoái hóa đốt sống cổ: nguyên nhân, triệu chứng, cách điều trị và phòng ngừa hiệu quả</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="nguc">
                    <h2>Ngực</h2>
                    <div class="article-grid">
                        <a href="#">Viêm Phổi: Hướng Dẫn Nhận Biết, Điều Trị Và Phòng Ngừa Hiệu Quả</a>
                        <a href="#">Hen phế quản: Nguyên nhân, triệu chứng và cách điều trị hiệu quả nhất 2025</a>
                        <a href="#">Nhồi máu cơ tim: nguyên nhân, triệu chứng và cách phòng ngừa hiệu quả</a>
                        <a href="#">Hở van tim: Nguyên nhân, triệu chứng, cách chẩn đoán và điều trị hiệu quả</a>
                        <a href="#">Rối Loạn Nhịp Tim Có Chữa Khỏi Được Không?</a>
                        <a href="#">Ung thư vú: Nguyên nhân, triệu chứng, cách phòng ngừa và điều trị hiệu quả</a>
                        <a href="#">Viêm Phế Quản Và 8 Triệu Chứng Thường Gặp</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="bung">
                    <h2>Bụng</h2>
                    <div class="article-grid">
                        <a href="#">Viêm Dạ Dày: Hiểu Rõ Triệu Chứng, Nguyên Nhân Và Cách Khắc Phục Hiệu Quả</a>
                        <a href="#">Rối Loạn Tiêu Hóa Là Gì? Triệu Chứng, Nguyên Nhân Và Cách Chữa Rối Loạn Tiêu Hóa</a>
                        <a href="#">Viêm Đại Tràng: Giải Mã Nguyên Nhân Và Chấm Dứt Nỗi Lo Về Tiêu Hóa</a>
                        <a href="#">Trào Ngược Dạ Dày Thực Quản (GERD): Nguyên Nhân, Triệu Chứng Và Mẹo Làm Giảm Trào Ngược Dạ Dày</a>
                        <a href="#">Gan Nhiễm Mỡ (FLD): Nguyên Nhân, Triệu Chứng, Chẩn Đoán Và Điều Trị</a>
                        <a href="#">Sỏi Thận: Nguyên Nhân, Triệu Chứng Và Cách Phòng Ngừa Hiệu Quả</a>
                        <a href="#">Suy thận: nguyên nhân, triệu chứng và cách điều trị hiệu quả</a>
                        <a href="#">Táo Bón: Hiểu Rõ Nguyên Nhân Và Cách Khắc Phục An Toàn</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="sinh-duc">
                    <h2>Cơ quan sinh dục</h2>
                    <div class="article-grid">
                        <a href="#">Viêm đường tiết niệu: Nguyên nhân, triệu chứng, cách điều trị và phòng ngừa hiệu quả</a>
                        <a href="#">Nhiễm Herpes Simplex: Nguyên nhân, triệu chứng, cách điều trị và phòng ngừa hiệu quả</a>
                        <a href="#">Bệnh Lậu: Dấu Hiệu Nhận Biết Sớm Và Hướng Điều Trị</a>
                        <a href="#">Nấm Candida: Triệu chứng, mức độ nguy hiểm và phòng ngừa</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="tu-chi">
                    <h2>Tứ chi</h2>
                    <div class="article-grid">
                        <a href="#">Bệnh gout - Nguyên Nhân, Triệu Chứng Và Cách Kiểm Soát Hiệu Quả</a>
                        <a href="#">Giãn tĩnh mạch: Nguyên nhân, triệu chứng và biện pháp điều trị</a>
                        <a href="#">Thoái hóa khớp: Biểu hiện và phương pháp làm giảm đau nhức hiệu quả</a>
                        <a href="#">Bong gân: Cách xử trí an toàn và nhanh phục hồi nhất</a>
                    </div>
                </div>

                <div class="content-card specialty-card-content" id="da">
                    <h2>Da & Các mô</h2>
                    <div class="article-grid">
                        <a href="#">Ngứa da: nguyên nhân, triệu chứng, cách chữa trị và phòng ngừa hiệu quả tại nhà</a>
                        <a href="#">Viêm da cơ địa: Dấu hiệu nhận biết và quản lý bệnh lâu dài</a>
                        <a href="#">Nổi vảy nến: Nguyên nhân, triệu chứng và cách chăm sóc da</a>
                        <a href="#">Mề đay vô căn: Làm sao để hết ngứa và tránh tái phát?</a>
                    </div>
                </div>

            </div>
"""
content = re.sub(r'<div class="content-area">.*?<!-- Extracted Bottom Sections -->', content_area_html + '\n        </div>\n\n        <!-- Extracted Bottom Sections -->', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Updated {filepath} successfully")
