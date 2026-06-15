# Checklist phát hành Catalog Service

## 1) Cổng kiểm tra contract
- [ ] `FRONTEND_HANDOFF.md` đã cập nhật endpoint và field bắt buộc.
- [ ] Response list có `pagination.total/page/limit/pages/total_pages`.
- [ ] Không có endpoint trả thiếu `success`.

## 2) Cổng kiểm tra bảo mật và phân quyền
- [ ] Tất cả route ghi (POST/PUT/DELETE) đã gắn `requireRoles(['admin','manager'])`.
- [ ] Không bật `ALLOW_DEV_RBAC_BYPASS` trên staging/production.

## 3) Cổng kiểm tra validation
- [ ] Các route ghi đã có validation bắt buộc cho trường chính.
- [ ] Khoảng ngày hợp lệ (`valid_from <= valid_to`) cho promotions.
- [ ] Giá/số lượng không âm.

## 4) Cổng kiểm tra nghiệp vụ nhà thuốc
- [ ] Sản phẩm trả `requires_prescription` cho POS/client/detail.
- [ ] Inventory và alternatives chỉ tính stock từ lô `available|near_expiry`.
- [ ] Voucher validate xử lý đúng `active/expired/used_up`.

## 5) Cổng kiểm tra kiểm thử
- [ ] Chạy `./backend/catalog-service/smoke_test_catalog.sh` đạt 100%.
- [ ] Chạy `./backend/catalog-service/integration_test_catalog.sh` đạt 100%.

## 6) Cổng kiểm tra triển khai
- [ ] DB `mg_catalog` có bảng: `catalog_vouchers`, `catalog_gift_campaigns`, `catalog_loyalty_config`.
- [ ] Khởi động lại `catalog-service` sau migration.
- [ ] Log runtime không có lỗi SQL/500 ở các endpoint chính.
