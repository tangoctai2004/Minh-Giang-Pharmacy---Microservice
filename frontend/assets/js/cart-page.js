/**
 * cart-page.js
 * Xử lý hiển thị và tương tác trên trang giỏ hàng (cart.html)
 */

document.addEventListener('DOMContentLoaded', () => {
    renderCart();
});

function renderCart() {
    const cart = getCart();
    const container = document.querySelector('.cart-main');
    if (!container) return;

    // Giữ lại Header
    const headerHtml = `
        <div class="cart-header">
            <div class="item-check"><input type="checkbox" checked id="selectAll"></div>
            <div>Sản phẩm</div>
            <div style="text-align: right;">Đơn giá</div>
            <div style="text-align: center;">Số lượng</div>
            <div style="text-align: right;">Thành tiền</div>
            <div></div>
        </div>
    `;

    if (cart.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <img src="../assets/images/empty_cart.png" alt="Empty Cart" style="width: 150px; margin-bottom: 20px; opacity: 0.5;" onerror="this.style.display='none'">
                <p style="color: #6b7280; font-size: 16px;">Giỏ hàng của bạn đang trống.</p>
                <a href="index.html" class="btn-secondary" style="margin-top: 20px; display: inline-block;">Quay lại mua sắm</a>
            </div>
        `;
        updateSummary(0);
        return;
    }

    let itemsHtml = cart.map((item, index) => `
        <div class="cart-item" data-id="${item.id}">
            <div class="item-check"><input type="checkbox" checked class="item-checkbox"></div>
            <div class="item-info">
                <img src="${item.image || '../assets/images/placeholder.png'}" alt="${item.name}" class="item-img">
                <div class="item-details">
                    <h4>${item.name}</h4>
                    <span class="sku">ID: ${item.id}</span>
                </div>
            </div>
            <div class="item-unit-price">
                <span class="price-now">${new Intl.NumberFormat('vi-VN').format(item.price)}đ</span>
                <div class="unit-label">/ ${item.unit || 'Hộp'}</div>
            </div>
            <div class="item-qty">
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${item.id}, -1)">-</button>
                    <input type="text" value="${item.quantity}" class="qty-input" readonly>
                    <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
                </div>
            </div>
            <div class="item-total">${new Intl.NumberFormat('vi-VN').format(item.price * item.quantity)}đ</div>
            <div class="item-delete" onclick="removeItem(${item.id})"><i class="fa-regular fa-trash-can"></i></div>
        </div>
    `).join('');

    const actionsHtml = `
        <div class="cart-actions">
            <div>
                <a href="index.html" class="btn-secondary">Tiếp tục mua sắm</a>
                <button class="btn-clear" style="margin-left: 10px;" onclick="clearCart()">Xóa giỏ hàng</button>
            </div>
            <button class="btn-checkout" onclick="goToCheckout()">Tiến hành thanh toán</button>
        </div>
    `;

    container.innerHTML = headerHtml + itemsHtml + actionsHtml;
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    updateSummary(subtotal);
}

function updateQty(id, delta) {
    let cart = getCart();
    const item = cart.find(i => i.id == id);
    if (item) {
        item.quantity += delta;
        if (item.quantity < 1) item.quantity = 1;
        saveCart(cart);
        renderCart();
    }
}

function removeItem(id) {
    if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
        let cart = getCart();
        cart = cart.filter(i => i.id != id);
        saveCart(cart);
        renderCart();
    }
}

function clearCart() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ giỏ hàng?')) {
        saveCart([]);
        renderCart();
    }
}

function updateSummary(subtotal) {
    const subtotalEl = document.querySelector('.price-breakdown .breakdown-row:nth-child(1) span:last-child');
    const totalEl = document.querySelector('.total-val');
    const rewardEl = document.querySelector('.reward-val');

    if (subtotalEl) subtotalEl.textContent = new Intl.NumberFormat('vi-VN').format(subtotal) + 'đ';
    if (totalEl) totalEl.textContent = new Intl.NumberFormat('vi-VN').format(subtotal) + 'đ';
    
    // Giả định 1000đ = 1 điểm
    if (rewardEl) rewardEl.textContent = '+' + Math.floor(subtotal / 1000) + ' điểm';
}

function goToCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        alert('Giỏ hàng trống!');
        return;
    }
    window.location.href = 'checkout.html';
}

window.updateQty = updateQty;
window.removeItem = removeItem;
window.clearCart = clearCart;
window.goToCheckout = goToCheckout;
