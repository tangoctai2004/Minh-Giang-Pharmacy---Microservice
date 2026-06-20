/**
 * pos-loader.js
 * Manages POS kiosk product lookup, search, cart, loyalty points, and checkout.
 */

const API_BASE = localStorage.getItem('MG_API_BASE') || (
    (window.location.origin.includes('localhost:5500') ||
     window.location.origin.includes('localhost:5501') ||
     window.location.origin.includes('127.0.0.1:5500') ||
     window.location.origin.includes('127.0.0.1:5501'))
    ? 'http://localhost:8000/api'
    : window.location.origin.replace(/\/+$/, '') + '/api'
);

let posCart = [];
let categories = [];
let activeCategoryId = null;
let searchQuery = '';
let barcodeQuery = '';

// Checkout State
let appliedVoucher = null;
let usePoints = false;
let paymentMethod = 'cash'; // 'cash', 'qr', 'card', 'debt'
let customerPhone = '';
let rxDoctorName = '';
let rxNumber = '';

document.addEventListener('DOMContentLoaded', () => {
    initPos();
});

async function initPos() {
    // 1. Fetch categories
    await loadCategories();

    // 2. Fetch initial products
    await loadProducts();

    // 3. Bind search inputs
    const searchInput = document.querySelector('.pos-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const val = e.target.value.trim();
            // Detect barcode (numeric, typically length >= 8)
            if (/^\d{8,15}$/.test(val)) {
                barcodeQuery = val;
                searchQuery = '';
                loadProducts(true); // search by barcode
            } else {
                searchQuery = val;
                barcodeQuery = '';
                loadProducts();
            }
        }, 300));
    }

    // 4. Bind customer phone input
    const phoneInput = document.querySelector('.pos-customer-input input');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            customerPhone = e.target.value.trim();
            // Automatically update loyalty display mock if phone changes
            const loyaltyBox = document.getElementById('loyaltyPointsBox');
            if (loyaltyBox) {
                if (customerPhone.length >= 10) {
                    loyaltyBox.style.display = 'flex';
                } else {
                    loyaltyBox.style.display = 'none';
                    usePoints = false;
                    const chk = document.getElementById('usePointsCheckbox');
                    if (chk) chk.checked = false;
                }
                recalculateTotals();
            }
        });
    }

    // Hide loyalty points box initially
    const loyaltyBox = document.getElementById('loyaltyPointsBox');
    if (loyaltyBox) loyaltyBox.style.display = 'none';

    // Clear static cart items
    const cartItemsEl = document.getElementById('cartItems');
    if (cartItemsEl) cartItemsEl.innerHTML = '';
    updateCartUI();
}

async function loadCategories() {
    try {
        // Lấy cây danh mục, chỉ lấy root categories (9 nhóm cha) để hiển thị pill
        const res = await fetch(`${API_BASE}/catalog/categories/tree`);
        const result = await res.json();
        if (result.success && result.data) {
            // Chỉ lấy root categories (parent_id = null / level 0)
            categories = result.data.map(cat => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug || ''
            }));
            renderCategoryPills();
        }
    } catch (e) {
        console.error('[POS Loader] Failed to load categories:', e);
    }
}

function renderCategoryPills() {
    const container = document.querySelector('.pos-categories');
    if (!container) return;

    const allPill = `
        <button class="pos-cat-pill active" id="pill-all" onclick="selectCategory(null)">
            <i class="fa-solid fa-border-all"></i>&nbsp; Tất cả
        </button>
    `;

    const iconMap = {
        'thuoc': 'fa-pills',
        'thuc-pham-chuc-nang': 'fa-capsules',
        'duoc-my-pham': 'fa-pump-soap',
        'cham-soc-ca-nhan': 'fa-pump-soap',
        'me-be': 'fa-baby',
        'dung-cu-y-te': 'fa-syringe',
        'benh-ly': 'fa-prescription',
        'goc-suc-khoe': 'fa-heart-pulse',
        'tin-tuc': 'fa-newspaper',
        // fallback keys (old)
        'ke-don': 'fa-prescription',
        'giam-dau': 'fa-pills',
        'vitamin': 'fa-capsules',
        'dung-cu': 'fa-syringe',
        'cham-soc': 'fa-pump-soap'
    };

    const pillsHtml = categories.map(cat => {
        let iconClass = 'fa-prescription';
        for (const [key, icon] of Object.entries(iconMap)) {
            if (cat.slug.includes(key)) {
                iconClass = icon;
                break;
            }
        }
        return `
            <button class="pos-cat-pill" id="pill-${cat.id}" onclick="selectCategory(${cat.id})">
                <i class="fa-solid ${iconClass}"></i>&nbsp; ${cat.name}
            </button>
        `;
    }).join('');

    container.innerHTML = allPill + pillsHtml;
}

function selectCategory(catId) {
    activeCategoryId = catId;
    document.querySelectorAll('.pos-cat-pill').forEach(pill => {
        pill.classList.remove('active');
    });

    if (catId === null) {
        document.getElementById('pill-all').classList.add('active');
    } else {
        const pill = document.getElementById(`pill-${catId}`);
        if (pill) pill.classList.add('active');
    }

    loadProducts();
}

async function loadProducts(isBarcode = false) {
    try {
        let url = `${API_BASE}/catalog/products/pos-search?limit=30`;
        if (activeCategoryId) {
            url += `&category=${activeCategoryId}`;
        }
        if (isBarcode && barcodeQuery) {
            url += `&barcode=${encodeURIComponent(barcodeQuery)}`;
        } else if (searchQuery) {
            url += `&q=${encodeURIComponent(searchQuery)}`;
        }

        const res = await fetch(url);
        const result = await res.json();
        if (result.success && result.data) {
            renderProductGrid(result.data);
        }
    } catch (e) {
        console.error('[POS Loader] Failed to load products:', e);
    }
}

function renderProductGrid(products) {
    const grid = document.querySelector('.pos-product-grid');
    if (!grid) return;

    if (products.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #6b7280; font-size: 16px;"><i class="fa-solid fa-triangle-exclamation" style="font-size:32px; margin-bottom:12px;"></i><br>Không tìm thấy sản phẩm phù hợp.</div>';
        return;
    }

    grid.innerHTML = products.map(p => {
        const outOfStockClass = p.in_stock ? '' : 'out-of-stock';
        const stockStatus = p.in_stock ? `SL: ${p.total_stock}` : 'Hết hàng';
        const lowStockClass = p.total_stock <= 5 && p.in_stock ? 'low' : '';

        // Safely pass product object to addProductToCart
        const pJson = JSON.stringify(p).replace(/"/g, '&quot;');

        let productTags = [];
        if (p.tags) {
            try {
                productTags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags);
            } catch (e) {
                console.error('Error parsing product tags:', e);
            }
        }
        let tagBadgesHtml = '';
        if (productTags && productTags.length > 0) {
            tagBadgesHtml = productTags.map(t => {
                let label = t;
                let cls = 'pos-meta-tag';
                if (t === 'exclusive') { label = 'Độc quyền'; cls += ' exclusive'; }
                else if (t === 'imported') { label = 'Nhập khẩu'; cls += ' imported'; }
                else if (t === 'flash-sale') { label = 'Flash Sale'; cls += ' flash-sale'; }
                else if (t === 'deal') { label = 'Deal Hot'; cls += ' deal'; }
                else if (t === 'best-seller') { label = 'Bán chạy'; cls += ' best-seller'; }
                else if (t === 'discount') { label = 'Giảm giá'; cls += ' discount'; }
                else if (t === 'trending') { label = 'Xu hướng'; cls += ' trending'; }
                return `<span class="pos-meta-badge ${cls}" title="${label}"># ${label}</span>`;
            }).join('');
        }

        return `
            <div class="pos-product-card ${outOfStockClass}" onclick="handleProductClick(${pJson})">
                ${p.in_stock ? '' : `
                <div class="pos-oos-overlay">
                    <span class="pos-oos-label"><i class="fa-solid fa-ban"></i> Hết hàng</span>
                </div>
                `}
                <img src="${p.image_url || '../assets/images/product_frame.png'}" alt="${p.name}" class="pos-product-img" onerror="this.src='../assets/images/product_frame.png'">
                <div class="pos-product-name">${p.name}</div>
                <div class="pos-product-price">${formatVND(p.price)}</div>
                ${tagBadgesHtml ? `<div class="pos-tag-container" style="margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 4px;">${tagBadgesHtml}</div>` : ''}
                <div class="pos-product-meta">
                    <span class="pos-meta-badge pos-meta-loc"><i class="fa-solid fa-location-dot"></i> Kệ A1</span>
                    <span class="pos-meta-badge pos-meta-stock ${lowStockClass}"><i class="fa-solid fa-box"></i> ${stockStatus}</span>
                </div>
            </div>
        `;
    }).join('');
}

function handleProductClick(product) {
    if (!product.in_stock) {
        // Open alternatives drawer/modal
        alert('Sản phẩm đã hết hàng. Vui lòng chọn sản phẩm thay thế khác.');
        return;
    }
    addProductToCart(product);
}

function getQtyInBaseUnit(quantity, selected_unit, base_unit) {
    const cleanUnit = (selected_unit || 'box').trim().toLowerCase();
    const cleanBase = (base_unit || 'Hộp').trim().toLowerCase();
    
    if (cleanUnit === 'box' && (cleanBase === 'hộp' || cleanBase === 'box')) return quantity;
    if (cleanUnit === 'blister' && (cleanBase === 'vỉ' || cleanBase === 'blister')) return quantity;
    if (cleanUnit === 'pill' && (cleanBase === 'viên' || cleanBase === 'pill')) return quantity;

    if (cleanBase === 'viên' || cleanBase === 'pill') {
        if (cleanUnit === 'box' || cleanUnit === 'hộp') return quantity * 30;
        if (cleanUnit === 'blister' || cleanUnit === 'vỉ') return quantity * 10;
        return quantity;
    }
    
    if (cleanBase === 'hộp' || cleanBase === 'box') {
        if (cleanUnit === 'blister' || cleanUnit === 'vỉ') return quantity / 10;
        if (cleanUnit === 'pill' || cleanUnit === 'viên') return quantity / 30;
        return quantity;
    }

    return quantity;
}

function checkStockAvailability(item, targetQty) {
    const baseQty = getQtyInBaseUnit(targetQty, item.selected_unit, item.base_unit);
    if (baseQty > item.total_stock) {
        alert(`Không đủ hàng khả dụng (Kho còn: ${item.total_stock} ${item.base_unit}).`);
        return false;
    }
    return true;
}

function addProductToCart(product) {
    const existing = posCart.find(item => item.id === product.id);
    const targetQty = existing ? existing.quantity + 1 : 1;
    
    const mockItem = {
        selected_unit: existing ? existing.selected_unit : 'box',
        base_unit: product.base_unit || 'Hộp',
        total_stock: product.total_stock
    };
    if (!checkStockAvailability(mockItem, targetQty)) {
        return;
    }

    if (existing) {
        existing.quantity += 1;
    } else {
        posCart.push({
            id: product.id,
            sku: product.sku,
            name: product.name,
            base_price: product.price, // box price
            price: product.price, // current selected UOM price
            quantity: 1,
            selected_unit: 'box', // default
            base_unit: product.base_unit || 'Hộp',
            requires_prescription: product.requires_prescription || false,
            batch_code: 'L-2026', // mockup batch code
            total_stock: product.total_stock
        });
    }
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cartItems');
    if (!container) return;

    if (posCart.length === 0) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #9ca3af;"><i class="fa-solid fa-basket-shopping" style="font-size:32px; margin-bottom:12px;"></i><br>Đơn hàng trống</div>';
        updateTotalsDOM(0, 0, 0);
        return;
    }

    container.innerHTML = posCart.map((item, index) => {
        const rxAlert = item.requires_prescription ? `
            <div class="pos-rx-alert">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Thuốc kê đơn — Cần nhập thông tin bác sĩ
            </div>
        ` : '';

        return `
            <div class="pos-cart-item ${item.requires_prescription ? 'prescription-alert' : ''}">
                <div class="pos-cart-item-top">
                    <div style="flex:1;">
                        <div class="pos-cart-item-name">${item.name}</div>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;"><i class="fa-solid fa-tag" style="margin-right:4px;"></i>Lô: ${item.batch_code}</div>
                    </div>
                    <button class="pos-cart-item-delete" onclick="removeCartItem(${index})"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                ${rxAlert}
                <div class="pos-cart-item-bottom">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <div class="pos-qty-stepper">
                            <button class="pos-qty-btn" onclick="updateQty(${index}, -1)">−</button>
                            <div class="pos-qty-value">${item.quantity}</div>
                            <button class="pos-qty-btn" onclick="updateQty(${index}, 1)">+</button>
                        </div>
                        <select class="pos-uom-select" onchange="updateUOM(${index}, this.value)" style="font-size: 13px; padding: 4px 24px 4px 8px; border: 1px solid #e5e7eb; border-radius: 6px; background: #f8fafc; color: #334155; outline: none; cursor: pointer; height: 32px; font-weight: 500; appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5z%22%20fill%3D%22%2364748b%22%20%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 4px center; background-size: 20px;">
                            <option value="box" ${item.selected_unit === 'box' ? 'selected' : ''}>Hộp</option>
                            <option value="blister" ${item.selected_unit === 'blister' ? 'selected' : ''}>Vỉ</option>
                            <option value="pill" ${item.selected_unit === 'pill' ? 'selected' : ''}>Viên</option>
                        </select>
                    </div>
                    <div class="pos-cart-item-price">${formatVND(item.price * item.quantity)}</div>
                </div>
            </div>
        `;
    }).join('');

    recalculateTotals();
}

function updateQty(index, delta) {
    const item = posCart[index];
    const targetQty = item.quantity + delta;
    if (targetQty < 1) return;

    if (!checkStockAvailability(item, targetQty)) {
        return;
    }

    item.quantity = targetQty;
    updateCartUI();
}

function updateUOM(index, unit) {
    const item = posCart[index];
    const originalUnit = item.selected_unit;
    item.selected_unit = unit;

    if (!checkStockAvailability(item, item.quantity)) {
        item.selected_unit = originalUnit;
        return;
    }
    
    // Scale pricing based on unit selection
    if (unit === 'box') {
        item.price = item.base_price;
    } else if (unit === 'blister') {
        item.price = Math.round(item.base_price / 10);
    } else if (unit === 'pill') {
        item.price = Math.round(item.base_price / 30);
    }
    
    updateCartUI();
}

function removeCartItem(index) {
    posCart.splice(index, 1);
    updateCartUI();
}

function clearCart() {
    posCart = [];
    updateCartUI();
}

function recalculateTotals() {
    const subtotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Voucher Discount
    let discount = 0;
    if (appliedVoucher) {
        if (subtotal >= (appliedVoucher.min_order_value || 0)) {
            if (appliedVoucher.type === 'percent_discount') {
                discount = subtotal * (appliedVoucher.discount_value / 100);
                if (appliedVoucher.max_discount_amount) {
                    discount = Math.min(discount, appliedVoucher.max_discount_amount);
                }
            } else if (appliedVoucher.type === 'fixed_discount') {
                discount = appliedVoucher.discount_value;
            }
        } else {
            alert(`Đơn hàng không đủ điều kiện dùng mã giảm giá này. Đã xoá mã giảm.`);
            appliedVoucher = null;
        }
    }

    // Loyalty Points Discount
    let pointsDiscount = 0;
    if (usePoints) {
        pointsDiscount = 25000;
    }

    const totalDiscount = discount + pointsDiscount;
    updateTotalsDOM(subtotal, totalDiscount, Math.max(0, subtotal - totalDiscount));
}

function updateTotalsDOM(subtotal, discount, total) {
    const totalQty = posCart.reduce((sum, item) => sum + item.quantity, 0);

    // 1. Sidebar Totals
    const checkoutRows = document.querySelectorAll('.pos-checkout-row');
    if (checkoutRows.length >= 2) {
        checkoutRows[0].querySelector('.pos-checkout-label').textContent = `Tạm tính (${totalQty} sản phẩm)`;
        checkoutRows[0].querySelector('.pos-checkout-value').textContent = formatVND(subtotal);
        checkoutRows[1].querySelector('.pos-checkout-value').textContent = `-${formatVND(discount)}`;
    }

    const mainTotalEl = document.querySelector('.pos-checkout-total .amount');
    if (mainTotalEl) mainTotalEl.textContent = formatVND(total);

    const badgeCountEl = document.getElementById('cartCount');
    if (badgeCountEl) badgeCountEl.textContent = totalQty;

    // 2. Checkout Modal Summary list
    const modalSummaryEl = document.querySelector('.checkout-summary-list');
    if (modalSummaryEl) {
        modalSummaryEl.innerHTML = posCart.map(item => `
            <div class="checkout-summary-item">
                <span>${item.name} × ${item.quantity}</span>
                <span>${formatVND(item.price * item.quantity)}</span>
            </div>
        `).join('');
    }

    // Modal details rows
    const modalItems = document.querySelectorAll('.checkout-left .checkout-summary-item');
    // In actual DOM, modal items are: subtotal, discount, and total
    const modalDetailsContainer = document.querySelector('.checkout-left');
    if (modalDetailsContainer) {
        // We can just query elements containing 'Tạm tính' or 'Giảm giá'
        const items = modalDetailsContainer.querySelectorAll('.checkout-summary-item');
        items.forEach(it => {
            const label = it.querySelector('span:first-child').textContent;
            if (label.includes('Tạm tính')) {
                it.querySelector('span:last-child').textContent = formatVND(subtotal);
            } else if (label.includes('Giảm giá')) {
                it.querySelector('span:last-child').textContent = `-${formatVND(discount)}`;
            }
        });

        const totalAmt = modalDetailsContainer.querySelector('.checkout-summary-total span:last-child');
        if (totalAmt) totalAmt.textContent = formatVND(total);
    }

    // QR Code visual amount update
    const qrAmount = document.querySelector('.qr-amount');
    if (qrAmount) qrAmount.textContent = formatVND(total);

    // Initial Cash change calculations
    const cashInput = document.getElementById('cashReceived');
    if (cashInput) {
        // Round to nearest 10k or 50k
        const expectedCashAmount = Math.ceil(total / 10000) * 10000;
        cashInput.value = expectedCashAmount.toLocaleString('vi-VN');
    }
    calcChange();
}

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ========== LOYALTY POINTS & VOUCHERS ==========
async function applyVoucher() {
    const input = document.getElementById('voucherCodeInput');
    const code = input ? input.value.trim().toUpperCase() : '';
    if (!code) {
        alert('Vui lòng nhập mã Voucher.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/cms/promotions/validate/${encodeURIComponent(code)}`);
        const result = await res.json();
        
        if (result.success && result.data) {
            appliedVoucher = result.data;
            recalculateTotals();
            alert(`Áp dụng thành công mã voucher ${code}: ${appliedVoucher.name}`);
        } else {
            alert(result.message || 'Mã ưu đãi không hợp lệ.');
        }
    } catch (e) {
        console.error('[POS Voucher] Error validating voucher:', e);
        alert('Không kết nối được tới dịch vụ voucher.');
    }
}

function togglePoints() {
    const chk = document.getElementById('usePointsCheckbox');
    usePoints = chk ? chk.checked : false;
    recalculateTotals();
}

// ========== CHECKOUT MODAL TOGGLES & CHANGE ==========
function selectPayment(btn, method) {
    document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    paymentMethod = method;

    document.getElementById('cashPaySection').style.display = method === 'cash' ? 'block' : 'none';
    document.getElementById('qrPaySection').style.display = method === 'qr' ? 'block' : 'none';
    document.getElementById('cardPaySection').style.display = method === 'card' ? 'block' : 'none';
    document.getElementById('debtPaySection').style.display = method === 'debt' ? 'block' : 'none';

    // Swap Checkout Button
    const completeBtn = document.querySelector('.modal-btn-primary');
    if (!completeBtn) return;

    if (method === 'debt') {
        completeBtn.innerHTML = '<i class="fa-solid fa-book-journal-whills"></i> GHI NỢ & HOÀN TẤT';
        completeBtn.style.background = 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)';
        completeBtn.style.boxShadow = '0 4px 14px rgba(194, 65, 12, 0.3)';
    } else {
        completeBtn.innerHTML = '<i class="fa-solid fa-print"></i> IN HOÁ ĐƠN & HOÀN TẤT';
        completeBtn.style.background = 'linear-gradient(135deg, #005824 0%, #10b981 100%)';
        completeBtn.style.boxShadow = '0 4px 14px rgba(0, 88, 36, 0.3)';
    }
}

function setQuickCash(amount) {
    document.getElementById('cashReceived').value = amount.toLocaleString('vi-VN');
    calcChange();
}

function calcChange() {
    const changeEl = document.getElementById('changeAmount');
    const changeDisplay = document.getElementById('changeDisplay');
    if (!changeEl || !changeDisplay) return;

    const totalText = document.querySelector('.checkout-summary-total span:last-child').textContent;
    const totalAmount = parseInt(totalText.replace(/[^0-9]/g, '')) || 0;

    const raw = document.getElementById('cashReceived').value.replace(/[^0-9]/g, '');
    const received = parseInt(raw) || 0;

    const change = received - totalAmount;

    if (change >= 0) {
        changeEl.textContent = formatVND(change);
        changeEl.style.color = '#059669';
        changeDisplay.style.background = '#ecfdf5';
        changeDisplay.style.borderColor = '#a7f3d0';
    } else {
        changeEl.textContent = 'Thiếu ' + formatVND(Math.abs(change));
        changeEl.style.color = '#dc2626';
        changeDisplay.style.background = '#fef2f2';
        changeDisplay.style.borderColor = '#fecaca';
    }
}

// ========== RX MODAL VALIDATIONS ==========
function attemptCheckout() {
    if (posCart.length === 0) {
        alert('Vui lòng thêm sản phẩm vào đơn trước khi thanh toán.');
        return;
    }

    const hasPrescription = posCart.some(item => item.requires_prescription);
    if (hasPrescription) {
        openRxModal();
    } else {
        openCheckoutModal();
    }
}

function openRxModal() {
    document.getElementById('rxModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('rxDoctorName').value = '';
    document.getElementById('rxId').value = '';
    checkRxForm();
    setTimeout(() => document.getElementById('rxDoctorName').focus(), 100);
}

function closeRxModal() {
    document.getElementById('rxModal').classList.remove('open');
    document.body.style.overflow = '';
}

function checkRxForm() {
    const docName = document.getElementById('rxDoctorName').value.trim();
    const btn = document.getElementById('rxVerifyBtn');
    if (!btn) return;

    if (docName.length > 0) {
        btn.disabled = false;
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
        btn.style.background = '#059669';
    } else {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        btn.style.opacity = '0.6';
        btn.style.background = '#10b981';
    }
}

function verifyRxAndContinue() {
    const docInput = document.getElementById('rxDoctorName');
    const rxInput = document.getElementById('rxId');

    rxDoctorName = docInput ? docInput.value.trim() : '';
    rxNumber = rxInput ? rxInput.value.trim() : '';

    if (!rxDoctorName) {
        alert('Vui lòng nhập tên Bác sĩ kê đơn.');
        return;
    }

    closeRxModal();
    setTimeout(() => {
        openCheckoutModal();
    }, 300);
}

function openCheckoutModal() {
    document.getElementById('checkoutModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    recalculateTotals();
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('open');
    document.body.style.overflow = '';
}

// ========== ORDER PLACEMENT TO GATEWAY ==========
async function completeSale() {
    const subtotalText = document.querySelectorAll('.pos-checkout-row')[0].querySelector('.pos-checkout-value').textContent;
    const subtotal = parseInt(subtotalText.replace(/[^0-9]/g, '')) || 0;

    const discountText = document.querySelectorAll('.pos-checkout-row')[1].querySelector('.pos-checkout-value').textContent;
    const discount = parseInt(discountText.replace(/[^0-9]/g, '')) || 0;

    const totalText = document.querySelector('.pos-checkout-total .amount').textContent;
    const total = parseInt(totalText.replace(/[^0-9]/g, '')) || 0;

    const orderItems = posCart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        unit_name: item.selected_unit === 'box' ? 'Hộp' : (item.selected_unit === 'blister' ? 'Vỉ' : 'Viên'),
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
    }));

    const orderPayload = {
        order_channel: 'pos',
        customer_phone: customerPhone || 'Vãng lai',
        payment_method: paymentMethod,
        subtotal: subtotal,
        discount_amount: discount,
        total_amount: total,
        prescription_doctor: rxDoctorName || null,
        prescription_number: rxNumber || null,
        items: orderItems,
        voucher_code: appliedVoucher ? appliedVoucher.code : null
    };

    console.log('[POS Checkout] Submitting payload:', orderPayload);

    try {
        const response = await fetch(`${API_BASE}/order/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getPosToken()}`
            },
            body: JSON.stringify(orderPayload)
        });

        const result = await response.json();

        if (result && result.success) {
            showPosSuccessToast();
        } else {
            alert(result.message || 'Lỗi xảy ra khi thanh toán đơn hàng.');
        }
    } catch (e) {
        console.error('[POS Checkout] Connection failed:', e);
        alert('Không kết nối được tới dịch vụ thanh toán.');
    }
}

function getPosToken() {
    try {
        const auth = JSON.parse(localStorage.getItem('MG_POS_AUTH'));
        return auth ? auth.accessToken : '';
    } catch (e) {
        return '';
    }
}

function showPosSuccessToast() {
    closeCheckoutModal();
    clearCart();

    // Reset customer & Rx
    customerPhone = '';
    const phoneInput = document.querySelector('.pos-customer-input input');
    if (phoneInput) phoneInput.value = '';

    const loyaltyBox = document.getElementById('loyaltyPointsBox');
    if (loyaltyBox) loyaltyBox.style.display = 'none';

    rxDoctorName = '';
    rxNumber = '';

    const toast = document.createElement('div');
    toast.className = 'pos-toast';
    toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> Thanh toán thành công! Đang in hoá đơn...';
    document.body.appendChild(toast);
    
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => { 
        toast.classList.remove('show'); 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}

// Global functions exposing to HTML onclicks
window.handleProductClick = handleProductClick;
window.removeCartItem = removeCartItem;
window.updateQty = updateQty;
window.updateUOM = updateUOM;
window.selectCategory = selectCategory;
window.applyVoucher = applyVoucher;
window.togglePoints = togglePoints;
window.selectPayment = selectPayment;
window.setQuickCash = setQuickCash;
window.calcChange = calcChange;
window.attemptCheckout = attemptCheckout;
window.closeRxModal = closeRxModal;
window.checkRxForm = checkRxForm;
window.verifyRxAndContinue = verifyRxAndContinue;
window.closeCheckoutModal = closeCheckoutModal;
window.completeSale = completeSale;
window.clearCart = clearCart;
