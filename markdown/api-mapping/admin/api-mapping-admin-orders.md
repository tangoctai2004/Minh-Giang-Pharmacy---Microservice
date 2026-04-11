# API Mapping — admin/orders.html

> **Trang**: Quản lý đơn hàng (Inbox Web + Lịch sử + POS)  
> **Auth yêu cầu**: Có (Admin/Manager)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                      │
├────────────────────────────────────────────────────────────┤
│  4 Stat Cards:                                             │
│  Inbox mới(2) | Đã duyệt HN(12) | Đã huỷ tháng(3) | POS(45)│
├────────────────────────────────────────────────────────────┤
│  Tab: [Inbox Đơn Web Mới (2 MỚI)] [Lịch Sử Online] [POS] │
│  Filters + Actions: [Xuất Excel]                           │
├────────────────────────────────────────────────────────────┤
│  TAB 1 — Inbox Đơn Web Mới:                                │
│  Table: Mã Đơn|KH|Thời gian|SP|Tổng tiền|TT|Hành động     │
│  Actions: [Duyệt & Giao Pick&Pack] [Huỷ]                  │
│  Row highlight vàng cho đơn mới                             │
├────────────────────────────────────────────────────────────┤
│  TAB 2 — Lịch Sử Đơn Online:                              │
│  Table: Mã Đơn|KH|Thời gian|Tổng tiền|TT|Trạng thái|View │
│  Filters: [TT: Hoàn tất/Đã huỷ] [Date: HN/7d/30d/Tháng]  │
├────────────────────────────────────────────────────────────┤
│  TAB 3 — Hoá Đơn Bán Lẻ (POS):                            │
│  Table: Mã HĐ|Thu ngân|Thời gian|Tổng tiền|Hình thức|View │
├────────────────────────────────────────────────────────────┤
│  MODAL: Chi tiết đơn hàng                                  │
│  Left: Product table + giá                                  │
│  Right: KH info, SĐT, Địa chỉ, Ghi chú, HTTT             │
└────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Thống kê đơn hàng

```
GET /api/order/orders/stats
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "inbox_new_count": 2,
    "approved_today": 12,
    "cancelled_this_month": 3,
    "pos_invoices_today": 45
  }
}
```

---

### 2. Danh sách đơn web mới (Inbox)

```
GET /api/order/orders?channel=web&status=pending&page=1&limit=20
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "order_code": "WEB-2026-0189",
      "customer_name": "Nguyễn Thị Mai",
      "customer_phone": "0901234567",
      "created_at": "2026-03-05T09:15:00",
      "items_summary": "Paracetamol 500mg ×2, Vitamin C ×1",
      "items_count": 3,
      "total_amount": 285000,
      "payment_method": "cod",
      "is_new": true
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 2 }
}
```

---

### 3. Lịch sử đơn online

```
GET /api/order/orders?channel=web&status={status}&date_range={range}&page=1&limit=20&q={search}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `status` | string | `completed`, `cancelled` |
| `date_range` | string | `today`, `7d`, `30d`, `this_month` |

---

### 4. Danh sách hoá đơn POS

```
GET /api/order/orders?channel=pos&date_range={range}&page=1&limit=20&q={search}
```

---

### 5. Chi tiết đơn hàng (modal)

```
GET /api/order/orders/{id}
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "order_code": "WEB-2026-0189",
    "status": "pending",
    "channel": "web",
    "customer": {
      "name": "Nguyễn Thị Mai",
      "phone": "0901234567",
      "address": "42 Mai Chí Thọ, Hưng Phú, Cần Thơ",
      "note": "Giao buổi sáng"
    },
    "items": [
      { "product_name": "Paracetamol 500mg", "sku": "MED-0015", "qty": 2, "price": 5000, "subtotal": 10000 }
    ],
    "subtotal": 275000,
    "shipping_fee": 10000,
    "discount": 0,
    "total_amount": 285000,
    "payment_method": "cod",
    "payment_status": "unpaid",
    "created_at": "2026-03-05T09:15:00"
  }
}
```

---

### 6. Duyệt đơn hàng → chuyển Pick & Pack

```
PUT /api/order/orders/{id}/approve
```

**Response:** `{ "success": true, "message": "Đơn đã chuyển sang Pick & Pack" }`

---

### 7. Huỷ đơn hàng

```
PUT /api/order/orders/{id}/cancel
```

**Body:**
```json
{ "reason": "Hết hàng" }
```

---

### 8. In hoá đơn

```
GET /api/order/orders/{id}/print
```

---

### 9. Xuất Excel đơn hàng

```
GET /api/order/orders/export?channel={channel}&date_range={range}&format=xlsx
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/order/orders/stats` | GET | order | Yes | Page load |
| 2 | `/api/order/orders?channel=web&status=pending` | GET | order | Yes | Tab Inbox |
| 3 | `/api/order/orders?channel=web&status=X` | GET | order | Yes | Tab Lịch sử |
| 4 | `/api/order/orders?channel=pos` | GET | order | Yes | Tab POS |
| 5 | `/api/order/orders/{id}` | GET | order | Yes | Click view |
| 6 | `/api/order/orders/{id}/approve` | PUT | order | Yes | Click "Duyệt" |
| 7 | `/api/order/orders/{id}/cancel` | PUT | order | Yes | Click "Huỷ" |
| 8 | `/api/order/orders/{id}/print` | GET | order | Yes | Click Print |
| 9 | `/api/order/orders/export` | GET | order | Yes | Click "Xuất Excel" |
