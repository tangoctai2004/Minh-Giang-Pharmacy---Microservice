#!/usr/bin/env bash
# =============================================================================
# run_clean.sh — Khởi tạo database Nhà Thuốc Minh Giang ở chế độ SẠCH
# (Chỉ giữ lại danh mục thuốc, bài viết CMS và cấu hình tĩnh; không có giao dịch/lô hàng)
# Sử dụng: bash infrastructure/database/run_clean.sh (chạy từ thư mục gốc dự án)
# =============================================================================
set -euo pipefail

CONTAINER="minhgiang_mysql"
DB_USER="root"
DB_PASS="root"
DB_DIR="$(dirname "$0")"

# Danh sách file thực thi cho chế độ SẠCH
FILES=(
  "schemas/01_mg_identity.sql"
  "schemas/02_mg_catalog.sql"
  "schemas/03_mg_order.sql"
  "schemas/04_mg_cms.sql"
  "schemas/05_mg_notification.sql"
  "seeds/01_seed_full_catalog.sql"
  "seeds/02_seed_clean_catalog_products.sql"
  "seeds/03_seed_clean_cms_content.sql"
  "seeds/04_seed_disease_categories.sql"
  "seeds/05_seed_demo_promotions.sql"
  "seeds/06_seed_product_tag_promotions.sql"
  "seeds/07_seed_demo_baseline_clean.sql"
)

echo "========================================================"
echo " Nhà Thuốc Minh Giang — Database Clean Init Script"
echo " (Chế độ: Sạch hoàn toàn - Không giao dịch/lô nhập)"
echo "========================================================"

# Tự động phát hiện môi trường chạy (Host hoặc Container)
USE_DOCKER=false
if command -v docker &> /dev/null; then
  USE_DOCKER=true
fi

if [ "$USE_DOCKER" = true ]; then
  # Kiểm tra container đang chạy (chỉ áp dụng khi chạy từ Host)
  if ! docker ps --filter "name=${CONTAINER}" --filter "status=running" --format '{{.Names}}' | grep -q "${CONTAINER}"; then
    echo "❌ Container '${CONTAINER}' chưa chạy."
    echo "   Khởi động với: docker-compose up -d"
    exit 1
  fi
  echo "✅ Phát hiện chạy từ Host. Container '${CONTAINER}' đang chạy."
else
  echo "✅ Phát hiện chạy trực tiếp (trong Container hoặc Local MySQL)."
fi
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
  
  # Thực thi file SQL
  if [ "$USE_DOCKER" = true ]; then
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
  else
    if mysql \
         --user="${DB_USER}" \
         --password="${DB_PASS}" \
         --default-character-set=utf8mb4 \
         < "${FILEPATH}" 2>/dev/null; then
      echo "✅ OK"
    else
      echo "❌ LỖI"
      echo ""
      echo "Chi tiết lỗi của ${FILE}:"
      mysql \
        --user="${DB_USER}" \
        --password="${DB_PASS}" \
        --default-character-set=utf8mb4 \
        < "${FILEPATH}"
      exit 1
    fi
  fi
done

echo ""
echo "========================================================"
echo " Khởi tạo Database sạch thành công!"
echo " Hệ thống đã sẵn sàng cho hoạt động thực tế."
echo "========================================================"
echo ""
echo "Thống kê schemas:"

STATS_QUERY="
SELECT TABLE_SCHEMA AS 'Schema', COUNT(*) AS 'Số bảng'
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_SCHEMA IN ('mg_identity','mg_catalog','mg_order','mg_cms','mg_notification')
GROUP  BY TABLE_SCHEMA
ORDER  BY TABLE_SCHEMA;

SELECT COUNT(*) AS 'TỔNG SỐ BẢNG'
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_SCHEMA IN ('mg_identity','mg_catalog','mg_order','mg_cms','mg_notification');
"

if [ "$USE_DOCKER" = true ]; then
  docker exec -i "${CONTAINER}" mysql \
    --user="${DB_USER}" \
    --password="${DB_PASS}" \
    --default-character-set=utf8mb4 \
    --table \
    -e "${STATS_QUERY}" 2>/dev/null || true
else
  mysql \
    --user="${DB_USER}" \
    --password="${DB_PASS}" \
    --default-character-set=utf8mb4 \
    --table \
    -e "${STATS_QUERY}" 2>/dev/null || true
fi
