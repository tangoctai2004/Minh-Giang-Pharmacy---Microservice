# Hướng dẫn thiết lập Database (Windows & Mac)

Tài liệu này hướng dẫn cách khởi tạo toàn bộ hệ thống database của Minh Giang Pharmacy từ đầu với trạng thái "Sạch" (đầy đủ thông tin thuốc, danh mục, bài viết tin tức và cấu hình hệ thống; toàn bộ dữ liệu giao dịch bán hàng, đơn hàng, lô nhập hàng được đưa về trắng để bắt đầu chạy).

## 1. Yêu cầu hệ thống
- **MySQL Server 8.0+** hoặc **Docker Desktop** (khuyên dùng Docker).
- Công cụ quản lý DB (Khuyên dùng: **DBeaver**).

## 2. Khởi tạo và nạp dữ liệu tự động (Docker - Khuyên dùng)

Nếu bạn sử dụng Docker, hệ thống đã cung cấp một script tự động chạy toàn bộ cấu trúc bảng (schema) và nạp dữ liệu sạch theo đúng thứ tự ràng buộc khóa ngoại.

Mở Terminal (Mac/Linux) hoặc Git Bash (Windows) tại thư mục gốc của dự án và chạy lệnh:
```bash
bash infrastructure/database/run_all.sh
```

Script này sẽ tự động:
1. Tạo 5 cơ sở dữ liệu: `mg_identity`, `mg_catalog`, `mg_order`, `mg_cms`, `mg_notification`.
2. Tạo cấu trúc bảng và view cho từng phân hệ (đã gộp đầy đủ cấu hình GPP, workflow chất lượng, thuộc tính bổ sung...).
3. Nạp dữ liệu danh mục sản phẩm, đơn vị thuốc, nhà cung cấp, thương hiệu, sản phẩm và bài viết tin tức mẫu từ thư mục `seeds/`.
4. Xác thực chất lượng dữ liệu bằng công cụ kiểm tra tự động `verify.sql` để đảm bảo hệ thống không bị lỗi dữ liệu rác hay lỗi logic nghiệp vụ dược.

---

## 3. Khởi tạo thủ công (Nếu không dùng Docker / chạy bằng DBeaver)

Nếu bạn kết nối trực tiếp đến MySQL local của máy thông qua DBeaver hoặc các công cụ khác, hãy thực hiện theo thứ tự sau:

### Bước 1: Tạo database và cấu trúc bảng (Schemas)
Mở và chạy lần lượt các script sau (nhấp **Alt + X** hoặc Execute SQL Script trong DBeaver) từ thư mục `infrastructure/database/schemas/`:
1. `schemas/01_mg_identity.sql`
2. `schemas/02_mg_catalog.sql`
3. `schemas/03_mg_order.sql`
4. `schemas/04_mg_cms.sql`
5. `schemas/05_mg_notification.sql`

### Bước 2: Nạp dữ liệu danh mục và dữ liệu mẫu (Seeds)
Mở và chạy lần lượt các script sau từ thư mục `infrastructure/database/seeds/`:
1. `seeds/01_seed_full_catalog.sql` (NCC, thương hiệu, danh mục chính)
2. `seeds/02_seed_clean_catalog_products.sql` (3000+ sản phẩm và đơn vị bán hàng)
3. `seeds/03_seed_clean_cms_content.sql` (Các danh mục bài viết và bài viết CMS)
4. `seeds/04_seed_disease_categories.sql` (Danh mục bệnh lý hỗ trợ tìm kiếm sản phẩm)
5. `seeds/05_seed_demo_promotions.sql` (Dữ liệu mẫu chương trình khuyến mãi)
6. `seeds/06_seed_product_tag_promotions.sql` (Khuyến mãi theo thẻ sản phẩm)
7. `seeds/07_seed_demo_baseline.sql` (Cấu hình vận chuyển và các mẫu thông báo hệ thống)
8. `seeds/08_seed_daily_activity.sql` (Dữ liệu phát sinh nghiệp vụ mẫu ban đầu)

### Bước 3: Xác thực
Chạy script `verify.sql` ở thư mục gốc `infrastructure/database/verify.sql` để đảm bảo cơ sở dữ liệu đã sẵn sàng hoạt động.
