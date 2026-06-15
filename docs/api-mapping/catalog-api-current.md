# Catalog API Current Mapping

> **Mục đích**: Bản tổng hợp API catalog đúng theo code hiện tại.
> **Service thật**: `backend/catalog-service`
> **Gateway prefix**: `/api/catalog`
> **Lưu ý**: File này phản ánh hiện trạng code, không phải toàn bộ mong muốn tương lai.

---

## 1. API public cho client

Các API `GET /api/catalog/products...` và `GET /api/catalog/categories...` đang được API Gateway mở public.

File client hiện đang gọi thật:

- `frontend/assets/js/category-loader.js`
- `frontend/assets/js/product-loader.js`
- `frontend/assets/js/search-handler.js`
- `frontend/assets/js/search-page-loader.js`
- `frontend/assets/js/mega-menu-loader.js`
- `frontend/assets/js/cart-handler.js`

| Nhu cầu client hiện tại | API | Trạng thái backend |
|---|---|---|
| Danh sách sản phẩm | `GET /api/catalog/products` | Đã có |
| Bộ lọc sản phẩm | `GET /api/catalog/products/filters` | Đã có |
| Gợi ý tìm kiếm | `GET /api/catalog/products/search-suggest` | Đã có |
| Từ khóa tìm kiếm nhiều | `GET /api/catalog/products/top-searches` | Đã có |
| Chi tiết sản phẩm | `GET /api/catalog/products/{id}` | Đã có |
| Sản phẩm thay thế/tương tự | `GET /api/catalog/products/{id}/alternatives` | Đã có |
| Tìm theo mã vạch | `GET /api/catalog/products/barcode/{barcode}` | Đã có, trả đủ field cho POS |
| Danh mục | `GET /api/catalog/categories` | Đã có |
| Cây danh mục | `GET /api/catalog/categories/tree` | Đã có |
| Danh mục con | `GET /api/catalog/categories/{parent_id}/children` | Đã có |
| Lấy nhiều sản phẩm theo id | `GET /api/catalog/products?ids=1,2,3` | Đã có |
| Khuyến mãi public đang chạy | `GET /api/catalog/promotions/active` | Đã có |

Query quan trọng của `GET /products`:

`page`, `limit`, `ids`, `q`, `category_id`, `sub_category_id`, `brand_ids`, `price_min`, `price_max`, `origins`, `indications`, `requires_prescription`, `tag`, `exclude_id`, `status`, `sort`.

Chưa có nhưng client/mapping từng nhắc tới:

| API/nhu cầu | Trạng thái |
|---|---|
| `GET /api/catalog/products/{id}/reviews` | Chưa có |
| `POST /api/catalog/products/{id}/reviews` | Chưa có |

---

## 2. API admin catalog

Các API ghi dữ liệu cần role `admin` hoặc `manager` khi đi qua catalog-service.

### Products

| Nhu cầu | API | Trạng thái |
|---|---|---|
| Danh sách sản phẩm | `GET /api/catalog/products` | Đã có |
| Chi tiết sản phẩm | `GET /api/catalog/products/{id}` | Đã có |
| Tạo sản phẩm | `POST /api/catalog/products` | Đã có |
| Sửa sản phẩm | `PUT /api/catalog/products/{id}` | Đã có |
| Ẩn sản phẩm | `DELETE /api/catalog/products/{id}` | Đã có |

### Categories

| Nhu cầu | API | Trạng thái |
|---|---|---|
| Danh sách danh mục | `GET /api/catalog/categories` | Đã có |
| Cây danh mục | `GET /api/catalog/categories/tree` | Đã có |
| Danh mục con | `GET /api/catalog/categories/{parent_id}/children` | Đã có |
| Chi tiết danh mục | `GET /api/catalog/categories/{id}` | Đã có |
| Tạo danh mục | `POST /api/catalog/categories` | Đã có |
| Sửa danh mục | `PUT /api/catalog/categories/{id}` | Đã có |
| Ẩn danh mục | `DELETE /api/catalog/categories/{id}` | Đã có |

### Suppliers

| Nhu cầu | API | Trạng thái |
|---|---|---|
| Danh sách NCC | `GET /api/catalog/suppliers` | Đã có |
| Chi tiết NCC | `GET /api/catalog/suppliers/{id}` | Đã có |
| Tạo NCC | `POST /api/catalog/suppliers` | Đã có |
| Sửa NCC | `PUT /api/catalog/suppliers/{id}` | Đã có |
| Ẩn NCC | `DELETE /api/catalog/suppliers/{id}` | Đã có |

Chưa có: lịch sử phiếu nhập theo NCC, thanh toán công nợ, export NCC.

### Batches

| Nhu cầu | API | Trạng thái |
|---|---|---|
| Danh sách phiếu nhập | `GET /api/catalog/batches` | Đã có |
| Chi tiết phiếu nhập | `GET /api/catalog/batches/{id}` | Đã có |
| Tạo phiếu nhập | `POST /api/catalog/batches` | Đã có |
| Sửa phiếu nhập draft | `PUT /api/catalog/batches/{id}` | Đã có |

Chưa có: `/batches/inbound`, `/batches/outbound`, clearance, print, export.

### Inventory

| Nhu cầu | API | Trạng thái |
|---|---|---|
| Thống kê tồn kho | `GET /api/catalog/inventory/stats` | Đã có |
| Tồn kho theo sản phẩm | `GET /api/catalog/inventory` | Đã có, còn đơn giản |
| Tồn kho có thể bán | `GET /api/catalog/inventory/availability?product_ids=1,2,3` | Đã có |
| Tồn kho theo lô của sản phẩm | `GET /api/catalog/inventory/{productId}` | Đã có |

Chưa có: reservation, trừ kho, release stock, stock movement API, low-stock list, expiring list, audit/reconcile.

### Locations

| Nhu cầu | API | Trạng thái |
|---|---|---|
| Danh sách vị trí | `GET /api/catalog/locations` | Đã có |
| Chi tiết vị trí | `GET /api/catalog/locations/{id}` | Đã có |
| Tạo vị trí | `POST /api/catalog/locations` | Đã có |
| Sửa vị trí | `PUT /api/catalog/locations/{id}` | Đã có |
| Ẩn vị trí | `DELETE /api/catalog/locations/{id}` | Đã có |

Backend hiện dùng vị trí dạng phẳng: `zone`, `cabinet`, `shelf`, `label`. Chưa có route riêng cho zones/cabinets/shelves.

### Promotions

| Nhu cầu | API | Trạng thái |
|---|---|---|
| Thống kê khuyến mãi | `GET /api/catalog/promotions/stats` | Đã có |
| Khuyến mãi public đang chạy | `GET /api/catalog/promotions/active` | Đã có |
| Danh sách voucher | `GET /api/catalog/promotions/vouchers` | Đã có |
| Tạo voucher | `POST /api/catalog/promotions/vouchers` | Đã có |
| Sửa voucher | `PUT /api/catalog/promotions/vouchers/{id}` | Đã có |
| Tạm dừng/kích hoạt voucher | `PUT /api/catalog/promotions/vouchers/{id}/toggle` | Đã có |
| Reset lượt dùng | `PUT /api/catalog/promotions/vouchers/{id}/reset-usage` | Đã có |
| Kiểm tra voucher | `POST /api/catalog/promotions/vouchers/validate` | Đã có |
| Ghi nhận voucher đã dùng | `POST /api/catalog/promotions/vouchers/{id}/consume` | Đã có |
| Danh sách quà tặng | `GET /api/catalog/promotions/gifts` | Đã có |
| Tạo quà tặng | `POST /api/catalog/promotions/gifts` | Đã có |
| Sửa quà tặng | `PUT /api/catalog/promotions/gifts/{id}` | Đã có |
| Tạm dừng/kích hoạt quà tặng | `PUT /api/catalog/promotions/gifts/{id}/toggle` | Đã có |
| Clone quà tặng | `POST /api/catalog/promotions/gifts/{id}/clone` | Đã có |
| Lấy cấu hình tích điểm | `GET /api/catalog/promotions/loyalty/config` | Đã có |
| Sửa cấu hình tích điểm | `PUT /api/catalog/promotions/loyalty/config` | Đã có |
| Export khuyến mãi | `GET /api/catalog/promotions/export` | Đã có, đang trả JSON mock |

---

## 3. API catalog cho POS

| Nhu cầu POS | API | Trạng thái |
|---|---|---|
| Tìm nhanh sản phẩm | `GET /api/catalog/products/pos-search` | Đã có |
| Quét mã vạch | `GET /api/catalog/products/barcode/{barcode}` | Đã có, trả đủ field cho POS |
| Kiểm tra tồn có thể bán | `GET /api/catalog/inventory/availability?product_ids=...` | Đã có |
| Danh mục POS | `GET /api/catalog/categories?for=pos` | Chạy được, nhưng backend chưa xử lý riêng `for=pos` |
| Thuốc thay thế | `GET /api/catalog/products/{id}/alternatives` | Đã có |
| Kiểm tra voucher | `POST /api/catalog/promotions/vouchers/validate` | Đã có ở backend |

`/products/pos-search` hiện trả: `id`, `sku`, `barcode`, `name`, `price`, `base_unit`, `requires_prescription`, `image_url`, `category_id`, `category_name`, `total_stock`, `available_stock`, `in_stock`, `nearest_expiry`, `location_name`, `units`.

`/products/barcode/{barcode}` trả cùng nhóm field chính như POS search nhưng ở dạng 1 object trong `data`.

`/inventory/availability` trả: `product_id`, `sku`, `name`, `base_unit`, `total_stock`, `reserved_stock`, `available_stock`, `nearest_expiry`, `location_name`, `in_stock`.

Còn thiếu cho POS bán hàng thật:

- lô nên bán trước;

---

## 4. Các điểm lệch cần xử lý sau

| Vấn đề | Hướng xử lý |
|---|---|
| Backend có `POST /promotions/vouchers/validate` nhưng Gateway chưa public | Nếu client public cần gọi, thêm whitelist; nếu POS/admin gọi có token thì giữ nguyên |
| Mapping cũ dùng `/inventory/stock` | Dùng `/inventory` hiện tại hoặc thêm alias `/inventory/stock` |
| Mapping cũ dùng `/locations/zones/...` | Dùng `/locations` dạng phẳng hoặc implement hierarchy |
| Mapping cũ có `/catalog/audits...` | Chưa có route, cần implement sau |
