# 🔒 SECURITY.md — Hướng Dẫn Bảo Mật

Tài liệu này hướng dẫn các biện pháp bảo mật khi làm việc với dự án Minh Giang Pharmacy.

---

## 📋 Mục Lục

1. [Secrets Management](#secrets-management)
2. [Git Security](#git-security)
3. [Code Review Checklist](#code-review-checklist)
4. [Sensitive Files Whitelist](#sensitive-files-whitelist)
5. [Pre-commit Hooks](#pre-commit-hooks)

---

## 🔐 Secrets Management

### File `.env` — Quy Tắc Bắt Buộc

**✅ LÀM:**
```bash
# 1. Copy template từ .env.example
cp .env.example .env

# 2. Điền vào các giá trị nhạy cảm (local development)
cat .env
# JWT_SECRET=your_local_test_value
# SMTP_USER=your_test_email@gmail.com
# SMTP_PASS=your_app_password
```

**❌ KHÔNG LÀM:**
```bash
# ❌ Commit file .env
git add .env
git commit -m "add .env"  # NEVER do this!

# ❌ Hardcode secrets trong code
const JWT_SECRET = "my-super-secret-key";

# ❌ Share .env file via chat/email
# Nếu bạn cần chia sẻ config, dùng .env.example
```

### Biến Môi Trường Bắt Buộc

| Biến | Loại | Ví dụ | Bảo vệ |
|---|---|---|---|
| `JWT_SECRET` | Sensitive | `abc123def456...` | ⚠️ Bắt buộc giữ bí mật |
| `SMTP_PASS` | Sensitive | `your_app_password` | ⚠️ Bắt buộc giữ bí mật |
| `DB_PASS` | Sensitive | `root` (dev) | ⚠️ Bắt buộc giữ bí mật |
| `CORS_ORIGIN` | Public | `http://localhost:3000` | ✅ OK public |
| `PORT` | Public | `8001` | ✅ OK public |

---

## 🔒 Git Security

### 1. Checklist Trước Khi Commit

**Bước 1: Xem files sẽ commit**
```bash
git status
git diff --cached
```

Chắc chắn **KHÔNG** thấy:
- ❌ `.env` file
- ❌ `*.pem`, `*.key` (private keys)
- ❌ `credentials.json`, `oauth.json`
- ❌ Database password trong code
- ❌ API keys, tokens

**Bước 2: Commit chỉ code cần thiết**
```bash
# ✅ Thêm .gitignore sẽ tự bỏ các file nhạy cảm
git add .

# Nếu có ngos ngớc, bỏ nó
git reset backend/api-gateway/.env

# Commit
git commit -m "feat: add authentication"
```

### 2. Nếu Vô Tình Commit Secrets

**⚠️ ACTION ITEMS:**
```bash
# Step 1: Xoá file khỏi git history
git rm --cached backend/api-gateway/.env

# Step 2: Thêm vào .gitignore
echo ".env" >> .gitignore

# Step 3: Commit thay đổi
git add .gitignore
git commit -m "fix: remove .env from tracking"

# Step 4: Force push (CAREFUL: only on feature branches)
git push --force-with-lease origin feature/your-branch

# Step 5: Regenerate secrets (nếu secrets đã public)
# - Thay đổi JWT_SECRET trong tất cả services
# - Thay đổi mật khẩu SMTP
# - Báo cáo cho trưởng nhóm
```

**Hoặc dùng BFG Repo-Cleaner (nếu secrets lên main):**
```bash
# Cài BFG
brew install bfg  # Mac
# hoặc tải từ https://rtyley.github.io/bfg-repo-cleaner/

# Xoá file khỏi toàn bộ history
bfg --delete-files .env

# Dọn dẹp
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push --force
```

---

## ✅ Code Review Checklist

Trưởng nhóm **PHẢI** check điểm này trước khi approve PR:

```
□ Không có file .env được commit
□ Không hardcode secrets/passwords/API keys
□ Không có comments chứa sensitive data
□ .gitignore bao gồm node_modules/, dist/, build/
□ Không có database credentials trong code
□ Không có private keys (*.pem, *.key)
□ Error messages không leak nhạy cảm (vd: password)
□ Logs không in sensitive data
□ API responses không return password_hash
```

---

## 📋 Sensitive Files Whitelist

### Files nhạy cảm — PHỈ LUÔN BỊ IGNORE

| File / Folder | Tại Sao | Action |
|---|---|---|
| `.env` | Chứa secrets | ✅ Có trong .gitignore |
| `*.pem`, `*.key` | SSL/TLS private keys | ✅ Có trong .gitignore |
| `credentials.json` | Service account credentials | ✅ Có trong .gitignore |
| `node_modules/` | Dependencies (100MB+) | ✅ Có trong .gitignore |
| `.vscode/settings.json` | Local editor config | ✅ Có trong .gitignore |
| `dist/`, `build/` | Build outputs | ✅ Có trong .gitignore |

### Files ĐƯỢC phép commit

| File | Tại Sao |
|---|---|
| `.env.example` | Template để team biết cần các biến gì |
| `.gitignore` | Config để bảo vệ files nhạy cảm |
| `docker-compose.yml` | Infrastructure as Code (no secrets) |
| `package.json` | Dependencies (versioned) |
| `Dockerfile` | Build configuration |

---

## 🚀 Pre-commit Hooks (Tùy Chọn - Nâng Cao)

Nếu muốn tự động kiểm tra secrets trước khi commit:

### Setup git-secrets (Mac/Linux)

```bash
# 1. Cài đặt
brew install git-secrets  # Mac
apt-get install git-secrets  # Ubuntu

# 2. Cấu hình cho repo này
cd "Minh Giang Pharmacy"
git secrets --install

# 3. Thêm pattern tìm secrets
git secrets --add -a '\.env'
git secrets --add -a 'JWT_SECRET.*='
git secrets --add -a 'password.*='

# 4. Test
git secrets --scan  # scan history
git secrets --scan-history  # scan all commits

# 5. Mỗi commit sẽ tự động check
# Nếu có secrets, commit sẽ bị block
```

### Hoặc dùng pre-commit framework (Python)

```bash
# Cài đặt
pip install pre-commit

# Tạo file .pre-commit-config.yaml
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: detect-private-key
      - id: detect-aws-credentials
      - id: check-merge-conflict
      
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
EOF

# Setup hooks
pre-commit install

# Test
pre-commit run --all-files
```

---

## 🔍 Scan Hiện Tại

Kết quả scan bảo mật dự án:

```
✅ .gitignore: Chuẩn, bao gồm .env, node_modules/, .vscode/, .idea/
❌ backend/api-gateway/.env: Phát hiện (untracked - không commit được)
✅ Không tìm thấy hardcoded secrets trong code
✅ Không tìm thấy *.pem, *.key files
✅ .env.example: Có (thật tốt)
```

**Action:** Cộng đồng phải đảm bảo .env local không bao giờ commit.

---

## 📞 Liability 

**Nếu secrets bị leak:**

1. **Báo cáo ngay:** Slack/email cho trưởng nhóm trong 24h
2. **Regenerate:** Thay đổi JWT_SECRET, mật khẩu SMTP
3. **Audit:** Ai access được secret đó
4. **Remove:** Xoá khỏi git history nếu cần

---

## 📚 Tài Liệu Tham Khảo

- **OWASP Secrets Management:** https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **GitHub Secret Scanning:** https://docs.github.com/en/code-security/secret-scanning
- **git-secrets:** https://github.com/awslabs/git-secrets
- **pre-commit:** https://pre-commit.com/

---

**🔒 Remember: Security is Everyone's Responsibility!**
