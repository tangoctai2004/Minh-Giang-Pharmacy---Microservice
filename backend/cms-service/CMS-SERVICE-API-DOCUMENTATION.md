 # 📘 CMS SERVICE — TỔNG HỢP API DOCUMENTATION

> **Service**: `cms-service` (port 8004)  
> **Gateway prefix**: `/api/cms/...`  
> **Database**: `mg_cms` (MySQL 8)  
> **Ngày tạo**: 2026-06-14  
> **Cập nhật lần cuối**: 2026-06-14

---

## 📋 MỤC LỤC

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Articles — Bài viết sức khỏe](#2-articles--bài-viết-sức-khỏe)
3. [Diseases — Tra cứu bệnh lý](#3-diseases--tra-cứu-bệnh-lý)
4. [Disease Categories — Nhóm bệnh](#4-disease-categories--nhóm-bệnh)
5. [Banners — Banner quảng cáo](#5-banners--banner-quảng-cáo)
6. [Categories — Danh mục CMS](#6-categories--danh-mục-cms)
7. [Promotions — Khuyến mãi & Voucher](#7-promotions--khuyến-mãi--voucher)
8. [Store Config — Cấu hình nhà thuốc](#8-store-config--cấu-hình-nhà-thuốc)
9. [Pages — Trang tĩnh CMS](#9-pages--trang-tĩnh-cms)
10. [Media — Thư viện hình ảnh](#10-media--thư-viện-hình-ảnh)
11. [Trending Searches — Từ khóa tìm kiếm phổ biến](#11-trending-searches--từ-khóa-tìm-kiếm-phổ-biến)
12. [BẢNG TỔNG HỢP TOÀN BỘ API](#12-bảng-tổng-hợp-toàn-bộ-api)

---

## 1. Tổng quan kiến trúc

### Routing qua API Gateway

```
Client → API Gateway (port 8000)
         ├─ /api/cms/* → cms-service (port 8004)
         ├─ /api/catalog/* → catalog-service
         ├─ /api/order/* → order-service
         └─ /api/identity/* → identity-service
```

### Xác thực

- **Public API**: Các endpoint GET cho client không cần auth (được whitelist trong gateway)
- **Admin/Manager API**: Cần header `x-user-id`, `x-user-role` do gateway inject từ JWT token
- Middleware `gatewayAuth` trích xuất user context từ headers
- Middleware `requireRoles(['admin', 'manager'])` kiểm tra quyền viết

### Các trang frontend sử dụng CMS API

| Trang frontend | Mô tả | File |
|---|---|---|
| `index.html` | Trang chủ | `frontend/client/index.html` |
| `disease.html` | Tra cứu bệnh lý (trang mẹ) | `frontend/client/disease.html` |
| `benh-chuyen-khoa.html` | Nhóm bệnh chuyên khoa (Level 2) | `frontend/client/benh-chuyen-khoa.html` |
| `benh-co-the-nguoi.html` | Nhóm bệnh cơ thể người (Level 2) | `frontend/client/benh-co-the-nguoi.html` |
| `benh-theo-doi-tuong.html` | Nhóm bệnh theo đối tượng (Level 2) | `frontend/client/benh-theo-doi-tuong.html` |
| `benh-ung-thu.html` | Nhóm bệnh ung thư (Level 2) | `frontend/client/benh-ung-thu.html` |
| `benh-man-tinh.html` | Nhóm bệnh mãn tính (Level 2) | `frontend/client/benh-man-tinh.html` |
| `benh-theo-mua.html` | Nhóm bệnh theo mùa (Level 2) | `frontend/client/benh-theo-mua.html` |
| `benh-truyen-nhiem.html` | Nhóm bệnh truyền nhiễm (Level 2) | `frontend/client/benh-truyen-nhiem.html` |
| `benh-la-hiem-gap.html` | Nhóm bệnh lạ / hiếm gặp (Level 2) | `frontend/client/benh-la-hiem-gap.html` |
| `article.html` | Chi tiết bài viết bệnh lý (Level 3) | `frontend/client/article.html` |
| `khai-truong.html` | Trang khai trương | `frontend/client/khai-truong.html` |
| `search.html` | Trang tìm kiếm sản phẩm | `frontend/client/search.html` |
| `category.html` | Trang danh mục sản phẩm | `frontend/client/category.html` |
| `product.html` | Chi tiết sản phẩm | `frontend/client/product.html` |
| `cart.html` | Giỏ hàng | `frontend/client/cart.html` |
| `checkout.html` | Thanh toán | `frontend/client/checkout.html` |
| `user-profile.html` | Hồ sơ người dùng | `frontend/client/user-profile.html` |
| Component: `disease_groups.html` | Component nhóm bệnh (dùng chung) | `frontend/components/disease_groups.html` |
| Component: `main_header.html` | Header chính (dùng chung) | `frontend/components/main_header.html` |
| Component: `main_footer.html` | Footer chính (dùng chung) | `frontend/components/main_footer.html` |
| Component: `top_bar.html` | Top bar (dùng chung) | `frontend/components/top_bar.html` |
| Component: `newsletter.html` | Đăng ký newsletter | `frontend/components/newsletter.html` |

---

## 2. Articles — Bài viết sức khỏe

### 2.1 GET /api/cms/articles — Danh sách bài viết đã publish

**Auth**: Không (Public)  
**Route file**: `articles/articles.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `disease.html` | Section "Bài viết phổ biến" | Hiển thị 4 bài viết bệnh lý có lượt xem cao nhất, mỗi bài gồm: thumbnail, tiêu đề, đoạn tóm tắt, số views, ngày viết |
| `benh-chuyen-khoa.html` | Main content area | Hiển thị danh sách bài viết thuộc nhóm "Bệnh chuyên khoa" dưới dạng card grid, có sidebar lọc theo danh mục con, phân trang |
| `benh-co-the-nguoi.html` | Main content area | Hiển thị danh sách bài viết thuộc nhóm "Bệnh cơ thể người" dưới dạng article grid, có sidebar danh mục con |
| `benh-theo-doi-tuong.html` | Main content area | Hiển thị danh sách bài viết thuộc nhóm "Bệnh theo đối tượng" dưới dạng article grid |
| `benh-ung-thu.html` | Main content area | Hiển thị danh sách bài viết thuộc nhóm "Bệnh ung thư" dưới dạng article grid |
| `benh-man-tinh.html` | Main content area | Hiển thị danh sách bài viết thuộc nhóm "Bệnh mãn tính" |
| `benh-theo-mua.html` | Main content area | Hiển thị danh sách bài viết thuộc nhóm "Bệnh theo mùa" |
| `benh-truyen-nhiem.html` | Main content area | Hiển thị danh sách bài viết thuộc nhóm "Bệnh truyền nhiễm" |
| `benh-la-hiem-gap.html` | Main content area | Hiển thị danh sách bài viết thuộc nhóm "Bệnh lạ / hiếm gặp" |

**Query params:**

| Param | Type | Mô tả | Ví dụ |
|---|---|---|---|
| `category_id` | int | Lọc theo danh mục CMS (ID trực tiếp) | `?category_id=7` |
| `disease_category_id` | int | Lọc theo nhóm bệnh (bao gồm cả con) | `?disease_category_id=2` |
| `type` | string | Lọc theo loại danh mục (`disease`, `article`, `promotion`) | `?type=disease` |
| `q` | string | Fulltext search trên title + excerpt | `?q=viêm phổi` |
| `tags` | string | Lọc theo tag JSON | `?tags=benh-gut` |
| `sort` | string | Sắp xếp: `popular` (theo views) hoặc mặc định (mới nhất) | `?sort=popular` |
| `page` | int | Số trang (mặc định 1) | `?page=2` |
| `limit` | int | Số bài/trang (mặc định 12, tối đa 50) | `?limit=4` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "title": "Bệnh gút: Nguyên nhân, triệu chứng và cách điều trị",
      "slug": "benh-gut-nguyen-nhan-trieu-chung-va-cach-dieu-tri",
      "thumbnail_url": "/uploads/cms/benh-gut.webp",
      "thumbnail": "/uploads/cms/benh-gut.webp",
      "excerpt": "Bệnh gút là bệnh viêm khớp do rối loạn chuyển hóa...",
      "view_count": 5400,
      "views": 5400,
      "published_at": "2026-03-15T00:00:00.000Z",
      "created_at": "2026-03-15T00:00:00.000Z",
      "category_id": 7,
      "category_name": "Cơ - Xương - Khớp",
      "category_slug": "co-xuong-khop",
      "author": "Dược sĩ Minh Giang",
      "disease_category": "Cơ - Xương - Khớp"
    }
  ],
  "pagination": {
    "total": 54,
    "page": 1,
    "limit": 12,
    "pages": 5
  }
}
```

**Cách gọi theo từng trang:**

```
# Trang disease.html — Bài viết phổ biến (4 bài)
GET /api/cms/articles?sort=popular&limit=4&type=disease

# Trang benh-chuyen-khoa.html — Tất cả bài thuộc nhóm bệnh chuyên khoa
GET /api/cms/articles?disease_category_id=2&page=1&limit=12

# Trang benh-chuyen-khoa.html — Lọc theo danh mục con (ví dụ: Tim mạch)
GET /api/cms/articles?disease_category_id=2&category_id=7&page=1&limit=12

# Tìm kiếm bài viết trong nhóm
GET /api/cms/articles?disease_category_id=2&q=viêm khớp&page=1&limit=12
```

---

### 2.2 GET /api/cms/articles/:idOrSlug — Chi tiết bài viết

**Auth**: Không (Public)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `article.html` | Toàn bộ trang | Hiển thị nội dung đầy đủ của 1 bài viết bệnh lý, bao gồm: tiêu đề, tên tác giả, ngày viết, nội dung HTML, ảnh đại diện, tags, mục lục (TOC tự động), sidebar sản phẩm liên quan, bài viết liên quan |
| `article.html` | Sidebar "Sản phẩm liên quan" | Hiển thị 2 sản phẩm điều trị phù hợp với bệnh (gợi ý theo slug bài viết) |
| `article.html` | Sidebar "Bài viết liên quan" | Hiển thị 3 bài viết cùng danh mục, mỗi bài gồm thumbnail + tiêu đề |
| `article.html` | Breadcrumb | Hiển thị đường dẫn: Trang chủ > Nhóm bệnh > Tên bài viết |

**Path params:**

| Param | Type | Mô tả |
|---|---|---|
| `idOrSlug` | string/int | ID số hoặc slug chuỗi của bài viết |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 10,
    "title": "Bệnh gút: Nguyên nhân, triệu chứng và cách điều trị hiệu quả",
    "slug": "benh-gut-nguyen-nhan-trieu-chung-va-cach-dieu-tri",
    "content": "<h2>1. Bệnh gút là gì?</h2><p>Bệnh gút (gout) là một dạng...</p>",
    "thumbnail": "/uploads/cms/benh-gut.webp",
    "thumbnail_url": "/uploads/cms/benh-gut.webp",
    "excerpt": "Bệnh gút là bệnh viêm khớp...",
    "tags": ["gút", "viêm khớp", "axit uric"],
    "views": 5400,
    "view_count": 5400,
    "created_at": "2026-03-15T00:00:00.000Z",
    "updated_at": "2026-03-15T00:00:00.000Z",
    "author": { "name": "DS. Lâm Giang", "avatar_url": null },
    "disease_category": {
      "id": 7,
      "name": "Cơ - Xương - Khớp",
      "slug": "co-xuong-khop"
    },
    "related_products": [
      {
        "id": 101,
        "name": "Colchicine 1mg Viatris (Hộp 20 viên)",
        "slug": "colchicine-1mg-viatris",
        "price": 85000,
        "thumbnail": "/assets/images/products/colchicine.png"
      }
    ],
    "related_articles": [
      {
        "id": 11,
        "title": "Viêm khớp dạng thấp",
        "slug": "viem-khop-dang-thap",
        "thumbnail": "/uploads/cms/viem-khop.webp"
      }
    ]
  }
}
```

**Side effect**: Mỗi lần GET thành công → `view_count` tự động +1 (bất đồng bộ)

---

### 2.3 GET /api/cms/articles/admin — Danh sách bài viết (Admin)

**Auth**: Có (admin/manager)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin (`cms-articles.html`) | Tab "Bài Viết Bệnh Học" | Hiển thị bảng tất cả bài viết (kể cả draft, archived) với các cột: tiêu đề, trạng thái, lượt xem, ngày tạo, ngày cập nhật. Dùng để quản lý, chỉnh sửa, xóa bài viết |
| CMS Admin | Stat Cards | Dữ liệu từ endpoint này dùng tính toán thống kê: tổng bài, đã publish, nháp/chờ duyệt |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `status` | string | `draft`, `published`, `archived` |
| `category_id` | int | Lọc theo danh mục |
| `page` | int | Số trang |
| `limit` | int | Số bài/trang (mặc định 20) |

---

### 2.4 POST /api/cms/articles — Tạo bài viết mới

**Auth**: Có (admin/manager)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin | Modal "Viết bài mới" | Khi admin nhấn "Viết bài mới" → hiện modal editor gồm: tiêu đề, meta description, rich text editor, dropdown chọn danh mục, tác giả, upload ảnh đại diện, chọn sản phẩm liên quan, nhập tags. Nhấn "Lưu nháp" hoặc "Xuất bản" → gọi API này |

**Body bắt buộc:**
```json
{
  "title": "Viêm phổi: Nguyên nhân và cách phòng ngừa",
  "content": "<h2>1. Viêm phổi là gì?</h2><p>...</p>",
  "category_id": 7,
  "excerpt": "Tìm hiểu về viêm phổi...",
  "thumbnail_url": "/uploads/cms/viem-phoi.webp",
  "tags": ["viêm phổi", "hô hấp"],
  "status": "draft"
}
```

---

### 2.5 PUT /api/cms/articles/:id — Cập nhật bài viết

**Auth**: Có (admin/manager)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin | Modal editor (edit mode) | Khi admin click "Sửa" trên bài viết → hiện modal editor với dữ liệu bài viết. Sau khi sửa → gọi API này. Hỗ trợ partial update (chỉ gửi trường thay đổi) |

---

### 2.6 DELETE /api/cms/articles/:id — Soft delete (chuyển archived)

**Auth**: Có (admin/manager)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin | Nút "Xóa" trên mỗi bài viết | Khi admin click "Xóa" → bài viết chuyển trạng thái sang `archived`, không xóa vĩnh viễn khỏi DB |

---

## 3. Diseases — Tra cứu bệnh lý

### 3.1 GET /api/cms/diseases/search — Tìm kiếm bệnh theo tên

**Auth**: Không (Public)  
**Route file**: `diseases/diseases.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `disease.html` | Search bar "Tìm kiếm bệnh" | Khi user gõ từ khóa vào thanh tìm kiếm trong Hero section → hiển thị dropdown gợi ý danh sách bệnh khớp từ khóa. Mỗi kết quả gồm: tên bệnh, chữ cái đầu (letter). Click vào kết quả → chuyển sang trang `article.html?slug=...` |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `q` | string | Từ khóa tìm kiếm (tìm trong title, excerpt, content) |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Alzheimer", "title": "Alzheimer", "slug": "alzheimer", "letter": "A" },
    { "id": 2, "name": "Amidan viêm", "title": "Amidan viêm", "slug": "amidan-viem", "letter": "A" }
  ]
}
```

---

### 3.2 GET /api/cms/diseases?letter=X — Lọc bệnh theo chữ cái

**Auth**: Không (Public)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `disease.html` | Section "Alphabet Grid" (A-Z buttons) | Khi user click vào nút chữ cái (A, B, C, ..., Z) → hiển thị danh sách tất cả bệnh bắt đầu bằng chữ cái đó bên dưới grid. Mỗi bệnh hiển thị: tên bệnh (link) → click chuyển sang `article.html?slug=...` |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `letter` | string | Một chữ cái A-Z |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Alzheimer", "title": "Alzheimer", "slug": "alzheimer" },
    { "id": 3, "name": "Áp xe phổi", "title": "Áp xe phổi", "slug": "ap-xe-phoi" }
  ]
}
```

**Lưu ý**: Chữ cái đầu được chuẩn hóa từ tiếng Việt (bỏ dấu). Ví dụ: "Ăn" → "A", "Đau" → "D"

---

## 4. Disease Categories — Nhóm bệnh

### 4.1 GET /api/cms/disease-categories — Danh sách nhóm bệnh

**Auth**: Không (Public)  
**Route file**: `disease_categories/disease-categories.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `disease.html` | Section "Tra cứu theo nhóm bệnh" | Hiển thị grid 8 nhóm bệnh chính (Level 1) gồm: icon, tên nhóm, số bài viết. Click → chuyển sang trang `benh-{slug}.html` tương ứng |
| `index.html` | Component `disease_groups.html` | Hiển thị component grid 8 nhóm bệnh ở cuối trang chủ (bệnh chuyên khoa, bệnh mãn tính, bệnh theo mùa,...) |
| Các trang `benh-*.html` | Component `disease_groups.html` cuối trang | Hiển thị lại grid nhóm bệnh để người dùng dễ chuyển sang nhóm bệnh khác |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `level` | string | `root` — chỉ lấy nhóm bệnh gốc (parent_id IS NULL) |
| `limit` | int | Số nhóm tối đa (mặc định 8, tối đa 50) |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "name": "Bệnh chuyên khoa",
      "slug": "benh-chuyen-khoa",
      "description": "Các bệnh lý chuyên khoa phổ biến...",
      "icon_url": "/assets/images/benh-ly/icon_benh_chuyen_khoa.png",
      "sort_order": 1
    },
    {
      "id": 3,
      "name": "Bệnh mãn tính",
      "slug": "benh-man-tinh",
      "description": null,
      "icon_url": "/assets/images/benh-ly/icon_benh_man_tinh.png",
      "sort_order": 2
    }
  ]
}
```

---

### 4.2 GET /api/cms/disease-categories/:slug — Chi tiết nhóm bệnh + danh mục con

**Auth**: Không (Public)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `benh-chuyen-khoa.html` | Hero section + Sidebar | Hero: hiển thị tên nhóm bệnh + mô tả. Sidebar: hiển thị danh sách danh mục con (ví dụ: Tim mạch, Tiêu hóa, Cơ-Xương-Khớp,...) kèm số bài viết mỗi mục. Click danh mục con → lọc bài viết theo `category_id` |
| `benh-co-the-nguoi.html` | Hero + Sidebar | Tương tự — hiển thị danh mục con của "Bệnh cơ thể người" (Đầu, Cổ, Mắt,...) |
| `benh-theo-doi-tuong.html` | Hero + Sidebar | Tương tự — hiển thị danh mục con theo đối tượng (Trẻ em, Người cao tuổi,...) |
| `benh-ung-thu.html` | Hero + Sidebar | Tương tự — hiển thị danh mục con ung thư (Ung thư phổi, Ung thư gan,...) |
| `benh-man-tinh.html` | Hero + Sidebar | Tương tự |
| `benh-theo-mua.html` | Hero + Sidebar | Tương tự |
| `benh-truyen-nhiem.html` | Hero + Sidebar | Tương tự |
| `benh-la-hiem-gap.html` | Hero + Sidebar | Tương tự |

**Path params:**

| Param | Type | Mô tả |
|---|---|---|
| `slug` | string | Slug nhóm bệnh: `benh-chuyen-khoa`, `benh-ung-thu`, ... |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Bệnh chuyên khoa",
    "slug": "benh-chuyen-khoa",
    "description": "Các bệnh lý chuyên khoa phổ biến...",
    "icon_url": "/assets/images/benh-ly/icon_benh_chuyen_khoa.png",
    "children": [
      { "id": 7, "name": "Cơ - Xương - Khớp", "slug": "co-xuong-khop", "article_count": 12 },
      { "id": 8, "name": "Da - Tóc - Móng", "slug": "da-toc-mong", "article_count": 8 },
      { "id": 9, "name": "Đầu", "slug": "dau", "article_count": 5 },
      { "id": 10, "name": "Cổ", "slug": "co", "article_count": 3 },
      { "id": 11, "name": "Nam", "slug": "nam", "article_count": 4 }
    ]
  }
}
```

---

## 5. Banners — Banner quảng cáo

### 5.1 GET /api/cms/banners — Danh sách banner active

**Auth**: Không (Public)  
**Route file**: `banners/banners.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị | Query |
|---|---|---|---|
| `index.html` | Component `header_banner.html` | Banner mỏng nằm trên cùng trang (banner quảng cáo). Click → chuyển trang KM | `?position=hero` (hoặc theo cấu hình) |
| `index.html` | Hero slider | 6 ảnh banner slider tự chuyển ở đầu trang. Mỗi slide có link đích | `?position=hero` |
| `index.html` | Side banners | 2 banner phụ bên phải hero slider | `?position=sidebar` |
| `index.html` | Section "Top Thương Hiệu" | 9 banner thương hiệu nhỏ + 1 banner ngang lớn. Click → trang thương hiệu | (có thể dùng position khác) |
| `khai-truong.html` | Gallery section | Hình ảnh nhà thuốc, banner quảng cáo khai trương | `?position=popup` hoặc theo cấu hình |
| Các trang `benh-*.html` | Sidebar banner (nếu có) | Banner quảng cáo sản phẩm liên quan bên sidebar | `?position=sidebar` |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `position` | string | Vị trí: `hero`, `popup`, `sidebar` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Banner Khai Trương",
      "image_url": "/assets/images/banner_slide_1.png",
      "link_url": "/client/khai-truong.html",
      "position": "hero",
      "sort_order": 1,
      "start_date": "2026-03-01",
      "end_date": "2026-12-31"
    }
  ]
}
```

**Điều kiện lọc tự động:**
- `is_active = 1`
- `start_date <= CURDATE()` (đã bắt đầu)
- `end_date >= CURDATE()` (chưa hết hạn)

---

### 5.2 GET /api/cms/banners/admin — Tất cả banner (Admin)

**Auth**: Có (admin)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin (`admin/cms-articles.html`) | Tab quản lý banner (nếu có) | Hiển thị bảng tất cả banner kể cả inactive, cho phép admin xem, bật/tắt, sửa, xóa banner |

---

### 5.3 POST /api/cms/banners — Tạo banner mới

**Auth**: Có (admin)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin | Form tạo banner | Admin tạo banner mới: nhập title, upload ảnh, chọn vị trí (hero/popup/sidebar), nhập link đích, ngày bắt đầu/kết thúc |

**Body:**
```json
{
  "title": "Banner Flash Sale",
  "image_url": "/uploads/banners/flash-sale.webp",
  "position": "hero",
  "link_url": "/client/category.html?tag=flash_sale",
  "start_date": "2026-06-01",
  "end_date": "2026-06-30",
  "sort_order": 1
}
```

---

### 5.4 PUT /api/cms/banners/:id — Cập nhật banner

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Inline edit banner | Admin sửa thông tin banner (partial update) |

---

### 5.5 DELETE /api/cms/banners/:id — Soft delete banner

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Nút "Ẩn" trên banner | Ẩn banner (is_active = 0), không xóa vĩnh viễn |

---

## 6. Categories — Danh mục CMS

### 6.1 GET /api/cms/categories — Danh sách danh mục CMS

**Auth**: Không (Public)  
**Route file**: `categories/categories.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin | Tab "Danh Mục Bệnh" — sidebar filter | Hiển thị danh sách danh mục bệnh dạng tree (sidebar bên trái tab bài viết). Admin click vào danh mục → lọc bài viết theo danh mục đó |
| CMS Admin | Tab "Danh Mục Bệnh" — bảng quản lý | Hiển thị bảng: Tên DM, Trang HTML, Số bài, Thao tác (sửa/xóa). Form inline tạo mới: Tên, Trang HTML, Icon class, Màu, Mô tả |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `type` | string | `article`, `disease`, `promotion` — lọc theo loại |
| `parent_id` | int/string | Lọc theo danh mục cha. `null` → root categories |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "name": "Bệnh chuyên khoa",
      "slug": "benh-chuyen-khoa",
      "type": "disease",
      "parent_id": null,
      "description": "Các bệnh lý chuyên khoa",
      "image_url": "/assets/images/benh-ly/icon_benh_chuyen_khoa.png",
      "sort_order": 1
    }
  ]
}
```

---

### 6.2 GET /api/cms/categories/tree — Cây danh mục phân cấp

**Auth**: Không (Public)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin | Sidebar filter tree | Cây danh mục phân cấp: root → children → grandchildren. Dùng cho sidebar lọc bài viết, dropdown chọn danh mục trong editor |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `type` | string | Lọc theo loại: `disease`, `article`, `promotion` |

---

### 6.3 GET /api/cms/categories/:id — Chi tiết danh mục

**Auth**: Không (Public)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Xem chi tiết danh mục | Lấy thông tin đầy đủ 1 danh mục (name, slug, type, parent_id,...) |

---

### 6.4 POST /api/cms/categories — Tạo danh mục mới

**Auth**: Có (admin/manager)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Form tạo danh mục | Admin tạo danh mục mới: nhập tên, loại (disease/article/promotion), chọn parent, mô tả, icon |

**Body:**
```json
{
  "name": "Bệnh truyền nhiễm",
  "type": "disease",
  "parent_id": null,
  "description": "Các bệnh lý truyền nhiễm phổ biến",
  "image_url": "/assets/images/benh-ly/icon_benh_truyen_nhiem.png",
  "sort_order": 4
}
```

---

### 6.5 PUT /api/cms/categories/:id — Cập nhật danh mục

**Auth**: Có (admin/manager)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Inline edit danh mục | Sửa tên, slug, type, parent, description,... (partial update) |

---

### 6.6 DELETE /api/cms/categories/:id — Soft delete danh mục

**Auth**: Có (admin/manager)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Nút "Xóa" danh mục | Ẩn danh mục (is_active = 0). **Không cho phép xóa** nếu còn bài viết đang sử dụng danh mục này |

---

## 7. Promotions — Khuyến mãi & Voucher

### 7.1 GET /api/cms/promotions/active — Khuyến mãi đang chạy

**Auth**: Không (Public)  
**Route file**: `promotions/promotions.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `khai-truong.html` | Section "Ưu đãi khai trương" | Hiển thị 3 card khuyến mãi: mỗi card gồm badge phần trăm giảm giá, tiêu đề KM, mô tả, nút "Xem ngay" → chuyển sang trang `category.html` |
| `checkout.html` | Section "Áp dụng mã khuyến mãi" | Hiển thị danh sách KM tự động áp dụng (không cần nhập mã) cho đơn hàng hiện tại |
| `index.html` | Có thể dùng cho Flash Sale, Deal Siêu Khủng | Lấy thông tin KM để hiển thị badge giảm giá, thời gian còn lại |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Giảm 50% toàn bộ Thuốc OTC",
      "code": null,
      "type": "percent_discount",
      "discount_value": 50,
      "min_order_value": 0,
      "max_discount_amount": 500000,
      "applicable_to": "specific_categories",
      "applicable_ids": "[1,2,3]",
      "start_date": "2026-03-15",
      "end_date": "2026-03-17"
    }
  ]
}
```

---

### 7.2 GET /api/cms/promotions/validate/:code — Validate mã voucher

**Auth**: Không (Public)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `checkout.html` | Ô nhập mã voucher | Khi user nhập mã voucher → nhấn "Áp dụng" → gọi API này. Nếu hợp lệ: hiển thị tên KM + số tiền giảm + cập nhật tổng tiền. Nếu không hợp lệ: hiển thị thông báo lỗi |

**Path params:**

| Param | Type | Mô tả |
|---|---|---|
| `code` | string | Mã voucher (ví dụ: KHAITRUONG50) |

---

### 7.3 GET /api/cms/promotions — Tất cả KM (Admin)

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin Promotions page | Bảng danh sách KM | Hiển thị tất cả KM với filter: active/inactive, loại, phân trang. Mỗi KM hiển thị: tên, mã, loại, giá trị giảm, thời gian, số lượt dùng |

---

### 7.4 GET /api/cms/promotions/:id — Chi tiết KM (Admin)

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Xem chi tiết KM | Lấy toàn bộ thông tin KM để hiển thị trong form edit |

---

### 7.5 POST /api/cms/promotions — Tạo KM mới

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Form tạo KM | Nhập: tên, loại giảm (%), mã voucher, giá trị, đơn tối thiểu, áp dụng cho (tất cả/danh mục/SP cụ thể), thời gian, giới hạn lượt dùng |

**Body:**
```json
{
  "name": "Giảm 40% TPCN",
  "type": "percent_discount",
  "discount_value": 40,
  "code": "TPCN40",
  "start_date": "2026-03-15",
  "end_date": "2026-03-17",
  "min_order_value": 100000,
  "max_discount_amount": 200000,
  "applicable_to": "specific_categories",
  "applicable_ids": [5, 6],
  "usage_limit": 1000
}
```

---

### 7.6 PUT /api/cms/promotions/:id — Cập nhật KM

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Form edit KM | Partial update KM. Lưu ý: `usage_count` KHÔNG được sửa trực tiếp (chỉ tăng qua order-service) |

---

### 7.7 DELETE /api/cms/promotions/:id — Tắt KM

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Nút "Tắt" KM | Soft delete: is_active = 0. KM không còn hiển thị cho user |

---

## 8. Store Config — Cấu hình nhà thuốc

### 8.1 GET /api/cms/store-config/public — Config công khai

**Auth**: Không (Public)  
**Route file**: `store_config/store-config.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| Mọi trang | Component `top_bar.html` | Hiển thị: số hotline (1800 55 88 98), link hệ thống nhà thuốc. Dữ liệu từ key `hotline`, `store_locator_url` |
| Mọi trang | Component `main_footer.html` | Hiển thị: địa chỉ cửa hàng, số điện thoại, email, link mạng xã hội (Facebook, Zalo, TikTok, YouTube), phương thức thanh toán |
| `khai-truong.html` | Section "Thông tin chi nhánh mới" | Hiển thị: địa chỉ, hotline, giờ mở cửa, thông tin đội ngũ dược sĩ |
| `index.html` | Feature Shortcuts | 5 icon shortcut có thể lấy cấu hình từ store-config |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "store_name": "Nhà Thuốc Minh Giang",
    "hotline": "1800 55 88 98",
    "address": "Tầng 4, Tòa nhà Minh Giang, 42 Mai Chí Thọ, KĐC 586, Phường Hưng Phú, TP Cần Thơ",
    "email": "info@minhgiang.vn",
    "working_hours": "07h30 — 21h30 hàng ngày",
    "social_facebook": "https://facebook.com/nhathuocminhgiang",
    "social_zalo": "https://zalo.me/nhathuocminhgiang",
    "payment_methods": ["zalopay", "momo", "vnpay", "cod"]
  }
}
```

**Ghi chú**: Dữ liệu tĩnh, nên cache dài hạn (1h+). Không bao giờ trả config có `is_sensitive = 1`.

---

### 8.2 GET /api/cms/store-config — Tất cả config (Admin)

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin Settings | Bảng cấu hình hệ thống | Hiển thị tất cả config key-value. Config nhạy cảm (API key, password) hiện `***HIDDEN***`. Lọc theo nhóm: `store`, `payment`, `shipping`, `loyalty`, `notification` |

---

### 8.3 POST /api/cms/store-config — Tạo config key mới

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Form thêm config | Tạo key mới: config_key (snake_case), display_name, value, type (string/integer/decimal/boolean/json), nhóm, sensitive |

---

### 8.4 PUT /api/cms/store-config/:key — Cập nhật config value

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Inline edit config | Sửa giá trị config. Không cho sửa config có `is_editable = 0` |

---

### 8.5 DELETE /api/cms/store-config/:key — Vô hiệu hóa config

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Nút "Vô hiệu" config | Soft delete: is_active = 0. Config không còn trả về qua `/public` |

---

## 9. Pages — Trang tĩnh CMS

### 9.1 GET /api/cms/pages — Danh sách trang tĩnh

**Auth**: Không (Public)  
**Route file**: `pages/pages.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| Mọi trang | Component `main_footer.html` | Danh sách link footer: Về chúng tôi, Chính sách bảo mật, Chính sách đổi trả, Điều khoản dịch vụ, Hướng dẫn mua hàng,... Chỉ hiển thị trang có `show_in_footer = 1` |

---

### 9.2 GET /api/cms/pages/footer — Trang hiển thị trong footer

**Auth**: Không (Public)

| Trang | Section | Mô tả |
|---|---|---|
| Mọi trang | Footer links | Chỉ lấy trang tĩnh có `show_in_footer = 1` để render danh sách link ở footer |

---

### 9.3 GET /api/cms/pages/:slug — Nội dung trang theo slug

**Auth**: Không (Public)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| Trang tĩnh (ví dụ: `about-us`, `chinh-sach-bao-mat`) | Toàn bộ trang | Render nội dung HTML đầy đủ của trang tĩnh. Gồm: title, content HTML, meta SEO, ảnh featured. User truy cập qua `/pages/ve-chung-toi` |

---

### 9.4 GET /api/cms/pages/admin/:id — Chi tiết trang (Admin)

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Xem chi tiết trang (kể cả inactive) | Lấy toàn bộ thông tin trang để hiển thị trong form edit |

---

### 9.5 POST /api/cms/pages — Tạo trang tĩnh

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Form tạo trang mới | Nhập: tiêu đề, nội dung (rich text), slug, meta SEO, ảnh featured, hiển thị footer, thứ tự |

---

### 9.6 PUT /api/cms/pages/:id — Cập nhật trang

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Form edit trang | Partial update trang tĩnh. Hỗ trợ action `publish` để publish trang lần đầu |

---

### 9.7 DELETE /api/cms/pages/:id — Ẩn trang

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Nút "Ẩn" trang | Soft delete: is_active = 0 |

---

## 10. Media — Thư viện hình ảnh

### 10.1 GET /api/cms/media — Danh sách media

**Auth**: Có (staff+)  
**Route file**: `media/media.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| CMS Admin | Tab "Thư Viện Hình Ảnh" | Hiển thị grid ảnh đã upload (auto-fill 140px). Mỗi ảnh hiển thị: thumbnail, tên file, kích thước. Có search bar tìm ảnh. Click → copy URL ảnh để dùng trong bài viết/banner |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `media_type` | string | `image`, `document`, `video`, `other` |
| `used_in` | string | `articles`, `banners`, `products` — lọc theo nơi dùng |
| `q` | string | Tìm theo tên file hoặc alt text |
| `page` | int | Trang |
| `limit` | int | Số item/trang (mặc định 20) |

---

### 10.2 GET /api/cms/media/admin/stats — Thống kê thư viện

**Auth**: Có (admin/manager)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Stat card "Thư viện" | Hiển thị: tổng số file, tổng dung lượng (MB), phân bổ theo loại (image/document/video) |

---

### 10.3 GET /api/cms/media/:id — Chi tiết media

**Auth**: Có (staff+)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Modal xem chi tiết ảnh | Hiển thị: preview ảnh, metadata (kích thước, mime type, width/height, alt text, tags, nơi sử dụng) |

---

### 10.4 POST /api/cms/media — Đăng ký metadata media

**Auth**: Có (admin/manager)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Drag-drop zone upload ảnh | Sau khi upload file lên storage → gọi API này đăng ký metadata: tên file, URL, dung lượng, mime type, loại media |

**Body:**
```json
{
  "original_name": "viem-phoi-001.webp",
  "stored_name": "cms_2026_abc123.webp",
  "file_url": "/uploads/cms/cms_2026_abc123.webp",
  "file_size": 245000,
  "mime_type": "image/webp",
  "media_type": "image",
  "width": 800,
  "height": 600,
  "alt_text": "Hình ảnh minh họa viêm phổi",
  "used_in": "articles",
  "used_in_id": 10
}
```

**Extension whitelist**: `jpg, jpeg, png, webp, gif, pdf, mp4, mov, webm, csv, xlsx, xls, doc, docx`

---

### 10.5 DELETE /api/cms/media/:id — Soft delete media

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| CMS Admin | Nút "Xóa" trên ảnh | Soft delete: is_deleted = 1, ghi nhận deleted_at |

---

## 11. Trending Searches — Từ khóa tìm kiếm phổ biến

### 11.1 GET /api/cms/trending-searches — Top hot search

**Auth**: Không (Public)  
**Route file**: `trending_searches/trending-searches.routes.js`

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `index.html` | Section "Tìm Kiếm Hàng Đầu" | Hiển thị danh sách 20 tag keyword phổ biến: "Nước hồng sâm", "Vitamin nhóm B", "Tiêu hóa",... Mỗi tag là nút bấm → click chuyển sang `search.html?q={keyword}` |
| `search.html` | Gợi ý tìm kiếm | Có thể hiển thị trending keywords khi ô tìm kiếm trống |
| Component `main_header.html` | Dropdown tìm kiếm | Gợi ý trending keywords khi user focus vào ô tìm kiếm (chưa gõ gì) |

**Query params:**

| Param | Type | Mô tả |
|---|---|---|
| `context` | string | `global`, `product`, `disease`, `article` (mặc định `global`) |
| `limit` | int | Số kết quả (mặc định 10, tối đa 30) |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "keyword": "nước hồng sâm",
      "search_count": 1250,
      "distinct_users": 890,
      "is_pinned": 1,
      "last_searched": "2026-06-14T03:45:00.000Z"
    },
    {
      "id": 2,
      "keyword": "vitamin nhóm b",
      "search_count": 980,
      "distinct_users": 720,
      "is_pinned": 0,
      "last_searched": "2026-06-14T02:30:00.000Z"
    }
  ]
}
```

**Sắp xếp**: Ghim (pinned) trước → sau đó theo search_count giảm dần

---

### 11.2 POST /api/cms/trending-searches/track — Ghi nhận lượt tìm kiếm

**Auth**: Không (Public)

**Hiển thị ở đâu / Làm gì:**

| Trang | Section | Mô tả hiển thị |
|---|---|---|
| `search.html` | Khi user submit tìm kiếm | Tự động gọi API này ở background khi user tìm kiếm sản phẩm. Upsert: nếu keyword đã có → tăng search_count, nếu chưa → insert mới. Dữ liệu này phục vụ thống kê và hiển thị trending |
| Component `main_header.html` | Khi user nhấn nút tìm kiếm | Tương tự — track keyword khi user submit form tìm kiếm |

**Body:**
```json
{
  "keyword": "vitamin c",
  "context": "product"
}
```

---

### 11.3 GET /api/cms/trending-searches/admin — Tất cả keyword (Admin)

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Quản lý hot search | Bảng tất cả keyword kể cả hidden: keyword, search_count, trạng thái ghim/ẩn. Filter: context, pinned, hidden |

---

### 11.4 PUT /api/cms/trending-searches/:id/pin — Ghim/bỏ ghim keyword

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Nút "Ghim" keyword | Ghim keyword lên đầu danh sách hot search. Keyword ghim luôn hiển thị trên cùng ở frontend |

---

### 11.5 PUT /api/cms/trending-searches/:id/hide — Ẩn/hiện keyword

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Nút "Ẩn" keyword | Ẩn keyword khỏi danh sách hot search hiển thị cho user (vẫn track data) |

---

### 11.6 DELETE /api/cms/trending-searches/:id — Xóa keyword vĩnh viễn

**Auth**: Có (admin)

| Trang | Section | Mô tả |
|---|---|---|
| Admin | Nút "Xóa" keyword | Xóa vĩnh viễn keyword khỏi DB (không soft delete) |

---

## 12. BẢNG TỔNG HỢP & TRẠNG THÁI TÍCH HỢP

> [!IMPORTANT]
> **CHÚ THÍCH TRẠNG THÁI TÍCH HỢP (STATUS BADGES):**
> *   `BE: OK` 🟢: API Backend đã viết hoàn chỉnh và chạy thử nghiệm thành công.
> *   `GW: WL` 🟢: Gateway đã whitelist route này, Client có thể gửi request công khai mà không cần JWT.
> *   `GW: JWT` 🔒: Gateway yêu cầu header `Authorization: Bearer <JWT_TOKEN>` và kiểm tra phân quyền.
> *   `FE: Mock` 🟡: Giao diện frontend/admin hiện tại vẫn đang dùng dữ liệu tĩnh (Mock/Hardcode) và chưa được tích hợp API thật.
> *   `FE: OK` 🟢: Giao diện frontend/admin đã gọi API thật thành công (dữ liệu động).
> *   `Seed` 💾: Cần chạy lệnh nạp dữ liệu mẫu (database seeds) trước khi hệ thống hoạt động thực tế.

---

### A. API PUBLIC (Client-side, không cần auth)

| # | Method | Endpoint | Trang sử dụng | Trạng thái tích hợp | Mục đích / Hiển thị |
|---|---|---|---|---|---|
| 1 | GET | `/api/cms/articles` | `disease.html`, `benh-*.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Danh sách bài viết bệnh lý (filter, phân trang) |
| 2 | GET | `/api/cms/articles/:idOrSlug` | `article.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Chi tiết bài viết + SP liên quan + bài liên quan |
| 3 | GET | `/api/cms/diseases/search?q=` | `disease.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Tìm kiếm bệnh theo tên (search bar) |
| 4 | GET | `/api/cms/diseases?letter=X` | `disease.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Lọc bệnh theo chữ cái A-Z |
| 5 | GET | `/api/cms/disease-categories` | `disease.html`, `index.html`, `benh-*.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Grid 8 nhóm bệnh (component dùng chung) |
| 6 | GET | `/api/cms/disease-categories/:slug` | `benh-*.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Chi tiết nhóm bệnh + danh mục con + đếm bài |
| 7 | GET | `/api/cms/banners` | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Banner slider, sidebar, thương hiệu |
| 8 | GET | `/api/cms/categories` | (Admin sidebar) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Danh mục CMS (filter theo type) |
| 9 | GET | `/api/cms/categories/tree` | (Admin sidebar) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Cây danh mục phân cấp |
| 10 | GET | `/api/cms/promotions/active` | `khai-truong.html`, `checkout.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | KM đang chạy (tự động áp dụng) |
| 11 | GET | `/api/cms/promotions/validate/:code` | `checkout.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Validate mã voucher |
| 12 | GET | `/api/cms/store-config/public` | Mọi trang (header, footer) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Config công khai (hotline, địa chỉ, MXH,...) |
| 13 | GET | `/api/cms/pages` | Mọi trang (footer) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Danh sách trang tĩnh |
| 14 | GET | `/api/cms/pages/footer` | Mọi trang (footer) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Trang hiển thị trong footer |
| 15 | GET | `/api/cms/pages/:slug` | Trang tĩnh riêng | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Nội dung trang theo slug |
| 16 | GET | `/api/cms/trending-searches` | `index.html`, `search.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡<br>`Seed` 💾 | Top từ khóa hot search |
| 17 | POST | `/api/cms/trending-searches/track` | `search.html`, header search | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Ghi nhận lượt tìm kiếm |

---

### B. API ADMIN (Cần auth — admin/manager)

| # | Method | Endpoint | Trang Admin | Trạng thái tích hợp | Mục đích |
|---|---|---|---|---|---|
| 18 | GET | `/api/cms/articles/admin` | CMS Articles | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tất cả bài viết (draft+published+archived) |
| 19 | POST | `/api/cms/articles` | CMS Articles | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tạo bài viết mới |
| 20 | PUT | `/api/cms/articles/:id` | CMS Articles | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Cập nhật bài viết |
| 21 | DELETE | `/api/cms/articles/:id` | CMS Articles | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Soft delete bài viết → archived |
| 22 | GET | `/api/cms/banners/admin` | CMS Banners | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tất cả banner (gồm inactive) |
| 23 | POST | `/api/cms/banners` | CMS Banners | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tạo banner mới |
| 24 | PUT | `/api/cms/banners/:id` | CMS Banners | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Cập nhật banner |
| 25 | DELETE | `/api/cms/banners/:id` | CMS Banners | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Ẩn banner |
| 26 | GET | `/api/cms/categories/:id` | CMS Categories | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Chi tiết 1 danh mục |
| 27 | POST | `/api/cms/categories` | CMS Categories | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tạo danh mục mới |
| 28 | PUT | `/api/cms/categories/:id` | CMS Categories | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Cập nhật danh mục |
| 29 | DELETE | `/api/cms/categories/:id` | CMS Categories | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Ẩn danh mục |
| 30 | GET | `/api/cms/promotions` | Promotions | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tất cả KM (phân trang) |
| 31 | GET | `/api/cms/promotions/:id` | Promotions | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Chi tiết KM |
| 32 | POST | `/api/cms/promotions` | Promotions | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tạo KM mới |
| 33 | PUT | `/api/cms/promotions/:id` | Promotions | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Cập nhật KM |
| 34 | DELETE | `/api/cms/promotions/:id` | Promotions | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tắt KM |
| 35 | GET | `/api/cms/store-config` | Settings | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tất cả config (sensitive ẩn value) |
| 36 | POST | `/api/cms/store-config` | Settings | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tạo config key mới |
| 37 | PUT | `/api/cms/store-config/:key` | Settings | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Cập nhật config value |
| 38 | DELETE | `/api/cms/store-config/:key` | Settings | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Vô hiệu hóa config |
| 39 | GET | `/api/cms/pages/admin/:id` | Pages | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Chi tiết trang (kể cả inactive) |
| 40 | POST | `/api/cms/pages` | Pages | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tạo trang tĩnh mới |
| 41 | PUT | `/api/cms/pages/:id` | Pages | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Cập nhật trang tĩnh |
| 42 | DELETE | `/api/cms/pages/:id` | Pages | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Ẩn trang tĩnh |
| 43 | GET | `/api/cms/media` | Media Library | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Danh sách media (filter+pagination) |
| 44 | GET | `/api/cms/media/admin/stats` | Media Library | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Thống kê thư viện |
| 45 | GET | `/api/cms/media/:id` | Media Library | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Chi tiết media |
| 46 | POST | `/api/cms/media` | Media Library | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Đăng ký metadata media |
| 47 | DELETE | `/api/cms/media/:id` | Media Library | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Soft delete media |
| 48 | GET | `/api/cms/trending-searches/admin` | Trending Searches | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Tất cả keyword (gồm hidden) |
| 49 | PUT | `/api/cms/trending-searches/:id/pin` | Trending Searches | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Ghim/bỏ ghim keyword |
| 50 | PUT | `/api/cms/trending-searches/:id/hide` | Trending Searches | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Ẩn/hiện keyword |
| 51 | DELETE | `/api/cms/trending-searches/:id` | Trending Searches | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Xóa keyword vĩnh viễn |

---

### C. API TỪ SERVICE KHÁC (CMS Service KHÔNG cung cấp — liệt kê để tham khảo)

Các API sau thuộc service khác nhưng cũng được gọi từ các trang frontend:

| # | Method | Endpoint | Service | Trang sử dụng | Trạng thái | Mục đích |
|---|---|---|---|---|---|---|
| C1 | GET | `/api/catalog/products/search-suggest?q=` | catalog | Mọi trang (header) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Gợi ý tìm kiếm sản phẩm (autocomplete) |
| C2 | GET | `/api/catalog/categories/tree` | catalog | Mọi trang (mega menu) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Cây danh mục sản phẩm (mega menu) |
| C3 | GET | `/api/catalog/products?tag=flash_sale` | catalog | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Sản phẩm Flash Sale |
| C4 | GET | `/api/catalog/products?tag=super_deal` | catalog | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Sản phẩm Deal Siêu Khủng |
| C5 | GET | `/api/catalog/products?sort=best_seller` | catalog | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Sản phẩm bán chạy |
| C6 | GET | `/api/catalog/products?tag=discount_combo` | catalog | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Combo giảm giá |
| C7 | GET | `/api/catalog/products?tag=exclusive` | catalog | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Sản phẩm độc quyền |
| C8 | GET | `/api/catalog/products?tag=imported` | catalog | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Sản phẩm nhập khẩu |
| C9 | GET | `/api/catalog/products?sort=trending` | catalog | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Sản phẩm đang thu hút |
| C10 | GET | `/api/catalog/categories?level=featured` | catalog | `index.html` | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | 12 danh mục sản phẩm nổi bật |
| C11 | GET | `/api/order/cart/count` | order | Mọi trang (header) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Số lượng SP trong giỏ |
| C12 | POST | `/api/order/cart/items` | order | Mọi trang (nút Thêm giỏ) | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Thêm SP vào giỏ hàng |
| C13 | GET | `/api/identity/customers/me` | identity | Mọi trang (header) | `BE: OK` 🟢<br>`GW: JWT` 🔒<br>`FE: Mock` 🟡 | Thông tin user đã đăng nhập |
| C14 | POST | `/api/notification/newsletter/subscribe` | notification | Mọi trang (newsletter) | `BE: OK` 🟢<br>`GW: WL` 🟢<br>`FE: Mock` 🟡 | Đăng ký nhận tin email |

---

## 📊 THỐNG KÊ TỔNG QUAN

| Tiêu chí | Số lượng |
|---|---|
| **Tổng API CMS Service** | **51 endpoints** |
| API Public (không cần auth) | 17 endpoints |
| API Admin (cần auth) | 34 endpoints |
| Module Articles | 6 endpoints |
| Module Diseases | 2 endpoints |
| Module Disease Categories | 2 endpoints |
| Module Banners | 5 endpoints |
| Module Categories | 6 endpoints |
| Module Promotions | 7 endpoints |
| Module Store Config | 5 endpoints |
| Module Pages | 7 endpoints |
| Module Media | 5 endpoints |
| Module Trending Searches | 6 endpoints |
| API từ service khác (tham khảo) | 14 endpoints |

---

> **Ghi chú**: Tài liệu này phản ánh đúng code backend hiện tại trong `backend/cms-service/`. Mọi thay đổi route cần cập nhật lại file này.
