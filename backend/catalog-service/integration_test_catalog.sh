#!/bin/bash
set -u

BASE="${CATALOG_BASE_URL:-http://localhost:8002}"
PASS=0
FAIL=0

ok() { echo "✅ $1"; PASS=$((PASS+1)); }
ng() { echo "❌ $1 -> $2"; FAIL=$((FAIL+1)); }

assert_success() {
  local name="$1"
  local resp="$2"
  local success
  success="$(echo "$resp" | python3 -c "import sys,json; print(str(json.load(sys.stdin).get('success', False)).lower())" 2>/dev/null)"
  if [ "$success" = "true" ]; then ok "$name"; else ng "$name" "$(echo "$resp" | cut -c1-120)"; fi
}

assert_fail() {
  local name="$1"
  local resp="$2"
  local success
  success="$(echo "$resp" | python3 -c "import sys,json; print(str(json.load(sys.stdin).get('success', True)).lower())" 2>/dev/null)"
  if [ "$success" = "false" ]; then ok "$name"; else ng "$name" "$(echo "$resp" | cut -c1-120)"; fi
}

echo "====== CATALOG INTEGRATION TEST ======"
echo "BASE: $BASE"

# Flow 1: Product browse/detail/pos-search
R="$(curl -sS "$BASE/products?page=1&limit=2")"
assert_success "Flow1 - products list" "$R"
PID="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print(d[0]['id'] if d else 1)" 2>/dev/null)"
R="$(curl -sS "$BASE/products/$PID")"
assert_success "Flow1 - product detail" "$R"
R="$(curl -sS "$BASE/products/pos-search?q=vitamin&limit=3")"
assert_success "Flow1 - pos-search" "$R"

# Flow 2: Category tree/children/for=pos
R="$(curl -sS "$BASE/categories/tree")"
assert_success "Flow2 - categories tree" "$R"
R="$(curl -sS "$BASE/categories?for=pos")"
assert_success "Flow2 - categories for pos" "$R"
R="$(curl -sS "$BASE/categories/1000/children")"
assert_success "Flow2 - categories children" "$R"

# Flow 3: Inventory stats/list/detail
R="$(curl -sS "$BASE/inventory/stats")"
assert_success "Flow3 - inventory stats" "$R"
R="$(curl -sS "$BASE/inventory")"
assert_success "Flow3 - inventory list" "$R"
R="$(curl -sS "$BASE/inventory/1")"
assert_success "Flow3 - inventory detail by product" "$R"

# Flow 4: Batch create/update draft-only
R="$(curl -sS -X POST "$BASE/batches" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{"supplier_id":1,"received_date":"2026-04-22","status":"draft","items":[{"product_id":1,"lot_number":"LOT-INT-001","expiry_date":"2028-12-31","quantity_received":5,"cost_price":1000}]}' )"
assert_success "Flow4 - create draft batch" "$R"
BATCH_ID="$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)"
R="$(curl -sS "$BASE/batches/$BATCH_ID")"
assert_success "Flow4 - get created batch" "$R"
ITEM_ID="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}).get('items',[]); print(d[0]['id'] if d else '')" 2>/dev/null)"
R="$(curl -sS -X PUT "$BASE/batches/$BATCH_ID" -H "x-user-role: admin" -H "Content-Type: application/json" -d "{\"status\":\"completed\",\"items\":[{\"id\":$ITEM_ID,\"product_id\":1,\"lot_number\":\"LOT-INT-001-UPD\",\"expiry_date\":\"2028-12-31\",\"quantity_received\":6,\"quantity_remaining\":6,\"cost_price\":1100}]}" )"
assert_success "Flow4 - update draft batch" "$R"
R="$(curl -sS -X PUT "$BASE/batches/$BATCH_ID" -H "x-user-role: admin" -H "Content-Type: application/json" -d "{\"status\":\"draft\"}")"
assert_fail "Flow4 - reject update after completed" "$R"

# Flow 5: Promotions validate/toggle/reset/loyalty
R="$(curl -sS -H "x-user-role: admin" "$BASE/promotions/vouchers?page=1&limit=1")"
assert_success "Flow5 - list vouchers" "$R"
VID="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print(d[0]['id'] if d else 1)" 2>/dev/null)"
R="$(curl -sS -X PUT "$BASE/promotions/vouchers/$VID/toggle" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{"status":"active"}')"
assert_success "Flow5 - ensure voucher active before validate" "$R"
R="$(curl -sS -X POST "$BASE/promotions/vouchers/validate" -H "Content-Type: application/json" -d '{"code":"MINGIANG50","order_amount":350000}')"
assert_success "Flow5 - validate voucher" "$R"
R="$(curl -sS -X POST "$BASE/promotions/vouchers/$VID/consume" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{"quantity":1,"idempotency_key":"integration-consume-001"}')"
assert_success "Flow5 - consume voucher usage with idempotency key" "$R"
R1="$R"
R="$(curl -sS -X POST "$BASE/promotions/vouchers/$VID/consume" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{"quantity":1,"idempotency_key":"integration-consume-001"}')"
assert_success "Flow5 - replay consume idempotent request" "$R"
UC1="$(echo "$R1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('usage_count',-1))" 2>/dev/null)"
UC2="$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('usage_count',-1))" 2>/dev/null)"
if [ "$UC1" = "$UC2" ]; then ok "Flow5 - idempotency preserves usage_count"; else ng "Flow5 - idempotency preserves usage_count" "usage_count mismatch $UC1 vs $UC2"; fi
R="$(curl -sS -X PUT "$BASE/promotions/vouchers/$VID/toggle" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{"status":"paused"}')"
assert_success "Flow5 - toggle voucher paused" "$R"
R="$(curl -sS -X PUT "$BASE/promotions/vouchers/$VID/reset-usage" -H "x-user-role: admin")"
assert_success "Flow5 - reset voucher usage" "$R"
R="$(curl -sS -H "x-user-role: admin" "$BASE/promotions/loyalty/config")"
assert_success "Flow5 - get loyalty config" "$R"

echo "======================================"
echo "RESULT: $PASS passed | $FAIL failed"
echo "======================================"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
