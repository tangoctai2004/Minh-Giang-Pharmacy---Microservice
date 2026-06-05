# API Mapping — admin/audits.html

> **Trang**: Kiểm Kê Tồn Kho
> **Auth yêu cầu**: Có token admin/manager khi gọi qua API Gateway
> **Cập nhật theo code hiện tại**: database đã có bảng kiểm kê, nhưng catalog-service hiện chưa mount route `/api/catalog/audits`.

---

## Trạng thái hiện tại

Trang kiểm kê hiện **chưa có API backend catalog tương ứng**.

Các API trong bản thiết kế cũ nhưng **chưa có trong backend hiện tại**:

| API | Trạng thái |
|---|---|
| `GET /api/catalog/audits` | Chưa có |
| `GET /api/catalog/audits/system-data` | Chưa có |
| `POST /api/catalog/audits` | Chưa có |
| `PUT /api/catalog/audits/{id}/reconcile` | Chưa có |
| `GET /api/catalog/locations/zones` | Chưa có |

API có thể dùng tạm:

| Nhu cầu | API hiện có | Ghi chú |
|---|---|---|
| Quét mã vạch tìm sản phẩm | `GET /api/catalog/products/barcode/{barcode}` | Đã có |
| Xem tồn kho theo sản phẩm | `GET /api/catalog/inventory/{productId}` | Đã có |
| Xem danh sách vị trí dạng phẳng | `GET /api/catalog/locations` | Đã có |

---

## API nên implement ở giai đoạn sau

### 1. Danh sách phiếu kiểm kê

```http
GET /api/catalog/audits?page=1&limit=20&location_id={id}&status={status}&month={YYYY-MM}
```

### 2. Tải dữ liệu hệ thống để lập phiếu

```http
GET /api/catalog/audits/system-data?location_id={id}
```

### 3. Lưu phiếu kiểm kê

```http
POST /api/catalog/audits
```

### 4. Hoàn tất đối soát và cập nhật tồn kho

```http
PUT /api/catalog/audits/{id}/reconcile
```

---

## Tổng hợp API đúng với code hiện tại

| # | API Endpoint | Method | Service | Auth | Gọi khi |
|---|---|---|---|---|---|
| 1 | `/api/catalog/products/barcode/{barcode}` | GET | catalog | Yes | Quét mã vạch |
| 2 | `/api/catalog/inventory/{productId}` | GET | catalog | Yes | Xem tồn theo lô của sản phẩm |
| 3 | `/api/catalog/locations` | GET | catalog | Yes | Chọn vị trí dạng phẳng |

---

## Ghi chú cho nhóm

Không nên nối giao diện `admin/audits.html` vào các endpoint `/api/catalog/audits...` ở thời điểm hiện tại, vì backend chưa có route này. Nếu cần demo nhanh, có thể giữ màn hình ở trạng thái mock. Nếu muốn làm thật, cần bổ sung route kiểm kê trong catalog-service.
