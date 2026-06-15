# 🏥 Minh Giang Pharmacy - Hệ thống Quản lý Nhà thuốc (Microservices Stack)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-v2+-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-Message_Queue-FF6600?logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)

Dự án phát triển Hệ thống quản lý nhà thuốc **Minh Giang** theo kiến trúc Microservices — được xây dựng phục vụ cho môn học **Kiến trúc hướng dịch vụ (SOA 2026)**.

---

## 🗺️ 1. Kiến Trúc Hệ Thống Tổng Quan

Hệ thống được thiết kế theo mô hình Microservices phân lớp, giao tiếp qua API Gateway đồng thời trao đổi bất đồng bộ qua Message Broker (RabbitMQ).

```text
       ┌────────────────────────────────────────────────────────┐
       │             Browser / POS / Admin (Frontend)           │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
                   ┌──────────────────────────────┐
                   │     API Gateway (Cổng 8000)   │ <─── JWT verify tập trung
                   └───────────────┬──────────────┘
                                   │
         ┌───────────────┬─────────┼─────────┬───────────────┐
         ▼               ▼         ▼         ▼               ▼
     [Cổng 8001]    [Cổng 8002] [Cổng 8003] [Cổng 8004]     [Cổng 8005]
    ┌───────────┐  ┌───────────┐┌──────────┐┌───────────┐  ┌───────────┐
    │ Identity  │  │  Catalog  ││  Order   ││    CMS    │  │Notification
    │  Service  │  │  Service  ││ Service  ││  Service  │  │  Service  │
    └─────┬─────┘  └─────┬─────┘└────┬─────┘└─────┬─────┘  └─────┬─────┘
          │              │           │            │              │
          └──────────────┼───────────┼────────────┼──────────────┘
                         ▼           ▼            ▼
                   ┌──────────────────────────────────────┐
                   │    MySQL 8.0 (Mỗi service 1 schema)   │
                   │    RabbitMQ (Truyền tin bất đồng bộ)   │
                   └──────────────────────────────────────┘
```

### Bản đồ Cổng Dịch vụ & Cơ sở dữ liệu

| Microservice | Port | Cơ sở dữ liệu / Schema | Mô tả chức năng |
| :--- | :---: | :--- | :--- |
| **API Gateway** | `8000` | — | Định tuyến yêu cầu, kiểm tra JWT tập trung |
| **Identity Service** | `8001` | `mg_identity` | Quản lý tài khoản, phân quyền, ca làm việc (Shift) |
| **Catalog Service** | `8002` | `mg_catalog` | Quản lý sản phẩm, danh mục, kho hàng, nhà cung cấp |
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
   git clone <URL_REPOSITOY_CỦA_NHÓM>
   cd "Minh Giang Pharmacy"
   ```

2. **Thiết lập biến môi trường**:
   Sao chép tệp cấu hình mẫu `.env.example` thành `.env` ở thư mục gốc:
   ```bash
   cp .env.example .env
   ```
   *(Bạn có thể mở tệp `.env` vừa tạo để thay đổi mã bảo mật `JWT_SECRET` hoặc cấu hình SMTP gửi email nếu cần).*

3. **Khởi chạy hệ thống**: Có 3 cách đơn giản để chạy toàn bộ hệ thống (Database, Services và Frontend):

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
     - **Trên Windows:** Chạy trực tiếp qua Git Bash hoặc chạy [local-menu.bat](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/local-menu.bat) bằng Command Prompt.

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

Dự án đã tích hợp kịch bản kiểm thử hợp nhất [test.sh](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/test.sh) ở thư mục gốc giúp kiểm tra nhanh xem các API Backend có hoạt động ổn định hay không:

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
                         - Giải mã JWT token          - x-user-id
                         - Gắn quyền vào Header       - x-user-role
                                                      - x-user-type
```
*Tất cả các route công khai (Public Routes) như lấy danh sách sản phẩm, tin tức sẽ được Gateway cho qua trực tiếp. Đối với các route bảo mật, Gateway sẽ chặn lại, xác thực JWT và chuyển thông tin giải mã xuống các service con qua Custom Headers để xử lý tiếp.*

---

## 📐 6. Quy Ước Phát Triển Nhóm

- **Git Branching**:
  - Nhánh bảo vệ chính: `main`
  - Nhánh tích hợp chính: `dev`
  - Nhánh phát triển tính năng: `feature/ten-chuc-nang` hoặc `service/ten-service`
- **Git Commit Message**:
  - Định dạng: `<type>: <mô tả ngắn bằng tiếng Việt>`
  - Ví dụ: `feat: tích hợp api thanh toán hóa đơn` hoặc `fix: sửa lỗi query tồn kho`
- **Quy tắc Code (Coding Conventions)**: Mọi API trả về định dạng JSON đều bắt buộc tuân thủ quy tắc có trường `{ success: true/false, data: ... }`. Đọc kĩ tài liệu chi tiết tại [docs/CODING_CONVENTIONS.md](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs/CODING_CONVENTIONS.md).

---

## 📚 7. Mục Lục Tài Liệu Kỹ Thuật (Docs)

Để tìm hiểu chi tiết hơn về từng phân hệ, vui lòng truy cập các tài liệu tương ứng nằm trong thư mục [docs/](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs):

1. 🚀 **Hướng dẫn Thiết lập chi tiết**: [docs/SETUP.md](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs/SETUP.md) — Hướng dẫn cài đặt chi tiết trên Windows/Mac, sửa các lỗi cổng bị bận.
2. 🔒 **Chính sách & Quy chuẩn Bảo mật**: [docs/SECURITY.md](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs/SECURITY.md) — Cách quản lý mã bảo mật, tránh rò rỉ file cấu hình `.env` lên Git.
3. 📐 **Quy chuẩn Code & API**: [docs/CODING_CONVENTIONS.md](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs/CODING_CONVENTIONS.md) — Chi tiết về MySQL query patterns, soft delete, và định dạng JSON response.
4. ⛓️ **Hướng dẫn sử dụng Git**: [docs/GIT_GUIDE.md](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs/GIT_GUIDE.md) — Lộ trình phối hợp kéo code, đẩy code và mở PR cho nhóm.
5. 🤖 **Quy tắc làm việc với AI**: [docs/AI_RULES.md](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs/AI_RULES.md) — Định hướng khi sử dụng các mô hình AI hỗ trợ sinh code.
6. 📋 **Danh sách Phân công Công việc**: [docs/tasks/TASK_ASSIGNMENTS.md](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs/tasks/TASK_ASSIGNMENTS.md) — Nhiệm vụ và phân rã các sprint cho từng thành viên.
7. 🔌 **Bản đồ Ánh xạ API (API Mappings)**: [docs/api-mapping/](file:///Users/tangoctai/StudySpace/SOA.2026/Minh%20Giang%20Pharmacy/docs/api-mapping/) — Bản đồ mô tả UI HTML gọi API cụ thể nào ở Backend.
