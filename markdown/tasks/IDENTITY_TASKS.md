# 🔐 IDENTITY SERVICE — Chi Tiết Task

**Service:** identity-service (port 8001)  
**Database:** mg_identity  
**Branch:** `service/identity`  
**Người phụ trách:** Trưởng nhóm

---

## Tổng Quan

| Giai đoạn | Nội dung | Số task |
|-----------|----------|---------|
| 1 — Auth Core | Login, Register, Refresh, Logout | 4 |
| 2 — Login POS + Users | Login POS, CRUD users | 4 |
| 3 — Customers | CRUD customers | 3 |
| 4 — Shifts | Mở ca, đóng ca POS | 2 |
| **Tổng** | | **13** |

**Dependencies đã có trong package.json:** `bcryptjs`, `jsonwebtoken`, `mysql2`

---

## GIAI ĐOẠN 1 — Auth Core (Ưu tiên tuyệt đối)

> Cả 3 TV khác đang chờ Login hoạt động để lấy token test service của họ.

### Task 1: `POST /auth/login`

**File:** `backend/identity-service/auth/auth.routes.js`  
**Dòng hiện tại:** `res.status(501).json({ ... 'TODO: implement POST /auth/login' })`

**Input (req.body):**
```json
{ "username": "admin", "password": "123456" }
```

**Logic từng bước:**
1. Validate: kiểm tra `username` và `password` không rỗng
2. Tìm user:
   ```sql
   SELECT u.*, r.name AS role_name 
   FROM users u LEFT JOIN roles r ON r.id = u.role_id 
   WHERE (u.username = ? OR u.email = ? OR u.phone = ?) AND u.is_active = 1
   ```
3. So sánh password: `await bcrypt.compare(password, user.password_hash)`
4. Tạo JWT access token:
   ```js
   const accessToken = jwt.sign(
     { id: user.id, role: user.role_name, type: 'staff' },
     process.env.JWT_SECRET,
     { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
   );
   ```
5. Tạo JWT refresh token:
   ```js
   const refreshToken = jwt.sign(
     { id: user.id, type: 'staff' },
     process.env.JWT_SECRET,
     { expiresIn: '30d' }
   );
   ```
6. Hash refresh token rồi lưu DB:
   ```js
   const crypto = require('crypto');
   const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
   await pool.query(
     'INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
     [user.id, 'staff', tokenHash]
   );
   ```
7. Cập nhật last_login: `UPDATE users SET last_login_at = NOW() WHERE id = ?`

**Output:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "user": { "id": 1, "full_name": "Nguyễn Minh Giang", "role": "admin" }
  }
}
```

**Lỗi trả về:**
- 400 — `Vui lòng nhập tên đăng nhập và mật khẩu`
- 401 — `Tên đăng nhập hoặc mật khẩu không đúng`

**Test Postman:** `POST http://localhost:8001/auth/login` hoặc qua gateway `POST http://localhost:8000/api/identity/auth/login`

---

### Task 2: `POST /auth/register`

**File:** `backend/identity-service/auth/auth.routes.js`  
**Dòng hiện tại:** `res.status(501).json({ ... 'TODO: implement POST /auth/register' })`

**Input (req.body):**
```json
{ "full_name": "Nguyễn Văn A", "email": "a@gmail.com", "phone": "0901234567", "password": "mypassword" }
```

**Logic từng bước:**
1. Validate: `full_name`, `email`, `phone`, `password` không rỗng
2. Kiểm tra trùng:
   ```sql
   SELECT id FROM customers WHERE (email = ? OR phone = ?) AND deleted_at IS NULL
   ```
   → Nếu có → 409 `Email hoặc số điện thoại đã được đăng ký`
3. Hash password: `const hash = await bcrypt.hash(password, 10)`
4. Insert:
   ```sql
   INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)
   ```
5. Tạo accessToken + refreshToken (type: `'customer'`, role: `'customer'`)
6. Lưu refresh token vào `refresh_tokens` (user_type: `'customer'`)

**Output:**
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "customer": { "id": 8, "full_name": "Nguyễn Văn A", "email": "a@gmail.com", "phone": "0901234567" }
  }
}
```

**Lỗi trả về:**
- 400 — `Vui lòng nhập đầy đủ thông tin`
- 409 — `Email hoặc số điện thoại đã được đăng ký`

---

### Task 3: `POST /auth/refresh`

**File:** `backend/identity-service/auth/auth.routes.js`  
**Dòng hiện tại:** `res.status(501).json({ ... 'TODO: implement POST /auth/refresh' })`

**Input (req.body):**
```json
{ "refreshToken": "eyJhbGciOi..." }
```

**Logic từng bước:**
1. Validate: `refreshToken` không rỗng
2. Hash token: `crypto.createHash('sha256').update(refreshToken).digest('hex')`
3. Tìm trong DB:
   ```sql
   SELECT * FROM refresh_tokens 
   WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
   ```
   → Không tìm thấy → 401 `Refresh token không hợp lệ hoặc đã hết hạn`
4. `jwt.verify(refreshToken, JWT_SECRET)` → decoded `{ id, type }`
5. Lấy lại user/customer info từ DB dựa vào `decoded.type`:
   - `'staff'` → SELECT từ `users` JOIN `roles`
   - `'customer'` → SELECT từ `customers`
6. Tạo accessToken mới (cùng payload như login)

**Output:**
```json
{ "success": true, "data": { "accessToken": "eyJhbGciOi..." } }
```

---

### Task 4: `POST /auth/logout`

**File:** `backend/identity-service/auth/auth.routes.js`  
**Dòng hiện tại:** `res.status(501).json({ ... 'TODO: implement POST /auth/logout' })`

**Input (req.body):**
```json
{ "refreshToken": "eyJhbGciOi..." }
```

**Logic:**
1. Hash token
2. `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?`

**Output:**
```json
{ "success": true, "message": "Đăng xuất thành công" }
```

---

### ⚠️ Việc cần làm trước khi code Task 1

**Sửa seed data password:** Các password_hash trong `mg_identity.sql` là placeholder không hợp lệ. Cần tạo hash thật:

```js
// Chạy 1 lần trong Node REPL:
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('123456', 10));
// Kết quả VD: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

Rồi UPDATE lại trong MySQL:
```sql
UPDATE users SET password_hash = '<hash_ở_trên>' WHERE username = 'admin';
```

---

## GIAI ĐOẠN 2 — Login POS + Quản Lý Users

### Task 5: `POST /auth/login-pos`

**File:** `backend/identity-service/auth/auth.routes.js`

**Input:**
```json
{ "username": "thugan_minh", "password": "123456", "kiosk_id": "Kiosk #01" }
```

**Logic:** Giống Task 1 nhưng thêm:
- Kiểm tra role phải là `pharmacist` hoặc `cashier` → nếu không → 403 `Tài khoản không có quyền truy cập POS`
- Validate `kiosk_id` không rỗng
- Trả thêm `kiosk_id` trong response để frontend POS lưu lại

**Output:**
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { "id": 3, "full_name": "Lê Văn Minh", "role": "cashier" },
    "kiosk_id": "Kiosk #01"
  }
}
```

---

### Task 6: `POST /users`

**File:** `backend/identity-service/users/users.routes.js`

**Auth:** `req.userRole === 'admin'` → nếu không → 403

**Input:**
```json
{ "username": "duocsi_new", "full_name": "Nguyễn Văn B", "email": "b@minhgiangpharma.vn", "phone": "0999888777", "password": "123456", "role_id": 2 }
```

**Logic:**
1. Kiểm tra quyền admin
2. Validate các field bắt buộc: `username`, `full_name`, `email`, `password`, `role_id`
3. Kiểm tra trùng username/email:
   ```sql
   SELECT id FROM users WHERE username = ? OR email = ?
   ```
4. Hash password: `bcrypt.hash(password, 10)`
5. Insert:
   ```sql
   INSERT INTO users (username, full_name, email, phone, password_hash, role_id) VALUES (?, ?, ?, ?, ?, ?)
   ```

**Output:** `201 { success: true, data: { id, username, full_name, email, phone, role_id } }`

---

### Task 7: `PUT /users/:id`

**File:** `backend/identity-service/users/users.routes.js`

**Auth:** admin only

**Input:** `{ full_name?, email?, phone?, password?, role_id? }` — chỉ gửi field cần sửa

**Logic:**
1. Kiểm tra quyền admin
2. Kiểm tra user tồn tại: `SELECT id FROM users WHERE id = ?`
3. Nếu có `email` mới → kiểm tra trùng (trừ chính user đó)
4. Nếu có `password` → hash lại
5. Build dynamic UPDATE:
   ```js
   const fields = [];
   const params = [];
   if (full_name) { fields.push('full_name = ?'); params.push(full_name); }
   if (email)     { fields.push('email = ?');     params.push(email); }
   // ... tương tự cho phone, password_hash, role_id
   params.push(req.params.id);
   await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
   ```

**Output:** `{ success: true, message: 'Cập nhật nhân viên thành công' }`

---

### Task 8: `DELETE /users/:id`

**File:** `backend/identity-service/users/users.routes.js`

**Auth:** admin only

**Logic:**
1. Kiểm tra quyền admin
2. Chặn tự xóa: `if (req.userId === Number(req.params.id))` → 400 `Không thể vô hiệu hóa tài khoản của chính mình`
3. Soft delete: `UPDATE users SET is_active = 0 WHERE id = ?`

**Output:** `{ success: true, message: 'Đã vô hiệu hóa tài khoản nhân viên' }`

---

## GIAI ĐOẠN 3 — Quản Lý Customers

### Task 9: `POST /customers`

**File:** `backend/identity-service/customers/customers.routes.js`

**Auth:** admin hoặc pharmacist

**Input:**
```json
{ "full_name": "Khách mới", "email": "khach@gmail.com", "phone": "0911222333", "date_of_birth": "1990-01-15", "gender": "female" }
```

**Logic:**
1. Kiểm tra quyền admin/pharmacist
2. Kiểm tra trùng email/phone
3. Tạo password_hash mặc định (VD: hash của phone number) hoặc random
4. Insert:
   ```sql
   INSERT INTO customers (full_name, email, phone, password_hash, date_of_birth, gender) VALUES (?, ?, ?, ?, ?, ?)
   ```

**Output:** `201 { success: true, data: { id, full_name, email, phone } }`

---

### Task 10: `PUT /customers/:id`

**File:** `backend/identity-service/customers/customers.routes.js`

**Auth:** 2 trường hợp:
- Customer tự sửa: `req.userType === 'customer' && req.userId === Number(req.params.id)`
- Admin sửa: `req.userRole === 'admin'`

**Input:** `{ full_name?, phone?, date_of_birth?, gender? }`

**Logic:** Dynamic UPDATE giống Task 7, nhưng trên bảng `customers`

**Output:** `{ success: true, message: 'Cập nhật thông tin khách hàng thành công' }`

---

### Task 11: `DELETE /customers/:id`

**File:** `backend/identity-service/customers/customers.routes.js`

**Auth:** admin only

**Logic:**
```sql
UPDATE customers SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL
```
> ⚠️ Bảng customers dùng `deleted_at` (KHÔNG phải `is_active = 0` như bảng users)

**Output:** `{ success: true, message: 'Đã xóa tài khoản khách hàng' }`

---

## GIAI ĐOẠN 4 — Shifts (Ca Làm Việc POS)

### Task 12: `POST /shifts`

**File:** `backend/identity-service/shifts/shifts.routes.js`

**Auth:** pharmacist hoặc cashier

**Input:**
```json
{ "kiosk_id": "Kiosk #01", "opening_cash": 5000000 }
```

**Logic:**
1. Kiểm tra quyền pharmacist/cashier
2. Kiểm tra kiosk chưa có ca đang mở:
   ```sql
   SELECT id FROM shifts WHERE kiosk_id = ? AND status = 'open'
   ```
   → Nếu có → 409 `Kiosk này đang có ca mở, vui lòng đóng ca trước`
3. Insert:
   ```sql
   INSERT INTO shifts (user_id, kiosk_id, shift_start, opening_cash, status)
   VALUES (?, ?, NOW(), ?, 'open')
   ```

**Output:** `201 { success: true, data: { id, kiosk_id, opening_cash, status: 'open' } }`

---

### Task 13: `PUT /shifts/:id/close`

**File:** `backend/identity-service/shifts/shifts.routes.js`

**Auth:** Người mở ca (`shift.user_id === req.userId`) hoặc admin

**Input:**
```json
{ "closing_cash": 8250000, "notes": "Ca trôi chảy, không vấn đề" }
```

**Logic:**
1. Tìm ca đang mở: `SELECT * FROM shifts WHERE id = ? AND status = 'open'`
   → Không tìm thấy → 404 `Ca không tồn tại hoặc đã đóng`
2. Kiểm tra quyền: chỉ người mở ca hoặc admin
3. Tính toán đối soát:
   ```js
   const expectedCash = shift.opening_cash + shift.total_cash_sales;
   const difference = closing_cash - expectedCash;
   const reconStatus = difference === 0 ? 'matched' 
                      : difference > 0 ? 'excess' : 'shortage';
   ```
4. Update:
   ```sql
   UPDATE shifts SET 
     status = 'closed', shift_end = NOW(),
     closing_cash = ?, expected_closing_cash = ?,
     cash_difference = ?, reconciliation_status = ?, notes = ?
   WHERE id = ?
   ```

**Output:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "status": "closed",
    "closing_cash": 8250000,
    "expected_closing_cash": 8125000,
    "cash_difference": 125000,
    "reconciliation_status": "excess"
  }
}
```

---

## Checklist Tổng

- [ ] **Task 1:** POST /auth/login
- [ ] **Task 2:** POST /auth/register
- [ ] **Task 3:** POST /auth/refresh
- [ ] **Task 4:** POST /auth/logout
- [ ] **Task 5:** POST /auth/login-pos
- [ ] **Task 6:** POST /users
- [ ] **Task 7:** PUT /users/:id
- [ ] **Task 8:** DELETE /users/:id
- [ ] **Task 9:** POST /customers
- [ ] **Task 10:** PUT /customers/:id
- [ ] **Task 11:** DELETE /customers/:id
- [ ] **Task 12:** POST /shifts
- [ ] **Task 13:** PUT /shifts/:id/close

---

## Schema Tham Khảo Nhanh

```
users:       id, username, email, password_hash, full_name, phone, role_id, avatar_url, is_active, last_login_at
customers:   id, full_name, email, phone, password_hash, date_of_birth, gender, loyalty_points, loyalty_tier, is_active, deleted_at
roles:       id, name, description, permissions(JSON)
shifts:      id, user_id, kiosk_id, shift_start, shift_end, opening_cash, closing_cash, total_cash_sales, total_card_sales, total_qr_sales, status, notes, expected_closing_cash, cash_difference, reconciliation_status, approved_by
refresh_tokens: id, user_id, user_type('staff'|'customer'), token_hash, expires_at, revoked_at
otp_codes:   id, target, target_type, otp_hash, purpose, attempts, expires_at, used_at
```
