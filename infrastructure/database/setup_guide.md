# Hướng dẫn thiết lập Database (Windows & Mac)

Tài liệu này hướng dẫn cách khởi tạo lại toàn bộ hệ thống database của Minh Giang Pharmacy từ đầu với trạng thái "Bảng trắng" (chỉ có cấu trúc bảng, không có dữ liệu rác).

## 1. Yêu cầu hệ thống
- **MySQL Server 8.0+** hoặc **Docker Desktop**.
- Một công cụ quản lý DB (Khuyên dùng: **DBeaver**).

## 2. Khởi tạo cấu trúc (Schema)

### Cách A: Sử dụng Docker (Nhanh nhất)
Mở Git Bash hoặc Terminal tại thư mục `/infrastructure/database/` và chạy:
```bash
docker exec -i minhgiang_mysql mysql -uroot -proot < 00_init_all.sql
```
*(Lưu ý: Thay mật khẩu `root` nếu bạn đã đổi).*

### Cách B: Sử dụng DBeaver / Workbench
1. Mở DBeaver và kết nối tới MySQL của bạn.
2. Mở file `infrastructure/database/00_init_all.sql`.
3. Nhấn **Alt + X** (Execute SQL Script). 
   *Lưu ý: Đảm bảo DBeaver đang ở chế độ chạy script đa lệnh.*

## 3. Nạp dữ liệu (Seeding)
Sau khi đã có các database trống, bạn nạp dữ liệu theo thứ tự sau để tránh lỗi khóa ngoại:

1. **Catalog Base**: `99_seed_full_catalog.sql` (Danh mục, NCC, Thương hiệu).
2. **Products**: `99_seed_trungson_real.sql` (Dữ liệu 1500+ sản phẩm thực tế).
3. **CMS Content**: `99_seed_cms_blogs.sql` (Bài viết blog).

**Lệnh chạy nhanh qua Docker:**
```bash
# Nạp Catalog
docker exec -i minhgiang_mysql mysql -uroot -proot mg_catalog < 99_seed_full_catalog.sql
docker exec -i minhgiang_mysql mysql -uroot -proot mg_catalog < 99_seed_trungson_real.sql

# Nạp CMS
docker exec -i minhgiang_mysql mysql -uroot -proot mg_cms < 99_seed_cms_blogs.sql
```

---
> [!TIP]
> **Dành cho Windows**: Nếu bạn không dùng Docker, hãy ưu tiên dùng **DBeaver**. DBeaver xử lý lệnh `SOURCE` và `DELIMITER` trong script SQL tốt hơn các công cụ khác trên Windows.
