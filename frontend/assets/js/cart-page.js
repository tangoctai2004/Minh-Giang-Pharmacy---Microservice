/**
 * cart-page.js
 * Xử lý hiển thị và tương tác trên trang giỏ hàng (cart.html)
 */

document.addEventListener('DOMContentLoaded', () => {
    waitForCartStorage(() => {
        bindCartSummaryActions();
        renderCart();
        refreshCartAvailability();
    });
});

const cartPageState = {
    appliedVoucher: null
};

function waitForCartStorage(callback, attempts = 0) {
    if (typeof getCart === 'function' && typeof saveCart === 'function') {
        callback();
        return;
    }
    if (attempts > 30) {
        console.error('[CartPage] cart-handler.js chưa sẵn sàng.');
        return;
    }
    setTimeout(() => waitForCartStorage(callback, attempts + 1), 50);
}

function cartCatalogApi() {
    if (window.MGCatalogApi) return window.MGCatalogApi;
    const baseUrl = window.MG_CATALOG_API_BASE || 'http://localhost:8000/api/catalog';
    return {
        async get(path, params) {
            const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`);
            Object.entries(params || {}).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '') return;
                if (Array.isArray(value)) {
                    if (value.length > 0) url.searchParams.set(key, value.join(','));
                    return;
                }
                url.searchParams.set(key, value);
            });
            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
        async post(path, body) {
            if (window.MGCatalogApi && typeof window.MGCatalogApi.post === 'function') {
                return window.MGCatalogApi.post(path, body);
            }
            const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`);
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {})
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.message || `HTTP ${response.status}`);
            }
            return payload;
        }
    };
}

function escapeHtml(value) {
    if (window.MGClientApi && typeof window.MGClientApi.escapeHtml === 'function') {
        return window.MGClientApi.escapeHtml(value);
    }
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

    let itemsHtml = cart.map((item, index) => {
        const id = Number(item.id);
        const stockNote = item.stock_warning
            ? `<div class="promo-badge" style="color:#dc2626;"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(item.stock_warning)}</div>`
            : '';
        return `
        <div class="cart-item ${item.stock_blocked ? 'cart-stock-blocked' : ''}" data-id="${id}">
            <div class="item-check"><input type="checkbox" checked class="item-checkbox"></div>
            <div class="item-info">
                <img src="${escapeHtml(item.image || '../assets/images/placeholder.png')}" alt="${escapeHtml(item.name)}" class="item-img">
                <div class="item-details">
                    <h4>${escapeHtml(item.name)}</h4>
                    <span class="sku">${item.sku ? `SKU: ${escapeHtml(item.sku)}` : `ID: ${id}`}</span>
                    ${stockNote}
                </div>
            </div>
            <div class="item-unit-price">
                <span class="price-now">${new Intl.NumberFormat('vi-VN').format(item.price)}đ</span>
                <div class="unit-label">/ ${item.unit || 'Hộp'}</div>
            </div>
            <div class="item-qty">
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${id}, -1)">-</button>
                    <input type="text" value="${item.quantity}" class="qty-input" readonly>
                    <button class="qty-btn" onclick="updateQty(${id}, 1)">+</button>
                </div>
            </div>
            <div class="item-total">${new Intl.NumberFormat('vi-VN').format(item.price * item.quantity)}đ</div>
            <div class="item-delete" onclick="removeItem(${id})"><i class="fa-regular fa-trash-can"></i></div>
        </div>
    `;
    }).join('');

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
        refreshCartAvailability();
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
        cartPageState.appliedVoucher = null;
        saveCart([]);
        renderCart();
    }
}

async function refreshCartAvailability() {
    const cart = getCart();
    const ids = cart.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return;

    try {
        const result = await cartCatalogApi().get('inventory/availability', { product_ids: ids });
        if (!result.success || !Array.isArray(result.data)) return;

        const availabilityById = result.data.reduce((acc, row) => {
            acc[Number(row.product_id)] = row;
            return acc;
        }, {});

        let changed = false;
        const updatedCart = cart.map((item) => {
            const availability = availabilityById[Number(item.id)];
            if (!availability) return item;

            const availableStock = Number(availability.available_stock || 0);
            let stockWarning = '';
            let stockBlocked = false;
            if (availableStock <= 0) {
                stockWarning = 'Sản phẩm hiện đã hết hàng';
                stockBlocked = true;
            } else if (availableStock < Number(item.quantity || 0)) {
                stockWarning = `Chỉ còn ${availableStock} ${item.unit || ''}`.trim();
                stockBlocked = true;
            }

            const nextItem = {
                ...item,
                available_stock: availableStock,
                nearest_expiry: availability.nearest_expiry || item.nearest_expiry,
                stock_warning: stockWarning,
                stock_blocked: stockBlocked
            };
            changed = changed ||
                item.available_stock !== nextItem.available_stock ||
                item.stock_warning !== nextItem.stock_warning ||
                item.stock_blocked !== nextItem.stock_blocked;
            return nextItem;
        });

        if (changed) {
            saveCart(updatedCart);
            renderCart();
        }
    } catch (error) {
        console.error('[CartPage] Availability check error:', error);
    }
}

function updateSummary(subtotal) {
    const cart = getCart();
    const subtotalEl = document.querySelector('.subtotal-val') || document.querySelector('.price-breakdown .breakdown-row:nth-child(1) span:last-child');
    const totalEl = document.querySelector('.total-val');
    const rewardEl = document.querySelector('.reward-val');
    const productSavingEl = document.querySelector('.price-breakdown .breakdown-row:nth-child(2) .saving-val');
    const promoDiscountEl = document.querySelector('.promo-discount-val');
    const totalSavingEl = document.querySelector('.price-breakdown .breakdown-row:nth-child(5) .saving-val');
    const activePromo = document.querySelector('.active-promo');

    const productSaving = cart.reduce((sum, item) => {
        const originalPrice = Number(item.original_price || item.old_price || 0);
        const currentPrice = Number(item.price || 0);
        if (originalPrice > currentPrice) {
            return sum + ((originalPrice - currentPrice) * Number(item.quantity || 0));
        }
        return sum;
    }, 0);
    const promoDiscount = Number(cartPageState.appliedVoucher?.discount_amount || 0);
    const totalSaving = productSaving + promoDiscount;
    const total = Math.max(0, subtotal - promoDiscount);

    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (productSavingEl) productSavingEl.textContent = productSaving > 0 ? `-${formatMoney(productSaving)}` : '0đ';
    if (promoDiscountEl) promoDiscountEl.textContent = promoDiscount > 0 ? `-${formatMoney(promoDiscount)}` : '0đ';
    if (totalSavingEl) totalSavingEl.textContent = formatMoney(totalSaving);
    if (totalEl) totalEl.textContent = formatMoney(total);
    
    // Giả định 1000đ = 1 điểm
    if (rewardEl) rewardEl.textContent = '+' + Math.floor(total / 1000) + ' điểm';

    if (activePromo) {
        const activePromoText = activePromo.querySelector('span');
        if (cart.length === 0) {
            activePromo.style.display = 'none';
        } else if (subtotal >= 199000) {
            activePromo.style.display = 'flex';
            if (activePromoText) activePromoText.textContent = 'Đủ điều kiện nhận ưu đãi quà tặng bill từ 199K';
        } else {
            activePromo.style.display = 'flex';
            if (activePromoText) activePromoText.textContent = `Mua thêm ${formatMoney(199000 - subtotal)} để nhận ưu đãi bill từ 199K`;
        }
    }
}

function formatMoney(value) {
    return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(Number(value || 0)))) + 'đ';
}

function bindCartSummaryActions() {
    const applyBtn = document.querySelector('.btn-apply');
    const voucherInput = document.querySelector('.voucher-input input');
    if (!applyBtn || !voucherInput) return;

    applyBtn.addEventListener('click', () => applyVoucherCode(voucherInput.value));
    voucherInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') applyVoucherCode(voucherInput.value);
    });
}

async function applyVoucherCode(rawCode) {
    const code = String(rawCode || '').trim();
    const cart = getCart();
    if (!code) {
        alert('Vui lòng nhập mã giảm giá.');
        return;
    }
    if (cart.length === 0) {
        alert('Giỏ hàng trống, chưa thể áp dụng mã giảm giá.');
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    try {
        const result = await cartCatalogApi().post('promotions/vouchers/validate', {
            code,
            order_amount: subtotal,
            items: cart.map((item) => ({ product_id: Number(item.id), qty: Number(item.quantity || 0) }))
        });

        if (!result.success || !result.data) {
            throw new Error(result.message || 'Mã giảm giá không hợp lệ.');
        }

        cartPageState.appliedVoucher = {
            code,
            discount_amount: Number(result.data.discount_amount || 0)
        };
        renderCart();
        alert(result.data.message || 'Đã áp dụng mã giảm giá.');
    } catch (error) {
        cartPageState.appliedVoucher = null;
        renderCart();
        alert(error.message || 'Không thể áp dụng mã giảm giá.');
    }
}

function goToCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        alert('Giỏ hàng trống!');
        return;
    }
    const blockedItem = cart.find((item) => item.stock_blocked);
    if (blockedItem) {
        alert(`${blockedItem.name} không đủ tồn kho để đặt mua. Vui lòng điều chỉnh giỏ hàng.`);
        return;
    }
    window.location.href = 'checkout.html';
}

window.updateQty = updateQty;
window.removeItem = removeItem;
window.clearCart = clearCart;
window.goToCheckout = goToCheckout;
window.refreshCartAvailability = refreshCartAvailability;
window.applyVoucherCode = applyVoucherCode;
