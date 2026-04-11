# API Mapping — admin/audits.html

> **Trang**: Kiểm Kê Tồn Kho (Stocktake)  
> **Auth yêu cầu**: Có (Admin/Warehouse)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                        │
├──────────────────────────────────────────────────────────────┤
│  Page Header: "Kiểm Kê Tồn Kho (Stocktake)"                │
│  Filters: [Khu vực▼] [Trạng thái▼ Đang kiểm/Đã đối soát]  │
│           [Tháng (month picker)]                              │
│  Actions: [Tạo Phiếu Kiểm Kê]                               │
├──────────────────────────────────────────────────────────────┤
│  Table:                                                      │
│  Mã Phiếu|Thời gian/Người tạo|Phạm vi|Số mã lệch|          │
│  GT chênh lệch|Trạng thái                                   │
├──────────────────────────────────────────────────────────────┤
│  FULLSCREEN MODAL: "Phiếu Kiểm Kê Mới"                     │
│  Zone select → [Tải dữ liệu HT] → [Quét mã vạch đếm]      │
│  Editable Table:                                              │
│  SKU|Tên thuốc|Mã Lô|SL Hệ thống|SL Thực tế(input)|        │
│  Chênh lệch(+/− live calc, red/green)                       │
│  Footer: Tổng thiếu|Tổng dư|GT hao hụt                      │
│  Buttons: [Huỷ] [Lưu Nháp] [Hoàn tất Đối Soát & Cập nhật] │
└──────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Danh sách phiếu kiểm kê

```
GET /api/catalog/audits?page=1&limit=20&zone_id={id}&status={status}&month={YYYY-MM}
```

| Param | Type | Mô tả |
|-------|------|-------|
| `zone_id` | int | Lọc theo khu vực |
| `status` | string | `in_progress`, `reconciled` |
| `month` | string | `2026-03` |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "KK-2026-003",
      "created_at": "2026-03-01T08:00:00",
      "created_by": "Nguyễn Admin",
      "zone_name": "Khu Thuốc OTC",
      "discrepancy_items": 3,
      "discrepancy_value": -450000,
      "status": "reconciled"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12 }
}
```

---

### 2. Tải dữ liệu hệ thống cho phiếu kiểm kê mới

```
GET /api/catalog/audits/system-data?zone_id={id}
```

Trả về tất cả sản phẩm + tồn kho trong zone đã chọn.

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "product_id": 42,
      "sku": "MED-0042",
      "product_name": "Amoxicillin 500mg",
      "batch_code": "LO-2026-0112",
      "system_qty": 120
    },
    {
      "product_id": 15,
      "sku": "MED-0015",
      "product_name": "Paracetamol 500mg",
      "batch_code": "LO-2025-0089",
      "system_qty": 450
    }
  ]
}
```

---

### 3. Quét mã vạch (tra cứu SP)

```
GET /api/catalog/products/barcode/{barcode}
```

(Dùng chung API barcode từ batches)

---

### 4. Lưu phiếu nháp

```
POST /api/catalog/audits
```

**Body:**
```json
{
  "zone_id": 2,
  "status": "draft",
  "items": [
    { "product_id": 42, "batch_code": "LO-2026-0112", "system_qty": 120, "actual_qty": 118 },
    { "product_id": 15, "batch_code": "LO-2025-0089", "system_qty": 450, "actual_qty": 450 }
  ]
}
```

---

### 5. Hoàn tất đối soát & cập nhật kho

```
PUT /api/catalog/audits/{id}/reconcile
```

**Body:**
```json
{
  "items": [
    { "product_id": 42, "batch_code": "LO-2026-0112", "system_qty": 120, "actual_qty": 118, "discrepancy": -2 }
  ],
  "total_shortage_qty": 2,
  "total_surplus_qty": 0,
  "total_loss_value": 6000
}
```

> API sẽ tự động điều chỉnh tồn kho thực tế trong `mg_catalog.batches`.

---

### 6. Danh sách zones (cho dropdown)

```
GET /api/catalog/locations/zones
```

(Dùng chung API locations)

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/audits` | GET | catalog | Yes | Page load + filter |
| 2 | `/api/catalog/audits/system-data?zone_id=X` | GET | catalog | Yes | Tạo phiếu mới → chọn zone |
| 3 | `/api/catalog/products/barcode/{code}` | GET | catalog | Yes | Quét mã vạch |
| 4 | `/api/catalog/audits` | POST | catalog | Yes | Lưu nháp |
| 5 | `/api/catalog/audits/{id}/reconcile` | PUT | catalog | Yes | Hoàn tất đối soát |
| 6 | `/api/catalog/locations/zones` | GET | catalog | Yes | Page load (dropdown) |
