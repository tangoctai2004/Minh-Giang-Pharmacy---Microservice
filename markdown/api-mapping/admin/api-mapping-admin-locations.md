# API Mapping — admin/locations.html

> **Trang**: Pharmacy Layout & Storage
> **Auth yêu cầu**: Có token admin/manager khi gọi qua API Gateway
> **Cập nhật theo code hiện tại**: backend hiện quản lý vị trí kho dạng phẳng trong `/api/catalog/locations`, chưa có API tách riêng zone/cabinet/shelf.

---

## Trạng thái hiện tại

| Nhu cầu trên màn hình | API hiện có | Trạng thái |
|---|---|---|
| Xem danh sách vị trí | `GET /api/catalog/locations` | Đã có |
| Tìm vị trí | `GET /api/catalog/locations?q={search}` | Đã có |
| Xem chi tiết vị trí | `GET /api/catalog/locations/{id}` | Đã có |
| Thêm vị trí | `POST /api/catalog/locations` | Đã có |
| Sửa vị trí | `PUT /api/catalog/locations/{id}` | Đã có |
| Ẩn vị trí | `DELETE /api/catalog/locations/{id}` | Đã có |

Các API trong bản thiết kế cũ nhưng **chưa có trong backend hiện tại**:

| API | Trạng thái |
|---|---|
| `GET /api/catalog/locations/zones` | Chưa có |
| `GET /api/catalog/locations/zones/{id}/cabinets` | Chưa có |
| `GET /api/catalog/locations/cabinets/{id}/shelves` | Chưa có |
| `POST /api/catalog/locations/zones` | Chưa có |
| `POST /api/catalog/locations/zones/{id}/cabinets` | Chưa có |
| `POST /api/catalog/locations/cabinets/{id}/shelves` | Chưa có |
| `PUT /api/catalog/locations/shelves/{id}` | Chưa có |
| `PUT /api/catalog/locations/cabinets/{id}` | Chưa có |
| `PUT /api/catalog/locations/zones/{id}` | Chưa có |

---

## API chi tiết đang dùng được

### 1. Danh sách vị trí

```http
GET /api/catalog/locations?page=1&limit=20&q={search}
```

Response hiện tại:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "zone": "Khu OTC",
      "cabinet": "Tủ A1",
      "shelf": "Kệ A1-T1",
      "label": "Giảm đau hạ sốt",
      "is_active": 1
    }
  ],
  "pagination": { "total": 10, "page": 1, "limit": 20, "pages": 1, "total_pages": 1 }
}
```

---

### 2. Chi tiết vị trí

```http
GET /api/catalog/locations/{id}
```

---

### 3. Thêm vị trí

```http
POST /api/catalog/locations
```

Body:

```json
{
  "zone": "Khu OTC",
  "cabinet": "Tủ A1",
  "shelf": "Kệ A1-T1",
  "label": "Giảm đau hạ sốt"
}
```

Bắt buộc: `zone`, `cabinet`, `shelf`, `label`.

---

### 4. Cập nhật vị trí

```http
PUT /api/catalog/locations/{id}
```

Cho phép cập nhật: `zone`, `cabinet`, `shelf`, `label`, `is_active`.

---

### 5. Ẩn vị trí

```http
DELETE /api/catalog/locations/{id}
```

Backend hiện đổi `is_active = 0`, không xóa dữ liệu thật.

---

## Tổng hợp API đúng với code hiện tại

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|---|---|---|---|---|
| 1 | `/api/catalog/locations` | GET | catalog | Yes | Page load + tìm kiếm |
| 2 | `/api/catalog/locations/{id}` | GET | catalog | Yes | Xem chi tiết |
| 3 | `/api/catalog/locations` | POST | catalog | Yes | Thêm vị trí |
| 4 | `/api/catalog/locations/{id}` | PUT | catalog | Yes | Sửa vị trí |
| 5 | `/api/catalog/locations/{id}` | DELETE | catalog | Yes | Ẩn vị trí |

---

## Ghi chú cho frontend

Màn hình hiện tại đang thiết kế 3 cột `Zone -> Cabinet -> Shelf`. Với backend hiện tại có 2 hướng:

1. Làm nhanh: render danh sách phẳng từ `/locations`, nhóm dữ liệu theo `zone`, `cabinet`, `shelf` ở frontend.
2. Làm đúng thiết kế: bổ sung backend route riêng cho zones/cabinets/shelves ở giai đoạn sau.
