# API Mapping — client/checkout.html (Thanh toán)

> **Trang**: `frontend/client/checkout.html`  
> **Mô tả**: Trang thanh toán — form địa chỉ, phương thức giao hàng, thanh toán, đặt hàng  
> **Auth yêu cầu**: Có (bắt buộc login mới checkout được)  
> **Ngày phân tích**: 2026-04-10

---

## 📐 Sơ đồ bố cục trang

```
┌─────────────────────────────────────────────────┐
│  [Component] Header Banner + Top Bar + Header   │
├──────────────────────────┬──────────────────────┤
│  Thông tin giao hàng     │  Order Summary       │
│  ☐ Anh / ☐ Chị         │  (sản phẩm × số lượng│
│  Họ tên *               │   + giá)              │
│  Số điện thoại *        │                      │
│  Email                   │  Voucher input       │
│  Tỉnh/Thành phố *      │  [Áp dụng]           │
│  Quận/Huyện *           │  KM đang áp dụng     │
│  Phường/Xã *            │                      │
│  Địa chỉ chi tiết *    │  Tổng tiền SP        │
│  ─────────────────       │  Giảm giá SP         │
│  Hình thức nhận hàng    │  Giảm giá KM         │
│  ☐ Giao tận nơi        │  Phí vận chuyển      │
│  ☐ Nhận tại nhà thuốc  │  Tiết kiệm           │
│  ─────────────────       │  ─────────           │
│  Ghi chú giao hàng      │  TỔNG TIỀN           │
│  ─────────────────       │  +121 điểm           │
│  ☐ Yêu cầu hóa đơn VAT│                      │
│  ─────────────────       │                      │
│  Phương thức thanh toán  │                      │
│  ☐ COD ☐ VNPay         │                      │
│  ☐ MoMo ☐ ZaloPay      │                      │
│  ─────────────────       │                      │
│  [Đặt hàng (242,000đ)] │                      │
├──────────────────────────┴──────────────────────┤
│  [Component] Footer                             │
└─────────────────────────────────────────────────┘
```

---

## 🔌 CHI TIẾT API TỪNG VÙNG

---

### 1. Load dữ liệu checkout (Page load)

**Mô tả**: Load giỏ hàng + thông tin user đã lưu (nếu có).

```
GET /api/order/cart
```

(Cùng API trang cart — lấy items + summary)

```
GET /api/identity/customers/me
```

(Lấy thông tin customer đã lưu: tên, SĐT, email, địa chỉ mặc định)

**Response customer:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Nguyễn Văn A",
    "phone": "0912345678",
    "email": "nguyenvana@gmail.com",
    "gender": "male",
    "default_address": {
      "province_id": 79,
      "province_name": "TP. Hồ Chí Minh",
      "district_id": 760,
      "district_name": "Quận 1",
      "ward_id": 26734,
      "ward_name": "Phường Bến Nghé",
      "address_detail": "128 Nguyễn Huệ"
    }
  }
}
```

---

### 2. Cascading Dropdown — Tỉnh/Quận/Phường

#### 2a. Danh sách Tỉnh/Thành phố

```
GET /api/identity/address/provinces
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 79, "name": "TP. Hồ Chí Minh" },
    { "id": 1, "name": "Hà Nội" },
    { "id": 48, "name": "Đà Nẵng" }
  ]
}
```

#### 2b. Danh sách Quận/Huyện theo Tỉnh

```
GET /api/identity/address/districts?province_id={id}
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 760, "name": "Quận 1" },
    { "id": 761, "name": "Quận 2" }
  ]
}
```

#### 2c. Danh sách Phường/Xã theo Quận

```
GET /api/identity/address/wards?district_id={id}
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    { "id": 26734, "name": "Phường Bến Nghé" },
    { "id": 26735, "name": "Phường Bến Thành" }
  ]
}
```

---

### 3. Tính phí vận chuyển

**Hành vi**: Sau khi chọn đủ Tỉnh/Quận/Phường → tính phí ship.

```
POST /api/order/checkout/shipping-fee
```

| Field | Type | Mô tả |
|-------|------|-------|
| `province_id` | int (body) | ID tỉnh |
| `district_id` | int (body) | ID quận |
| `ward_id` | int (body) | ID phường |
| `delivery_method` | string (body) | `delivery` hoặc `pickup` |

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "shipping_fee": 30000,
    "free_shipping_threshold": 300000,
    "is_free": false,
    "estimated_delivery": "2-3 ngày"
  }
}
```

---

### 4. Chọn nhận tại nhà thuốc — Danh sách cửa hàng

**Hành vi**: User chọn "Nhận tại nhà thuốc" → hiện danh sách chi nhánh gần nhất.

```
GET /api/cms/store-config/locations
```

**Response mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Nhà Thuốc Minh Giang — Chi nhánh chính",
      "address": "918 Ân Dương Vương, Phường Hoà Bình, Tỉnh Phú Thọ",
      "phone": "0982 493 356",
      "opening_hours": "7:00 - 22:00",
      "lat": 21.3230,
      "lng": 105.3970
    }
  ]
}
```

---

### 5. Áp dụng Voucher (nếu chưa áp dụng ở trang cart)

→ Cùng API trang cart:

```
POST /api/order/cart/apply-voucher
```

---

### 6. Đặt hàng (Nút "Đặt hàng")

**Hành vi**: Submit form → tạo đơn hàng → redirect sang trang order success.

```
POST /api/order/checkout
```

| Field | Type | Mô tả |
|-------|------|-------|
| `customer_name` | string (body) | Họ tên |
| `customer_phone` | string (body) | Số điện thoại |
| `customer_email` | string (body) | Email (optional) |
| `gender` | string (body) | `male` / `female` |
| `province_id` | int (body) | ID tỉnh |
| `district_id` | int (body) | ID quận |
| `ward_id` | int (body) | ID phường |
| `address_detail` | string (body) | Địa chỉ chi tiết |
| `delivery_method` | string (body) | `delivery` / `pickup` |
| `pickup_store_id` | int (body) | ID cửa hàng (nếu pickup) |
| `note` | string (body) | Ghi chú giao hàng |
| `payment_method` | string (body) | `cod`, `vnpay`, `momo`, `zalopay` |
| `require_vat_invoice` | boolean (body) | Có yêu cầu hóa đơn VAT |
| `vat_info` | object (body) | `{ company_name, tax_code, company_address, buyer_name }` (nếu VAT) |
| `voucher_code` | string (body) | Mã voucher (nếu có) |

**Request mẫu:**
```json
{
  "customer_name": "Nguyễn Văn A",
  "customer_phone": "0912345678",
  "customer_email": "a@gmail.com",
  "gender": "male",
  "province_id": 79,
  "district_id": 760,
  "ward_id": 26734,
  "address_detail": "128 Nguyễn Huệ",
  "delivery_method": "delivery",
  "note": "Giao giờ hành chính",
  "payment_method": "vnpay",
  "require_vat_invoice": false,
  "voucher_code": null
}
```

**Response thành công (COD):**
```json
{
  "success": true,
  "message": "Đặt hàng thành công",
  "data": {
    "order_id": 100,
    "order_code": "WEB-260410-100",
    "total": 242000,
    "payment_method": "cod",
    "estimated_delivery": "2-3 ngày",
    "redirect_url": null
  }
}
```

**Response thành công (VNPay/MoMo/ZaloPay):**
```json
{
  "success": true,
  "message": "Đặt hàng thành công, chuyển sang cổng thanh toán",
  "data": {
    "order_id": 101,
    "order_code": "WEB-260410-101",
    "total": 242000,
    "payment_method": "vnpay",
    "redirect_url": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_..."
  }
}
```

**Ghi chú**: Nếu `payment_method` không phải `cod`, frontend sẽ redirect user sang `redirect_url` để thanh toán.

---

### 7. Callback sau thanh toán online

**Mô tả**: Sau khi user thanh toán xong trên VNPay/MoMo → redirect về trang kết quả.

```
GET /api/order/checkout/payment-callback?vnp_ResponseCode=00&vnp_TxnRef=...
```

(Backend xử lý, verify signature, cập nhật payment_transactions, redirect sang trang order success)

---

## 📊 TỔNG HỢP API CẦN CHO TRANG

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|-------------|--------|---------|------|---------|
| 1 | `/api/order/cart` | GET | order | Yes | Page load |
| 2 | `/api/identity/customers/me` | GET | identity | Yes | Page load (prefill form) |
| 3 | `/api/identity/address/provinces` | GET | identity | No | Page load |
| 4 | `/api/identity/address/districts?province_id=X` | GET | identity | No | Chọn tỉnh |
| 5 | `/api/identity/address/wards?district_id=X` | GET | identity | No | Chọn quận |
| 6 | `/api/order/checkout/shipping-fee` | POST | order | Yes | Chọn đủ địa chỉ |
| 7 | `/api/cms/store-config/locations` | GET | cms | No | Chọn "Nhận tại NT" |
| 8 | `/api/order/cart/apply-voucher` | POST | order | Yes | Click "Áp dụng" voucher |
| 9 | `/api/order/checkout` | POST | order | Yes | Click "Đặt hàng" |
| 10 | `/api/order/checkout/payment-callback` | GET | order | No | Redirect từ payment gateway |
