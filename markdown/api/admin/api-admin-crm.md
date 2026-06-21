# API Mapping — admin/crm-customers.html

> **Trang**: Khách Hàng & Loyalty (CRM Dashboard)  
> **Auth yêu cầu**: Có (Admin/Manager)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                            │
├──────────────────────────────────────────────────────────────────┤
│  4 Stat Cards:                                                   │
│  Tổng TV(1,248)|Điểm lưu hành(847,200)|Quy đổi tháng(12,400đ)  │
│  |KH không HĐ(89)                                                │
├──────────────────────────────────────────────────────────────────┤
│  4 Tier Visual Cards:                                            │
│  Đồng(654) | Bạc(381) | Vàng(178) | Kim Cương(35)               │
│  + spend threshold + progress                                     │
├──────────────────────────────────────────────────────────────────┤
│  Tabs: [Danh Sách TV] [Lịch Sử Điểm] [Phân Khúc & Báo Cáo]    │
├──────────────────────────────────────────────────────────────────┤
│  TAB 1 — Thành Viên: Member table (tiến độ lên hạng progress bar)│
│  TAB 2 — Điểm: Points transaction history (tích/quy đổi/điều chỉnh)│
│  TAB 3 — Segments: KH không HĐ(30-60-90+), VIP Top 20,          │
│          Sinh nhật tháng, TV mới (Web/POS split)                  │
├──────────────────────────────────────────────────────────────────┤
│  MODAL (800px): Two-column                                       │
│  Left: Avatar, tier, points, progress, points history             │
│  Right: Purchase history, edit form (Tên/SĐT/Email/DOB/Notes)   │
└──────────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. CRM Dashboard stats

```
GET /api/identity/crm/stats
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "total_members": 1248,
    "total_members_change": 42,
    "total_circulating_points": 847200,
    "redeemed_this_month": 12400,
    "inactive_count": 89,
    "tier_distribution": {
      "bronze": 654,
      "silver": 381,
      "gold": 178,
      "diamond": 35
    }
  }
}
```

---

### 2. Danh sách thành viên (Tab 1)

```
GET /api/identity/customers?page=1&limit=20&tier={tier}&sort={sort}&q={search}
```

(Dùng chung API với customers.html, nhưng response bổ sung `tier_progress`)

**Response bổ sung:**
```json
{
  "data": [{
    "tier_progress": {
      "current_spend": 5200000,
      "next_tier_threshold": 10000000,
      "progress_percent": 52
    }
  }]
}
```

---

### 3. Lịch sử điểm thưởng (Tab 2)

```
GET /api/identity/crm/points-history?page=1&limit=20&type={type}&q={search}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `type` | string | `earn`, `redeem`, `adjust` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "customer_name": "Nguyễn Thị Mai",
      "customer_phone": "0901234567",
      "transaction_type": "earn",
      "description": "Mua hàng POS-2026-0312",
      "points_change": 52,
      "balance_after": 520,
      "created_at": "2026-03-04T14:30:00"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 560 }
}
```

---

### 4. Phân khúc KH không hoạt động (Tab 3)

```
GET /api/identity/crm/segments/inactive
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "total": 89,
    "breakdown": {
      "30_60_days": 34,
      "60_90_days": 28,
      "over_90_days": 27
    }
  }
}
```

---

### 5. VIP Top 20 (Tab 3)

```
GET /api/identity/crm/segments/vip-top?limit=20
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "rank": 1, "customer_name": "Lê Thị Hoa", "tier": "diamond", "total_spend": 85000000 }
  ]
}
```

---

### 6. Sinh nhật tháng này (Tab 3)

```
GET /api/identity/crm/segments/birthdays?month=3
```

---

### 7. Thành viên mới tháng này (Tab 3)

```
GET /api/identity/crm/segments/new-members?month=3
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "total": 42,
    "by_channel": { "web": 18, "pos": 24 },
    "daily": [
      { "date": "2026-03-01", "count": 3 },
      { "date": "2026-03-02", "count": 5 }
    ]
  }
}
```

---

### 8. Chi tiết KH (modal)

```
GET /api/identity/customers/{id}/detail
```

Mở rộng hơn `GET /api/identity/customers/{id}`, bao gồm:
- Points history (last 10)
- Purchase history (last 10)
- Tier progress

---

### 9. Cập nhật thông tin KH (modal form)

```
PUT /api/identity/customers/{id}
```

**Body:**
```json
{
  "name": "Nguyễn Thị Mai",
  "phone": "0901234567",
  "email": "mai@email.com",
  "date_of_birth": "1990-05-15",
  "notes": "KH thường xuyên, ưu tiên"
}
```

---

### 10. Gửi thông báo tái kích hoạt

```
POST /api/notification/campaigns/reactivation
```

**Body:**
```json
{
  "segment": "inactive_over_90",
  "channel": "zalo",
  "template_id": 5
}
```

---

### 11. Gửi lời chúc sinh nhật

```
POST /api/notification/campaigns/birthday
```

**Body:**
```json
{
  "month": 3,
  "channel": "sms",
  "template_id": 8
}
```

---

### 12. Xuất danh sách VIP

```
GET /api/identity/crm/segments/vip-top/export?format=xlsx
```

---

### 13. Xuất Excel thành viên

```
GET /api/identity/customers/export?format=xlsx
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/identity/crm/stats` | GET | identity | Yes | Page load |
| 2 | `/api/identity/customers` | GET | identity | Yes | Tab Thành viên |
| 3 | `/api/identity/crm/points-history` | GET | identity | Yes | Tab Lịch sử điểm |
| 4 | `/api/identity/crm/segments/inactive` | GET | identity | Yes | Tab Phân khúc |
| 5 | `/api/identity/crm/segments/vip-top` | GET | identity | Yes | Tab Phân khúc |
| 6 | `/api/identity/crm/segments/birthdays` | GET | identity | Yes | Tab Phân khúc |
| 7 | `/api/identity/crm/segments/new-members` | GET | identity | Yes | Tab Phân khúc |
| 8 | `/api/identity/customers/{id}/detail` | GET | identity | Yes | Click view modal |
| 9 | `/api/identity/customers/{id}` | PUT | identity | Yes | Submit edit form |
| 10 | `/api/notification/campaigns/reactivation` | POST | notification | Yes | Click "Gửi TB tái kích hoạt" |
| 11 | `/api/notification/campaigns/birthday` | POST | notification | Yes | Click "Gửi lời chúc" |
| 12 | `/api/identity/crm/segments/vip-top/export` | GET | identity | Yes | Click "Xuất DS VIP" |
| 13 | `/api/identity/customers/export` | GET | identity | Yes | Click "Xuất Excel" |
