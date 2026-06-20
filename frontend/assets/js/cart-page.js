/**
 * cart-page.js
 * Xử lý hiển thị và tương tác trên trang giỏ hàng (cart.html)
 */

const GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
const API_BASE = GATEWAY + '/api/order';

document.addEventListener('DOMContentLoaded', () => {
    console.log('[CartPage] DOMContentLoaded fired');
    initCartPage();
});

// Voucher handling state
let activeSubtotal = 0;
let activeDiscount = 0;
let appliedVoucherCode = null;

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
        // Initialize Vouchers handling first so elements are responsive immediately
        initVouchersHandling();

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

    // Gắn data giá vào từng row để dùng khi checkbox thay đổi
    items.forEach(item => {
        const row = container.querySelector(`.cart-item[data-id="${item.id}"]`);
        if (row) {
            row.dataset.subtotal = parseFloat(item.subtotal) || 0;
        }
    });

    // Hàm tính lại tổng từ các item được chọn
    function recalcFromChecked() {
        const checkedRows = container.querySelectorAll('.cart-item .item-checkbox:checked');
        let total = 0;
        checkedRows.forEach(cb => {
            const row = cb.closest('.cart-item');
            if (row) total += parseFloat(row.dataset.subtotal) || 0;
        });
        activeSubtotal = total;
        recalculateSummary();
    }

    // Gắn event cho từng checkbox item
    container.querySelectorAll('.item-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            // Đồng bộ trạng thái #selectAll
            const allBoxes = container.querySelectorAll('.item-checkbox');
            const allChecked = [...allBoxes].every(b => b.checked);
            const selectAll = document.getElementById('selectAll');
            if (selectAll) selectAll.checked = allChecked;
            recalcFromChecked();
        });
    });

    // Gắn event cho checkbox "Chọn tất cả"
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', () => {
            container.querySelectorAll('.item-checkbox').forEach(cb => {
                cb.checked = selectAll.checked;
            });
            recalcFromChecked();
        });
    }

    // Update Summary (lần đầu tính tất cả vì mặc định tất cả được check)
    updateSummaryUI(data.summary || {});

    // Auto-apply the best eligible discount code
    autoApplyBestVoucher();
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
    activeSubtotal = summary.subtotal || 0;
    recalculateSummary();
}

function recalculateSummary() {
    const format = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val || 0)) + 'đ';
    const subtotal = activeSubtotal;
    const discount = activeDiscount;
    const total = Math.max(0, subtotal - discount);

    const elements = {
        subtotal: document.getElementById('subtotalVal'),
        total: document.getElementById('totalVal'),
        discount: document.getElementById('discountVal'),
        saving: document.getElementById('totalSavingVal'),
        reward: document.getElementById('rewardPoints')
    };

    if (elements.subtotal) elements.subtotal.textContent = format(subtotal);
    if (elements.total) elements.total.textContent = format(total);
    if (elements.discount) elements.discount.textContent = format(discount);
    if (elements.saving) elements.saving.textContent = format(discount);
    
    if (elements.reward) {
        elements.reward.textContent = '+' + Math.floor(total / 1000) + ' điểm';
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
        } else {
            const result = await response.json().catch(() => ({}));
            alert(result.message || 'Không đủ tồn kho khả dụng.');
            loadCartData();
        }
    } catch (e) { 
        console.error(e); 
        loadCartData();
    }
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
        if (typeof window.openClientAuthModal === 'function') {
            window.openClientAuthModal('login');
        } else {
            alert('Vui lòng đăng nhập để tiến hành thanh toán');
        }
        return;
    }

    const checkedBoxes = document.querySelectorAll('.cart-item .item-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('Vui lòng chọn ít nhất một sản phẩm để tiến hành thanh toán.');
        return;
    }

    const checkedIds = Array.from(checkedBoxes).map(cb => {
        const row = cb.closest('.cart-item');
        return parseInt(row.dataset.id);
    });

    localStorage.setItem('MG_CHECKOUT_ITEM_IDS', JSON.stringify(checkedIds));
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
window.loadCartData = loadCartData;

// --- VOUCHERS HANDLING ENGINE ---
function initVouchersHandling() {
    const promoSel = document.getElementById('promoSelector');
    if (promoSel) promoSel.addEventListener('click', openVoucherModal);

    const btnApply = document.getElementById('btnApplyVoucher');
    if (btnApply) {
        btnApply.addEventListener('click', () => {
            const code = document.getElementById('voucherInput').value.trim();
            if (!code) {
                showToastMsg('Vui lòng nhập mã giảm giá!', 'error');
                return;
            }
            applyVoucherByCode(code);
        });
    }

    const btnRemove = document.getElementById('btnRemoveVoucher');
    if (btnRemove) btnRemove.addEventListener('click', removeAppliedVoucher);

    const btnClose = document.getElementById('closeVoucherModal');
    if (btnClose) btnClose.addEventListener('click', closeVoucherModal);

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('voucherModal');
        if (e.target === modal) {
            closeVoucherModal();
        }
    });
}

function initVouchersStore() {
    const defaultVouchers = [
        {
            code: "MG38K",
            title: "[Voucher 38k] đơn hàng từ 399k [Khách hàng lần đầu đăng nhập website]",
            value: 38000,
            min_bill: 399000,
            desc: "Áp dụng: Khách hàng lần đầu đăng nhập website<br>Không áp dụng cho các sản phẩm thuộc danh mục Flash Sale. Thuốc và danh mục hạn chế...",
            expiry: "HSD: 23:59, 31/03/2026",
            badge_color: "linear-gradient(135deg,#fca5a5,#ef4444)",
            used: false
        },
        {
            code: "MG70K",
            title: "Voucher 70K [Bill 699K]",
            value: 70000,
            min_bill: 699000,
            desc: "Không áp dụng cho các sản phẩm thuộc danh mục Flash Sale. Thuốc và danh mục hạn chế...",
            expiry: "HSD: 23:59, 31/03/2026",
            badge_color: "linear-gradient(135deg,#fbbf24,#f59e0b)",
            used: false
        },
        {
            code: "MG83K",
            title: "[Voucher 83k] đơn hàng từ 830K",
            value: 83000,
            min_bill: 830000,
            desc: "Không áp dụng cho các sản phẩm thuộc danh mục Flash Sale...",
            expiry: "HSD: 23:59, 31/03/2026",
            badge_color: "linear-gradient(135deg,#fca5a5,#dc2626)",
            used: false
        }
    ];

    if (!localStorage.getItem('MG_CLIENT_VOUCHERS')) {
        localStorage.setItem('MG_CLIENT_VOUCHERS', JSON.stringify(defaultVouchers));
    }
}

function openVoucherModal() {
    initVouchersStore();
    const vouchers = JSON.parse(localStorage.getItem('MG_CLIENT_VOUCHERS') || '[]');
    const unusedVouchers = vouchers.filter(v => !v.used);

    const listContainer = document.getElementById('modalVoucherList');
    const modal = document.getElementById('voucherModal');
    if (modal) modal.style.display = 'flex';

    if (unusedVouchers.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #6b7280; font-size: 13px; padding: 20px 0; width: 100%;">Bạn đã sử dụng hết mã giảm giá!</p>';
        return;
    }

    listContainer.innerHTML = unusedVouchers.map(v => {
        const isEligible = activeSubtotal >= v.min_bill;
        const isApplied = appliedVoucherCode === v.code;

        let btnText = 'Áp dụng';
        let btnStyle = 'background: #0b7a3e; color: #fff; cursor: pointer;';
        let disabledAttr = '';

        if (isApplied) {
            btnText = 'Đang dùng';
            btnStyle = 'background: #059669; color: #fff; cursor: default; font-weight: 700;';
            disabledAttr = 'disabled';
        } else if (!isEligible) {
            btnText = 'Áp dụng';
            btnStyle = 'background: #e5e7eb; color: #9ca3af; cursor: not-allowed;';
            disabledAttr = 'disabled';
        }

        const minBillText = new Intl.NumberFormat('vi-VN').format(v.min_bill) + 'đ';
        const valueText = new Intl.NumberFormat('vi-VN').format(v.value) + 'đ';

        return `
            <div class="modal-voucher-item" style="border: ${isApplied ? '2px solid #059669' : '1px solid #e5e7eb'}; border-radius: 8px; padding: 12px; display: flex; gap: 12px; align-items: center; background: #fff; text-align: left; position: relative;">
                ${isApplied ? `<span style="position: absolute; top: -10px; right: 10px; background: #059669; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">Đang chọn</span>` : ''}
                <div style="background: ${v.badge_color}; color: #fff; border-radius: 6px; padding: 10px; width: 70px; text-align: center; font-weight: 700; font-size: 14px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; height: 50px; box-sizing: border-box;">
                    ${valueText}
                </div>
                <div style="flex: 1; min-width: 0; font-size: 12px; line-height: 1.4;">
                    <strong style="font-size: 13px; color: #111827; display: block; margin-bottom: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${v.title}</strong>
                    <span style="color: #6b7280; display: block; margin-bottom: 4px;">Đơn tối thiểu: ${minBillText}</span>
                    <span style="color: #9ca3af; font-size: 11px;">HSD: 31/03/2026</span>
                </div>
                <button onclick="selectVoucherFromModal('${v.code}')" ${disabledAttr} style="${btnStyle} border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; flex-shrink: 0; transition: background 0.2s;">
                    ${isApplied ? '<i class="fa-solid fa-circle-check"></i> ' : ''}${btnText}
                </button>
            </div>
        `;
    }).join('');
}

function closeVoucherModal() {
    const modal = document.getElementById('voucherModal');
    if (modal) modal.style.display = 'none';
}

function selectVoucherFromModal(code) {
    document.getElementById('voucherInput').value = code;
    applyVoucherByCode(code);
    closeVoucherModal();
}

function autoApplyBestVoucher() {
    if (appliedVoucherCode) return; // Do not overwrite manually applied code

    initVouchersStore();
    const vouchers = JSON.parse(localStorage.getItem('MG_CLIENT_VOUCHERS') || '[]');
    const unusedVouchers = vouchers.filter(v => !v.used);

    if (unusedVouchers.length === 0) return;

    // Filter vouchers where activeSubtotal meets the minimum bill requirement
    const eligibleVouchers = unusedVouchers.filter(v => activeSubtotal >= v.min_bill);

    if (eligibleVouchers.length === 0) return;

    // Sort by discount value descending to find the "best" one (highest discount value)
    eligibleVouchers.sort((a, b) => b.value - a.value);

    const bestVoucher = eligibleVouchers[0];

    // Apply it!
    applyVoucherByCode(bestVoucher.code, true);
}

function applyVoucherByCode(code, isAuto = false) {
    initVouchersStore();
    const vouchers = JSON.parse(localStorage.getItem('MG_CLIENT_VOUCHERS') || '[]');
    const v = vouchers.find(x => x.code === code.toUpperCase());

    if (!v) {
        showToastMsg('Mã giảm giá không tồn tại!', 'error');
        return;
    }

    if (v.used) {
        showToastMsg('Mã giảm giá này đã được sử dụng!', 'error');
        return;
    }

    if (activeSubtotal < v.min_bill) {
        const minText = new Intl.NumberFormat('vi-VN').format(v.min_bill) + 'đ';
        showToastMsg(`Đơn hàng tối thiểu ${minText} để sử dụng mã này!`, 'error');
        return;
    }

    // Apply discount
    activeDiscount = v.value;
    appliedVoucherCode = v.code;

    // Show applied banner
    const container = document.getElementById('appliedPromoContainer');
    const textSpan = document.getElementById('appliedPromoText');
    if (textSpan) {
        textSpan.innerHTML = `Đã áp dụng mã <strong>${v.code}</strong> (giảm -${new Intl.NumberFormat('vi-VN').format(v.value)}đ)`;
    }
    if (container) container.style.display = 'flex';

    // Disable input and update apply button
    const voucherInput = document.getElementById('voucherInput');
    if (voucherInput) voucherInput.disabled = true;
    
    const btnApply = document.getElementById('btnApplyVoucher');
    if (btnApply) {
        btnApply.disabled = true;
        btnApply.textContent = 'Đã áp dụng';
        btnApply.style.background = '#d1fae5'; // Premium light green background
        btnApply.style.color = '#065f46'; // Elegant dark green text
    }

    recalculateSummary();
    
    if (isAuto) {
        showToastMsg(`Hệ thống tự động áp dụng mã ưu đãi tốt nhất: ${v.code}!`, 'success');
    } else {
        showToastMsg(`Đã áp dụng mã giảm giá ${v.code}!`, 'success');
    }
}

function removeAppliedVoucher() {
    activeDiscount = 0;
    appliedVoucherCode = null;

    // Hide applied banner
    const container = document.getElementById('appliedPromoContainer');
    if (container) container.style.display = 'none';

    // Re-enable input and apply button
    const voucherInput = document.getElementById('voucherInput');
    if (voucherInput) {
        voucherInput.value = '';
        voucherInput.disabled = false;
    }
    
    const btnApply = document.getElementById('btnApplyVoucher');
    if (btnApply) {
        btnApply.disabled = false;
        btnApply.textContent = 'Áp dụng';
        btnApply.style.background = '#f3f4f6';
        btnApply.style.color = '#374151';
    }

    recalculateSummary();
    showToastMsg('Đã hủy áp dụng mã giảm giá.', 'success');
}

function showToastMsg(message, type = 'success') {
    const old = document.getElementById('voucher-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = 'voucher-toast';
    
    const isError = type === 'error';
    const bg = isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(11, 122, 62, 0.95)';
    const icon = isError ? 'fa-triangle-exclamation' : 'fa-circle-check';

    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bg};
        color: #fff;
        padding: 12px 24px;
        border-radius: 50px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        z-index: 10005;
        font-family: 'Sarabun', sans-serif;
        font-size: 14px;
        font-weight: 600;
        transition: opacity 0.3s, transform 0.3s;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.selectVoucherFromModal = selectVoucherFromModal;
window.changeQty = changeQty;
window.removeItem = removeItem;
window.clearCart = clearCart;
window.goToCheckout = goToCheckout;
window.loadCartData = loadCartData;
