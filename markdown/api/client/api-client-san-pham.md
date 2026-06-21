# API Mapping — client/product.html (Chi tiết sản phẩm)

> **Trang**: `frontend/client/product.html`  
> **Mô tả**: Trang chi tiết sản phẩm — gallery ảnh, thông tin, tab mô tả, đánh giá, sản phẩm liên quan  
> **Auth yêu cầu**: Không (public), có auth → cho phép đánh giá + thêm giỏ  
> **Ngày phân tích**: 2026-04-10

---

## 📐 Sơ đồ bố cục trang

```
┌─────────────────────────────────────────────────┐
│  [Component] Header Banner + Top Bar + Header   │
├─────────────────────────────────────────────────┤
│  Breadcrumb                                     │
├────────────────────┬────────────────────────────┤
│  Image Gallery     │  Product Info              │
│  (1 main + 4 thumb)│  - Brand, Name             │
│                    │  - Rating, Reviews, Sales   │
│                    │  - Price box (giá gốc/mới) │
│                    │  - Short description        │
│                    │  - Qty selector (+/-)       │
│                    │  - [Mua ngay] [Thêm giỏ]  │
├────────────────────┼────────────────────────────┤
│  Specs Table       │  Sidebar                   │
│  (9 dòng thông số) │  - SP tương tự (4 items)   │
├────────────────────│  - SP phổ biến (5 items)   │
│  Tabs Content      │                            │
│  (Thành phần,      │                            │
│   Công dụng,       │                            │
│   Liều dùng,       │                            │
│   Bảo quản)        │                            │
├────────────────────┴────────────────────────────┤
│  Rating Overview (tổng quan đánh giá)           │
│  Review List (danh sách đánh giá)               │
│  Form gửi đánh giá                              │
├─────────────────────────────────────────────────┤
│  Sản phẩm phổ biến (5 cards)                   │
├─────────────────────────────────────────────────┤
│  [Component] Promises + Newsletter + Footer     │
└─────────────────────────────────────────────────┘
```

---

## 🔌 CHI TIẾT API TỪNG VÙNG

---

### 1. Chi tiết sản phẩm (Product Info + Gallery + Specs + Tabs)

**Mô tả UI**: Toàn bộ thông tin sản phẩm: gallery ảnh, tên, brand, rating, giá, mô tả, thông số, tabs nội dung.

```
GET /api/catalog/products/{id}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `id` | int (path) | Product ID (hoặc dùng `slug`) |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 101,
    "sku": "MED-0042",
    "name": "Thuốc Gaviscon Dual Action Reckitt Benckiser trung hòa axit dạ dày",
    "slug": "thuoc-gaviscon-dual-action",
    "brand": "Reckitt Benckiser",
    "category": {
      "id": 11,
      "name": "Thuốc dạ dày - tiêu hóa",
      "slug": "thuoc-da-day",
      "parent": { "id": 1, "name": "Thuốc", "slug": "thuoc" }
    },
    "images": [
      { "url": "/assets/images/product_detail_1.png", "alt": "Gaviscon mặt trước", "is_primary": true },
      { "url": "/assets/images/product_detail_2.png", "alt": "Gaviscon mặt sau" },
      { "url": "/assets/images/product_detail_3.png", "alt": "Thành phần" },
      { "url": "/assets/images/product_detail_4.png", "alt": "Hướng dẫn" }
    ],
    "original_price": 300000,
    "price": 240000,
    "discount_percent": 20,
    "base_unit": "Hộp",
    "in_stock": true,
    "is_prescription": false,
    "short_description": "Thuốc trung hòa axit dạ dày, giảm triệu chứng ợ nóng...",
    "specs": {
      "sku": "MED-0042",
      "category": "Thuốc dạ dày",
      "brand": "Reckitt Benckiser",
      "dosage_form": "Hỗn dịch uống",
      "packaging": "Hộp 24 gói x 10ml",
      "active_ingredient": "Sodium alginate, Sodium bicarbonate",
      "origin": "Anh Quốc (UK)",
      "registration_number": "VN-12345-22",
      "prescription_required": false
    },
    "tabs": {
      "ingredients": "<p>Mỗi 10ml chứa: Sodium alginate 500mg...</p>",
      "uses": "<p>Điều trị triệu chứng trào ngược dạ dày...</p>",
      "dosage": "<p>Người lớn và trẻ em trên 12 tuổi: Uống 1 gói sau bữa ăn...</p>",
      "storage": "<p>Bảo quản nơi khô ráo, tránh ánh sáng trực tiếp...</p>"
    },
    "rating": {
      "average": 4.5,
      "total_reviews": 5,
      "total_sold": 120,
      "distribution": {
        "5": 3,
        "4": 1,
        "3": 1,
        "2": 0,
        "1": 0
      }
    }
  }
}
```

---

### 2. Nút "Thêm vào giỏ"

**Hành vi**: Thêm sản phẩm vào giỏ với số lượng user chọn.

```
POST /api/order/cart/items
```

| Field | Type | Mô tả |
|-------|------|-------|
| `product_id` | int (body) | ID sản phẩm |
| `quantity` | int (body) | Số lượng (từ qty selector, mặc định 1) |

**Request mẫu:**
```json
{ "product_id": 101, "quantity": 2 }
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Đã thêm vào giỏ hàng",
  "data": { "cart_count": 5 }
}
```

---

### 3. Nút "Mua ngay"

**Hành vi**: Thêm vào giỏ + redirect sang `cart.html`.

→ Gọi cùng API mục 2, sau khi success → `window.location.href = 'cart.html'`

---

### 4. Đánh giá sản phẩm — Danh sách review

**Mô tả UI**: List các review với avatar, tên, ngày, số sao, nội dung.

```
GET /api/catalog/products/{id}/reviews?page=1&limit=10
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "customer_name": "Nguyễn Văn A",
      "avatar_url": null,
      "rating": 5,
      "content": "Sản phẩm rất tốt, dùng hiệu quả ngay từ lần đầu",
      "created_at": "2026-03-15T10:30:00Z"
    },
    {
      "id": 2,
      "customer_name": "Trần Thị B",
      "avatar_url": null,
      "rating": 4,
      "content": "Giá hợp lý, giao hàng nhanh",
      "created_at": "2026-03-10T14:20:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 5 }
}
```

---

### 5. Form gửi đánh giá

**Mô tả UI**: Chọn số sao (1-5) + textarea nội dung + nút "Gửi đánh giá".

```
POST /api/catalog/products/{id}/reviews
```

| Field | Type | Mô tả |
|-------|------|-------|
| `rating` | int (body) | Số sao 1-5 |
| `content` | string (body) | Nội dung đánh giá |

**Request mẫu:**
```json
{ "rating": 5, "content": "Sản phẩm rất tốt!" }
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Đánh giá đã được gửi, chờ duyệt",
  "data": { "review_id": 10 }
}
```

**Ghi chú**: Yêu cầu đã đăng nhập (JWT). Chưa login → hiện popup yêu cầu login.

---

### 6. Sản phẩm tương tự (Sidebar — 4 items)

**Mô tả UI**: 4 sản phẩm cùng danh mục.

```
GET /api/catalog/products?category_id={category_id}&exclude_id={current_id}&limit=4&sort=popular
```

---

### 7. Sản phẩm phổ biến (Sidebar — 5 items)

**Mô tả UI**: 5 sản phẩm phổ biến nhất.

```
GET /api/catalog/products?sort=best_seller&limit=5
```

---

### 8. Sản phẩm phổ biến dưới cùng (5 cards)

**Mô tả UI**: Grid 5 product cards với nút "Thêm giỏ hàng".

→ Cùng API mục 7, hoặc có thể lấy thêm sản phẩm trending:

```
GET /api/catalog/products?sort=trending&limit=5
```

---

## 📊 TỔNG HỢP API CẦN CHO TRANG

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/products/{id}` | GET | catalog | No | Page load |
| 2 | `/api/catalog/products/{id}/reviews?page=1&limit=10` | GET | catalog | No | Page load |
| 3 | `/api/catalog/products/{id}/reviews` | POST | catalog | Yes | Click "Gửi đánh giá" |
| 4 | `/api/order/cart/items` | POST | order | Yes* | Click "Thêm giỏ" / "Mua ngay" |
| 5 | `/api/catalog/products?category_id=X&exclude_id=Y&limit=4` | GET | catalog | No | Page load (sidebar tương tự) |
| 6 | `/api/catalog/products?sort=best_seller&limit=5` | GET | catalog | No | Page load (sidebar phổ biến) |
| 7 | `/api/catalog/products?sort=trending&limit=5` | GET | catalog | No | Page load (section dưới) |
| 8 | `/api/cms/store-config/public` | GET | cms | No | Page load (header/footer) |
| 9 | `/api/catalog/categories/tree` | GET | catalog | No | Page load (mega menu) |
