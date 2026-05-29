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

R="$(curl -sS "$BASE/products?ids=1&limit=3")"
check_success_true "GET /products?ids=1" "$R"

R="$(curl -sS "$BASE/products/1")"
check_success_true "GET /products/:id" "$R"
BARCODE="$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('barcode',''))" 2>/dev/null)"
if [ -z "$BARCODE" ]; then BARCODE="8930000000001"; fi

R="$(curl -sS "$BASE/products/barcode/$BARCODE")"
check_success_true "GET /products/barcode/:barcode enriched" "$R"
HAS_BARCODE_FIELDS="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print('true' if all(k in d for k in ['requires_prescription','available_stock','nearest_expiry','location_name','units']) else 'false')" 2>/dev/null)"
if [ "$HAS_BARCODE_FIELDS" = "true" ]; then ok "GET /products/barcode includes POS fields"; else ng "GET /products/barcode includes POS fields" "$(echo "$R" | cut -c1-120)"; fi
HAS_BARCODE_MATCH="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}).get('barcode_match',{}); print('true' if all(k in d for k in ['type','unit_name','conversion_qty']) else 'false')" 2>/dev/null)"
if [ "$HAS_BARCODE_MATCH" = "true" ]; then ok "GET /products/barcode includes barcode_match"; else ng "GET /products/barcode includes barcode_match" "$(echo "$R" | cut -c1-120)"; fi

R="$(curl -sS "$BASE/products/1/alternatives")"
check_success_true "GET /products/:id/alternatives" "$R"

R="$(curl -sS "$BASE/products/pos-search?q=vitamin&limit=3")"
check_success_true "GET /products/pos-search" "$R"

R="$(curl -sS "$BASE/products/pos-search?barcode=$BARCODE&limit=1")"
check_success_true "GET /products/pos-search enriched barcode" "$R"
HAS_POS_FIELDS="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print('true' if d and all(k in d[0] for k in ['requires_prescription','available_stock','nearest_expiry','location_name','units','warnings','sale_units','pos_flags']) else 'false')" 2>/dev/null)"
if [ "$HAS_POS_FIELDS" = "true" ]; then ok "GET /products/pos-search includes POS fields"; else ng "GET /products/pos-search includes POS fields" "$(echo "$R" | cut -c1-120)"; fi

R="$(curl -sS "$BASE/products/pos-search?q=hasot&limit=2")"
check_success_true "GET /products/pos-search normalized query" "$R"

R="$(curl -sS "$BASE/products/pos-detail/1")"
check_success_true "GET /products/pos-detail/:id" "$R"
HAS_POS_DETAIL_FIELDS="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print('true' if all(k in d for k in ['sale_units','warnings','pos_flags','batches','category']) else 'false')" 2>/dev/null)"
if [ "$HAS_POS_DETAIL_FIELDS" = "true" ]; then ok "GET /products/pos-detail includes fields"; else ng "GET /products/pos-detail includes fields" "$(echo "$R" | cut -c1-120)"; fi

R="$(curl -sS "$BASE/categories")"
check_success_true "GET /categories" "$R"

R="$(curl -sS "$BASE/categories/tree")"
check_success_true "GET /categories/tree" "$R"

R="$(curl -sS "$BASE/categories/pos-tree")"
check_success_true "GET /categories/pos-tree" "$R"

R="$(curl -sS "$BASE/categories?for=pos")"
check_success_true "GET /categories?for=pos" "$R"

R="$(curl -sS "$BASE/categories/1000/children")"
check_success_true "GET /categories/:parent_id/children" "$R"

R="$(curl -sS "$BASE/inventory/stats")"
check_success_true "GET /inventory/stats" "$R"

R="$(curl -sS "$BASE/inventory")"
check_success_true "GET /inventory" "$R"

R="$(curl -sS "$BASE/inventory/availability?product_ids=1")"
check_success_true "GET /inventory/availability" "$R"
HAS_AVAILABILITY_FIELDS="$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print('true' if d and all(k in d[0] for k in ['product_id','total_stock','reserved_stock','available_stock','nearest_expiry','in_stock']) else 'false')" 2>/dev/null)"
if [ "$HAS_AVAILABILITY_FIELDS" = "true" ]; then ok "GET /inventory/availability includes fields"; else ng "GET /inventory/availability includes fields" "$(echo "$R" | cut -c1-120)"; fi
R="$(curl -sS -X POST "$BASE/inventory/reservations" -H "Content-Type: application/json" -d '{"source_type":"pos_hold","source_id":900001,"ttl_minutes":5,"items":[{"product_id":1,"quantity":1}]}')"
check_success_true "POST /inventory/reservations" "$R"
R="$(curl -sS -X POST "$BASE/inventory/reservations/release" -H "Content-Type: application/json" -d '{"source_type":"pos_hold","source_id":900001,"reason":"cancelled"}')"
check_success_true "POST /inventory/reservations/release" "$R"

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
R="$(curl -sS "$BASE/promotions/active?limit=3")"
check_success_true "GET /promotions/active" "$R"
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
