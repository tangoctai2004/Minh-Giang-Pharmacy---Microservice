# Catalog Service

Service quản lý dữ liệu thuốc, danh mục, tồn kho, lô hàng, nhà cung cấp, vị trí kệ và khuyến mãi.

## Cấu trúc thư mục

- `index.js`: điểm khởi động service.
- `routes/`: route tổng, gắn các nhóm API con.
- `products/`, `categories/`, `inventory/`, `batches/`, `suppliers/`, `locations/`, `promotions/`: API theo từng mảng nghiệp vụ.
- `middlewares/`: xác thực gateway, phân quyền, validate, logging/metrics.
- `services/`: logic dùng chung giữa các route.
- `db/`: kết nối database.
- `utils/`: tiện ích nhỏ.
- `tests/`: smoke test, integration test và dữ liệu seed tối thiểu cho CI.
- `docs/`: tài liệu bàn giao, đồng bộ và checklist phát hành.

## Lệnh thường dùng

```bash
npm install
npm run dev
npm run test:smoke
npm run test:integration
```

Không commit `node_modules`; cài lại bằng `npm install` hoặc `npm ci`.
