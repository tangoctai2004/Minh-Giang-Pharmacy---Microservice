# API Mapping — pos/history.html

> **Trang**: Lịch Sử Giao Dịch POS  
> **Auth yêu cầu**: Có (Cashier)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────────┐
│  Navbar: Logo | "LỊCH SỬ GIAO DỊCH" | Clock | User              │
├──────────────────────────────────────────────────────────────────┤
│  Toolbar:                                                        │
│  [🔍 Search mã HĐ / SĐT KH] [📅 Date] [Hôm nay] [Tuần này]   │
│  Stats: 24 đơn | 5.2M doanh thu                                 │
│  [Hoàn trả đơn Web] [Quay lại POS]                              │
├─────────────────────────────────────┬────────────────────────────┤
│  Transaction Table                  │  Detail Panel (420px)      │
│                                     │  Slides in from right      │
│  Mã HĐ|Time|KH|Tổng tiền|TT|Status│                            │
│  T1-1928  14:30  Mai  140K Cash ✓  │  Receipt meta              │
│  HD-002   19:32  ...  250K QR  ✓   │  Item list + qty/price     │
│  (8 rows)                           │  Summary: tạm tính/giảm/  │
│                                     │  khách trả/tiền thừa/tổng │
│  Pagination: 1-8 of 24             │  [In lại] [HOÀN TRẢ]      │
├─────────────────────────────────────┴────────────────────────────┤
│  Status Bar: System ✓ | DB Sync ✓ | ESC/← shortcuts            │
├──────────────────────────────────────────────────────────────────┤
│  MODALS:                                                         │
│  1. Web Order Modal: Input WEB-/ORD- code → Tra cứu             │
│  2. Refund Modal: Checkbox SP | SL trả | Lý do | Xác nhận       │
└──────────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Danh sách giao dịch POS

```
GET /api/order/pos/transactions?page=1&limit=20&date={date}&range={range}&q={search}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `date` | date | `2026-03-05` |
| `range` | string | `today`, `week` |
| `q` | string | Mã hoá đơn, SĐT KH |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoice_code": "T1-1928",
      "created_at": "2026-03-05T14:30:00",
      "customer": { "name": "Nguyễn Thị Mai", "phone": "0901234567", "avatar_initial": "M" },
      "total_amount": 140000,
      "payment_method": "cash",
      "status": "completed"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 24 },
  "summary": { "total_orders": 24, "total_revenue": 5200000 }
}
```

---

### 2. Chi tiết hoá đơn (detail panel)

```
GET /api/order/pos/transactions/{invoice_code}
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "invoice_code": "T1-1928",
    "created_at": "2026-03-05T14:30:00",
    "cashier_name": "Lê Thị Hoa",
    "payment_method": "cash",
    "customer": { "name": "Nguyễn Thị Mai", "phone": "0901234567" },
    "items": [
      { "product_name": "Amoxicillin 500mg", "qty": 2, "unit": "Viên", "price": 5000, "subtotal": 10000 },
      { "product_name": "Vitamin C DHC", "qty": 1, "unit": "Hộp", "price": 130000, "subtotal": 130000 }
    ],
    "subtotal": 140000,
    "discount": 0,
    "total": 140000,
    "cash_received": 200000,
    "change": 60000,
    "status": "completed"
  }
}
```

---

### 3. In lại hoá đơn

```
GET /api/order/pos/receipts/{invoice_code}/print
```

---

### 4. Tạo phiếu hoàn trả POS

```
POST /api/order/returns
```

**Body:**
```json
{
  "source": "pos",
  "original_invoice_code": "T1-1928",
  "customer_id": 15,
  "reason": "product_defect",
  "items": [
    { "product_id": 42, "qty": 1, "refund_amount": 5000 }
  ]
}
```

> `reason` values: `customer_change`, `product_defect`, `near_expiry`, `wrong_advice`

---

### 5. Tra cứu đơn web (cho hoàn trả)

```
GET /api/order/orders/lookup?code={web_order_code}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `code` | string | Mã đơn web: `WEB-5928` hoặc `ORD-xxxx` |

**Response:** Tương tự GET /api/order/orders/{id}

---

### 6. Hoàn trả đơn web (từ POS)

```
POST /api/order/returns
```

Body tương tự #4 nhưng `source: "web"` và `original_order_code`: mã đơn web.

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/order/pos/transactions` | GET | order | Yes | Page load + filter |
| 2 | `/api/order/pos/transactions/{code}` | GET | order | Yes | Click row |
| 3 | `/api/order/pos/receipts/{code}/print` | GET | order | Yes | Click "In lại" |
| 4 | `/api/order/returns` | POST | order | Yes | Click "Xác nhận nhập lại kho" |
| 5 | `/api/order/orders/lookup?code=X` | GET | order | Yes | Click "Tra cứu" đơn web |
| 6 | `/api/order/returns` | POST | order | Yes | Hoàn trả đơn web |
