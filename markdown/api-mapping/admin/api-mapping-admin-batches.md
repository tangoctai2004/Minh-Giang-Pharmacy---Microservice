# API Mapping — admin/batches.html

> **Trang**: Nhập kho & Lô hàng
> **Auth yêu cầu**: Có token admin/manager khi gọi qua API Gateway
> **Cập nhật theo code hiện tại**: backend hiện quản lý phiếu nhập qua `/api/catalog/batches`, chưa tách riêng `/inbound` và `/outbound`.

---

## Trạng thái hiện tại

| Nhu cầu trên màn hình | API hiện có | Trạng thái |
|---|---|---|
| Xem danh sách phiếu nhập/lô hàng | `GET /api/catalog/batches` | Đã có |
| Xem chi tiết phiếu nhập kèm danh sách item | `GET /api/catalog/batches/{id}` | Đã có |
| Tạo phiếu nhập | `POST /api/catalog/batches` | Đã có |
| Sửa phiếu nhập khi còn draft | `PUT /api/catalog/batches/{id}` | Đã có |
| Quét mã vạch lấy sản phẩm | `GET /api/catalog/products/barcode/{barcode}` | Đã có |
| Lấy nhà cung cấp cho dropdown | `GET /api/catalog/suppliers` | Đã có |

Các API trong bản thiết kế cũ nhưng **chưa có trong backend hiện tại**:

| API | Trạng thái |
|---|---|
| `GET /api/catalog/batches/inbound` | Chưa có. Dùng tạm `GET /api/catalog/batches` |
| `GET /api/catalog/batches/outbound` | Chưa có |
| `GET /api/catalog/batches/inbound/{id}/items` | Chưa có. Dùng `GET /api/catalog/batches/{id}` |
| `POST /api/catalog/batches/inbound` | Chưa có. Dùng `POST /api/catalog/batches` |
| `PUT /api/catalog/batches/{id}/clearance` | Chưa có |
| `GET /api/catalog/batches/inbound/{id}/print` | Chưa có |
| `GET /api/catalog/batches/export` | Chưa có |

---

## API chi tiết đang dùng được

### 1. Danh sách phiếu nhập

```http
GET /api/catalog/batches
```

Backend hiện trả tối đa 50 phiếu mới nhất, chưa có phân trang/filter.

Response chính gồm: `id`, `batch_code`, `status`, `supplier_name`, `total_amount`, `paid_amount`, `received_date`, `created_at`.

---

### 2. Chi tiết phiếu nhập

```http
GET /api/catalog/batches/{id}
```

Trả thông tin phiếu nhập và mảng `items`. Mỗi item có thêm `product_name`, `product_sku`, `base_unit`.

---

### 3. Tạo phiếu nhập

```http
POST /api/catalog/batches
```

Body hiện backend nhận:

```json
{
  "supplier_id": 5,
  "delivery_person": "Nguyễn Văn B",
  "received_date": "2026-03-05",
  "paid_amount": 3000000,
  "notes": "Lô hàng tháng 3",
  "status": "draft",
  "items": [
    {
      "product_id": 42,
      "lot_number": "LO-2026-0112",
      "manufacture_date": "2025-12-01",
      "expiry_date": "2027-12-01",
      "quantity_received": 500,
      "quantity_remaining": 500,
      "cost_price": 3000,
      "location_id": 1
    }
  ]
}
```

Bắt buộc: `supplier_id`, `received_date`, `items`.
Mỗi item bắt buộc có: `product_id`, `lot_number`, `expiry_date`, `quantity_received`, `cost_price`.

---

### 4. Sửa phiếu nhập

```http
PUT /api/catalog/batches/{id}
```

Chỉ sửa được phiếu đang ở trạng thái `draft`. Nếu phiếu đã `completed`, backend sẽ trả lỗi.

---

### 5. Quét mã vạch tra cứu sản phẩm

```http
GET /api/catalog/products/barcode/{barcode}
```

Dùng trong modal nhập hàng để tự điền thông tin sản phẩm.

---

### 6. Danh sách nhà cung cấp

```http
GET /api/catalog/suppliers?page=1&limit=100&q={search}
```

Backend hiện chỉ trả nhà cung cấp `active`.

---

## Tổng hợp API đúng với code hiện tại

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|---|---|---|---|---|
| 1 | `/api/catalog/batches` | GET | catalog | Yes | Tab phiếu nhập |
| 2 | `/api/catalog/batches/{id}` | GET | catalog | Yes | Mở chi tiết/expand row |
| 3 | `/api/catalog/batches` | POST | catalog | Yes | Tạo phiếu nhập |
| 4 | `/api/catalog/batches/{id}` | PUT | catalog | Yes | Sửa phiếu draft |
| 5 | `/api/catalog/products/barcode/{barcode}` | GET | catalog | Yes | Quét mã vạch |
| 6 | `/api/catalog/suppliers` | GET | catalog | Yes | Dropdown NCC |
