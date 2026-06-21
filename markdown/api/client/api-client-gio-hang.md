# API Mapping — client/cart.html (Giỏ hàng)

> **Trang**: `frontend/client/cart.html`  
> **Mô tả**: Trang giỏ hàng — danh sách sản phẩm, điều chỉnh số lượng, voucher, tính tổng  
> **Auth yêu cầu**: Có (nếu không login → dùng localStorage, login → sync server)  
> **Ngày phân tích**: 2026-04-10

---

## 📐 Sơ đồ bố cục trang

```
┌─────────────────────────────────────────────────┐
│  [Component] Header Banner + Top Bar + Header   │
├─────────────────────────────────────────────────┤
│  Breadcrumb: Trang chủ > Giỏ hàng              │
├──────────────────────────┬──────────────────────┤
│  Cart Items Table        │  Price Summary       │
│  ☐ Chọn tất cả          │  Sidebar (phải)      │
│  ──────────────────      │                      │
│  ☐ SP1 (qty +/-) [🗑]  │  Tổng tiền SP        │
│  ☐ SP2 (qty +/-) [🗑]  │  Giảm giá SP         │
│  🎁 Quà tặng kèm        │  Giảm giá KM         │
│  ──────────────────      │  Phí vận chuyển      │
│  [Tiếp tục mua] [Xóa]   │  Tiết kiệm           │
│                          │  ─────────           │
│                          │  TỔNG TIỀN           │
│                          │  +121 điểm           │
│                          │                      │
│                          │  Voucher input       │
│                          │  [Áp dụng]           │
│                          │  KM đang áp dụng     │
│                          │                      │
│                          │  [Thanh toán]        │
├──────────────────────────┴──────────────────────┤
│  [Component] Promises + Newsletter + Footer     │
└─────────────────────────────────────────────────┘
```

---

## 🔌 CHI TIẾT API TỪNG VÙNG

---

### 1. Load giỏ hàng (Page load)

```
GET /api/order/cart
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "product_id": 201,
        "product_name": "Dung dịch vệ sinh Chilly Protect kháng khuẩn xanh",
        "product_sku": "MED-0201",
        "thumbnail": "/assets/images/product_frame.png",
        "original_price": 280000,
        "price": 247520,
        "quantity": 1,
        "subtotal": 247520,
        "in_stock": true,
        "max_quantity": 50,
        "promo_badge": null
      },
      {
        "id": 2,
        "product_id": 305,
        "product_name": "Thực phẩm bảo vệ sức khoẻ The Fucoidan (90 viên)",
        "product_sku": "SUP-0305",
        "thumbnail": "/assets/images/product_frame.png",
        "original_price": null,
        "price": 55000,
        "quantity": 1,
        "subtotal": 55000,
        "in_stock": true,
        "max_quantity": 20,
        "promo_badge": "Mua 1 tặng 1 nước súc miệng"
      }
    ],
    "gift_items": [
      {
        "product_name": "Nước súc miệng y tế Listerine 100ml",
        "thumbnail": "/assets/images/gift_listerine.png",
        "reason": "Quà tặng kèm cho đơn SP The Fucoidan"
      }
    ],
    "summary": {
      "total_items": 2,
      "subtotal": 302520,
      "product_discount": 38000,
      "promo_discount": 0,
      "shipping_fee": 0,
      "savings": 38000,
      "total": 264520,
      "loyalty_points_earn": 121
    },
    "applied_promotion": null
  }
}
```

---

### 2. Cập nhật số lượng sản phẩm (nút +/-)

**Hành vi**: Click + hoặc - → thay đổi quantity → recalculate tổng.

```
PUT /api/order/cart/items/{item_id}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `quantity` | int (body) | Số lượng mới |

**Request mẫu:**
```json
{ "quantity": 3 }
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "item": { "id": 1, "quantity": 3, "subtotal": 742560 },
    "summary": { "subtotal": 797560, "total": 759560, "loyalty_points_earn": 380 }
  }
}
```

---

### 3. Xóa sản phẩm khỏi giỏ (nút 🗑)

```
DELETE /api/order/cart/items/{item_id}
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Đã xóa sản phẩm khỏi giỏ hàng",
  "data": {
    "summary": { "total_items": 1, "subtotal": 55000, "total": 55000 }
  }
}
```

---

### 4. Xóa toàn bộ giỏ hàng (nút "Xóa giỏ hàng")

```
DELETE /api/order/cart
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Giỏ hàng đã được xóa"
}
```

---

### 5. Áp dụng mã Voucher

**Mô tả UI**: Input nhập mã voucher + nút "Áp dụng".

```
POST /api/order/cart/apply-voucher
```

| Field | Type | Mô tả |
|-------|------|-------|
| `voucher_code` | string (body) | Mã voucher |

**Request mẫu:**
```json
{ "voucher_code": "GIAMGIA50K" }
```

**Response thành công:**
```json
{
  "success": true,
  "message": "Áp dụng mã giảm giá thành công",
  "data": {
    "voucher": {
      "code": "GIAMGIA50K",
      "discount_type": "fixed",
      "discount_value": 50000,
      "description": "Giảm 50K cho đơn từ 200K"
    },
    "summary": {
      "subtotal": 302520,
      "promo_discount": 50000,
      "total": 214520
    }
  }
}
```

**Response lỗi:**
```json
{
  "success": false,
  "message": "Mã giảm giá không hợp lệ hoặc đã hết hạn"
}
```

---

### 6. Gỡ mã Voucher

```
DELETE /api/order/cart/voucher
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Đã gỡ mã giảm giá",
  "data": {
    "summary": { "promo_discount": 0, "total": 264520 }
  }
}
```

---

### 7. Nút "Tiến hành thanh toán"

**Hành vi**: Redirect sang `checkout.html`. Không gọi API riêng, nhưng cần validate giỏ hàng trước khi chuyển trang.

```
GET /api/order/cart/validate
```

**Response nếu OK:**
```json
{ "success": true, "data": { "valid": true } }
```

**Response nếu lỗi (hết hàng, thay đổi giá):**
```json
{
  "success": false,
  "data": {
    "valid": false,
    "issues": [
      { "item_id": 2, "type": "out_of_stock", "message": "Sản phẩm The Fucoidan đã hết hàng" },
      { "item_id": 1, "type": "price_changed", "message": "Giá Chilly đã thay đổi: 247,520đ → 260,000đ" }
    ]
  }
}
```

---

## 📊 TỔNG HỢP API CẦN CHO TRANG

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/order/cart` | GET | order | Yes* | Page load |
| 2 | `/api/order/cart/items/{item_id}` | PUT | order | Yes* | Click +/- quantity |
| 3 | `/api/order/cart/items/{item_id}` | DELETE | order | Yes* | Click 🗑 xóa item |
| 4 | `/api/order/cart` | DELETE | order | Yes* | Click "Xóa giỏ hàng" |
| 5 | `/api/order/cart/apply-voucher` | POST | order | Yes* | Click "Áp dụng" voucher |
| 6 | `/api/order/cart/voucher` | DELETE | order | Yes* | Click gỡ voucher |
| 7 | `/api/order/cart/validate` | GET | order | Yes* | Click "Tiến hành thanh toán" |
| 8 | `/api/cms/store-config/public` | GET | cms | No | Page load (header/footer) |
| 9 | `/api/catalog/categories/tree` | GET | catalog | No | Page load (mega menu) |
