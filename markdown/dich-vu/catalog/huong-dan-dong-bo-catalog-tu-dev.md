# Đồng bộ Catalog Service từ nhánh `dev`

Tài liệu này dành cho thành viên cần kéo bản `dev` mới nhất và dựng lại dữ liệu catalog/local demo đúng với cấu trúc hiện tại của repo.

## 1. Đồng bộ code

```bash
git checkout dev
git pull origin dev
```

Nếu chạy bằng Docker Compose, khởi động lại service:

```bash
docker compose up -d --build catalog-service
```

## 2. Đồng bộ database khuyến nghị

Repo hiện dùng pipeline database chung tại `infrastructure/database/run_all.sh`. Script này tạo lại 5 schema:

- `mg_identity`
- `mg_catalog`
- `mg_order`
- `mg_cms`
- `mg_notification`

và nạp seed theo thứ tự trong `infrastructure/database/schemas/` và `infrastructure/database/seeds/`.

Chạy từ thư mục gốc dự án:

```bash
bash infrastructure/database/run_all.sh
```

Lưu ý: script có tính chất rebuild demo DB. Không chạy trên production DB nếu chưa backup.

## 3. Nếu chỉ cần xem schema catalog

File schema hiện tại:

```text
infrastructure/database/schemas/02_mg_catalog.sql
```

File seed catalog chính:

```text
infrastructure/database/seeds/01_seed_full_catalog.sql
infrastructure/database/seeds/02_seed_clean_catalog_products.sql
infrastructure/database/seeds/06_seed_product_tag_promotions.sql
```

## 4. Kiểm tra catalog service

```bash
curl -s http://localhost:8002/health
curl -s http://localhost:8002/metrics
```

Chạy test service nếu database và service đã sẵn sàng:

```bash
./backend/catalog-service/tests/smoke.sh
./backend/catalog-service/tests/integration.sh
```

## 5. Checklist

- [ ] Đang ở nhánh `dev` mới nhất.
- [ ] Docker Desktop/MySQL container đang chạy.
- [ ] `bash infrastructure/database/run_all.sh` chạy xong không lỗi.
- [ ] `catalog-service` trả `/health`.
- [ ] Smoke/integration test catalog pass.
