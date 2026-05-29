# POS Catalog Handoff

Tài liệu này chốt phạm vi catalog service đang phục vụ màn POS.

## Phạm vi đã hoàn thiện

- POS search lấy dữ liệu động từ catalog.
- Tìm theo tên thuốc, SKU, hoạt chất, barcode sản phẩm.
- Barcode lookup trả `barcode_match` để POS biết match sản phẩm hay đơn vị bán.
- Barcode đơn vị bán đã sẵn sàng qua `product_units.barcode` nếu DB có dữ liệu.
- Danh mục POS lấy từ `categories/pos-tree`, có `product_count` và `in_stock_count`.
- Product card hiển thị ảnh, giá, tồn có thể bán, vị trí kệ, hạn dùng gần nhất, Rx badge.
- Cart dùng product thật, không dùng product mock trong runtime catalog.
- Cart hỗ trợ đổi đơn vị bán và chặn bán vượt tồn theo quy đổi.
- Detail modal hiển thị thông tin thuốc, đơn vị bán, barcode từng đơn vị, lô FEFO, cảnh báo Rx/gần hết hạn.
- Alternative drawer chỉ render dữ liệu thật từ API, không còn fallback mock.
- Checkout POS có giữ tồn tạm qua `stock_reservations` theo FEFO.

## API POS catalog chính

- `GET /products/pos-search?q=&barcode=&category_id=&limit=&offset=&in_stock=&requires_prescription=`
- `GET /products/barcode/:barcode`
- `GET /products/pos-detail/:id`
- `GET /products/:id/alternatives`
- `GET /categories/pos-tree`
- `GET /categories?for=pos`
- `GET /inventory/availability?product_ids=1,2,3`
- `POST /inventory/reservations`
- `POST /inventory/reservations/release`
- `POST /promotions/vouchers/validate`

Frontend khuyến nghị gọi qua gateway:

```txt
http://localhost:8000/api/catalog
```

Direct service để debug:

```txt
http://localhost:8002
```

## Contract quan trọng

`/products/pos-search` và `/products/barcode/:barcode` cần trả các field POS sau:

- `id`
- `sku`
- `barcode`
- `name`
- `price`
- `retail_price`
- `base_unit`
- `requires_prescription`
- `total_stock`
- `reserved_stock`
- `available_stock`
- `nearest_expiry`
- `location_name`
- `units`
- `sale_units`
- `warnings`
- `pos_flags`

`/products/barcode/:barcode` cần có:

```json
{
  "barcode_match": {
    "type": "product",
    "unit_name": "Hộp",
    "conversion_qty": 1
  }
}
```

Nếu barcode khớp đơn vị bán, `type` là `unit` và `unit_name` là đơn vị POS phải chọn sẵn.

## Dữ liệu DB cần có để test đủ

- `products.barcode`: barcode sản phẩm chính.
- `product_units.barcode`: barcode riêng cho đơn vị bán như Hộp/Vỉ/Viên.
- `batch_items.quantity_remaining`: tồn theo lô.
- `batch_items.expiry_date`: hạn dùng để test FEFO/gần hết hạn.
- `batch_items.status`: `available` hoặc `near_expiry` để được tính tồn bán.
- `products.requires_prescription`: thuốc kê đơn.
- `locations`: vị trí kệ/tủ/ngăn.

Không cần seed lại DB khi chỉ test UI bình thường, nhưng để test đủ unit barcode và gần hết hạn thì dữ liệu thật phải có các case trên.

## Checklist test thủ công trên POS

1. Mở `http://localhost:5500/pos/index.html`.
2. Tìm thuốc bằng tên.
3. Tìm thuốc bằng hoạt chất.
4. Nhập barcode sản phẩm rồi nhấn `Enter`.
5. Kiểm tra barcode tự add vào cart.
6. Với sản phẩm có nhiều đơn vị, đổi đơn vị bán trong cart.
7. Tăng số lượng quá tồn, POS phải chặn và báo tồn theo đơn vị.
8. Mở detail bằng long press trên product card.
9. Kiểm tra detail có barcode, SKU, hoạt chất, nhà sản xuất, số đăng ký, vị trí, lô FEFO.
10. Nếu thuốc Rx, card/cart/checkout phải hiển thị yêu cầu toa.
11. Nếu thuốc gần hết hạn, card/detail/cart phải hiển thị cảnh báo gần hạn.
12. Nếu sản phẩm hết hàng hoặc giữ tồn thất bại, alternative drawer phải chỉ hiển thị dữ liệu thật hoặc empty state.
13. Áp dụng voucher hợp lệ qua `promotions/vouchers/validate`.
14. Bấm thanh toán, POS phải giữ tồn tạm trước khi mở checkout.
15. Đóng checkout hoặc hoàn tất phải release hold tương ứng.

## Ranh giới service

Catalog chịu trách nhiệm:

- dữ liệu thuốc, danh mục, đơn vị bán;
- ảnh, giá, barcode, thuốc kê đơn;
- tồn khả dụng theo lô;
- hạn dùng/FEFO;
- giữ tồn tạm;
- gợi ý thuốc thay thế.

Order service chịu trách nhiệm:

- tạo order thật;
- thanh toán thật;
- hóa đơn;
- lịch sử đơn;
- hoàn/đổi trả;
- xác minh toa thuốc nếu cần workflow riêng.

POS frontend hiện đã dùng catalog đúng ranh giới trên. Phần `completeSale()` vẫn là luồng UI tạm, chưa tạo order thật.

## Lệnh kiểm tra

Chạy smoke:

```bash
npm run test:smoke
```

Chạy integration:

```bash
npm run test:integration
```

Nếu gọi qua gateway thay vì direct service:

```bash
CATALOG_BASE_URL=http://localhost:8000/api/catalog npm run test:smoke
```

