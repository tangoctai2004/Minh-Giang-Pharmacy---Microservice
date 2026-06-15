# Minh Giang Pharmacy - Hướng Dẫn Cài Đặt & Chạy Dự Án (Microservices Stack)

Tài liệu này hướng dẫn chi tiết cách tải (clone), build và khởi chạy dự án **Minh Giang Pharmacy** dành cho mọi thành viên trong nhóm phát triển (cả trên macOS và Windows).

---

## 🛠 1. Yêu Cầu Hệ Thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:

1. **Git**: Để clone và quản lý mã nguồn.
2. **Docker & Docker Desktop**: Bắt buộc phải cài đặt để chạy các microservices, database và RabbitMQ.
3. **Node.js (v16 trở lên)**: Để cài đặt package hoặc chạy test nếu cần.
4. **Python (v3.x)**: Dùng để khởi chạy server cho Frontend tĩnh (tích hợp trong file menu).
5. **VS Code (Visual Studio Code)**: Trình chỉnh sửa code khuyên dùng.

---

## 🚀 2. Các Bước Cài Đặt & Chạy Dự Án

### Bước 1: Clone Dự Án Về Máy Local
Mở terminal (trên Mac) hoặc Git Bash (trên Windows) và chạy lệnh:
```bash
git clone <URL_REPOSITOY_CỦA_NHÓM>
cd "Minh Giang Pharmacy"
```

### Bước 2: Thiết Lập File Môi Trường (Environment Variables)
Sao chép file cấu hình mẫu `.env.example` thành file `.env` ở thư mục gốc:
* **macOS / Linux / Windows (Git Bash):**
  ```bash
  cp .env.example .env
  ```
* **Windows (PowerShell / CMD):**
  ```powershell
  copy .env.example .env
  ```
*(Bạn có thể mở file `.env` vừa tạo để thay đổi mã bảo mật `JWT_SECRET` hoặc cấu hình SMTP gửi email nếu cần).*

### Bước 3: Khởi Chạy Hệ Thống
Có 3 cách cực kỳ đơn giản để chạy toàn bộ hệ thống (Docker database, services và frontend):

#### 👉 Cách 1: Sử dụng phím tắt trong VS Code (Khuyên dùng - Cả Windows & Mac)
Mở dự án bằng VS Code, sau đó nhấn tổ hợp phím:
* **macOS:** `Cmd + Shift + B`
* **Windows:** `Ctrl + Shift + B`
*Hệ thống sẽ tự động chạy Docker services, bật server frontend và hiển thị menu tương tác ngay trên VS Code.*

#### 👉 Cách 2: Chạy qua file Script chạy nhanh
* **Trên macOS:**
  ```bash
  ./local-menu.sh
  ```
* **Trên Windows:** Chỉ cần kích đúp chuột vào file [local-menu.bat](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/local-menu.bat) hoặc mở terminal (CMD/PowerShell) gõ:
  ```cmd
  .\local-menu.bat
  ```

#### 👉 Cách 3: Chạy chay bằng dòng lệnh Docker thủ công
Nếu bạn không muốn sử dụng menu tương tác:
```bash
# Build và chạy ngầm tất cả các container
docker compose up -d --build
```

---

## 🗺 3. Bản Đồ Cổng Dịch Vụ & Địa Chỉ Truy Cập

Sau khi chạy thành công, hệ thống sẽ mở các cổng dịch vụ sau trên máy của bạn (`localhost`):

| Tên Dịch Vụ / Ứng Dụng | Cổng (Port) | Đường Dẫn Truy Cập / API Endpoint |
| :--- | :---: | :--- |
| **Trang khách hàng** | `5500` / `5501` | http://localhost:5500/client/index.html |
| **Trang Admin** | `5500` / `5501` | http://localhost:5500/admin/login.html |
| **Trang POS** | `5500` / `5501` | http://localhost:5500/pos/login.html |
| **API Gateway** (Điểm nhận request) | `8000` | http://localhost:8000/api/... |
| **Identity Service** (Auth/User) | `8001` | http://localhost:8001/health |
| **Catalog Service** (Sản phẩm) | `8002` | http://localhost:8002/health |
| **Order Service** (Giỏ hàng/Đơn hàng) | `8003` | http://localhost:8003/health |
| **CMS Service** (Tin tức/Khuyến mãi) | `8004` | http://localhost:8004/health |
| **Notification Service** (Email) | `8005` | http://localhost:8005/health |
| **RabbitMQ** (Message Queue) | `15672` | http://localhost:15672 (TK/MK: `guest`/`guest`) |
| **MySQL Database** | `3306` | Khách: `minhgiang_db`, TK/MK: `root`/`root` |

---

## 🧪 4. Chạy Kiểm Thử Tự Động (Integration Tests)

Dự án đi kèm các file script giúp kiểm tra nhanh xem các API Backend có hoạt động ổn định hay không. Hãy chạy các lệnh này trước khi push code lên Git:

* **Test tổng quan hệ thống Auth & Identity:**
  ```bash
  bash test_all.sh
  ```
* **Test luồng Giỏ hàng & Đặt hàng:**
  ```bash
  bash test_order.sh
  ```
* **Test luồng CMS:**
  ```bash
  bash test_cms.sh
  ```

---

## 🚨 5. Một Số Lỗi Thường Gặp & Cách Khắc Phục

### 1. Lỗi cổng `3306` hoặc `5500` đã được sử dụng
* **Mô tả:** Không start được MySQL Container hoặc Frontend.
* **Khắc phục:** Tắt phần mềm MySQL cục bộ trên máy của bạn (nếu có) để nhường cổng `3306` cho Docker. Đối với Frontend, kịch bản chạy sẽ tự động tìm cổng trống tiếp theo (như `5502`, `5503`) nếu cổng `5500` bị bận.

### 2. Lỗi `\r: command not found` khi chạy script trên Windows
* **Mô tả:** Do Git trên Windows tự động chuyển định dạng dòng (Line Ending) từ LF thành CRLF.
* **Khắc phục:** Mở file bị lỗi trong VS Code, nhìn xuống góc dưới bên phải màn hình, click vào chữ **`CRLF`** và chuyển nó thành **`LF`**, sau đó lưu lại file. *(Dự án đã tích hợp cấu hình tự động sửa lỗi này thông qua file `.gitattributes`)*.

### 3. Docker báo lỗi `daemon is not running`
* **Khắc phục:** Hãy chắc chắn bạn đã mở phần mềm **Docker Desktop** trước khi chạy lệnh build/chạy hệ thống.
