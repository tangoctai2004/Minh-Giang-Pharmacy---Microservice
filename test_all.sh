#!/bin/bash
BASE="http://localhost:8000/api/identity"
PASS=0; FAIL=0

ok() { echo "✅ $1"; PASS=$((PASS+1)); }
ng() { echo "❌ $1 → $2"; FAIL=$((FAIL+1)); }

chk() {
  local name=$1 expect=$2 resp=$3
  local val=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  if [ "$val" = "$expect" ]; then ok "$name"; else ng "$name" "$(echo "$resp" | head -c 80)"; fi
}

echo "═══════ 1. AUTH ═══════"
R=$(curl -s $BASE/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
chk "POST /auth/login (username)" "True" "$R"

R=$(curl -s $BASE/auth/login -H 'Content-Type: application/json' -d '{"email_or_phone":"admin@minhgiangpharma.vn","password":"admin123"}')
chk "POST /auth/login (email_or_phone)" "True" "$R"

R=$(curl -s $BASE/auth/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
chk "POST /auth/admin/login" "True" "$R"
ADMIN_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

R=$(curl -s $BASE/auth/admin/login -H 'Content-Type: application/json' -d '{"username":"thugan_minh","password":"x"}')
chk "POST /auth/admin/login (reject cashier)" "False" "$R"

R=$(curl -s $BASE/auth/pos/verify-pin -H 'Content-Type: application/json' -d '{"user_code":"x","pin":"y","kiosk_id":"z"}')
chk "POST /auth/pos/verify-pin (route ok)" "False" "$R"

R=$(curl -s $BASE/auth/login-pos -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123","kiosk_id":"POS-01"}')
chk "POST /auth/login-pos (legacy)" "False" "$R"

R=$(curl -s $BASE/auth/register -H 'Content-Type: application/json' -d '{"full_name":"RegTest","email":"regtest_'$RANDOM'@test.com","phone":"09'$RANDOM'55","password":"Test@123"}')
chk "POST /auth/register" "True" "$R"

R=$(curl -s $BASE/auth/login -H 'Content-Type: application/json' -d '{"email_or_phone":"testcheck@test.com","password":"Test@789"}')
chk "POST /auth/login (customer)" "True" "$R"
CUST_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
CUST_REFRESH=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
CUST_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['customer']['id'])" 2>/dev/null)

echo ""
echo "═══════ 2. CUSTOMERS ═══════"
R=$(curl -s $BASE/customers -H "Authorization: Bearer $ADMIN_TOKEN")
chk "GET /customers (admin list)" "True" "$R"

R=$(curl -s $BASE/customers/me -H "Authorization: Bearer $CUST_TOKEN")
chk "GET /customers/me" "True" "$R"

R=$(curl -s $BASE/customers/$CUST_ID -H "Authorization: Bearer $ADMIN_TOKEN")
chk "GET /customers/:id" "True" "$R"

R=$(curl -s -X PUT $BASE/customers/me -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{"full_name":"Test Verified"}')
chk "PUT /customers/me (new)" "True" "$R"

R=$(curl -s -X PUT $BASE/customers/$CUST_ID -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"full_name":"Test Verified2"}')
chk "PUT /customers/:id" "True" "$R"

echo ""
echo "═══════ 3. ADDRESSES ═══════"
R=$(curl -s $BASE/customers/$CUST_ID/addresses -H "Authorization: Bearer $CUST_TOKEN")
chk "GET /customers/:id/addresses" "True" "$R"

echo ""
echo "═══════ 4. AUTH FEATURES ═══════"
R=$(curl -s -X PUT $BASE/auth/change-password -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{"current_password":"Test@789","new_password":"Test@000","confirm_password":"Test@000"}')
chk "PUT /auth/change-password" "True" "$R"

R=$(curl -s $BASE/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$CUST_REFRESH\"}")
chk "POST /auth/refresh" "True" "$R"

R=$(curl -s $BASE/auth/logout -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$CUST_REFRESH\"}")
chk "POST /auth/logout" "True" "$R"

R=$(curl -s $BASE/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$CUST_REFRESH\"}")
chk "POST /auth/refresh (reject after logout)" "False" "$R"

echo ""
echo "═══════ 5. SHIFTS + USERS + ROLES ═══════"
R=$(curl -s $BASE/shifts -H "Authorization: Bearer $ADMIN_TOKEN")
chk "GET /shifts" "True" "$R"

R=$(curl -s $BASE/shifts/1 -H "Authorization: Bearer $ADMIN_TOKEN")
chk "GET /shifts/:id" "True" "$R"

R=$(curl -s -X POST $BASE/shifts/open -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"kiosk_id\":\"TEST-$RANDOM\",\"opening_cash\":100000}")
chk "POST /shifts/open (new alias)" "True" "$R"
NEW_SHIFT=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

R=$(curl -s -X PUT $BASE/shifts/$NEW_SHIFT/close -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"closing_cash":150000}')
chk "PUT /shifts/:id/close" "True" "$R"

R=$(curl -s $BASE/roles -H "Authorization: Bearer $ADMIN_TOKEN")
chk "GET /roles" "True" "$R"

R=$(curl -s $BASE/users -H "Authorization: Bearer $ADMIN_TOKEN")
chk "GET /users" "True" "$R"

echo ""
echo "══════════════════════════════════════"
echo "  KẾT QUẢ: $PASS ✅ PASS  |  $FAIL ❌ FAIL"
echo "══════════════════════════════════════"
