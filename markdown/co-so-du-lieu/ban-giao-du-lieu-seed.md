# Tài liệu bàn giao Dữ liệu mẫu (Seed Data Handoff) - Nhà Thuốc Minh Giang

Bộ dữ liệu mẫu này được thiết kế để phục vụ cho ứng dụng microservice Nhà Thuốc Minh Giang với các thông tin cốt lõi:
- Cửa hàng chính: Nhà Thuốc Minh Giang
- Địa chỉ: 918 An Dương Vương, Thành phố Hòa Bình
- Phạm vi vận chuyển: Thành phố Hòa Bình, bán kính tối đa 8km

## Lệnh khởi tạo lại (Rebuild Command)

Chạy script tự động từ thư mục gốc của dự án:
```bash
bash infrastructure/database/run_all.sh
```

Script này sẽ dựng lại cấu trúc 5 schema trong MySQL, nạp toàn bộ dữ liệu mẫu theo đúng thứ tự ràng buộc khóa ngoại và thực thi kiểm tra chất lượng ở bước cuối cùng. Nếu có bất kỳ vi phạm ràng buộc nghiệp vụ nào, file `verify.sql` sẽ báo lỗi và dừng script.

## Danh sách các file Seed mới (`seeds/`)

Dưới đây là các file seed đã được tổ chức lại trong thư mục `infrastructure/database/seeds/`:

| Tên File | Vai trò & Mục đích |
| --- | --- |
| `01_seed_full_catalog.sql` | Nạp dữ liệu cơ sở cho Catalog: Nhà cung cấp, thương hiệu, danh mục chính. |
| `02_seed_clean_catalog_products.sql` | Nạp 3000+ sản phẩm sạch, phân loại nhóm thuốc cùng các đơn vị bán hàng tương ứng. |
| `03_seed_clean_cms_content.sql` | Nạp các danh mục bài viết y khoa và 54 bài viết tư vấn sức khỏe mẫu. |
| `04_seed_disease_categories.sql` | Nạp danh mục bệnh lý để hỗ trợ tìm kiếm sản phẩm và gợi ý đơn thuốc. |
| `05_seed_demo_promotions.sql` | Nạp các chương trình khuyến mãi mẫu (giảm giá trực tiếp, quà tặng kèm). |
| `06_seed_product_tag_promotions.sql` | Cấu hình khuyến mãi áp dụng theo thẻ sản phẩm (Ví dụ: Thẻ 'Mẹ và Bé', 'Thuốc kê đơn'). |
| `07_seed_demo_baseline.sql` | Dữ liệu nền tảng cho hệ thống: cấu hình giao hàng, các mẫu thông báo (email, sms, zalo) và người dùng hệ thống. |
| `08_seed_daily_activity.sql` | Dữ liệu giao dịch phát sinh giả lập cho ngày hiện tại (`CURDATE()`): bao gồm nhập kho, bán hàng tại quầy POS, đơn hàng web, thay đổi điểm tích lũy và thông báo gửi đi. |

## File Xác thực Chất lượng Dữ liệu
- `verify.sql`: Chứa các câu lệnh SQL tự động kiểm tra tính toàn vẹn của dữ liệu mẫu, đảm bảo số tiền đơn hàng khớp với chi tiết mặt hàng, không có tồn kho âm, không có lô thuốc hết hạn được phép bán, v.v.

## Các quy tắc nghiệp vụ được kiểm soát (Business Rules Checked)
- Sản phẩm đang hoạt động bắt buộc có nhà sản xuất, hoạt chất và số đăng ký.
- Các địa chỉ giao hàng của khách hàng mẫu đều thuộc khu vực Hòa Bình trong bán kính 8km.
- Cấu hình phí vận chuyển hoạt động chính xác theo khoảng cách.
- Số lượng lô hàng tồn kho không bao giờ âm.
- Lô thuốc hết hạn sẽ không thể bán được.
- Tổng số tiền đơn hàng khớp chính xác với đơn giá x số lượng của các mặt hàng bên trong.
- Đơn hàng kê đơn chỉ sử dụng các đơn thuốc mẫu đã được phê duyệt hợp lệ.
