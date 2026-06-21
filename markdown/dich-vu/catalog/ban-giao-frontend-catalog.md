# Tài liệu bàn giao Frontend cho Catalog Service

## Địa chỉ API gốc
- Gọi trực tiếp service: `http://localhost:8002`
- Gọi qua gateway (khuyến nghị cho frontend): `http://localhost:8000/api/catalog`

## Quy tắc xác thực
- Các endpoint công khai:
  - `GET /products`
  - `GET /products/:id`
  - `GET /categories`
  - `GET /categories/tree`
  - `GET /categories/:parent_id/children`
  - `GET /products/pos-search`
  - `GET /products/barcode/:barcode`
  - `GET /products/pos-detail/:id`
  - `GET /categories/pos-tree`
  - `POST /promotions/vouchers/validate`
- Các endpoint ghi dữ liệu (admin) bắt buộc có role từ gateway:
  - `x-user-role: admin|manager`

## Chuẩn phản hồi API
- Thành công:
  - `{ "success": true, "data": ... }`
- Danh sách có phân trang:
  - `{ "success": true, "data": [...], "pagination": { "total", "page", "limit", "pages", "total_pages" } }`
- Lỗi:
  - `{ "success": false, "message": "..." }`

## Contract field chuẩn (khóa để FE tích hợp)
- Danh sách sản phẩm:
  - Bắt buộc: `id`, `sku`, `name`, `retail_price`, `price`, `base_unit`, `in_stock`, `total_stock`, `requires_prescription`, `image_url`
- Chi tiết sản phẩm:
  - Bắt buộc: `id`, `sku`, `name`, `category`, `brand`, `retail_price`, `base_unit`, `requires_prescription`, `units`, `specifications`, `total_stock`, `in_stock`
- Tìm kiếm POS:
  - Bắt buộc: `id`, `sku`, `barcode`, `name`, `price`, `base_unit`, `total_stock`, `reserved_stock`, `available_stock`, `in_stock`, `requires_prescription`, `nearest_expiry`, `location_name`, `units`, `sale_units`, `warnings`, `pos_flags`
- Quét barcode POS:
  - Bắt buộc: các field như POS search và `barcode_match`
  - `barcode_match.type`: `product` hoặc `unit`
  - `barcode_match.unit_name`: đơn vị bán POS cần chọn sẵn nếu match barcode đơn vị bán
- Chi tiết POS:
  - Bắt buộc: `sale_units`, `warnings`, `pos_flags`, `batches`, `category`, `brand`, `available_stock`
- Thống kê tồn kho:
  - Bắt buộc: `total_products`, `in_stock_products`, `out_of_stock_products`, `low_stock_products`, `near_expiry_batches`, `expired_batches`
- Kiểm tra voucher:
  - Bắt buộc: `code`, `discount_amount`, `message`

## Các endpoint chính cho frontend
- Sản phẩm:
  - `GET /products`
  - `GET /products?ids=1,2,3`
  - `GET /products/:id`
  - `GET /products/barcode/:barcode`
  - `GET /products/pos-search`
  - `GET /products/pos-detail/:id`
  - `GET /products/:id/alternatives`
- Danh mục:
  - `GET /categories`
  - `GET /categories/tree`
  - `GET /categories/pos-tree`
  - `GET /categories?for=pos`
  - `GET /categories/:parent_id/children`
- Tồn kho:
  - `GET /inventory/stats`
  - `GET /inventory`
  - `GET /inventory/availability?product_ids=1,2,3`
  - `POST /inventory/reservations`
  - `POST /inventory/reservations/release`
  - `GET /inventory/:productId`
- Khuyến mãi:
  - `GET /promotions/active`
  - `GET /promotions/stats`
  - `GET /promotions/vouchers`
  - `POST /promotions/vouchers`
  - `PUT /promotions/vouchers/:id`
  - `PUT /promotions/vouchers/:id/toggle`
  - `PUT /promotions/vouchers/:id/reset-usage`
  - `POST /promotions/vouchers/:id/consume`
  - `POST /promotions/vouchers/validate`
  - `GET /promotions/gifts`
  - `POST /promotions/gifts`
  - `PUT /promotions/gifts/:id`
  - `PUT /promotions/gifts/:id/toggle`
  - `POST /promotions/gifts/:id/clone`
  - `GET /promotions/loyalty/config`
  - `PUT /promotions/loyalty/config`
  - `GET /promotions/export`

## Kiểm tra nhanh
- Checklist riêng cho POS catalog:
  - `markdown/dich-vu/catalog/ban-giao-pos-catalog.md`
- Chạy smoke test:
  - `./backend/catalog-service/tests/smoke.sh`

## Lưu ý quan trọng
- Cơ chế bỏ qua RBAC cho debug local đang tắt mặc định.
- Nếu cần cho phép gọi route ghi tại local mà không có role từ gateway (chỉ để debug):
  - `ALLOW_DEV_RBAC_BYPASS=true`
- Nghiệp vụ GPP cốt lõi đã khóa:
  - sản phẩm kê đơn luôn trả `requires_prescription` để order-service/POS chặn checkout thiếu toa.
  - barcode đơn vị bán dùng `product_units.barcode`; nếu DB chưa có dữ liệu này thì POS vẫn chạy barcode sản phẩm chính bình thường.
  - tồn kho tính theo `batch_items` có trạng thái `available|near_expiry`.
  - POS/Order giữ hàng bằng `stock_reservations`, luôn giữ theo FEFO và phải release khi huỷ/hoàn tất.
  - voucher tự đánh giá `expired/used_up` theo hạn dùng và usage limit.
