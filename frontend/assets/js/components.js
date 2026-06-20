/**
 * components.js
 * Script to load reusable HTML components (Header, Footer, etc.) dynamically.
 * This allows previewing in VS Code Live Server without a backend.
 */

document.addEventListener("DOMContentLoaded", async function () {
    const includes = document.querySelectorAll("[mg-include]");

    await Promise.all(Array.from(includes).map(async (el) => {
        const file = el.getAttribute("mg-include");
        if (file) {
            try {
                // Thêm query parameter ngẫu nhiên để chống cache từ trình duyệt
                const fetchUrl = file + '?v=' + new Date().getTime();
                const response = await fetch(fetchUrl);
                if (response.ok) {
                    let html = await response.text();
                    // Strip Live Server injected script from the HTML component
                    html = html.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, '');
                    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                    el.outerHTML = html; // Replace the placeholder entirely with the fetched HTML
                } else {
                    console.error("Error loading component:", file, response.statusText);
                    el.innerHTML = "Component not found.";
                }
            } catch (error) {
                console.error("Fetch error for component:", file, error);
                el.innerHTML = "Error loading component.";
            }
        }
    }));

    // Sau khi tất cả component load xong, apply auth header và mega menu
    _loadClientApi();
    _initClientAuthHeader();
    _initMegaMenu();
    _initProductCardNavigation();
    _loadSearchHandler();
    _loadCartHandler();
    _loadCatalogWidgets();
    _ensureClientAuthModal();
    _loadDynamicStoreConfig();
});

// ─── Tải helper API dùng chung ─────────────────
function _loadClientApi() {
    if (window.MGCatalogApi || document.querySelector('script[src*="client-api.js"]')) return;
    const script = document.createElement('script');
    script.src = window.location.pathname.includes('/client/') ? '../assets/js/client-api.js' : 'assets/js/client-api.js';
    document.head.appendChild(script);
}

// ─── Tải động script tìm kiếm ─────────────────
function _loadSearchHandler() {
    const observer = new MutationObserver(function () {
        if (document.getElementById('searchInput')) {
            observer.disconnect();
            if (!document.querySelector('script[src*="search-handler.js"]')) {
                const script = document.createElement('script');
                script.src = window.location.pathname.includes('/client/') ? '../assets/js/search-handler.js' : 'assets/js/search-handler.js';
                document.body.appendChild(script);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback
    if (document.getElementById('searchInput') && !document.querySelector('script[src*="search-handler.js"]')) {
        const script = document.createElement('script');
        script.src = window.location.pathname.includes('/client/') ? '../assets/js/search-handler.js' : 'assets/js/search-handler.js';
        document.body.appendChild(script);
    }
}

// ─── Tải động script giỏ hàng ─────────────────
function _loadCartHandler() {
    if (!document.querySelector('script[src*="cart-handler.js"]')) {
        const script = document.createElement('script');
        script.src = window.location.pathname.includes('/client/') ? '../assets/js/cart-handler.js' : 'assets/js/cart-handler.js';
        document.body.appendChild(script);
    }
}

// ─── Tải widgets catalog dùng chung ─────────────────
function _loadCatalogWidgets() {
    if (!document.querySelector('.top-search-links, .featured-products-section')) return;

    const start = () => {
        if (window.MGCatalogWidgets && typeof window.MGCatalogWidgets.init === 'function') {
            window.MGCatalogWidgets.init();
            return;
        }
        if (document.querySelector('script[src*="catalog-widgets.js"]')) return;
        const script = document.createElement('script');
        script.src = window.location.pathname.includes('/client/') ? '../assets/js/catalog-widgets.js' : 'assets/js/catalog-widgets.js';
        document.body.appendChild(script);
    };

    if (window.MGCatalogApi) {
        start();
        return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
        attempts += 1;
        if (window.MGCatalogApi || attempts >= 20) {
            clearInterval(timer);
            start();
        }
    }, 50);
}

// ─── Điều hướng Product Card toàn cục ─────────────────
function _initProductCardNavigation() {
    document.addEventListener('click', function (e) {
        const card = e.target.closest('.product-card');
        const addCartBtn = e.target.closest('.btn-add-cart');

        // Nếu click vào card nhưng KHÔNG phải click vào nút thêm giỏ hàng
        if (card && !addCartBtn) {
            const productId = card.dataset.productId;
            let productPath = _resolveClientPath('product.html');
            if (productId) {
                productPath += `?id=${productId}`;
            }
            window.location.href = productPath;
        }
    });
}

// ─── Mega Menu Initialization ─────────────────
function _initMegaMenu() {
    const observer = new MutationObserver(function () {
        const navList = document.getElementById('main-nav-list');
        if (navList) {
            observer.disconnect();
            if (typeof window.initMegaMenu === 'function') {
                window.initMegaMenu();
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback nếu navList đã có sẵn
    if (document.getElementById('main-nav-list') && typeof window.initMegaMenu === 'function') {
        window.initMegaMenu();
    }
}

// ─── Client Auth Header (dùng chung cho toàn bộ trang client) ─────────────────

function _decodeClientJwtPayload(token) {
    try {
        const payload = token.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(normalized), (c) =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')));
    } catch (e) {
        return null;
    }
}

function _isClientJwtExpired(token, skewSeconds = 30) {
    const payload = _decodeClientJwtPayload(token);
    return !payload || !payload.exp || payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

function _getClientAuth() {
    try {
        const parsed = JSON.parse(localStorage.getItem('MG_CLIENT_AUTH') || 'null');
        if (!parsed || !parsed.accessToken) return null;
        if (_isClientJwtExpired(parsed.accessToken)) {
            localStorage.removeItem('MG_CLIENT_AUTH');
            return null;
        }
        return parsed;
    } catch (e) {
        localStorage.removeItem('MG_CLIENT_AUTH');
        return null;
    }
}

async function _revokeClientRefreshToken(auth) {
    if (!auth || !auth.refreshToken) return;
    try {
        await fetch(_clientIdentityBase() + '/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
    } catch (e) {}
}

function _initClientAuthHeader() {
    // Nếu không phải trang client thì bỏ qua
    if (!window.location.pathname.includes('/client/') &&
        !window.location.pathname.includes('/frontend/client/')) return;

    const observer = new MutationObserver(function () {
        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn) {
            observer.disconnect();
            _applyClientAuthToHeader();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback nếu header đã có sẵn
    _applyClientAuthToHeader();
}

function _applyClientAuthToHeader() {
    try {
        const parsed = _getClientAuth();
        const loginBtn = document.querySelector('.login-btn');
        if (!loginBtn) return;

        // Tránh apply 2 lần
        if (loginBtn.dataset.authApplied === '1') return;
        loginBtn.dataset.authApplied = '1';

        if (!parsed || !parsed.accessToken) {
            loginBtn.href = '#';
            loginBtn.addEventListener('click', function (e) {
                e.preventDefault();
                openClientAuthModal('login');
            });
            return;
        }

        const c = parsed.customer || {};
        const displayName = c.full_name || c.phone || c.email || 'Tài khoản';
        const shortName = displayName.split(' ').pop();

        // Lấy src icon từ img gốc của loginBtn (tránh hardcode đường dẫn)
        const existingImg = loginBtn.querySelector('img');
        const iconSrc = existingImg ? existingImg.src : '';

        loginBtn.innerHTML = `<img src="${iconSrc}" alt="User" class="icon-user"> ${shortName} <i class="fa-solid fa-chevron-down" style="font-size:10px;"></i>`;
        loginBtn.href = '#';
        loginBtn.style.cursor = 'pointer';

        // Tạo dropdown
        const oldDD = document.getElementById('_mgUserDropdown');
        if (oldDD) oldDD.remove();

        const userProfilePath = _resolveClientPath('user-profile.html');

        const dropdown = document.createElement('span');
        dropdown.id = '_mgUserDropdown';
        dropdown.style.cssText = 'position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;z-index:9999;overflow:hidden;opacity:0;visibility:hidden;transform:translateY(-8px);transition:opacity 0.2s ease,transform 0.2s ease,visibility 0.2s;';
        dropdown.innerHTML = `
            <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
                <div style="font-size:13px;font-weight:700;color:#0f172a;">${displayName}</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Khách hàng</div>
            </div>
            <a href="${userProfilePath}" style="display:flex;align-items:center;gap:10px;padding:11px 16px;color:#475569;text-decoration:none;font-size:13px;font-weight:500;">
                <i class="fa-solid fa-user" style="width:14px;"></i> Hồ sơ của tôi
            </a>
            <a href="javascript:void(0)" onclick="clientLogout()" style="display:flex;align-items:center;gap:10px;padding:11px 16px;color:#ef4444;text-decoration:none;font-size:13px;font-weight:500;border-top:1px solid #f1f5f9;">
                <i class="fa-solid fa-sign-out-alt" style="width:14px;"></i> Đăng xuất
            </a>
        `;

        // Wrap loginBtn trong span riêng để hover không lan sang nút khác
        const hoverZone = document.createElement('span');
        hoverZone.style.cssText = 'position:relative;display:inline-block;';
        loginBtn.parentElement.insertBefore(hoverZone, loginBtn);
        hoverZone.appendChild(loginBtn);
        hoverZone.appendChild(dropdown);

        hoverZone.addEventListener('mouseenter', () => {
            dropdown.style.opacity = '1';
            dropdown.style.visibility = 'visible';
            dropdown.style.transform = 'translateY(0)';
        });
        hoverZone.addEventListener('mouseleave', () => {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-8px)';
        });
        loginBtn.onclick = (e) => e.preventDefault();

    } catch (e) { /* ignore */ }
}

function showToast(message, type = 'success') {
    const existing = document.getElementById('mgGlobalToast');
    if (existing) existing.remove();

    const colors = {
        success: { bg: '#10b981', border: '#059669', icon: 'fa-circle-check' },
        error: { bg: '#ef4444', border: '#dc2626', icon: 'fa-circle-exclamation' },
        info: { bg: '#1e293b', border: '#334155', icon: 'fa-circle-info' }
    };
    const theme = colors[type] || colors.success;

    const toast = document.createElement('div');
    toast.id = 'mgGlobalToast';
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 110000;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        background: ${theme.bg};
        border: 1px solid ${theme.border};
        border-radius: 10px;
        color: #fff;
        font-family: 'Sarabun', sans-serif;
        font-size: 14px;
        font-weight: 700;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
        transform: translateX(120%);
        transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
        opacity: 0;
    `;
    toast.innerHTML = `<i class="fa-solid ${theme.icon}" style="font-size: 16px;"></i><span>${message}</span>`;
    document.body.appendChild(toast);

    // Trigger animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    // Animate out and remove
    setTimeout(() => {
        toast.style.transform = 'translateY(16px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

function triggerToastAfterReload(message, type = 'success') {
    sessionStorage.setItem('MG_PENDING_TOAST', JSON.stringify({ message, type }));
}

// Check for pending toast on load
(function initToastCheck() {
    const check = () => {
        try {
            const pending = sessionStorage.getItem('MG_PENDING_TOAST');
            if (pending) {
                sessionStorage.removeItem('MG_PENDING_TOAST');
                const { message, type } = JSON.parse(pending);
                setTimeout(() => showToast(message, type), 300);
            }
        } catch (e) {}
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', check);
    } else {
        check();
    }
})();

async function clientLogout() {
    const auth = JSON.parse(localStorage.getItem('MG_CLIENT_AUTH') || 'null');
    await _revokeClientRefreshToken(auth);
    localStorage.removeItem('MG_CLIENT_AUTH');
    triggerToastAfterReload('Đăng xuất thành công!', 'info');
    if (window.location.pathname.includes('user-profile.html') || window.location.pathname.includes('profile')) {
        window.location.href = 'index.html';
    } else {
        window.location.reload();
    }
}

// ─── Client Auth Modal ─────────────────
function _ensureClientAuthModal() {
    if (document.getElementById('mgClientAuthModal')) return;
    if (!window.location.pathname.includes('/client/') &&
        !window.location.pathname.includes('/frontend/client/')) return;

    const style = document.createElement('style');
    style.textContent = `
        .mg-auth-overlay {
            position: fixed;
            inset: 0;
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(15, 23, 42, 0);
            backdrop-filter: blur(0);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.24s ease, visibility 0.24s ease, background 0.24s ease, backdrop-filter 0.24s ease;
        }
        .mg-auth-overlay.is-open {
            opacity: 1;
            visibility: visible;
            background: rgba(15, 23, 42, 0.58);
            backdrop-filter: blur(6px);
        }
        .mg-auth-dialog {
            width: min(920px, 100%);
            max-height: min(760px, calc(100vh - 40px));
            overflow: hidden;
            display: grid;
            grid-template-columns: minmax(260px, 0.9fr) minmax(360px, 1fr);
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 24px 80px rgba(15, 23, 42, 0.32);
            transform: translateY(16px) scale(0.985);
            transition: transform 0.24s ease;
        }
        .mg-auth-overlay.is-open .mg-auth-dialog {
            transform: translateY(0) scale(1);
        }
        .mg-auth-side {
            position: relative;
            overflow: hidden;
            padding: 40px 38px;
            color: #fff;
            background: linear-gradient(145deg, #047857 0%, #0f766e 52%, #1d4ed8 100%);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 560px;
        }
        .mg-auth-side::after {
            content: '';
            position: absolute;
            width: 260px;
            height: 260px;
            right: -100px;
            bottom: -80px;
            border-radius: 50%;
            background: rgba(255,255,255,0.16);
        }
        .mg-auth-brand {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            gap: 16px;
            font-weight: 800;
            font-size: 20px;
            line-height: 1.25;
        }
        .mg-auth-brand img {
            width: 84px;
            height: 84px;
            object-fit: contain;
            border-radius: 20px;
            background: #fff;
            padding: 10px;
            box-shadow: 0 18px 42px rgba(15, 23, 42, 0.22);
            border: 1px solid rgba(255, 255, 255, 0.8);
        }
        .mg-auth-brand span {
            text-shadow: 0 2px 12px rgba(15, 23, 42, 0.22);
        }
        .mg-auth-benefits {
            position: relative;
            z-index: 1;
            display: grid;
            gap: 14px;
            margin: 28px 0;
        }
        .mg-auth-benefit {
            display: grid;
            grid-template-columns: 46px 1fr;
            gap: 13px;
            align-items: center;
            padding: 13px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.13);
            border: 1px solid rgba(255, 255, 255, 0.18);
            backdrop-filter: blur(8px);
        }
        .mg-auth-benefit i {
            width: 46px;
            height: 46px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.95);
            color: #047857;
            font-size: 22px;
            box-shadow: 0 10px 26px rgba(15, 23, 42, 0.16);
        }
        .mg-auth-benefit strong {
            display: block;
            font-size: 14px;
            line-height: 1.3;
            color: #fff;
            margin-bottom: 3px;
        }
        .mg-auth-benefit span {
            display: block;
            font-size: 12px;
            line-height: 1.4;
            color: #d1fae5;
        }
        .mg-auth-side-copy {
            position: relative;
            z-index: 1;
        }
        .mg-auth-side-copy h2 {
            font-size: 34px;
            line-height: 1.2;
            margin: 0 0 14px;
            letter-spacing: 0;
        }
        .mg-auth-side-copy p {
            color: #d1fae5;
            line-height: 1.65;
            margin: 0;
            font-size: 15px;
        }
        .mg-auth-panel {
            padding: 30px 34px;
            overflow-y: auto;
            min-height: 560px;
            max-height: min(760px, calc(100vh - 40px));
        }
        .mg-auth-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 20px;
        }
        .mg-auth-tabs {
            display: inline-grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            padding: 4px;
            background: #f1f5f9;
            border-radius: 8px;
        }
        .mg-auth-tab {
            border: 0;
            border-radius: 6px;
            padding: 9px 16px;
            background: transparent;
            color: #64748b;
            font-weight: 800;
            cursor: pointer;
            transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .mg-auth-tab.is-active {
            background: #fff;
            color: #047857;
            box-shadow: 0 1px 4px rgba(15, 23, 42, 0.1);
        }
        .mg-auth-close {
            width: 38px;
            height: 38px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #fff;
            color: #475569;
            cursor: pointer;
        }
        .mg-auth-forms {
            position: relative;
        }
        .mg-auth-form {
            display: none;
            animation: mgAuthIn 0.22s ease both;
        }
        .mg-auth-form.is-active {
            display: block;
        }
        @keyframes mgAuthIn {
            from { opacity: 0; transform: translateX(12px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .mg-auth-title {
            margin: 0 0 6px;
            color: #0f172a;
            font-size: 24px;
            letter-spacing: 0;
        }
        .mg-auth-subtitle {
            margin: 0 0 20px;
            color: #64748b;
            font-size: 14px;
            line-height: 1.5;
        }
        .mg-auth-field {
            margin-bottom: 14px;
        }
        .mg-auth-field label {
            display: block;
            font-size: 13px;
            font-weight: 800;
            color: #334155;
            margin-bottom: 7px;
        }
        .mg-auth-input {
            position: relative;
        }
        .mg-auth-input i {
            position: absolute;
            left: 13px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            width: 16px;
            text-align: center;
        }
        .mg-auth-input input {
            width: 100%;
            height: 44px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 0 13px 0 40px;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .mg-auth-input input:focus {
            border-color: #059669;
            box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.13);
        }
        .mg-auth-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin: 8px 0 16px;
        }
        .mg-auth-link {
            border: 0;
            background: transparent;
            color: #047857;
            font-weight: 800;
            cursor: pointer;
            padding: 0;
        }
        .mg-auth-submit {
            width: 100%;
            height: 46px;
            border: 0;
            border-radius: 8px;
            background: #059669;
            color: #fff;
            font-weight: 900;
            font-size: 15px;
            cursor: pointer;
            transition: background 0.18s ease, transform 0.18s ease;
        }
        .mg-auth-submit:hover {
            background: #047857;
        }
        .mg-auth-submit:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        .mg-auth-alert {
            display: none;
            align-items: flex-start;
            gap: 8px;
            padding: 11px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.45;
            margin-bottom: 14px;
        }
        .mg-auth-alert.is-error {
            display: flex;
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
        }
        .mg-auth-alert.is-success {
            display: flex;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
        }
        .mg-auth-social {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 16px;
        }
        .mg-auth-social button {
            height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #fff;
            font-weight: 800;
            color: #334155;
            cursor: pointer;
        }
        .mg-auth-otp {
            max-height: 0;
            opacity: 0;
            overflow: hidden;
            padding: 0 12px;
            border-width: 0;
            margin-bottom: 0;
            border-radius: 8px;
            background: #f0fdf4;
            border-color: #bbf7d0;
            border-style: solid;
            color: #166534;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.45;
            transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.35s ease, 
                        padding 0.35s ease, 
                        border-width 0.35s ease, 
                        margin-bottom 0.35s ease;
        }
        .mg-auth-otp.is-visible {
            max-height: 200px;
            opacity: 1;
            padding: 12px;
            border-width: 1px;
            margin-bottom: 14px;
        }
        .mg-auth-otp .mg-auth-input {
            margin-top: 10px;
            margin-bottom: 8px;
        }
        .mg-auth-password-rules {
            display: grid;
            gap: 4px;
            margin-top: 6px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
        }
        .mg-auth-footer-switch {
            margin-top: 18px;
            text-align: center;
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
        }
        #mgRegisterFields {
            max-height: 500px;
            opacity: 1;
            overflow: hidden;
            transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.35s ease, 
                        margin-bottom 0.35s ease;
        }
        #mgRegisterFields.is-hidden {
            max-height: 0;
            opacity: 0;
            margin-bottom: 0;
            pointer-events: none;
        }
        .mg-auth-buttons-group {
            display: flex;
            gap: 10px;
            margin-top: 14px;
        }
        .mg-auth-buttons-group .mg-auth-submit,
        .mg-auth-buttons-group .mg-auth-cancel {
            flex: 1;
        }
        .mg-auth-cancel {
            height: 46px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #f1f5f9;
            color: #475569;
            font-weight: 900;
            font-size: 15px;
            cursor: pointer;
            transition: background 0.18s ease, transform 0.18s ease;
        }
        .mg-auth-cancel:hover {
            background: #e2e8f0;
        }
        #mgRegisterResend {
            margin-top: 6px;
            display: inline-block;
        }
        body.mg-auth-lock {
            overflow: hidden;
        }
        @media (max-width: 760px) {
            .mg-auth-overlay { padding: 12px; align-items: stretch; }
            .mg-auth-dialog { grid-template-columns: 1fr; max-height: calc(100vh - 24px); }
            .mg-auth-side { display: none; }
            .mg-auth-panel { min-height: 0; padding: 22px; }
            .mg-auth-top { align-items: flex-start; }
            .mg-auth-tabs { flex: 1; }
            .mg-auth-tab { padding-left: 10px; padding-right: 10px; }
            .mg-auth-social { grid-template-columns: 1fr; }
        }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'mgClientAuthModal';
    modal.className = 'mg-auth-overlay';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="mg-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="mgAuthTitle">
            <aside class="mg-auth-side">
                <div class="mg-auth-brand">
                    <img src="${_resolveAssetPath('logo_Minh_Giang_Pharmacy.png')}" alt="Minh Giang Pharmacy">
                    <span>Minh Giang Pharmacy</span>
                </div>
                <div class="mg-auth-benefits">
                    <div class="mg-auth-benefit">
                        <i class="fa-solid fa-receipt"></i>
                        <div><strong>Theo dõi đơn thuốc</strong><span>Xem lại lịch sử mua hàng và toa thuốc.</span></div>
                    </div>
                    <div class="mg-auth-benefit">
                        <i class="fa-solid fa-truck-fast"></i>
                        <div><strong>Giao thuốc nhanh</strong><span>Lưu địa chỉ để đặt hàng thuận tiện hơn.</span></div>
                    </div>
                    <div class="mg-auth-benefit">
                        <i class="fa-solid fa-gift"></i>
                        <div><strong>Tích điểm ưu đãi</strong><span>Nhận quyền lợi thành viên sau mỗi đơn hàng.</span></div>
                    </div>
                </div>
                <div class="mg-auth-side-copy">
                    <h2>Chăm sóc sức khỏe bắt đầu từ tài khoản của bạn</h2>
                    <p>Theo dõi đơn hàng, lưu địa chỉ giao thuốc và nhận ưu đãi thành viên ngay trong một nơi.</p>
                </div>
            </aside>
            <section class="mg-auth-panel">
                <div class="mg-auth-top">
                    <div class="mg-auth-tabs" role="tablist">
                        <button class="mg-auth-tab is-active" type="button" data-auth-mode="login">Đăng nhập</button>
                        <button class="mg-auth-tab" type="button" data-auth-mode="register">Đăng ký</button>
                    </div>
                    <button class="mg-auth-close" type="button" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="mg-auth-alert" id="mgAuthAlert"></div>
                <div class="mg-auth-forms">
                    <form class="mg-auth-form is-active" id="mgLoginForm">
                        <h3 class="mg-auth-title" id="mgAuthTitle">Đăng nhập</h3>
                        <p class="mg-auth-subtitle">Dùng email hoặc số điện thoại đã đăng ký.</p>
                        <div class="mg-auth-field">
                            <label for="mgLoginIdentifier">Email hoặc SĐT</label>
                            <div class="mg-auth-input"><i class="fa-solid fa-envelope"></i><input id="mgLoginIdentifier" type="text" autocomplete="username" required></div>
                        </div>
                        <div class="mg-auth-field">
                            <label for="mgLoginPassword">Mật khẩu</label>
                            <div class="mg-auth-input"><i class="fa-solid fa-lock"></i><input id="mgLoginPassword" type="password" autocomplete="current-password" required></div>
                        </div>
                        <div class="mg-auth-row">
                            <span></span>
                            <button class="mg-auth-link" type="button" data-auth-mode="forgot">Quên mật khẩu?</button>
                        </div>
                        <button class="mg-auth-submit" id="mgLoginSubmit" type="submit">Đăng nhập ngay</button>
                        <div class="mg-auth-social">
                            <button type="button" data-social-auth="zalo"><i class="fa-solid fa-comment" style="color:#0068ff;"></i>Zalo</button>
                            <button type="button" data-social-auth="google"><i class="fa-brands fa-google" style="color:#ea4335;"></i>Google</button>
                        </div>
                        <div class="mg-auth-footer-switch">Chưa có tài khoản? <button class="mg-auth-link" type="button" data-auth-mode="register">Đăng ký</button></div>
                    </form>
                    <form class="mg-auth-form" id="mgRegisterForm">
                        <h3 class="mg-auth-title">Đăng ký</h3>
                        <p class="mg-auth-subtitle">Tạo tài khoản và xác thực email bằng OTP.</p>
                        <div id="mgRegisterFields">
                            <div class="mg-auth-field">
                                <label for="mgRegisterName">Họ và tên</label>
                                <div class="mg-auth-input"><i class="fa-solid fa-user"></i><input id="mgRegisterName" type="text" autocomplete="name" required></div>
                            </div>
                            <div class="mg-auth-field">
                                <label for="mgRegisterPhone">Số điện thoại</label>
                                <div class="mg-auth-input"><i class="fa-solid fa-phone"></i><input id="mgRegisterPhone" type="tel" autocomplete="tel" required></div>
                            </div>
                            <div class="mg-auth-field">
                                <label for="mgRegisterEmail">Email</label>
                                <div class="mg-auth-input"><i class="fa-solid fa-envelope"></i><input id="mgRegisterEmail" type="email" autocomplete="email" required></div>
                            </div>
                            <div class="mg-auth-field">
                                <label for="mgRegisterPassword">Mật khẩu</label>
                                <div class="mg-auth-input"><i class="fa-solid fa-lock"></i><input id="mgRegisterPassword" type="password" autocomplete="new-password" required></div>
                                <div class="mg-auth-password-rules">
                                    <span>Tối thiểu 8 ký tự</span>
                                    <span>Có chữ in hoa và chữ số</span>
                                </div>
                            </div>
                        </div>
                        <div class="mg-auth-otp" id="mgRegisterOtpBox">
                            <div id="mgRegisterOtpText">Mã OTP đã được gửi đến email của bạn.</div>
                            <div class="mg-auth-input"><i class="fa-solid fa-key"></i><input id="mgRegisterOtp" type="text" inputmode="numeric" maxlength="6" placeholder="Nhập mã OTP 6 số"></div>
                            <button class="mg-auth-link" type="button" id="mgRegisterResend">Gửi lại OTP</button>
                        </div>
                        <div class="mg-auth-buttons-group">
                            <button class="mg-auth-submit" id="mgRegisterSubmit" type="submit">Tạo tài khoản</button>
                            <button class="mg-auth-cancel" id="mgRegisterCancel" type="button" style="display: none;">Hủy</button>
                        </div>
                        <div class="mg-auth-footer-switch">Đã có tài khoản? <button class="mg-auth-link" type="button" data-auth-mode="login">Đăng nhập</button></div>
                    </form>
                    <form class="mg-auth-form" id="mgForgotForm">
                        <h3 class="mg-auth-title">Quên mật khẩu</h3>
                        <p class="mg-auth-subtitle">Nhận OTP qua email hoặc số điện thoại để đặt mật khẩu mới.</p>
                        <div class="mg-auth-field" id="mgResetTargetField">
                            <label for="mgResetTarget">Email hoặc SĐT</label>
                            <div class="mg-auth-input"><i class="fa-solid fa-envelope"></i><input id="mgResetTarget" type="text" autocomplete="username" required></div>
                        </div>
                        <div class="mg-auth-field" data-reset-step style="display:none;">
                            <label for="mgResetOtp">Mã OTP</label>
                            <div class="mg-auth-input"><i class="fa-solid fa-key"></i><input id="mgResetOtp" type="text" inputmode="numeric" maxlength="6" disabled></div>
                        </div>
                        <div class="mg-auth-field" data-reset-step style="display:none;">
                            <label for="mgResetPassword">Mật khẩu mới</label>
                            <div class="mg-auth-input"><i class="fa-solid fa-lock"></i><input id="mgResetPassword" type="password" autocomplete="new-password" disabled></div>
                        </div>
                        <div class="mg-auth-field" data-reset-step style="display:none;">
                            <label for="mgResetConfirm">Nhập lại mật khẩu mới</label>
                            <div class="mg-auth-input"><i class="fa-solid fa-lock"></i><input id="mgResetConfirm" type="password" autocomplete="new-password" disabled></div>
                        </div>
                        <div class="mg-auth-buttons-group">
                            <button class="mg-auth-submit" id="mgResetSubmit" type="submit">Gửi mã OTP</button>
                            <button class="mg-auth-cancel" id="mgResetCancel" type="button" style="display: none;">Hủy</button>
                        </div>
                        <div class="mg-auth-footer-switch">Nhớ mật khẩu? <button class="mg-auth-link" type="button" data-auth-mode="login">Đăng nhập</button></div>
                    </form>
                </div>
            </section>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.closest('.mg-auth-close')) closeClientAuthModal();
        const modeBtn = e.target.closest('[data-auth-mode]');
        if (modeBtn) _switchClientAuthMode(modeBtn.dataset.authMode);
        const socialBtn = e.target.closest('[data-social-auth]');
        if (socialBtn) _startClientSocialAuth(socialBtn.dataset.socialAuth, socialBtn);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) closeClientAuthModal();
    });
    document.getElementById('mgLoginForm').addEventListener('submit', _submitClientLogin);
    document.getElementById('mgRegisterForm').addEventListener('submit', _submitClientRegister);
    document.getElementById('mgForgotForm').addEventListener('submit', _submitClientResetPassword);
    document.getElementById('mgRegisterResend').addEventListener('click', _resendClientRegisterOtp);
    document.getElementById('mgRegisterCancel').addEventListener('click', _resetClientRegisterForm);
    document.getElementById('mgResetCancel').addEventListener('click', _resetClientForgotForm);
}

function openClientAuthModal(mode) {
    _ensureClientAuthModal();
    _switchClientAuthMode(mode || 'login');
    const modal = document.getElementById('mgClientAuthModal');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('mg-auth-lock');
    setTimeout(() => {
        const input = modal.querySelector('.mg-auth-form.is-active input');
        if (input) input.focus();
    }, 120);
}

function closeClientAuthModal() {
    const modal = document.getElementById('mgClientAuthModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mg-auth-lock');
    _resetClientRegisterForm();
    _resetClientForgotForm();
}

function _switchClientAuthMode(mode) {
    const modal = document.getElementById('mgClientAuthModal');
    if (!modal) return;
    _setClientAuthAlert('');
    _resetClientRegisterForm();
    _resetClientForgotForm();
    modal.querySelectorAll('.mg-auth-tab').forEach((tab) => {
        tab.classList.toggle('is-active', tab.dataset.authMode === (mode === 'forgot' ? 'login' : mode));
    });
    modal.querySelectorAll('.mg-auth-form').forEach((form) => form.classList.remove('is-active'));
    const target = mode === 'register' ? 'mgRegisterForm' : mode === 'forgot' ? 'mgForgotForm' : 'mgLoginForm';
    document.getElementById(target).classList.add('is-active');
}

function _setClientAuthAlert(message, type) {
    const alert = document.getElementById('mgAuthAlert');
    if (!alert) return;
    alert.className = 'mg-auth-alert';
    alert.innerHTML = '';
    if (!message) return;
    alert.classList.add(type === 'success' ? 'is-success' : 'is-error');
    alert.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${_escapeClientAuthHtml(message)}</span>`;
}

function _clientIdentityBase() {
    let gateway = (window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN;
    if (!gateway) {
        const origin = window.location.origin;
        const isStaticPreview = origin.includes('localhost:5500') ||
            origin.includes('localhost:5501') ||
            origin.includes('127.0.0.1:5500') ||
            origin.includes('127.0.0.1:5501');
        gateway = isStaticPreview ? 'http://localhost:8000' : origin;
    }
    gateway = gateway.replace(/\/+$/, '');
    return gateway + '/api/identity';
}

async function _clientAuthJson(path, body) {
    const res = await fetch(_clientIdentityBase() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Thao tác không thành công');
    }
    return data;
}

function _validClientPassword(password) {
    return password && password.length >= 8 && /\d/.test(password) && /[A-Z]/.test(password);
}

let _pendingClientRegistration = null;
let _resetClientOtpSent = false;

function _showClientRegisterOtpState(email) {
    const fields = document.getElementById('mgRegisterFields');
    if (fields) {
        fields.classList.add('is-hidden');
        fields.querySelectorAll('input').forEach(input => {
            input.disabled = true;
        });
    }

    const otpBox = document.getElementById('mgRegisterOtpBox');
    if (otpBox) {
        otpBox.classList.add('is-visible');
    }

    const otpText = document.getElementById('mgRegisterOtpText');
    if (otpText) {
        otpText.textContent = 'Mã OTP đã được gửi đến ' + email + '.';
    }

    const otpInput = document.getElementById('mgRegisterOtp');
    if (otpInput) {
        otpInput.focus();
    }

    const cancelBtn = document.getElementById('mgRegisterCancel');
    if (cancelBtn) {
        cancelBtn.style.display = 'block';
    }
    
    const btn = document.getElementById('mgRegisterSubmit');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Xác thực Email';
    }
}

function _resetClientRegisterForm() {
    _pendingClientRegistration = null;
    _setClientAuthAlert('');
    
    const fields = document.getElementById('mgRegisterFields');
    if (fields) {
        fields.classList.remove('is-hidden');
        fields.querySelectorAll('input').forEach(input => {
            input.disabled = false;
        });
    }

    const otpBox = document.getElementById('mgRegisterOtpBox');
    if (otpBox) {
        otpBox.classList.remove('is-visible');
    }
    
    const otpInput = document.getElementById('mgRegisterOtp');
    if (otpInput) {
        otpInput.value = '';
    }

    const cancelBtn = document.getElementById('mgRegisterCancel');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }

    const submitBtn = document.getElementById('mgRegisterSubmit');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Tạo tài khoản';
    }
}

function _resetClientForgotForm() {
    _resetClientOtpSent = false;
    
    // Show target field & enable input
    const targetField = document.getElementById('mgResetTargetField');
    if (targetField) {
        targetField.style.display = 'block';
        const input = targetField.querySelector('input');
        if (input) {
            input.disabled = false;
            input.required = true;
        }
    }

    const forgotForm = document.getElementById('mgForgotForm');
    if (forgotForm) {
        forgotForm.reset();
    }

    // Hide reset steps & disable inputs inside them to prevent HTML5 validation conflicts
    document.querySelectorAll('[data-reset-step]').forEach((el) => {
        el.style.display = 'none';
        const input = el.querySelector('input');
        if (input) {
            input.required = false;
            input.disabled = true;
            input.value = '';
        }
    });

    // Hide cancel button
    const cancelBtn = document.getElementById('mgResetCancel');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }

    const btn = document.getElementById('mgResetSubmit');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Gửi mã OTP';
    }
}

async function _submitClientLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('mgLoginSubmit');
    const identifier = document.getElementById('mgLoginIdentifier').value.trim();
    const password = document.getElementById('mgLoginPassword').value;
    if (!identifier || !password) return _setClientAuthAlert('Vui lòng nhập đầy đủ thông tin đăng nhập.');

    btn.disabled = true;
    btn.textContent = 'Đang đăng nhập...';
    try {
        const data = await _clientAuthJson('/auth/login', { email_or_phone: identifier, password });
        if (data.data && data.data.user && !data.data.customer) {
            throw new Error('Tài khoản nhân viên vui lòng đăng nhập tại trang Quản trị.');
        }
        _saveClientAuth(data.data);
        await _syncClientCartAfterLogin(data.data.accessToken);
        triggerToastAfterReload('Đăng nhập thành công!', 'success');
        setTimeout(() => window.location.reload(), 200);
    } catch (err) {
        _setClientAuthAlert(err.message || 'Đăng nhập thất bại.');
        btn.disabled = false;
        btn.textContent = 'Đăng nhập ngay';
    }
}

async function _submitClientRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('mgRegisterSubmit');
    const fullName = document.getElementById('mgRegisterName').value.trim();
    const phone = document.getElementById('mgRegisterPhone').value.trim();
    const email = document.getElementById('mgRegisterEmail').value.trim();
    const password = document.getElementById('mgRegisterPassword').value;
    const otp = document.getElementById('mgRegisterOtp').value.trim();

    if (_pendingClientRegistration) {
        if (!/^\d{6}$/.test(otp)) return _setClientAuthAlert('Vui lòng nhập mã OTP gồm 6 số.');
        btn.disabled = true;
        btn.textContent = 'Đang xác thực...';
        try {
            await _clientAuthJson('/auth/verify-otp', {
                target: _pendingClientRegistration.email,
                target_type: 'email',
                purpose: 'register',
                otp_code: otp,
            });
            const loginData = await _clientAuthJson('/auth/login', {
                email_or_phone: _pendingClientRegistration.email,
                password: _pendingClientRegistration.password,
            });
            _saveClientAuth(loginData.data);
            await _syncClientCartAfterLogin(loginData.data.accessToken);
            triggerToastAfterReload('Đăng ký thành công!', 'success');
            setTimeout(() => window.location.reload(), 200);
        } catch (err) {
            _setClientAuthAlert(err.message || 'Không xác thực được OTP.');
            btn.disabled = false;
            btn.textContent = 'Xác thực Email';
        }
        return;
    }

    if (!fullName || !phone || !email || !password) return _setClientAuthAlert('Vui lòng nhập đầy đủ thông tin đăng ký.');
    if (!_validClientPassword(password)) return _setClientAuthAlert('Mật khẩu phải có ít nhất 8 ký tự, có chữ in hoa và chữ số.');

    btn.disabled = true;
    btn.textContent = 'Đang gửi OTP...';
    try {
        await _clientAuthJson('/auth/register', { full_name: fullName, email, phone, password });
        _pendingClientRegistration = { email, password };
        _showClientRegisterOtpState(email);
        _setClientAuthAlert('Vui lòng kiểm tra email để nhập OTP.', 'success');
    } catch (err) {
        _setClientAuthAlert(err.message || 'Đăng ký thất bại.');
        btn.disabled = false;
        btn.textContent = 'Tạo tài khoản';
    }
}

async function _resendClientRegisterOtp() {
    if (!_pendingClientRegistration) return;
    try {
        await _clientAuthJson('/auth/send-otp', {
            target: _pendingClientRegistration.email,
            target_type: 'email',
            purpose: 'register',
        });
        _setClientAuthAlert('Mã OTP mới đã được gửi.', 'success');
    } catch (err) {
        _setClientAuthAlert(err.message || 'Không gửi lại được OTP.');
    }
}

async function _submitClientResetPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('mgResetSubmit');
    const target = document.getElementById('mgResetTarget').value.trim();
    if (!target) return _setClientAuthAlert('Vui lòng nhập email hoặc số điện thoại.');

    btn.disabled = true;
    try {
        if (!_resetClientOtpSent) {
            btn.textContent = 'Đang gửi OTP...';
            await _clientAuthJson('/auth/send-otp', {
                target,
                purpose: 'reset_password',
                account_type: 'customer',
            });
            _resetClientOtpSent = true;
            
            // Hide target field & disable input to prevent validation issues
            const targetField = document.getElementById('mgResetTargetField');
            if (targetField) {
                targetField.style.display = 'none';
                const input = targetField.querySelector('input');
                if (input) input.disabled = true;
            }

            // Show reset steps & make inputs required & enabled
            document.querySelectorAll('[data-reset-step]').forEach((el) => { 
                el.style.display = 'block'; 
                const input = el.querySelector('input');
                if (input) {
                    input.required = true;
                    input.disabled = false;
                }
            });

            // Show cancel button
            const cancelBtn = document.getElementById('mgResetCancel');
            if (cancelBtn) cancelBtn.style.display = 'block';

            _setClientAuthAlert('OTP đặt lại mật khẩu đã được gửi.', 'success');
            btn.disabled = false;
            btn.textContent = 'Đặt lại mật khẩu';
            
            // Focus on OTP input
            const otpInput = document.getElementById('mgResetOtp');
            if (otpInput) otpInput.focus();
            return;
        }

        const otp = document.getElementById('mgResetOtp').value.trim();
        const newPassword = document.getElementById('mgResetPassword').value;
        const confirmPassword = document.getElementById('mgResetConfirm').value;
        if (!/^\d{6}$/.test(otp)) throw new Error('Vui lòng nhập mã OTP gồm 6 số.');
        if (!_validClientPassword(newPassword)) throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự, có chữ in hoa và chữ số.');
        if (newPassword !== confirmPassword) throw new Error('Mật khẩu mới và xác nhận mật khẩu không khớp.');

        btn.textContent = 'Đang đổi mật khẩu...';
        await _clientAuthJson('/auth/reset-password', {
            target,
            account_type: 'customer',
            otp_code: otp,
            new_password: newPassword,
            confirm_password: confirmPassword,
        });
        _setClientAuthAlert('Mật khẩu đã được đổi. Vui lòng đăng nhập lại.', 'success');
        _resetClientForgotForm();
        setTimeout(() => _switchClientAuthMode('login'), 700);
    } catch (err) {
        _setClientAuthAlert(err.message || 'Không đặt lại được mật khẩu.');
        btn.disabled = false;
        btn.textContent = _resetClientOtpSent ? 'Đặt lại mật khẩu' : 'Gửi mã OTP';
    }
}

function _saveClientAuth(data) {
    localStorage.setItem('MG_CLIENT_AUTH', JSON.stringify({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        customer: data.customer,
        loggedInAt: Date.now(),
    }));
}

async function _syncClientCartAfterLogin(accessToken) {
    if (!accessToken) return;
    try {
        const localCart = JSON.parse(localStorage.getItem('MG_CLIENT_CART') || '[]');
        if (!Array.isArray(localCart) || localCart.length === 0) return;
        const gateway = _clientIdentityBase().replace('/api/identity', '');
        for (const item of localCart) {
            await fetch(gateway + '/api/order/cart/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + accessToken,
                },
                body: JSON.stringify({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    product_sku: item.product_sku,
                    thumbnail: item.thumbnail,
                    quantity: item.quantity,
                    unit_name: item.unit_name,
                    unit_price: item.unit_price,
                }),
            });
        }
        localStorage.removeItem('MG_CLIENT_CART');
    } catch (err) {
        console.error('Lỗi đồng bộ giỏ hàng:', err);
    }
}

async function _startClientSocialAuth(provider, btn) {
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Đang kết nối';
    const width = 600;
    const height = 650;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    const popup = window.open(_clientIdentityBase() + `/auth/${provider}/redirect`, `${provider}-oauth`, `width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) {
        _setClientAuthAlert('Vui lòng cho phép trình duyệt mở popup để đăng nhập.');
        btn.disabled = false;
        btn.innerHTML = oldHtml;
        return;
    }

    const gateway = _clientIdentityBase().replace('/api/identity', '');
    const messageHandler = async (event) => {
        if (event.origin !== gateway && event.origin !== window.location.origin) return;
        const data = event.data;
        if (data && data.success && data.data) {
            window.removeEventListener('message', messageHandler);
            clearInterval(timer);
            _saveClientAuth(data.data);
            await _syncClientCartAfterLogin(data.data.accessToken);
            window.location.reload();
        }
    };
    window.addEventListener('message', messageHandler);

    const timer = setInterval(() => {
        if (popup.closed) {
            clearInterval(timer);
            window.removeEventListener('message', messageHandler);
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }, 1000);
}

function _escapeClientAuthHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Tính đường dẫn tương đối đến thư mục assets/images từ trang hiện tại
function _resolveAssetPath(file) {
    const depth = (window.location.pathname.match(/\//g) || []).length;
    // Live Server: /frontend/client/xxx.html → depth ~3
    if (window.location.pathname.includes('/client/')) {
        return `../assets/images/${file}`;
    }
    return `../assets/images/${file}`;
}

function _resolveClientPath(file) {
    if (window.location.pathname.includes('/client/')) {
        return file; // đã trong thư mục client
    }
    return `../client/${file}`;
}

window.openClientAuthModal = openClientAuthModal;
window.closeClientAuthModal = closeClientAuthModal;

function _resolveImageUrl(url, gateway) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
        const cleanPath = url.startsWith('/') ? url : '/' + url;
        const cleanGateway = gateway.endsWith('/') ? gateway.slice(0, -1) : gateway;
        return cleanGateway + cleanPath;
    }
    return url;
}

window._cachedStoreConfig = null;
window._getStoreConfigPromise = null;

window.getStoreConfig = async function() {
    if (window._cachedStoreConfig) {
        return window._cachedStoreConfig;
    }
    if (window._getStoreConfigPromise) {
        return window._getStoreConfigPromise;
    }
    window._getStoreConfigPromise = (async () => {
        try {
            const gateway = _clientIdentityBase().replace('/api/identity', '');
            const response = await fetch(gateway + '/api/cms/store-config/public?t=' + Date.now());
            if (!response.ok) throw new Error('Failed to fetch public config');
            const resData = await response.json();
            if (resData && resData.success && resData.data) {
                window._cachedStoreConfig = resData.data;
                return window._cachedStoreConfig;
            }
        } catch (e) {
            console.error('Error in getStoreConfig:', e);
        }
        return {};
    })();
    return window._getStoreConfigPromise;
};

async function _loadDynamicStoreConfig() {
    try {
        const config = await window.getStoreConfig();
        if (!config || Object.keys(config).length === 0) return;
        const gateway = _clientIdentityBase().replace('/api/identity', '');

        // 1. Maintenance Mode Check
        if (config.settings_maintenance_mode === true || config.settings_maintenance_mode === 'true') {
            if (!document.getElementById('maintenance-overlay')) {
                const style = document.createElement('style');
                style.id = 'maintenance-style';
                style.textContent = `
                    .maintenance-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(15, 23, 42, 0.85);
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px);
                        z-index: 9999999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #fff;
                        font-family: 'Sarabun', sans-serif;
                        padding: 24px;
                    }
                    .maintenance-card {
                        background: rgba(30, 41, 59, 0.7);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 24px;
                        padding: 40px;
                        max-width: 500px;
                        width: 100%;
                        text-align: center;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                        transform: translateY(0);
                        animation: maintenancePulse 2s infinite ease-in-out;
                    }
                    @keyframes maintenancePulse {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-8px); }
                    }
                    .maintenance-icon {
                        font-size: 64px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        margin-bottom: 24px;
                    }
                    .maintenance-card h2 {
                        font-size: 26px;
                        font-weight: 700;
                        margin-bottom: 16px;
                        letter-spacing: -0.5px;
                        color: #fff;
                    }
                    .maintenance-card p {
                        color: #cbd5e1;
                        font-size: 15px;
                        line-height: 1.6;
                        margin-bottom: 30px;
                    }
                    .maintenance-contact {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                        padding: 12px 28px;
                        border-radius: 9999px;
                        text-decoration: none;
                        font-weight: 700;
                        font-size: 14px;
                        box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
                        transition: all 0.3s;
                    }
                    .maintenance-contact:hover {
                        transform: scale(1.03);
                        box-shadow: 0 10px 20px -3px rgba(16, 185, 129, 0.5);
                    }
                `;
                document.head.appendChild(style);

                const overlay = document.createElement('div');
                overlay.id = 'maintenance-overlay';
                overlay.className = 'maintenance-overlay';
                
                const hotline = config.store_hotline || config.store_phone || '0912 345 678';
                const cleanHotline = hotline.replace(/\s+/g, '');

                overlay.innerHTML = `
                    <div class="maintenance-card">
                        <div class="maintenance-icon">
                            <i class="fa-solid fa-screwdriver-wrench"></i>
                        </div>
                        <h2>Hệ Thống Đang Bảo Trì</h2>
                        <p>Chúng tôi đang nâng cấp hệ thống để mang lại trải nghiệm dịch vụ tốt nhất cho bạn. Mong bạn thông cảm và vui lòng quay lại sau ít phút.</p>
                        <a href="tel:${cleanHotline}" class="maintenance-contact">
                            <i class="fa-solid fa-phone"></i> Hotline hỗ trợ: ${hotline}
                        </a>
                    </div>
                `;
                document.body.appendChild(overlay);
                document.body.style.overflow = 'hidden';
            }
            return;
        }

        // 2. Show Prices Check
        if (config.settings_show_prices === false || config.settings_show_prices === 'false') {
            if (!document.getElementById('hide-prices-style')) {
                const style = document.createElement('style');
                style.id = 'hide-prices-style';
                style.textContent = `
                    .price-new, .pd-mini-price, .mini-product-price, .product-item-price, .item-price, .price, #pdPrice, .cart-price, .price-val, .pd-price-unit {
                        font-size: 0 !important;
                    }
                    .price-new::after, .pd-mini-price::after, .mini-product-price::after, .product-item-price::after, .item-price::after, .price::after, #pdPrice::after, .cart-price::after, .price-val::after, .pd-price-unit::after {
                        content: "Liên hệ" !important;
                        font-size: 14px !important;
                        font-weight: bold !important;
                        color: #eb7c23 !important;
                    }
                    #pdPrice::after {
                        font-size: 24px !important;
                    }
                    .price-old, .discount-badge, .discount, .saving, .price-breakdown {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        // 3. Allow Orders Check
        if (config.settings_allow_orders === false || config.settings_allow_orders === 'false') {
            if (!document.getElementById('disable-orders-style')) {
                const style = document.createElement('style');
                style.id = 'disable-orders-style';
                style.textContent = `
                    .btn-add-cart, .btn-buy-now, .btn-order, .cart-btn, .pd-btn-buy, .pd-btn-cart, #btnBuyNow, #btnAddToCart, .pd-action-buttons button:not(.pd-btn-zalo) {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }
            if (window.location.pathname.includes('checkout.html') || window.location.pathname.includes('cart.html')) {
                alert('Tính năng mua hàng và đặt hàng trực tuyến hiện đang tạm dừng. Vui lòng quay lại sau!');
                window.location.href = 'index.html';
                return;
            }
        }

        // 4. Zalo Chat Floating Button
        const zaloBtnId = 'zalo-floating-chat';
        let zaloBtn = document.getElementById(zaloBtnId);
        if (config.settings_zalo_chat === true || config.settings_zalo_chat === 'true') {
            const zaloUrl = config.store_social_zalo;
            if (zaloUrl && zaloUrl.trim() !== '') {
                if (!zaloBtn) {
                    const style = document.createElement('style');
                    style.id = 'zalo-float-style';
                    style.textContent = `
                        .zalo-float {
                            position: fixed;
                            bottom: 24px;
                            right: 24px;
                            width: 60px;
                            height: 60px;
                            background-color: #0068ff;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 4px 12px rgba(0, 104, 255, 0.4);
                            z-index: 99999;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            animation: zaloPulse 2s infinite;
                        }
                        .zalo-float:hover {
                            transform: scale(1.1);
                            box-shadow: 0 6px 16px rgba(0, 104, 255, 0.6);
                        }
                        .zalo-float img {
                            width: 36px;
                            height: 36px;
                            object-fit: contain;
                        }
                        @keyframes zaloPulse {
                            0% { box-shadow: 0 0 0 0 rgba(0, 104, 255, 0.7); }
                            70% { box-shadow: 0 0 0 15px rgba(0, 104, 255, 0); }
                            100% { box-shadow: 0 0 0 0 rgba(0, 104, 255, 0); }
                        }
                    `;
                    document.head.appendChild(style);

                    zaloBtn = document.createElement('a');
                    zaloBtn.id = zaloBtnId;
                    zaloBtn.className = 'zalo-float';
                    zaloBtn.href = zaloUrl;
                    zaloBtn.target = '_blank';
                    zaloBtn.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/1024px-Icon_of_Zalo.svg.png" alt="Zalo Chat">`;
                    document.body.appendChild(zaloBtn);
                } else {
                    zaloBtn.href = zaloUrl;
                    zaloBtn.style.display = 'flex';
                }
            } else {
                if (zaloBtn) zaloBtn.style.display = 'none';
            }
        } else {
            if (zaloBtn) zaloBtn.style.display = 'none';
            document.querySelectorAll('.pd-btn-zalo').forEach(el => el.style.display = 'none');
        }

        // Bind Zalo buttons
        document.querySelectorAll('.pd-btn-zalo').forEach(el => {
            const zaloUrl = config.store_social_zalo;
            if (config.settings_zalo_chat === true || config.settings_zalo_chat === 'true') {
                if (zaloUrl && zaloUrl.trim() !== '') {
                    el.style.display = '';
                    el.onclick = (e) => {
                        e.preventDefault();
                        window.open(zaloUrl, '_blank');
                    };
                } else {
                    el.style.display = 'none';
                }
            } else {
                el.style.display = 'none';
            }
        });

        // Apply config to elements with data-store-config
        document.querySelectorAll('[data-store-config]').forEach(el => {
            const key = el.getAttribute('data-store-config');
            if (key === 'address' && config.store_address) {
                el.textContent = config.store_address;
            } else if (key === 'store_name' && config.store_name) {
                el.textContent = config.store_name;
            } else if (key === 'phone') {
                const phoneVal = config.store_phone || config.phone;
                if (phoneVal) {
                    const numbers = String(phoneVal).split(/[-|]/);
                    el.innerHTML = numbers.map(num => {
                        const trimmed = num.trim();
                        return `<a href="tel:${trimmed.replace(/\s+/g, '')}">${trimmed}</a>`;
                    }).join(' - ');
                }
            } else if (key === 'email' && config.store_email) {
                el.textContent = config.store_email;
                el.href = 'mailto:' + config.store_email;
            } else if (key === 'hotline') {
                const hotlineVal = config.store_hotline || config.hotline;
                if (hotlineVal) {
                    el.textContent = hotlineVal;
                    if (el.tagName === 'A') {
                        el.href = 'tel:' + String(hotlineVal).replace(/\s+/g, '');
                    }
                }
            } else if (key === 'social_facebook' && config.store_social_facebook) {
                el.href = config.store_social_facebook;
            } else if (key === 'social_zalo' && config.store_social_zalo) {
                el.href = config.store_social_zalo;
            } else if (key === 'social_tiktok' && config.store_social_tiktok) {
                el.href = config.store_social_tiktok;
            } else if (key === 'social_youtube' && config.store_social_youtube) {
                el.href = config.store_social_youtube;
            } else if (key === 'top_banner_img' && config.layout_home_top_banner_img) {
                el.src = _resolveImageUrl(config.layout_home_top_banner_img, gateway);
            } else if (key === 'top_banner_link' && config.layout_home_top_banner_link) {
                el.href = config.layout_home_top_banner_link;
            }
        });

        // Hide payment logos if not in active payment_methods list
        document.querySelectorAll('[data-payment-method]').forEach(img => {
            const method = img.getAttribute('data-payment-method');
            const configKey = 'settings_payment_' + method;
            if (config[configKey] === false || config[configKey] === 'false') {
                img.style.display = 'none';
            } else {
                img.style.display = '';
            }
        });

        // Homepage Section Visibility Hiding
        const homeToggles = [
            { key: 'layout_home_show_flash_sale', selector: '[data-home-section="flash-sale"]' },
            { key: 'layout_home_show_deal', selector: '[data-home-section="deal"]' },
            { key: 'layout_home_show_best_seller', selector: '[data-home-section="best-seller"]' },
            { key: 'layout_home_show_discount', selector: '[data-home-section="discount"]' },
            { key: 'layout_home_show_exclusive', selector: '[data-home-section="exclusive"]' },
            { key: 'layout_home_show_imported', selector: '[data-home-section="imported"]' },
            { key: 'layout_home_show_brands', selector: '[data-home-section="brands"]' },
            { key: 'layout_home_show_categories', selector: '[data-home-section="categories"]' },
            { key: 'layout_home_show_top_searches', selector: '[data-home-section="top-searches"]' },
            { key: 'layout_home_show_trending', selector: '[data-home-section="trending"]' }
        ];
        homeToggles.forEach(toggle => {
            const sectionEl = document.querySelector(toggle.selector);
            if (sectionEl) {
                const val = config[toggle.key];
                if (val === false || val === 'false') {
                    sectionEl.style.display = 'none';
                } else {
                    sectionEl.style.display = '';
                }
            }
        });

        // Homepage Section Title Banner Image Updates
        document.querySelectorAll('[data-layout-img]').forEach(el => {
            let attrVal = el.getAttribute('data-layout-img');
            if (attrVal.startsWith('header_')) {
                attrVal = attrVal.substring(7);
            }
            const imgKey = 'layout_home_header_' + attrVal;
            const val = config[imgKey];
            if (val) {
                el.src = _resolveImageUrl(val, gateway);
            }
        });

        // Homepage Brands Grid Configuration
        if (config.layout_home_brands) {
            try {
                const brands = typeof config.layout_home_brands === 'string'
                    ? JSON.parse(config.layout_home_brands)
                    : config.layout_home_brands;
                if (Array.isArray(brands)) {
                    brands.forEach(b => {
                        const imgEl = document.querySelector(`[data-brand-idx="${b.id}"]`);
                        const linkEl = document.querySelector(`[data-brand-link="${b.id}"]`);
                        if (imgEl && b.image_url) {
                            imgEl.src = _resolveImageUrl(b.image_url, gateway);
                        }
                        if (linkEl && b.link_url) {
                            linkEl.href = b.link_url;
                        }
                    });
                }
            } catch(e) {
                console.error('Error parsing layout_home_brands:', e);
            }
        }

        // Category Page Sidebar & Widget Toggles
        const catSidebar = document.querySelector('.cat-sidebar');
        if (catSidebar) {
            const showSidebar = config.layout_category_show_sidebar;
            if (showSidebar === false || showSidebar === 'false') {
                catSidebar.style.display = 'none';
                const layout = document.querySelector('.category-layout');
                if (layout) layout.style.gridTemplateColumns = '1fr';
            } else {
                catSidebar.style.display = '';
                const layout = document.querySelector('.category-layout');
                if (layout) layout.style.gridTemplateColumns = '';
            }
        }

        const catTopSearches = document.querySelector('.cat-main .top-searches, main.container > .top-searches');
        if (catTopSearches) {
            const showTop = config.layout_category_show_top_searches;
            if (showTop === false || showTop === 'false') {
                catTopSearches.style.display = 'none';
            } else {
                catTopSearches.style.display = '';
            }
        }

        // Category Warning Popup
        if (window.location.pathname.includes('category.html') && (config.layout_category_show_warning === true || config.layout_category_show_warning === 'true' || config.layout_category_show_warning === undefined)) {
            const hasConfirmed = localStorage.getItem('mg_category_warning_confirmed');
            if (!hasConfirmed) {
                const warningText = config.layout_category_warning_text || 'Sản phẩm này chỉ bán khi có chỉ định của bác sĩ, mọi thông tin trên Website, App chỉ mang tính chất tham khảo, Vui lòng xác nhận bạn là dược sĩ, bác sĩ hoặc nhân viên y tế có nhu cầu tìm hiểu về sản phẩm này.';
                
                const style = document.createElement('style');
                style.textContent = `
                    .cat-warn-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(15, 23, 42, 0.65);
                        backdrop-filter: blur(5px);
                        z-index: 200000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .cat-warn-container {
                        background: #fff;
                        border-radius: 16px;
                        width: 90%;
                        max-width: 600px;
                        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                        overflow: hidden;
                        border: 1px solid #e2e8f0;
                        font-family: inherit;
                    }
                    .cat-warn-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 16px 24px;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .cat-warn-header h3 {
                        font-size: 18px;
                        font-weight: 600;
                        color: #1e293b;
                        margin: 0;
                    }
                    .cat-warn-close {
                        background: transparent;
                        border: none;
                        color: #94a3b8;
                        font-size: 24px;
                        cursor: pointer;
                        transition: color 0.2s;
                        line-height: 1;
                    }
                    .cat-warn-close:hover {
                        color: #64748b;
                    }
                    .cat-warn-body {
                        padding: 24px;
                    }
                    .cat-warn-text {
                        font-size: 15px;
                        line-height: 1.6;
                        color: #334155;
                        margin-bottom: 20px;
                    }
                    .cat-warn-checkbox-row {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 24px;
                        cursor: pointer;
                        user-select: none;
                    }
                    .cat-warn-checkbox-row input {
                        width: 18px;
                        height: 18px;
                        accent-color: #047857;
                        cursor: pointer;
                    }
                    .cat-warn-checkbox-row span {
                        font-size: 14px;
                        color: #475569;
                        font-weight: 500;
                    }
                    .cat-warn-footer {
                        display: flex;
                        gap: 16px;
                        justify-content: flex-end;
                    }
                    .cat-warn-btn {
                        padding: 10px 24px;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        border: none;
                    }
                    .cat-warn-btn.cancel {
                        background: #cbd5e1;
                        color: #475569;
                        flex: 1;
                        text-align: center;
                    }
                    .cat-warn-btn.cancel:hover {
                        background: #94a3b8;
                        color: #1e293b;
                    }
                    .cat-warn-btn.confirm {
                        background: #047857;
                        color: #fff;
                        flex: 1;
                        text-align: center;
                    }
                    .cat-warn-btn.confirm:hover {
                        background: #065f46;
                    }
                    @media (min-width: 640px) {
                        .cat-warn-btn.cancel, .cat-warn-btn.confirm {
                            flex: none;
                            width: 150px;
                        }
                    }
                `;
                document.head.appendChild(style);

                const overlay = document.createElement('div');
                overlay.className = 'cat-warn-overlay';
                overlay.innerHTML = `
                    <div class="cat-warn-container">
                        <div class="cat-warn-header">
                            <h3>Thông báo</h3>
                            <button class="cat-warn-close" onclick="window.location.href='index.html'">&times;</button>
                        </div>
                        <div class="cat-warn-body">
                            <div class="cat-warn-text">${warningText}</div>
                            <label class="cat-warn-checkbox-row">
                                <input type="checkbox" id="cat-warn-dont-show">
                                <span>Không hiển thị nội dung thông báo này lần sau.</span>
                            </label>
                            <div class="cat-warn-footer">
                                <button class="cat-warn-btn cancel" onclick="window.location.href='index.html'">Hủy</button>
                                <button class="cat-warn-btn confirm" id="cat-warn-confirm-btn">Xác nhận</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                document.getElementById('cat-warn-confirm-btn').addEventListener('click', () => {
                    const checkbox = document.getElementById('cat-warn-dont-show');
                    if (checkbox && checkbox.checked) {
                        localStorage.setItem('mg_category_warning_confirmed', 'true');
                    }
                    overlay.remove();
                });
            }
        }

        // Product Page Widget Toggles
        const pdSimilar = document.getElementById('pdSimilarProducts') ? document.getElementById('pdSimilarProducts').closest('.pd-similar-box') : null;
        if (pdSimilar) {
            const val = config.layout_product_show_similar;
            if (val === false || val === 'false') {
                pdSimilar.style.display = 'none';
            } else {
                pdSimilar.style.display = '';
            }
        }

        const pdPopular = document.getElementById('pdPopularProducts') ? document.getElementById('pdPopularProducts').closest('.pd-similar-box') : null;
        if (pdPopular) {
            const val = config.layout_product_show_popular;
            if (val === false || val === 'false') {
                pdPopular.style.display = 'none';
            } else {
                pdPopular.style.display = '';
            }
        }

        const pdTrending = document.getElementById('pdTrendingProducts') ? document.getElementById('pdTrendingProducts').closest('.pd-bottom-section') : null;
        if (pdTrending) {
            const val = config.layout_product_show_trending;
            if (val === false || val === 'false') {
                pdTrending.style.display = 'none';
            } else {
                pdTrending.style.display = '';
            }
        }

        const pdTopSearches = document.getElementById('pdTopSearches') ? document.getElementById('pdTopSearches').closest('.pd-bottom-section') : null;
        if (pdTopSearches) {
            const val = config.layout_product_show_top_searches;
            if (val === false || val === 'false') {
                pdTopSearches.style.display = 'none';
            } else {
                pdTopSearches.style.display = '';
            }
        }

    } catch (e) {
        console.error('Error applying dynamic store config:', e);
    }
}
