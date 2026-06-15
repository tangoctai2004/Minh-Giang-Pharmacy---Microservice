#!/bin/bash
BASE="http://localhost:8000/api/order"
AUTH_BASE="http://localhost:8000/api/identity"
PASS=0; FAIL=0

ok() { echo "✅ $1"; PASS=$((PASS+1)); }
ng() { echo "❌ $1 → $2"; FAIL=$((FAIL+1)); }

chk() {
  local name=$1 expect=$2 resp=$3
  local val=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  if [ "$val" = "$expect" ]; then ok "$name"; else ng "$name" "$(echo "$resp" | head -c 200)"; fi
}

echo "1. Đăng ký & Đăng nhập tài khoản kiểm thử..."
RANDOM_EMAIL="promo_test_${RANDOM}@test.com"
PHONE="0987$(printf "%06d" $((RANDOM%1000000)))"
R=$(curl -s $AUTH_BASE/auth/register -H 'Content-Type: application/json' -d '{"full_name":"Tester Khuyến Mãi","email":"'$RANDOM_EMAIL'","phone":"'$PHONE'","password":"Test@123"}')
R=$(curl -s $AUTH_BASE/auth/login -H 'Content-Type: application/json' -d '{"email_or_phone":"'$RANDOM_EMAIL'","password":"Test@123"}')
CUST_TOKEN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

if [ -z "$CUST_TOKEN" ]; then
    echo "❌ Không thể đăng nhập. Dừng kiểm thử."
    exit 1
fi

echo "═══════ BẮT ĐẦU KIỂM THỬ KHUYẾN MÃI ═══════"

# Trả cứu tên sản phẩm trong DB để chắc chắn nó khớp
# Ví dụ: Chúng ta có 'Nước Súc Miệng Listerine 250ml' trong seed 97 của mg_cms
# Hãy đảm bảo rằng trong mg_catalog có một sản phẩm tên như vậy hoặc tương tự.
# Ở đây ta sẽ thêm sản phẩm trị giá cao vào giỏ hàng để kiểm chứng.

echo "2. Chuẩn bị giỏ hàng Web (500k để đạt điều kiện nhận Quà tặng Listerine)..."
# Thêm sản phẩm 1: giá 300.000đ x 2 = 600.000đ
R=$(curl -s -X POST $BASE/cart/items -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{"product_id":1, "product_name":"Sản phẩm mẫu 1", "quantity":2, "unit_name":"Hộp", "unit_price":300000}')
chk "Thêm sản phẩm giá trị lớn vào giỏ hàng" "True" "$R"

echo "3. Thực hiện checkout với 2 mã voucher cùng lúc (MINGIANG50 + FREESHIP99)..."
# Mã MINGIANG50 giảm 50% max 200k cho đơn từ 500k
# Mã FREESHIP99 giảm ship max 30k cho đơn từ 299k
# Đơn hàng: subtotal=600k, ship=40k
# Giảm voucher = 200k + 30k = 230k.
# Tổng tiền = 600k + 40k - 230k = 410k.
R=$(curl -s -X POST $BASE/checkout -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{
    "customer_name": "Khách Test Vouchers",
    "customer_phone": "'$PHONE'",
    "shipping_address": "123 Đường Láng, Hà Nội",
    "payment_method": "cod",
    "shipping_fee": 40000,
    "applied_voucher_codes": ["MINGIANG50", "FREESHIP99"]
}')
chk "POST /checkout (Áp dụng 2 voucher và tự động nhận quà tặng)" "True" "$R"
ORDER_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('order_id', ''))" 2>/dev/null)

if [ ! -z "$ORDER_ID" ]; then
    echo "4. Xác minh chi tiết đơn hàng sau checkout..."
    # Lấy thông tin đơn hàng để xem chi tiết các mặt hàng (chắc chắn có quà tặng và voucher ghi nhận)
    R=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $CUST_TOKEN")
    
    # Kiểm tra discount_amount
    DISC=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['discount_amount'])" 2>/dev/null)
    echo "  - Tổng giảm giá đơn hàng: $DISCđ (Kỳ vọng: 230000.00)"
    
    # Kiểm tra quà tặng có trong chi tiết sản phẩm hay không
    HAS_GIFT=$(echo "$R" | python3 -c "import sys,json; items=json.load(sys.stdin)['data']['items']; print(any('[Quà tặng]' in x['product_name'] for x in items))" 2>/dev/null)
    echo "  - Có sản phẩm quà tặng trong đơn: $HAS_GIFT (Kỳ vọng: True)"
    
    if [ "$HAS_GIFT" = "True" ] && [ "$(echo "$DISC == 230000.00" | bc -l)" -eq 1 ]; then
        ok "Xác minh giảm giá và quà tặng đơn hàng Web thành công!"
    else
        ng "Xác minh thông tin khuyến mãi không khớp!" "$R"
    fi
fi

echo "5. Kiểm thử tạo đơn POS (Áp dụng voucher POS và quà tặng POS cho khách hàng thành viên)..."
# Giả sử khách POS mua sản phẩm id=1 trị giá 300k, SĐT nhập vào là SĐT thành viên vừa đăng ký
# Đơn POS có subtotal=300k. Đơn POS không có quà tặng Listerine vì min_order là 500k.
# Nhưng có voucher SUMMER20 giảm 20% max 150k cho đơn từ 300k.
# Giảm giá = 60k.
R=$(curl -s -X POST $BASE/orders -H "Authorization: Bearer $CUST_TOKEN" -H 'Content-Type: application/json' -d '{
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
POS_ORDER_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('order_id', ''))" 2>/dev/null)

if [ ! -z "$POS_ORDER_ID" ]; then
    # Lấy thông tin đơn hàng POS để xác nhận
    R=$(curl -s $BASE/orders/$POS_ORDER_ID -H "Authorization: Bearer $CUST_TOKEN")
    DISC_POS=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['discount_amount'])" 2>/dev/null)
    echo "  - Tổng giảm giá đơn POS: $DISC_POSđ (Kỳ vọng: 60000.00)"
    if [ "$(echo "$DISC_POS == 60000.00" | bc -l)" -eq 1 ]; then
        ok "Xác minh đơn hàng POS thành công!"
    else
        ng "Giảm giá POS không khớp!" "$R"
    fi
fi

echo ""
echo "══════════════════════════════════════"
echo "  KẾT QUẢ CUỐI CÙNG: $PASS ✅ PASS  |  $FAIL ❌ FAIL"
echo "══════════════════════════════════════"
