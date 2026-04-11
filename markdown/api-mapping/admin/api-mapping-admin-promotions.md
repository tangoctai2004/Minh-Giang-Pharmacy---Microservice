# API Mapping — admin/promotions.html

> **Trang**: Marketing & Khuyến Mãi (Vouchers + Gifts + Loyalty tiers)  
> **Auth yêu cầu**: Có (Admin/Marketing)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                            │
├──────────────────────────────────────────────────────────────────┤
│  4 Stat Cards:                                                   │
│  Voucher HĐ(12)|Lượt dùng tháng(346)|Chiến dịch quà(4)|Sắp hết(3)│
├──────────────────────────────────────────────────────────────────┤
│  Tabs: [Mã Giảm Giá (Vouchers)] [Quà Tặng Kèm] [Tích Điểm]    │
├──────────────────────────────────────────────────────────────────┤
│  TAB 1 — Vouchers:                                               │
│  Filters: [Search] [Loại▼ %/₫/Freeship] [TT▼ HĐ/Dừng/Hết hạn] │
│  Table: Mã/Tên|Loại|Điều kiện|Lượt dùng(progress)|Thời hạn|TT  │
│  Actions: [Xuất][Tạo Voucher Mới] Edit|Pause|Copy|Reset         │
├──────────────────────────────────────────────────────────────────┤
│  TAB 2 — Quà Tặng Kèm:                                          │
│  Gift rule cards + Performance stats sidebar                     │
│  Actions: Edit|Pause|Clone                                       │
├──────────────────────────────────────────────────────────────────┤
│  TAB 3 — Chương Trình Tích Điểm:                                 │
│  4 Tier configs (Đồng/Bạc/Vàng/Kim Cương) + editable points rate│
│  Redemption rules: Tỷ lệ quy đổi|Điểm tối thiểu|GT tối đa/đơn │
│  Toggle: Web/POS                                                 │
│  Member distribution panel                                       │
├──────────────────────────────────────────────────────────────────┤
│  MODAL: Tạo/Sửa Voucher                                         │
│  Mã*|Tên*|Loại giảm|Giá trị|Đơn tối thiểu|Lượt dùng tối đa     │
│  Ngày bắt đầu/kết thúc|Danh mục áp dụng|Trạng thái             │
└──────────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Thống kê khuyến mãi

```
GET /api/catalog/promotions/stats
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "active_vouchers": 12,
    "total_usage_month": 346,
    "gift_campaigns": 4,
    "expiring_soon": 3
  }
}
```

---

### 2. Danh sách vouchers

```
GET /api/catalog/promotions/vouchers?page=1&limit=20&type={type}&status={status}&q={search}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `type` | string | `percent`, `fixed`, `freeship` |
| `status` | string | `active`, `paused`, `expired`, `used_up` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "MINGIANG50",
      "name": "Giảm 50k đơn từ 300k",
      "discount_type": "fixed",
      "discount_value": 50000,
      "min_order_amount": 300000,
      "usage_count": 78,
      "usage_limit": 200,
      "valid_from": "2026-03-01",
      "valid_to": "2026-03-31",
      "status": "active"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 15 }
}
```

---

### 3. Tạo voucher mới

```
POST /api/catalog/promotions/vouchers
```

**Body:**
```json
{
  "code": "TETMG2026",
  "name": "Giảm 20% đơn Tết",
  "discount_type": "percent",
  "discount_value": 20,
  "max_discount": 100000,
  "min_order_amount": 200000,
  "usage_limit": 500,
  "valid_from": "2026-01-25",
  "valid_to": "2026-02-15",
  "applicable_categories": [1, 2, 3],
  "status": "active"
}
```

---

### 4. Cập nhật voucher

```
PUT /api/catalog/promotions/vouchers/{id}
```

---

### 5. Tạm dừng/kích hoạt voucher

```
PUT /api/catalog/promotions/vouchers/{id}/toggle
```

**Body:** `{ "status": "paused" }` hoặc `{ "status": "active" }`

---

### 6. Reset lượt dùng voucher

```
PUT /api/catalog/promotions/vouchers/{id}/reset-usage
```

---

### 7. Danh sách chiến dịch quà tặng

```
GET /api/catalog/promotions/gifts
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Tặng khẩu trang khi mua từ 500k",
      "rule": { "min_order": 500000, "gift_product_id": 99 },
      "status": "active",
      "usage_count": 45,
      "performance": { "orders_qualified": 45, "total_gift_value": 225000 }
    }
  ]
}
```

---

### 8. Tạo/cập nhật chiến dịch quà tặng

```
POST /api/catalog/promotions/gifts
PUT /api/catalog/promotions/gifts/{id}
```

**Body:**
```json
{
  "name": "Tặng gel rửa tay khi mua từ 300k",
  "rule": { "min_order": 300000, "gift_product_id": 102, "max_per_customer": 1 },
  "valid_from": "2026-03-01",
  "valid_to": "2026-03-31",
  "status": "active"
}
```

---

### 9. Pause/Clone chiến dịch quà

```
PUT /api/catalog/promotions/gifts/{id}/toggle
POST /api/catalog/promotions/gifts/{id}/clone
```

---

### 10. Cấu hình tích điểm (Loyalty)

```
GET /api/catalog/promotions/loyalty/config
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "tiers": [
      { "tier": "bronze", "points_per_10k": 1, "min_spend": 0 },
      { "tier": "silver", "points_per_10k": 1.5, "min_spend": 2000000 },
      { "tier": "gold", "points_per_10k": 2, "min_spend": 10000000 },
      { "tier": "diamond", "points_per_10k": 3, "min_spend": 50000000 }
    ],
    "redemption": {
      "points_to_vnd_rate": 1000,
      "min_points_redeem": 100,
      "max_value_per_order": 200000
    },
    "channels": { "web": true, "pos": true }
  }
}
```

---

### 11. Cập nhật cấu hình tích điểm

```
PUT /api/catalog/promotions/loyalty/config
```

Body tương tự response trên.

---

### 12. Xuất báo cáo khuyến mãi

```
GET /api/catalog/promotions/export?format=xlsx
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/promotions/stats` | GET | catalog | Yes | Page load |
| 2 | `/api/catalog/promotions/vouchers` | GET | catalog | Yes | Tab Vouchers |
| 3 | `/api/catalog/promotions/vouchers` | POST | catalog | Yes | Tạo voucher mới |
| 4 | `/api/catalog/promotions/vouchers/{id}` | PUT | catalog | Yes | Edit voucher |
| 5 | `/api/catalog/promotions/vouchers/{id}/toggle` | PUT | catalog | Yes | Pause/Resume |
| 6 | `/api/catalog/promotions/vouchers/{id}/reset-usage` | PUT | catalog | Yes | Reset lượt dùng |
| 7 | `/api/catalog/promotions/gifts` | GET | catalog | Yes | Tab Quà tặng |
| 8 | `/api/catalog/promotions/gifts` | POST | catalog | Yes | Tạo chiến dịch |
| 9 | `/api/catalog/promotions/gifts/{id}` | PUT | catalog | Yes | Edit chiến dịch |
| 10 | `/api/catalog/promotions/gifts/{id}/toggle` | PUT | catalog | Yes | Pause |
| 11 | `/api/catalog/promotions/gifts/{id}/clone` | POST | catalog | Yes | Clone |
| 12 | `/api/catalog/promotions/loyalty/config` | GET | catalog | Yes | Tab Tích điểm |
| 13 | `/api/catalog/promotions/loyalty/config` | PUT | catalog | Yes | Save loyalty config |
| 14 | `/api/catalog/promotions/export` | GET | catalog | Yes | Click "Xuất Báo Cáo" |
