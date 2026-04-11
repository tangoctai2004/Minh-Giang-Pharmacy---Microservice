# API Mapping — admin/index.html (Dashboard)

> **Trang**: Dashboard tổng quan kinh doanh  
> **Auth yêu cầu**: Có (Admin/Manager)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌───────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header] — inject via admin-components.js    │
├───────────────────────────────────────────────────────────┤
│  Page Header: "Trang Chủ" + [Xuất báo cáo] [Nhập hàng]  │
├───────────────────────────────────────────────────────────┤
│  4 Stat Cards:                                            │
│  Doanh thu hôm nay | Đơn POS | Đơn Web | KH mới          │
│  12.5M (+12.5%)    | 47 (+5%)| 18 (-3%)| 9 (+28%)         │
├───────────────────────────────────────────────────────────┤
│  Revenue Chart (Bar chart 7 ngày)                         │
│  Filter: [7 ngày] [30 ngày] [Quý này]                    │
├────────────────────────┬──────────────────────────────────┤
│  Cảnh báo sắp hết hàng│  Thuốc sắp hết hạn              │
│  Table: Tên|SKU|Tồn   │  Table: Tên|Mã lô|HSD|Nhập thêm │
│  5 sản phẩm            │  4 lô hàng                       │
└────────────────────────┴──────────────────────────────────┘
```

---

## API chi tiết

### 1. Thống kê tổng quan hôm nay

```
GET /api/order/dashboard/summary?date=today
```

**Headers:** `Authorization: Bearer {token}`

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "revenue_today": 12500000,
    "revenue_yesterday": 11111000,
    "revenue_change_percent": 12.5,
    "pos_orders_today": 47,
    "pos_orders_change_percent": 5,
    "web_orders_today": 18,
    "web_orders_change_percent": -3,
    "new_customers_today": 9,
    "new_customers_change_percent": 28
  }
}
```

---

### 2. Biểu đồ doanh thu

```
GET /api/order/dashboard/revenue-chart?period={period}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `period` | string (query) | `7d`, `30d`, `quarter` |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "labels": ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    "values": [8200000, 10500000, 6800000, 12100000, 9400000, 13800000, 12500000],
    "total": 73300000
  }
}
```

---

### 3. Cảnh báo sắp hết hàng

```
GET /api/catalog/inventory/alerts/low-stock?limit=5
```

**Headers:** `Authorization: Bearer {token}`

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "product_name": "Amoxicillin 500mg", "sku": "MED-0042", "stock_qty": 3, "min_stock": 20, "level": "critical" },
    { "product_name": "Paracetamol 500mg", "sku": "MED-0015", "stock_qty": 5, "min_stock": 50, "level": "critical" },
    { "product_name": "Vitamin C DHC 1000mg", "sku": "SUP-0023", "stock_qty": 12, "min_stock": 30, "level": "low" }
  ],
  "total": 5
}
```

---

### 4. Thuốc sắp hết hạn (FEFO)

```
GET /api/catalog/inventory/alerts/expiring?limit=5&within_days=90
```

**Headers:** `Authorization: Bearer {token}`

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "product_name": "Efferalgan 500mg",
      "batch_code": "LO-2024-0892",
      "expiry_date": "2026-03-12",
      "days_remaining": 7,
      "stock_qty": 24,
      "level": "urgent"
    },
    {
      "product_name": "Thuốc ho Prospan",
      "batch_code": "LO-2024-1105",
      "expiry_date": "2026-03-20",
      "days_remaining": 15,
      "stock_qty": 18,
      "level": "urgent"
    }
  ],
  "total": 4
}
```

---

### 5. Xuất báo cáo tổng hợp

```
GET /api/order/dashboard/export?period={period}&format=xlsx
```

Nút **"Xuất báo cáo"** → download file Excel.

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/order/dashboard/summary?date=today` | GET | order | Yes | Page load |
| 2 | `/api/order/dashboard/revenue-chart?period=7d` | GET | order | Yes | Page load + click filter |
| 3 | `/api/catalog/inventory/alerts/low-stock` | GET | catalog | Yes | Page load |
| 4 | `/api/catalog/inventory/alerts/expiring` | GET | catalog | Yes | Page load |
| 5 | `/api/order/dashboard/export` | GET | order | Yes | Click "Xuất báo cáo" |
