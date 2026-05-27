# API Mapping — admin/suppliers.html

> **Trang**: Nhà cung cấp & Công nợ
> **Auth yêu cầu**: Có token admin/manager khi gọi qua API Gateway
> **Cập nhật theo code hiện tại**: backend hiện đã có CRUD nhà cung cấp cơ bản. Phần công nợ chi tiết, thanh toán nợ và export chưa có API riêng.

---

## Trạng thái hiện tại

| Nhu cầu trên màn hình | API hiện có | Trạng thái |
|---|---|---|
| Xem danh sách nhà cung cấp | `GET /api/catalog/suppliers` | Đã có |
| Tìm nhà cung cấp theo tên/mã/SĐT | `GET /api/catalog/suppliers?q={search}` | Đã có |
| Xem chi tiết nhà cung cấp | `GET /api/catalog/suppliers/{id}` | Đã có |
| Thêm nhà cung cấp | `POST /api/catalog/suppliers` | Đã có |
| Sửa nhà cung cấp | `PUT /api/catalog/suppliers/{id}` | Đã có |
| Ẩn nhà cung cấp | `DELETE /api/catalog/suppliers/{id}` | Đã có |

Các API trong bản thiết kế cũ nhưng **chưa có trong backend hiện tại**:

| API | Trạng thái |
|---|---|
| `GET /api/catalog/suppliers/{id}/purchase-orders` | Chưa có |
| `POST /api/catalog/suppliers/{id}/payments` | Chưa có |
| `POST /api/catalog/suppliers/{id}/payments/full` | Chưa có |
| `GET /api/catalog/suppliers/export` | Chưa có |
| Filter `debt_status`, `partner_status` | Chưa hỗ trợ. Backend hiện chỉ hỗ trợ `q`, `page`, `limit` |

---

## API chi tiết đang dùng được

### 1. Danh sách nhà cung cấp

```http
GET /api/catalog/suppliers?page=1&limit=20&q={search}
```

Backend hiện luôn lọc `status = active`. Response có các trường:

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "code": "NCC-005",
      "name": "Công ty Dược Hậu Giang",
      "contact_name": "Trần Văn B",
      "phone": "0909888777",
      "email": "contact@dhg.com",
      "address": "TP.HCM",
      "tax_code": "0123456789",
      "current_debt": 25000000,
      "total_purchase_value": 450000000,
      "status": "active"
    }
  ],
  "pagination": { "total": 18, "page": 1, "limit": 20, "pages": 1, "total_pages": 1 }
}
```

---

### 2. Chi tiết nhà cung cấp

```http
GET /api/catalog/suppliers/{id}
```

---

### 3. Thêm nhà cung cấp

```http
POST /api/catalog/suppliers
```

Body hiện backend nhận:

```json
{
  "code": "NCC-005",
  "name": "Công ty Dược ABC",
  "contact_name": "Lê Thị C",
  "phone": "0901234567",
  "email": "contact@abc.com",
  "address": "123 Nguyễn Trãi, Q5, TP.HCM",
  "tax_code": "0123456789",
  "status": "active"
}
```

Bắt buộc: `code`, `name`.

---

### 4. Cập nhật nhà cung cấp

```http
PUT /api/catalog/suppliers/{id}
```

Cho phép cập nhật: `code`, `name`, `contact_name`, `phone`, `email`, `address`, `tax_code`, `status`.

---

### 5. Ẩn nhà cung cấp

```http
DELETE /api/catalog/suppliers/{id}
```

Backend hiện đổi `status = inactive`, không xóa dữ liệu thật.

---

## Tổng hợp API đúng với code hiện tại

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|---|---|---|---|---|
| 1 | `/api/catalog/suppliers` | GET | catalog | Yes | Page load + tìm kiếm |
| 2 | `/api/catalog/suppliers/{id}` | GET | catalog | Yes | Xem chi tiết |
| 3 | `/api/catalog/suppliers` | POST | catalog | Yes | Thêm NCC |
| 4 | `/api/catalog/suppliers/{id}` | PUT | catalog | Yes | Sửa NCC |
| 5 | `/api/catalog/suppliers/{id}` | DELETE | catalog | Yes | Ẩn NCC |
