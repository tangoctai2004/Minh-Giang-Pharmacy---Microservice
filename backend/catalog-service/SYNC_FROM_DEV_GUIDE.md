# Hướng dẫn đồng bộ Catalog Service từ `dev`

Mục tiêu: giúp các máy khác nhận **code + DB + service catalog** giống bản hiện tại trên `dev`.

---

## 1) Những gì đã thay đổi so với bản `dev` cũ

Các thay đổi lớn của Catalog trong đợt này:

- Bổ sung domain promotions trong `catalog-service` (DB-first).
- Bổ sung bảng mới trong `mg_catalog`:
  - `catalog_vouchers`
  - `catalog_gift_campaigns`
  - `catalog_loyalty_config`
  - `catalog_audit_logs`
  - `catalog_idempotency_keys`
- Bổ sung middleware:
  - RBAC chặt hơn
  - validation chuẩn hóa
  - request-id + metrics + logging chuẩn JSON
- Bổ sung test:
  - `smoke_test_catalog.sh`
  - `integration_test_catalog.sh`
- Bổ sung CI workflow:
  - `.github/workflows/catalog-service-ci.yml`

---

## 2) Chọn cách đồng bộ DB

### Cách A (khuyến nghị nếu cần giống 100% máy của bạn)
Clone DB trực tiếp từ máy nguồn bằng dump.

### Cách B (khuyến nghị nếu máy thành viên có dữ liệu riêng cần giữ)
Chạy migration idempotent + seed cần thiết để lên cùng version schema/service.

---

## 3) Cách A - Clone DB giống 100% máy nguồn

### Trên máy nguồn (máy của bạn)

```bash
cd "/Users/tangoctai/StudySpace/SOA.2026/Minh Giang Pharmacy"
docker exec -i minhgiang_mysql mysqldump -uroot -proot --databases mg_catalog > mg_catalog_from_dev.sql
```

Gửi file `mg_catalog_from_dev.sql` cho thành viên.

### Trên máy thành viên

```bash
cd "/path/to/Minh Giang Pharmacy"
git checkout dev
git pull origin dev

# Khôi phục DB y hệt máy nguồn
docker exec -i minhgiang_mysql mysql -uroot -proot < mg_catalog_from_dev.sql
```

Ưu điểm: dữ liệu, trạng thái voucher, mapping category, cấu hình... khớp tuyệt đối.

---

## 4) Cách B - Migration an toàn (không cần dump)

### Bước 1: đồng bộ code

```bash
cd "/path/to/Minh Giang Pharmacy"
git checkout dev
git pull origin dev
```

### Bước 2: cập nhật dependencies cho catalog

```bash
cd backend/catalog-service
npm install
cd ../..
```

### Bước 3: áp schema chính (cẩn thận reset)

File `infrastructure/database/02_mg_catalog.sql` có `DROP TABLE`.
Nếu bạn chấp nhận reset `mg_catalog`, chạy:

```bash
docker exec -i minhgiang_mysql mysql -uroot -proot < infrastructure/database/02_mg_catalog.sql
```

### Bước 4: áp seed danh mục (nếu frontend cần đúng menu/category)

```bash
docker exec -i minhgiang_mysql mysql -uroot -proot < infrastructure/database/99_seed_new_categories.sql
docker exec -i minhgiang_mysql mysql -uroot -proot < infrastructure/database/100_seed_final_categories.sql
```

### Bước 5: seed tối thiểu cho test CI/local

```bash
docker exec -i minhgiang_mysql mysql -uroot -proot < backend/catalog-service/scripts/ci_seed_minimal.sql
```

### Bước 6: restart service

```bash
docker compose restart catalog-service
```

---

## 5) Biến môi trường quan trọng

Mặc định bypass RBAC đang tắt.

- Chế độ bình thường:
  - **không** set `ALLOW_DEV_RBAC_BYPASS` hoặc để `false`
- Chỉ debug local:
  - `ALLOW_DEV_RBAC_BYPASS=true`

---

## 6) Kiểm tra sau đồng bộ (bắt buộc)

```bash
./backend/catalog-service/smoke_test_catalog.sh
./backend/catalog-service/integration_test_catalog.sh
```

Kỳ vọng:
- Smoke test: pass 100%
- Integration test: pass 100%

Kiểm tra thêm metrics:

```bash
curl -s http://localhost:8002/metrics
```

---

## 7) Checklist xác nhận “đã giống bản dev mới”

- [ ] Pull đúng branch `dev` mới nhất
- [ ] `npm install` trong `backend/catalog-service` thành công
- [ ] Có đủ 5 bảng mới của promotions/audit/idempotency
- [ ] `catalog-service` restart thành công
- [ ] Smoke test pass
- [ ] Integration test pass
- [ ] Frontend gọi được các API mới (`pos-search`, `inventory/stats`, `promotions/*`)

---

## 8) Khuyến nghị cho team

Nếu mục tiêu là **đồng nhất tuyệt đối giữa các máy**, dùng **Cách A (dump/restore)**.
Nếu mục tiêu là **giữ dữ liệu local riêng**, dùng **Cách B**, nhưng bắt buộc chạy test để xác nhận tương thích.
