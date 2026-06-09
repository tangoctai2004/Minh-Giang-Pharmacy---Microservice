# API Mapping — admin/suppliers.html

> **Trang**: Nhà cung cấp & Công nợ (Accounts Payable)  
> **Auth yêu cầu**: Có (Admin/Manager)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                      │
├────────────────────────────────────────────────────────────┤
│  Page Header: "Nhà Cung Cấp & Công Nợ"                    │
│  Filters: [Tình trạng nợ▼] [TT đối tác▼]                 │
│  Actions: [Xuất Excel] [Thêm Nhà Cung Cấp]               │
├────────────────────────────────────────────────────────────┤
│  Table: Mã|Tên NCC|Liên hệ/SĐT|Tổng GT Nhập|Công Nợ|Actions│
│  ▶ Expand: Mã Nhập Hàng|Ngày|GT đơn|Đã trả|Còn nợ       │
│  Actions: [Lịch sử] [Thanh toán nợ]                       │
│  Quick action: [Trả trước/Thanh toán nhanh toàn bộ]       │
└────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Danh sách NCC

```
GET /api/catalog/suppliers?page=1&limit=20&debt_status={status}&partner_status={status}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `debt_status` | string | `has_debt`, `no_debt` |
| `partner_status` | string | `active`, `inactive` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "code": "NCC-005",
      "name": "Công ty Dược Hậu Giang",
      "contact_name": "Trần Văn B",
      "phone": "0909888777",
      "total_purchase_value": 450000000,
      "current_debt": 25000000,
      "status": "active"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 18 }
}
```

---

### 2. Chi tiết NCC + lịch sử phiếu nhập (expand row)

```
GET /api/catalog/suppliers/{id}/purchase-orders?page=1&limit=10
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 45,
      "po_code": "PN-2026-0045",
      "created_at": "2026-03-05",
      "order_value": 45000000,
      "paid_amount": 30000000,
      "remaining_debt": 15000000
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 24 }
}
```

---

### 3. Thêm NCC mới

```
POST /api/catalog/suppliers
```

**Body:**
```json
{
  "name": "Công ty Dược ABC",
  "contact_name": "Lê Thị C",
  "phone": "0901234567",
  "email": "contact@abc.com",
  "address": "123 Nguyễn Trãi, Q5, TP.HCM",
  "tax_code": "0123456789"
}
```

---

### 4. Thanh toán công nợ

```
POST /api/catalog/suppliers/{id}/payments
```

**Body:**
```json
{
  "amount": 15000000,
  "payment_method": "bank_transfer",
  "purchase_order_id": 45,
  "notes": "Thanh toán lô hàng tháng 3"
}
```

---

### 5. Thanh toán nhanh toàn bộ nợ

```
POST /api/catalog/suppliers/{id}/payments/full
```

**Body:**
```json
{
  "payment_method": "bank_transfer",
  "notes": "Thanh toán toàn bộ nợ"
}
```

---

### 6. Xuất Excel danh sách NCC

```
GET /api/catalog/suppliers/export?format=xlsx
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/suppliers` | GET | catalog | Yes | Page load + filter |
| 2 | `/api/catalog/suppliers/{id}/purchase-orders` | GET | catalog | Yes | Expand row |
| 3 | `/api/catalog/suppliers` | POST | catalog | Yes | Submit "Thêm NCC" |
| 4 | `/api/catalog/suppliers/{id}/payments` | POST | catalog | Yes | Click "Thanh toán nợ" |
| 5 | `/api/catalog/suppliers/{id}/payments/full` | POST | catalog | Yes | Click "TT nhanh toàn bộ" |
| 6 | `/api/catalog/suppliers/export` | GET | catalog | Yes | Click "Xuất Excel" |
