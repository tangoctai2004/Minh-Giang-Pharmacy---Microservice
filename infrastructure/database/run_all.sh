#!/usr/bin/env bash
# =============================================================================
# run_all.sh — Khởi tạo hoàn chỉnh database Nhà Thuốc Minh Giang vào Docker
# Sử dụng: bash infrastructure/database/run_all.sh
#          (chạy từ thư mục gốc dự án)
# =============================================================================
set -euo pipefail

CONTAINER="minhgiang_mysql"
DB_USER="root"
DB_PASS="root"
DB_DIR="$(dirname "$0")"

# Danh sách file theo thứ tự thực thi
FILES=(
  "mg_identity.sql"
  "mg_catalog.sql"
  "mg_order.sql"
  "mg_cms.sql"
  "mg_notification.sql"
  "mg_security_patches.sql"
)

echo "================================================"
echo " Nhà Thuốc Minh Giang — Database Init Script"
echo "================================================"

# Kiểm tra container đang chạy
if ! docker ps --filter "name=${CONTAINER}" --filter "status=running" --format '{{.Names}}' | grep -q "${CONTAINER}"; then
  echo "❌ Container '${CONTAINER}' chưa chạy."
  echo "   Khởi động với: docker-compose up -d"
  exit 1
fi

echo "✅ Container '${CONTAINER}' đang chạy."
echo ""

TOTAL=${#FILES[@]}
COUNT=0

for FILE in "${FILES[@]}"; do
  FILEPATH="${DB_DIR}/${FILE}"
  COUNT=$((COUNT + 1))
  
  if [ ! -f "$FILEPATH" ]; then
    echo "⚠️  [${COUNT}/${TOTAL}] Bỏ qua: ${FILE} (không tìm thấy file)"
    continue
  fi

  echo -n "▶  [${COUNT}/${TOTAL}] Đang chạy ${FILE} ... "
  
  if docker exec -i "${CONTAINER}" mysql \
       --user="${DB_USER}" \
       --password="${DB_PASS}" \
       --default-character-set=utf8mb4 \
       < "${FILEPATH}" 2>/dev/null; then
    echo "✅ OK"
  else
    echo "❌ LỖI"
    echo ""
    echo "Chi tiết lỗi của ${FILE}:"
    docker exec -i "${CONTAINER}" mysql \
      --user="${DB_USER}" \
      --password="${DB_PASS}" \
      --default-character-set=utf8mb4 \
      < "${FILEPATH}"
    exit 1
  fi
done

echo ""
echo "================================================"
echo " Tất cả ${TOTAL} file thực thi thành công!"
echo "================================================"
echo ""
echo "Thống kê schemas:"
docker exec -i "${CONTAINER}" mysql \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  --default-character-set=utf8mb4 \
  --table \
  -e "
SELECT TABLE_SCHEMA AS 'Schema', COUNT(*) AS 'Số bảng'
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_SCHEMA IN ('mg_identity','mg_catalog','mg_order','mg_cms','mg_notification')
GROUP  BY TABLE_SCHEMA
ORDER  BY TABLE_SCHEMA;

SELECT COUNT(*) AS 'TỔNG SỐ BẢNG'
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_SCHEMA IN ('mg_identity','mg_catalog','mg_order','mg_cms','mg_notification');
" 2>/dev/null
