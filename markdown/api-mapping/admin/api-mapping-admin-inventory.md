# API Mapping — admin/inventory.html

> **Trang**: Dữ liệu gốc — Tồn kho & Danh mục Master  
> **Auth yêu cầu**: Có (Admin/Warehouse)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌────────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                          │
├────────────────────────────────────────────────────────────────┤
│  Page Header: "Dữ Liệu Thuốc Gốc"                            │
│  3 Stat Cards: Sắp hết hàng(12) | Cận hạn FEFO(5) | GT tồn   │
├────────────────────────────────────────────────────────────────┤
│  Search: [Tên thuốc, SKU, hoạt chất] [Danh mục▼] [Trạng thái▼]│
│  Tab: [Tồn Kho Thực Tế] [Danh Mục Master]                    │
│  Actions: [In Mã Vạch] [Xuất CSV] [Thêm Thuốc Mới]           │
├────────────────────────────────────────────────────────────────┤
│  TAB 1 — Tồn Kho Thực Tế (Stock):                             │
│  Table: SP | Phân loại | Vị trí | Lô | HSD | Tồn kho | TT lô │
├────────────────────────────────────────────────────────────────┤
│  TAB 2 — Danh Mục Master:                                     │
│  Table: Hình | SKU | Tên SP | Danh mục | Tổng Tồn | Giá bán   │
│         | Trạng thái | Thao tác [Edit][Delete]                 │
├────────────────────────────────────────────────────────────────┤
│  SLIDE-OVER MODAL (60%): "Phiếu Đăng Ký Thuốc Mới"           │
│  Tab General: Tên|SKU(auto)|Danh mục|Hoạt chất|SĐK|NSX|Rx    │
│  Tab Units: ĐV cơ bản|Giá nhập|Giá bán|Bảng quy đổi đơn vị  │
│  Tab Storage: Zone|Cabinet|Shelf|Min stock alert               │
└────────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Thống kê tồn kho

```
GET /api/catalog/inventory/stats
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "low_stock_count": 12,
    "expiring_soon_count": 5,
    "total_inventory_value": 1400000000
  }
}
```

---

### 2. Danh sách tồn kho thực tế (Stock tab)

```
GET /api/catalog/inventory/stock?page=1&limit=20&q={search}&category_id={id}&status={status}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `q` | string | Tìm theo tên, SKU, hoạt chất |
| `category_id` | int | Lọc theo danh mục |
| `status` | string | `safe`, `low`, `expired`, `near_expiry` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "product_id": 1,
      "product_name": "Amoxicillin 500mg",
      "category": "Kháng sinh",
      "location": "Kệ A3-T2",
      "batch_code": "LO-2025-0012",
      "expiry_date": "2027-06-15",
      "stock_qty": 120,
      "batch_status": "safe"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 350 }
}
```

---

### 3. Danh sách sản phẩm Master Data

```
GET /api/catalog/products?page=1&limit=20&q={search}&category_id={id}&status={status}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `status` | string | `active`, `inactive` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sku": "MED-0042",
      "name": "Amoxicillin 500mg",
      "thumbnail": "...",
      "category": "Kháng sinh",
      "total_stock": 320,
      "retail_price": 85000,
      "status": "active"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 450 }
}
```

---

### 4. Danh sách danh mục (cho dropdown filter + form)

```
GET /api/catalog/categories?flat=true
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Thuốc kê đơn", "parent_id": null },
    { "id": 2, "name": "Kháng sinh", "parent_id": 1 },
    { "id": 3, "name": "Thực phẩm chức năng", "parent_id": null }
  ]
}
```

---

### 5. Tạo sản phẩm mới (Slide-over modal)

```
POST /api/catalog/products
```

**Body:**
```json
{
  "name": "Paracetamol 500mg",
  "category_id": 2,
  "active_ingredient": "Paracetamol",
  "registration_number": "VN-12345-20",
  "manufacturer": "Sanofi",
  "is_prescription": false,
  "base_unit": "Viên",
  "cost_price": 2000,
  "retail_price": 5000,
  "unit_conversions": [
    { "unit_name": "Hộp", "conversion_qty": 100, "retail_price": 450000 },
    { "unit_name": "Vỉ", "conversion_qty": 10, "retail_price": 48000 }
  ],
  "storage": {
    "zone_id": 1,
    "cabinet_id": 3,
    "shelf_id": 7,
    "min_stock_alert": 20
  }
}
```

**Response:** `201 Created`

---

### 6. Cập nhật sản phẩm

```
PUT /api/catalog/products/{id}
```

Body tương tự POST, chỉ gửi fields cần update.

---

### 7. Xóa sản phẩm

```
DELETE /api/catalog/products/{id}
```

---

### 8. Danh sách Zone (cho tab Storage)

```
GET /api/catalog/locations/zones
```

---

### 9. Danh sách Cabinet theo Zone

```
GET /api/catalog/locations/zones/{zone_id}/cabinets
```

---

### 10. Danh sách Shelf theo Cabinet

```
GET /api/catalog/locations/cabinets/{cabinet_id}/shelves
```

---

### 11. In mã vạch

```
POST /api/catalog/products/barcode/print
```

**Body:**
```json
{ "product_ids": [1, 2, 3], "label_size": "38x25mm" }
```

---

### 12. Xuất CSV

```
GET /api/catalog/products/export?format=csv&tab=master
```

hoặc

```
GET /api/catalog/inventory/export?format=csv&tab=stock
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/inventory/stats` | GET | catalog | Yes | Page load |
| 2 | `/api/catalog/inventory/stock` | GET | catalog | Yes | Tab Stock + filter |
| 3 | `/api/catalog/products` | GET | catalog | Yes | Tab Master + filter |
| 4 | `/api/catalog/categories?flat=true` | GET | catalog | Yes | Page load (dropdown) |
| 5 | `/api/catalog/products` | POST | catalog | Yes | Submit "Thêm Thuốc Mới" |
| 6 | `/api/catalog/products/{id}` | PUT | catalog | Yes | Click Edit → Save |
| 7 | `/api/catalog/products/{id}` | DELETE | catalog | Yes | Click Delete |
| 8 | `/api/catalog/locations/zones` | GET | catalog | Yes | Open Storage tab |
| 9 | `/api/catalog/locations/zones/{id}/cabinets` | GET | catalog | Yes | Select zone |
| 10 | `/api/catalog/locations/cabinets/{id}/shelves` | GET | catalog | Yes | Select cabinet |
| 11 | `/api/catalog/products/barcode/print` | POST | catalog | Yes | Click "In Mã Vạch" |
| 12 | `/api/catalog/products/export` | GET | catalog | Yes | Click "Xuất CSV" |
