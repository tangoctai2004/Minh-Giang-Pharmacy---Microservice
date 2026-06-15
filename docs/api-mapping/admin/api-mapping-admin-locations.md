# API Mapping — admin/locations.html

> **Trang**: Pharmacy Layout & Storage (Zone → Cabinet → Shelf)  
> **Auth yêu cầu**: Có (Admin/Warehouse)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                      │
├────────────────────────────────────────────────────────────┤
│  Page Header: "Pharmacy Layout & Storage"                  │
├──────────┬──────────────┬──────────────────────────────────┤
│  Panel 1 │  Panel 2     │  Panel 3                         │
│  ZONES   │  CABINETS    │  SHELVES                         │
│          │              │                                  │
│  Khu Rx  │  → Tủ A1     │  → Kệ A1-T1 (Kháng sinh)       │
│  Khu OTC │    Tủ A2     │    Kệ A1-T2 (Giảm đau)         │
│  TPCN    │    Tủ A3     │    Kệ A1-T3 (Vitamin)           │
│          │              │                                  │
│  [+Thêm] │  [+Thêm]     │  [+Thêm] [Edit ✏️]              │
└──────────┴──────────────┴──────────────────────────────────┘
```

---

## API chi tiết

### 1. Danh sách Zone

```
GET /api/catalog/locations/zones
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Khu Thuốc Kê Đơn (Rx)", "code": "ZONE-RX", "cabinet_count": 5 },
    { "id": 2, "name": "Khu Thuốc OTC", "code": "ZONE-OTC", "cabinet_count": 8 },
    { "id": 3, "name": "Thực phẩm chức năng", "code": "ZONE-TPCN", "cabinet_count": 4 }
  ]
}
```

---

### 2. Danh sách Cabinet theo Zone

```
GET /api/catalog/locations/zones/{zone_id}/cabinets
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 10, "name": "Tủ A1", "code": "CAB-A1", "shelf_count": 4 },
    { "id": 11, "name": "Tủ A2", "code": "CAB-A2", "shelf_count": 3 }
  ]
}
```

---

### 3. Danh sách Shelf theo Cabinet

```
GET /api/catalog/locations/cabinets/{cabinet_id}/shelves
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 20, "name": "Kệ A1-T1", "product_group": "Kháng sinh", "product_count": 12 },
    { "id": 21, "name": "Kệ A1-T2", "product_group": "Giảm đau hạ sốt", "product_count": 8 }
  ]
}
```

---

### 4. Thêm Zone mới

```
POST /api/catalog/locations/zones
```

**Body:**
```json
{ "name": "Khu Dược mỹ phẩm", "code": "ZONE-DMP" }
```

---

### 5. Thêm Cabinet

```
POST /api/catalog/locations/zones/{zone_id}/cabinets
```

**Body:**
```json
{ "name": "Tủ B1", "code": "CAB-B1" }
```

---

### 6. Thêm Shelf

```
POST /api/catalog/locations/cabinets/{cabinet_id}/shelves
```

**Body:**
```json
{ "name": "Kệ B1-T1", "product_group": "Dưỡng da" }
```

---

### 7. Cập nhật Shelf

```
PUT /api/catalog/locations/shelves/{id}
```

**Body:**
```json
{ "name": "Kệ B1-T1", "product_group": "Dưỡng da mặt" }
```

---

### 8. Cập nhật Cabinet

```
PUT /api/catalog/locations/cabinets/{id}
```

---

### 9. Cập nhật Zone

```
PUT /api/catalog/locations/zones/{id}
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/catalog/locations/zones` | GET | catalog | Yes | Page load |
| 2 | `/api/catalog/locations/zones/{id}/cabinets` | GET | catalog | Yes | Click zone |
| 3 | `/api/catalog/locations/cabinets/{id}/shelves` | GET | catalog | Yes | Click cabinet |
| 4 | `/api/catalog/locations/zones` | POST | catalog | Yes | Click "+ Thêm" zone |
| 5 | `/api/catalog/locations/zones/{id}/cabinets` | POST | catalog | Yes | Click "+ Thêm" cabinet |
| 6 | `/api/catalog/locations/cabinets/{id}/shelves` | POST | catalog | Yes | Click "+ Thêm" shelf |
| 7 | `/api/catalog/locations/shelves/{id}` | PUT | catalog | Yes | Click Edit shelf |
| 8 | `/api/catalog/locations/cabinets/{id}` | PUT | catalog | Yes | Click Edit cabinet |
| 9 | `/api/catalog/locations/zones/{id}` | PUT | catalog | Yes | Click Edit zone |
