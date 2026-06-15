# 📐 CODING CONVENTIONS — Minh Giang Pharmacy

**Cập nhật:** 10/04/2026  
**Áp dụng cho:** Toàn bộ backend microservices (Node.js + Express)

---

## 📁 Cấu Trúc Thư Mục Mỗi Service

```
backend/<service-name>/
├── index.js                    # Entry point: express, cors, morgan, routes, error handler
├── package.json
├── Dockerfile
├── db/
│   └── pool.js                 # MySQL connection pool (mysql2/promise)
├── middlewares/
│   └── gatewayAuth.js          # Đọc x-user-id/x-user-role/x-user-type từ gateway
├── routes/
│   └── index.js                # Mount tất cả route modules
├── <domain>/                   # Mỗi module 1 folder
│   └── <domain>.routes.js      # File route chính
```

**Ví dụ:** `catalog-service/products/products.routes.js`

---

## 🔌 Response Format Chuẩn

### Thành công — Danh sách (có phân trang)

```js
res.json({
  success: true,
  data: rows,
  pagination: {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  }
});
```

### Thành công — Danh sách (không phân trang)

```js
res.json({ success: true, data: rows });
```

### Thành công — Chi tiết 1 item

```js
res.json({ success: true, data: rows[0] });
```

### Thành công — Chi tiết có nested items

```js
res.json({ success: true, data: { ...order, items } });
```

### Lỗi 404

```js
res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
```

### Lỗi 500

```js
res.status(500).json({ success: false, message: err.message });
```

> **Quy tắc:** Mọi response đều PHẢI có field `success: true/false`. Message lỗi viết bằng **tiếng Việt**.

---

## 🗄️ Database — MySQL Query Pattern

### Import pool

```js
const pool = require('../db/pool');
```

### Query cơ bản

```js
// Lấy danh sách
const [rows] = await pool.query('SELECT * FROM products WHERE is_active = 1');

// Lấy 1 dòng (destructure 2 lần)
const [[product]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

// Đếm tổng
const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE is_active = 1');
```

### Phân trang (pagination)

```js
const page   = Math.max(1, Number(req.query.page) || 1);
const limit  = Math.min(100, Number(req.query.limit) || 20);
const offset = (page - 1) * limit;

const [rows] = await pool.query(
  'SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC LIMIT ? OFFSET ?',
  [limit, offset]
);
```

### Dynamic WHERE (filter/search)

```js
let where = 'WHERE is_active = 1';
const params = [];

if (req.query.keyword) {
  const keyword = `%${req.query.keyword}%`;
  where += ' AND (name LIKE ? OR code LIKE ?)';
  params.push(keyword, keyword);
}
if (req.query.category_id) {
  where += ' AND category_id = ?';
  params.push(req.query.category_id);
}

const [rows] = await pool.query(
  `SELECT * FROM products ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
  [...params, limit, offset]
);
```

### INSERT / UPDATE / DELETE

```js
// INSERT
const [result] = await pool.query(
  'INSERT INTO products (name, code, price, category_id) VALUES (?, ?, ?, ?)',
  [name, code, price, category_id]
);
const newId = result.insertId;

// UPDATE
await pool.query(
  'UPDATE products SET name = ?, price = ? WHERE id = ?',
  [name, price, id]
);

// SOFT DELETE (KHÔNG dùng DELETE thật)
await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
```

> **⚠️ Quan trọng:**  
> - Dùng `pool.query()` (KHÔNG phải `pool.execute()`)  
> - Luôn dùng `?` placeholder — **KHÔNG BAO GIỜ** nối string trực tiếp vào SQL  
> - Soft delete: `SET is_active = 0` thay vì `DELETE FROM`

---

## 🛡️ Route Handler Template

```js
const router = require('express').Router();
const pool = require('../db/pool');

// GET — Danh sách
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ... WHERE is_active = 1');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — Chi tiết
router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM ... WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST — Tạo mới
router.post('/', async (req, res) => {
  try {
    const { name, ... } = req.body;
    const [result] = await pool.query('INSERT INTO ... (name, ...) VALUES (?, ...)', [name, ...]);
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT — Cập nhật
router.put('/:id', async (req, res) => {
  try {
    const { name, ... } = req.body;
    await pool.query('UPDATE ... SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE — Soft delete
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE ... SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
```

---

## 🔐 Authentication & Authorization

### Cách hoạt động (2 lớp)

```
Client → API Gateway (port 8000) → Service (port 800x)
         ├── JWT verify             ├── gatewayAuth.js
         ├── PUBLIC_ROUTES check    ├── req.userId
         └── Forward headers        ├── req.userRole  
             x-user-id              └── req.userType
             x-user-role
             x-user-type
```

### Trong route handler — Kiểm tra quyền

```js
// Chỉ admin/pharmacist mới được truy cập
router.post('/', async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'pharmacist') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    // ... logic
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
```

### Biến có sẵn trong mọi route handler

| Biến           | Kiểu     | Nguồn                    |
|----------------|----------|--------------------------|
| `req.userId`   | Number   | Header `x-user-id`       |
| `req.userRole` | String   | Header `x-user-role`     |
| `req.userType` | String   | Header `x-user-type`     |

---

## 📝 Git Commit Convention

### Format

```
<type>: <mô tả ngắn bằng tiếng Việt hoặc tiếng Anh>
```

### Types

| Type       | Khi nào dùng                        |
|------------|--------------------------------------|
| `feat`     | Thêm tính năng mới                  |
| `fix`      | Sửa bug                             |
| `refactor` | Tái cấu trúc (không đổi chức năng)  |
| `docs`     | Cập nhật tài liệu                   |
| `style`    | Format code, thêm semicolons...     |
| `test`     | Thêm/sửa test                       |
| `chore`    | Config, package.json, Dockerfile...  |

### Ví dụ

```
feat: thêm API tạo sản phẩm POST /products
fix: sửa lỗi query không filter is_active
refactor: tách search logic ra hàm riêng
docs: cập nhật README hướng dẫn chạy Docker
```

---

## 🔧 Môi Trường & Cách Chạy

### Chạy toàn bộ project

```bash
docker-compose up -d
```

### Xem logs 1 service

```bash
docker-compose logs -f catalog-service
```

### Restart 1 service

```bash
docker-compose restart catalog-service
```

### Kết nối MySQL trực tiếp

```
Host: localhost
Port: 3306
User: root
Password: root
Database: mg_catalog (hoặc mg_identity, mg_order, mg_cms, mg_notification)
```

---

## ✅ Checklist Trước Khi Push

- [ ] Code chạy không lỗi (`docker-compose logs -f <service>` không có crash)
- [ ] Test API bằng Postman — response đúng format `{ success, data }`
- [ ] Dùng `?` placeholder cho SQL — không nối string
- [ ] Soft delete (`is_active = 0`) — không `DELETE FROM`
- [ ] Commit message đúng format: `feat: ...` / `fix: ...`
- [ ] Push lên branch đúng: `git push origin service/xxx`
