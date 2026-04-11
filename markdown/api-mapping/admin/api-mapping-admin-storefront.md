# API Mapping — admin/storefront.html

> **Trang**: Cấu hình giao diện Web (Banners, Delivery, Store Info, Settings)  
> **Auth yêu cầu**: Có (Admin)  
> **Ngày phân tích**: 2026-04-10

---

## Sơ đồ bố cục

```
┌──────────────────────────────────────────────────────────────────┐
│  [Sidebar] + [Header]                                            │
├──────────────────────────────────────────────────────────────────┤
│  4 Stat Cards:                                                   │
│  Banner HĐ(5)|Bán kính GH(8km)|Người giao(3)|Cài đặt HĐ(8)    │
├──────────────────────────────────────────────────────────────────┤
│  Tabs: [Banner & Slider] [Giao Hàng] [Thông Tin NT] [Cài Đặt]  │
│  Actions: [Hoàn tác] [Lưu tất cả]                               │
├──────────────────────────────────────────────────────────────────┤
│  TAB 1 — Banner:                                                 │
│  Hero slider (reorder Up/Down, edit, hide)                       │
│  Mini promo banners (Flash Sale left + Thuốc mới right)          │
│  [Thêm Slide Mới]                                                │
├──────────────────────────────────────────────────────────────────┤
│  TAB 2 — Giao Hàng:                                             │
│  Left: Zone visual circle 8km|Bán kính|Phí GH|Miễn phí từ       │
│        Time slot grid (6 slots, toggleable)                      │
│        COD settings (toggle, deposit, max)                       │
│  Right: Staff list (3 people) + [Thêm]                           │
├──────────────────────────────────────────────────────────────────┤
│  TAB 3 — Thông Tin:                                              │
│  Left: Tên NT*|Địa chỉ*|GPKD|Phone|Email|Giờ MĐ|Ngày nghỉ     │
│  Right: Maps (Lat/Lng)|Social (FB/TikTok/YouTube)                │
├──────────────────────────────────────────────────────────────────┤
│  TAB 4 — Cài Đặt:                                               │
│  Left: 8 Feature toggles                                         │
│  Right: Payment methods + Notification settings                   │
├──────────────────────────────────────────────────────────────────┤
│  MODAL Banner: Upload image|Alt|Link URL|Date range               │
│  MODAL Staff: Họ tên*|Quan hệ|SĐT|Phương tiện|TT               │
└──────────────────────────────────────────────────────────────────┘
```

---

## API chi tiết

### 1. Lấy toàn bộ cấu hình storefront

```
GET /api/cms/store-config
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "banners": {
      "hero_slides": [
        { "id": 1, "image_url": "...", "alt": "Banner khai trương", "link_url": "/khai-truong", "order": 1, "active": true, "valid_from": "2026-03-01", "valid_to": "2026-04-01" }
      ],
      "promo_left": { "title": "Flash Sale", "link_url": "/category?promo=flash" },
      "promo_right": { "title": "Thuốc Mới Về", "link_url": "/category?tag=new" }
    },
    "delivery": {
      "max_radius_km": 8,
      "shipping_fee": 15000,
      "free_shipping_threshold": 300000,
      "time_slots": [
        { "slot": "07:00-10:00", "enabled": true },
        { "slot": "10:00-14:00", "enabled": true },
        { "slot": "14:00-17:00", "enabled": true },
        { "slot": "17:00-20:00", "enabled": true },
        { "slot": "20:00-22:00", "enabled": false },
        { "slot": "Express (1h)", "enabled": true }
      ],
      "cod_enabled": true,
      "cod_deposit_required": true,
      "max_cod_value": 5000000
    },
    "store_info": {
      "name": "Nhà Thuốc Minh Giang",
      "address": "42 Mai Chí Thọ, Hưng Phú, Cần Thơ",
      "business_license": "GPKD-0012345",
      "phone": "1800 55 88 98",
      "email": "info@minhgiang.vn",
      "hours_open": "07:30",
      "hours_close": "21:30",
      "operating_days": "Thứ 2 - Chủ nhật",
      "lat": 10.031,
      "lng": 105.756,
      "social": {
        "facebook": "https://fb.com/minhgiang",
        "tiktok": "",
        "youtube": ""
      }
    },
    "settings": {
      "show_prices": true,
      "allow_orders": true,
      "show_stock": false,
      "allow_reviews": true,
      "loyalty_enabled": true,
      "zalo_chat": true,
      "zalo_notifications": true,
      "maintenance_mode": false,
      "payment_methods": {
        "cod": true,
        "vnpay": true,
        "momo": false,
        "zalopay": false
      },
      "notification_recipients": {
        "phone": "0909888777",
        "email": "admin@minhgiang.vn"
      }
    },
    "delivery_staff": [
      { "id": 1, "name": "Nguyễn Văn D", "relation": "Nhân viên", "phone": "0909111222", "vehicle": "motorcycle", "status": "available" }
    ]
  }
}
```

---

### 2. Lưu toàn bộ cấu hình

```
PUT /api/cms/store-config
```

Body tương tự response trên (gửi toàn bộ hoặc từng section).

---

### 3. Thêm hero slide

```
POST /api/cms/store-config/banners/slides
```

**Body:**
```json
{
  "image_url": "...",
  "alt": "Banner mới",
  "link_url": "/product/abc",
  "valid_from": "2026-03-01",
  "valid_to": "2026-04-01"
}
```

---

### 4. Cập nhật banner slide (reorder, edit, hide)

```
PUT /api/cms/store-config/banners/slides/{id}
```

**Body:**
```json
{ "order": 2, "active": false }
```

---

### 5. Upload banner image

```
POST /api/cms/media/upload
Content-Type: multipart/form-data
```

(Dùng chung API media upload, khuyến nghị 1200×400px)

---

### 6. Thêm nhân viên giao hàng

```
POST /api/cms/store-config/delivery-staff
```

**Body:**
```json
{
  "name": "Trần Văn E",
  "relation": "Cộng tác viên",
  "phone": "0909333444",
  "vehicle": "motorcycle",
  "status": "available"
}
```

---

### 7. Cập nhật nhân viên giao hàng

```
PUT /api/cms/store-config/delivery-staff/{id}
```

---

### 8. Cập nhật promo banners

```
PUT /api/cms/store-config/banners/promo
```

**Body:**
```json
{
  "promo_left": { "title": "Flash Sale", "link_url": "/category?promo=flash", "image_url": "..." },
  "promo_right": { "title": "Thuốc Mới Về", "link_url": "/category?tag=new", "image_url": "..." }
}
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/cms/store-config` | GET | cms | Yes | Page load |
| 2 | `/api/cms/store-config` | PUT | cms | Yes | Click "Lưu tất cả" |
| 3 | `/api/cms/store-config/banners/slides` | POST | cms | Yes | Thêm slide |
| 4 | `/api/cms/store-config/banners/slides/{id}` | PUT | cms | Yes | Edit/reorder/hide slide |
| 5 | `/api/cms/media/upload` | POST | cms | Yes | Upload banner image |
| 6 | `/api/cms/store-config/delivery-staff` | POST | cms | Yes | Thêm NV giao hàng |
| 7 | `/api/cms/store-config/delivery-staff/{id}` | PUT | cms | Yes | Edit NV giao hàng |
| 8 | `/api/cms/store-config/banners/promo` | PUT | cms | Yes | Cập nhật promo banners |
