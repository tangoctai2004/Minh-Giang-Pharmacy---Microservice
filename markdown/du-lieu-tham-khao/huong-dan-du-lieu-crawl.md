# Trung Son Care Crawl Workspace

Folder này chứa toàn bộ code, state, log và output liên quan đến việc crawl dữ liệu Trung Sơn Care. Phần này chỉ crawl và chuẩn hóa dữ liệu thô, chưa seed vào database.

## Nguyên tắc

- Crawl chậm, tuần tự, có delay dài để giảm nguy cơ bị chặn.
- Không dùng proxy, không vượt captcha, không cố bypass bảo vệ của website.
- Mọi tiến trình được lưu liên tục vào `state/`, log vào `logs/crawler.log`.
- Dữ liệu sản phẩm, bài viết sức khỏe và bệnh lý được tách riêng trong `data/`.
- Có thể dừng bất kỳ lúc nào bằng `Ctrl+C`; lần sau chạy lại sẽ tiếp tục.
- Nếu máy sleep/mất mạng, lần chạy sau đọc lại state và crawl tiếp URL chưa xong.

## Cấu trúc sau khi chạy

```text
crawl-data/
  index.js
  config.example.json
  config.local.json        # tùy chọn, tự tạo nếu muốn override config
  data/
    products.jsonl
    articles.jsonl
    diseases.jsonl
  logs/
    crawler.log
  raw/
    products/
    articles/
    diseases/
  assets/
    images/
      products/
      articles/
      diseases/
  reports/
    quality-report-*.json
  state/
    product-urls.json
    article-urls.json
    disease-urls.json
    stats.json
```

## Lệnh chạy

Kiểm tra cú pháp:

```bash
npm run check
```

Lấy sitemap và tạo danh sách URL cần crawl:

```bash
npm run discover
```

Crawl sản phẩm:

```bash
npm run crawl:products
```

Crawl bài viết sức khỏe:

```bash
npm run crawl:articles
```

Crawl bài bệnh lý:

```bash
npm run crawl:diseases
```

Xem tiến trình:

```bash
npm run status
```

Tạo báo cáo chất lượng dữ liệu đã crawl:

```bash
npm run validate
npm run validate:products
```

Giới hạn số item trong một lần chạy:

```bash
node index.js crawl products --limit=100
```

Chạy lại từ đầu một nhóm URL:

```bash
node index.js reset products
node index.js reset articles
node index.js reset diseases
```

## Tùy chỉnh

Copy `config.example.json` thành `config.local.json` rồi chỉnh delay/limit:

```bash
cp config.example.json config.local.json
```

Nên giữ `minDelayMs` và `maxDelayMs` cao. Nếu gặp 429 nhiều, tăng `cooldownOn429Ms`.

## Ảnh sản phẩm

Mặc định crawler chỉ lưu link sống trong `image_url` và `gallery`. Cách này nhẹ và ít request hơn.

Nếu muốn tải ảnh về local, tạo `config.local.json` và bật:

```json
{
  "storage": {
    "downloadImages": true,
    "maxImagesPerProduct": 5,
    "maxImagesPerArticle": 1
  }
}
```

Khi bật tải ảnh, record sẽ có thêm:

```json
{
  "image_url_live": "https://trungsoncare.com/...",
  "image_url": "assets/images/products/ten-san-pham-hash.webp",
  "downloaded_images": []
}
```

Nếu tải ảnh lỗi, crawler vẫn giữ link sống và ghi lỗi vào `logs/crawler.log`.

## Chất lượng dữ liệu

Mỗi record được gắn:

```json
{
  "mapped_category": {
    "slug": "thuoc-giam-dau-ha-sot",
    "name": "Thuốc giảm đau - hạ sốt",
    "matched_by": "ha-sot"
  },
  "quality_score": 88,
  "quality_status": "clean",
  "quality_issues": []
}
```

Các trạng thái:

- `clean`: có thể dùng để chuẩn bị seed.
- `needs_review`: cần kiểm tra hoặc map category lại.
- `reject`: thiếu dữ liệu quan trọng, nên loại khỏi seed.

Muốn map category sát DB Minh Giang hơn, copy `category-map.example.json` thành `category-map.local.json` rồi thêm rule theo category hiện tại.
