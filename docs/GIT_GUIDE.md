# 🌳 GIT WORKFLOW GUIDE — Minh Giang Pharmacy

**Dành cho:** Toàn bộ team 4 người  
**Cấp độ:** Beginner → Intermediate  
**Cập nhật:** 21/03/2026

---

## 📋 Mục Lục

1. [Setup Lần Đầu](#setup-lần-đầu)
2. [Quy Trình Hàng Ngày](#quy-trình-hàng-ngày)
3. [Các Lệnh Thường Dùng](#các-lệnh-thường-dùng)
4. [Quy Trình Feature Workflow](#quy-trình-feature-workflow)
5. [Xử Lý Conflict](#xử-lý-conflict)
6. [Nâng Cao](#nâng-cao)
7. [Cheat Sheet](#cheat-sheet)

---

## 🔧 Setup Lần Đầu

### Bước 1: Clone Repository
```bash
cd ~/Documents  # Chọn folder để lưu project

git clone https://github.com/tangoctai2004/Minh-Giang-Pharmacy---Microservice.git

cd "Minh Giang Pharmacy"
```

### Bước 2: Config Git (nếu chưa làm)
```bash
# Đặt tên & email (bắt buộc để commit)
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"

# Xem lại cấu hình
git config --list | grep user
```

### Bước 3: Chọn Nhánh Của Mình
```bash
# Xem tất cả branch
git branch -a

# Chuyển sang nhánh service của mình
git checkout service/identity       # Nếu bạn là TV1 (phụ trách identity)
git checkout service/catalog        # Nếu bạn là TV2 (phụ trách catalog)
git checkout service/order          # Nếu bạn là TV3 (phụ trách order)
git checkout service/frontend       # Nếu bạn là TV4 (phụ trách frontend)
```

---

## 📅 Quy Trình Hàng Ngày

### Bắt Đầu Ngày Làm Việc

```bash
# 1. Về nhánh dev (nhánh tích hợp chung)
git checkout dev

# 2. Cập nhật code mới nhất từ GitHub
git pull origin dev

# 3. Chuyển sang nhánh service của mình
git checkout service/ten-service-cua-minh

# 4. Gộp code mới từ dev vào nhánh mình
# (để không bị lỗi khi merge sau)
git merge dev
```

### Trong Khi Code

```bash
# 1. Tạo nhánh tính năng mới
git checkout -b feature/chi-tiet-tinh-nang

# Ví dụ:
git checkout -b feature/product-crud
git checkout -b feature/login-authentication
git checkout -b feature/cart-management
```

**Lưu ý:** Tênnh branch phải:
- ✅ Dùng chữ thường
- ✅ Dùng dấu gạch ngang (-)
- ✅ Mô tả rõ tính năng
- ❌ Không dùng khoảng trắng, chữ hoa, emoji

### Code & Commit

```bash
# 1. Xem file đã thay đổi
git status

# 2. Stage file (chuẩn bị commit)
git add .                                    # Add tất cả file
# hoặc
git add backend/catalog-service/routes/      # Add chỉ 1 thư mục

# 3. Xem code sẽ commit (double check trước)
git diff --cached

# 4. Commit với message rõ ràng
git commit -m "feat: add product CRUD API"
git commit -m "fix: resolve JWT authentication bug"
git commit -m "style: format code with prettier"
git commit -m "docs: update README"
```

**Commit Message Format:**
```
<type>: <short description>

<optional longer explanation>
<list changes if needed>
```

**Types:**
- `feat:` — Thêm tính năng mới
- `fix:` — Sửa bug
- `docs:` — Cập nhật tài liệu
- `style:` — Format code, không thay đổi logic
- `refactor:` — Tái cấu trúc code
- `test:` — Thêm test
- `chore:` — Cập nhật dependencies, config

**Ví dụ:**
```bash
feat: implement product search API

- Add fuzzy search to product_name
- Add category filter
- Add pagination (limit, offset)

Closes #123
```

### Push & Tạo PR

```bash
# 1. Push nhánh lên GitHub
git push origin feature/product-crud

# 2. Vào GitHub web → tạo Pull Request
# - From: feature/product-crud
# - To: service/catalog (nhánh service của bạn)
# - Title: "feat: add product CRUD"
# - Description: mô tả chi tiết thay đổi

# 3. Tag trưởng nhóm để review
# Trong PR description: @tangoctai hoặc assign người

# 4. Chờ approved → bấm Merge (hoặc trưởng nhóm merge)
```

### Sau Khi Merge

```bash
# 1. Quay về service branch
git checkout service/catalog

# 2. Cập nhật lại (vừa merge feature vào đây)
git pull origin service/catalog

# 3. Xóa feature branch cũ (clean up)
git branch -d feature/product-crud

# Xóa luôn trên remote (GitHub)
git push origin --delete feature/product-crud
```

---

## ⚙️ Các Lệnh Thường Dùng

### Xem Trạng Thái

| Lệnh | Công dụng |
|---|---|
| `git status` | Xem file nào đã thay đổi |
| `git log --oneline` | Xem lịch sử commit (ngắn gọn) |
| `git log --oneline -5` | Xem 5 commit gần nhất |
| `git show HEAD` | Xem commit cuối cùng chi tiết |
| `git diff` | Xem nội dung thay đổi (chưa stage) |
| `git diff --cached` | Xem nội dung sẽ commit |
| `git branch` | Xem branch local |
| `git branch -a` | Xem tất cả branch (local + remote) |

### Stage & Commit

| Lệnh | Công dụng |
|---|---|
| `git add .` | Stage tất cả file |
| `git add file.js` | Stage 1 file |
| `git add folder/` | Stage 1 thư mục |
| `git reset` | Bỏ stage tất cả |
| `git reset file.js` | Bỏ stage 1 file |
| `git commit -m "msg"` | Commit với message |
| `git commit --amend` | Sửa commit cuối cùng |

### Branch & Merge

| Lệnh | Công dụng |
|---|---|
| `git checkout main` | Chuyển sang nhánh main |
| `git checkout -b feature/new` | Tạo nhánh mới + chuyển sang |
| `git branch -d old-branch` | Xóa branch |
| `git merge dev` | Gộp dev vào nhánh hiện tại |

### Push & Pull

| Lệnh | Công dụng |
|---|---|
| `git pull origin dev` | Kéo code mới từ GitHub |
| `git push origin feature/abc` | Đẩy nhánh lên GitHub |
| `git fetch` | Cập nhật thông tin từ GitHub (không merge) |
| `git push origin --delete branch` | Xóa nhánh trên GitHub |

---

## 🔄 Quy Trình Feature Workflow

### Sơ Đồ

```
1. Về dev → Pull code mới
   ↓
2. Checkout service branch của mình
   ↓
3. Merge dev (để có code mới nhất)
   ↓
4. Tạo feature branch mới
   ↓
5. Code & commit
   ↓
6. Push lên GitHub
   ↓
7. Tạo PR: feature → service
   ↓
8. Chờ trưởng nhóm review & approve
   ↓
9. Merge vào service branch
   ↓
10. Xóa feature branch (local + remote)
   ↓
11. Lặp lại từ bước 3
```

### Ví Dụ Cụ Thể (TV2 - Catalog)

```bash
# ═══ Ngày 1 ═══

# 1. Chuẩn bị environment
git checkout dev && git pull origin dev    # Cập nhật dev
git checkout service/catalog               # Về service branch
git merge dev                              # Gộp dev vào

# 2. Tạo tính năng mới
git checkout -b feature/product-pagination

# 3. Code...
# Sửa file: backend/catalog-service/routes/products.js
# Sửa file: backend/catalog-service/db/queries.js

# 4. Check lại trước commit
git status                     # Xem file đã sửa
git diff                       # Xem nội dung thay đổi

# 5. Commit từng chức năng nhỏ (atomic commits)
git add backend/catalog-service/routes/
git commit -m "feat: add pagination params to products API"

git add backend/catalog-service/db/
git commit -m "refactor: implement pagination query"

# 6. Push lên
git push origin feature/product-pagination

# ═══ Trên GitHub: Tạo PR, tag trưởng nhóm, chờ review ═══

# ═══ Ngày 2: Trưởng nhóm approved ═══

# 7. Merge (có thể do bạn hoặc trưởng nhóm)
git checkout service/catalog
git merge feature/product-pagination
git push origin service/catalog

# 8. Clean up
git branch -d feature/product-pagination
git push origin --delete feature/product-pagination

# 9. Ready cho feature tiếp theo
git merge dev              # Cập nhật dev lại
git checkout -b feature/product-filter
```

---

## 💥 Xử Lý Conflict

### Khi Nào Xảy Ra?

Khi 2 người sửa cùng 1 file → Git không biết phải giữ ai → **Conflict**

### Cách Giải Quyết

**Skenario:** Bạn merge dev vào feature branch, có conflict

```bash
# 1. Xem file nào có conflict
git status                    # Sẽ thấy "both modified: file.js"

# 2. Mở file đó (VS Code sẽ highlight)
# Sẽ thấy:
# <<<<<<< HEAD
#   ... code của bạn ...
# =======
#   ... code từ dev ...
# >>>>>>> dev

# 3. Chọn cái nào:
# Option 1: Giữ code của bạn → xóa khúc dev
# Option 2: Giữ code dev → xóa khúc của bạn
# Option 3: Gộp cả 2 (thường là trường hợp này)

# Sau khi sửa xong:

# 4. Stage file
git add file.js

# 5. Commit (git tự động tạo commit message)
git commit -m "merge: resolve conflict in file.js"

# 6. Push
git push origin feature/abc
```

### Tránh Conflict

```bash
# 1. Pull dev thường xuyên
git checkout dev
git pull origin dev
git checkout feature/abc
git merge dev          # Làm sớm để catch conflict sớm

# 2. Commit atomic (nhỏ, rõ )
# ✅ Tốt: Nhiều commit nhỏ
git commit -m "add API endpoint"
git commit -m "add test case"
git commit -m "add docs"

# ❌ Xấu: 1 commit khổng lồ
git commit -m "update everything"

# 3. Communicate với team
# "Mình đang sửa file X, bạn tránh sửa nhé"
```

---

## 🚀 Nâng Cao

### Xem Chi Tiết Commit

```bash
# Xem chi tiết 1 commit
git show abc1234

# Xem tác giả & thời gian mỗi dòng (blame)
git blame file.js

# Xem thay đổi giữa 2 commit
git diff abc1234 def5678
```

### Undo Thay Đổi

```bash
# Quay lại file cũ (chưa commit)
git restore file.js
# hoặc
git checkout -- file.js

# Quay lại toàn bộ (chưa commit)
git restore .

# Undo commit cuối (giữ code)
git reset HEAD~1

# Undo commit cuối (xóa code)
git reset --hard HEAD~1
```

### Rebase (Advanced)

```bash
# Gom commit lại (2 commit → 1 commit)
git rebase -i HEAD~2

# Thay lịch sử (nếu force push shared branch ⚠️ CAREFUL)
git rebase origin/dev
git push --force-with-lease
```

### Stash (Cất Code Tạm Thời)

```bash
# Cất code chưa commit (để switch branch)
git stash

# Lấy lại
git stash pop          # Cất mới nhất
git stash pop stash@{0}  # Cất cụ thể

# List cất
git stash list
```

---

## 📝 Cheat Sheet

### Quick Reference

```bash
# ═══ DAILY WORKFLOW ═══
git status                          # Check current state
git pull origin dev                 # Get latest code
git checkout -b feature/name        # New feature
git add .                           # Stage changes
git commit -m "msg"                 # Commit
git push origin feature/name        # Push
# → Create PR on GitHub

# ═══ UPDATE FROM DEV ═══
git checkout dev && git pull origin dev  # Update dev
git checkout service/abc                 # Back to service
git merge dev                            # Get latest

# ═══ IF CONFLICT ═══
git status                  # See conflicts
# → Fix files manually
git add .                   # Stage fixed files
git commit -m "resolve conflict"
git push

# ═══ CLEANUP ═══
git branch -d feature/old
git push origin --delete feature/old

# ═══ UNDO MISTAKES ═══
git restore file.js                 # Undo file change
git reset HEAD~1                    # Undo last commit (keep code)
git reset --hard HEAD~1             # Undo last commit (delete)

# ═══ VIEW HISTORY ═══
git log --oneline -10               # Last 10 commits
git show HEAD                       # See last commit
git diff HEAD~1                     # Changes in last commit
```

---

## 🎓 Best Practices

### ✅ LÀM

- ✅ Commit thường xuyên (mỗi tính năng nhỏ)
- ✅ Write clear commit messages
- ✅ Pull dev trước lúc bắt đầu
- ✅ Merge dev thường xuyên (mỗi ngày)
- ✅ Tạo PR để review trước merge
- ✅ Xóa feature branch sau merge
- ✅ Tag trưởng nhóm trong PR
- ✅ Test code trước push

### ❌ KHÔNG LÀM

- ❌ Commit `.env` hoặc secrets
- ❌ Commit khổng lồ (300+ file một lúc)
- ❌ Message commit = "update", "fix bug", "asdf"
- ❌ Push trực tiếp vào main/dev (luôn dùng PR)
- ❌ Merge conflict mà không hiểu
- ❌ Force push vào shared branch
- ❌ Delete branch của người khác
- ❌ Hardcode credentials trong code

---

## 🆘 Gặp Vấn Đề? Hỏi Ai?

| Vấn đề | Liên hệ |
|---|---|
| Git command khó hiểu | Trưởng nhóm + file này |
| Merge conflict không fix được | Trưởng nhóm |
| Vô tình commit .env | Trưởng nhóm → xem SECURITY.md |
| Push sai branch | Trưởng nhóm (force push lại) |
| GitHub permission | Trưởng nhóm |

---

## 📚 Tài Liệu Tham Khảo

- **Hướng dẫn Git cơ bản:** https://git-scm.com/book
- **GitHub Git Guide:** https://github.github.com/training-kit/
- **Conventional Commits:** https://www.conventionalcommits.org
- **Git branching model:** https://nvie.com/posts/a-successful-git-branching-model/

---

## 🎯 Next Steps

1. **Xem lại lệnh thường dùng** (Cheat Sheet)
2. **Practice với mỗi commit** (theo quy trình hàng ngày)
3. **Hỏi trưởng nhóm nếu confuse**
4. **Đọc SECURITY.md** (quan trọng!)

---

**🌳 Happy Gitting! Keep commits clean, history clear. 🌳**

---

*Last updated: 21/03/2026*  
*Version: 1.0*  
*For: Minh Giang Pharmacy Team*
