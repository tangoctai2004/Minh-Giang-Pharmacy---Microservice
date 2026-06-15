# Hướng dẫn thiết lập Database (Windows & Mac)

Tài liệu này hướng dẫn cách khởi tạo toàn bộ hệ thống database của Minh Giang Pharmacy từ đầu với trạng thái "Sạch" (đầy đủ thông tin thuốc, danh mục, bài viết tin tức và cấu hình hệ thống; toàn bộ dữ liệu giao dịch bán hàng, đơn hàng, lô nhập hàng được đưa về trắng để bắt đầu chạy).

## 1. Yêu cầu hệ thống
- **MySQL Server 8.0+** hoặc **Docker Desktop** (khuyên dùng Docker).
- Công cụ quản lý DB (Khuyên dùng: **DBeaver**).

## 2. Khởi tạo và nạp dữ liệu tự động (Docker - Khuyên dùng)

Nếu bạn sử dụng Docker, hệ thống đã cung cấp một script tự động chạy toàn bộ cấu trúc bảng (schema), chạy migrations và nạp dữ liệu sạch theo đúng thứ tự ràng buộc khóa ngoại.

Mở Terminal (Mac/Linux) hoặc Git Bash (Windows) tại thư mục gốc của dự án và chạy lệnh:
```bash
bash infrastructure/database/run_all.sh
```

Script này sẽ tự động:
1. Tạo 5 cơ sở dữ liệu: `mg_identity`, `mg_catalog`, `mg_order`, `mg_cms`, `mg_notification`.
2. Tạo cấu trúc bảng và view cho từng phân hệ.
3. Áp dụng các file Migration (thêm cột giỏ hàng, đơn hàng hoạt động...).
4. Nạp dữ liệu danh mục sản phẩm, đơn vị thuốc, nhà cung cấp, thương hiệu.
5. Nạp danh mục hơn 3000 sản phẩm sạch và 54 bài viết y khoa mẫu.
6. Xác thực chất lượng dữ liệu bằng công cụ kiểm tra tự động `99_verify_seed_quality.sql` để đảm bảo hệ thống không bị lỗi dữ liệu rác hay lỗi logic nghiệp vụ dược.

---

## 3. Khởi tạo thủ công (Nếu không dùng Docker / chạy bằng DBeaver)

Nếu bạn kết nối trực tiếp đến MySQL local của máy thông qua DBeaver hoặc các công cụ khác, hãy thực hiện theo thứ tự sau:

### Bước 1: Tạo database và bảng cấu trúc
Mở và chạy lần lượt các script sau (nhấp **Alt + X** hoặc Execute SQL Script trong DBeaver):
1. `01_mg_identity.sql`
2. `02_mg_catalog.sql`
3. `06_mg_catalog_product_media_gpp.sql`
4. `07_mg_catalog_quality_workflow.sql`
5. `08_mg_catalog_stocktake_adjustments.sql`
6. `03_mg_order.sql`
7. `migrations/20260516_add_cart_item_snapshot_columns.sql`
8. `migrations/20260516_add_is_active_order.sql`
9. `04_mg_cms.sql`
10. `05_mg_notification.sql`

### Bước 2: Nạp dữ liệu danh mục và sản phẩm
Chạy lần lượt để tránh xung đột khóa ngoại:
1. `10_seed_full_catalog.sql` (NCC, thương hiệu, danh mục chính)
2. `11_seed_clean_catalog_products.sql` (3000+ sản phẩm và đơn vị bán hàng)
3. `12_seed_clean_cms_content.sql` (Các danh mục bài viết và bài viết CMS)
4. `90_seed_demo_baseline.sql` (Cấu hình vận chuyển và các mẫu thông báo hệ thống - các phần dữ liệu đơn hàng đã được tắt để giữ DB sạch).

### Bước 3: Xác thực
Chạy script `99_verify_seed_quality.sql` để đảm bảo cơ sở dữ liệu đã sẵn sàng hoạt động.

