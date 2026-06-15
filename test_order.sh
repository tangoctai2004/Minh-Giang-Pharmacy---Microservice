#!/bin/bash
BASE="http://localhost:8000/api/order"
AUTH_BASE="http://localhost:8000/api/identity"
PASS=0; FAIL=0

ok() { echo "✅ $1"; PASS=$((PASS+1)); }
ng() { echo "❌ $1 → $2"; FAIL=$((FAIL+1)); }

chk() {
  local name=$1 expect=$2 resp=$3
  local val=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  if [ "$val" = "$expect" ]; then ok "$name"; else ng "$name" "$(echo "$resp" | head -c 100)"; fi
}

# 1. Register and Login to get token
echo "Creating test customer..."
RANDOM_EMAIL="order_test_${RANDOM}@test.com"
R=$(curl -s $AUTH_BASE/auth/register -H 'Content-Type: application/json' -d '{"full_name":"Order Tester","email":"'$RANDOM_EMAIL'","phone":"08'$(printf "%08d" $((RANDOM%100000000)))'","password":"Test@123"}')
R=$(curl -s $AUTH_BASE/auth/login -H 'Content-Type: application/json' -d '{"email_or_phone":"'$RANDOM_EMAIL'","password":"Test@123"}')
CUST_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

if [ -z "$CUST_TOKEN" ]; then
    echo "❌ Failed to login. Aborting tests."
    exit 1
fi

echo "═══════ ORDER SERVICE TESTS ═══════"

# 2. Cart Tests
R=$(curl -s $BASE/cart -H "Authorization: Bearer $CUST_TOKEN")
chk "GET /cart" "True" "$R"

R=$(curl -s -X POST $BASE/cart/items -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{"product_id":1, "product_name":"Thuốc Test", "quantity":2, "unit_name":"Hộp", "unit_price":50000}')
chk "POST /cart/items" "True" "$R"
ITEM_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id', ''))" 2>/dev/null)

R=$(curl -s $BASE/cart -H "Authorization: Bearer $CUST_TOKEN")
chk "GET /cart (with items)" "True" "$R"

# 3. Checkout Tests
R=$(curl -s -X POST $BASE/checkout -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{
    "customer_name": "Test Customer",
    "customer_phone": "0987654321",
    "shipping_address": "123 Test St, Phường Phương Lâm, Thành phố Hòa Bình, Tỉnh Hòa Bình",
    "payment_method": "cod",
    "shipping_fee": 0
}')
chk "POST /checkout" "True" "$R"
ORDER_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('order_id', ''))" 2>/dev/null)

# 4. Orders Tests
R=$(curl -s $BASE/orders -H "Authorization: Bearer $CUST_TOKEN")
chk "GET /orders" "True" "$R"

R=$(curl -s $BASE/orders/stats -H "Authorization: Bearer $CUST_TOKEN")
chk "GET /orders/stats" "True" "$R"

if [ ! -z "$ORDER_ID" ]; then
    R=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $CUST_TOKEN")
    chk "GET /orders/:id" "True" "$R"
fi

echo ""
echo "══════════════════════════════════════"
echo "  KẾT QUẢ: $PASS ✅ PASS  |  $FAIL ❌ FAIL"
echo "══════════════════════════════════════"
