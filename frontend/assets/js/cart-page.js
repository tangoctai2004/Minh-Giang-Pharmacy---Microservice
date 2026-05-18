/**
 * cart-page.js
 * Xử lý hiển thị và tương tác trên trang giỏ hàng (cart.html)
 */

const API_BASE = 'http://localhost:8000/api/order';

document.addEventListener('DOMContentLoaded', () => {
    console.log('[CartPage] DOMContentLoaded fired');
    initCartPage();
});

async function initCartPage() {
    // Safety Timeout: Nếu sau 5s không nạp xong, hiện giỏ hàng trống thay vì treo
    const timeout = setTimeout(() => {
        const container = document.getElementById('cartMainContainer');
        if (container && (container.innerHTML.includes('loading') || container.innerHTML.trim() === '')) {
            console.warn('[CartPage] Safety timeout reached, rendering fallback');
            renderEmptyCart();
        }
    }, 5000);

    try {
        console.log('[CartPage] Starting loadCartData...');
        await loadCartData();
        clearTimeout(timeout);
        console.log('[CartPage] loadCartData finished');
    } catch (err) {
        clearTimeout(timeout);
        console.error('[CartPage] Critical Error:', err);
        renderEmptyCart();
    }
}

async function loadCartData() {
    const auth = getAuth();
    if (!auth || !auth.accessToken) {
        console.log('[CartPage] Not logged in, loading local cart');
        loadCartFromLocal();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/cart`, {
            headers: { 'Authorization': `Bearer ${auth.accessToken}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.error('[CartPage] Unauthorized. Token might be expired.');
                loadCartFromLocal();
                return;
            }
            throw new Error(`Server responded with ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            console.log('[CartPage] Data loaded successfully', result.data);
            renderCartUI(result.data);
        } else {
            console.error('[CartPage] API Error:', result.message);
            renderEmptyCart();
        }
    } catch (error) {
        console.error('[CartPage] Fetch error:', error);
        renderEmptyCart();
    }
}

function loadCartFromLocal() {
    try {
        const cart = JSON.parse(localStorage.getItem('MG_CLIENT_CART') || '[]');
        if (cart.length === 0) {
            renderEmptyCart();
            return;
        }
        
        const total_items = cart.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        
        const data = {
            items: cart,
            summary: {
                total_items,
                subtotal,
                total: subtotal
            }
        };
        renderCartUI(data);
    } catch (e) {
        renderEmptyCart();
    }
}

function renderCartUI(data) {
    const container = document.getElementById('cartMainContainer');
    if (!container) {
        console.error('[CartPage] Element #cartMainContainer not found!');
        return;
    }

    const items = data.items || [];
    if (items.length === 0) {
        renderEmptyCart();
        return;
    }

    // Header
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

    // Items
    const itemsHtml = items.map(item => {
        const price = parseFloat(item.unit_price) || 0;
        const subtotal = parseFloat(item.subtotal) || 0;
        const formatPrice = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val)) + 'đ';

        return `
            <div class="cart-item" data-id="${item.id}">
                <div class="item-check"><input type="checkbox" checked class="item-checkbox"></div>
                <div class="item-info">
                    <img src="${item.thumbnail && item.thumbnail.length > 5 ? item.thumbnail : '../assets/images/placeholder.png'}" 
                         alt="${item.product_name}" class="item-img" 
                         onerror="this.src='../assets/images/placeholder.png'">
                    <div class="item-details">
                        <h4>${item.product_name || 'Sản phẩm'}</h4>
                        <span class="sku">ID: ${item.product_id}</span>
                        ${item.promo ? `<div class="promo-badge"><i class="fa-solid fa-circle-check"></i> ${item.promo}</div>` : ''}
                    </div>
                </div>
                <div class="item-unit-price">
                    <span class="price-now">${formatPrice(price)}</span>
                    <div class="unit-label">/ ${item.unit_name || 'Hộp'}</div>
                </div>
                <div class="item-qty">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="changeQty(${item.id}, ${item.quantity - 1})">-</button>
                        <input type="text" value="${item.quantity}" class="qty-input" readonly>
                        <button class="qty-btn" onclick="changeQty(${item.id}, ${item.quantity + 1})">+</button>
                    </div>
                </div>
                <div class="item-total">${formatPrice(subtotal)}</div>
                <div class="item-delete" onclick="removeItem(${item.id})"><i class="fa-regular fa-trash-can"></i></div>
            </div>
        `;
    }).join('');

    // Actions
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

    // Update Summary
    updateSummaryUI(data.summary || {});
}

function renderEmptyCart() {
    const container = document.getElementById('cartMainContainer');
    if (!container) return;
    container.innerHTML = `
        <div style="padding: 40px; text-align: center;">
            <img src="../assets/images/empty_cart.png" alt="Empty Cart" style="width: 150px; margin-bottom: 20px; opacity: 0.5;" onerror="this.style.display='none'">
            <p style="color: #6b7280; font-size: 16px;">Giỏ hàng của bạn đang trống.</p>
            <a href="index.html" class="btn-secondary" style="margin-top: 20px; display: inline-block;">Quay lại mua sắm</a>
        </div>
    `;
    updateSummaryUI({ subtotal: 0, total: 0 });
}

function updateSummaryUI(summary) {
    const format = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val || 0)) + 'đ';
    
    const elements = {
        subtotal: document.getElementById('subtotalVal'),
        total: document.getElementById('totalVal'),
        discount: document.getElementById('discountVal'),
        saving: document.getElementById('totalSavingVal'),
        reward: document.getElementById('rewardPoints')
    };

    if (elements.subtotal) elements.subtotal.textContent = format(summary.subtotal);
    if (elements.total) elements.total.textContent = format(summary.total);
    if (elements.discount) elements.discount.textContent = format(summary.discount);
    if (elements.saving) elements.saving.textContent = format(summary.discount);
    
    if (elements.reward) {
        elements.reward.textContent = '+' + Math.floor((summary.total || 0) / 1000) + ' điểm';
    }
}

async function changeQty(itemId, newQty) {
    if (newQty < 1) return;
    const auth = getAuth();
    if (!auth || !auth.accessToken) {
        let cart = JSON.parse(localStorage.getItem('MG_CLIENT_CART') || '[]');
        const item = cart.find(i => i.id === itemId);
        if (item) {
            item.quantity = newQty;
            item.subtotal = item.quantity * item.unit_price;
            localStorage.setItem('MG_CLIENT_CART', JSON.stringify(cart));
            loadCartData();
            if (window.updateCartBadge) window.updateCartBadge();
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/cart/items/${itemId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.accessToken}`
            },
            body: JSON.stringify({ quantity: newQty })
        });
        if (response.ok) {
            loadCartData();
            if (window.updateCartBadge) window.updateCartBadge();
        }
    } catch (e) { console.error(e); }
}

async function removeItem(itemId) {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
    const auth = getAuth();
    if (!auth || !auth.accessToken) {
        let cart = JSON.parse(localStorage.getItem('MG_CLIENT_CART') || '[]');
        cart = cart.filter(i => i.id !== itemId);
        localStorage.setItem('MG_CLIENT_CART', JSON.stringify(cart));
        loadCartData();
        if (window.updateCartBadge) window.updateCartBadge();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/cart/items/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${auth.accessToken}` }
        });
        if (response.ok) {
            loadCartData();
            if (window.updateCartBadge) window.updateCartBadge();
        }
    } catch (e) { console.error(e); }
}

async function clearCart() {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ giỏ hàng?')) return;
    const auth = getAuth();
    if (!auth || !auth.accessToken) {
        localStorage.removeItem('MG_CLIENT_CART');
        loadCartData();
        if (window.updateCartBadge) window.updateCartBadge();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/cart`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${auth.accessToken}` }
        });
        if (response.ok) {
            loadCartData();
            if (window.updateCartBadge) window.updateCartBadge();
        }
    } catch (e) { console.error(e); }
}

function goToCheckout() {
    const auth = getAuth();
    if (!auth || !auth.accessToken) {
        alert('Vui lòng đăng nhập để tiến hành thanh toán');
        window.location.href = 'login.html';
        return;
    }
    window.location.href = 'checkout.html';
}

function getAuth() {
    try {
        return JSON.parse(localStorage.getItem('MG_CLIENT_AUTH'));
    } catch (e) { return null; }
}

window.changeQty = changeQty;
window.removeItem = removeItem;
window.clearCart = clearCart;
window.goToCheckout = goToCheckout;
