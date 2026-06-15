# API Mapping — pos/login.html

> **Trang**: Đăng nhập POS với Numpad PIN + Mở ca  
> **Auth yêu cầu**: Không (public — trang xác thực)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────┐
│  Navbar (minimal): Logo | Clock | KIOSK #01                 │
├──────────────────────────────────────────────────────────────┤
│  Login Card — Two columns:                                    │
│  ┌─────────────────────┬─────────────────────────────────────┐│
│  │  LEFT — Numpad      │  RIGHT — Form                       ││
│  │  Green gradient      │                                     ││
│  │  "Nhập mã PIN"      │  Logo + Title                       ││
│  │  ○ ○ ○ ○ ○ ○        │  "Quản lý và bán hàng"             ││
│  │  (6 PIN dots)       │                                     ││
│  │                     │  [Chọn nhân viên ▼]                 ││
│  │  [1] [2] [3]        │   NV A — DS. Dược sĩ               ││
│  │  [4] [5] [6]        │   Trần Thị B — NV. Thu ngân        ││
│  │  [7] [8] [9]        │   Lê Văn C — NV. Thu ngân          ││
│  │  [⌫] [0] [→]        │   Phạm Thị H — DS. Dược sĩ        ││
│  │                     │                                     ││
│  │                     │  PIN Status: waiting/success/error  ││
│  │                     │  ✓ Verified badge (hidden)          ││
│  │                     │                                     ││
│  │                     │  ── Mở ca làm việc ── (hidden)      ││
│  │                     │  Tiền đầu ca: [500,000] VNĐ        ││
│  │                     │  Quick: [200K][500K][1M][2M]        ││
│  │                     │  [MỞ CA & BẮT ĐẦU BÁN HÀNG]       ││
│  └─────────────────────┴─────────────────────────────────────┘│
│  Kiosk Info: #01 | Máy in: OK | Scanner: OK | Online         │
└──────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Danh sách nhân viên POS (dropdown)

```
GET /api/identity/users?role=cashier&active=true
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "nva", "full_name": "Nguyễn Văn A", "role_label": "DS. Dược sĩ" },
    { "id": 2, "code": "ttb", "full_name": "Trần Thị B", "role_label": "NV. Thu ngân" },
    { "id": 3, "code": "lvc", "full_name": "Lê Văn C", "role_label": "NV. Thu ngân" },
    { "id": 4, "code": "pth", "full_name": "Phạm Thị H", "role_label": "DS. Dược sĩ" }
  ]
}
```

---

### 2. Xác thực PIN

```
POST /api/identity/auth/pos/verify-pin
```

**Body:**
```json
{
  "user_code": "nva",
  "pin": "123456",
  "kiosk_id": "KIOSK-01"
}
```

**Response thành công:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "full_name": "Nguyễn Văn A",
      "role": "pharmacist",
      "role_label": "DS. Dược sĩ",
      "shift_label": "Ca sáng"
    }
  }
}
```

**Response lỗi:**
```json
{
  "success": false,
  "error": { "code": "INVALID_PIN", "message": "Mã PIN không đúng" }
}
```

---

### 3. Mở ca bán hàng

```
POST /api/identity/shifts/open
```

**Body:**
```json
{
  "user_id": 1,
  "kiosk_id": "KIOSK-01",
  "opening_cash": 500000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shift_id": 13,
    "opened_at": "2026-03-06T07:30:00",
    "cashier_name": "Nguyễn Văn A",
    "kiosk_id": "KIOSK-01",
    "opening_cash": 500000
  }
}
```

---

### 4. Kiểm tra trạng thái kiosk

```
GET /api/identity/kiosk/status?kiosk_id=KIOSK-01
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "kiosk_id": "KIOSK-01",
    "printer_status": "ok",
    "scanner_status": "ok",
    "network_status": "online",
    "active_shift": null
  }
}
```

> Nếu `active_shift` != null → redirect thẳng tới index.html (ca đang mở).

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/identity/users?role=cashier` | GET | identity | No | Page load (dropdown) |
| 2 | `/api/identity/auth/pos/verify-pin` | POST | identity | No | Submit PIN |
| 3 | `/api/identity/shifts/open` | POST | identity | Yes | Click "MỞ CA" |
| 4 | `/api/identity/kiosk/status` | GET | identity | No | Page load |
