# 📋 PHÂN CÔNG NHIỆM VỤ — Minh Giang Pharmacy

**Cập nhật:** 10/04/2026  
**Team size:** 4 thành viên  
**Workflow:** Mỗi TV code trên branch riêng → merge vào `dev` → leader review → merge `main`

---

## 🏗️ Tổng Quan Kiến Trúc

| Service             | Port | Database       | Branch            |
|---------------------|------|----------------|-------------------|
| API Gateway         | 8000 | —              | `dev`             |
| Identity Service    | 8001 | `mg_identity`  | `service/identity`|
| Catalog Service     | 8002 | `mg_catalog`   | `service/catalog` |
| Order Service       | 8003 | `mg_order`     | `service/order`   |
| CMS Service         | 8004 | `mg_cms`       | `service/frontend`|
| Notification Service| 8005 | `mg_notification`| `service/frontend`|

---

## 👥 Phân Công Theo Thành Viên

### TV1 — Identity Service (`service/identity`)

**Phạm vi:** Quản lý tài khoản, xác thực, phân quyền, ca làm việc

| # | Endpoint                           | Method | Mô tả                        | Ưu tiên |
|---|-------------------------------------|--------|-------------------------------|---------|
| 1 | `/auth/login`                      | POST   | Đăng nhập (JWT token)        | 🔴 Cao  |
| 2 | `/auth/register`                   | POST   | Đăng ký customer              | 🔴 Cao  |
| 3 | `/auth/me`                         | GET    | Lấy thông tin user hiện tại   | 🔴 Cao  |
| 4 | `/auth/change-password`            | PUT    | Đổi mật khẩu                 | 🟡 TB   |
| 5 | `/users`                           | GET    | Danh sách nhân viên           | 🟡 TB   |
| 6 | `/users`                           | POST   | Tạo nhân viên mới             | 🟡 TB   |
| 7 | `/users/:id`                       | GET    | Chi tiết nhân viên            | 🟡 TB   |
| 8 | `/users/:id`                       | PUT    | Cập nhật nhân viên            | 🟡 TB   |
| 9 | `/users/:id`                       | DELETE | Xóa/vô hiệu hóa nhân viên   | 🟢 Thấp|
| 10| `/customers`                       | GET    | Danh sách khách hàng          | 🟡 TB   |
| 11| `/customers/:id`                   | GET    | Chi tiết khách hàng           | 🟡 TB   |
| 12| `/customers/:id`                   | PUT    | Cập nhật khách hàng           | 🟡 TB   |
| 13| `/customers/:id/loyalty`           | GET    | Điểm tích lũy                | 🟢 Thấp|
| 14| `/roles`                           | GET    | Danh sách vai trò             | 🟢 Thấp|
| 15| `/shifts`                          | GET    | Danh sách ca làm việc         | 🟢 Thấp|
| 16| `/shifts`                          | POST   | Mở ca mới                    | 🟢 Thấp|
| 17| `/shifts/:id/close`                | PUT    | Đóng ca                      | 🟢 Thấp|

**Checklist:**
- [ ] Login + Register + JWT token → test bằng Postman
- [ ] `/auth/me` trả đúng thông tin user
- [ ] CRUD users (nhân viên)
- [ ] CRUD customers
- [ ] Shifts (mở/đóng ca)
- [ ] Roles listing

---

### TV2 — Catalog Service (`service/catalog`)

**Phạm vi:** Sản phẩm, danh mục, nhà cung cấp, kho hàng, lô hàng, chi nhánh

| # | Endpoint                           | Method | Mô tả                        | Ưu tiên |
|---|-------------------------------------|--------|-------------------------------|---------|
| 1 | `/products`                        | GET    | Danh sách SP ✅ (đã impl)     | ✅ Done |
| 2 | `/products/:id`                    | GET    | Chi tiết SP ✅ (đã impl)      | ✅ Done |
| 3 | `/products`                        | POST   | Tạo sản phẩm mới             | 🔴 Cao  |
| 4 | `/products/:id`                    | PUT    | Cập nhật sản phẩm            | 🔴 Cao  |
| 5 | `/products/:id`                    | DELETE | Xóa sản phẩm (soft delete)   | 🟡 TB   |
| 6 | `/categories`                      | GET    | Danh sách danh mục           | 🔴 Cao  |
| 7 | `/categories`                      | POST   | Tạo danh mục                 | 🟡 TB   |
| 8 | `/categories/:id`                  | PUT    | Sửa danh mục                 | 🟡 TB   |
| 9 | `/categories/:id`                  | DELETE | Xóa danh mục                 | 🟢 Thấp|
| 10| `/suppliers`                       | GET    | Danh sách NCC               | 🟡 TB   |
| 11| `/suppliers`                       | POST   | Tạo NCC                     | 🟡 TB   |
| 12| `/suppliers/:id`                   | PUT    | Sửa NCC                     | 🟡 TB   |
| 13| `/suppliers/:id`                   | DELETE | Xóa NCC                     | 🟢 Thấp|
| 14| `/inventory`                       | GET    | Tồn kho hiện tại             | 🔴 Cao  |
| 15| `/inventory/adjust`                | POST   | Điều chỉnh tồn kho          | 🟡 TB   |
| 16| `/batches`                         | GET    | Danh sách lô hàng           | 🟡 TB   |
| 17| `/batches`                         | POST   | Nhập lô hàng mới            | 🔴 Cao  |
| 18| `/batches/:id`                     | GET    | Chi tiết lô hàng            | 🟡 TB   |
| 19| `/locations`                       | GET    | Danh sách chi nhánh          | 🟡 TB   |
| 20| `/locations`                       | POST   | Tạo chi nhánh               | 🟢 Thấp|
| 21| `/locations/:id`                   | PUT    | Sửa chi nhánh               | 🟢 Thấp|

**Checklist:**
- [ ] POST/PUT/DELETE products (hiện đang 501)
- [ ] CRUD categories (cần cho frontend filter)
- [ ] CRUD suppliers
- [ ] Inventory listing + adjust
- [ ] Batches CRUD (nhập lô) 
- [ ] Locations CRUD

---

### TV3 — Order Service (`service/order`)

**Phạm vi:** Giỏ hàng, đặt hàng, xử lý đơn, trả hàng

| # | Endpoint                           | Method | Mô tả                        | Ưu tiên |
|---|-------------------------------------|--------|-------------------------------|---------|
| 1 | `/cart`                            | GET    | Lấy giỏ hàng user            | 🔴 Cao  |
| 2 | `/cart/items`                      | POST   | Thêm SP vào giỏ              | 🔴 Cao  |
| 3 | `/cart/items/:id`                  | PUT    | Cập nhật SL trong giỏ        | 🔴 Cao  |
| 4 | `/cart/items/:id`                  | DELETE | Xóa SP khỏi giỏ             | 🟡 TB   |
| 5 | `/checkout`                        | POST   | Đặt hàng (tạo order)         | 🔴 Cao  |
| 6 | `/orders`                          | GET    | Danh sách đơn hàng           | 🔴 Cao  |
| 7 | `/orders/:id`                      | GET    | Chi tiết đơn hàng            | 🔴 Cao  |
| 8 | `/orders/:id/status`               | PUT    | Cập nhật trạng thái          | 🔴 Cao  |
| 9 | `/orders/:id/cancel`               | PUT    | Hủy đơn hàng                 | 🟡 TB   |
| 10| `/orders/stats`                    | GET    | Thống kê đơn hàng            | 🟡 TB   |
| 11| `/returns`                         | GET    | Danh sách trả hàng           | 🟡 TB   |
| 12| `/returns`                         | POST   | Tạo yêu cầu trả hàng        | 🟡 TB   |
| 13| `/returns/:id`                     | GET    | Chi tiết trả hàng            | 🟢 Thấp|
| 14| `/returns/:id/approve`             | PUT    | Duyệt trả hàng              | 🟢 Thấp|

**Checklist:**
- [ ] Cart CRUD (thêm/sửa/xóa SP trong giỏ)
- [ ] Checkout (tạo order từ cart)
- [ ] Orders listing + detail
- [ ] Update order status (flow: pending → confirmed → shipping → delivered)
- [ ] Cancel order
- [ ] Returns CRUD

---

### TV4 — CMS + Notification + Frontend (`service/frontend`)

**Phạm vi:** Quản lý nội dung, banner, khuyến mãi, bệnh lý, email/SMS, và tích hợp frontend

| # | Endpoint                           | Service     | Method | Mô tả                    | Ưu tiên |
|---|-------------------------------------|-------------|--------|---------------------------|---------|
| 1 | `/articles`                        | CMS         | GET    | Danh sách bài viết        | 🔴 Cao  |
| 2 | `/articles/:id`                    | CMS         | GET    | Chi tiết bài viết         | 🔴 Cao  |
| 3 | `/articles`                        | CMS         | POST   | Tạo bài viết             | 🟡 TB   |
| 4 | `/articles/:id`                    | CMS         | PUT    | Sửa bài viết             | 🟡 TB   |
| 5 | `/articles/:id`                    | CMS         | DELETE | Xóa bài viết             | 🟢 Thấp|
| 6 | `/banners`                         | CMS         | GET    | Danh sách banner          | 🔴 Cao  |
| 7 | `/banners`                         | CMS         | POST   | Tạo banner               | 🟡 TB   |
| 8 | `/banners/:id`                     | CMS         | PUT    | Sửa banner               | 🟡 TB   |
| 9 | `/disease-categories`              | CMS         | GET    | Danh mục bệnh lý         | 🟡 TB   |
| 10| `/disease-categories`              | CMS         | POST   | Tạo danh mục bệnh        | 🟢 Thấp|
| 11| `/promotions`                      | CMS         | GET    | Danh sách khuyến mãi      | 🔴 Cao  |
| 12| `/promotions`                      | CMS         | POST   | Tạo khuyến mãi           | 🟡 TB   |
| 13| `/promotions/:id`                  | CMS         | PUT    | Sửa khuyến mãi           | 🟡 TB   |
| 14| `/promotions/:code/validate`       | CMS         | POST   | Kiểm tra mã coupon        | 🔴 Cao  |
| 15| `/store-config`                    | CMS         | GET    | Cấu hình cửa hàng        | 🟡 TB   |
| 16| `/store-config`                    | CMS         | PUT    | Cập nhật cấu hình        | 🟢 Thấp|
| 17| `/email/send`                      | Notification| POST   | Gửi email                | 🟢 Thấp|
| 18| `/sms/send`                        | Notification| POST   | Gửi SMS                  | 🟢 Thấp|
| 19| `/templates`                       | Notification| GET    | Danh sách mẫu tin nhắn    | 🟢 Thấp|

**Checklist:**
- [ ] Articles CRUD (dùng cho trang bệnh lý)
- [ ] Banners CRUD (trang chủ + admin)
- [ ] Promotions CRUD + validate coupon code
- [ ] Disease categories CRUD
- [ ] Store config GET/PUT
- [ ] Notification email/sms (nếu còn thời gian)
- [ ] Tích hợp frontend gọi API (fetch → render)

---

## 🗓️ Timeline Gợi Ý

| Tuần | Mục tiêu                                              |
|------|-------------------------------------------------------|
| 1    | **Ưu tiên 🔴:** Login/Register, Products CRUD, Cart+Checkout, Articles+Banners |
| 2    | **Ưu tiên 🟡:** Users, Categories, Orders, Promotions, Suppliers |
| 3    | **Ưu tiên 🟢:** Shifts, Returns, Locations, Notification, Store config |
| 4    | Tích hợp frontend, test end-to-end, fix bugs          |

---

## ⚡ Quy Trình Làm Việc

1. **Pull code mới nhất** từ `dev` trước khi bắt đầu (xem `GIT_GUIDE.md`)
2. **Code trên branch riêng** (`service/identity`, `service/catalog`, ...)
3. **Test bằng Postman** trước khi push
4. **Push + tạo Pull Request** vào `dev`
5. **Leader review** → merge

---

## 📞 Liên Hệ Khi Gặp Vấn Đề

- **Docker không chạy:** Kiểm tra `docker-compose up -d` + xem logs
- **DB lỗi:** Kiểm tra MySQL container đã healthy chưa
- **API 401/403:** Kiểm tra token + PUBLIC_ROUTES trong gateway
- **Conflict Git:** Đọc mục "Xử Lý Conflict" trong `GIT_GUIDE.md`
