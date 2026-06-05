# API Mapping — client/product.html

> **Trang**: Chi tiết sản phẩm
> **Auth yêu cầu**: Không cần đăng nhập để xem sản phẩm. Một số hành động như review/giỏ hàng phụ thuộc order-service hoặc tính năng chưa có.
> **Cập nhật theo code hiện tại**: catalog-service đã có API chi tiết sản phẩm, sản phẩm tương tự và danh sách sản phẩm. API review chưa có trong catalog-service.

---

## Trạng thái hiện tại

| Nhu cầu trên màn hình | API hiện có | Trạng thái |
|---|---|---|
| Xem chi tiết sản phẩm | `GET /api/catalog/products/{id}` | Đã có |
| Xem sản phẩm tương tự | `GET /api/catalog/products/{id}/alternatives` | Đã có |
| Lấy sản phẩm cùng danh mục | `GET /api/catalog/products?category_id=...&exclude_id=...` | Đã có |
| Lấy sản phẩm phổ biến/trending | `GET /api/catalog/products?sort=best_seller` hoặc `sort=trending` | Đã có |
| Lấy danh mục cho mega menu | `GET /api/catalog/categories/tree` | Đã có |
| Lấy sản phẩm vừa xem theo nhiều id | `GET /api/catalog/products?limit=15&ids={ids}` | Client code có gọi, backend chưa hỗ trợ rõ |
| Thêm vào giỏ | Hiện frontend dùng localStorage và gọi `GET /products/{id}` để lấy snapshot | Chưa dùng order-service thật |

Các API trong bản thiết kế cũ nhưng **chưa có trong backend hiện tại**:

| API | Trạng thái |
|---|---|
| `GET /api/catalog/products/{id}/reviews` | Chưa có |
| `POST /api/catalog/products/{id}/reviews` | Chưa có |
| `POST /api/order/cart/items` | Route cart trong order-service hiện còn TODO/501 |

---

## API chi tiết đang dùng được

### 1. Chi tiết sản phẩm

```http
GET /api/catalog/products/{id}
```

Response chính có:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "sku": "MED-0101",
    "name": "Gaviscon Dual Action",
    "slug": "gaviscon-dual-action",
    "brand": { "id": 1, "name": "Reckitt Benckiser" },
    "category": {
      "id": 11,
      "name": "Thuốc dạ dày",
      "parent_id": 1,
      "parent_name": "Thuốc"
    },
    "retail_price": 240000,
    "base_unit": "Hộp",
    "requires_prescription": 0,
    "active_ingredient": "Sodium alginate",
    "registration_number": "VN-12345-22",
    "manufacturer": "Reckitt",
    "country_of_origin": "Anh",
    "description": "Mô tả sản phẩm",
    "image_url": "/assets/images/product.png",
    "gallery": [],
    "units": [],
    "specifications": [],
    "total_stock": 120,
    "in_stock": true
  }
}
```

---

### 2. Sản phẩm tương tự

```http
GET /api/catalog/products/{id}/alternatives
```

Dùng cho sidebar hoặc gợi ý thay thế.

---

### 3. Sản phẩm cùng danh mục

```http
GET /api/catalog/products?category_id={category_id}&exclude_id={current_id}&limit=4&sort=popular
```

`exclude_id` đã được backend hỗ trợ để loại sản phẩm hiện tại khỏi danh sách gợi ý.

---

### 4. Sản phẩm phổ biến hoặc trending

```http
GET /api/catalog/products?sort=best_seller&limit=5
GET /api/catalog/products?sort=trending&limit=5
```

---

### 5. Danh mục cho mega menu

```http
GET /api/catalog/categories/tree
```

---

### 6. Sản phẩm vừa xem

Client code hiện có 2 cách tải sản phẩm vừa xem:

```http
GET /api/catalog/products?limit=15&ids={id1,id2,id3}
```

và:

```http
GET /api/catalog/products/{id}
```

Do có 2 hàm `renderRecentlyViewed`, hàm phía sau sẽ ghi đè hàm phía trước trong runtime. Vì vậy hiện tại client nhiều khả năng đang chạy cách gọi từng sản phẩm theo id. Tuy nhiên nếu giữ nguyên client code, backend vẫn nên hỗ trợ `ids` để tránh lỗi khi phần code được dọn lại sau này.

---

## Tổng hợp API đúng với code hiện tại

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|---|---|---|---|---|
| 1 | `/api/catalog/products/{id}` | GET | catalog | No | Page load |
| 2 | `/api/catalog/products/{id}/alternatives` | GET | catalog | No | Sidebar/gợi ý thay thế |
| 3 | `/api/catalog/products?category_id=X&exclude_id=Y&limit=4` | GET | catalog | No | Sản phẩm cùng danh mục |
| 4 | `/api/catalog/products?sort=best_seller&limit=5` | GET | catalog | No | Sidebar phổ biến |
| 5 | `/api/catalog/products?sort=trending&limit=5` | GET | catalog | No | Section dưới |
| 6 | `/api/catalog/categories/tree` | GET | catalog | No | Mega menu |
| 7 | `/api/catalog/products?limit=15&ids=...` | GET | catalog | No | Sản phẩm vừa xem, client có nhắc tới |

---

## Ghi chú cho frontend

Hiện tại không nên nối review vào `/api/catalog/products/{id}/reviews` vì backend chưa có route này. Giỏ hàng client hiện nên tiếp tục dùng localStorage cho demo, hoặc đợi order-service hoàn thiện cart/checkout.
