# Clean Data Review

Thu muc nay la ket qua lam sach du lieu crawl, chua phai SQL seed va chua duoc import vao database.

## Files

- `products.clean.jsonl`: san pham da qua rule clean, co category DB, anh san pham hop le, gia va mo ta co the dung duoc.
- `products.needs_review.jsonl`: tap con cua products clean can xem lai, thuong do thieu brand/manufacturer hoac thieu hoat chat voi nhom thuoc.
- `products.recommended_4000.jsonl`: 4000 san pham duoc chon can bang theo category cho buoc seed tiep theo.
- `products.rejected.jsonl`: san pham bi loai kem ly do.
- `articles.clean.jsonl`: bai viet suc khoe da cat layout/header/footer va loai bai khuyen mai.
- `articles.rejected.jsonl`: bai viet bi loai, chu yeu do noi dung khuyen mai.
- `diseases.clean.jsonl`: bai viet benh ly da cat layout/header/footer.
- `quality-summary.json`: bao cao tong hop moi nhat.
- `reports/`: lich su bao cao moi lan chay `npm run clean`.

## Re-run

```bash
cd crawl-data
npm run clean
```

Buoc tiep theo moi la review nhanh `quality-summary.json`, sau do sinh SQL seed rieng. Khong import truc tiep cac file JSONL nay vao DB.
