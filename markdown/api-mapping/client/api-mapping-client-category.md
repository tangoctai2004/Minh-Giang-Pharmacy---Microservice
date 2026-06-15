# API Mapping — client/category.html (Danh mục sản phẩm)

> **Trang**: `frontend/client/category.html`  
> **Mô tả**: Trang danh sách sản phẩm theo danh mục — lọc, sắp xếp, phân trang  
> **Auth yêu cầu**: Không (trang public)  
> **Ngày phân tích**: 2026-04-10

---

## 📐 Sơ đồ bố cục trang

```
┌─────────────────────────────────────────────────┐
│  [Component] Header Banner + Top Bar + Header   │
├───────────┬─────────────────────────────────────┤
│ Sidebar   │  Breadcrumb                         │
│ Filters   │  Subcategory chips (8 pills)        │
│           │  Sort buttons (5 nút)               │
│ - Giá     │  Product Grid (12 cards)            │
│ - Danh mục│  Pagination (1-12)                  │
│ - Thương  │                                     │
│   hiệu   │                                     │
│ - Xuất xứ │                                     │
├───────────┴─────────────────────────────────────┤
│  [Component] Top Searches                       │
├─────────────────────────────────────────────────┤
│  [Component] Promises + Newsletter + Footer     │
└─────────────────────────────────────────────────┘
```

---

## 🔌 CHI TIẾT API TỪNG VÙNG

---

### 1. Breadcrumb

**Mô tả UI**: Trang chủ > Danh mục > Tên danh mục hiện tại

**Dữ liệu cần**: Tên danh mục cha → con (từ URL param `category_id` hoặc `slug`)

→ Lấy từ response API danh sách sản phẩm bên dưới (field `category`).

---

### 2. Subcategory Chips (8 pills filter)

**Mô tả UI**: "Tất cả", "Thuốc giảm đau...", "Thuốc kháng viêm...", v.v. Click → lọc sản phẩm.

```
GET /api/catalog/categories/{parent_id}/children
```

| Param | Type | Mô tả |
|-------|------|-------|
| `parent_id` | int (path) | ID danh mục cha đang xem |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 111, "name": "Thuốc giảm đau", "slug": "thuoc-giam-dau", "product_count": 45 },
    { "id": 112, "name": "Thuốc kháng viêm", "slug": "thuoc-khang-viem", "product_count": 32 }
  ]
}
```

---

### 3. Sort Buttons (5 nút sắp xếp)

**Mô tả UI**: Phổ biến | Bán chạy | Giá thấp → cao | Giá cao → thấp | Mới nhất

→ Gửi query param `sort` khi gọi API products.

| Nút | Giá trị `sort` |
|-----|----------------|
| Phổ biến | `popular` |
| Bán chạy | `best_seller` |
| Giá thấp → cao | `price_asc` |
| Giá cao → thấp | `price_desc` |
| Mới nhất | `newest` |

---

### 4. Sidebar Filters

**Mô tả UI**: 4 nhóm filter radio/checkbox:
- **Giá**: 5 radio (Dưới 100k, 100k-300k, 300k-500k, 500k-1M, Trên 1M)
- **Danh mục thuốc**: 8 checkbox
- **Thương hiệu**: 8 checkbox
- **Xuất xứ**: 6 checkbox

#### 4a. Lấy danh sách Filter Options

```
GET /api/catalog/products/filters?category_id={id}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `category_id` | int (query) | ID danh mục đang xem |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "price_ranges": [
      { "label": "Dưới 100,000đ", "min": 0, "max": 100000 },
      { "label": "100,000đ - 300,000đ", "min": 100000, "max": 300000 },
      { "label": "300,000đ - 500,000đ", "min": 300000, "max": 500000 },
      { "label": "500,000đ - 1,000,000đ", "min": 500000, "max": 1000000 },
      { "label": "Trên 1,000,000đ", "min": 1000000, "max": null }
    ],
    "brands": [
      { "id": 1, "name": "Sanofi", "count": 15 },
      { "id": 2, "name": "Pfizer", "count": 8 }
    ],
    "origins": [
      { "id": 1, "name": "Việt Nam", "count": 45 },
      { "id": 2, "name": "Hàn Quốc", "count": 12 }
    ]
  }
}
```

---

### 5. Product Grid (12 sản phẩm)

**Mô tả UI**: Grid 12 product card, mỗi card hiện: ảnh, tên, đơn vị, giá gốc, giá mới, badge giảm giá, nút "Mua ngay", nút "Xem chi tiết".

```
GET /api/catalog/products?category_id={id}&page={p}&limit=12&sort={sort}&price_min={min}&price_max={max}&brand_ids={ids}&origin_ids={ids}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `category_id` | int (query) | ID danh mục |
| `q` | string (query) | Từ khóa tìm kiếm (nếu từ search) |
| `page` | int (query) | Trang hiện tại, mặc định 1 |
| `limit` | int (query) | Số sản phẩm/trang, mặc định 12 |
| `sort` | string (query) | `popular`, `best_seller`, `price_asc`, `price_desc`, `newest` |
| `price_min` | int (query) | Giá tối thiểu |
| `price_max` | int (query) | Giá tối đa |
| `brand_ids` | string (query) | Danh sách brand ID, phân cách bằng dấu `,` |
| `origin_ids` | string (query) | Danh sách origin ID, phân cách bằng dấu `,` |
| `sub_category_id` | int (query) | ID danh mục con (từ subcategory chips) |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "name": "Thuốc Gaviscon Dual Action Reckitt Benckiser",
      "slug": "thuoc-gaviscon",
      "thumbnail": "/assets/images/product1.png",
      "unit": "Hộp",
      "original_price": 300000,
      "price": 240000,
      "discount_percent": 20,
      "in_stock": true,
      "is_prescription": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 142,
    "total_pages": 12
  },
  "category": {
    "id": 11,
    "name": "Thuốc dạ dày - tiêu hóa",
    "slug": "thuoc-da-day-tieu-hoa",
    "parent": { "id": 1, "name": "Thuốc", "slug": "thuoc" }
  }
}
```

---

### 6. Nút "Mua ngay"

**Hành vi**: Thêm sản phẩm vào giỏ (quantity = 1) rồi redirect sang `cart.html`.

```
POST /api/order/cart/items
```

```json
{ "product_id": 101, "quantity": 1 }
```

---

### 7. Nút "Xem chi tiết"

**Hành vi**: Redirect sang `product.html?id={product_id}` hoặc `product.html?slug={slug}`

→ Không gọi API, chỉ redirect.

---

### 8. Pagination

**Hành vi**: Click trang → re-fetch products với `page` param mới.

→ Cùng API mục 5, chỉ thay param `page`.

---

### 9. Top Searches (Component)

→ Cùng API như trang chủ: `GET /api/catalog/products/top-searches?limit=30`

---

## 📊 TỔNG HỢP API CẦN CHO TRANG

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/categories/{parent_id}/children` | GET | catalog | No | Page load |
| 2 | `/api/catalog/products/filters?category_id=X` | GET | catalog | No | Page load |
| 3 | `/api/catalog/products?category_id=X&page=1&limit=12&sort=...` | GET | catalog | No | Page load + Filter/Sort/Page change |
| 4 | `/api/order/cart/items` | POST | order | Yes* | Click "Mua ngay" |
| 5 | `/api/catalog/products/top-searches?limit=30` | GET | catalog | No | Page load |
| 6 | `/api/cms/store-config/public` | GET | cms | No | Page load (header/footer) |
| 7 | `/api/catalog/categories/tree` | GET | catalog | No | Page load (mega menu) |
| 8 | `/api/catalog/products/search-suggest?q=` | GET | catalog | No | User gõ tìm kiếm |
