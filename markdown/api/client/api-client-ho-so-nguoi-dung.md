# API Mapping — client/user-profile.html (Trang cá nhân)

> **Trang**: `frontend/client/user-profile.html`  
> **Mô tả**: Trang quản lý tài khoản — đơn hàng, thông tin cá nhân, mã giảm giá  
> **Auth yêu cầu**: Có (bắt buộc login)  
> **Ngày phân tích**: 2026-04-10

---

## 📐 Sơ đồ bố cục trang

```
┌─────────────────────────────────────────────────┐
│  [Component] Header Banner + Top Bar + Header   │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │  Section hiện tại (thay đổi)        │
│          │                                      │
│ ☐ Đơn   │  Section 1: Đơn hàng online         │
│   online │    Tabs: Tất cả | Đang xử lý | ...  │
│ ☐ Đơn   │    Search + Bảng đơn hàng            │
│   tại NT │                                      │
│ ☐ Thông │  Section 2: Đơn tại nhà thuốc       │
│   tin CN │                                      │
│ ☐ Mã    │  Section 3: Thông tin cá nhân       │
│   giảm   │    Form: Email, Password, Name,      │
│   giá    │    Phone, Address, VAT info           │
│ ☐ Đăng  │    [Lưu] [Hủy]                      │
│   xuất   │                                      │
│          │  Section 4: Mã giảm giá             │
│ Avatar   │    3 voucher cards                   │
│ Points   │    [Sao chép mã] [Áp dụng]          │
│ Tier     │                                      │
├──────────┴──────────────────────────────────────┤
│  [Component] Footer                             │
└─────────────────────────────────────────────────┘
```

---

## 🔌 CHI TIẾT API TỪNG VÙNG

---

### 1. Sidebar — Thông tin user + Loyalty

**Mô tả UI**: Avatar, tên, badge hạng, điểm tich lũy, progress bar lên hạng.

```
GET /api/identity/customers/me
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "KH-0001",
    "name": "Nguyễn Văn A",
    "phone": "0912345678",
    "email": "nguyenvana@gmail.com",
    "gender": "male",
    "avatar_url": null,
    "loyalty_points": 250,
    "loyalty_tier": "gold",
    "total_spending": 4250000,
    "tier_progress": {
      "current_tier": "gold",
      "next_tier": "platinum",
      "current_spending": 4250000,
      "next_tier_threshold": 15000000
    },
    "default_address": {
      "province_id": 79,
      "province_name": "TP. HCM",
      "district_id": 760,
      "district_name": "Quận 1",
      "ward_id": 26734,
      "ward_name": "Phường Bến Nghé",
      "address_detail": "128 Nguyễn Huệ"
    },
    "vat_info": {
      "company_name": null,
      "tax_code": null,
      "company_phone": null,
      "company_email": null
    }
  }
}
```

---

### 2. Section: Đơn hàng Online

**Mô tả UI**: Tabs status: Tất cả | Đang xử lý | Xác nhận đơn | Hoàn thành | Hủy đơn. Search bar + bảng đơn.

```
GET /api/order/orders/my?status={status}&q={search}&page=1&limit=10
```

| Param | Type | Mô tả |
|-------|------|-------|
| `status` | string (query) | `all`, `pending`, `confirmed`, `completed`, `cancelled` |
| `q` | string (query) | Tìm theo mã đơn, tên sản phẩm |
| `page` | int (query) | Trang |
| `limit` | int (query) | Số đơn/trang |
| `channel` | string (query) | `web` (đơn online) |

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "order_code": "WEB-260410-100",
      "order_status": "completed",
      "total": 242000,
      "payment_method": "vnpay",
      "payment_status": "paid",
      "created_at": "2026-04-10T10:30:00Z",
      "items_count": 2,
      "items_preview": ["Dung dịch vệ sinh Chilly", "The Fucoidan"]
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 5 }
}
```

---

### 3. Section: Đơn hàng tại Nhà thuốc

```
GET /api/order/orders/my?channel=pos&page=1&limit=10
```

(Cấu trúc response tương tự section 2)

---

### 4. Section: Thông tin cá nhân — Nút "Lưu"

**Mô tả UI**: Form cập nhật: email, password, confirm password, gender, first/last name, phone, address, VAT info.

```
PUT /api/identity/customers/me
```

| Field | Type | Mô tả |
|-------|------|-------|
| `name` | string (body) | Họ tên |
| `email` | string (body) | Email |
| `phone` | string (body) | Số điện thoại |
| `gender` | string (body) | `male` / `female` |
| `province_id` | int (body) | ID tỉnh |
| `district_id` | int (body) | ID quận |
| `ward_id` | int (body) | ID phường |
| `address_detail` | string (body) | Địa chỉ chi tiết |
| `vat_info` | object (body) | `{ company_name, tax_code, phone, email }` |

**Request mẫu:**
```json
{
  "name": "Nguyễn Văn A",
  "email": "newmail@gmail.com",
  "phone": "0912345678",
  "gender": "male",
  "province_id": 79,
  "district_id": 760,
  "ward_id": 26734,
  "address_detail": "128 Nguyễn Huệ, Quận 1"
}
```

---

### 5. Đổi mật khẩu

```
PUT /api/identity/auth/change-password
```

| Field | Type | Mô tả |
|-------|------|-------|
| `current_password` | string (body) | Mật khẩu hiện tại |
| `new_password` | string (body) | Mật khẩu mới |
| `confirm_password` | string (body) | Xác nhận mật khẩu mới |

---

### 6. Section: Mã giảm giá

**Mô tả UI**: 3 voucher cards — mỗi card hiện: giá trị giảm, điều kiện, hạn sử dụng, nút "Sao chép" và "Áp dụng".

```
GET /api/cms/promotions/my-vouchers
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "KH50K",
      "description": "Khách hàng lần đầu",
      "discount_type": "fixed",
      "discount_value": 38000,
      "min_order_value": 0,
      "expires_at": "2026-05-01T23:59:59Z",
      "is_used": false
    },
    {
      "id": 2,
      "code": "BILL699K",
      "description": "Giảm 70K cho bill từ 699K",
      "discount_type": "fixed",
      "discount_value": 70000,
      "min_order_value": 699000,
      "expires_at": "2026-06-30T23:59:59Z",
      "is_used": false
    }
  ]
}
```

---

### 7. Đăng xuất

```
POST /api/identity/auth/logout
```

| Field | Type | Mô tả |
|-------|------|-------|
| `refresh_token` | string (body) | Refresh token để revoke |

**Response:**
```json
{ "success": true, "message": "Đăng xuất thành công" }
```

---

## 📊 TỔNG HỢP API CẦN CHO TRANG

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/identity/customers/me` | GET | identity | Yes | Page load |
| 2 | `/api/order/orders/my?channel=web&status=X` | GET | order | Yes | Section đơn online |
| 3 | `/api/order/orders/my?channel=pos` | GET | order | Yes | Section đơn tại NT |
| 4 | `/api/identity/customers/me` | PUT | identity | Yes | Click "Lưu" thông tin |
| 5 | `/api/identity/auth/change-password` | PUT | identity | Yes | Đổi mật khẩu |
| 6 | `/api/cms/promotions/my-vouchers` | GET | cms | Yes | Section mã giảm giá |
| 7 | `/api/identity/auth/logout` | POST | identity | Yes | Click "Đăng xuất" |
| 8 | `/api/identity/address/provinces` | GET | identity | No | Edit address |
| 9 | `/api/identity/address/districts?province_id=X` | GET | identity | No | Edit address |
| 10 | `/api/identity/address/wards?district_id=X` | GET | identity | No | Edit address |
