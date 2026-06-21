# API Mapping — admin/returns.html

> **Trang**: Quản lý Đổi/Trả (RMA)  
> **Auth yêu cầu**: Có (Admin/Manager)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                        │
├──────────────────────────────────────────────────────────────┤
│  4 Stat Cards:                                               │
│  Chờ duyệt(12)|Đã nhập kho(48)|Đã tiêu huỷ(5)|Hoàn tiền(14.5M)│
├──────────────────────────────────────────────────────────────┤
│  Tab: [Đơn bán hàng POS] [Đơn Online] [Trả NCC]            │
│  Filters: [Search mã RMA] [Trạng thái▼]                     │
│  Actions: [Tạo Phiếu Chuyển Hoàn Mới]                       │
├──────────────────────────────────────────────────────────────┤
│  Table: Mã RMA|Thời gian|KH/NCC|Lý do&Nguồn|Giá trị|TT|View│
├──────────────────────────────────────────────────────────────┤
│  SLIDE-OVER (500px):                                         │
│  Mã Đơn gốc | KH | Lý do | Ghi chú                         │
│  Items table: SP | SL Trả | Hoàn Tiền                        │
│  Dynamic footer:                                              │
│   - Pending: [Từ chối] [Duyệt & Nhập Kho]                   │
│   - Destroyed: [Đóng] [Biên bản huỷ]                        │
│   - Completed: [Đóng] [Biên lai nhập]                       │
└──────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Thống kê RMA

```
GET /api/order/returns/stats
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "pending_count": 12,
    "restocked_count": 48,
    "destroyed_count": 5,
    "total_refunded": 14500000
  }
}
```

---

### 2. Danh sách phiếu đổi trả

```
GET /api/order/returns?source={source}&status={status}&page=1&limit=20&q={search}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `source` | string | `pos`, `web`, `supplier` (tương ứng 3 tab) |
| `status` | string | `pending`, `restocked`, `destroyed`, `rejected` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "rma_code": "RMA-2026-0034",
      "created_at": "2026-03-04T14:20:00",
      "customer_name": "Nguyễn Văn A",
      "reason": "Phản ứng phụ",
      "source": "pos",
      "original_order_code": "POS-2026-0289",
      "total_refund": 125000,
      "status": "pending"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 65 }
}
```

---

### 3. Chi tiết phiếu RMA (slide-over)

```
GET /api/order/returns/{id}
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "rma_code": "RMA-2026-0034",
    "original_order_code": "POS-2026-0289",
    "customer": { "name": "Nguyễn Văn A", "phone": "0901234567" },
    "reason": "Phản ứng phụ",
    "notes": "Đã sử dụng 2 viên, có phản ứng dị ứng da",
    "source": "pos",
    "status": "pending",
    "items": [
      {
        "product_name": "Amoxicillin 500mg",
        "sku": "MED-0042",
        "return_qty": 8,
        "refund_amount": 40000
      }
    ],
    "total_refund": 125000,
    "created_at": "2026-03-04T14:20:00"
  }
}
```

---

### 4. Duyệt & Nhập lại kho

```
PUT /api/order/returns/{id}/approve
```

**Body:**
```json
{
  "action": "restock",
  "items": [
    { "product_id": 42, "qty": 8, "batch_id": 12 }
  ]
}
```

---

### 5. Từ chối phiếu RMA

```
PUT /api/order/returns/{id}/reject
```

**Body:**
```json
{ "reason": "Quá hạn đổi trả 7 ngày" }
```

---

### 6. Tạo phiếu chuyển hoàn mới

```
POST /api/order/returns
```

**Body:**
```json
{
  "source": "pos",
  "original_order_id": 289,
  "customer_id": 15,
  "reason": "Sai thuốc",
  "notes": "Nhân viên đưa nhầm",
  "items": [
    { "product_id": 42, "qty": 10, "refund_amount": 50000 }
  ]
}
```

---

### 7. In biên bản huỷ / biên lai nhập

```
GET /api/order/returns/{id}/print?type=destroy_report
GET /api/order/returns/{id}/print?type=restock_receipt
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/order/returns/stats` | GET | order | Yes | Page load |
| 2 | `/api/order/returns?source=X&status=X` | GET | order | Yes | Tab + filter |
| 3 | `/api/order/returns/{id}` | GET | order | Yes | Click view |
| 4 | `/api/order/returns/{id}/approve` | PUT | order | Yes | Click "Duyệt & Nhập Kho" |
| 5 | `/api/order/returns/{id}/reject` | PUT | order | Yes | Click "Từ chối" |
| 6 | `/api/order/returns` | POST | order | Yes | Submit tạo phiếu |
| 7 | `/api/order/returns/{id}/print` | GET | order | Yes | Click print |
