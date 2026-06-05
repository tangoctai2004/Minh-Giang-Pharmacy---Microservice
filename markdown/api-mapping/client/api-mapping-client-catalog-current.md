# API Mapping — Client Catalog Current Calls

> **Mục đích**: Ghi lại đúng các API catalog mà frontend client hiện đang gọi thật.
> **Phạm vi**: Chỉ đọc code trong `frontend/client` và `frontend/assets/js`.
> **Nguyên tắc**: Không yêu cầu sửa code client. Nếu backend chưa hỗ trợ đúng, ghi rõ là backend cần đáp ứng sau.

---

## 1. Trang danh mục `category.html`

File gọi API: `frontend/assets/js/category-loader.js`

| Nhu cầu | API client đang gọi |
|---|---|
| Lấy cây danh mục | `GET /api/catalog/categories/tree` |
| Lấy bộ lọc | `GET /api/catalog/products/filters?category_id={categoryId}` |
| Lấy danh sách sản phẩm | `GET /api/catalog/products?category_id={id}&page={page}&limit={limit}&sort={sort}` |
| Lọc theo giá | Thêm `price_min`, `price_max` |
| Lọc theo hãng | Thêm `brand_ids=1,2,3` |
| Lọc theo xuất xứ | Thêm `origins=Việt Nam,Hàn Quốc` |
| Lọc theo công dụng | Thêm `indications=...` |
| Lọc thuốc kê đơn/không kê đơn | Thêm `requires_prescription=0` hoặc `1` |

Giá trị mặc định client đang dùng:

```text
category_id = id trên URL, nếu không có thì 1000
page = 1
limit = 28
sort = popular
requires_prescription = 0
```

---

## 2. Trang chi tiết sản phẩm `product.html`

File gọi API: `frontend/assets/js/product-loader.js`

| Nhu cầu | API client đang gọi |
|---|---|
| Chi tiết sản phẩm | `GET /api/catalog/products/{id}` |
| Sản phẩm thay thế/tương tự | `GET /api/catalog/products/{id}/alternatives` |
| Fallback sản phẩm cùng danh mục | `GET /api/catalog/products?category_id={categoryId}&limit=5&exclude_id={id}` |
| Sản phẩm phổ biến | `GET /api/catalog/products?limit=6&sort=popular` |
| Từ khóa tìm kiếm nhiều | `GET /api/catalog/products/top-searches` |
| Sản phẩm trending | `GET /api/catalog/products?limit=15&sort=trending` |
| Sản phẩm vừa xem, cách 1 | `GET /api/catalog/products?limit=15&ids={id1,id2,id3}` |
| Sản phẩm vừa xem, cách 2 | Gọi nhiều lần `GET /api/catalog/products/{id}` |

Ghi chú quan trọng:

- Code hiện có 2 hàm `renderRecentlyViewed`. Hàm khai báo sau sẽ ghi đè hàm trước trong runtime JavaScript.
- Vì vậy hiện tại client nhiều khả năng đang dùng cách gọi từng sản phẩm: `GET /products/{id}`.
- Tuy nhiên trong code vẫn có lời gọi `GET /products?ids=...`. Nếu sau này dọn code hoặc đổi thứ tự hàm, backend nên hỗ trợ `ids` để không lỗi.

---

## 3. Gợi ý tìm kiếm trên header

File gọi API: `frontend/assets/js/search-handler.js`

| Nhu cầu | API client đang gọi |
|---|---|
| Gợi ý tìm kiếm khi user gõ từ khóa | `GET /api/catalog/products/search-suggest?q={keyword}` |

Client mong response có:

```json
{
  "success": true,
  "data": {
    "products": [],
    "categories": []
  }
}
```

Với `products`, client đang dùng các trường: `id`, `name`, `image_url`, `retail_price`.

Với `categories`, client đang dùng: `id`, `name`.

---

## 4. Trang kết quả tìm kiếm `search.html`

File gọi API: `frontend/assets/js/search-page-loader.js`

| Nhu cầu | API client đang gọi |
|---|---|
| Tìm sản phẩm theo từ khóa | `GET /api/catalog/products?q={query}&page={page}&limit=28&sort={sort}` |

Giá trị mặc định:

```text
page = query trên URL, nếu không có thì 1
sort = popular
limit = 28
```

Client đang dùng `pagination.total`, `pagination.page`, `pagination.pages`.

---

## 5. Mega menu

File gọi API: `frontend/assets/js/mega-menu-loader.js`

| Nhu cầu | API client đang gọi |
|---|---|
| Lấy cây danh mục cho menu | `GET /api/catalog/categories/tree` |
| Lấy 4 sản phẩm bán chạy trong danh mục | `GET /api/catalog/products?category_id={categoryId}&limit=4&sort=best_seller` |

---

## 6. Giỏ hàng localStorage

File gọi API: `frontend/assets/js/cart-handler.js`

| Nhu cầu | API client đang gọi |
|---|---|
| Lấy snapshot sản phẩm trước khi thêm vào giỏ localStorage | `GET /api/catalog/products/{productId}` |

Ghi chú:

- Client chưa gọi order-service cart thật.
- Giỏ hàng hiện vẫn dùng localStorage.

---

## 7. Danh sách API catalog client đang cần backend đáp ứng

| # | API | Đang có trong backend hiện tại |
|---|---|---|
| 1 | `GET /api/catalog/categories/tree` | Có |
| 2 | `GET /api/catalog/products/filters?category_id=...` | Có |
| 3 | `GET /api/catalog/products?...` | Có |
| 4 | `GET /api/catalog/products/{id}` | Có |
| 5 | `GET /api/catalog/products/{id}/alternatives` | Có |
| 6 | `GET /api/catalog/products/top-searches` | Có |
| 7 | `GET /api/catalog/products/search-suggest?q=...` | Có |
| 8 | `GET /api/catalog/products?ids=1,2,3` | Chưa có rõ ràng, nhưng client code có nhắc tới |

---

## 8. Kết luận cho bước tiếp theo

Nếu giữ nguyên code client, backend catalog nên ưu tiên đáp ứng đủ các API trên. Điểm lệch đáng chú ý nhất là `GET /products?ids=...`; các API còn lại về cơ bản đã khớp với client.
