# API Mapping — admin/order-fulfillment.html

> **Trang**: Pick & Pack — Giao Hàng (Kanban pipeline)  
> **Auth yêu cầu**: Có (Admin/Warehouse)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                            │
├──────────────────────────────────────────────────────────────────┤
│  Page Header: "Pick & Pack — Giao Hàng"                         │
│  4 Stat Cards: Đang lấy(3)|Đóng gói(1)|Đang giao(4)|Hoàn tất(12)│
│  Actions: [Xem danh sách đơn] [Xuất báo cáo]                    │
├──────────────────────────────────────────────────────────────────┤
│  KANBAN BOARD — 4 cột:                                           │
│  ┌──────────┬──────────┬──────────┬──────────┐                  │
│  │ Đang Lấy │ Đóng Gói │ Đang Giao│ Hoàn Tất │                  │
│  │ Hàng     │          │          │          │                   │
│  │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │                  │
│  │ │Card  │ │ │Card  │ │ │Card  │ │ │Card  │ │                  │
│  │ │ID/KH │ │ │      │ │ │      │ │ │      │ │                  │
│  │ │Amount│ │ │      │ │ │      │ │ │      │ │                  │
│  │ │Tags  │ │ │      │ │ │      │ │ │      │ │                  │
│  │ │[Next]│ │ │      │ │ │      │ │ │      │ │                  │
│  │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │                  │
│  └──────────┴──────────┴──────────┴──────────┘                  │
├──────────────────────────────────────────────────────────────────┤
│  MODAL: Order Detail                                             │
│  Timeline stepper (5 steps)                                      │
│  Pick List: checkboxes + shelf location                          │
│  VAT fields: Công ty, MST, Email                                 │
│  Delivery: Người giao + Time slot                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Thống kê fulfillment

```
GET /api/order/fulfillment/stats
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "picking": 3,
    "packing": 1,
    "shipping": 4,
    "completed_today": 12
  }
}
```

---

### 2. Kanban board — danh sách đơn theo trạng thái

```
GET /api/order/fulfillment/board
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "picking": [
      {
        "id": 1,
        "order_code": "WEB-2026-0189",
        "customer_name": "Nguyễn Thị Mai",
        "total_amount": 285000,
        "payment_method": "cod",
        "payment_status": "unpaid",
        "requires_vat": false,
        "created_at": "2026-03-05T09:15:00",
        "items_count": 3
      }
    ],
    "packing": [...],
    "shipping": [...],
    "completed": [...]
  }
}
```

---

### 3. Chi tiết đơn fulfillment (modal)

```
GET /api/order/fulfillment/{order_id}
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "order_code": "WEB-2026-0189",
    "current_step": "picking",
    "timeline": [
      { "step": "ordered", "label": "Đặt hàng", "completed_at": "2026-03-05T09:15:00" },
      { "step": "picking", "label": "Lấy hàng", "completed_at": null },
      { "step": "packing", "label": "Đóng gói", "completed_at": null },
      { "step": "shipping", "label": "Đang giao", "completed_at": null },
      { "step": "completed", "label": "Hoàn tất", "completed_at": null }
    ],
    "pick_list": [
      {
        "product_name": "Paracetamol 500mg",
        "sku": "MED-0015",
        "qty": 2,
        "shelf_location": "Kệ A3-T2",
        "picked": false
      }
    ],
    "customer": { "name": "...", "phone": "...", "address": "..." },
    "vat_invoice": null,
    "delivery_assignment": null
  }
}
```

---

### 4. Chuyển trạng thái đơn (Pick → Pack → Ship → Done)

```
PUT /api/order/fulfillment/{order_id}/advance
```

**Body:**
```json
{
  "from_step": "picking",
  "to_step": "packing",
  "picked_items": [
    { "product_id": 15, "qty": 2, "checked": true }
  ]
}
```

> Khi `to_step = "shipping"`, cần thêm `delivery_assignment`:
```json
{
  "from_step": "packing",
  "to_step": "shipping",
  "delivery_person_id": 3,
  "time_slot": "14:00-17:00"
}
```

---

### 5. Cập nhật thông tin hoá đơn VAT

```
PUT /api/order/orders/{order_id}/vat-invoice
```

**Body:**
```json
{
  "company_name": "Công ty ABC",
  "tax_code": "0123456789",
  "email": "billing@abc.com"
}
```

---

### 6. Danh sách người giao hàng

```
GET /api/catalog/delivery-staff?status=available
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 3, "name": "Trần Văn C", "phone": "0909xxx", "vehicle": "Xe máy", "status": "available" }
  ]
}
```

---

### 7. Xuất báo cáo fulfillment

```
GET /api/order/fulfillment/export?date=today&format=xlsx
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/order/fulfillment/stats` | GET | order | Yes | Page load |
| 2 | `/api/order/fulfillment/board` | GET | order | Yes | Page load |
| 3 | `/api/order/fulfillment/{order_id}` | GET | order | Yes | Click card |
| 4 | `/api/order/fulfillment/{order_id}/advance` | PUT | order | Yes | Click advance button |
| 5 | `/api/order/orders/{order_id}/vat-invoice` | PUT | order | Yes | Submit VAT info |
| 6 | `/api/catalog/delivery-staff?status=available` | GET | catalog | Yes | Open delivery assignment |
| 7 | `/api/order/fulfillment/export` | GET | order | Yes | Click "Xuất báo cáo" |
