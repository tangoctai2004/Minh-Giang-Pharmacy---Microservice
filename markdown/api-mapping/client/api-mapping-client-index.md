# API Mapping — client/index.html (Trang chủ)

> **Trang**: `frontend/client/index.html`  
> **Mô tả**: Trang chủ Nhà Thuốc Minh Giang — hiển thị banner, sản phẩm khuyến mãi, danh mục, tra cứu bệnh, tìm kiếm hàng đầu  
> **Auth yêu cầu**: Không (trang public), nhưng nếu đã đăng nhập thì hiển thị thêm thông tin user  
> **Ngày phân tích**: 2026-04-10

---

## 📐 Sơ đồ bố cục trang (top → bottom)

```
┌─────────────────────────────────────────────────┐
│  [Component] Header Banner (banner quảng cáo)   │
├─────────────────────────────────────────────────┤
│  [Component] Top Bar (hệ thống NT, hotline)     │
├─────────────────────────────────────────────────┤
│  [Component] Main Header (logo, tìm kiếm,      │
│              giỏ hàng, đăng nhập, mega menu)    │
├─────────────────────────────────────────────────┤
│  Hero Section (slider + 2 banner phụ)           │
├─────────────────────────────────────────────────┤
│  Feature Shortcuts (5 icon shortcut)            │
├─────────────────────────────────────────────────┤
│  Flash Sale (5 sản phẩm)                        │
├─────────────────────────────────────────────────┤
│  Deal Siêu Khủng (5 sản phẩm)                  │
├─────────────────────────────────────────────────┤
│  Sản Phẩm Bán Chạy (5 sản phẩm)               │
├─────────────────────────────────────────────────┤
│  Giảm Đến 38% (4 sản phẩm combo)               │
├─────────────────────────────────────────────────┤
│  Sản Phẩm Độc Quyền (5 sản phẩm)              │
├─────────────────────────────────────────────────┤
│  Nhập Khẩu 100% (4 sản phẩm)                   │
├─────────────────────────────────────────────────┤
│  Top Thương Hiệu (9 banner + 1 banner lớn)     │
├─────────────────────────────────────────────────┤
│  Danh Mục Sản Phẩm (12 danh mục icon)          │
├─────────────────────────────────────────────────┤
│  Tìm Kiếm Hàng Đầu (tags keyword)              │
├─────────────────────────────────────────────────┤
│  Sản Phẩm Đang Thu Hút (5 sản phẩm)            │
├─────────────────────────────────────────────────┤
│  [Component] Promises (4 cam kết)               │
├─────────────────────────────────────────────────┤
│  [Component] Newsletter (form đăng ký email)    │
├─────────────────────────────────────────────────┤
│  [Component] Main Footer                        │
└─────────────────────────────────────────────────┘
```

---

## 🔌 CHI TIẾT API TỪNG VÙNG

---

### 1. Header Banner (Component: `header_banner.html`)

**Mô tả UI**: Banner mỏng nằm trên cùng, link tới trang khuyến mãi.

| # | Dữ liệu cần | Mô tả |
|---|-------------|-------|
| 1 | Hình ảnh banner | URL hình + alt text |
| 2 | Link đích | URL khi click banner |
| 3 | Trạng thái hiển thị | Có show hay không (admin bật/tắt) |

**API cần gọi:**

```
GET /api/cms/banners?position=header_top&status=active&limit=1
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | int | ID banner |
| `image_url` | string | URL hình ảnh |
| `link_url` | string | URL khi click |
| `alt_text` | string | Alt text cho ảnh |
| `position` | string | Vị trí: `header_top` |
| `sort_order` | int | Thứ tự ưu tiên |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "image_url": "/assets/images/banner_header.png",
    "link_url": "/client/khai-truong.html",
    "alt_text": "Combo giảm đến 38%",
    "position": "header_top"
  }
}
```

---

### 2. Top Bar (Component: `top_bar.html`)

**Mô tả UI**: Thanh trên cùng hiển thị hệ thống nhà thuốc, ngôn ngữ, Hotdeal, Góc sức khỏe, hotline.

| # | Dữ liệu cần | Mô tả |
|---|-------------|-------|
| 1 | Số điện thoại tư vấn | Hotline hiển thị |
| 2 | Link hệ thống nhà thuốc | URL trang chi nhánh |

**API cần gọi:**

```
GET /api/cms/store-config/public
```

| Field | Type | Mô tả |
|-------|------|-------|
| `hotline` | string | Số hotline: "1800 55 88 98" |
| `store_locator_url` | string | URL trang hệ thống nhà thuốc |
| `languages` | array | Danh sách ngôn ngữ hỗ trợ |

**Ghi chú**: Đây là dữ liệu tĩnh, có thể cache dài hạn (1h+).

---

### 3. Main Header (Component: `main_header.html`)

**Mô tả UI**: Logo, thanh tìm kiếm, nút giỏ hàng (hiển thị số lượng), nút đăng nhập/user info, mega menu danh mục.

#### 3a. Thanh tìm kiếm — Gợi ý tìm kiếm (autocomplete)

**Hành vi**: User gõ ký tự → hiện dropdown gợi ý sản phẩm + danh mục.

```
GET /api/catalog/products/search-suggest?q={keyword}&limit=8
```

| Param | Type | Mô tả |
|-------|------|-------|
| `q` | string (query) | Từ khóa tìm kiếm (min 2 ký tự) |
| `limit` | int (query) | Số gợi ý tối đa, mặc định 8 |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "products": [
      { "id": 10, "name": "Panadol Extra", "slug": "panadol-extra", "thumbnail": "...", "price": 45000 }
    ],
    "categories": [
      { "id": 3, "name": "Thuốc giảm đau", "slug": "thuoc-giam-dau" }
    ]
  }
}
```

#### 3b. Nút tìm kiếm — Tìm kiếm sản phẩm

**Hành vi**: User nhấn nút tìm → chuyển hướng sang `category.html?q={keyword}`

```
Không gọi API ở đây — redirect sang trang category.html
```

#### 3c. Nút Giỏ hàng — Hiển thị số lượng sản phẩm trong giỏ

**Hành vi**: Hiện badge số lượng item trong giỏ.

```
GET /api/order/cart/count
```

| Field | Type | Mô tả |
|-------|------|-------|
| `count` | int | Tổng số sản phẩm trong giỏ |

**Ghi chú**: Nếu chưa login → lấy từ `localStorage`. Nếu đã login → gọi API.

**Response mẫu:**
```json
{
  "success": true,
  "data": { "count": 3 }
}
```

#### 3d. Nút Đăng nhập / Thông tin user

**Hành vi**: Nếu chưa login → hiện "Đăng nhập". Nếu đã login → hiện tên user.

```
GET /api/identity/customers/me
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | int | Customer ID |
| `name` | string | Tên khách hàng |
| `avatar_url` | string | Ảnh đại diện (có thể null) |
| `loyalty_points` | int | Điểm tích lũy |

**Ghi chú**: Chỉ gọi khi có JWT token trong localStorage/cookie.

#### 3e. Mega Menu — Danh mục sản phẩm (dropdown)

**Mô tả UI**: Menu đổ xuống theo cấp: Category cha → Subcategory → Sản phẩm bán chạy trong danh mục.

```
GET /api/catalog/categories/tree
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Thuốc",
      "slug": "thuoc",
      "icon_url": null,
      "children": [
        {
          "id": 11,
          "name": "Thuốc dạ dày - tiêu hóa - gan mật",
          "slug": "thuoc-da-day-tieu-hoa",
          "children": [
            { "id": 111, "name": "Thuốc dạ dày", "slug": "thuoc-da-day" },
            { "id": 112, "name": "Men tiêu hóa - vi sinh", "slug": "men-tieu-hoa" }
          ]
        },
        {
          "id": 12,
          "name": "Thuốc cảm - ho - hô hấp",
          "slug": "thuoc-cam-ho",
          "children": []
        }
      ]
    },
    {
      "id": 2,
      "name": "Thực phẩm chức năng",
      "slug": "thuc-pham-chuc-nang",
      "children": [...]
    }
  ]
}
```

#### 3f. Mega Menu — Sản phẩm bán chạy theo danh mục (hover)

**Hành vi**: Hover vào category con → hiển thị 4 sản phẩm bán chạy trong danh mục đó.

```
GET /api/catalog/products?category_id={id}&sort=best_seller&limit=4
```

| Param | Type | Mô tả |
|-------|------|-------|
| `category_id` | int (query) | ID danh mục |
| `sort` | string (query) | `best_seller` |
| `limit` | int (query) | 4 |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "name": "Thuốc Gaviscon Dual Action",
      "slug": "thuoc-gaviscon",
      "thumbnail": "/assets/images/product1.png",
      "price": 240000,
      "original_price": null
    }
  ]
}
```

---

### 4. Hero Section — Slider chính + Banner phụ

**Mô tả UI**: Slider 6 ảnh tự chuyển + 2 banner phụ bên phải.

```
GET /api/cms/banners?position=hero_slider&status=active&sort=sort_order
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | int | ID banner |
| `image_url` | string | URL hình ảnh |
| `link_url` | string | URL khi click |
| `alt_text` | string | Alt text |
| `position` | string | `hero_slider` hoặc `hero_side` |
| `sort_order` | int | Thứ tự hiển thị |

```
GET /api/cms/banners?position=hero_side&status=active&sort=sort_order&limit=2
```

**Response mẫu (slider):**
```json
{
  "success": true,
  "data": [
    { "id": 10, "image_url": "/assets/images/banner_slide_1.png", "link_url": "/khai-truong", "alt_text": "Promo Slide 1", "sort_order": 1 },
    { "id": 11, "image_url": "/assets/images/banner_slide_2.png", "link_url": "/deal-hot", "alt_text": "Promo Slide 2", "sort_order": 2 }
  ]
}
```

---

### 5. Feature Shortcuts (5 icon nhanh)

**Mô tả UI**: 5 icon shortcut: Dược sĩ tư vấn, Mua thuốc theo đơn, Hệ thống nhà thuốc, Deal siêu hot, Sức khỏe tổng quát.

**API cần gọi**: Không cần — dữ liệu tĩnh hardcode hoặc lấy từ store-config.

**Hoặc** nếu muốn quản lý động (admin có thể đổi):

```
GET /api/cms/store-config/public
```

Lấy field `feature_shortcuts` từ response.

---

### 6. Flash Sale — Sản phẩm Flash Sale

**Mô tả UI**: Section "Flash Sale" với 5 sản phẩm có badge giảm giá, giá gốc, giá mới, nút "Thêm giỏ hàng", link "Xem tất cả".

```
GET /api/catalog/products?tag=flash_sale&status=active&limit=5&sort=sort_order
```

| Param | Type | Mô tả |
|-------|------|-------|
| `tag` | string (query) | `flash_sale` — sản phẩm thuộc chương trình flash sale |
| `status` | string (query) | `active` |
| `limit` | int (query) | 5 |
| `sort` | string (query) | `sort_order` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 201,
      "name": "Dung dịch vệ sinh Chilly Protect kháng khuẩn xanh",
      "slug": "dung-dich-ve-sinh-chilly",
      "thumbnail": "/assets/images/product_frame.png",
      "original_price": 280000,
      "price": 247520,
      "discount_percent": 12,
      "in_stock": true
    }
  ],
  "meta": {
    "section_banner": "/assets/images/banner_flash_sale.png",
    "view_all_url": "/category?tag=flash_sale"
  }
}
```

**Nút "Thêm giỏ hàng":**

```
POST /api/order/cart/items
```

| Field | Type | Mô tả |
|-------|------|-------|
| `product_id` | int (body) | ID sản phẩm |
| `quantity` | int (body) | Số lượng, mặc định 1 |

**Request mẫu:**
```json
{ "product_id": 201, "quantity": 1 }
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Đã thêm vào giỏ hàng",
  "data": { "cart_count": 4 }
}
```

**Ghi chú**: Nếu chưa login → lưu `localStorage`, khi login sẽ sync lên server.

---

### 7. Deal Siêu Khủng — Sản phẩm deal lớn

**Mô tả UI**: Tương tự Flash Sale — 5 sản phẩm deal + nút "Thêm giỏ hàng" + "Xem tất cả".

```
GET /api/catalog/products?tag=super_deal&status=active&limit=5&sort=sort_order
```

(Cấu trúc response giống section 6)

---

### 8. Sản Phẩm Bán Chạy

**Mô tả UI**: 5 sản phẩm bán chạy nhất + nút "Thêm giỏ hàng" + "Xem tất cả".

```
GET /api/catalog/products?sort=best_seller&status=active&limit=5
```

(Cấu trúc response giống section 6)

---

### 9. Giảm Đến 38% — Combo khuyến mãi

**Mô tả UI**: 4 sản phẩm combo giảm giá + nút "Thêm giỏ hàng" + "Xem tất cả".

```
GET /api/catalog/products?tag=discount_combo&status=active&limit=4&sort=sort_order
```

(Cấu trúc response giống section 6)

---

### 10. Sản Phẩm Độc Quyền

**Mô tả UI**: 5 sản phẩm độc quyền + nút "Thêm giỏ hàng" + "Xem tất cả".

```
GET /api/catalog/products?tag=exclusive&status=active&limit=5&sort=sort_order
```

(Cấu trúc response giống section 6)

---

### 11. Nhập Khẩu 100%

**Mô tả UI**: 4 sản phẩm nhập khẩu + nút "Thêm giỏ hàng" + "Xem tất cả".

```
GET /api/catalog/products?tag=imported&status=active&limit=4&sort=sort_order
```

(Cấu trúc response giống section 6)

---

### 12. Top Thương Hiệu & Sản Phẩm Nổi Bật

**Mô tả UI**: 9 banner thương hiệu nhỏ + 1 banner ngang lớn. Click → trang thương hiệu/khuyến mãi.

```
GET /api/cms/banners?position=top_brands&status=active&sort=sort_order
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 30, "image_url": "...", "link_url": "/category?brand=blackmores", "alt_text": "Blackmores", "size": "small" },
    { "id": 31, "image_url": "...", "link_url": "/khai-truong", "alt_text": "Đặt hàng online", "size": "large" }
  ]
}
```

---

### 13. Danh Mục Sản Phẩm (12 icon)

**Mô tả UI**: Grid 12 danh mục với icon + tên. Click → chuyển sang `category.html?id={category_id}`.

```
GET /api/catalog/categories?level=featured&limit=12
```

| Param | Type | Mô tả |
|-------|------|-------|
| `level` | string (query) | `featured` — chỉ lấy danh mục nổi bật cho trang chủ |
| `limit` | int (query) | 12 |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 5, "name": "Thần kinh não", "slug": "than-kinh-nao", "icon_url": "/assets/images/icon_category_than_kinh_nao.png" },
    { "id": 6, "name": "Vitamin & Khoáng chất", "slug": "vitamin-khoang-chat", "icon_url": "/assets/images/icon_category_vitamin_va_khoang_chat.png" }
  ]
}
```

---

### 14. Tìm Kiếm Hàng Đầu (Tags)

**Mô tả UI**: Danh sách tag keyword phổ biến. Click → chuyển sang `category.html?q={keyword}`.

```
GET /api/catalog/products/top-searches?limit=30
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "keyword": "Nước hồng sâm", "slug": "nuoc-hong-sam", "count": 1250 },
    { "keyword": "Vitamin nhóm B", "slug": "vitamin-nhom-b", "count": 980 }
  ]
}
```

---

### 15. Sản Phẩm Đang Thu Hút

**Mô tả UI**: 5 sản phẩm trending + nút "Thêm giỏ hàng" + nút prev/next (slider).

```
GET /api/catalog/products?sort=trending&status=active&limit=10
```

**Ghi chú**: Lấy 10 sản phẩm, frontend hiển thị 5 + cho phép slide sang 5 tiếp.

(Cấu trúc response giống section 6)

---

### 16. Tra Cứu Theo Nhóm Bệnh (Component: `disease_groups.html`)

**Mô tả UI**: Grid 8 nhóm bệnh với icon, tên, số bài viết. Click → `benh-{slug}.html`.

```
GET /api/cms/disease-categories?level=root&limit=8
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | int | ID nhóm bệnh |
| `name` | string | Tên nhóm: "Bệnh chuyên khoa" |
| `slug` | string | Slug URL |
| `icon_url` | string | URL icon |
| `article_count` | int | Số bài viết trong nhóm |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Bệnh chuyên khoa", "slug": "benh-chuyen-khoa", "icon_url": "...", "article_count": 60 },
    { "id": 2, "name": "Bệnh mãn tính", "slug": "benh-man-tinh", "icon_url": "...", "article_count": 1 }
  ]
}
```

---

### 17. Promises (Component: `promises.html`)

**Mô tả UI**: 4 cam kết: Chính hãng, Miễn phí vận chuyển, Đổi trả 30 ngày, Nhà thuốc gần bạn.

**API cần gọi**: Không cần — dữ liệu tĩnh hardcode.

---

### 18. Newsletter (Component: `newsletter.html`)

**Mô tả UI**: Form nhập email + nút "Đăng ký".

**Nút "Đăng ký":**

```
POST /api/notification/newsletter/subscribe
```

| Field | Type | Mô tả |
|-------|------|-------|
| `email` | string (body) | Email đăng ký |

**Request mẫu:**
```json
{ "email": "user@example.com" }
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Đăng ký nhận tin thành công!"
}
```

---

### 19. Footer (Component: `main_footer.html`)

**Mô tả UI**: Thông tin liên hệ, danh mục, links thông tin, social, phương thức thanh toán.

```
GET /api/cms/store-config/public
```

Dùng chung với API ở mục 2, lấy thêm:

| Field | Type | Mô tả |
|-------|------|-------|
| `address` | string | Địa chỉ cửa hàng |
| `phone` | string | Số điện thoại |
| `email` | string | Email liên hệ |
| `social_links` | object | `{ facebook, zalo, tiktok, youtube }` |
| `payment_methods` | array | `["zalopay", "momo", "vnpay", "cod"]` |

---

## 📊 TỔNG HỢP API CẦN CHO TRANG

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/cms/banners?position=header_top` | GET | cms | No | Page load |
| 2 | `/api/cms/store-config/public` | GET | cms | No | Page load (cache) |
| 3 | `/api/catalog/products/search-suggest?q=` | GET | catalog | No | User gõ tìm kiếm |
| 4 | `/api/order/cart/count` | GET | order | Yes* | Page load (nếu login) |
| 5 | `/api/identity/customers/me` | GET | identity | Yes | Page load (nếu login) |
| 6 | `/api/catalog/categories/tree` | GET | catalog | No | Page load (mega menu) |
| 7 | `/api/catalog/products?category_id=X&sort=best_seller&limit=4` | GET | catalog | No | Hover mega menu |
| 8 | `/api/cms/banners?position=hero_slider` | GET | cms | No | Page load |
| 9 | `/api/cms/banners?position=hero_side` | GET | cms | No | Page load |
| 10 | `/api/catalog/products?tag=flash_sale&limit=5` | GET | catalog | No | Page load |
| 11 | `/api/catalog/products?tag=super_deal&limit=5` | GET | catalog | No | Page load |
| 12 | `/api/catalog/products?sort=best_seller&limit=5` | GET | catalog | No | Page load |
| 13 | `/api/catalog/products?tag=discount_combo&limit=4` | GET | catalog | No | Page load |
| 14 | `/api/catalog/products?tag=exclusive&limit=5` | GET | catalog | No | Page load |
| 15 | `/api/catalog/products?tag=imported&limit=4` | GET | catalog | No | Page load |
| 16 | `/api/cms/banners?position=top_brands` | GET | cms | No | Page load |
| 17 | `/api/catalog/categories?level=featured&limit=12` | GET | catalog | No | Page load |
| 18 | `/api/catalog/products/top-searches?limit=30` | GET | catalog | No | Page load |
| 19 | `/api/catalog/products?sort=trending&limit=10` | GET | catalog | No | Page load |
| 20 | `/api/cms/disease-categories?level=root&limit=8` | GET | cms | No | Page load |
| 21 | `/api/order/cart/items` | POST | order | Yes* | Click "Thêm giỏ hàng" |
| 22 | `/api/notification/newsletter/subscribe` | POST | notification | No | Click "Đăng ký" newsletter |

> **Yes***: Nếu chưa login → thao tác trên localStorage, sau khi login sẽ sync.

---

## 🔄 GỢI Ý TỐI ƯU: GỘP API

Trang chủ gọi rất nhiều API khi load. Nên tạo **1 endpoint tổng hợp** để giảm round-trip:

```
GET /api/cms/homepage
```

**Response gộp:**
```json
{
  "banners": {
    "header_top": [...],
    "hero_slider": [...],
    "hero_side": [...],
    "top_brands": [...]
  },
  "product_sections": {
    "flash_sale": [...],
    "super_deal": [...],
    "best_seller": [...],
    "discount_combo": [...],
    "exclusive": [...],
    "imported": [...],
    "trending": [...]
  },
  "categories_featured": [...],
  "disease_groups": [...],
  "top_searches": [...],
  "store_config": { "hotline": "...", "address": "...", ... }
}
```

Hoặc giữ từng API riêng lẻ và gọi **song song** (`Promise.all`).
