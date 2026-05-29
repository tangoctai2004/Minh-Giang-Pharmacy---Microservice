# API Mapping — pos/index.html

> **Trang**: POS Kiosk — giao diện bán hàng tại quầy
> **Auth yêu cầu**: Có token nhân viên POS
> **Cập nhật theo code hiện tại**: phần catalog trong POS đã gọi API động qua gateway và có helper riêng ở `frontend/pos/js/pos-catalog-api.js`. Các API order POS vẫn chưa được implement đầy đủ trong order-service.

---

## Trạng thái hiện tại

API catalog đang có thể dùng cho POS:

| Nhu cầu POS | API hiện có | Trạng thái |
|---|---|---|
| Tìm thuốc theo tên/SKU/barcode | `GET /api/catalog/products/pos-search` | Đã có; hỗ trợ barcode sản phẩm và chuẩn bị barcode đơn vị bán |
| Quét mã vạch | `GET /api/catalog/products/barcode/{barcode}` | Đã có, trả đủ dữ liệu POS và `barcode_match` |
| Lấy danh mục POS | `GET /api/catalog/categories/pos-tree` | Đã có, trả cây danh mục gọn kèm số thuốc/còn hàng |
| Thuốc thay thế | `GET /api/catalog/products/{id}/alternatives` | Đã có |
| Kiểm tra tồn có thể bán | `GET /api/catalog/inventory/availability?product_ids=...` | Đã có |
| Chi tiết thuốc cho POS | `GET /api/catalog/products/pos-detail/{id}` | Đã có |
| Giữ tồn tạm thời | `POST /api/catalog/inventory/reservations` | Đã có, giữ theo FEFO |
| Nhả giữ tồn | `POST /api/catalog/inventory/reservations/release` | Đã có |
| Kiểm tra voucher | `POST /api/catalog/promotions/vouchers/validate` | Backend có, nhưng gateway chưa public whitelist |

Các API trong bản thiết kế cũ nhưng **chưa có hoặc chưa chạy thật**:

| API | Trạng thái |
|---|---|
| `POST /api/order/pos/checkout` | Chưa thấy route POS checkout thật trong order-service |
| `POST /api/order/pos/prescription-verify` | Chưa có |
| `POST /api/order/pos/hold` | Chưa có |
| `GET /api/order/pos/hold` | Chưa có |
| `GET /api/order/pos/online-orders` | Chưa có |
| `PUT /api/order/pos/online-orders/{id}/accept` | Chưa có |
| `GET /api/order/pos/receipts/{code}/print` | Chưa có |

---

## API catalog chi tiết đang dùng được

### 1. Tìm kiếm sản phẩm cho POS

```http
GET /api/catalog/products/pos-search?q={keyword}&barcode={code}&category_id={id}&limit=20&offset=0&in_stock=1&requires_prescription=1
```

Backend hiện hỗ trợ:

| Param | Ghi chú |
|---|---|
| `q` | Tìm theo tên, SKU, mã vạch |
| `barcode` | Tìm đúng mã vạch sản phẩm; nếu DB có `product_units.barcode` thì tìm cả mã vạch đơn vị bán |
| `category_id` | Lọc danh mục |
| `limit` | Mặc định 20, tối đa 100 |
| `offset` | Dùng để tải thêm trên POS |
| `in_stock` | `1` để chỉ lấy thuốc còn tồn có thể bán |
| `requires_prescription` | `1` để lọc thuốc kê đơn |

Response hiện tại có dạng:

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "sku": "MED-0042",
      "barcode": "893000000001",
      "name": "Amoxicillin 500mg",
      "price": 5000,
      "base_unit": "Viên",
      "image_url": "/assets/images/product.png",
      "category_id": 2,
      "category_name": "Kháng sinh",
      "total_stock": 45,
      "available_stock": 43,
      "nearest_expiry": "2026-12-31",
      "location_name": "Khu OTC / Tủ A / Kệ 2",
      "requires_prescription": true,
      "units": [],
      "sale_units": [],
      "warnings": [],
      "pos_flags": {
        "can_sell": true,
        "requires_prescription": true,
        "near_expiry": false,
        "low_stock": false
      },
      "in_stock": true
    }
  ],
  "pagination": { "total": 1536, "page": 1, "limit": 20, "pages": 77, "total_pages": 77 }
}
```

Response hiện đã có các field POS cần để hiển thị card sản phẩm, cảnh báo thuốc kê đơn, tồn có thể bán, hạn dùng gần nhất, vị trí kệ và đơn vị bán.

---

### 2. Quét mã vạch

```http
GET /api/catalog/products/barcode/{barcode}
```

Trả thông tin sản phẩm theo barcode. Nếu barcode khớp với đơn vị bán, response có `barcode_match.type = "unit"` và `barcode_match.unit_name` để POS chọn đúng đơn vị bán.

Response trả 1 object trong `data`, gồm các field chính tương tự `/products/pos-search`: `id`, `sku`, `barcode`, `name`, `price`, `base_unit`, `requires_prescription`, `total_stock`, `available_stock`, `nearest_expiry`, `location_name`, `units`, `in_stock`.

---

### 3. Danh mục cho POS

```http
GET /api/catalog/categories/pos-tree
```

Trả cây danh mục gọn cho POS, có `product_count` và `in_stock_count` để người bán biết nhóm nào còn hàng.

`GET /api/catalog/categories?for=pos` vẫn còn để tương thích cũ.

---

### 4. Thuốc thay thế

```http
GET /api/catalog/products/{id}/alternatives
```

Dùng khi sản phẩm hết hàng hoặc cần gợi ý sản phẩm cùng hoạt chất/danh mục.

---

### 5. Kiểm tra tồn có thể bán

```http
GET /api/catalog/inventory/availability?product_ids=1,2,3
```

### 6. Giữ tồn tạm thời

```http
POST /api/catalog/inventory/reservations
```

Body:

```json
{
  "source_type": "pos_hold",
  "source_id": 123,
  "ttl_minutes": 30,
  "items": [{ "product_id": 42, "quantity": 2 }]
}
```

Catalog giữ tồn theo FEFO. Order/POS phải gọi release khi huỷ đơn hoặc hoàn tất.

```http
POST /api/catalog/inventory/reservations/release
```

Body:

```json
{
  "source_type": "pos_hold",
  "source_id": 123,
  "reason": "cancelled"
}
```

Dùng trước khi thêm vào giỏ, tăng số lượng hoặc mở màn thanh toán.

Response:

```json
{
  "success": true,
  "data": [
    {
      "product_id": 42,
      "sku": "MED-0042",
      "name": "Amoxicillin 500mg",
      "base_unit": "Viên",
      "total_stock": 45,
      "reserved_stock": 2,
      "available_stock": 43,
      "nearest_expiry": "2026-12-31",
      "location_name": "Khu Rx / Tủ A / Kệ 5",
      "in_stock": true
    }
  ]
}
```

---

### 6. Kiểm tra voucher

```http
POST /api/catalog/promotions/vouchers/validate
```

Body:

```json
{
  "code": "MINGIANG50",
  "order_amount": 270000,
  "items": [{ "product_id": 42, "qty": 2 }]
}
```

Ghi chú quan trọng: backend catalog có route này, nhưng API Gateway hiện chưa đưa `POST /api/catalog/promotions/vouchers/validate` vào danh sách public. Nếu POS gọi có token thì vẫn ổn; nếu client/POS public gọi không token thì sẽ bị chặn.

---

## Tổng hợp API catalog đúng với code hiện tại

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|---|---|---|---|---|
| 1 | `/api/catalog/products/pos-search` | GET | catalog | Yes | Search/scan |
| 2 | `/api/catalog/products/barcode/{barcode}` | GET | catalog | Yes | Quét mã vạch |
| 3 | `/api/catalog/categories/pos-tree` | GET | catalog | Yes | Page load |
| 4 | `/api/catalog/products/{id}/alternatives` | GET | catalog | Yes | Gợi ý thuốc thay thế |
| 5 | `/api/catalog/inventory/availability?product_ids=...` | GET | catalog | Yes | Kiểm tra tồn có thể bán |
| 6 | `/api/catalog/products/pos-detail/{id}` | GET | catalog | Yes | Xem chi tiết thuốc tại quầy |
| 7 | `/api/catalog/inventory/reservations` | POST | catalog | Yes | Giữ tồn tạm thời |
| 8 | `/api/catalog/inventory/reservations/release` | POST | catalog | Yes | Nhả giữ tồn |
| 9 | `/api/catalog/promotions/vouchers/validate` | POST | catalog | Yes | Áp voucher |

---

## Ghi chú cho bước tiếp theo

Để POS bán hàng thật, catalog cần bổ sung hoặc mở rộng:

1. Luồng order-service/POS gọi catalog để giữ hàng và trừ hàng sau khi thanh toán.
2. Voucher validate cần thống nhất quyền gọi qua gateway.
3. Frontend POS cần thay dữ liệu mock bằng các API catalog hiện có.
