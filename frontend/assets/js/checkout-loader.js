/**
 * checkout-loader.js
 * Manages checkout billing summary, voucher validation, and order submission.
 */

const GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
const API_BASE = GATEWAY + '/api';

let cart = [];
let subtotal = 0;
let shippingFee = 0; // default to 0 since "Nhận tại nhà thuốc" is active by default
let discountAmount = 0;
let appliedVoucher = null;
let deliveryMethod = 'pickup'; // 'pickup' or 'home'
let paymentMethod = 'cash'; // default to cash / COD

document.addEventListener('DOMContentLoaded', () => {
    initCheckout();
});

function initCheckout() {
    // 1. Get cart items
    cart = JSON.parse(localStorage.getItem('mg_cart')) || [];
    if (cart.length === 0) {
        alert('Giỏ hàng của bạn đang trống.');
        window.location.href = 'index.html';
        return;
    }

    // 2. Render summary list
    renderSummaryList();

    // 3. Setup Delivery options
    const deliveryBoxes = document.querySelectorAll('.delivery-box');
    deliveryBoxes.forEach((box, index) => {
        // index 0: Shipping, index 1: Pickup
        box.addEventListener('click', () => {
            deliveryBoxes.forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            if (index === 0) {
                deliveryMethod = 'home';
                updateShippingFee();
            } else {
                deliveryMethod = 'pickup';
                shippingFee = 0;
            }
            recalculateTotals();
        });
    });

    // 4. Setup Payment methods
    const paymentBoxes = document.querySelectorAll('.payment-box');
    paymentBoxes.forEach(box => {
        box.addEventListener('click', () => {
            paymentBoxes.forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            
            // Map icon/text to standard payment values
            const text = box.querySelector('strong').textContent;
            if (text.includes('Tiền mặt')) paymentMethod = 'cod';
            else if (text.includes('VNPay')) paymentMethod = 'vnpay';
            else if (text.includes('MoMo')) paymentMethod = 'momo';
            else paymentMethod = 'qr_transfer';
        });
    });

    // 5. Voucher code application
    const voucherRow = document.querySelector('.voucher-input-row');
    if (voucherRow) {
        const input = voucherRow.querySelector('input');
        const button = voucherRow.querySelector('button');
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const code = input.value.trim();
            if (code) {
                applyVoucherCode(code);
            }
        });
    }

    // 6. Form submission
    const form = document.querySelector('form.checkout-main');
    if (form) {
        form.addEventListener('submit', handleOrderSubmit);
    }
}

function renderSummaryList() {
    const listEl = document.querySelector('.summary-list');
    if (!listEl) return;

    subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    listEl.innerHTML = cart.map(item => `
        <div class="summary-item">
            <img src="${item.image || '../assets/images/product_frame.png'}" alt="${item.name}" class="summary-img"
                onerror="this.src='../assets/images/product_frame.png'">
            <div class="summary-info">
                <h4>${item.name}</h4>
                <div class="qty-price">${item.quantity} x ${formatVND(item.price)}</div>
            </div>
        </div>
    `).join('');

    recalculateTotals();
}

function updateShippingFee() {
    if (deliveryMethod === 'home') {
        shippingFee = subtotal >= 300000 ? 0 : 18000;
    } else {
        shippingFee = 0;
    }
}

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function recalculateTotals() {
    updateShippingFee();

    // Calculate voucher discount
    discountAmount = 0;
    if (appliedVoucher) {
        if (subtotal >= (appliedVoucher.min_order_value || 0)) {
            if (appliedVoucher.type === 'percent_discount') {
                discountAmount = subtotal * (appliedVoucher.discount_value / 100);
                if (appliedVoucher.max_discount_amount) {
                    discountAmount = Math.min(discountAmount, appliedVoucher.max_discount_amount);
                }
            } else if (appliedVoucher.type === 'fixed_discount') {
                discountAmount = appliedVoucher.discount_value;
            } else if (appliedVoucher.type === 'free_shipping') {
                shippingFee = 0;
            }
        } else {
            alert(`Mã giảm giá này yêu cầu giá trị đơn hàng tối thiểu ${formatVND(appliedVoucher.min_order_value)}`);
            appliedVoucher = null;
            const appliedBanner = document.querySelector('.applied-promo');
            if (appliedBanner) appliedBanner.style.display = 'none';
        }
    }

    const total = Math.max(0, subtotal + shippingFee - discountAmount);
    const savings = discountAmount;
    const points = Math.floor(total / 1000);

    // Update details DOM
    const rows = document.querySelectorAll('.summary-details .summary-row');
    if (rows.length >= 7) {
        // Reward points
        rows[0].querySelector('span:last-child').textContent = `+${points} điểm`;
        // Subtotal
        rows[1].querySelector('span:last-child').textContent = formatVND(subtotal);
        // Product savings
        rows[2].querySelector('span:last-child').textContent = formatVND(0); // already included in retail price
        // Promotion discount
        rows[3].querySelector('span:last-child').textContent = `-${formatVND(discountAmount)}`;
        // Shipping fee
        rows[4].querySelector('span:last-child').textContent = formatVND(shippingFee);
        // Saved
        rows[5].querySelector('span:last-child').textContent = formatVND(savings);
        // Total
        rows[6].querySelector('span:last-child').textContent = formatVND(total);
    }

    // Update button text
    const btnOrder = document.querySelector('.btn-order');
    if (btnOrder) {
        btnOrder.textContent = `Đặt hàng ( ${formatVND(total)} )`;
    }
}

async function applyVoucherCode(code) {
    try {
        const response = await fetch(`${API_BASE}/cms/promotions/validate/${encodeURIComponent(code)}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const promo = result.data;
            if (subtotal < (promo.min_order_value || 0)) {
                alert(`Mã giảm giá ${code} yêu cầu đơn hàng từ ${formatVND(promo.min_order_value)} trở lên.`);
                return;
            }
            
            appliedVoucher = promo;
            
            // Show applied banner
            const appliedBanner = document.querySelector('.applied-promo');
            if (appliedBanner) {
                appliedBanner.style.display = 'flex';
                appliedBanner.querySelector('span').innerHTML = `Đã áp dụng: <strong>${promo.name}</strong> (-${promo.type === 'percent_discount' ? promo.discount_value + '%' : formatVND(promo.discount_value)})`;
            }
            
            recalculateTotals();
            alert(`Áp dụng mã giảm giá ${code} thành công!`);
        } else {
            alert(result.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.');
        }
    } catch (e) {
        console.error('[Checkout] Voucher validation error:', e);
        alert('Lỗi kết nối khi xác thực mã giảm giá.');
    }
}

async function handleOrderSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const gender = form.querySelector('input[name="gender"]:checked') ? 'Anh' : 'Chị';
    const nameInput = form.querySelector('input[placeholder="Họ và tên *"]');
    const phoneInput = form.querySelector('input[placeholder="Điện thoại *"]');
    const emailInput = form.querySelector('input[placeholder="Email"]');
    const addressInput = form.querySelector('input[placeholder="Địa chỉ *"]');
    const notesInput = form.querySelector('.textarea-notes');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!name || !phone) {
        alert('Vui lòng điền đầy đủ Họ tên và Số điện thoại liên hệ.');
        return;
    }

    if (deliveryMethod === 'home' && !address) {
        alert('Vui lòng điền Địa chỉ nhận hàng.');
        return;
    }

    // Build items payload
    const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        unit_name: item.unit,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
    }));

    const orderPayload = {
        order_channel: 'web',
        customer_name: `${gender} ${name}`,
        customer_phone: phone,
        customer_email: email,
        shipping_address: deliveryMethod === 'home' ? address : 'Nhận tại cửa hàng Minh Giang Pharmacy',
        subtotal: subtotal,
        shipping_fee: shippingFee,
        discount_amount: discountAmount,
        total_amount: Math.max(0, subtotal + shippingFee - discountAmount),
        payment_method: paymentMethod,
        customer_notes: notes,
        items: orderItems,
        voucher_code: appliedVoucher ? appliedVoucher.code : null
    };

    console.log('[Checkout] Submitting order payload:', orderPayload);

    try {
        const response = await fetch(`${API_BASE}/order/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getClientToken()}`
            },
            body: JSON.stringify(orderPayload)
        });

        const result = await response.json();
        
        // Handle normal success or 501 fallback
        if (result && result.success) {
            handleOrderSuccess(result.data || { code: 'MG-' + Math.floor(100000 + Math.random() * 900000) });
        } else {
            alert(result.message || 'Lỗi xảy ra khi đặt hàng. Vui lòng thử lại.');
        }
    } catch (e) {
        console.error('[Checkout] Connection failed:', e);
        alert('Không kết nối được tới dịch vụ đặt hàng. Vui lòng thử lại sau.');
    }
}

function getClientToken() {
    try {
        const auth = JSON.parse(localStorage.getItem('MG_CLIENT_AUTH'));
        return auth ? auth.accessToken : '';
    } catch (e) {
        return '';
    }
}

function handleOrderSuccess(orderData) {
    // Clear cart
    localStorage.removeItem('mg_cart');
    if (window.updateCartBadge) window.updateCartBadge();

    // Show dynamic beautiful receipt success modal/page contents
    const mainForm = document.querySelector('.checkout-layout');
    if (mainForm) {
        mainForm.innerHTML = `
            <div style="background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; width: 100%; max-width: 600px; margin: 40px auto;">
                <div style="width: 80px; height: 80px; background: #dcfce7; color: #0b7a3e; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; margin: 0 auto 24px;">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <h2 style="font-size: 24px; color: #1f2937; margin-bottom: 12px; font-weight: 700;">Đặt hàng thành công!</h2>
                <p style="color: #4b5563; font-size: 16px; margin-bottom: 24px; line-height: 1.5;">
                    Cảm ơn bạn đã mua sắm tại Nhà Thuốc Minh Giang. Đơn hàng của bạn đang được xử lý.
                </p>
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 30px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                        <span style="color: #6b7280;">Mã đơn hàng:</span>
                        <strong style="color: #0b7a3e;">${orderData.code || orderData.order_code || 'MG-ORDER'}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                        <span style="color: #6b7280;">Hình thức thanh toán:</span>
                        <strong style="color: #374151;">${paymentMethod.toUpperCase()}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px;">
                        <span style="color: #6b7280;">Tổng cộng:</span>
                        <strong style="color: #ef4444; font-size: 16px;">${formatVND(Math.max(0, subtotal + shippingFee - discountAmount))}</strong>
                    </div>
                </div>
                <a href="index.html" style="display: inline-block; background: #0b7a3e; color: #fff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; transition: background 0.2s;">
                    Tiếp tục mua sắm
                </a>
            </div>
        `;
    }
}
