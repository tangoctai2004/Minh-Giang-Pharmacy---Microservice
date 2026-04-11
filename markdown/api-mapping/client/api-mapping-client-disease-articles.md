# API Mapping — client/disease.html + client/benh-*.html + client/article-*.html

> **Trang**: Nhóm trang tra cứu bệnh lý và bài viết y khoa  
> **Auth yêu cầu**: Không (tất cả public)  
> **Ngày phân tích**: 2026-04-10

---

## PHẦN A — client/disease.html (Tra cứu bệnh lý)

### Sơ đồ bố cục

```
┌─────────────────────────────────────────────────┐
│  [Component] Header                             │
├─────────────────────────────────────────────────┤
│  Hero: "Tra cứu thông tin bệnh lý"             │
│  Search bar: tìm tên bệnh                      │
├─────────────────────────────────────────────────┤
│  Alphabet Grid: A-Z buttons                     │
│  Kết quả theo chữ cái (danh sách bệnh)         │
├─────────────────────────────────────────────────┤
│  Bài viết phổ biến (4 articles)                 │
├─────────────────────────────────────────────────┤
│  [Component] Disease Groups (8 nhóm bệnh)      │
├─────────────────────────────────────────────────┤
│  [Component] Top Searches + Footer              │
└─────────────────────────────────────────────────┘
```

### API chi tiết

#### 1. Tìm kiếm bệnh theo tên

```
GET /api/cms/diseases/search?q={keyword}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `q` | string (query) | Từ khóa tìm kiếm |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Alzheimer", "slug": "alzheimer", "letter": "A" },
    { "id": 2, "name": "Amidan viêm", "slug": "amidan-viem", "letter": "A" }
  ]
}
```

---

#### 2. Lọc bệnh theo chữ cái (A-Z)

```
GET /api/cms/diseases?letter={letter}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `letter` | string (query) | Chữ cái: A, B, C, ..., Z |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Alzheimer", "slug": "alzheimer" },
    { "id": 2, "name": "Amidan viêm", "slug": "amidan-viem" },
    { "id": 3, "name": "Áp xe phổi", "slug": "ap-xe-phoi" },
    { "id": 4, "name": "Áp xe gan", "slug": "ap-xe-gan" }
  ]
}
```

---

#### 3. Bài viết phổ biến

```
GET /api/cms/articles?sort=popular&limit=4&type=disease
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "title": "Bướu cổ: Nguyên nhân, Triệu Chứng và Cách Điều Trị",
      "slug": "buou-co-nguyen-nhan",
      "thumbnail": "...",
      "excerpt": "Bướu cổ là tình trạng...",
      "views": 12500,
      "created_at": "2026-03-01"
    }
  ]
}
```

---

#### 4. Nhóm bệnh (Disease Groups component)

```
GET /api/cms/disease-categories?level=root&limit=8
```

(Cùng API như trang chủ mục 16)

---

## PHẦN B — client/benh-*.html (Danh sách bệnh theo nhóm)

**Các trang**: `benh-chuyen-khoa.html`, `benh-co-the-nguoi.html`, `benh-theo-doi-tuong.html`, `benh-ung-thu.html`

### Sơ đồ bố cục

```
┌─────────────────────────────────────────────────┐
│  [Component] Header                             │
├─────────────────────────────────────────────────┤
│  Hero: Tên nhóm bệnh + mô tả                   │
│  Search bar                                     │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │  Danh sách bệnh/bài viết            │
│ Danh mục │  (cards với thumbnail, title,         │
│ con      │   excerpt, views, date)               │
│          │  Pagination                           │
├──────────┴──────────────────────────────────────┤
│  [Component] Disease Groups + Footer            │
└─────────────────────────────────────────────────┘
```

### API chi tiết

#### 5. Lấy thông tin nhóm bệnh + danh mục con

```
GET /api/cms/disease-categories/{slug}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `slug` | string (path) | Slug nhóm bệnh: `benh-chuyen-khoa`, `benh-ung-thu`, ... |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Bệnh chuyên khoa",
    "slug": "benh-chuyen-khoa",
    "description": "Các bệnh lý chuyên khoa phổ biến...",
    "icon_url": "...",
    "children": [
      { "id": 10, "name": "Tim mạch", "slug": "tim-mach", "article_count": 12 },
      { "id": 11, "name": "Tiêu hóa", "slug": "tieu-hoa", "article_count": 8 }
    ]
  }
}
```

---

#### 6. Danh sách bài viết trong nhóm bệnh

```
GET /api/cms/articles?disease_category_id={id}&page=1&limit=10&q={search}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `disease_category_id` | int (query) | ID nhóm bệnh |
| `page` | int (query) | Trang |
| `limit` | int (query) | Số bài/trang |
| `q` | string (query) | Từ khóa tìm |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "title": "Bệnh gút: Nguyên nhân, triệu chứng và cách điều trị",
      "slug": "benh-gut-nguyen-nhan",
      "thumbnail": "...",
      "excerpt": "Bệnh gút là bệnh viêm khớp...",
      "disease_category": "Bệnh chuyên khoa",
      "views": 5400,
      "author": "DS. Nguyễn Văn A",
      "created_at": "2026-03-15"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 60 }
}
```

---

## PHẦN C — client/article-benh-gut.html (Chi tiết bài viết bệnh lý)

### Sơ đồ bố cục

```
┌─────────────────────────────────────────────────┐
│  [Component] Header                             │
├─────────────────────────────────────────────────┤
│  Breadcrumb: Trang chủ > Bệnh chuyên khoa > ..│
├──────────────────────────┬──────────────────────┤
│  Article Content         │  Sidebar             │
│  - Title                 │  - Mục lục (TOC)     │
│  - Meta: author, date    │  - SP liên quan      │
│  - HTML content          │  - Bài viết liên quan│
│  - Images                │                      │
│  - Tags                  │                      │
├──────────────────────────┴──────────────────────┤
│  [Component] Footer                             │
└─────────────────────────────────────────────────┘
```

### API chi tiết

#### 7. Lấy chi tiết bài viết

```
GET /api/cms/articles/{slug}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `slug` | string (path) | Slug bài viết |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 10,
    "title": "Bệnh gút: Nguyên nhân, triệu chứng và cách điều trị hiệu quả",
    "slug": "benh-gut-nguyen-nhan",
    "content": "<h2>1. Bệnh gút là gì?</h2><p>Bệnh gút (gout) là một dạng...</p>",
    "thumbnail": "...",
    "author": { "name": "DS. Nguyễn Văn A", "avatar_url": null },
    "disease_category": { "id": 1, "name": "Bệnh chuyên khoa", "slug": "benh-chuyen-khoa" },
    "tags": ["gút", "viêm khớp", "axit uric"],
    "views": 5400,
    "created_at": "2026-03-15",
    "updated_at": "2026-03-20",
    "related_products": [
      { "id": 50, "name": "Colchicine 1mg", "slug": "colchicine", "price": 85000, "thumbnail": "..." }
    ],
    "related_articles": [
      { "id": 11, "title": "Viêm khớp dạng thấp", "slug": "viem-khop-dang-thap", "thumbnail": "..." }
    ]
  }
}
```

---

## 📊 TỔNG HỢP API CẦN CHO NHÓM TRANG

| # | API Endpoint | Method | Service | Auth | Trang | Gọi khi |
|---|-------------|--------|---------|------|-------|---------|
| 1 | `/api/cms/diseases/search?q=` | GET | cms | No | disease | Tìm kiếm bệnh |
| 2 | `/api/cms/diseases?letter=X` | GET | cms | No | disease | Click A-Z |
| 3 | `/api/cms/articles?sort=popular&limit=4&type=disease` | GET | cms | No | disease | Page load |
| 4 | `/api/cms/disease-categories?level=root&limit=8` | GET | cms | No | disease | Page load |
| 5 | `/api/cms/disease-categories/{slug}` | GET | cms | No | benh-* | Page load |
| 6 | `/api/cms/articles?disease_category_id=X&page=1` | GET | cms | No | benh-* | Page load + filter |
| 7 | `/api/cms/articles/{slug}` | GET | cms | No | article-* | Page load |
