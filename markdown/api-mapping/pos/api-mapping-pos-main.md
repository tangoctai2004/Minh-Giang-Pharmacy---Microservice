# API Mapping — pos/index.html (POS Main)

> **Trang**: POS Kiosk — Giao diện bán hàng tại quầy  
> **Auth yêu cầu**: Có (Cashier — đã mở ca)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────────┐
│  Navbar: Logo | KIOSK #01 | 🔔(2) | Clock | Lịch sử | User | Đóng ca │
├──────────────────────────┬───────────────────────────────────────┤
│  LEFT — Products Panel   │  RIGHT — Cart Panel                  │
│                          │                                      │
│  [🔍 Search F2]          │  Cart Header (3 sản phẩm)            │
│  Filters: Tất cả|Rx|     │  [📱 SĐT khách F5]                  │
│  Giảm đau|Vitamin|DCYT|  │                                      │
│  Mẹ&Bé|CSCC             │  Cart Items:                         │
│                          │  Name|Lô|[−][qty][+]|UOM▼|Price|🗑   │
│  Product Grid (12 cards) │  (Rx items: cảnh báo thuốc kê đơn)  │
│  Name|Price|Shelf|Stock  │                                      │
│  [Hết hàng] → Alt drawer│  Checkout Summary:                    │
│                          │  Tạm tính | Giảm giá → Tổng          │
│                          │  [Giữ đơn] [Xoá đơn] [THANH TOÁN F12]│
├──────────────────────────┴───────────────────────────────────────┤
│  Status Bar: System ✓ | Printer ✓ | Scanner ✓ | F2/F5/F12/ESC  │
├──────────────────────────────────────────────────────────────────┤
│  MODALS:                                                         │
│  1. Checkout: Voucher|Loyalty|Payment(Cash/QR/Card/Debt)|Print   │
│  2. Online Orders Drawer: 2 web orders → Nhận đơn                │
│  3. Hold Orders Drawer: 3 held orders → Resume/Discard           │
│  4. Close Shift: Revenue summary + Cash reconciliation           │
│  5. Alt Medicines Drawer: 3 alternatives for OOS product         │
│  6. Prescription (Rx) Modal: Doctor name + Prescription ID       │
└──────────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Tìm kiếm sản phẩm (Search bar + Barcode scan)

```
GET /api/catalog/products/pos-search?q={keyword}&barcode={code}&category={cat}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `q` | string | Tên thuốc, hoạt chất |
| `barcode` | string | Mã vạch scan |
| `category` | string | `all`, `rx`, `pain`, `vitamin`, `device`, `baby`, `care` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "name": "Amoxicillin 500mg",
      "price": 5000,
      "shelf_location": "Kệ A2",
      "stock_qty": 45,
      "is_prescription": true,
      "batch_code": "L-2025-0112",
      "thumbnail": "...",
      "units": [
        { "unit": "Viên", "price": 5000, "is_base": true },
        { "unit": "Vỉ", "price": 48000, "qty_per_unit": 10 },
        { "unit": "Hộp", "price": 450000, "qty_per_unit": 100 }
      ]
    }
  ]
}
```

---

### 2. Tra cứu khách hàng qua SĐT (Loyalty)

```
GET /api/identity/customers/lookup?phone={phone}
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 15,
    "name": "Nguyễn Thị Mai",
    "phone": "0901234567",
    "tier": "silver",
    "current_points": 520,
    "redeemable_value": 25000
  }
}
```

---

### 3. Áp dụng voucher

```
POST /api/catalog/promotions/vouchers/validate
```

**Body:**
```json
{
  "code": "MINGIANG50",
  "order_amount": 270000,
  "items": [{ "product_id": 42, "qty": 2 }]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "MINGIANG50",
    "discount_amount": 50000,
    "message": "Giảm 50,000₫"
  }
}
```

---

### 4. Tạo hoá đơn POS (Thanh toán)

```
POST /api/order/pos/checkout
```

**Body:**
```json
{
  "kiosk_id": "KIOSK-01",
  "shift_id": 12,
  "customer_id": 15,
  "items": [
    { "product_id": 42, "batch_code": "L-2025-0112", "qty": 2, "unit": "Viên", "price": 5000 },
    { "product_id": 15, "batch_code": "L-2025-0089", "qty": 1, "unit": "Hộp", "price": 120000 }
  ],
  "voucher_code": "MINGIANG50",
  "loyalty_points_used": 0,
  "payment_method": "cash",
  "cash_received": 300000,
  "subtotal": 130000,
  "discount": 50000,
  "total": 80000,
  "prescription": null,
  "debt_note": null
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_code": "T1-1929",
    "total": 80000,
    "change": 220000,
    "loyalty_points_earned": 8,
    "receipt_url": "/api/order/pos/receipts/T1-1929/print"
  }
}
```

---

### 5. Xác minh đơn thuốc kê đơn (Rx/GPP)

```
POST /api/order/pos/prescription-verify
```

**Body:**
```json
{
  "doctor_name": "BS. Nguyễn Văn A - Viện E",
  "prescription_id": "TOA-2026-0045",
  "prescription_image_url": null,
  "items": [
    { "product_id": 42, "name": "Amoxicillin 500mg", "qty": 2 }
  ]
}
```

---

### 6. Ghi nợ khách hàng

```
POST /api/order/pos/checkout
```

(Cùng API #4, nhưng `payment_method: "debt"` và `debt_note` có nội dung)

---

### 7. Giữ đơn (Hold)

```
POST /api/order/pos/hold
```

**Body:**
```json
{
  "kiosk_id": "KIOSK-01",
  "shift_id": 12,
  "customer_id": null,
  "items": [
    { "product_id": 42, "qty": 2, "unit": "Viên", "price": 5000 }
  ],
  "expires_in": 14400
}
```

**Response:** `{ "success": true, "data": { "hold_id": "0041" } }`

---

### 8. Danh sách đơn đang giữ

```
GET /api/order/pos/hold?kiosk_id=KIOSK-01
```

---

### 9. Khôi phục đơn giữ

```
PUT /api/order/pos/hold/{hold_id}/resume
```

---

### 10. Huỷ đơn giữ

```
DELETE /api/order/pos/hold/{hold_id}
```

---

### 11. Đơn online chờ lấy hàng (bell icon)

```
GET /api/order/pos/online-orders?status=ready_for_pickup&kiosk_id=KIOSK-01
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5931,
      "order_code": "WEB-5931",
      "customer_name": "Trần Thị B",
      "items_summary": "Paracetamol ×2, Vitamin C ×1",
      "total": 285000,
      "payment_status": "paid",
      "payment_method": "zalopay"
    }
  ],
  "count": 2
}
```

---

### 12. Nhận đơn online để lấy hàng

```
PUT /api/order/pos/online-orders/{id}/accept
```

---

### 13. Thuốc thay thế (khi hết hàng)

```
GET /api/catalog/products/{id}/alternatives
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "active_ingredient": "Paracetamol 500mg",
    "alternatives": [
      { "id": 15, "name": "Panadol Extra", "price": 4500, "stock_qty": 120, "shelf": "Kệ B1" },
      { "id": 16, "name": "Hapacol 500", "price": 3000, "stock_qty": 200, "shelf": "Kệ B2" }
    ]
  }
}
```

---

### 14. Đóng ca

```
POST /api/identity/shifts/close
```

**Body:**
```json
{
  "shift_id": 12,
  "kiosk_id": "KIOSK-01",
  "cashier_counted": 4300000,
  "system_total": 4320000,
  "discrepancy": -20000
}
```

---

### 15. In báo cáo ca

```
GET /api/identity/shifts/{id}/print
```

---

### 16. Danh sách category filters

```
GET /api/catalog/categories?for=pos
```

---

### 17. In hoá đơn

```
GET /api/order/pos/receipts/{invoice_code}/print
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/products/pos-search` | GET | catalog | Yes | Search/scan (F2) |
| 2 | `/api/identity/customers/lookup?phone=X` | GET | identity | Yes | Nhập SĐT (F5) |
| 3 | `/api/catalog/promotions/vouchers/validate` | POST | catalog | Yes | Áp dụng voucher |
| 4 | `/api/order/pos/checkout` | POST | order | Yes | Click "IN HOÁ ĐƠN & HOÀN TẤT" |
| 5 | `/api/order/pos/prescription-verify` | POST | order | Yes | Submit Rx modal |
| 6 | `/api/order/pos/hold` | POST | order | Yes | Click "Giữ đơn" |
| 7 | `/api/order/pos/hold?kiosk_id=X` | GET | order | Yes | Open hold drawer |
| 8 | `/api/order/pos/hold/{id}/resume` | PUT | order | Yes | Click "Tiếp tục" |
| 9 | `/api/order/pos/hold/{id}` | DELETE | order | Yes | Click discard |
| 10 | `/api/order/pos/online-orders` | GET | order | Yes | Click bell icon |
| 11 | `/api/order/pos/online-orders/{id}/accept` | PUT | order | Yes | Click "Nhận đơn" |
| 12 | `/api/catalog/products/{id}/alternatives` | GET | catalog | Yes | Click out-of-stock |
| 13 | `/api/identity/shifts/close` | POST | identity | Yes | Click "Đóng ca" |
| 14 | `/api/identity/shifts/{id}/print` | GET | identity | Yes | In báo cáo ca |
| 15 | `/api/catalog/categories?for=pos` | GET | catalog | Yes | Page load |
| 16 | `/api/order/pos/receipts/{code}/print` | GET | order | Yes | In hoá đơn |
