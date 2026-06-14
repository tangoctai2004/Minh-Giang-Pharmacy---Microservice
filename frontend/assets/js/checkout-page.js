/**
 * checkout-page.js
 * Renders checkout from the client cart and validates catalog constraints before order handoff.
 */
(function initCheckoutPage() {
    const state = {
        shippingFee: 0,
        deliveryType: 'pickup',
        paymentMethod: 'cod',
        appliedVoucher: null,
        stockChecked: false
    };

    function catalogApi() {
        if (window.MGCatalogApi) return window.MGCatalogApi;
        const gateway = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
        const baseUrl = window.MG_CATALOG_API_BASE || (gateway + '/api/catalog');
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
                const response = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
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
                if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
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

    function getCart() {
        if (typeof window.getCart === 'function') return window.getCart();
        try {
            return JSON.parse(localStorage.getItem('mg_cart')) || [];
        } catch (error) {
            return [];
        }
    }

    function saveCart(cart) {
        if (typeof window.saveCart === 'function') {
            window.saveCart(cart);
            return;
        }
        localStorage.setItem('mg_cart', JSON.stringify(cart));
    }

    function money(value) {
        return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(Number(value || 0)))) + 'đ';
    }

    function totals(cart) {
        const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
        const productSaving = cart.reduce((sum, item) => {
            const original = Number(item.original_price || item.old_price || 0);
            const price = Number(item.price || 0);
            return original > price ? sum + ((original - price) * Number(item.quantity || 0)) : sum;
        }, 0);
        const promoDiscount = Number(state.appliedVoucher?.discount_amount || 0);
        const shippingFee = subtotal >= 300000 || state.deliveryType === 'pickup' ? 0 : state.shippingFee;
        return {
            subtotal,
            productSaving,
            promoDiscount,
            shippingFee,
            totalSaving: productSaving + promoDiscount,
            total: Math.max(0, subtotal + shippingFee - promoDiscount)
        };
    }

    function renderSummary() {
        const cart = getCart();
        const list = document.querySelector('.summary-list');
        const orderButton = document.querySelector('.btn-order');
        if (!list || !orderButton) return;

        if (cart.length === 0) {
            list.innerHTML = `
                <div style="padding:24px 0;text-align:center;color:#6b7280;">
                    Giỏ hàng của bạn đang trống.
                    <div style="margin-top:12px;"><a href="index.html" style="color:#0b7a3e;font-weight:700;text-decoration:none;">Quay lại mua sắm</a></div>
                </div>
            `;
        } else {
            list.innerHTML = cart.map((item) => {
                const warning = item.stock_warning || (item.requires_prescription ? 'Thuốc kê đơn cần tư vấn dược sĩ' : '');
                return `
                    <div class="summary-item ${item.stock_blocked || item.requires_prescription ? 'summary-item-warning' : ''}">
                        <img src="${escapeHtml(item.image || '../assets/images/product_frame.png')}" alt="${escapeHtml(item.name)}" class="summary-img" onerror="this.src='../assets/images/product_frame.png'">
                        <div class="summary-info">
                            <h4>${escapeHtml(item.name)}</h4>
                            <div class="qty-price">${Number(item.quantity || 0)} x ${money(item.price)} <span class="price-orig">${item.original_price && Number(item.original_price) > Number(item.price) ? money(item.original_price) : ''}</span></div>
                            ${warning ? `<div class="checkout-warning">${escapeHtml(warning)}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        const total = totals(cart);
        setText('.checkout-reward-val', '+' + Math.floor(total.total / 1000) + ' điểm');
        setText('.checkout-subtotal-val', money(total.subtotal));
        setText('.checkout-product-saving-val', total.productSaving > 0 ? '-' + money(total.productSaving) : '0đ');
        setText('.checkout-promo-discount-val', total.promoDiscount > 0 ? '-' + money(total.promoDiscount) : '0đ');
        setText('.checkout-shipping-val', money(total.shippingFee));
        setText('.checkout-saving-val', money(total.totalSaving));
        setText('.val-total', money(total.total));
        orderButton.textContent = `Đặt hàng ( ${money(total.total)} )`;
        orderButton.disabled = cart.length === 0;

        renderPromoHint(total.subtotal);
    }

    function renderPromoHint(subtotal) {
        const promo = document.querySelector('.applied-promo');
        const text = promo?.querySelector('span');
        if (!promo || !text) return;
        if (subtotal <= 0) {
            promo.style.display = 'none';
        } else if (subtotal >= 199000) {
            promo.style.display = 'flex';
            text.textContent = 'Đủ điều kiện nhận ưu đãi quà tặng bill từ 199K';
        } else {
            promo.style.display = 'flex';
            text.textContent = `Mua thêm ${money(199000 - subtotal)} để nhận ưu đãi bill từ 199K`;
        }
    }

    function setText(selector, value) {
        const el = document.querySelector(selector);
        if (el) el.textContent = value;
    }

    async function refreshAvailability() {
        const cart = getCart();
        const ids = cart.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0);
        if (!ids.length) return;

        try {
            const result = await catalogApi().get('inventory/availability', { product_ids: ids });
            if (!result.success || !Array.isArray(result.data)) return;
            const byId = result.data.reduce((acc, row) => {
                acc[Number(row.product_id)] = row;
                return acc;
            }, {});
            const next = cart.map((item) => {
                const availability = byId[Number(item.id)];
                if (!availability) return item;
                const available = Number(availability.available_stock || 0);
                let stockWarning = '';
                let stockBlocked = false;
                if (available <= 0) {
                    stockWarning = 'Sản phẩm hiện đã hết hàng';
                    stockBlocked = true;
                } else if (available < Number(item.quantity || 0)) {
                    stockWarning = `Chỉ còn ${available} ${item.unit || ''}`.trim();
                    stockBlocked = true;
                }
                return { ...item, available_stock: available, stock_warning: stockWarning, stock_blocked: stockBlocked };
            });
            saveCart(next);
            state.stockChecked = true;
            renderSummary();
        } catch (error) {
            console.error('[Checkout] Availability error:', error);
        }
    }

    async function applyVoucher() {
        const input = document.querySelector('.voucher-input-row input');
        const code = String(input?.value || '').trim();
        const cart = getCart();
        if (!code) {
            alert('Vui lòng nhập mã giảm giá.');
            return;
        }
        if (!cart.length) {
            alert('Giỏ hàng trống, chưa thể áp dụng mã giảm giá.');
            return;
        }

        try {
            const total = totals(cart);
            const result = await catalogApi().post('promotions/vouchers/validate', {
                code,
                order_amount: total.subtotal,
                items: cart.map((item) => ({ product_id: Number(item.id), qty: Number(item.quantity || 0) }))
            });
            if (!result.success || !result.data) throw new Error(result.message || 'Mã giảm giá không hợp lệ.');
            state.appliedVoucher = {
                code,
                discount_amount: Number(result.data.discount_amount || 0)
            };
            renderSummary();
            alert(result.data.message || 'Đã áp dụng mã giảm giá.');
        } catch (error) {
            state.appliedVoucher = null;
            renderSummary();
            alert(error.message || 'Không thể áp dụng mã giảm giá.');
        }
    }

    function bindUi() {
        document.querySelectorAll('.delivery-box').forEach((box, index) => {
            box.addEventListener('click', () => {
                document.querySelectorAll('.delivery-box').forEach((item) => item.classList.remove('active'));
                box.classList.add('active');
                state.deliveryType = index === 0 ? 'delivery' : 'pickup';
                state.shippingFee = index === 0 ? 18000 : 0;
                renderSummary();
            });
        });

        const paymentKeys = ['cod', 'vnpay', 'momo', 'zalopay'];
        document.querySelectorAll('.payment-box').forEach((box, index) => {
            box.addEventListener('click', () => {
                document.querySelectorAll('.payment-box').forEach((item) => item.classList.remove('active'));
                box.classList.add('active');
                state.paymentMethod = paymentKeys[index] || 'cod';
            });
        });

        const voucherButton = document.querySelector('.voucher-input-row button');
        const voucherInput = document.querySelector('.voucher-input-row input');
        voucherButton?.addEventListener('click', applyVoucher);
        voucherInput?.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyVoucher();
            }
        });

        const form = document.querySelector('.checkout-main');
        form?.addEventListener('submit', (event) => {
            event.preventDefault();
            submitCheckout();
        });
    }

    function submitCheckout() {
        const cart = getCart();
        if (!cart.length) {
            alert('Giỏ hàng trống.');
            return;
        }
        const rxItem = cart.find((item) => item.requires_prescription);
        if (rxItem) {
            alert(`${rxItem.name} là thuốc kê đơn. Vui lòng liên hệ dược sĩ để được tư vấn và kiểm tra toa.`);
            return;
        }
        const blockedItem = cart.find((item) => item.stock_blocked);
        if (blockedItem) {
            alert(`${blockedItem.name} không đủ tồn kho. Vui lòng quay lại giỏ hàng để điều chỉnh.`);
            return;
        }
        if (!state.stockChecked) {
            alert('Đang kiểm tra tồn kho, vui lòng thử lại sau vài giây.');
            return;
        }
        alert('Thông tin giỏ hàng đã sẵn sàng. Bước tạo đơn cần kết nối order-service checkout.');
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindUi();
        renderSummary();
        refreshAvailability();
    });
})();
