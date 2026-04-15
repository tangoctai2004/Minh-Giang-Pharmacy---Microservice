/**
 * admin-components.js
 * Tiêm (inject) Sidebar và Header dùng chung cho toàn bộ Admin Portal.
 * Giúp đồng bộ UI và dễ dàng cập nhật 1 nơi cho tất cả các trang.
 */

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
            <a href="index.html" class="sidebar-link \${activePageId === 'dashboard' ? 'active' : ''}">
                <i class="fa-solid fa-chart-pie"></i> Bảng Điều Khiển
            </a>

            <div class="sidebar-section-label">Quản Lý Kho</div>
            <a href="inventory.html" class="sidebar-link \${activePageId === 'inventory' ? 'active' : ''}">
                <i class="fa-solid fa-boxes-stacked"></i> Danh Mục Thuốc (Master Data)
            </a>
            <a href="batches.html" class="sidebar-link \${activePageId === 'batches' ? 'active' : ''}">
                <i class="fa-solid fa-layer-group"></i> Nhập Kho & Lô Hàng
            </a>
            <a href="audits.html" class="sidebar-link \${activePageId === 'audits' ? 'active' : ''}">
                <i class="fa-solid fa-clipboard-check"></i> Kiểm Kê (Stocktake)
            </a>
            <a href="locations.html" class="sidebar-link \${activePageId === 'locations' ? 'active' : ''}">
                <i class="fa-solid fa-map-location-dot"></i> Vị Trí Lưu Trữ
            </a>

            <div class="sidebar-section-label">Giao Dịch</div>
            <a href="orders.html" class="sidebar-link \${activePageId === 'orders' ? 'active' : ''}">
                <i class="fa-solid fa-bag-shopping"></i> Đơn Hàng (Online/Offline)
            </a>
            <a href="order-fulfillment.html" class="sidebar-link \${activePageId === 'fulfillment' ? 'active' : ''}">
                <i class="fa-solid fa-truck-fast"></i> Xử Lý & Giao Hàng (Pick & Pack)
            </a>
            <a href="returns.html" class="sidebar-link \${activePageId === 'returns' ? 'active' : ''}">
                <i class="fa-solid fa-rotate-left"></i> Quản Lý Đổi/Trả (RMA)
            </a>
            <a href="suppliers.html" class="sidebar-link \${activePageId === 'suppliers' ? 'active' : ''}">
                <i class="fa-solid fa-handshake"></i> Nhà Cung Cấp & Công Nợ
            </a>

            <div class="sidebar-section-label">E-commerce & Marketing</div>
            <a href="promotions.html" class="sidebar-link \${activePageId === 'promotions' ? 'active' : ''}">
                <i class="fa-solid fa-tags"></i> Marketing & Khuyến Mãi
            </a>
            <a href="cms-articles.html" class="sidebar-link \${activePageId === 'cms' ? 'active' : ''}">
                <i class="fa-solid fa-newspaper"></i> Nội Dung Y Khoa (CMS)
            </a>
            <a href="storefront.html" class="sidebar-link \${activePageId === 'storefront' ? 'active' : ''}">
                <i class="fa-solid fa-store"></i> Cấu Hình Giao Diện Web
            </a>

            <div class="sidebar-section-label">Khách Hàng & Nhân Sự</div>
            <a href="crm-customers.html" class="sidebar-link \${activePageId === 'crm' ? 'active' : ''}">
                <i class="fa-solid fa-users"></i> Khách Hàng & Loyalty (CRM)
            </a>
            <a href="users-roles.html" class="sidebar-link \${activePageId === 'users-roles' ? 'active' : ''}">
                <i class="fa-solid fa-user-shield"></i> Quản Lý Nhân Sự & Quyền
            </a>
            <a href="shifts.html" class="sidebar-link \${activePageId === 'shifts' ? 'active' : ''}">
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

    // Tự động apply auth header sau khi inject HTML
    _applyAdminAuth();
}

// ─── Admin Auth (dùng chung cho toàn bộ trang admin) ─────────────────

function _applyAdminAuth() {
    // Auth guard
    const authRaw = localStorage.getItem('MG_ADMIN_AUTH');
    if (!authRaw) { window.location.href = 'login.html'; return; }

    try {
        const parsed = JSON.parse(authRaw);
        if (!parsed.accessToken) { window.location.href = 'login.html'; return; }

        if (parsed.user && parsed.user.full_name) {
            const nameEl = document.querySelector('.header-user-name');
            if (nameEl) nameEl.textContent = parsed.user.full_name;

            const roleEl = document.querySelector('.header-user-role');
            if (roleEl) roleEl.textContent = 'Quản trị viên';

            const avatarEl = document.querySelector('.header-avatar');
            if (avatarEl) {
                avatarEl.textContent = parsed.user.full_name.split(' ').pop().charAt(0).toUpperCase();
            }

            // Dropdown logout - dùng hover thay click
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

function adminLogout() {
    localStorage.removeItem('MG_ADMIN_AUTH');
    window.location.href = 'login.html';
}
