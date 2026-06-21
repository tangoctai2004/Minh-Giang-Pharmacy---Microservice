# API Mapping — admin/batches.html

> **Trang**: Nhập kho & Lô hàng (Inbound/Outbound)  
> **Auth yêu cầu**: Có (Admin/Warehouse)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                    │
├──────────────────────────────────────────────────────────┤
│  Page Header: "Nhập Kho & Lô Hàng"                      │
│  Tab: [Lịch sử Nhập (Inbound)] [Lịch sử Xuất (Outbound)]│
│  Actions: [Xuất Báo Cáo] [Tạo Phiếu Mới]               │
├──────────────────────────────────────────────────────────┤
│  Filters: [Search mã phiếu/NCC] [Trạng thái▼]          │
├──────────────────────────────────────────────────────────┤
│  TAB INBOUND:                                            │
│  Table: Mã Phiếu|NCC|Ngày tạo|Tổng tiền|TT|Thao tác    │
│  ▶ Expand: Thuốc|Số Lô|NSX|HSD|SL Nhập|Thành Tiền      │
│  Nút: [In Phiếu Nhập] [Cài Giá Thanh Lý Cận Date]      │
├──────────────────────────────────────────────────────────┤
│  TAB OUTBOUND:                                           │
│  Table: Mã Phiếu Xuất|Ngày|Lý do|Tham chiếu|Tổng tiền  │
│  Filters: [Lý do xuất▼]                                 │
├──────────────────────────────────────────────────────────┤
│  MODAL 1: "Tạo Đơn Nhập Hàng" (wide)                    │
│  NCC*|Người giao|Ngày nhập|Dynamic items table           │
│  [Quét mã vạch] Ghi chú|Summary (SL,Tiền,VAT,Tổng)     │
├──────────────────────────────────────────────────────────┤
│  MODAL 2: "Chiết Khấu Thanh Lý"                         │
│  Radio: Giảm%/Giảm tiền | Value | Calculated price      │
└──────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Danh sách phiếu nhập (Inbound)

```
GET /api/catalog/batches/inbound?page=1&limit=20&q={search}&status={status}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `q` | string | Tìm mã phiếu, tên NCC |
| `status` | string | `completed`, `draft` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "PN-2026-0045",
      "supplier_name": "Công ty Dược Hậu Giang",
      "created_at": "2026-03-05T08:30:00",
      "total_amount": 45000000,
      "status": "completed",
      "items": [
        {
          "product_name": "Amoxicillin 500mg",
          "batch_code": "LO-2026-0112",
          "mfg_date": "2025-12-01",
          "expiry_date": "2027-12-01",
          "quantity": 500,
          "unit_cost": 3000,
          "subtotal": 1500000
        }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 120 }
}
```

---

### 2. Danh sách phiếu xuất (Outbound)

```
GET /api/catalog/batches/outbound?page=1&limit=20&q={search}&reason={reason}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `reason` | string | `pos_sale`, `web_order`, `destroyed`, `return_supplier` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "PX-2026-0089",
      "created_at": "2026-03-05",
      "reason": "pos_sale",
      "reference": "POS-2026-0312",
      "total_amount": 850000
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 450 }
}
```

---

### 3. Chi tiết phiếu nhập (expand row)

```
GET /api/catalog/batches/inbound/{id}/items
```

---

### 4. Tạo phiếu nhập hàng mới

```
POST /api/catalog/batches/inbound
```

**Body:**
```json
{
  "supplier_id": 5,
  "delivered_by": "Nguyễn Văn B",
  "import_date": "2026-03-05",
  "notes": "Lô hàng tháng 3",
  "items": [
    {
      "product_id": 42,
      "batch_code": "LO-2026-0112",
      "mfg_date": "2025-12-01",
      "expiry_date": "2027-12-01",
      "quantity": 500,
      "unit_cost": 3000
    }
  ]
}
```

---

### 5. Quét mã vạch tra cứu sản phẩm

```
GET /api/catalog/products/barcode/{barcode}
```

**Response:** Trả về thông tin sản phẩm để tự động điền vào dòng trong modal.

---

### 6. Danh sách NCC (cho dropdown modal)

```
GET /api/catalog/suppliers?active=true
```

---

### 7. Cài giá thanh lý cận date

```
PUT /api/catalog/batches/{batch_id}/clearance
```

**Body:**
```json
{
  "discount_type": "percent",
  "discount_value": 30,
  "clearance_price": 56000
}
```

---

### 8. In phiếu nhập

```
GET /api/catalog/batches/inbound/{id}/print
```

Trả về PDF hoặc HTML printable.

---

### 9. Xuất báo cáo

```
GET /api/catalog/batches/export?tab=inbound&format=xlsx
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/batches/inbound` | GET | catalog | Yes | Tab Inbound + filter |
| 2 | `/api/catalog/batches/outbound` | GET | catalog | Yes | Tab Outbound + filter |
| 3 | `/api/catalog/batches/inbound/{id}/items` | GET | catalog | Yes | Expand row |
| 4 | `/api/catalog/batches/inbound` | POST | catalog | Yes | Submit tạo phiếu |
| 5 | `/api/catalog/products/barcode/{barcode}` | GET | catalog | Yes | Quét mã vạch |
| 6 | `/api/catalog/suppliers?active=true` | GET | catalog | Yes | Open modal (dropdown) |
| 7 | `/api/catalog/batches/{id}/clearance` | PUT | catalog | Yes | Cài giá thanh lý |
| 8 | `/api/catalog/batches/inbound/{id}/print` | GET | catalog | Yes | Click In phiếu |
| 9 | `/api/catalog/batches/export` | GET | catalog | Yes | Click Xuất báo cáo |
