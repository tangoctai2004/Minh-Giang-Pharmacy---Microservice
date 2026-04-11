# 🤖 QUY TẮC KHI SỬ DỤNG AI — Minh Giang Pharmacy

**Cập nhật:** 11/04/2026  
**Áp dụng cho:** Toàn bộ team 4 thành viên  
**Mục đích:** Đảm bảo code do AI sinh ra **đồng nhất, tương thích** với cả hệ thống

---

## 📋 Mục Lục

1. [Quy Tắc Chung (Mọi Thành Viên)](#-quy-tắc-chung--mọi-thành-viên)
2. [Quy Tắc Riêng TV2 — Catalog Service](#-tv2--catalog-service)
3. [Quy Tắc Riêng TV3 — Order Service](#-tv3--order-service)
4. [Quy Tắc Riêng TV4 — CMS + Frontend](#-tv4--cms--notification--frontend)
5. [Prompt Mẫu Hoàn Chỉnh](#-prompt-mẫu-hoàn-chỉnh)

---

## 🔧 QUY TẮC CHUNG — MỌI THÀNH VIÊN

Copy toàn bộ phần này vào prompt/system instructions cho AI khi bắt đầu làm việc:

---

### 1. Kiến Trúc Dự Án

- Dự án **SOA Microservices monorepo** — Hệ thống Nhà Thuốc Minh Giang
- **6 backend services** (Node.js/Express) + 1 API Gateway, tất cả chạy qua Docker
- Mỗi service có **database schema MySQL riêng**, KHÔNG truy cập DB của service khác

| Service              | Port | Schema            |
|----------------------|------|-------------------|
| api-gateway          | 8000 | —                 |
| identity-service     | 8001 | `mg_identity`     |
| catalog-service      | 8002 | `mg_catalog`      |
| order-service        | 8003 | `mg_order`        |
| cms-service          | 8004 | `mg_cms`          |
| notification-service | 8005 | `mg_notification` |

- Frontend gồm 3 app: `frontend/client/` (website khách), `frontend/admin/` (quản trị), `frontend/pos/` (bán hàng tại quầy)
- **Mọi API call từ frontend đều gọi qua Gateway `:8000`**, KHÔNG gọi trực tiếp service

---

### 2. Cấu Trúc Thư Mục Backend (BẮT BUỘC)

```
backend/<service-name>/
├── index.js                    # Entrypoint: express, cors, morgan, mount routes
├── package.json
├── Dockerfile
├── db/
│   └── pool.js                 # MySQL pool (mysql2/promise) — copy y nguyên mẫu
├── middlewares/
│   └── gatewayAuth.js          # Đọc x-user-id, x-user-role, x-user-type từ Gateway
├── routes/
│   └── index.js                # Mount tất cả sub-routers, khai báo gatewayAuth
└── <domain>/                   # Mỗi nghiệp vụ 1 folder riêng
    └── <domain>.routes.js      # File route chính (CHỈ 1 file duy nhất)
```

> **❌ KHÔNG** tạo thêm folder `controllers/`, `services/`, `models/`.  
> Mỗi domain chỉ có 1 file `.routes.js`.

---

### 3. Response Format (BẮT BUỘC)

```js
// ✅ Thành công — danh sách có phân trang
res.json({
  success: true,
  data: rows,
  pagination: { total, page, limit, pages: Math.ceil(total / limit) }
});

// ✅ Thành công — danh sách không phân trang
res.json({ success: true, data: rows });

// ✅ Thành công — 1 item
res.json({ success: true, data: row });

// ✅ Tạo mới thành công
res.status(201).json({ success: true, data: { id: result.insertId } });

// ❌ Lỗi 404
res.status(404).json({ success: false, message: 'Không tìm thấy ...' });

// ❌ Lỗi 500
res.status(500).json({ success: false, message: err.message });
```

**Quy tắc:**
- Mọi response **PHẢI** có field `success: true` hoặc `success: false`
- Message lỗi viết bằng **tiếng Việt**

---

### 4. Database Patterns (BẮT BUỘC)

```js
const pool = require('../db/pool');

// Lấy danh sách
const [rows] = await pool.query('SELECT * FROM products WHERE is_active = 1');

// Lấy 1 dòng (destructure 2 lần)
const [[row]] = await pool.query('SELECT * FROM ... WHERE id = ?', [id]);

// Đếm tổng
const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM ...');

// Phân trang chuẩn
const page   = Math.max(1, Number(req.query.page) || 1);
const limit  = Math.min(100, Number(req.query.limit) || 20);
const offset = (page - 1) * limit;
```

**⚠️ Quy tắc tuyệt đối:**

| ✅ LÀM                                        | ❌ KHÔNG LÀM                                      |
|------------------------------------------------|---------------------------------------------------|
| `pool.query('... WHERE id = ?', [id])`         | `pool.query('... WHERE id = ' + id)`              |
| `pool.query()`                                  | `pool.execute()`                                  |
| `UPDATE ... SET is_active = 0` (soft delete)   | `DELETE FROM ...` (hard delete)                   |
| `WHERE is_active = 1` trong mọi SELECT         | Quên filter `is_active`                           |

---

### 5. Route Handler Template (BẮT BUỘC)

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
    const { name } = req.body;
    const [result] = await pool.query('INSERT INTO ... (name) VALUES (?)', [name]);
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
```

**Quy tắc:**
- Mọi handler PHẢI là `async` + wrap trong `try/catch`
- Cuối file **PHẢI** có `module.exports = router`

---

### 6. Authentication & Gateway (QUAN TRỌNG)

**❌ KHÔNG** verify JWT trong service con — Gateway đã làm điều đó.

Service con đọc thông tin user qua middleware `gatewayAuth.js`:

```js
req.userId   // (Number) — ID người dùng
req.userRole // (String) — 'admin' | 'manager' | 'cashier'
req.userType // (String) — 'user' | 'customer'
```

- Nếu endpoint cần kiểm quyền → check `req.userRole` trong handler
- Các route **public** (không cần token) được khai báo trong `backend/api-gateway/middlewares/auth.js` mảng `PUBLIC_ROUTES`
- Nếu cần thêm public route → báo leader thêm vào `PUBLIC_ROUTES`

---

### 7. API Mapping — PHẢI Đọc Trước Khi Code

Thư mục `markdown/api-mapping/` chứa **28 file đặc tả API** cho từng trang frontend:

```
markdown/api-mapping/
├── admin/    (16 files — login, customers, orders, inventory, batches, ...)
├── client/   (9 files  — auth, cart, category, checkout, product, ...)
└── pos/      (3 files  — login, main, history)
```

**Trước khi code bất kỳ endpoint nào, BẮT BUỘC:**
1. Đọc file api-mapping tương ứng
2. Đảm bảo **đúng path** endpoint
3. Đảm bảo **đúng tên field** request/response
4. Đảm bảo **đúng cấu trúc** response (nested data, pagination, etc.)

> **❌ KHÔNG** tự ý đặt tên field khác với spec trong api-mapping

---

### 8. Database Schema — PHẢI Đọc File SQL

Trước khi viết query, **BẮT BUỘC** đọc file SQL schema tương ứng:

```
infrastructure/database/
├── mg_identity.sql      — users, customers, roles, shifts, loyalty, otp
├── mg_catalog.sql       — products, batches, locations, suppliers, brands, inventory
├── mg_order.sql         — carts, orders, order_items, returns
├── mg_cms.sql           — articles, banners, promotions, store_config
└── mg_notification.sql  — notification_templates, notifications
```

- Đảm bảo **tên bảng, tên cột đúng chính xác** — KHÔNG đoán
- Nếu cần thêm cột/bảng → viết file migration SQL mới, đặt trong `infrastructure/database/` và commit

---

### 9. Security (BẮT BUỘC)

| ✅ LÀM                                | ❌ KHÔNG LÀM                                        |
|----------------------------------------|-----------------------------------------------------|
| Dùng `.env` cho secrets                | Hardcode JWT_SECRET, password trong code            |
| Commit `.env.example`                  | Commit file `.env`                                  |
| Exclude `password_hash` khỏi response | Trả `password_hash` trong API response              |
| `bcrypt` với saltRounds = 10           | Lưu password plaintext                              |
| `?` placeholder trong SQL              | Nối string (SQL injection)                          |

---

### 10. Git Workflow

```bash
# Mỗi thành viên làm trên branch riêng:
# service/identity, service/catalog, service/order, service/frontend

# Đầu ngày:
git checkout dev
git pull origin dev
git checkout service/xxx
git merge dev

# Feature mới:
git checkout -b feature/ten-chuc-nang

# Code xong:
git push → tạo Pull Request vào dev → leader review → merge
```

**Commit message format:** `feat: ...`, `fix: ...`, `refactor: ...`

> **❌ KHÔNG** push trực tiếp vào `main` hoặc `dev`

---

### 11. Docker

```bash
# Chạy toàn bộ
docker-compose up -d

# Xem log
docker-compose logs -f <service-name>

# Thêm package mới
docker-compose exec <service> npm install <pkg>
# → rồi commit package.json
```

- Code được **hot-reload** qua volume mount (nodemon) — sửa file → service tự restart
- **KHÔNG** sửa `docker-compose.yml` nếu không phải leader

---

## 🔧 QUY TẮC RIÊNG THEO THÀNH VIÊN

### 💻 TV2 — Catalog Service

> Copy thêm đoạn này (ngoài phần chung) vào prompt cho AI:

```
Tôi phụ trách catalog-service (port 8002, schema mg_catalog).

Các domain tôi cần implement:
- products/   → POST, PUT, DELETE (GET đã có sẵn làm mẫu)
- categories/ → CRUD đầy đủ
- suppliers/  → CRUD đầy đủ
- batches/    → CRUD (nhập lô hàng)
- inventory/  → GET tồn kho + POST /adjust
- locations/  → CRUD chi nhánh

File mẫu tham khảo: backend/catalog-service/products/products.routes.js
  (GET / với pagination + search đã hoàn chỉnh)

Schema DB:  infrastructure/database/mg_catalog.sql
API specs:  markdown/api-mapping/admin/  (inventory, batches, suppliers, locations)
            markdown/api-mapping/client/ (category, product)

Khi implement POST/PUT/DELETE → thay thế các stub 501 hiện tại.
GET public routes (products, categories) đã được gateway whitelist.
```

---

### 💻 TV3 — Order Service

> Copy thêm đoạn này vào prompt cho AI:

```
Tôi phụ trách order-service (port 8003, schema mg_order).

Các domain tôi cần implement:
- cart/     → GET giỏ hàng, POST thêm SP, PUT sửa SL, DELETE xóa SP
- checkout/ → POST tạo đơn hàng từ cart
- orders/   → GET danh sách, GET /:id chi tiết, PUT /:id/status, PUT /:id/cancel, GET /stats
- returns/  → GET danh sách, POST tạo, GET /:id chi tiết, PUT /:id/approve

Schema DB:  infrastructure/database/mg_order.sql
API specs:  markdown/api-mapping/client/api-mapping-client-cart.md
            markdown/api-mapping/client/api-mapping-client-checkout.md
            markdown/api-mapping/admin/api-mapping-admin-orders.md
            markdown/api-mapping/admin/api-mapping-admin-returns.md
            markdown/api-mapping/admin/api-mapping-admin-fulfillment.md

Cart cần req.userId từ gatewayAuth để biết giỏ hàng của ai.
Order status flow: pending → confirmed → shipping → delivered (hoặc cancelled).
```

---

### 🎨 TV4 — CMS + Notification + Frontend

> Copy thêm đoạn này vào prompt cho AI:

```
Tôi phụ trách cms-service (port 8004, schema mg_cms),
notification-service (port 8005, schema mg_notification),
và tích hợp frontend.

Backend domains:
- CMS: articles/, banners/, disease_categories/, promotions/, store_config/
- Notification: email/, sms/, templates/

Schema DB:  infrastructure/database/mg_cms.sql
            infrastructure/database/mg_notification.sql
API specs:  markdown/api-mapping/admin/api-mapping-admin-cms.md
            markdown/api-mapping/admin/api-mapping-admin-promotions.md
            markdown/api-mapping/admin/api-mapping-admin-storefront.md
            markdown/api-mapping/client/api-mapping-client-disease-articles.md
            markdown/api-mapping/client/api-mapping-client-index.md

Frontend:
- HTML static + vanilla JS (fetch API)
- Tất cả API call trỏ về http://localhost:8000/api/...
- Components dùng chung: frontend/components/ (header, footer, banner...)
- Load component bằng attribute mg-include (xem frontend/assets/js/components.js)
- Admin: frontend/admin/ + frontend/admin/js/
- Client: frontend/client/
- POS: frontend/pos/

CMS public routes (GET articles, banners, disease-categories, store-config/public)
đã được gateway whitelist — không cần token.
```

---

## 📝 PROMPT MẪU HOÀN CHỈNH

Mỗi thành viên dán **toàn bộ block** này vào phần system instruction / custom prompt của AI, rồi thay `[QUY TẮC RIÊNG]` bằng phần riêng ở trên:

```
Bạn là lập trình viên trong dự án Nhà thuốc Minh Giang — kiến trúc SOA Microservices.

=== QUY TẮC BẮT BUỘC ===

1. CẤU TRÚC: Mỗi domain 1 folder, chỉ có file <domain>.routes.js.
   Không tạo controllers/, services/, models/.

2. RESPONSE FORMAT: Mọi API trả { success: true/false, data/message }.
   Có phân trang: thêm pagination { total, page, limit, pages }.
   Message lỗi bằng tiếng Việt.

3. DATABASE:
   - Dùng pool.query() với ? placeholder. KHÔNG BAO GIỜ nối string vào SQL.
   - KHÔNG dùng pool.execute().
   - Soft delete: SET is_active = 0, KHÔNG dùng DELETE FROM.
   - Mọi SELECT thêm WHERE is_active = 1.

4. ROUTE HANDLER: async + try/catch. module.exports = router;

5. AUTH: KHÔNG verify JWT trong service. Đọc req.userId, req.userRole,
   req.userType từ middleware gatewayAuth.js.

6. TRƯỚC KHI CODE: Đọc file api-mapping tương ứng trong markdown/api-mapping/
   để đảm bảo đúng endpoint path, tên field, response format.
   Đọc file SQL schema trong infrastructure/database/ để đúng tên bảng/cột.

7. SECURITY: Không hardcode secrets. Không trả password_hash trong response.
   Dùng bcrypt (saltRounds=10) cho password.

8. GIT: Commit message format: feat:/fix:/refactor:. Không commit .env.

[QUY TẮC RIÊNG CỦA THÀNH VIÊN — dán phần tương ứng ở đây]
```

---

## 📌 TÀI LIỆU LIÊN QUAN

| File                                   | Mô tả                              |
|----------------------------------------|-------------------------------------|
| `markdown/tasks/CODING_CONVENTIONS.md` | Chi tiết coding convention          |
| `markdown/tasks/TASK_ASSIGNMENTS.md`   | Phân công endpoint theo thành viên  |
| `markdown/project/SECURITY.md`         | Quy tắc bảo mật                    |
| `markdown/project/GIT_GUIDE.md`        | Hướng dẫn Git workflow              |
| `markdown/project/README.md`           | Tổng quan kiến trúc + quick start   |
| `markdown/api-mapping/`               | 28 file đặc tả API frontend↔backend|
| `infrastructure/database/`            | Schema SQL cho từng service         |
