# ════════════════════════════════════════════════════════════════
# Minh Giang Pharmacy — Hệ thống Quản lý Nhà thuốc Microservices
# ════════════════════════════════════════════════════════════════

Chào mừng bạn đến với hệ thống microservices của Nhà thuốc Minh Giang. Dự án này được thiết kế và vận hành dưới dạng kiến trúc microservices sử dụng Node.js, Express, MySQL, Redis, RabbitMQ và giao diện tĩnh (HTML/CSS/JS).

---

## 🏗️ 1. Kiến Trúc & Phân Hệ Dịch Vụ

Hệ thống bao gồm các phân hệ chính sau:

```text
                               ┌─────────────────┐
                               │  Client Browser │
                               └────────┬────────┘
                                        │ (HTTP/WS)
                                        ▼
                               ┌─────────────────┐
                               │   API Gateway   │ (Port 8000)
                               └────────┬────────┘
                                        │ (Routing & Auth)
         ┌──────────────┬───────────────┼───────────────┬──────────────┐
         ▼              ▼               ▼               ▼              ▼
   ┌───────────┐  ┌───────────┐   ┌───────────┐   ┌───────────┐  ┌───────────┐
   │ Identity  │  │  Catalog  │   │   Order   │   │    CMS    │  │Notification│
   │  Service  │  │  Service  │   │  Service  │   │  Service  │  │  Service  │
   │(Port 8001)│  │(Port 8002)│   │(Port 8003)│   │(Port 8004)│  │(Port 8005)│
   └───────────┘  └───────────┘   └───────────┘   └───────────┘  └───────────┘
```

### Bản đồ Cổng Dịch vụ & Cơ sở dữ liệu

| Microservice | Port | Cơ sở dữ liệu / Schema | Mô tả chức năng |
| :--- | :---: | :--- | :--- |
| **API Gateway** | `8000` | — | Định tuyến yêu cầu, kiểm tra JWT tập trung |
| **Identity Service** | `8001` | `mg_identity` | Quản lý tài khoản, phân quyền, ca làm việc (Shift) |
| **Catalog Service** | `8002` | `mg_catalog` | Quản lý sản phẩm, danh mục, tồn kho, nhà cung cấp |
| **Order Service** | `8003` | `mg_order` | Quản lý giỏ hàng, đặt hàng (Checkout), hóa đơn, trả hàng |
| **CMS Service** | `8004` | `mg_cms` | Quản lý tin tức, chương trình khuyến mãi, cấu hình cửa hàng |
| **Notification Service** | `8005` | `mg_notification` | Gửi Email thông báo (Nodemailer), stub SMS |
| **RabbitMQ** | `15672` | — | UI Quản trị Message Queue (`guest`/`guest`) |
| **MySQL Database** | `3306` | `root` / `root` | Database engine chung cho toàn bộ services con |

---

## 🛠️ 2. Hướng Dẫn Khởi Chạy Nhanh (Quick Start)

### Yêu cầu hệ thống
- **Docker Desktop** (Bắt buộc)
- **Node.js (v18 trở lên)** (Để chạy debug cục bộ hoặc chạy test)
- **Git**

### Các bước cài đặt

1. **Clone dự án và truy cập thư mục gốc**:
   ```bash
   git clone <URL_REPOSITORY>
   cd "Minh Giang Pharmacy"
   ```

2. **Thiết lập biến môi trường**:
   Sao chép tệp cấu hình mẫu `.env.example` thành `.env` ở thư mục gốc:
   ```bash
   cp .env.example .env
   ```
   *(Bạn có thể mở tệp `.env` vừa tạo để thay đổi mã bảo mật `JWT_SECRET` hoặc cấu hình SMTP gửi email nếu cần).*

3. **Khởi chạy hệ thống**: Có 3 cách đơn giản để chạy toàn bộ hệ thống (Database, Services và Giao diện):

   * **👉 Cách 1: Sử dụng phím tắt trong VS Code (Khuyên dùng)**
     Mở dự án bằng VS Code, sau đó nhấn tổ hợp phím:
     - **macOS:** `Cmd + Shift + B`
     - **Windows:** `Ctrl + Shift + B`
     *Hệ thống sẽ tự động chạy Docker services, bật server frontend tĩnh và hiển thị menu tương tác ngay trên VS Code.*

   * **👉 Cách 2: Chạy qua menu kịch bản tương tác**
     - **Trên macOS / Linux:**
       ```bash
       ./local-menu.sh
       ```
     - **Trên Windows:** Chạy trực tiếp qua Git Bash hoặc chạy `local-menu.bat` bằng Command Prompt.

   * **👉 Cách 3: Chạy trực tiếp bằng Docker Compose CLI**
     ```bash
     docker compose up -d --build
     ```

---

## 🗺️ 3. Đường Dẫn Truy Cập Giao Diện

Sau khi hệ thống khởi chạy thành công, frontend tĩnh được host tại cổng `5500` (hoặc cổng tự động tìm thấy tiếp theo như `5501`):

- **Trang Khách Hàng:** [http://localhost:5500/client/index.html](http://localhost:5500/client/index.html)
- **Trang Quản Trị (Admin):** [http://localhost:5500/admin/login.html](http://localhost:5500/admin/login.html)
- **Trang Bán Hàng Tại Quầy (POS):** [http://localhost:5500/pos/login.html](http://localhost:5500/pos/login.html)

---

## 🧪 4. Chạy Kiểm Thử Tự Động (Integration Tests)

Dự án đã tích hợp kịch bản kiểm thử hợp nhất `test.sh` ở thư mục gốc giúp kiểm tra nhanh xem các API Backend có hoạt động ổn định hay không:

* **Chạy toàn bộ kiểm thử hệ thống**:
  ```bash
  ./test.sh
  # Hoặc
  ./test.sh all
  ```
* **Chạy kiểm thử riêng lẻ từng phân hệ**:
  ```bash
  ./test.sh auth         # Kiểm thử Đăng nhập, Tài khoản & Ca làm việc
  ./test.sh cms          # Kiểm thử Tin tức & Khuyến mãi
  ./test.sh order        # Kiểm thử Giỏ hàng & Hóa đơn
  ./test.sh promotions   # Kiểm thử logic Vouchers & Quà tặng tự động
  ```

---

## 🔒 5. Luồng Xác Thực JWT Tập Trung

```text
Client (Web/Admin/POS) ────► API Gateway (Port 8000) ────► Microservices (Port 800x)
                         [Xác thực JWT Token]         [Nhận thông tin qua Header]
                         - x-user-id, x-user-role, x-user-type
```
Tất cả các route công khai (Public Routes) như lấy danh sách sản phẩm, tin tức sẽ được Gateway cho qua trực tiếp. Đối với các route bảo mật, Gateway sẽ chặn lại, xác thực JWT và chuyển thông tin giải mã xuống các service con qua Custom Headers để xử lý tiếp.

---

## 📐 6. Quy Ước Phát Triển Nhóm

- **Git Branching**:
  - Nhánh bảo vệ chính: `main`
  - Nhánh tích hợp chính: `dev`
  - Nhánh phát triển tính năng: `feature/ten-chuc-nang` hoặc `service/ten-service`
- **Git Commit Message**:
  - Định dạng: `<type>: <mô tả ngắn bằng tiếng Việt>`
  - Ví dụ: `feat: tích hợp api thanh toán hóa đơn` hoặc `fix: sửa lỗi query tồn kho`
- **Quy tắc Code & Bảo mật**: Chi tiết về cách viết code sạch và bảo mật, xem thêm tại [Quy ước lập trình](./markdown/huong-dan/quy-uoc-lap-trinh.md) và [Quy tắc bảo mật](./markdown/huong-dan/quy-tac-bao-mat.md).

---

## 📚 7. Mục Lục Tài Liệu Kỹ Thuật (Docs)

Tất cả tài liệu kỹ thuật chi tiết đã được chuyển về thư mục `/markdown` tại gốc dự án. Bạn có thể xem toàn bộ tại [Mục lục tài liệu](./markdown/00-muc-luc-tai-lieu.md) hoặc truy cập nhanh các mục sau:

1. 🚀 **Hướng dẫn cài đặt chi tiết**: [Hướng dẫn chạy local](./markdown/huong-dan/huong-dan-cai-dat-va-chay-local.md)
2. 🔒 **Chính sách bảo mật**: [Quy tắc bảo mật](./markdown/huong-dan/quy-tac-bao-mat.md)
3. 📐 **Quy chuẩn lập trình**: [Quy ước lập trình](./markdown/huong-dan/quy-uoc-lap-trinh.md)
4. 💾 **Hướng dẫn Database**: [Cài đặt database](./markdown/co-so-du-lieu/huong-dan-cai-dat-database.md)
5. 🔌 **Tài liệu API**: [Danh mục API Catalog](./markdown/api/catalog/api-catalog-hien-tai.md) | [Tài liệu API CMS](./markdown/dich-vu/cms/tai-lieu-api-cms-service.md)
