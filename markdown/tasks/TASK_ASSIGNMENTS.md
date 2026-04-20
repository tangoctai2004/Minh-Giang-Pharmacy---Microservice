# 📋 PHÂN CÔNG NHIỆM VỤ — Minh Giang Pharmacy

**Cập nhật:** 20/04/2026 (Đã chốt cấu trúc theo năng lực thực tế của team)  
**Team size:** 4 thành viên  
**Workflow:** Code trên branch riêng → Tạo Pull Request vào `dev` → Leader review → Merge `main`

---

## 🏗️ Tổng Quan Phân Vùng Trách Nhiệm Mới Nhất

Dựa trên việc Leader đã thiết lập xong nền tảng (Docker, Database Schema, Gateway), chiến lược phân chia mới được thiết kế dựa trên điểm mạnh/yếu của từng người:

| Phân công | Vai trò trong hệ thống | Khối lượng | Trạng thái kỹ năng |
|---|---|---|---|
| **Leader (Bạn)** | **Catalog Service** + Infra/DevOps | Rất Nặng | Hiểu rõ hệ thống nhất, xử lý Tồn kho, Giá vốn. |
| **Thành viên 1** | **Toàn bộ Frontend** + API Gateway | Rất Nặng | Cần người cứng tay UI/UX và logic ráp API. |
| **Thành viên 2** | **Order Service & CMS Service** | Khá Nặng | Xử lý logic giỏ hàng, thanh toán, tính toán khuyến mãi. |
| **Thành viên 3** | **Identity & Notification** | Vừa Phải | (Dành cho TV yếu nhất) Code theo pattern có sẵn, chủ yếu làm API tích hợp (Google/Zalo Login, SMS). |

---

## 👑 1. LEADER — Catalog Service & Quản trị Hệ thống

**Database:** `mg_catalog`  
**Nhánh Git:** `service/catalog`  
**Lý do đảm nhận:** Catalog là trái tim của nhà thuốc, chứa nghiệp vụ phức tạp nhất (Lô hàng, Tính toán tồn kho FEFO, Giá nêm yết, Cảnh báo hết hạn). Cần người nắm rõ nhất DB Schema để xây dựng chuẩn xác từ đầu.

### 🎯 Nhiệm vụ chính:
1. **Duy trì hạ tầng:** Quản lý `docker-compose`, DB Scripts chung của dự án (Đã hoàn thành).
2. **Quản trị API Gateway:** Giữ quyền update whitelist các router an toàn.
3. **Phát triển Catalog Service (Hiện tại API mới xong ~30% - Chủ yếu GET)**:
   - **Hoàn thiện Sản phẩm (`/products`):** Code API POST/PUT quản lý thuốc (Hỗ trợ upload ảnh, `product_units` đa đơn vị quy đổi Hộp/Vỉ/Viên).
   - **Luồng Lô Hàng (`/batches`):** Code API phiếu nhập kho (Gán `lot_number`, `expiry_date`, tính giá vốn).
   - **Luồng Tồn Kho (`/inventory`):** Viết logic trừ tồn kho tự động, cảnh báo hàng sắp hết hạn trước 90 ngày.
   - **Hoàn thành các CRUD còn lại:** Categories, Suppliers, Brand, Locations.

---

## 🎨 2. THÀNH VIÊN 1 — Chiến Thần Frontend

**Nhánh Git:** `service/frontend`  
**Lý do đảm nhận:** Việc quy về 1 mối Frontend sẽ làm UI/UX nhất quán, không xảy ra xung đột CSS hay thư viện. Thành viên này không cần quan tâm DB, chỉ cần đọc file Markdown API Mapping và ráp dữ liệu.

### 🎯 Nhiệm vụ chính:
1. **Frontend Admin Portal (`/admin`):**
   - Ráp API Đăng nhập cho nhân viên.
   - Làm màn hình POS bán hàng tĩnh, tích hợp quét mã vạch (Barcode/QR).
   - Xây dựng các trang Quản trị: Nhập hàng, QL Sản phẩm, Duyệt đơn hàng online.
2. **Frontend Website Client (`/client`):**
   - Xây dựng trải nghiệm Mua thuốc Online (Trang chủ Banners, List Thuốc theo bệnh, Chi tiết Thuốc).
   - Ráp luồng Checkout (Giỏ hàng -> Nhập Coupon -> Đặt hàng).
   - Tích hợp đăng nhập Google/Zalo từ API của Thành viên 3.

---

## 🛒 3. THÀNH VIÊN 2 — Order Service & CMS Service

**Database:** `mg_order`, `mg_cms`  
**Nhánh Git:** `service/order`, `service/cms`  
**Lý do đảm nhận:** Order và CMS (Promotions) gắn liền với nhau trong lúc Checkout. Thành viên này sẽ xây dựng cỗ máy kiếm tiền của hệ thống.

### 🎯 Nhiệm vụ chính:
1. **Giỏ hàng & Checkout (Order Service - Đang Trống 100%):**
   - Xây dựng CRUD `/cart` lưu giỏ hàng cho user.
   - Code logic POST `/checkout`: Nhận thông tin giỏ, **gọi API sang Catalog** để check tồn kho, nếu đủ thì thả đơn xuống trạng thái `pending_approval`.
2. **Quản lý Vận đơn (Order Service):**
   - Cung cấp API duyệt/huỷ đơn (`/orders/:id/confirm`, `cancel`).
   - Xây luồng Trả hàng (`/returns`) - Tính toán tiền hoàn lại.
3. **Mã Giảm Giá & Tiếp Thị (CMS Service - Đã xong GET, thiếu POST/PUT):**
   - Viết API tạo/sửa Coupon (`/promotions`).
   - Cốt lõi: Viết API POST `/promotions/:code/validate`. API này nhận vào giá trị đơn hàng và mã Coupon, tính toán số tiền được giảm để trả về cho Order xử lý.
   - Thêm tính năng đăng Bài viết Bệnh lý (`/articles`), upload Banner trang chủ.

---

## 🔐 4. THÀNH VIÊN 3 — Identity & Notification (Tập trung Tích Hợp)

**Database:** `mg_identity`, `mg_notification`  
**Nhánh Git:** `service/identity`, `service/notification`  
**Lý do đảm nhận:** Identity đã được Leader setup sườn cứng (Auth bình thường, DB Roles) xong gần 95%. Thành viên yếu nhất nhận mảng này sẽ dễ thở vì mã nguồn mẫu đã chạy rất ổn, chỉ cần học cách tích hợp SDK của bên thứ 3 và làm các chức năng mở rộng hệ thống.

### 🎯 Hướng phát triển và Nhiệm vụ (Rất rõ ràng, step-by-step):
1. **Tích hợp Đăng nhập Mạng Xã Hội (Identity):**
   - Code luồng POST `/auth/google`: Tích hợp Firebase/Google OAuth2. Sinh token JWT trả về cho Client để login không cần mật khẩu.
   - Code luồng POST `/auth/zalo`: Tích hợp Zalo Login API (Phù hợp với khách mua thuốc ở VN).
2. **Tích hợp Notification thực tế (Notification):**
   - File Email/SMTP đã gửi được qua Nodemailer (Đã xong mẫu).
   - Nhiệm vụ: Tích hợp API gửi tin nhắn thật SMS hoặc Zalo ZNS vào POST `/sms/send` (VD: Đăng ký ESMS.vn hoặc SpeedSMS, gọi axios bắn tin nhắn chứa OTP).
3. **Hoàn thiện User Profile (Identity):**
   - Viết tính năng Upload/Đổi Avatar cho Customer.
   - Hỗ trợ fix bug lặt vặt liên quan đến API Quản lý Roles/Users nếu phát sinh.

*(Lưu ý cho TV3: Việc gọi sang API thứ 3 như Google/Zalo rất phổ biến. Có thể tham khảo doc của họ, dùng thư viện `axios` để `POST/GET` lấy user data, sau đó mới insert vào DB của nhà thuốc và cấp token là xong)*

---

## ⚡ Giao Tiếp Liên Dịch Vụ (Cần Leader chỉ đạo chặt chẽ)
Có những tính năng bắt buộc 2 người phải code khớp với nhau:

- **Khi Khách Đặt Hàng (Thành viên 2 - Order) -> Cần Check Tồn Kho (Leader - Catalog):** Mọi đơn hàng phải gọi HTTP sang Catalog Service.
- **Khi Khách Đăng Ký (Thành viên 3 - Identity) -> Cần Gửi OTP (Thành viên 3 - Notification):** TV3 tự xử lý trong nội dung file của mình.
- **Khi Giao Hàng Thành Công (Thành viên 2 - Order) -> Cấp Điểm Thưởng (Thành viên 3 - Identity):** TV2 publish event hoặc gọi HTTP sang TV3 để cộng điểm `loyalty`.

## 📌 Quản lý tiến độ
Leader cần thường xuyên monitor Pull Requests, đặc biệt là phần logic Checkout của TV2 và phần Schema của chính Leader làm, để đảm bảo FE (Thành viên 1) không bị đói Data để ráp giao diện. Mọi quyết định thay đổi Database đều phải qua Leader.
