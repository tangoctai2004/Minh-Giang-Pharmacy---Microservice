# Phần mềm Quản Lý Nhà Thuốc Minh Giang (Microservices)

Dự án phát triển Hệ thống quản lý nhà thuốc Minh Giang theo kiến trúc Microservices dành cho môn học SOA.

## 🚀 Cấu trúc dự án (Monorepo)

- `frontend/`: Toàn bộ mã nguồn giao diện (Web Client, Admin, Kiosk/POS).
- `backend/`: Chứa các Microservices độc lập (Gateway, User Service, Product Service, v.v.).
- `infrastructure/`: Các file cấu hình chung (như script thiết lập Database, thư mục chứa Postman collections).

## 🛠 Hướng dẫn chạy môi trường nội bộ (Toàn đội bắt buộc đọc)

Để các bạn dùng Windows và Mac không bị lệch môi trường, chúng ta dùng Docker để giả lập DB và Message broker chung.
Yêu cầu: Máy mỗi bạn cần **cài Docker Desktop**.

Từ thư mục gốc (nơi chứa file `docker-compose.yml`), khởi chạy các dịch vụ Data bằng lệnh:
```bash
docker-compose up -d
```

Các dịch vụ sẽ chạy bao gồm:
- **MySQL**: `localhost:3306`
  - User: `root`
  - Pass: `root`
  - Tên Database có sẵn: `minhgiang_db`
- **RabbitMQ** (Tuỳ chọn cho giao tiếp bất đồng bộ): `localhost:5672`
  - Giao diện Admin RabbitMQ: `http://localhost:15672` (User/Pass: `guest`/`guest`)

## 👥 Convention làm việc nhóm (Rất quan trọng)
1. **Luôn lấy code mới nhất** về trước khi code: `git pull origin main`
2. **Luôn tạo nhánh mới** để làm chức năng: `git checkout -b feature/ten-chuc-nang`
3. Code xong, **push nhánh đó lên Github** rồi tạo Pull Request (PR). Không commit thẳng vào main!
4. Tuyệt đối **KHÔNG PUSH file `.env`** lên Github. Mọi người chỉ tạo/sửa file `.env.example` để người khác nhìn biết cần những biến môi trường nào.
5. Khi người BE thay đổi bảng trong Database, hãy export schema ra file script SQL, ném vào `infrastructure/database/init.sql` rồi commit lên để máy khác pull về tự động nhận được bảng mới.
