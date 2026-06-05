# API Mapping — client/khai-truong.html

> **Trang**: Sự kiện khai trương nhà thuốc (Landing page)
> **Auth yêu cầu**: Không (public)
> **Ngày phân tích**: 2026-04-10
> **Cập nhật theo code hiện tại**: trang này chủ yếu có thể để static/CMS. Catalog hiện chưa có API public riêng cho khuyến mãi khai trương.

---

## Sơ đồ bố cục

```
┌────────────────────────────────────────────────────────┐
│  [Component] Header Banner + Top Bar + Main Header     │
├────────────────────────────────────────────────────────┤
│  Hero Banner gradient: Khai trương NTMG                │
│  Badge "SỰ KIỆN ĐẶC BIỆT", date 15/03/2026           │
├────────────────────────────────────────────────────────┤
│  Countdown Timer: Ngày | Giờ | Phút | Giây            │
├────────────────────────────────────────────────────────┤
│  Store Info: Google Map + Chi tiết chi nhánh           │
│  (Địa chỉ, Hotline, Giờ mở cửa, DS dược sĩ,          │
│   Giao hàng, Cam kết)                                  │
├────────────────────────────────────────────────────────┤
│  Highlights: 8 cards (Thuốc theo đơn, DS tư vấn,      │
│  Kiểm tra SK, Giá ưu đãi, Chuỗi HT, TPCN,            │
│  Dược mỹ phẩm, Đầy đủ DM)                              │
├────────────────────────────────────────────────────────┤
│  Promotions: 3 promo cards                             │
│  -50% Thuốc | -40% TPCN | Freeship                    │
│  Mỗi card có nút "Xem ngay" → category.html           │
├────────────────────────────────────────────────────────┤
│  Photo Gallery: 6 images grid 3x2                      │
├────────────────────────────────────────────────────────┤
│  CTA: "Đến ngay nhà thuốc" với 2 nút                  │
│  [Xem bản đồ] [Mua sắm online]                         │
├────────────────────────────────────────────────────────┤
│  Top Searches: 30 keyword links                         │
├────────────────────────────────────────────────────────┤
│  [Component] Promises + Newsletter + Footer            │
└────────────────────────────────────────────────────────┘
```

---

## Phân tích API chi tiết

> **Lưu ý**: Trang khai trương chủ yếu là landing page tĩnh. Tuy nhiên, nếu muốn quản lý nội dung qua CMS thì cần các API dưới đây. Ngày khai trương + countdown hiện đang hardcode trong JS.

### 1. Thông tin sự kiện khai trương

```
GET /api/cms/store-events?type=grand-opening&status=active
```

Lấy thông tin sự kiện khai trương đang hoạt động (nếu quản lý từ CMS).

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Khai trương Nhà Thuốc Minh Giang - Chi nhánh Cần Thơ",
    "event_date": "2026-03-15T08:00:00+07:00",
    "end_date": "2026-03-17T21:30:00+07:00",
    "address": "Tầng 4, Tòa nhà Minh Giang, 42 đường Mai Chí Thọ...",
    "phone": "1800 55 88 98",
    "opening_hours": "07h30 — 21h30 hàng ngày",
    "map_embed_url": "https://www.google.com/maps/embed?pb=...",
    "hero_subtitle": "Chi nhánh mới — Mang sức khỏe đến gần bạn hơn!",
    "highlights": [
      { "icon": "icon_thuoc_mua_theo_don.png", "title": "Thuốc theo đơn", "desc": "Hơn 10,000 loại thuốc..." },
      { "icon": "icon_duoc_si_tu_van.png", "title": "Dược sĩ tư vấn 24/7", "desc": "..." }
    ],
    "gallery_images": [
      { "url": "banner_slide_1.png", "caption": "Mặt tiền nhà thuốc Minh Giang" },
      { "url": "banner_slide_2.png", "caption": "Quầy tư vấn dược phẩm" }
    ]
  }
}
```

---

### 2. Danh sách khuyến mãi khai trương

```
GET /api/catalog/promotions/active
```

Trạng thái theo code hiện tại: **chưa có trong catalog-service**. API này đang được API Gateway whitelist public, nhưng backend chưa implement route tương ứng.

API có thể dùng tạm trong môi trường có token admin/manager:
```
GET /api/catalog/promotions/vouchers?status=active
```

Response của `/promotions/vouchers` là danh sách voucher, không phải promo card landing page. Nếu landing page cần card đẹp như thiết kế, nên lấy từ CMS hoặc hardcode cho demo.

**Response mong muốn nếu sau này implement `/promotions/active`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "title": "Giảm đến 50% toàn bộ Thuốc",
      "description": "Áp dụng cho hơn 500 sản phẩm thuốc OTC...",
      "discount_percent": 50,
      "banner_color": "red",
      "tag": "HOT",
      "cta_url": "/category.html?promo=10",
      "valid_from": "2026-03-15",
      "valid_to": "2026-03-17"
    },
    {
      "id": 11,
      "title": "Giảm 40% Thực phẩm chức năng",
      "description": "Vitamin, khoáng chất...",
      "discount_percent": 40,
      "banner_color": "orange",
      "tag": "MỚI",
      "cta_url": "/category.html?promo=11",
      "valid_from": "2026-03-15",
      "valid_to": "2026-03-17"
    },
    {
      "id": 12,
      "title": "Miễn phí giao hàng toàn thành phố",
      "description": "Không giới hạn đơn hàng tối thiểu...",
      "discount_percent": 0,
      "banner_color": "green",
      "tag": "FREESHIP",
      "cta_url": null,
      "valid_from": "2026-03-15",
      "valid_to": "2026-03-17"
    }
  ]
}
```

---

### 3. Top Searches (shared component)

```
GET /api/catalog/products/top-searches?limit=30
```

(Dùng chung với trang chủ và các trang khác)

---

### 4. Đăng ký newsletter (shared component)

```
POST /api/notification/newsletter/subscribe
```

**Body:**
```json
{ "email": "user@example.com" }
```

---

## 📊 TỔNG HỢP API

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/cms/store-events?type=grand-opening` | GET | cms | No | Page load |
| 2 | `/api/catalog/promotions/active` | GET | catalog | No | Page load, hiện chưa implement |
| 3 | `/api/catalog/products/top-searches?limit=30` | GET | catalog | No | Page load |
| 4 | `/api/notification/newsletter/subscribe` | POST | notification | No | Submit form |

> **Ghi chú theo code hiện tại**: `GET /api/catalog/promotions/active` đang được API Gateway whitelist public nhưng backend catalog-service chưa có route này. Nếu chưa implement thêm route mới, trang khai trương nên lấy voucher từ `GET /api/catalog/promotions/vouchers` khi có token admin/POS, hoặc để nội dung khuyến mãi từ CMS/hardcode cho demo.
