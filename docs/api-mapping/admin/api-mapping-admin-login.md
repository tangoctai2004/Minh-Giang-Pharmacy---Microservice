# API Mapping — admin/login.html

> **Trang**: Đăng nhập quản trị  
> **Auth yêu cầu**: Không (public)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────┐
│  Centered Card (440px)                   │
│                                          │
│  Logo + "Minh Giang Admin"               │
│  "Hệ thống Quản trị NT & E-commerce"    │
│                                          │
│  [Tên đăng nhập / SĐT] (text, required) │
│  [Mật khẩu] (password + eye toggle)      │
│  [✓ Lưu phiên đăng nhập] (checkbox)     │
│                                          │
│  [Đăng Nhập Quản Trị] (submit+spinner)  │
│  "Quên mật khẩu?" (link)                │
│                                          │
│  Error: "Sai tên đăng nhập hoặc mật khẩu"│
└──────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Đăng nhập quản trị

```
POST /api/identity/auth/admin/login
```

**Body:**
```json
{
  "username": "admin",
  "password": "********",
  "remember_me": true
}
```

**Response thành công:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "username": "admin",
      "full_name": "Nguyễn Admin",
      "role": "admin",
      "avatar_url": null
    },
    "expires_in": 86400
  }
}
```

**Response lỗi:**
```json
{
  "success": false,
  "error": { "code": "INVALID_CREDENTIALS", "message": "Sai tên đăng nhập hoặc mật khẩu" }
}
```

---

### 2. Quên mật khẩu

```
POST /api/identity/auth/admin/forgot-password
```

**Body:**
```json
{ "username": "admin" }
```

**Response:**
```json
{ "success": true, "message": "Link đặt lại mật khẩu đã gửi qua email" }
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/identity/auth/admin/login` | POST | identity | No | Submit form |
| 2 | `/api/identity/auth/admin/forgot-password` | POST | identity | No | Click "Quên mật khẩu" |
