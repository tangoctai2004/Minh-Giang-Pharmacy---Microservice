# API Mapping — client/login.html + client/register.html (Đăng nhập & Đăng ký)

> **Trang**: `frontend/client/login.html` + `frontend/client/register.html`  
> **Mô tả**: Trang đăng nhập và đăng ký khách hàng  
> **Auth yêu cầu**: Không (public)  
> **Ngày phân tích**: 2026-04-10

---

## PHẦN A — client/login.html (Đăng nhập)

### Sơ đồ bố cục

```
┌─────────────────────────────────────────────────┐
│  Banner trái (ảnh + bullet points)              │
├─────────────────────────────────────────────────┤
│  Tab: [Đăng Nhập] | Đăng Ký                    │
│  ─────────────────                              │
│  Email / Số điện thoại *                        │
│  Mật khẩu *                                     │
│  ☐ Ghi nhớ          Quên mật khẩu?             │
│  [Đăng nhập ngay]                               │
│  ─────────────────                              │
│  Hoặc đăng nhập bằng Zalo                       │
│  ─────────────────                              │
│  Quay lại trang chủ                             │
└─────────────────────────────────────────────────┘
```

### API chi tiết

#### 1. Nút "Đăng nhập ngay"

```
POST /api/identity/auth/login
```

| Field | Type | Mô tả |
|-------|------|-------|
| `email_or_phone` | string (body) | Email hoặc số điện thoại |
| `password` | string (body) | Mật khẩu |
| `remember_me` | boolean (body) | Ghi nhớ phiên đăng nhập |

**Request mẫu:**
```json
{
  "email_or_phone": "0912345678",
  "password": "MyPassword123",
  "remember_me": true
}
```

**Response thành công:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600,
    "user": {
      "id": 1,
      "name": "Nguyễn Văn A",
      "phone": "0912345678",
      "email": "nguyenvana@gmail.com",
      "role": "customer",
      "loyalty_tier": "gold",
      "loyalty_points": 250
    }
  }
}
```

**Response lỗi:**
```json
{
  "success": false,
  "message": "Email/số điện thoại hoặc mật khẩu không đúng"
}
```

---

#### 2. Link "Quên mật khẩu?"

**Hành vi**: Hiện popup/chuyển sang flow quên mật khẩu → gửi OTP.

```
POST /api/identity/auth/forgot-password
```

| Field | Type | Mô tả |
|-------|------|-------|
| `email_or_phone` | string (body) | Email hoặc SĐT để nhận OTP |

**Response:**
```json
{
  "success": true,
  "message": "Mã OTP đã được gửi đến số điện thoại 091****678",
  "data": { "otp_expires_in": 300 }
}
```

---

#### 3. Đăng nhập bằng Zalo

**Hành vi**: OAuth2 flow — redirect sang Zalo OAuth.

```
GET /api/identity/auth/zalo/redirect
```

**Response:**
```json
{
  "success": true,
  "data": {
    "redirect_url": "https://oauth.zaloapp.com/v4/permission?app_id=..."
  }
}
```

**Callback (sau khi user approve):**
```
GET /api/identity/auth/zalo/callback?code={authorization_code}
```

---

## PHẦN B — client/register.html (Đăng ký)

### Sơ đồ bố cục

```
┌─────────────────────────────────────────────────┐
│  Banner trái (ảnh + bullet: Voucher 50K, ...)   │
├─────────────────────────────────────────────────┤
│  Tab: Đăng Nhập | [Đăng Ký]                    │
│  ─────────────────                              │
│  Họ và tên *                                    │
│  Số điện thoại * (10 chữ số)                   │
│  E-mail (không bắt buộc)                        │
│  Mật khẩu * (hiện yêu cầu validation)          │
│    ☐ Ít nhất 8 ký tự                           │
│    ☐ Chứa chữ số                               │
│    ☐ Chứa chữ in hoa                           │
│  ☐ Đồng ý Điều khoản & Chính sách             │
│  [Tạo Tài Khoản Mới]                           │
│  ─────────────────                              │
│  Quay lại trang chủ                             │
└─────────────────────────────────────────────────┘
```

### API chi tiết

#### 4. Nút "Tạo Tài Khoản Mới"

```
POST /api/identity/auth/register
```

| Field | Type | Mô tả |
|-------|------|-------|
| `name` | string (body) | Họ và tên |
| `phone` | string (body) | Số điện thoại (10 chữ số) |
| `email` | string (body) | Email (optional) |
| `password` | string (body) | Mật khẩu (>= 8 ký tự, có số + chữ hoa) |

**Request mẫu:**
```json
{
  "name": "Trần Thị B",
  "phone": "0988123456",
  "email": "tranthib@gmail.com",
  "password": "MyPassword123"
}
```

**Response thành công:**
```json
{
  "success": true,
  "message": "Đăng ký thành công! Vui lòng xác thực OTP",
  "data": {
    "customer_id": 10,
    "phone": "0988123456",
    "otp_sent": true,
    "otp_expires_in": 300
  }
}
```

**Response lỗi (SĐT đã tồn tại):**
```json
{
  "success": false,
  "message": "Số điện thoại này đã được đăng ký"
}
```

---

#### 5. Xác thực OTP (sau khi đăng ký)

```
POST /api/identity/auth/verify-otp
```

| Field | Type | Mô tả |
|-------|------|-------|
| `phone` | string (body) | Số điện thoại đã đăng ký |
| `otp` | string (body) | Mã OTP 6 chữ số |

**Response thành công:**
```json
{
  "success": true,
  "message": "Xác thực thành công!",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "user": { "id": 10, "name": "Trần Thị B", "phone": "0988123456", "role": "customer" }
  }
}
```

---

#### 6. Gửi lại OTP

```
POST /api/identity/auth/send-otp
```

| Field | Type | Mô tả |
|-------|------|-------|
| `phone` | string (body) | Số điện thoại |
| `purpose` | string (body) | `register` / `forgot_password` |

---

## 📊 TỔNG HỢP API CẦN CHO 2 TRANG

| # | API Endpoint | Method | Service | Auth | Trang | Gọi khi |
|---|-------------|--------|---------|------|-------|---------|
| 1 | `/api/identity/auth/login` | POST | identity | No | login | Click "Đăng nhập ngay" |
| 2 | `/api/identity/auth/forgot-password` | POST | identity | No | login | Click "Quên mật khẩu?" |
| 3 | `/api/identity/auth/zalo/redirect` | GET | identity | No | login | Click "Đăng nhập Zalo" |
| 4 | `/api/identity/auth/zalo/callback` | GET | identity | No | login | Redirect từ Zalo |
| 5 | `/api/identity/auth/register` | POST | identity | No | register | Click "Tạo Tài Khoản" |
| 6 | `/api/identity/auth/verify-otp` | POST | identity | No | register | Submit OTP |
| 7 | `/api/identity/auth/send-otp` | POST | identity | No | register | Click "Gửi lại OTP" |
