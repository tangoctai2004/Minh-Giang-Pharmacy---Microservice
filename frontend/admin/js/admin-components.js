/**
 * admin-components.js
 * Tiêm (inject) Sidebar và Header dùng chung cho toàn bộ Admin Portal.
 * Hỗ trợ điều hướng SPA: chỉ thay phần nội dung, sidebar/header không bị reload.
 */

// ─── Intercept global fetch: tự inject token + handle 401 ──────────────────
const originalFetch = window.fetch;
window.fetch = async function (resource, options = {}) {
    const resolvedApiBase = localStorage.getItem('MG_API_BASE') || (
        (window.location.origin.includes('localhost:5500') ||
         window.location.origin.includes('localhost:5501') ||
         window.location.origin.includes('127.0.0.1:5500') ||
         window.location.origin.includes('127.0.0.1:5501'))
        ? 'http://localhost:8000/api'
        : window.location.origin.replace(/\/+$/, '') + '/api'
    );
    const isApiRequest = typeof resource === 'string' && (resource.includes('/api/') || resource.includes(resolvedApiBase));

    if (isApiRequest) {
        options.headers = options.headers || {};
        let headers = options.headers;
        let hasAuth = false;

        if (typeof Headers !== 'undefined' && headers instanceof Headers) {
            hasAuth = headers.has('Authorization');
        } else {
            hasAuth = !!(headers['Authorization'] || headers['authorization']);
        }

        if (!hasAuth) {
            const authRaw = localStorage.getItem('MG_ADMIN_AUTH');
            if (authRaw) {
                try {
                    const parsed = JSON.parse(authRaw);
                    if (parsed.accessToken) {
                        if (typeof Headers !== 'undefined' && headers instanceof Headers) {
                            headers.set('Authorization', `Bearer ${parsed.accessToken}`);
                        } else {
                            headers['Authorization'] = `Bearer ${parsed.accessToken}`;
                        }
                    }
                } catch (e) {}
            }
        }
    }

    try {
        const response = await originalFetch(resource, options);
        if (response.status === 401 && isApiRequest) {
            console.warn('Unauthorized request detected (401), redirecting to admin login...');
            localStorage.removeItem('MG_ADMIN_AUTH');
            if (!window.location.pathname.endsWith('login.html')) {
                window.location.href = 'login.html';
            }
        }
        return response;
    } catch (error) {
        throw error;
    }
};

// ─── SPA Resources Tracking & Cleanup ────────────────────────────────────────
const _spaAttachedListeners = [];
const _spaActiveIntervals = new Set();
const _spaActiveTimeouts = new Set();

const originalSetInterval = window.setInterval;
const originalClearInterval = window.clearInterval;
window.setInterval = function (handler, timeout, ...args) {
    const id = originalSetInterval(handler, timeout, ...args);
    _spaActiveIntervals.add(id);
    return id;
};
window.clearInterval = function (id) {
    _spaActiveIntervals.delete(id);
    originalClearInterval(id);
};

const originalSetTimeout = window.setTimeout;
const originalClearTimeout = window.clearTimeout;
window.setTimeout = function (handler, timeout, ...args) {
    const id = originalSetTimeout(handler, timeout, ...args);
    _spaActiveTimeouts.add(id);
    return id;
};
window.clearTimeout = function (id) {
    _spaActiveTimeouts.delete(id);
    originalClearTimeout(id);
};

function _cleanupSpaResources() {
    // 1. Clear all intervals
    for (const id of _spaActiveIntervals) {
        originalClearInterval(id);
    }
    _spaActiveIntervals.clear();

    // 2. Clear all timeouts
    for (const id of _spaActiveTimeouts) {
        originalClearTimeout(id);
    }
    _spaActiveTimeouts.clear();

    // 3. Remove all tracked event listeners
    for (const item of _spaAttachedListeners) {
        try {
            item.target.removeEventListener(item.type, item.listener, item.options);
        } catch (e) {
            console.error('[SPA] Failed to remove event listener:', e);
        }
    }
    _spaAttachedListeners.length = 0;
}

// ─── Unified Toast Notification System ──────────────────────────────────────
function showToast(message, type = 'success') {
    let container = document.getElementById('_adminToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = '_adminToastContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 999999;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #fff;
        border-left: 4px solid #10b981;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        border-radius: 6px;
        padding: 12px 18px;
        min-width: 280px;
        max-width: 420px;
        display: flex;
        align-items: center;
        gap: 12px;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        opacity: 0;
    `;

    if (type === 'error') {
        toast.style.borderLeftColor = '#ef4444';
    } else if (type === 'warning') {
        toast.style.borderLeftColor = '#f59e0b';
    } else if (type === 'info') {
        toast.style.borderLeftColor = '#3b82f6';
    }

    const icon = document.createElement('i');
    icon.className = 'fa-solid ' + (
        type === 'error' ? 'fa-circle-xmark' :
        type === 'warning' ? 'fa-triangle-exclamation' :
        type === 'info' ? 'fa-circle-info' : 'fa-circle-check'
    );
    icon.style.fontSize = '18px';
    icon.style.color = type === 'error' ? '#ef4444' :
                      type === 'warning' ? '#f59e0b' :
                      type === 'info' ? '#3b82f6' : '#10b981';

    const text = document.createElement('div');
    text.style.cssText = 'color: #374151; font-size: 13px; font-weight: 600; line-height: 1.4;';
    text.innerHTML = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    const dismissTimer = setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);

    _spaActiveTimeouts.add(dismissTimer);
}
window.showToast = showToast;

// ─── Render Sidebar + Header (dùng chung) ──────────────────────────────────
function renderAdminLayout(activePageId) {
    const sidebarHTML = `
        <div class="sidebar-brand">
            <img src="../assets/images/logo_Minh_Giang_Pharmacy.png" alt="Logo">
            <div class="sidebar-brand-text">
                <span class="sidebar-brand-name">Minh Giang</span>
                <span class="sidebar-brand-sub">Admin Portal</span>
            </div>
        </div>

        <nav class="sidebar-nav">
            <div class="sidebar-section-label">Tổng Quan</div>
            <a href="index.html" class="sidebar-link ${activePageId === 'dashboard' ? 'active' : ''}">
                <i class="fa-solid fa-chart-pie"></i> Bảng Điều Khiển
            </a>

            <div class="sidebar-section-label">Quản Lý Kho</div>
            <a href="inventory.html" class="sidebar-link ${activePageId === 'inventory' ? 'active' : ''}">
                <i class="fa-solid fa-boxes-stacked"></i> Danh Mục Thuốc (Master Data)
            </a>
            <a href="batches.html" class="sidebar-link ${activePageId === 'batches' ? 'active' : ''}">
                <i class="fa-solid fa-layer-group"></i> Nhập Kho & Lô Hàng
            </a>
            <a href="audits.html" class="sidebar-link ${activePageId === 'audits' ? 'active' : ''}">
                <i class="fa-solid fa-clipboard-check"></i> Kiểm Kê (Stocktake)
            </a>
            <a href="locations.html" class="sidebar-link ${activePageId === 'locations' ? 'active' : ''}">
                <i class="fa-solid fa-map-location-dot"></i> Vị Trí Lưu Trữ
            </a>

            <div class="sidebar-section-label">Giao Dịch</div>
            <a href="orders.html" class="sidebar-link ${activePageId === 'orders' ? 'active' : ''}">
                <i class="fa-solid fa-bag-shopping"></i> Đơn Hàng (Online/Offline)
            </a>
            <a href="order-fulfillment.html" class="sidebar-link ${activePageId === 'fulfillment' ? 'active' : ''}">
                <i class="fa-solid fa-truck-fast"></i> Xử Lý & Giao Hàng (Pick & Pack)
            </a>
            <a href="returns.html" class="sidebar-link ${activePageId === 'returns' ? 'active' : ''}">
                <i class="fa-solid fa-rotate-left"></i> Quản Lý Đổi/Trả (RMA)
            </a>
            <a href="suppliers.html" class="sidebar-link ${activePageId === 'suppliers' ? 'active' : ''}">
                <i class="fa-solid fa-handshake"></i> Nhà Cung Cấp & Công Nợ
            </a>

            <div class="sidebar-section-label">E-commerce & Marketing</div>
            <a href="promotions.html" class="sidebar-link ${activePageId === 'promotions' ? 'active' : ''}">
                <i class="fa-solid fa-tags"></i> Marketing & Khuyến Mãi
            </a>
            <a href="product-reviews.html" class="sidebar-link ${activePageId === 'product-reviews' ? 'active' : ''}">
                <i class="fa-solid fa-star-half-stroke"></i> Đánh Giá Sản Phẩm
            </a>
            <a href="cms-articles.html" class="sidebar-link ${activePageId === 'cms' ? 'active' : ''}">
                <i class="fa-solid fa-newspaper"></i> Nội Dung Y Khoa (CMS)
            </a>
            <a href="storefront.html" class="sidebar-link ${activePageId === 'storefront' ? 'active' : ''}">
                <i class="fa-solid fa-store"></i> Cấu Hình Giao Diện Web
            </a>

            <div class="sidebar-section-label">Khách Hàng & Nhân Sự</div>
            <a href="crm-customers.html" class="sidebar-link ${activePageId === 'crm' ? 'active' : ''}">
                <i class="fa-solid fa-users"></i> Khách Hàng & Loyalty (CRM)
            </a>
            <a href="users-roles.html" class="sidebar-link ${activePageId === 'users-roles' ? 'active' : ''}">
                <i class="fa-solid fa-user-shield"></i> Quản Lý Nhân Sự & Quyền
            </a>
            <a href="shifts.html" class="sidebar-link ${activePageId === 'shifts' ? 'active' : ''}">
                <i class="fa-solid fa-user-clock"></i> Ca Làm Việc & Thu Ngân
            </a>
        </nav>

        <div class="sidebar-footer">
            <a href="../POS/index.html" class="sidebar-kiosk-link">
                <i class="fa-solid fa-cash-register"></i> Mở POS Kiosk
            </a>
        </div>
    `;

    const headerHTML = `
        <div class="header-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" placeholder="Tìm kiếm thuốc, đơn hàng, khách hàng...">
        </div>
        <div class="header-spacer"></div>
        <div class="header-actions">
            <button class="header-icon-btn" title="Thông báo">
                <i class="fa-regular fa-bell"></i>
                <span class="header-notif-dot"></span>
            </button>
            <button class="header-icon-btn" title="Cài đặt">
                <i class="fa-solid fa-gear"></i>
            </button>
            <div class="header-divider"></div>
            <div class="header-user">
                <div class="header-avatar">MG</div>
                <div class="header-user-info">
                    <span class="header-user-name">Trần Minh Giang</span>
                    <span class="header-user-role">Quản lý</span>
                </div>
                <i class="fa-solid fa-chevron-down" style="font-size:11px;color:#9ca3af;margin-left:4px;"></i>
            </div>
        </div>
    `;

    // Inject Sidebar
    const sidebar = document.querySelector('aside.admin-sidebar');
    if (sidebar) sidebar.innerHTML = sidebarHTML;

    // Inject Header
    const header = document.querySelector('header.admin-header');
    if (header) header.innerHTML = headerHTML;

    // Apply auth info after injecting HTML
    _applyAdminAuth();

    // Bind SPA navigation after sidebar is rendered
    _bindSpaNavigation();
}

function _adminApiBase() {
    return localStorage.getItem('MG_API_BASE') || (
        (window.location.origin.includes('localhost:5500') ||
         window.location.origin.includes('localhost:5501') ||
         window.location.origin.includes('127.0.0.1:5500') ||
         window.location.origin.includes('127.0.0.1:5501'))
        ? 'http://localhost:8000/api'
        : window.location.origin.replace(/\/+$/, '') + '/api'
    );
}

function _decodeAdminJwtPayload(token) {
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

function _isAdminJwtExpired(token, skewSeconds = 30) {
    const payload = _decodeAdminJwtPayload(token);
    return !payload || !payload.exp || payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

function getValidAdminAuth() {
    try {
        const parsed = JSON.parse(localStorage.getItem('MG_ADMIN_AUTH') || 'null');
        if (!parsed || !parsed.accessToken) return null;
        if (_isAdminJwtExpired(parsed.accessToken)) {
            localStorage.removeItem('MG_ADMIN_AUTH');
            return null;
        }
        return parsed;
    } catch (e) {
        localStorage.removeItem('MG_ADMIN_AUTH');
        return null;
    }
}

async function _revokeAdminRefreshToken(auth) {
    if (!auth || !auth.refreshToken) return;
    try {
        await fetch(_adminApiBase() + '/identity/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
    } catch (e) {}
}

// ─── Admin Auth ─────────────────────────────────────────────────────────────
function _applyAdminAuth() {
    const parsed = getValidAdminAuth();
    if (!parsed) { window.location.href = 'login.html'; return; }

    try {
        if (parsed.user && parsed.user.full_name) {
            const nameEl = document.querySelector('.header-user-name');
            if (nameEl) nameEl.textContent = parsed.user.full_name;

            const roleEl = document.querySelector('.header-user-role');
            if (roleEl) roleEl.textContent = 'Quản trị viên';

            const avatarEl = document.querySelector('.header-avatar');
            if (avatarEl) {
                avatarEl.textContent = parsed.user.full_name.split(' ').pop().charAt(0).toUpperCase();
            }

            // Dropdown logout
            const headerUser = document.querySelector('.header-user');
            if (headerUser) {
                headerUser.style.cursor = 'pointer';
                headerUser.style.position = 'relative';

                const oldDropdown = document.getElementById('_adminUserDropdown');
                if (oldDropdown) oldDropdown.remove();

                const dropdown = document.createElement('div');
                dropdown.id = '_adminUserDropdown';
                dropdown.style.cssText = 'position:absolute;top:calc(100% + 10px);right:0;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;z-index:9999;overflow:hidden;opacity:0;visibility:hidden;transform:translateY(-8px);transition:opacity 0.2s ease,transform 0.2s ease,visibility 0.2s;';
                dropdown.innerHTML = `
                    <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
                        <div style="font-size:13px;font-weight:700;color:#0f172a;">${parsed.user.full_name}</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Quản trị viên</div>
                    </div>
                    <a href="javascript:void(0)" onclick="adminLogout()" style="display:flex;align-items:center;gap:10px;padding:11px 16px;color:#ef4444;text-decoration:none;font-size:13px;font-weight:500;">
                        <i class="fa-solid fa-sign-out-alt" style="width:14px;"></i> Đăng xuất
                    </a>
                `;
                headerUser.appendChild(dropdown);

                headerUser.addEventListener('mouseenter', () => {
                    dropdown.style.opacity = '1';
                    dropdown.style.visibility = 'visible';
                    dropdown.style.transform = 'translateY(0)';
                });
                headerUser.addEventListener('mouseleave', () => {
                    dropdown.style.opacity = '0';
                    dropdown.style.visibility = 'hidden';
                    dropdown.style.transform = 'translateY(-8px)';
                });
            }
        }
    } catch (e) { /* ignore */ }
}

async function adminLogout() {
    const auth = JSON.parse(localStorage.getItem('MG_ADMIN_AUTH') || 'null');
    await _revokeAdminRefreshToken(auth);
    localStorage.removeItem('MG_ADMIN_AUTH');
    window.location.href = 'login.html';
}

// ─── SPA Navigation ──────────────────────────────────────────────────────────

// Danh sách stylesheet dùng chung - không inject lại khi chuyển trang
const _SHARED_STYLESHEETS = [
    'admin-style.css',
    'font-awesome',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

// Theo dõi navigation đang diễn ra (tránh race condition)
let _spaNavigating = false;

function _isSpaLink(href) {
    if (!href) return false;
    // Chỉ xử lý các link .html trong cùng thư mục admin (không phải login, POS, external)
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.endsWith('.html')) return false;
    if (url.pathname.includes('login.html')) return false;
    if (url.pathname.includes('/POS/')) return false;
    // Phải cùng thư mục admin
    const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const targetDir = url.pathname.substring(0, url.pathname.lastIndexOf('/'));
    if (currentDir !== targetDir) return false;
    return true;
}

// Chỉ bind một lần duy nhất khi file load - dùng event delegation trên document
let _spaNavBound = false;
function _bindSpaNavigation() {
    if (_spaNavBound) return;
    _spaNavBound = true;

    // Delegation ở document level: hoạt động dù sidebar được re-render
    document.addEventListener('click', (e) => {
        const link = e.target.closest('aside.admin-sidebar a.sidebar-link');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!_isSpaLink(href)) return;

        // Nếu đang ở trang đó rồi thì không làm gì
        const targetUrl = new URL(href, window.location.href);
        if (targetUrl.pathname === window.location.pathname) {
            e.preventDefault();
            return;
        }

        e.preventDefault();
        _navigateToPage(href);
    });
}

async function _navigateToPage(href) {
    if (_spaNavigating) return;
    _spaNavigating = true;

    const targetUrl = new URL(href, window.location.href);
    const targetFile = targetUrl.pathname.split('/').pop(); // e.g. "audits.html"

    try {
        // ── Dọn dẹp tài nguyên trang cũ (Intervals, Timeouts, Event Listeners) ──
        _cleanupSpaResources();

        // ── Hiển thị loading overlay ───────────────────────────────────────
        _showPageLoader();

        // ── Fetch HTML trang đích ──────────────────────────────────────────
        const response = await originalFetch(targetUrl.href);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // ── Cập nhật title ─────────────────────────────────────────────────
        document.title = doc.title || document.title;

        // ── Xóa style cũ của trang trước (dynamic-page-style) ─────────────
        document.querySelectorAll('style[data-spa-page], link[data-spa-page]').forEach(el => el.remove());

        // ── Xóa script cũ của trang trước ────────────────────────────────
        document.querySelectorAll('script[data-spa-page]').forEach(el => el.remove());

        // ── Inject style mới từ trang đích ────────────────────────────────
        const newStyles = doc.querySelectorAll('head style, head link[rel="stylesheet"]');
        newStyles.forEach(styleEl => {
            const isShared = _SHARED_STYLESHEETS.some(shared => {
                if (styleEl.tagName === 'LINK') {
                    return (styleEl.getAttribute('href') || '').includes(shared);
                }
                return false;
            });
            if (isShared) return;

            const clone = styleEl.cloneNode(true);
            clone.setAttribute('data-spa-page', targetFile);
            document.head.appendChild(clone);
        });

        // ── Lưu sidebar và header trước khi xóa body content ─────────────
        const sidebar = document.querySelector('aside.admin-sidebar');
        const header = document.querySelector('header.admin-header');

        // ── Xóa tất cả phần tử trong body trừ sidebar, header ─────────────
        Array.from(document.body.children).forEach(child => {
            if (child === sidebar || child === header) return;
            child.remove();
        });

        // ── Append nội dung body từ trang mới (trừ sidebar, header, script) ─
        const newBodyNodes = Array.from(doc.body.childNodes);
        const fragment = document.createDocumentFragment();

        newBodyNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (tag === 'aside' && node.classList.contains('admin-sidebar')) return;
                if (tag === 'header' && node.classList.contains('admin-header')) return;
                if (tag === 'script') return; // scripts xử lý riêng sau
            }
            fragment.appendChild(node.cloneNode(true));
        });
        document.body.appendChild(fragment);

        // ── Cập nhật History API ───────────────────────────────────────────
        history.pushState({ page: targetFile }, document.title, targetUrl.href);

        // ── Re-render sidebar với active state mới ─────────────────────────
        const pageId = _getPageIdFromFile(targetFile);
        renderAdminLayout(pageId);

        // ── Execute scripts từ trang mới ──────────────────────────────────
        await _executePageScripts(doc, targetFile);

        // ── Ẩn loader ─────────────────────────────────────────────────────
        _hidePageLoader();

        // Scroll lên đầu trang
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.error('[SPA] Navigation failed:', err);
        _hidePageLoader();
        // Fallback: load trang bình thường
        window.location.href = href;
    } finally {
        _spaNavigating = false;
    }
}

function _transpileConstLetToVar(code) {
    return code
        // Replace const/let with var for simple declarations at the start of a line
        .replace(/^(\s*)const\s+([a-zA-Z0-9_$]+)(?=\s*=|;|,|\s*$)/gm, '$1var $2')
        .replace(/^(\s*)let\s+([a-zA-Z0-9_$]+)(?=\s*=|;|,|\s*$)/gm, '$1var $2')
        // Replace const/let with var for destructuring at the start of a line
        .replace(/^(\s*)const\s+(?=[{\[])/gm, '$1var ')
        .replace(/^(\s*)let\s+(?=[{\[])/gm, '$1var ');
}

async function _executePageScripts(doc, targetFile) {
    const pendingListeners = [];

    // Intercept document.addEventListener
    const originalDocAddEventListener = document.addEventListener.bind(document);
    document.addEventListener = function (type, listener, options) {
        if (type === 'DOMContentLoaded' || type === 'load') {
            pendingListeners.push({ target: document, type, listener, options });
        } else {
            // Track for cleanup
            _spaAttachedListeners.push({ target: document, type, listener, options });
            originalDocAddEventListener(type, listener, options);
        }
    };

    // Intercept window.addEventListener
    const originalWinAddEventListener = window.addEventListener.bind(window);
    window.addEventListener = function (type, listener, options) {
        if (type === 'DOMContentLoaded' || type === 'load') {
            pendingListeners.push({ target: window, type, listener, options });
        } else {
            // Track for cleanup
            _spaAttachedListeners.push({ target: window, type, listener, options });
            originalWinAddEventListener(type, listener, options);
        }
    };

    try {
        const scripts = Array.from(doc.querySelectorAll('script'));
        
        for (const scriptEl of scripts) {
            const src = scriptEl.getAttribute('src');
            if (src && src.includes('admin-components.js')) continue;

            const newScript = document.createElement('script');
            newScript.setAttribute('data-spa-page', targetFile);

            // Copy all attributes
            for (const attr of scriptEl.attributes) {
                if (attr.name !== 'src') {
                    newScript.setAttribute(attr.name, attr.value);
                }
            }

            if (src) {
                // Remove existing script with same src to allow reloading
                const existing = document.querySelector(`script[src="${src}"]`);
                if (existing) {
                    existing.remove();
                }

                try {
                    console.log(`[SPA] Loading external script: ${src}`);
                    const response = await originalFetch(src);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    let code = await response.text();
                    
                    code = _transpileConstLetToVar(code);
                    
                    newScript.textContent = `${code}\n//# sourceURL=${src}`;
                    document.body.appendChild(newScript);
                } catch (err) {
                    console.error(`[SPA] Failed to fetch external script ${src}, falling back to native load:`, err);
                    const fallbackScript = document.createElement('script');
                    fallbackScript.setAttribute('data-spa-page', targetFile);
                    for (const attr of scriptEl.attributes) {
                        fallbackScript.setAttribute(attr.name, attr.value);
                    }
                    await new Promise((resolve) => {
                        fallbackScript.onload = () => resolve();
                        fallbackScript.onerror = () => resolve();
                        document.body.appendChild(fallbackScript);
                    });
                }
            } else {
                // Inline script
                let code = scriptEl.textContent;
                code = _transpileConstLetToVar(code);
                newScript.textContent = code;
                document.body.appendChild(newScript);
            }
        }
    } catch (err) {
        console.error('[SPA] Script execution failed:', err);
    } finally {
        // Restore original listeners
        document.addEventListener = originalDocAddEventListener;
        window.addEventListener = originalWinAddEventListener;
    }

    // Trigger queued DOMContentLoaded and load events
    console.log(`[SPA] Triggering ${pendingListeners.length} queued listeners`);
    for (const item of pendingListeners) {
        try {
            const event = new Event(item.type);
            item.listener.call(item.target, event);
        } catch (e) {
            console.error(`[SPA] Error executing queued ${item.type} listener:`, e);
        }
    }
}

function _getPageIdFromFile(filename) {
    const map = {
        'index.html': 'dashboard',
        'inventory.html': 'inventory',
        'batches.html': 'batches',
        'audits.html': 'audits',
        'locations.html': 'locations',
        'orders.html': 'orders',
        'order-fulfillment.html': 'fulfillment',
        'returns.html': 'returns',
        'suppliers.html': 'suppliers',
        'promotions.html': 'promotions',
        'product-reviews.html': 'product-reviews',
        'cms-articles.html': 'cms',
        'storefront.html': 'storefront',
        'crm-customers.html': 'crm',
        'users-roles.html': 'users-roles',
        'shifts.html': 'shifts',
    };
    return map[filename] || 'dashboard';
}

// ─── Page Loader Overlay ─────────────────────────────────────────────────────
function _showPageLoader() {
    let loader = document.getElementById('_spaPageLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = '_spaPageLoader';
        loader.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, #10b981, #34d399, #10b981);
            background-size: 200% 100%;
            animation: _spaLoaderAnim 1.2s ease infinite;
            z-index: 99999;
            transition: opacity 0.3s ease;
        `;
        document.head.insertAdjacentHTML('beforeend', `
            <style id="_spaLoaderStyle">
                @keyframes _spaLoaderAnim {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            </style>
        `);
        document.body.appendChild(loader);
    }
    loader.style.opacity = '1';
    loader.style.display = 'block';
}

function _hidePageLoader() {
    const loader = document.getElementById('_spaPageLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 300);
    }
}

// ─── Handle browser back/forward buttons ────────────────────────────────────
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page) {
        _navigateToPage(window.location.href);
    }
});

// ─── Init: set initial history state ────────────────────────────────────────
(function () {
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    if (!history.state || !history.state.page) {
        history.replaceState({ page: currentFile }, document.title, window.location.href);
    }
})();
