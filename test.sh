#!/bin/bash
# Unified test runner for Minh Giang Pharmacy Microservices

AUTH_BASE="http://localhost:8000/api/identity"
ORDER_BASE="http://localhost:8000/api/order"
CMS_BASE="http://localhost:8000/api/cms"

GLOBAL_PASS=0
GLOBAL_FAIL=0

# Helper functions
ok() {
  echo "  ✅ $1"
  GLOBAL_PASS=$((GLOBAL_PASS+1))
}

ng() {
  echo "  ❌ $1 → $2"
  GLOBAL_FAIL=$((GLOBAL_FAIL+1))
}

chk() {
  local name=$1 expect=$2 resp=$3
  local val=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  if [ "$val" = "$expect" ]; then
    ok "$name"
  else
    ng "$name" "$(echo "$resp" | head -c 100)"
  fi
}

get_admin_token() {
  local resp=$(curl -s $AUTH_BASE/auth/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
  echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null
}

run_identity_tests() {
  echo ""
  echo "══════════════════════════════════════"
  echo "  1. AUTH & IDENTITY SERVICE TESTS"
  echo "══════════════════════════════════════"

  # GET Token
  local R=$(curl -s $AUTH_BASE/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
  chk "POST /auth/login (username)" "True" "$R"

  R=$(curl -s $AUTH_BASE/auth/login -H 'Content-Type: application/json' -d '{"email_or_phone":"admin@minhgiangpharma.vn","password":"admin123"}')
  chk "POST /auth/login (email_or_phone)" "True" "$R"

  R=$(curl -s $AUTH_BASE/auth/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
  chk "POST /auth/admin/login" "True" "$R"
  local ADMIN_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

  R=$(curl -s $AUTH_BASE/auth/admin/login -H 'Content-Type: application/json' -d '{"username":"thugan_minh","password":"x"}')
  chk "POST /auth/admin/login (reject cashier)" "False" "$R"

  R=$(curl -s $AUTH_BASE/auth/pos/verify-pin -H 'Content-Type: application/json' -d '{"user_code":"x","pin":"y","kiosk_id":"z"}')
  chk "POST /auth/pos/verify-pin (route ok)" "False" "$R"

  R=$(curl -s $AUTH_BASE/auth/login-pos -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123","kiosk_id":"POS-01"}')
  chk "POST /auth/login-pos (legacy)" "False" "$R"

  local RANDOM_EMAIL="regtest_${RANDOM}@test.com"
  local RANDOM_PHONE="09$(python3 -c "import random; print(''.join([str(random.randint(0,9)) for _ in range(8)]))")"
  R=$(curl -s $AUTH_BASE/auth/register -H 'Content-Type: application/json' -d '{"full_name":"RegTest","email":"'$RANDOM_EMAIL'","phone":"'$RANDOM_PHONE'","password":"Test@123"}')
  chk "POST /auth/register" "True" "$R"

  local OTP_CODE=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data', {}).get('otp', {}).get('code', ''))" 2>/dev/null)
  if [ -n "$OTP_CODE" ]; then
    curl -s -X POST $AUTH_BASE/auth/verify-otp -H 'Content-Type: application/json' -d '{"target":"'$RANDOM_EMAIL'","target_type":"email","purpose":"register","otp_code":"'$OTP_CODE'"}' >/dev/null
  fi

  R=$(curl -s $AUTH_BASE/auth/login -H 'Content-Type: application/json' -d '{"email_or_phone":"'$RANDOM_EMAIL'","password":"Test@123"}')
  chk "POST /auth/login (customer)" "True" "$R"
  local CUST_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
  local CUST_REFRESH=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
  local CUST_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['customer']['id'])" 2>/dev/null)

  if [ -n "$ADMIN_TOKEN" ]; then
    R=$(curl -s $AUTH_BASE/customers -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /customers (admin list)" "True" "$R"

    R=$(curl -s $AUTH_BASE/customers/$CUST_ID -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /customers/:id" "True" "$R"

    R=$(curl -s -X PUT $AUTH_BASE/customers/$CUST_ID -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"full_name":"Test Verified2"}')
    chk "PUT /customers/:id" "True" "$R"

    R=$(curl -s $AUTH_BASE/shifts -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /shifts" "True" "$R"

    R=$(curl -s -X POST $AUTH_BASE/shifts/open -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"kiosk_id\":\"TEST-$RANDOM\",\"opening_cash\":100000}")
    chk "POST /shifts/open (new alias)" "True" "$R"
    local NEW_SHIFT=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

    if [ -n "$NEW_SHIFT" ]; then
      R=$(curl -s $AUTH_BASE/shifts/$NEW_SHIFT -H "Authorization: Bearer $ADMIN_TOKEN")
      chk "GET /shifts/:id" "True" "$R"

      R=$(curl -s -X PUT $AUTH_BASE/shifts/$NEW_SHIFT/close -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"closing_cash":150000}')
      chk "PUT /shifts/:id/close" "True" "$R"
    fi

    R=$(curl -s $AUTH_BASE/roles -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /roles" "True" "$R"

    R=$(curl -s $AUTH_BASE/users -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /users" "True" "$R"
  else
    echo "  ⚠️ Warning: Admin token unavailable. Admin Identity tests skipped."
  fi

  if [ -n "$CUST_TOKEN" ]; then
    R=$(curl -s $AUTH_BASE/customers/me -H "Authorization: Bearer $CUST_TOKEN")
    chk "GET /customers/me" "True" "$R"

    R=$(curl -s -X PUT $AUTH_BASE/customers/me -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{"full_name":"Test Verified"}')
    chk "PUT /customers/me (new)" "True" "$R"

    R=$(curl -s $AUTH_BASE/customers/$CUST_ID/addresses -H "Authorization: Bearer $CUST_TOKEN")
    chk "GET /customers/:id/addresses" "True" "$R"

    R=$(curl -s -X PUT $AUTH_BASE/auth/change-password -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{"current_password":"Test@123","new_password":"Test@000","confirm_password":"Test@000"}')
    chk "PUT /auth/change-password" "True" "$R"

    R=$(curl -s $AUTH_BASE/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$CUST_REFRESH\"}")
    chk "POST /auth/refresh" "True" "$R"

    R=$(curl -s $AUTH_BASE/auth/logout -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$CUST_REFRESH\"}")
    chk "POST /auth/logout" "True" "$R"

    R=$(curl -s $AUTH_BASE/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$CUST_REFRESH\"}")
    chk "POST /auth/refresh (reject after logout)" "False" "$R"
  fi
}

run_cms_tests() {
  echo ""
  echo "══════════════════════════════════════"
  echo "  2. CMS SERVICE TESTS"
  echo "══════════════════════════════════════"

  # Public APIs
  local R=$(curl -s "$CMS_BASE/store-config/public")
  chk "GET /store-config/public" "True" "$R"

  R=$(curl -s "$CMS_BASE/banners?position=hero")
  chk "GET /banners" "True" "$R"

  R=$(curl -s "$CMS_BASE/disease-categories?level=root")
  chk "GET /disease-categories" "True" "$R"

  R=$(curl -s "$CMS_BASE/diseases/search?q=gout")
  chk "GET /diseases/search" "True" "$R"

  R=$(curl -s "$CMS_BASE/articles")
  chk "GET /articles" "True" "$R"

  R=$(curl -s "$CMS_BASE/trending-searches")
  chk "GET /trending-searches" "True" "$R"

  R=$(curl -s -X POST "$CMS_BASE/trending-searches/track" -H 'Content-Type: application/json' -d '{"keyword":"panadol"}')
  chk "POST /trending-searches/track" "True" "$R"

  # Admin APIs (needs Admin token)
  local ADMIN_TOKEN=$(get_admin_token)
  if [ -n "$ADMIN_TOKEN" ]; then
    R=$(curl -s "$CMS_BASE/articles/admin" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /articles/admin" "True" "$R"

    R=$(curl -s -X POST "$CMS_BASE/articles" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"title\":\"Bài viết test tự động CMS $(date +%s)\",\"category_id\":1,\"content\":\"<p>Nội dung bài viết test tự động</p>\",\"excerpt\":\"Tóm tắt bài viết test\",\"status\":\"draft\",\"tags\":[\"test-cms\"]}")
    chk "POST /articles (create)" "True" "$R"
    local ARTICLE_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id', ''))" 2>/dev/null)

    if [ -n "$ARTICLE_ID" ]; then
      R=$(curl -s -X PUT "$CMS_BASE/articles/$ARTICLE_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H 'Content-Type: application/json' \
        -d '{"title":"Bài viết test tự động CMS - Đã cập nhật"}')
      chk "PUT /articles/:id (update)" "True" "$R"

      R=$(curl -s -X DELETE "$CMS_BASE/articles/$ARTICLE_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
      chk "DELETE /articles/:id (delete)" "True" "$R"
    fi

    R=$(curl -s "$CMS_BASE/banners/admin" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /banners/admin" "True" "$R"

    R=$(curl -s "$CMS_BASE/store-config" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /store-config" "True" "$R"

    R=$(curl -s "$CMS_BASE/promotions/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /promotions/stats" "True" "$R"

    R=$(curl -s "$CMS_BASE/promotions" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /promotions (list)" "True" "$R"

    R=$(curl -s "$CMS_BASE/loyalty/tiers" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /loyalty/tiers" "True" "$R"

    R=$(curl -s "$CMS_BASE/loyalty/config" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /loyalty/config" "True" "$R"

    R=$(curl -s "$CMS_BASE/loyalty/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /loyalty/stats" "True" "$R"
  else
    echo "  ⚠️ Warning: Admin token unavailable. Admin CMS tests skipped."
  fi
}

run_order_tests() {
  echo ""
  echo "══════════════════════════════════════"
  echo "  3. ORDER SERVICE TESTS"
  echo "══════════════════════════════════════"

  # Register & Login Customer
  local RANDOM_EMAIL="order_test_${RANDOM}@test.com"
  local PHONE="08$(python3 -c "import random; print(''.join([str(random.randint(0,9)) for _ in range(8)]))")"
  local R=$(curl -s $AUTH_BASE/auth/register -H 'Content-Type: application/json' -d '{"full_name":"Order Tester","email":"'$RANDOM_EMAIL'","phone":"'$PHONE'","password":"Test@123"}')
  local OTP_CODE=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data', {}).get('otp', {}).get('code', ''))" 2>/dev/null)
  if [ -n "$OTP_CODE" ]; then
    curl -s -X POST $AUTH_BASE/auth/verify-otp -H 'Content-Type: application/json' -d '{"target":"'$RANDOM_EMAIL'","target_type":"email","purpose":"register","otp_code":"'$OTP_CODE'"}' >/dev/null
  fi
  R=$(curl -s $AUTH_BASE/auth/login -H 'Content-Type: application/json' -d '{"email_or_phone":"'$RANDOM_EMAIL'","password":"Test@123"}')
  local CUST_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

  if [ -z "$CUST_TOKEN" ]; then
    echo "  ❌ Fail: Cannot get customer token. Skipping Order tests."
    GLOBAL_FAIL=$((GLOBAL_FAIL+1))
    return 1
  fi

  # Cart Tests
  R=$(curl -s $ORDER_BASE/cart -H "Authorization: Bearer $CUST_TOKEN")
  chk "GET /cart" "True" "$R"

  R=$(curl -s -X POST $ORDER_BASE/cart/items -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{"product_id":1, "product_name":"Thuốc Test", "quantity":2, "unit_name":"Hộp", "unit_price":50000}')
  chk "POST /cart/items" "True" "$R"
  local ITEM_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id', ''))" 2>/dev/null)

  R=$(curl -s $ORDER_BASE/cart -H "Authorization: Bearer $CUST_TOKEN")
  chk "GET /cart (with items)" "True" "$R"

  # Checkout Tests
  R=$(curl -s -X POST $ORDER_BASE/checkout -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{
      "customer_name": "Test Customer",
      "customer_phone": "'$PHONE'",
      "shipping_address": "123 Test St, Phường Phương Lâm, Thành phố Hòa Bình, Tỉnh Hòa Bình",
      "payment_method": "cod",
      "shipping_fee": 0
  }')
  chk "POST /checkout" "True" "$R"
  local ORDER_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('order_id', ''))" 2>/dev/null)

  # Orders Tests
  R=$(curl -s $ORDER_BASE/orders -H "Authorization: Bearer $CUST_TOKEN")
  chk "GET /orders" "True" "$R"

  R=$(curl -s $ORDER_BASE/orders/stats -H "Authorization: Bearer $CUST_TOKEN")
  chk "GET /orders/stats" "True" "$R"

  if [ -n "$ORDER_ID" ]; then
    R=$(curl -s $ORDER_BASE/orders/$ORDER_ID -H "Authorization: Bearer $CUST_TOKEN")
    chk "GET /orders/:id" "True" "$R"
  fi
}

run_promotions_tests() {
  echo ""
  echo "══════════════════════════════════════"
  echo "  4. PROMOTIONS & LOYALTY TESTS"
  echo "══════════════════════════════════════"

  local RANDOM_EMAIL="promo_test_${RANDOM}@test.com"
  local PHONE="09$(python3 -c "import random; print(''.join([str(random.randint(0,9)) for _ in range(8)]))")"
  local R=$(curl -s $AUTH_BASE/auth/register -H 'Content-Type: application/json' -d '{"full_name":"Tester Khuyến Mãi","email":"'$RANDOM_EMAIL'","phone":"'$PHONE'","password":"Test@123"}')
  local OTP_CODE=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data', {}).get('otp', {}).get('code', ''))" 2>/dev/null)
  if [ -n "$OTP_CODE" ]; then
    curl -s -X POST $AUTH_BASE/auth/verify-otp -H 'Content-Type: application/json' -d '{"target":"'$RANDOM_EMAIL'","target_type":"email","purpose":"register","otp_code":"'$OTP_CODE'"}' >/dev/null
  fi
  R=$(curl -s $AUTH_BASE/auth/login -H 'Content-Type: application/json' -d '{"email_or_phone":"'$RANDOM_EMAIL'","password":"Test@123"}')
  local CUST_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

  if [ -z "$CUST_TOKEN" ]; then
    echo "  ❌ Fail: Cannot get customer token. Skipping Promotions tests."
    GLOBAL_FAIL=$((GLOBAL_FAIL+1))
    return 1
  fi

  # Add products to reach min subtotal (500k)
  R=$(curl -s -X POST $ORDER_BASE/cart/items -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{"product_id":1, "product_name":"Sản phẩm mẫu 1", "quantity":4, "unit_name":"Hộp", "unit_price":300000}')
  chk "Thêm sản phẩm giá trị lớn vào giỏ hàng (600k)" "True" "$R"

  # Checkout with Vouchers
  R=$(curl -s -X POST $ORDER_BASE/checkout -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{
      "customer_name": "Khách Test Vouchers",
      "customer_phone": "'$PHONE'",
      "shipping_address": "123 Đường Láng, Hà Nội",
      "payment_method": "cod",
      "shipping_fee": 40000,
      "applied_voucher_codes": ["MINGIANG50", "FREESHIP99"]
  }')
  chk "POST /checkout (Áp dụng 2 voucher và nhận quà tặng)" "True" "$R"
  local ORDER_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('order_id', ''))" 2>/dev/null)

  if [ -n "$ORDER_ID" ]; then
    R=$(curl -s $ORDER_BASE/orders/$ORDER_ID -H "Authorization: Bearer $CUST_TOKEN")
    local DISC=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['discount_amount'])" 2>/dev/null)
    echo "    - Tổng giảm giá đơn hàng: $DISCđ (Kỳ vọng: 230000.00)"

    local HAS_GIFT=$(echo "$R" | python3 -c "import sys,json; items=json.load(sys.stdin)['data']['items']; print(any('[Quà tặng]' in x['product_name'] for x in items))" 2>/dev/null)
    echo "    - Có sản phẩm quà tặng trong đơn: $HAS_GIFT (Kỳ vọng: True)"

    if [ "$HAS_GIFT" = "True" ] && [ "$(python3 -c "print(abs(float('$DISC') - 230000.00) < 0.01)")" = "True" ]; then
      ok "Xác minh giảm giá và quà tặng đơn hàng Web thành công!"
    else
      ng "Xác minh thông tin khuyến mãi không khớp!" "$R"
    fi
  fi

  # POS Order Test
  R=$(curl -s -X POST $ORDER_BASE/orders -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{
      "customer_name": "Khách mua tại quầy",
      "customer_phone": "'$PHONE'",
      "subtotal": 300000,
      "discount_amount": 60000,
      "total_amount": 240000,
      "payment_method": "cash",
      "voucher_code": "SUMMER20",
      "items": [
          {"product_id": 1, "product_name": "Sản phẩm mẫu 1", "unit_name": "Hộp", "quantity": 1, "unit_price": 300000}
      ]
  }')
  chk "POST /orders (Tạo đơn POS kèm voucher)" "True" "$R"
  local POS_ORDER_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('order_id', ''))" 2>/dev/null)

  if [ -n "$POS_ORDER_ID" ]; then
    R=$(curl -s $ORDER_BASE/orders/$POS_ORDER_ID -H "Authorization: Bearer $CUST_TOKEN")
    local DISC_POS=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['discount_amount'])" 2>/dev/null)
    echo "    - Tổng giảm giá đơn POS: $DISC_POSđ (Kỳ vọng: 60000.00)"
    if [ "$(python3 -c "print(abs(float('$DISC_POS') - 60000.00) < 0.01)")" = "True" ]; then
      ok "Xác minh đơn hàng POS thành công!"
    else
      ng "Giảm giá POS không khớp!" "$R"
    fi
  fi
}

show_usage() {
  echo "Hướng dẫn sử dụng: ./test.sh [module]"
  echo "Các module hỗ trợ:"
  echo "  all          Chạy tất cả kiểm thử (mặc định)"
  echo "  auth|identity Chạy kiểm thử Identity Service"
  echo "  cms          Chạy kiểm thử CMS Service"
  echo "  order        Chạy kiểm thử Order Service"
  echo "  promotions   Chạy kiểm thử Khuyến mãi & Loyalty"
}

# MAIN EXECUTION
TARGET=${1:-all}

case "$TARGET" in
  all)
    run_identity_tests
    run_cms_tests
    run_order_tests
    run_promotions_tests
    ;;
  auth|identity)
    run_identity_tests
    ;;
  cms)
    run_cms_tests
    ;;
  order)
    run_order_tests
    ;;
  promotions)
    run_promotions_tests
    ;;
  help|-h|--help)
    show_usage
    exit 0
    ;;
  *)
    echo "Lỗi: Không tìm thấy module: $TARGET"
    show_usage
    exit 1
    ;;
esac

echo ""
echo "══════════════════════════════════════════"
echo "  TỔNG KẾT: $GLOBAL_PASS ✅ ĐẠT  |  $GLOBAL_FAIL ❌ THẤT BẠI"
echo "══════════════════════════════════════════"

if [ $GLOBAL_FAIL -gt 0 ]; then
  exit 1
else
  exit 0
fi
