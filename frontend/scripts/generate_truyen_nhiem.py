import os
import re

fe_dir = '/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy/FE'
filepath = os.path.join(fe_dir, 'benh-truyen-nhiem.html')

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace document title
content = content.replace('<title>Bệnh chuyên khoa — Nhà Thuốc Minh Giang</title>', '<title>Bệnh truyền nhiễm — Nhà Thuốc Minh Giang</title>')

# Replace breadcrumb
content = content.replace('<strong style="color:#0b7a3e">Bệnh chuyên khoa</strong>', '<strong style="color:#0b7a3e">Bệnh truyền nhiễm</strong>')


# Replace page layout style to wide-content + right sidebar
style_addition = """
        .page-title {
            display: none; /* Hide original title, handled by banner */
        }
        
        .hero-banner-category {
            width: 100%;
            height: 120px;
            background-color: #0b4b2e;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: bold;
            border-radius: 8px;
            margin-bottom: 30px;
            background-image: url('assets/banner_truyen_nhiem_bg.png'); /* Placeholder if exists */
            background-size: cover;
            background-position: center;
        }

        .page-layout-custom {
            display: grid;
            grid-template-columns: 1fr 300px;
            gap: 30px;
            margin-bottom: 40px;
        }

        .article-card-main {
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            transition: transform 0.2s;
        }
        
        .article-card-main:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }

        .article-card-main img {
            width: 100%;
            height: 160px;
            object-fit: cover;
        }

        .article-card-content {
            padding: 16px;
            display: flex;
            flex-direction: column;
            flex-grow: 1;
        }

        .article-category {
            font-size: 11px;
            color: #6b7280;
            background: #f3f4f6;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 10px;
            width: fit-content;
        }

        .article-card-main h3 {
            font-size: 15px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 8px 0;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .article-card-main p {
            font-size: 13px;
            color: #4b5563;
            line-height: 1.5;
            margin: 0;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .main-articles-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        
        .section-header-custom {
            font-size: 18px;
            font-weight: 700;
            color: #374151;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .featured-news-sidebar {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        
        .tin-noi-bat-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .tin-noi-bat-card {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .tin-noi-bat-card img {
            width: 100%;
            height: 140px;
            object-fit: cover;
            border-radius: 6px;
        }
        
        .tin-noi-bat-card h4 {
            font-size: 14px;
            font-weight: 700;
            color: #111827;
            margin: 0;
            line-height: 1.4;
        }
"""
content = content.replace('/* Container and Structure */', style_addition + '\n        /* Container and Structure */')


# Replace main content area
main_content_replacement = """
        <!-- Hero Banner -->
        <div class="hero-banner-category">
            Bệnh truyền nhiễm
        </div>

        <div class="page-layout-custom">
            
            <!-- Main Content Area: Article Grid -->
            <div>
                <h2 class="section-header-custom">Bệnh truyền nhiễm</h2>
                <div class="main-articles-grid">
                    
                    <a href="#" class="article-card-main">
                        <img src="assets/benh-ly/tt_tieu-chay-cap.png" alt="Tiêu chảy cấp" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <div class="article-card-content">
                            <span class="article-category">Bệnh truyền nhiễm</span>
                            <h3>Tiêu Chảy Cấp: Cách Nhận Biết, Điều Trị Và Phòng Ngừa Hiệu Quả</h3>
                            <p>Tiêu chảy đột ngột khiến bạn mệt mỏi, mất nước, lo lắng không biết ăn gì hay có cần thuốc ngay không? Đây là tình trạng phổ biến...</p>
                        </div>
                    </a>

                    <a href="#" class="article-card-main">
                        <img src="assets/benh-ly/tt_sot-sieu-vi.png" alt="Sốt siêu vi" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <div class="article-card-content">
                            <span class="article-category">Bệnh truyền nhiễm</span>
                            <h3>Cách xử lý an toàn tại nhà khi bị sốt siêu vi</h3>
                            <p>Cơn sốt cao ập đến bất ngờ kèm theo cảm giác đau nhức mình mẩy và mệt mỏi rã rời khiến không ít người hoang mang...</p>
                        </div>
                    </a>

                    <a href="#" class="article-card-main">
                        <img src="assets/benh-ly/tt_virus-nipah.png" alt="Virus Nipah" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <div class="article-card-content">
                            <span class="article-category">Bệnh truyền nhiễm</span>
                            <h3>Virus Nipah (NiV) là gì?: Nguyên nhân, triệu chứng, cách lây lan...</h3>
                            <p>Virus Nipah (NiV) là một loại virus RNA thuộc họ Paramyxoviridae, được phát hiện lần đầu tiên vào năm 1998 tại Malaysia...</p>
                        </div>
                    </a>

                    <a href="#" class="article-card-main">
                        <img src="assets/benh-ly/tt_sach-tay-chan-mieng.png" alt="Tay chân miệng" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <div class="article-card-content">
                            <span class="article-category">Bệnh truyền nhiễm</span>
                            <h3>Sốt siêu vi: nguyên nhân, triệu chứng, cách điều trị và phòng ngừa...</h3>
                            <p>Sốt siêu vi (hay sốt virus) là tình trạng sốt cấp tính do nhiễm các loại virus khác nhau, thường gặp vào thời điểm giao mùa...</p>
                        </div>
                    </a>

                    <a href="#" class="article-card-main">
                        <img src="assets/benh-ly/tt_quai-bi.png" alt="Quai bị" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <div class="article-card-content">
                            <span class="article-category">Bệnh truyền nhiễm</span>
                            <h3>Quai bị là gì? Nguyên nhân, triệu chứng, biến chứng và cách điều trị...</h3>
                            <p>Quai bị là một bệnh truyền nhiễm cấp tính do virus gây ra, đặc trưng bởi tình trạng sưng đau tuyến nước bọt, đặc biệt là tuyến mang tai...</p>
                        </div>
                    </a>

                    <a href="#" class="article-card-main">
                        <img src="assets/benh-ly/tt_benh-phong.png" alt="Bệnh phong" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <div class="article-card-content">
                            <span class="article-category">Bệnh truyền nhiễm</span>
                            <h3>Bệnh phong là gì? Tại sao bị bệnh phong, có cách phòng ngừa không?</h3>
                            <p>Bệnh phong (bệnh hủi, Hansen) là bệnh nhiễm trùng mạn tính do vi khuẩn Mycobacterium leprae gây ra...</p>
                        </div>
                    </a>

                </div>
            </div>

            <!-- Right Sidebar: Tin Nổi Bật -->
            <aside class="featured-news-sidebar">
                <h2 class="section-header-custom" style="font-size: 16px;">TIN NỔI BẬT</h2>
                <div class="tin-noi-bat-list">
                    
                    <a href="#" class="tin-noi-bat-card">
                        <img src="assets/benh-ly/tt_uon-van.png" alt="Uốn ván" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <span class="article-category" style="margin-bottom: 4px;">Bệnh truyền nhiễm</span>
                        <h4>Bệnh uốn ván: Nguyên nhân, triệu chứng nguy hiểm, cách điều trị và phòng ngừa hiệu quả</h4>
                    </a>

                    <a href="#" class="tin-noi-bat-card">
                        <img src="assets/benh-ly/tt_botulinum.png" alt="Botulinum" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <span class="article-category" style="margin-bottom: 4px;">Bệnh lý</span>
                        <h4>[Cảnh Báo] Nguy cơ ngộ độc Botulinum: Dấu hiệu nhận biết theo từng giai đoạn</h4>
                    </a>

                    <a href="#" class="tin-noi-bat-card">
                        <img src="assets/benh-ly/tt_giang-mai.png" alt="Giang mai" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'#f3f4f6\\\'/><text x=\\\'50\\\' y=\\\'50\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-family=\\\'sans-serif\\\' font-size=\\\'14\\\' fill=\\\'#9ca3af\\\'>Image</text></svg>'">
                        <span class="article-category" style="margin-bottom: 4px;">Bệnh truyền nhiễm</span>
                        <h4>Bệnh giang mai: Nguyên nhân, triệu chứng theo giai đoạn, cách điều trị</h4>
                    </a>

                </div>
            </aside>

        </div>
"""
content = re.sub(r'<h1 class="page-title">Bệnh chuyên khoa</h1>.*?<div class="bottom-sections">', main_content_replacement + '\n        <div class="bottom-sections">', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Updated {filepath} successfully")
