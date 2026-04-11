# API Mapping — admin/shifts.html

> **Trang**: Báo Cáo Ca & Khớp Quỹ  
> **Auth yêu cầu**: Có (Admin/Manager)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                        │
├──────────────────────────────────────────────────────────────┤
│  Page Header: "Báo Cáo Ca & Khớp Quỹ"                       │
│  Filters: [Date range picker]                                │
│  Actions: [Xuất ra Excel]                                    │
├──────────────────────────────────────────────────────────────┤
│  Table:                                                      │
│  Thu ngân | Thời gian mở/đóng ca | HT tính | TN đếm |       │
│  Chênh lệch | Trạng thái | Thao tác                         │
│                                                              │
│  Chênh lệch: "0₫ (Khớp)" green                             │
│              "-20,000₫ (Thiếu)" red                          │
│              "+10,000₫ (Dư)" green                           │
│                                                              │
│  Status: "Đã khớp" green | "Chờ xử lý" yellow               │
│  Actions: [Duyệt bù tiền][Duyệt thu dư][Chart][Print]      │
└──────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Danh sách báo cáo ca

```
GET /api/identity/shifts/reports?from={date}&to={date}&page=1&limit=20
```

| Param | Type | Mô tả |
|-------|------|-------|
| `from` | date | Ngày bắt đầu |
| `to` | date | Ngày kết thúc |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "cashier_name": "Lê Thị Hoa",
      "shift_opened_at": "2026-03-05T07:30:00",
      "shift_closed_at": "2026-03-05T15:30:00",
      "system_total": 4500000,
      "cashier_counted": 4500000,
      "discrepancy": 0,
      "discrepancy_label": "Khớp",
      "status": "matched"
    },
    {
      "id": 2,
      "cashier_name": "Trần Văn B",
      "shift_opened_at": "2026-03-05T15:30:00",
      "shift_closed_at": "2026-03-05T21:30:00",
      "system_total": 3200000,
      "cashier_counted": 3180000,
      "discrepancy": -20000,
      "discrepancy_label": "Thiếu",
      "status": "pending"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45 }
}
```

---

### 2. Duyệt bù tiền (khi thiếu)

```
PUT /api/identity/shifts/{id}/resolve
```

**Body:**
```json
{
  "action": "compensate",
  "amount": 20000,
  "notes": "Thu ngân bù tiền thiếu"
}
```

---

### 3. Duyệt thu dư (khi dư)

```
PUT /api/identity/shifts/{id}/resolve
```

**Body:**
```json
{
  "action": "collect_surplus",
  "amount": 10000,
  "notes": "Thu tiền dư"
}
```

---

### 4. Chi tiết ca (cho biểu đồ)

```
GET /api/identity/shifts/{id}/detail
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "cashier_name": "Lê Thị Hoa",
    "shift_period": "07:30 - 15:30",
    "transactions_count": 32,
    "breakdown": {
      "cash": 3200000,
      "card": 800000,
      "transfer": 500000
    },
    "system_total": 4500000,
    "cashier_counted": 4500000
  }
}
```

---

### 5. In báo cáo ca

```
GET /api/identity/shifts/{id}/print
```

---

### 6. Xuất Excel

```
GET /api/identity/shifts/reports/export?from={date}&to={date}&format=xlsx
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/identity/shifts/reports` | GET | identity | Yes | Page load + date filter |
| 2 | `/api/identity/shifts/{id}/resolve` | PUT | identity | Yes | Click "Duyệt bù/thu dư" |
| 3 | `/api/identity/shifts/{id}/detail` | GET | identity | Yes | Click chart icon |
| 4 | `/api/identity/shifts/{id}/print` | GET | identity | Yes | Click Print |
| 5 | `/api/identity/shifts/reports/export` | GET | identity | Yes | Click "Xuất Excel" |
