# API Mapping — admin/inventory.html

> **Trang**: Dữ liệu gốc — Tồn kho & Danh mục Master
> **Auth yêu cầu**: Có token admin/manager khi gọi qua API Gateway
> **Cập nhật theo code hiện tại**: catalog-service hiện đã có API sản phẩm, danh mục và tồn kho cơ bản. Một số API trong bản thiết kế cũ chưa được implement.

---

## Trạng thái hiện tại

Trang admin inventory hiện có thể nối ngay với các API sau:

| Nhu cầu trên màn hình | API hiện có | Trạng thái |
|---|---|---|
| Xem thống kê tồn kho | `GET /api/catalog/inventory/stats` | Đã có |
| Xem danh sách tồn kho theo sản phẩm | `GET /api/catalog/inventory` | Đã có, còn đơn giản |
| Xem tồn kho theo từng lô của 1 sản phẩm | `GET /api/catalog/inventory/{productId}` | Đã có |
| Xem danh sách sản phẩm master | `GET /api/catalog/products` | Đã có |
| Tạo sản phẩm | `POST /api/catalog/products` | Đã có |
| Sửa sản phẩm | `PUT /api/catalog/products/{id}` | Đã có |
| Ẩn sản phẩm | `DELETE /api/catalog/products/{id}` | Đã có |
| Lấy danh mục | `GET /api/catalog/categories` hoặc `GET /api/catalog/categories/tree` | Đã có |
| Tìm sản phẩm bằng mã vạch | `GET /api/catalog/products/barcode/{barcode}` | Đã có |
| Lấy vị trí lưu hàng dạng phẳng | `GET /api/catalog/locations` | Đã có |

Các API sau **chưa có trong backend hiện tại**:

| API trong bản thiết kế cũ | Trạng thái |
|---|---|
| `GET /api/catalog/inventory/stock` | Chưa có. Hiện dùng `GET /api/catalog/inventory` |
| `GET /api/catalog/inventory/export` | Chưa có |
| `GET /api/catalog/products/export` | Chưa có |
| `POST /api/catalog/products/barcode/print` | Chưa có |
| `GET /api/catalog/locations/zones` | Chưa có |
| `GET /api/catalog/locations/zones/{id}/cabinets` | Chưa có |
| `GET /api/catalog/locations/cabinets/{id}/shelves` | Chưa có |

---

## API chi tiết đang dùng được

### 1. Thống kê tồn kho

```http
GET /api/catalog/inventory/stats
```

Trả về số sản phẩm sắp hết hàng, số lô sắp hết hạn và tổng giá trị tồn kho.

---

### 2. Danh sách tồn kho theo sản phẩm

```http
GET /api/catalog/inventory
```

Backend hiện trả danh sách sản phẩm kèm tổng tồn kho. API này chưa có filter, phân trang chi tiết như bản thiết kế cũ.

---

### 3. Tồn kho theo từng lô của một sản phẩm

```http
GET /api/catalog/inventory/{productId}
```

Dùng khi admin bấm vào một sản phẩm để xem các lô hàng còn lại.

---

### 4. Danh sách sản phẩm master

```http
GET /api/catalog/products?page=1&limit=20&q={search}&category_id={id}&status={status}
```

Các filter backend hiện hỗ trợ tốt:

| Param | Ghi chú |
|---|---|
| `page`, `limit` | Có phân trang |
| `q` | Tìm theo tên, SKU, hoạt chất |
| `category_id`, `sub_category_id` | Lọc danh mục |
| `brand_ids` | Lọc nhiều hãng |
| `price_min`, `price_max` | Lọc giá |
| `origins`, `indications` | Lọc theo xuất xứ/công dụng |
| `requires_prescription` | Lọc thuốc kê đơn |
| `tag` | Lọc theo tag |
| `status` | Mặc định active |
| `sort` | `name`, `price_asc`, `price_desc`, `newest`, `best_seller`, `trending` |

---

### 5. Tạo sản phẩm

```http
POST /api/catalog/products
```

Body hiện backend nhận:

```json
{
  "name": "Paracetamol 500mg",
  "category_id": 2,
  "brand_id": 1,
  "active_ingredient": "Paracetamol",
  "registration_number": "VN-12345-20",
  "manufacturer": "Sanofi",
  "requires_prescription": false,
  "base_unit": "Viên",
  "retail_price": 5000,
  "min_stock_alert": 20,
  "image_url": "/assets/images/product.png",
  "gallery": [],
  "description": "Mô tả sản phẩm",
  "tags": ["popular"],
  "country_of_origin": "Việt Nam",
  "barcode": "893000000001",
  "unit_conversions": [
    { "unit_name": "Vỉ", "conversion_qty": 10, "of_unit": "Viên", "retail_price": 48000 }
  ],
  "specifications": [
    { "spec_key": "Dạng bào chế", "spec_value": "Viên nén" }
  ]
}
```

Bắt buộc: `name`, `category_id`, `base_unit`, `retail_price`.

---

### 6. Cập nhật và ẩn sản phẩm

```http
PUT /api/catalog/products/{id}
DELETE /api/catalog/products/{id}
```

`DELETE` hiện là ẩn mềm: backend đổi `status = inactive`, không xóa dữ liệu thật.

---

### 7. Danh mục cho dropdown

```http
GET /api/catalog/categories
GET /api/catalog/categories/tree
```

`GET /categories` trả dạng danh sách có phân trang.
`GET /categories/tree` trả dạng cây, phù hợp menu hoặc dropdown nhiều cấp.

---

### 8. Vị trí lưu hàng hiện tại

```http
GET /api/catalog/locations?page=1&limit=20&q={search}
POST /api/catalog/locations
PUT /api/catalog/locations/{id}
DELETE /api/catalog/locations/{id}
```

Backend hiện dùng một bảng vị trí dạng phẳng với các trường: `zone`, `cabinet`, `shelf`, `label`.

Body tạo vị trí:

```json
{
  "zone": "Khu OTC",
  "cabinet": "Tủ A1",
  "shelf": "Kệ A1-T1",
  "label": "Giảm đau hạ sốt"
}
```

---

## Tổng hợp API đúng với code hiện tại

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|---|---|---|---|---|
| 1 | `/api/catalog/inventory/stats` | GET | catalog | Yes | Page load |
| 2 | `/api/catalog/inventory` | GET | catalog | Yes | Tab tồn kho |
| 3 | `/api/catalog/inventory/{productId}` | GET | catalog | Yes | Xem lô tồn của sản phẩm |
| 4 | `/api/catalog/products` | GET | catalog | Yes | Tab master + filter |
| 5 | `/api/catalog/products` | POST | catalog | Yes | Thêm thuốc mới |
| 6 | `/api/catalog/products/{id}` | PUT | catalog | Yes | Sửa thuốc |
| 7 | `/api/catalog/products/{id}` | DELETE | catalog | Yes | Ẩn thuốc |
| 8 | `/api/catalog/products/barcode/{barcode}` | GET | catalog | Yes | Quét mã vạch |
| 9 | `/api/catalog/categories` | GET | catalog | Yes | Dropdown danh mục |
| 10 | `/api/catalog/categories/tree` | GET | catalog | Yes | Dropdown/menu dạng cây |
| 11 | `/api/catalog/locations` | GET | catalog | Yes | Danh sách vị trí |
| 12 | `/api/catalog/locations` | POST | catalog | Yes | Thêm vị trí |
| 13 | `/api/catalog/locations/{id}` | PUT | catalog | Yes | Sửa vị trí |
| 14 | `/api/catalog/locations/{id}` | DELETE | catalog | Yes | Ẩn vị trí |
