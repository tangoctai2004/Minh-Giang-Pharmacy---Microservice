#!/bin/bash
BASE="http://localhost:8000/api/cms"
AUTH_BASE="http://localhost:8000/api/identity"
PASS=0; FAIL=0

ok() { echo "✅ $1"; PASS=$((PASS+1)); }
ng() { echo "❌ $1 → $2"; FAIL=$((FAIL+1)); }

chk() {
  local name=$1 expect=$2 resp=$3
  local val=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  if [ "$val" = "$expect" ]; then ok "$name"; else ng "$name" "$(echo "$resp" | head -c 100)"; fi
}

# 1. Login Admin to get Token for Admin APIs
echo "Logging in as admin to get token..."
R=$(curl -s $AUTH_BASE/auth/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
ADMIN_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ]; then
    echo "⚠️ Warning: Failed to get admin token. Admin API tests will be skipped."
fi

echo "═══════ CMS SERVICE TESTS ═══════"

# 2. Public API Tests
R=$(curl -s "$BASE/store-config/public")
chk "GET /store-config/public" "True" "$R"

R=$(curl -s "$BASE/banners?position=hero")
chk "GET /banners" "True" "$R"

R=$(curl -s "$BASE/disease-categories?level=root")
chk "GET /disease-categories" "True" "$R"

R=$(curl -s "$BASE/diseases/search?q=gout")
chk "GET /diseases/search" "True" "$R"

R=$(curl -s "$BASE/articles")
chk "GET /articles" "True" "$R"

R=$(curl -s "$BASE/trending-searches")
chk "GET /trending-searches" "True" "$R"

R=$(curl -s -X POST "$BASE/trending-searches/track" -H 'Content-Type: application/json' -d '{"keyword":"panadol"}')
chk "POST /trending-searches/track" "True" "$R"


# 3. Admin API Tests (Only if token is available)
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo ""
    echo "═══════ CMS ADMIN TESTS ═══════"

    R=$(curl -s "$BASE/articles/admin" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /articles/admin" "True" "$R"

    # Create test article (category_id 1 is seeded as "Sức khoẻ tổng quát")
    R=$(curl -s -X POST "$BASE/articles" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"title":"Bài viết test tự động CMS","category_id":1,"content":"<p>Nội dung bài viết test tự động</p>","excerpt":"Tóm tắt bài viết test","status":"draft","tags":["test-cms"]}')
    chk "POST /articles (create)" "True" "$R"
    ARTICLE_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id', ''))" 2>/dev/null)

    if [ ! -z "$ARTICLE_ID" ]; then
        R=$(curl -s -X PUT "$BASE/articles/$ARTICLE_ID" \
          -H "Authorization: Bearer $ADMIN_TOKEN" \
          -H 'Content-Type: application/json' \
          -d '{"title":"Bài viết test tự động CMS - Đã cập nhật"}')
        chk "PUT /articles/:id (update)" "True" "$R"

        R=$(curl -s -X DELETE "$BASE/articles/$ARTICLE_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
        chk "DELETE /articles/:id (delete)" "True" "$R"
    fi

    R=$(curl -s "$BASE/banners/admin" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /banners/admin" "True" "$R"

    R=$(curl -s "$BASE/store-config" -H "Authorization: Bearer $ADMIN_TOKEN")
    chk "GET /store-config" "True" "$R"
fi

echo ""
echo "══════════════════════════════════════"
echo "  KẾT QUẢ: $PASS ✅ PASS  |  $FAIL ❌ FAIL"
echo "══════════════════════════════════════"
