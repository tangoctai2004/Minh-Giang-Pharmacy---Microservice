# API Mapping — admin/cms-articles.html

> **Trang**: Nội Dung Y Khoa (CMS) — Bài viết, Danh mục, Thư viện  
> **Auth yêu cầu**: Có (Admin/Content Editor)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                            │
├──────────────────────────────────────────────────────────────────┤
│  4 Stat Cards:                                                   │
│  Tổng bài(84)|Đã xuất bản(71)|Nháp/Chờ duyệt(13)|Views tháng(12,840)│
├──────────────────────────────────────────────────────────────────┤
│  Tabs: [Bài Viết Bệnh Học] [Danh Mục Bệnh] [Thư Viện Hình Ảnh]│
├──────────────────────────────────────────────────────────────────┤
│  TAB 1 — Bài Viết:                                              │
│  ┌──────────────┬───────────────────────────────────────────────┐│
│  │ Sidebar 260px│ Article Cards                                ││
│  │ Category tree│ Thumbnail|Title|Meta|Excerpt|Status|Actions  ││
│  │ 7 disease cats│ Filters: [Search][TT▼][Sort▼]              ││
│  │ + counts     │ Actions: [Xuất][Viết bài mới]               ││
│  └──────────────┴───────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────┤
│  TAB 2 — Danh Mục Bệnh:                                         │
│  Table: Tên DM|Trang HTML|Số bài|Thao tác                       │
│  Inline form: Tên*|Trang HTML|Icon class|Màu|Mô tả              │
├──────────────────────────────────────────────────────────────────┤
│  TAB 3 — Thư Viện Hình Ảnh:                                     │
│  Drag-drop zone (JPG/PNG/WebP/SVG, 5MB)                         │
│  Image grid (auto-fill 140px) + Search                           │
├──────────────────────────────────────────────────────────────────┤
│  MODAL Article Editor (900px fullheight):                        │
│  Left: Tiêu đề*|Meta desc|Rich text editor                      │
│  Right: Danh mục*|Tác giả|Ảnh đại diện|SP liên quan|Tags       │
│  Footer: [Lưu nháp] [Xuất bản]                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Thống kê CMS

```
GET /api/cms/articles/stats
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "total_articles": 84,
    "published": 71,
    "draft_pending": 13,
    "views_this_month": 12840
  }
}
```

---

### 2. Danh sách bài viết (Tab 1)

```
GET /api/cms/articles?page=1&limit=10&disease_category_id={id}&status={status}&sort={sort}&q={search}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `disease_category_id` | int | Lọc theo danh mục (sidebar) |
| `status` | string | `published`, `draft`, `review` |
| `sort` | string | `newest`, `popular`, `oldest` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "title": "Bệnh gút: Nguyên nhân, triệu chứng...",
      "slug": "benh-gut",
      "thumbnail": "...",
      "excerpt": "Bệnh gút là bệnh viêm khớp...",
      "author": "DS. Nguyễn Văn A",
      "disease_category": { "id": 1, "name": "Bệnh chuyên khoa" },
      "status": "published",
      "views": 5400,
      "created_at": "2026-03-15"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 84 }
}
```

---

### 3. Danh mục bệnh (sidebar filter + Tab 2)

```
GET /api/cms/disease-categories
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Bệnh chuyên khoa", "icon_class": "fa-stethoscope", "color": "#dc2626", "article_count": 12, "html_page": "benh-chuyen-khoa.html" },
    { "id": 2, "name": "Bệnh cơ thể người", "icon_class": "fa-person", "color": "#2563eb", "article_count": 8, "html_page": "benh-co-the-nguoi.html" }
  ]
}
```

---

### 4. Thêm danh mục bệnh

```
POST /api/cms/disease-categories
```

**Body:**
```json
{
  "name": "Bệnh truyền nhiễm",
  "html_page": "benh-truyen-nhiem.html",
  "icon_class": "fa-virus",
  "color": "#f59e0b",
  "description": "Các bệnh lý truyền nhiễm phổ biến"
}
```

---

### 5. Cập nhật danh mục bệnh

```
PUT /api/cms/disease-categories/{id}
```

---

### 6. Xóa danh mục bệnh

```
DELETE /api/cms/disease-categories/{id}
```

---

### 7. Chi tiết bài viết (cho editor modal)

```
GET /api/cms/articles/{id}
```

Response đầy đủ bao gồm `content` HTML, tags, related_products, etc.

---

### 8. Tạo bài viết mới

```
POST /api/cms/articles
```

**Body:**
```json
{
  "title": "Viêm phổi: Nguyên nhân và cách phòng ngừa",
  "meta_description": "Tìm hiểu về viêm phổi...",
  "content": "<h2>1. Viêm phổi là gì?</h2><p>...</p>",
  "disease_category_id": 1,
  "author_id": 2,
  "thumbnail_url": "...",
  "related_product_ids": [50, 51],
  "tags": ["viêm phổi", "hô hấp", "kháng sinh"],
  "status": "draft"
}
```

---

### 9. Cập nhật bài viết

```
PUT /api/cms/articles/{id}
```

---

### 10. Xuất bản bài viết (từ draft/review → published)

```
PUT /api/cms/articles/{id}/publish
```

---

### 11. Danh sách tác giả (cho dropdown)

```
GET /api/identity/users?role=author
```

---

### 12. Upload hình ảnh (Thư viện)

```
POST /api/cms/media/upload
Content-Type: multipart/form-data
```

**Body:** `file: <binary>` (JPG/PNG/WebP/SVG, max 5MB)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 120,
    "url": "/uploads/cms/image-120.webp",
    "filename": "viem-phoi-001.webp",
    "size": 245000,
    "uploaded_at": "2026-03-05"
  }
}
```

---

### 13. Danh sách hình ảnh thư viện

```
GET /api/cms/media?page=1&limit=30&q={search}
```

---

### 14. Xóa hình ảnh

```
DELETE /api/cms/media/{id}
```

---

### 15. Tìm sản phẩm liên quan (cho article editor)

```
GET /api/catalog/products/search?q={keyword}&limit=5
```

---

### 16. Xuất danh sách bài viết

```
GET /api/cms/articles/export?format=xlsx
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/cms/articles/stats` | GET | cms | Yes | Page load |
| 2 | `/api/cms/articles` | GET | cms | Yes | Tab Articles + filter |
| 3 | `/api/cms/disease-categories` | GET | cms | Yes | Page load (sidebar + Tab 2) |
| 4 | `/api/cms/disease-categories` | POST | cms | Yes | Thêm danh mục |
| 5 | `/api/cms/disease-categories/{id}` | PUT | cms | Yes | Sửa danh mục |
| 6 | `/api/cms/disease-categories/{id}` | DELETE | cms | Yes | Xóa danh mục |
| 7 | `/api/cms/articles/{id}` | GET | cms | Yes | Open editor |
| 8 | `/api/cms/articles` | POST | cms | Yes | Tạo bài viết |
| 9 | `/api/cms/articles/{id}` | PUT | cms | Yes | Cập nhật bài viết |
| 10 | `/api/cms/articles/{id}/publish` | PUT | cms | Yes | Xuất bản |
| 11 | `/api/identity/users?role=author` | GET | identity | Yes | Open editor (dropdown) |
| 12 | `/api/cms/media/upload` | POST | cms | Yes | Upload ảnh |
| 13 | `/api/cms/media` | GET | cms | Yes | Tab Thư viện |
| 14 | `/api/cms/media/{id}` | DELETE | cms | Yes | Xóa ảnh |
| 15 | `/api/catalog/products/search` | GET | catalog | Yes | Tìm SP liên quan |
| 16 | `/api/cms/articles/export` | GET | cms | Yes | Xuất danh sách |
