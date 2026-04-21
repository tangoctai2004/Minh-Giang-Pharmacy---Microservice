/**
 * components.js
 * Script to load reusable HTML components (Header, Footer, etc.) dynamically.
 * This allows previewing in VS Code Live Server without a backend.
 */

document.addEventListener("DOMContentLoaded", function () {
    const includes = document.querySelectorAll("[mg-include]");

    includes.forEach(async (el) => {
        const file = el.getAttribute("mg-include");
        if (file) {
            try {
                const response = await fetch(file);
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
    });

    // Sau khi tất cả component load xong, apply auth header và mega menu
    _initClientAuthHeader();
    _initMegaMenu();
    _initProductCardNavigation();
});

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
        const parsed = JSON.parse(localStorage.getItem('MG_CLIENT_AUTH') || 'null');
        if (!parsed || !parsed.accessToken) return;

        const loginBtn = document.querySelector('.login-btn');
        if (!loginBtn) return;

        // Tránh apply 2 lần
        if (loginBtn.dataset.authApplied === '1') return;
        loginBtn.dataset.authApplied = '1';

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

function clientLogout() {
    localStorage.removeItem('MG_CLIENT_AUTH');
    const loginPath = _resolveClientPath('login.html');
    window.location.href = loginPath;
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
