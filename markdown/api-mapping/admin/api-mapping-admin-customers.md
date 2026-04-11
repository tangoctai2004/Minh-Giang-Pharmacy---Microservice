# API Mapping — admin/customers.html

> **Trang**: Quản lý Khách hàng & Tích điểm  
> **Auth yêu cầu**: Có (Admin/Manager)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                        │
├──────────────────────────────────────────────────────────────┤
│  Page Header: "Quản lý Khách hàng"                           │
│  Filters: [Hạng TV▼ Bronze/Silver/Gold/Platinum]             │
│           [Sắp xếp▼ Chi tiêu/Mới nhất/Điểm]                │
│  Actions: [Xuất Excel] [Thêm Khách Hàng]                    │
├──────────────────────────────────────────────────────────────┤
│  Table: ID|KH(Tên+SĐT)|Tổng chi tiêu|Điểm|Hạng TV|         │
│         Gần cập nhật|Thao tác [View profile]                 │
├──────────────────────────────────────────────────────────────┤
│  SLIDE-OVER (450px):                                         │
│  Loyalty Card: Points, Tier, Total spend, [Điều chỉnh điểm] │
│  Last 5 purchases list                                       │
└──────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Danh sách khách hàng

```
GET /api/identity/customers?page=1&limit=20&tier={tier}&sort={sort}&q={search}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `tier` | string | `bronze`, `silver`, `gold`, `platinum` |
| `sort` | string | `total_spend`, `newest`, `points` |
| `q` | string | Tìm tên, SĐT |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Nguyễn Thị Mai",
      "phone": "0901234567",
      "total_spend": 5200000,
      "current_points": 520,
      "tier": "silver",
      "last_updated": "2026-03-04"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1248 }
}
```

---

### 2. Chi tiết khách hàng (slide-over)

```
GET /api/identity/customers/{id}
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Nguyễn Thị Mai",
    "phone": "0901234567",
    "email": "mai@email.com",
    "tier": "silver",
    "current_points": 520,
    "total_spend": 5200000,
    "recent_purchases": [
      {
        "order_code": "POS-2026-0312",
        "date": "2026-03-04",
        "total": 185000,
        "channel": "pos"
      }
    ]
  }
}
```

---

### 3. Thêm khách hàng mới

```
POST /api/identity/customers
```

**Body:**
```json
{
  "name": "Trần Văn B",
  "phone": "0909888777",
  "email": "b@email.com",
  "date_of_birth": "1990-05-15"
}
```

---

### 4. Điều chỉnh điểm thưởng

```
POST /api/identity/customers/{id}/points/adjust
```

**Body:**
```json
{
  "points": 100,
  "type": "add",
  "reason": "Đền bù sự cố đơn hàng"
}
```

---

### 5. Xuất Excel khách hàng

```
GET /api/identity/customers/export?format=xlsx&tier={tier}
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/identity/customers` | GET | identity | Yes | Page load + filter |
| 2 | `/api/identity/customers/{id}` | GET | identity | Yes | Click view |
| 3 | `/api/identity/customers` | POST | identity | Yes | Submit "Thêm KH" |
| 4 | `/api/identity/customers/{id}/points/adjust` | POST | identity | Yes | Click "Điều chỉnh điểm" |
| 5 | `/api/identity/customers/export` | GET | identity | Yes | Click "Xuất Excel" |
