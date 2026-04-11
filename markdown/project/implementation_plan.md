# 🚀 Kế Hoạch Triển Khai Đồ Án Microservices Thực Chiến

Với tư cách là một người đi trước, tôi sẽ vạch ra cho bạn một lộ trình **thực tế, rõ ràng và tối ưu nhất** cho nhóm 4 người (1 Mac, 3 Win). Bài toán của chúng ta là hệ thống Quản lý nhà thuốc Minh Giang theo kiến trúc Microservices.

Mục tiêu cốt lõi: **"Làm sao để ráp được code của 4 người lại với nhau một cách trơn tru, chạy được mô hình Microservice trên 1 máy lúc đi báo cáo, và không bị conflict hay dẫm chân lên nhau trong quá trình làm."**

---

## 🏗️ 1. Cấu Trúc Source Code (Monorepo)

**TUYỆT ĐỐI KHÔNG** để mỗi người tự tạo một repo Github riêng. Hãy dùng chung **1 repo duy nhất (Monorepo)**. Việc này giúp trưởng nhóm dễ dàng control toàn bộ source code và viết file `docker-compose` thống nhất toàn hệ thống để deploy ứng dụng chỉ bằng 1 câu lệnh.

Cấu trúc thư mục chuẩn cần thiết lập:

```text
MinhGiangPharmacy/
├── frontend/                 # Team FE làm việc ở đây
│   ├── web/                  # Giao diện cho khách hàng
│   ├── admin/                # Giao diện quản trị, quản lý
│   └── kiosk/                # Giao diện tại quầy bán hàng
│
├── backend/                  # Team BE làm việc ở đây
│   ├── gateway/              # Kong/Nginx/Spring Cloud (Nhận toàn bộ request từ FE)
│   ├── user-service/         # Quản lý tài khoản, phân quyền (NodeJS/Java)
│   ├── product-service/      # Quản lý thuốc, danh mục, tồn kho (NodeJS/Java)
│   └── order-service/        # Quản lý giỏ hàng, hóa đơn, thanh toán (NodeJS/Java)
│
├── infrastructure/           # Hạ tầng dùng chung (Trưởng nhóm lo)
│   ├── database/             # File init SQL (Schema, bảng, dummy data)
│   └── postman/              # Chứa file export API Collection để cả nhóm test chung
│
├── .gitignore                # Rất quan trọng (Bỏ node_modules, target, .idea, .vscode...)
├── docker-compose.yml        # Chìa khóa để chạy cả hệ thống lúc báo cáo (Trưởng nhóm viết)
└── README.md                 # Hướng dẫn chi tiết cách run dự án gốc
```

---

## 👥 2. Phân Công Nhiệm Vụ Cho 4 Người

Đừng bắt ai làm full-stack từ đầu đến cuối một chức năng nếu họ không cứng. Hãy chia theo **Thế mạnh & Trách nhiệm**.

### 👑 Trưởng nhóm (Bạn - Mac)
*Vai trò: DevOps, Architect, Core Backend.*
- **Nhiệm vụ 1:** Khởi tạo project (Monorepo như trên), cấu hình `.gitignore`, đẩy lên Github.
- **Nhiệm vụ 2:** Viết cấu hình `docker-compose.yml` để dựng các database chung (MySQL/Postgres) và Message Queue (RabbitMQ) chạy ngầm để các bạn Win chỉ cần pull về và gõ `docker-compose up -d` là có DB dùng, không phải tự cài trên máy Win mệt mỏi.
- **Nhiệm vụ 3:** Code `api-gateway`. Tích hợp logic check JWT Token (Authentication) ở ngay tầng này. Đừng để các service con tự check token, lặp code rất nhiều. (Nghĩa là khách gọi API -> Gateway -> Gateway decode JWT hợp lệ -> Forward xuống service con).
- **Nhiệm vụ 4:** Code `user-service` (Đăng nhập, cấp Token JWT, Phân quyền).

### 💻 Thành viên 2 (Win)
*Vai trò: Backend Core API.*
- **Nhiệm vụ 1:** Nhận `product-service` (CRUD thuốc, loại thuốc, tìm kiếm, tồn kho...).
- **Nhiệm vụ 2:** Đơn giản hóa chức năng, tập trung vào API trả về chuẩn RESTful JSON. Giữ liên lạc với người làm FE để thống nhất format dữ liệu API.

### 💻 Thành viên 3 (Win)
*Vai trò: Backend Core Object.*
- **Nhiệm vụ 1:** Nhận `order-service` (Tạo đơn, giỏ hàng, doanh thu).
- **Nhiệm vụ 2:** Học cách gọi API nội bộ từ order-service sang product-service (REST hoặc gRPC/Kafka tùy độ phức tạp) để lấy giá tiền, trừ tồn kho lúc bán hàng. Đây là điểm then chốt để thể hiện tính chất Microservices.

### 🎨 Thành viên 4 (Win)
*Vai trò: Frontend Master.*
- **Nhiệm vụ 1:** Chịu trách nhiệm 100% thư mục `frontend/`. Chia nhỏ các module (Admin, Web, Kiosk).
- **Nhiệm vụ 2:** Mapping các components UI với API mà 3 người BE đã viết. (Note: Cứ trỏ thẳng toàn bộ API call về cổng của `api-gateway` thay vì trỏ lắt nhắt từng cồng của từng service).

---

## 🛠️ 3. Vấn Đề Đau Đầu Nhất: Chạy Code Trên Máy Win/Mac Khác Nhau

Máy bạn dùng Mac, các bạn kia dùng Win. Cách giải quyết vấn đề "Máy tao chạy được, máy mày lỗi":

1. **Thống nhất Version Công cụ:** Mọi người tải cùng 1 bản NodeJS (vd 18 LTS) hay Java (vd 17).
2. **Dùng chung Database Dockerized:** 
   - Không ai tải phần mềm MySQL hay SQL Server cài trực tiếp vào Win/Mac. 
   - Ở máy trưởng nhóm, bạn tạo file `docker-compose.yml` có chứa container Database (vd: MySQL port 3306), có mount volume để lưu data và init các bảng tự động. Các bạn dùng Win chỉ việc xài **Docker Desktop** start lên, dùng DBeaver hoặc Navicat connect vào `localhost:3306` là xong. Database sẽ y hệt nhau ở cả 4 máy.
3. **Môi trường (Environment variables):**
   - Không push file `.env` chứa mật khẩu, config nhạy cảm lên Github.
   - Thư mục backend của mỗi người tạo 1 file `.env.example` chứa các biến cần thiết (vd: `DB_HOST=localhost`, `DB_PORT=3306`), thành viên pull code về tự đổi tên thành `.env` để chạy nội bộ máy họ.

---

## 🚦 4. Quy Trình Làm Việc Hàng Ngày (Workflow)

1. **Quy tắc Git:** Quên việc master/main tự do đi. Cài đặt **branch protection**.
   - Trưởng nhóm duyệt mọi PR (Pull Request) trước khi cho merge vào `main`.
   - Mỗi người làm 1 tính năng thì tạo branch mới: `feature/ten-service-chuc-nang` (vd: `feature/product-crud`).
   - Xong chức năng -> Push nhánh đó lên -> Gửi PR cho trưởng nhóm review code, ok mới bấm Merge.
2. **First API First (Thiết kế API trước):** 
   - Team BE và FE dùng chung 1 công cụ (như Postman Workspace chung, hoặc đơn giản là viết file Excel/Google Docs). 
   - Bàn trước với nhau: *"Trang danh sách thuốc, URL API là gì? JSON trả về cấu trúc ra sao?"*. Chốt xong thì bạn BE đi code, bạn FE đi mock data (gắn dữ liệu tĩnh) để làm UI trước. Khi nào BE code xong API thì FE chỉ việc đổi URL vào là chạy (không phải đợi nhau).

---

## 🚀 5. Checklist Trong Tuần Tới (Sprint 1)

1. Trưởng nhóm dọn dẹp thư mục hiện tại theo cấu trúc ở Phần 1.
2. Set up Repo Github, invite 3 người kia vào.
3. Chốt ngôn ngữ/framework. (Tôi khuyên dùng **Node.js/Express** hoặc **Java/Spring Boot** cho BE vì dễ học và nhiều tài liệu Microservice). Cho Frontend, tận dụng bản HTML/CSS hiện tại, ghép logic JS.
4. Trưởng nhóm viết xong `docker-compose.yml` nháp chỉ chạy MySQL lên, đẩy lên để anh em clone về test thử xem kết nối Database chuẩn chưa.

---

Bạn (với tư cách Trưởng nhóm) thấy phương án này thế nào? Chúng ta sẽ bắt tay vào việc **sắp xếp lại cấu trúc thư mục thực tế trong máy bạn** nhé, hay bạn muốn tôi tạo sẵn một file `docker-compose.yml` mẫu để bạn trải nghiệm trước?
