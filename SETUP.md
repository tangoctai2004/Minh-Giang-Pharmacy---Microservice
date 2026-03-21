# 🚀 Hướng Dẫn Setup Dự Án Minh Giang Pharmacy

Tài liệu này hướng dẫn cách setup môi trường phát triển cho dự án Microservices quản lý nhà thuốc Minh Giang.

**Người viết:** Thành viên Trư ở nhóm  
**Cập nhật lần cuối:** 21/03/2026  
**Phiên bản:** 1.0

---

## 📋 Mục Lục

1. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
2. [Cài đặt lần đầu](#cài-đặt-lần-đầu)
3. [Chạy dự án](#chạy-dự-án)
4. [Cấu trúc thư mục](#cấu-trúc-thư-mục)
5. [Thường gặp & Cách khắc phục](#thường-gặp--cách-khắc-phục)
6. [Quy tắc bảo mật](#quy-tắc-bảo-mật)
7. [Liên hệ hỗ trợ](#liên-hệ-hỗ-trợ)

---

## 🖥️ Yêu Cầu Hệ Thống

### Bắt buộc
- **Docker Desktop** (Windows/Mac) hoặc **Docker Engine + Docker Compose** (Linux)
  - Download: https://www.docker.com/products/docker-desktop
  - Kiểm tra: `docker --version` và `docker-compose --version`
  
- **Node.js 18 LTS** (để chạy service riêng lẻ - tùy chọn)
  - Download: https://nodejs.org/ (LTS version)
  - Kiểm tra: `node --version`

- **Git**
  - Kiểm tra: `git --version`

### Tùy chọn (để debug database)
- **DBeaver** hoặc **Navicat**: Kết nối MySQL graphically
  - DBeaver free: https://dbeaver.io/download/

---

## 📥 Cài Đặt Lần Đầu

### Bước 1: Clone Repository

```bash
# Chọn folder để lưu project
cd ~/Documents

# Clone repo (thay <url> bằng link GitHub của nhóm)
git clone <url>
cd "Minh Giang Pharmacy"
```

**Windows:** Nếu gặp lỗi path dài, mở PowerShell as Admin chạy:
```powershell
git config --system core.longpaths true
```

---

### Bước 2: Setup Environment Variables

```bash
# Copy file template
cp .env.example .env

# Mở file .env với editor
# Trên Mac/Linux: nano .env
# Trên Windows: Mở file bằng Notepad hoặc VS Code
```

**Điền vào file `.env`:**
```env
# Bắt buộc - dùng chung cho cả nhóm
JWT_SECRET=your_secure_32_char_random_string_here_2025

# CORS origins (được phép gọi API từ những domain này)
CORS_ORIGIN=http://localhost:5500,http://localhost:3000

# Email (nếu muốn gửi email thật)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_char_app_password
```

**Cách tạo JWT_SECRET:**
```bash
# Mac/Linux
openssl rand -hex 16

# Windows (PowerShell)
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16))

# Hoặc dùng online: https://generatefake.com/random-key-generator
```

⚠️ **Quan trọng:** KHÔNG commit file `.env` lên GitHub!  
File `.env` chỉ tồn tại trên máy cá nhân, `.env.example` là template.

---

### Bước 3: Khởi Động Docker

```bash
# Đứng tại thư mục project root (nơi có docker-compose.yml)
cd "Minh Giang Pharmacy"

# Khởi động tất cả services
docker-compose up -d

# Kiểm tra status (chờ ~30 giây cho services startup)
docker-compose ps
```

**Nếu thấy:**
```
STATUS        PORTS
Up 2 minutes  minhgiang_mysql
Up 1 minutes  minhgiang_identity   (port 8001)
Up 1 minutes  minhgiang_catalog    (port 8002)
Up 1 minutes  minhgiang_order      (port 8003)
Up 1 minutes  minhgiang_cms        (port 8004)
Up 1 minutes  minhgiang_notification (port 8005)
```

✅ Setup thành công!

---

### Bước 4: Cài NPM Dependencies (Nếu Cần Chạy Service Riêng)

Nếu bạn muốn chạy 1 service riêng lẻ để debug (không dùng Docker):

```bash
# Ví dụ: chạy identity-service riêng
cd backend/identity-service

# Cài dependencies
npm install

# Copy .env template
cp .env.example .env

# Chạy service
npm run dev
```

---

## ▶️ Chạy Dự Án

### Cách 1: Dùng Docker (Khuyên dùng)

```bash
# Từ thư mục project root
docker-compose up -d

# Xem log theo dõi
docker-compose logs -f

# Dừng tất cả
docker-compose down

# Dừng và xóa dữ liệu (reset database)
docker-compose down -v
```

**Kiểm tra hoạt động:**
```bash
# Health check gateway
curl http://localhost:8000/health

# Nên nhận response như:
# {"status":"ok","services":{"identity":"http://localhost:8001",...}}
```

---

### Cách 2: Chạy Service Riêng Lẻ (Local Development)

Dùng khi bạn muốn debug 1 service mà không cần start cả stack.

```bash
# Terminal 1: Chạy MySQL qua Docker
docker-compose up -d mysql-db rabbitmq

# Terminal 2: Chạy service bạn đang code
cd backend/identity-service
npm run dev

# Service sẽ chạy tại http://localhost:8001
```

---

## 📁 Cấu Trúc Thư Mục

```
Minh Giang Pharmacy/
│
├── backend/                          # Tất cả services
│   ├── api-gateway/                  # Cổng vào (port 8000)
│   ├── identity-service/             # Xác thực (port 8001)
│   ├── catalog-service/              # Danh mục sản phẩm (port 8002)
│   ├── order-service/                # Quản lý đơn hàng (port 8003)
│   ├── cms-service/                  # Nội dung & banner (port 8004)
│   └── notification-service/         # Gửi email/SMS (port 8005)
│
├── frontend/                         # Giao diện người dùng
│   ├── admin/                        # Trang quản trị
│   ├── client/                       # Trang khách hàng
│   ├── pos/                          # Trang điểm bán
│   ├── components/                   # Các phần tử dùng chung
│   └── assets/                       # Hình ảnh, font, CSS
│
├── infrastructure/                   # Setup ban đầu
│   ├── database/                     # SQL files init database
│   └── postman/                      # Postman collection
│
├── docker-compose.yml                # Cấu hình tất cả containers
├── .env.example                      # Template biến môi trường
├── .gitignore                        # Các file không commit
└── README.md                         # Tài liệu chính
```

---

## ⚠️ Thường Gặp & Cách Khắc Phục

### 1. Docker không khởi động được

**Triệu chứng:** `docker: command not found` hoặc Docker Desktop không mở

**Cách sửa:**
- Kiểm tra Docker Desktop đã cài: https://docs.docker.com/get-docker/
- Sau khi cài, mở Docker Desktop app (không chỉ cài CLI)
- Chờ Docker engine chạy xong (~1 phút)
- Test: `docker --version`

---

### 2. Port bị chiếm

**Triệu chứng:** 
```
Cannot assign requested address: bind: address already in use
```

**Cách sửa:**
```bash
# Tìm process đang dùng port
# Mac/Linux
lsof -i :8000

# Windows (PowerShell as Admin)
netstat -ano | findstr :8000

# Kill process (thay 1234 bằng PID thực)
kill -9 1234  # Mac/Linux
taskkill /PID 1234 /F  # Windows
```

Hoặc đổi port trong `docker-compose.yml`:
```yaml
api-gateway:
  ports:
    - "9000:8000"  # Thay 8000 → 9000
```

---

### 3. Database không kết nối được

**Triệu chứng:** 
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Cách sửa:**
```bash
# 1. Chắc chắn MySQL container chạy
docker-compose ps | grep mysql

# 2. Nếu chưa chạy
docker-compose up -d mysql-db

# 3. Chờ MySQL startup (kiểm tra logs)
docker-compose logs mysql-db

# 4. Test kết nối
docker-compose exec mysql-db mysql -uroot -proot -e "SELECT 1;"
```

---

### 4. npm install / node_modules lỗi

**Triệu chứng:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Cách sửa:**
```bash
# Xóa node_modules và lock file
rm -rf node_modules package-lock.json

# Cài lại (thêm --legacy-peer-deps nếu cần)
npm install --legacy-peer-deps

# Hoặc dùng yarn
yarn install
```

---

### 5. Service không respond / 503 error

**Triệu chứng:**
```
Service tạm thời không khả dụng
```

**Cách sửa:**
```bash
# 1. Kiểm tra log service
docker-compose logs identity-service

# 2. Restart service
docker-compose restart identity-service

# 3. Nếu vẫn lỗi, rebuild image
docker-compose up -d --build identity-service
```

---

## 🔒 Quy Tắc Bảo Mật

### ✅ LÀM

- ✅ Copy `.env.example` → `.env` rồi điền giá trị riêng
- ✅ Lưu JWT_SECRET an toàn (đừng share qua chat)
- ✅ Dùng `.env.example` để share cấu trúc biến với team
- ✅ Check `.gitignore` trước khi commit
- ✅ Dùng `git-secrets` hoặc `pre-commit` hook để kiểm tra

### ❌ KHÔNG LÀM

- ❌ Commit file `.env` lên GitHub
- ❌ Hardcode password vào code
- ❌ Share JWT_SECRET trong Slack/Teams
- ❌ Dùng mật khẩu "123456" hoặc "password" 
- ❌ Push database backup chứa real data lên GitHub

---

## 📞 Liên Hệ Hỗ Trợ

| Vấn đề | Liên hệ |
|---|---|
| Docker không chạy | Trưởng nhóm (Mac) |
| Database error | Thành viên phụ trách catalog/order |
| API routes | Thành viên BE tương ứng |
| Frontend logic | Thành viên FE |
| Git conflicts | Trưởng nhóm |

---

## 📚 Tài Liệu Tham Khảo

- **Docker Get Started:** https://docker-get-started.com
- **Node.js/Express:** https://expressjs.com
- **MySQL Guide:** https://dev.mysql.com/doc/
- **Postman Testing:** https://learning.postman.com
- **Microservices Pattern:** https://microservices.io

---

**✨ Happy Coding! ✨**
