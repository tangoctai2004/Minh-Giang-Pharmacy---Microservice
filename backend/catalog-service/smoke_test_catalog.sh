#!/bin/bash
set -u

BASE="${CATALOG_BASE_URL:-http://localhost:8002}"
PASS=0
FAIL=0

ok() { echo "✅ $1"; PASS=$((PASS+1)); }
ng() { echo "❌ $1 -> $2"; FAIL=$((FAIL+1)); }

is_success() {
  echo "$1" | python3 -c "import sys,json; print(str(json.load(sys.stdin).get('success', False)).lower())" 2>/dev/null
}

check_success_true() {
  local name="$1"
  local resp="$2"
  local v
  v="$(is_success "$resp")"
  if [ "$v" = "true" ]; then ok "$name"; else ng "$name" "$(echo "$resp" | cut -c1-120)"; fi
}

check_success_false() {
  local name="$1"
  local resp="$2"
  local v
  v="$(is_success "$resp")"
  if [ "$v" = "false" ]; then ok "$name"; else ng "$name" "$(echo "$resp" | cut -c1-120)"; fi
}

echo "====== CATALOG SMOKE TEST ======"
echo "BASE: $BASE"

R="$(curl -sS "$BASE/health")"
SVC="$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('service',''))" 2>/dev/null)"
if [ "$SVC" = "catalog-service" ]; then ok "GET /health"; else ng "GET /health" "$R"; fi
R="$(curl -sS "$BASE/metrics")"
check_success_true "GET /metrics" "$R"

R="$(curl -sS "$BASE/products?page=1&limit=3")"
check_success_true "GET /products" "$R"

R="$(curl -sS "$BASE/products/1")"
check_success_true "GET /products/:id" "$R"

R="$(curl -sS "$BASE/products/1/alternatives")"
check_success_true "GET /products/:id/alternatives" "$R"

R="$(curl -sS "$BASE/products/pos-search?q=vitamin&limit=3")"
check_success_true "GET /products/pos-search" "$R"

R="$(curl -sS "$BASE/categories")"
check_success_true "GET /categories" "$R"

R="$(curl -sS "$BASE/categories/tree")"
check_success_true "GET /categories/tree" "$R"

R="$(curl -sS "$BASE/categories?for=pos")"
check_success_true "GET /categories?for=pos" "$R"

R="$(curl -sS "$BASE/categories/1000/children")"
check_success_true "GET /categories/:parent_id/children" "$R"

R="$(curl -sS "$BASE/inventory/stats")"
check_success_true "GET /inventory/stats" "$R"

R="$(curl -sS "$BASE/inventory")"
check_success_true "GET /inventory" "$R"

R="$(curl -sS "$BASE/batches")"
check_success_true "GET /batches" "$R"

R="$(curl -sS "$BASE/suppliers?page=1&limit=3")"
check_success_true "GET /suppliers" "$R"

R="$(curl -sS "$BASE/locations?page=1&limit=3")"
check_success_true "GET /locations" "$R"

R="$(curl -sS -H "x-user-role: admin" "$BASE/promotions/stats")"
check_success_true "GET /promotions/stats (admin)" "$R"

R="$(curl -sS -H "x-user-role: admin" "$BASE/promotions/vouchers?page=1&limit=5")"
check_success_true "GET /promotions/vouchers (admin)" "$R"
VID="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print(d[0]['id'] if d else 1)" 2>/dev/null)"
R="$(curl -sS -X PUT "$BASE/promotions/vouchers/$VID/toggle" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{"status":"active"}')"
check_success_true "PUT /promotions/vouchers/:id/toggle active (admin)" "$R"

R="$(curl -sS -X POST "$BASE/promotions/vouchers/validate" -H "Content-Type: application/json" -d '{"code":"MINGIANG50","order_amount":350000}')"
check_success_true "POST /promotions/vouchers/validate" "$R"
R="$(curl -sS -X POST "$BASE/promotions/vouchers/$VID/consume" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{"quantity":1,"idempotency_key":"smoke-consume-001"}')"
check_success_true "POST /promotions/vouchers/:id/consume (admin)" "$R"

R="$(curl -sS -H "x-user-role: admin" "$BASE/promotions/loyalty/config")"
check_success_true "GET /promotions/loyalty/config (admin)" "$R"

# Negative tests
R="$(curl -sS -X POST "$BASE/suppliers" -H "Content-Type: application/json" -d '{"code":"NO_ROLE","name":"No role"}')"
check_success_false "POST /suppliers without role -> 403" "$R"

R="$(curl -sS -X POST "$BASE/products" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{"name":"invalid-product"}')"
check_success_false "POST /products invalid payload -> 400" "$R"

R="$(curl -sS -X POST "$BASE/promotions/vouchers/validate" -H "Content-Type: application/json" -d '{"code":"NOT_EXISTS","order_amount":350000}')"
check_success_false "POST /promotions/vouchers/validate invalid code" "$R"

echo "================================="
echo "RESULT: $PASS passed | $FAIL failed"
echo "================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
