/**
 * promotions-api.js
 * Frontend controller for Marketing & Promotions Page.
 * Handles fetching, filtering, CRUD operations for vouchers, gift campaigns, and loyalty tiers.
 */

var API_BASE = localStorage.getItem('MG_API_BASE') || (
    (window.location.origin.includes('localhost:5500') ||
     window.location.origin.includes('localhost:5501') ||
     window.location.origin.includes('127.0.0.1:5500') ||
     window.location.origin.includes('127.0.0.1:5501'))
    ? 'http://localhost:8000/api'
    : window.location.origin.replace(/\/+$/, '') + '/api'
);

// State Management
var currentVouchersPage = 1;
var currentVouchersLimit = 10;
var activeVoucherId = null; // null for 'new'
var activeGiftId = null;

// On DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initial Loads
    initPromotionsPage();
    initGiftProductAutocomplete();

    // Event listeners for Voucher Filters
    document.getElementById('voucher-search')?.addEventListener('input', debounce(() => {
        currentVouchersPage = 1;
        loadVouchers();
    }, 300));
    document.getElementById('voucher-filter-type')?.addEventListener('change', () => {
        currentVouchersPage = 1;
        loadVouchers();
    });
    document.getElementById('voucher-filter-status')?.addEventListener('change', () => {
        currentVouchersPage = 1;
        loadVouchers();
    });

    // Form Submissions
    document.getElementById('voucher-form')?.addEventListener('submit', handleVoucherSubmit);
    document.getElementById('gift-form')?.addEventListener('submit', handleGiftSubmit);
    
    // Loyalty Configurations
    document.getElementById('save-loyalty-tiers-btn')?.addEventListener('click', saveLoyaltyTiers);
    document.getElementById('save-loyalty-config-btn')?.addEventListener('click', saveLoyaltyConfig);

    // Export button
    document.getElementById('export-report-btn')?.addEventListener('click', exportPromotionsReport);
});

async function initPromotionsPage() {
    loadStats();
    loadVouchers();
    loadGiftCampaigns();
    loadLoyaltyConfig();
    loadLoyaltyTiers();
    loadLoyaltyStats();
}

// Helper: Get Request Headers
function getHeaders() {
    var authRaw = localStorage.getItem('MG_ADMIN_AUTH');
    var token = '';
    if (authRaw) {
        try {
            token = JSON.parse(authRaw).accessToken || '';
        } catch (e) {}
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}



// Helper: Debounce
function debounce(func, wait) {
    var timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ─── SECTION 1: STATS & DASHBOARD ─────────────────────────────────────────────
async function loadStats() {
    try {
        var res = await fetch(`${API_BASE}/cms/promotions/stats`, { headers: getHeaders() });
        var result = await res.json();
        
        if (result.success && result.data) {
            var stats = result.data;
            document.getElementById('stat-active-vouchers').textContent = stats.active_vouchers || 0;
            document.getElementById('stat-active-vouchers-sub').textContent = `Tổng: ${stats.total_promotions || 0} chương trình`;

            document.getElementById('stat-total-usage').textContent = stats.monthly_usages || 0;
            document.getElementById('stat-total-usage-sub').textContent = stats.monthly_growth_pct !== null ? `↑ ${stats.monthly_growth_pct}% so tháng trước` : `Hệ thống live update`;

            document.getElementById('stat-active-gifts').textContent = stats.active_gift_campaigns || 0;
            document.getElementById('stat-active-gifts-sub').textContent = `Tổng quà: ${stats.gift_given_total || 0} lượt tặng`;

            document.getElementById('stat-expiring-vouchers').textContent = stats.expiring_soon || 0;
            document.getElementById('stat-expiring-vouchers-sub').textContent = `Trong 7 ngày tới`;
        }
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

// ─── SECTION 2: VOUCHERS (TAB 1) ─────────────────────────────────────────────
async function loadVouchers(page = 1) {
    currentVouchersPage = page;
    var tbody = document.getElementById('vouchers-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>`;

    try {
        var search = document.getElementById('voucher-search')?.value || '';
        var type = document.getElementById('voucher-filter-type')?.value || '';
        var status = document.getElementById('voucher-filter-status')?.value || '';

        // API supports type filter and search keyword
        var url = `${API_BASE}/cms/promotions?page=${currentVouchersPage}&limit=${currentVouchersLimit}&search=${encodeURIComponent(search)}`;
        
        if (type) {
            url += `&type=${type}`;
        } else {
            // Exclude buy_x_get_y from Tab 1 Vouchers
            url += `&exclude_type=buy_x_get_y`;
        }

        if (status) {
            url += `&status=${status}`;
        }

        var res = await fetch(url, { headers: getHeaders() });
        var result = await res.json();

        if (result.success && result.data) {
            var list = result.data;
            var pagination = result.pagination || result.meta || {};

            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#6b7280;">Không tìm thấy voucher nào.</td></tr>`;
                renderVouchersPagination(0, 1);
                return;
            }

            tbody.innerHTML = list.map(item => {
                var typeBadge = '';
                if (item.type === 'percent_discount') {
                    typeBadge = `<span class="discount-type percent"><i class="fa-solid fa-percent fa-xs"></i> Giảm ${item.discount_value}%${item.max_discount_amount ? ` (tối đa ${formatVND(item.max_discount_amount)})` : ''}</span>`;
                } else if (item.type === 'fixed_discount') {
                    typeBadge = `<span class="discount-type fixed"><i class="fa-solid fa-money-bill fa-xs"></i> Giảm ${formatVND(item.discount_value)}</span>`;
                } else if (item.type === 'free_shipping') {
                    typeBadge = `<span class="discount-type fixed" style="background:#f0fdf4;color:#16a34a;"><i class="fa-solid fa-truck fa-xs"></i> Freeship ${formatVND(item.discount_value)}</span>`;
                }

                // Progress usage
                var limit = item.usage_limit;
                var count = item.usage_count || 0;
                var usageProgress = 0;
                var usageText = `${count}`;
                var progressColor = '#10b981';

                if (limit) {
                    usageProgress = Math.min(100, (count / limit) * 100);
                    usageText = `${count}/${limit}`;
                    if (usageProgress >= 100) progressColor = '#ef4444';
                    else if (usageProgress >= 80) progressColor = '#f59e0b';
                } else {
                    usageProgress = 100;
                    usageText = `${count} / ∞`;
                }

                // Time remaining
                var now = new Date();
                var end = new Date(item.end_date);
                var start = new Date(item.start_date);
                var dateBadge = '';
                
                if (end < now) {
                    dateBadge = `<div style="font-size:13px;font-weight:600;color:#9ca3af;">${formatDate(end)}</div><div style="font-size:11px;color:#ef4444;">Đã hết hạn</div>`;
                } else if (start > now) {
                    dateBadge = `<div style="font-size:13px;font-weight:600;color:#1d4ed8;">${formatDate(start)}</div><div style="font-size:11px;color:#1d4ed8;">Chưa bắt đầu</div>`;
                } else {
                    var diffDays = Math.ceil((end - now) / 86400000);
                    dateBadge = `<div style="font-size:13px;font-weight:600;color:#1e293b;">${formatDate(end)}</div>
                                 <div style="font-size:11px;color:${diffDays <= 7 ? '#ef4444' : '#6b7280'};font-weight:${diffDays <= 7 ? '600' : '400'};">
                                    Còn ${diffDays} ngày
                                 </div>`;
                }

                // Status Badge
                var statusBadge = '';
                if (!item.is_active) {
                    statusBadge = `<span class="status-badge" style="background:#f1f5f9;color:#94a3b8;">Dừng</span>`;
                } else if (end < now) {
                    statusBadge = `<span class="status-badge" style="background:#fee2e2;color:#ef4444;">Hết hạn</span>`;
                } else if (limit && count >= limit) {
                    statusBadge = `<span class="status-badge" style="background:#fee2e2;color:#ef4444;">Hết lượt</span>`;
                } else {
                    statusBadge = `<span class="status-badge active">Đang chạy</span>`;
                }

                return `
                    <tr style="cursor:pointer;" onclick="openVoucherEditModal(${item.id})">
                        <td>
                            <span class="voucher-code-badge"><i class="fa-solid fa-scissors fa-xs"></i> ${item.code}</span>
                            <div style="font-size:11px;color:#6b7280;margin-top:5px;">${item.campaign_name || item.name}</div>
                        </td>
                        <td>${typeBadge}</td>
                        <td>
                            <div style="font-size:12px;color:#374151;">Đơn từ <strong>${formatVND(item.min_order_value)}</strong></div>
                            <div style="font-size:11px;color:#9ca3af;">Kênh: ${item.applicable_channel === 'all' ? 'Web & POS' : item.applicable_channel.toUpperCase()}</div>
                        </td>
                        <td>
                            <div class="usage-bar-wrap">
                                <div class="usage-bar-track">
                                    <div class="usage-bar-fill" style="width:${usageProgress}%; background: ${progressColor};"></div>
                                </div>
                                <span class="usage-bar-text" style="${usageProgress >= 100 && limit ? 'color:#ef4444;font-weight:600;' : ''}">${usageText}</span>
                            </div>
                        </td>
                        <td>${dateBadge}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <div class="action-btns" style="justify-content:flex-end;">
                                <button class="btn-icon" title="Chỉnh sửa" onclick="event.stopPropagation(); openVoucherEditModal(${item.id})">
                                    <i class="fa-solid fa-pencil"></i>
                                </button>
                                <button class="btn-icon" title="${item.is_active ? 'Tạm dừng' : 'Kích hoạt'}" onclick="event.stopPropagation(); toggleVoucherStatus(${item.id}, ${item.is_active})">
                                    <i class="fa-solid ${item.is_active ? 'fa-pause' : 'fa-play'}"></i>
                                </button>
                                <button class="btn-icon" title="Nhân bản" onclick="event.stopPropagation(); cloneVoucher(${item.id})">
                                    <i class="fa-solid fa-clone"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            renderVouchersPagination(pagination.total || 0, pagination.totalPages || pagination.total_pages || 1);
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Không thể tải danh sách voucher.</td></tr>`;
    }
}

function renderVouchersPagination(total, totalPages) {
    var pageInfo = document.querySelector('.pagination .page-info');
    var controls = document.querySelector('.pagination .page-controls');
    if (!controls) return;

    var startIdx = (currentVouchersPage - 1) * currentVouchersLimit + 1;
    var endIdx = Math.min(currentVouchersPage * currentVouchersLimit, total);
    
    if (pageInfo) {
        pageInfo.textContent = total > 0 ? `Hiển thị ${startIdx} – ${endIdx} trên ${total} voucher` : 'Hiển thị 0 trên 0 voucher';
    }

    var buttonsHTML = '';
    // Previous button
    buttonsHTML += `<button class="btn-page" ${currentVouchersPage === 1 ? 'disabled' : ''} onclick="loadVouchers(${currentVouchersPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        buttonsHTML += `<button class="btn-page ${currentVouchersPage === i ? 'active' : ''}" onclick="loadVouchers(${i})">${i}</button>`;
    }

    // Next button
    buttonsHTML += `<button class="btn-page" ${currentVouchersPage === totalPages || totalPages === 0 ? 'disabled' : ''} onclick="loadVouchers(${currentVouchersPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;

    controls.innerHTML = buttonsHTML;
}

// ─── CRUD Vouchers ───────────────────────────────────────────────────────────
function openVoucherNewModal() {
    activeVoucherId = null;
    document.getElementById('voucherModalTitle').innerText = 'Tạo Voucher Mới';
    document.getElementById('voucher-form').reset();
    
    // Defaults
    document.getElementById('voucher-code-input').disabled = false;
    document.getElementById('voucher-start-input').value = new Date().toISOString().slice(0, 10);
    var in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    document.getElementById('voucher-end-input').value = in30Days.toISOString().slice(0, 10);
    
    // Toggle active switch
    var toggle = document.getElementById('voucher-active-toggle');
    if (toggle) {
        toggle.classList.add('on');
        toggle.dataset.active = "true";
    }

    document.getElementById('voucherModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

async function openVoucherEditModal(id) {
    activeVoucherId = id;
    document.getElementById('voucherModalTitle').innerText = 'Chỉnh sửa Voucher';
    
    try {
        var res = await fetch(`${API_BASE}/cms/promotions/${id}`, { headers: getHeaders() });
        var result = await res.json();
        
        if (result.success && result.data) {
            var item = result.data;
            document.getElementById('voucher-code-input').value = item.code || '';
            document.getElementById('voucher-code-input').disabled = true; // Code can't be changed after creation
            document.getElementById('voucher-name-input').value = item.name || '';
            document.getElementById('voucher-campaign-input').value = item.campaign_name || '';
            document.getElementById('voucher-type-input').value = item.type === 'percent_discount' ? 'percent' : (item.type === 'fixed_discount' ? 'fixed' : 'freeship');
            document.getElementById('voucher-value-input').value = item.discount_value || 0;
            document.getElementById('voucher-max-discount-input').value = item.max_discount_amount || '';
            document.getElementById('voucher-min-order-input').value = item.min_order_value || 0;
            document.getElementById('voucher-limit-input').value = item.usage_limit || '';
            
            if (item.start_date) {
                document.getElementById('voucher-start-input').value = new Date(item.start_date).toISOString().slice(0, 10);
            }
            if (item.end_date) {
                document.getElementById('voucher-end-input').value = new Date(item.end_date).toISOString().slice(0, 10);
            }
            
            // Channels
            var isWeb = item.applicable_channel === 'all' || item.applicable_channel === 'web';
            var isPos = item.applicable_channel === 'all' || item.applicable_channel === 'pos';
            document.getElementById('voucher-channel-web').checked = isWeb;
            document.getElementById('voucher-channel-pos').checked = isPos;

            // Active toggle
            var toggle = document.getElementById('voucher-active-toggle');
            if (toggle) {
                if (item.is_active) {
                    toggle.classList.add('on');
                    toggle.dataset.active = "true";
                } else {
                    toggle.classList.remove('on');
                    toggle.dataset.active = "false";
                }
            }

            toggleDiscountFields(document.getElementById('voucher-type-input').value);

            document.getElementById('voucherModal').classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    } catch (e) {
        showToast('Không thể tải chi tiết voucher', 'error');
    }
}

function closeVoucherModal() {
    document.getElementById('voucherModal').classList.remove('open');
    document.body.style.overflow = '';
}

async function handleVoucherSubmit(e) {
    e.preventDefault();

    var code = document.getElementById('voucher-code-input').value.trim();
    var name = document.getElementById('voucher-name-input').value.trim();
    var campaign_name = document.getElementById('voucher-campaign-input').value.trim() || null;
    var rawType = document.getElementById('voucher-type-input').value;
    var discount_value = Number(document.getElementById('voucher-value-input').value) || 0;
    var max_discount_amount = document.getElementById('voucher-max-discount-input').value ? Number(document.getElementById('voucher-max-discount-input').value) : null;
    var min_order_value = Number(document.getElementById('voucher-min-order-input').value) || 0;
    var usage_limit = document.getElementById('voucher-limit-input').value ? Number(document.getElementById('voucher-limit-input').value) : null;
    var start_date = document.getElementById('voucher-start-input').value;
    var end_date = document.getElementById('voucher-end-input').value;

    var isWeb = document.getElementById('voucher-channel-web').checked;
    var isPos = document.getElementById('voucher-channel-pos').checked;
    var applicable_channel = 'all';
    if (isWeb && !isPos) applicable_channel = 'web';
    if (!isWeb && isPos) applicable_channel = 'pos';
    if (!isWeb && !isPos) {
        showToast('Vui lòng chọn ít nhất một kênh áp dụng', 'error');
        return;
    }

    // Map UI types to Backend enum
    var type = 'percent_discount';
    if (rawType === 'fixed') type = 'fixed_discount';
    if (rawType === 'freeship') type = 'free_shipping';

    var is_active = document.getElementById('voucher-active-toggle').dataset.active === "true" ? 1 : 0;

    var payload = {
        name,
        campaign_name,
        code,
        type,
        discount_value,
        min_order_value,
        max_discount_amount,
        applicable_to: 'all',
        applicable_channel,
        usage_limit,
        start_date,
        end_date,
        is_active
    };

    try {
        var res;
        if (activeVoucherId) {
            // Update
            res = await fetch(`${API_BASE}/cms/promotions/${activeVoucherId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            // Create
            res = await fetch(`${API_BASE}/cms/promotions`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        }

        var result = await res.json();
        if (result.success) {
            showToast(result.message || 'Lưu voucher thành công');
            closeVoucherModal();
            loadVouchers();
            loadStats();
        } else {
            showToast(result.message || 'Lỗi xảy ra', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối server', 'error');
    }
}

async function toggleVoucherStatus(id, currentStatus) {
    try {
        var res = await fetch(`${API_BASE}/cms/promotions/${id}/toggle`, {
            method: 'PUT',
            headers: getHeaders()
        });
        var result = await res.json();
        if (result.success) {
            showToast(result.message || 'Đổi trạng thái thành công');
            loadVouchers(currentVouchersPage);
            loadStats();
        } else {
            showToast(result.message || 'Không thể đổi trạng thái', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối server', 'error');
    }
}

async function cloneVoucher(id) {
    if (!confirm('Bạn có muốn nhân bản voucher này không?')) return;
    try {
        var res = await fetch(`${API_BASE}/cms/promotions/${id}/clone`, {
            method: 'POST',
            headers: getHeaders()
        });
        var result = await res.json();
        if (result.success) {
            showToast(result.message || 'Nhân bản thành công');
            loadVouchers();
            loadStats();
        } else {
            showToast(result.message || 'Không thể nhân bản', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối server', 'error');
    }
}

async function exportPromotionsReport() {
    try {
        var res = await fetch(`${API_BASE}/cms/promotions/export`, { headers: getHeaders() });
        if (!res.ok) {
            throw new Error('Không thể xuất file báo cáo');
        }
        var blob = await res.blob();
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Promotions_Report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Đã xuất báo cáo CSV thành công');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ─── SECTION 3: GIFT CAMPAIGNS (TAB 2) ─────────────────────────────────────────
async function loadGiftCampaigns() {
    var container = document.getElementById('gifts-list-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center;padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải chiến dịch quà tặng...</div>`;

    try {
        var res = await fetch(`${API_BASE}/cms/promotions?type=buy_x_get_y`, { headers: getHeaders() });
        var result = await res.json();

        if (result.success && result.data) {
            var list = result.data;
            if (list.length === 0) {
                container.innerHTML = `<div style="text-align:center;padding:30px;color:#6b7280;background:#fff;border-radius:8px;border:1px solid #e2e8f0;">Chưa có chiến dịch quà tặng nào.</div>`;
                return;
            }

            container.innerHTML = list.map(item => {
                var now = new Date();
                var end = new Date(item.end_date);
                var start = new Date(item.start_date);
                
                var statusBadge = '';
                var opacity = '';
                
                if (!item.is_active) {
                    statusBadge = `<span class="status-badge" style="background:#f1f5f9;color:#94a3b8;font-size:11px;">Tắt</span>`;
                    opacity = 'style="opacity:0.7;"';
                } else if (end < now) {
                    statusBadge = `<span class="status-badge" style="background:#fee2e2;color:#ef4444;font-size:11px;">Đã kết thúc</span>`;
                    opacity = 'style="opacity:0.7;"';
                } else if (start > now) {
                    statusBadge = `<span class="status-badge" style="background:#eff6ff;color:#1d4ed8;font-size:11px;">Chưa chạy</span>`;
                } else {
                    statusBadge = `<span class="status-badge active" style="font-size:11px;">Đang chạy</span>`;
                }

                var channelStr = item.applicable_channel === 'all' ? 'Web & POS' : item.applicable_channel === 'web' ? 'Chỉ Website' : 'Chỉ POS';

                return `
                    <div class="gift-rule-card" ${opacity}>
                        <div class="gift-icon"><i class="fa-solid fa-gift"></i></div>
                        <div class="gift-info">
                            <h4>${item.name}</h4>
                            <p>Tặng: <strong>${item.gift_product_name} x${item.gift_product_qty}</strong></p>
                            <p style="font-size:11px;color:#6b7280;margin-top:4px;">Áp dụng: ${channelStr} • Từ ${formatDate(start)} → ${formatDate(end)} • Đã tặng: <strong>${item.usage_count} lần</strong></p>
                        </div>
                        <div class="gift-actions">
                            ${statusBadge}
                            <button class="btn-icon" title="Chỉnh sửa" onclick="openGiftEditModal(${item.id})"><i class="fa-solid fa-pencil"></i></button>
                            <button class="btn-icon" title="${item.is_active ? 'Tạm dừng' : 'Kích hoạt'}" onclick="toggleVoucherStatus(${item.id}, ${item.is_active})"><i class="fa-solid ${item.is_active ? 'fa-pause' : 'fa-play'}"></i></button>
                        </div>
                    </div>
                `;
            }).join('');

            // Also load/enrich Tab 2 Quick Stats based on loaded gifts
            var activeGifts = list.filter(g => g.is_active && new Date(g.end_date) >= new Date() && new Date(g.start_date) <= new Date());
            var totalGiftsSent = list.reduce((sum, g) => sum + (g.usage_count || 0), 0);
            
            document.getElementById('gift-total-sent').textContent = totalGiftsSent;
            
            if (list.length > 0) {
                // Find top campaign (highest usage)
                var topCampaign = [...list].sort((a,b) => b.usage_count - a.usage_count)[0];
                document.getElementById('gift-top-campaign').textContent = topCampaign.name.replace('Gift:', '').trim();
                document.getElementById('gift-top-campaign-usage').textContent = `${topCampaign.usage_count} lần đã áp dụng`;
                
                // Find top product
                document.getElementById('gift-top-product').textContent = topCampaign.gift_product_name;
            }
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Không thể tải chiến dịch quà tặng.</div>`;
    }
}

function initGiftProductAutocomplete() {
    var input = document.getElementById('gift-product-input');
    var dropdown = document.getElementById('gift-products-dropdown');
    if (!input || !dropdown) return;
    
    var debounceTimer = null;
    
    var fetchAndRender = async () => {
        var term = input.value.trim();
        try {
            var queryParams = new URLSearchParams({
                limit: '50',
                status: 'active'
            });
            if (term) {
                queryParams.set('q', term);
            }
            
            var res = await fetch(`${API_BASE}/catalog/products?${queryParams.toString()}`, {
                headers: getHeaders()
            });
            var result = await res.json();
            
            var products = [];
            if (result.success && Array.isArray(result.data)) {
                products = result.data;
            } else if (result.success && result.data && Array.isArray(result.data.data)) {
                products = result.data.data;
            }
            
            // FILTER: Chỉ giữ các sản phẩm thực tế còn tồn kho (total_stock > 0 hoặc in_stock là true)
            var inStockProducts = products.filter(prod => prod.in_stock === true || Number(prod.total_stock) > 0);
            
            if (inStockProducts.length === 0) {
                dropdown.innerHTML = '<div style="padding: 10px 12px; font-size: 13px; color: #9ca3af; text-align: center;">Không tìm thấy sản phẩm còn hàng.</div>';
                dropdown.style.display = 'block';
                return;
            }
            
            var html = '';
            inStockProducts.forEach(prod => {
                html += `<div class="custom-autocomplete-dropdown-item" data-name="${prod.name}">${prod.name} (Tồn: ${prod.total_stock || 0})</div>`;
            });
            dropdown.innerHTML = html;
            dropdown.style.display = 'block';
            
            dropdown.querySelectorAll('.custom-autocomplete-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    input.value = item.getAttribute('data-name');
                    dropdown.style.display = 'none';
                    e.stopPropagation();
                });
            });
        } catch (e) {
            console.error('Lỗi khi tải danh sách sản phẩm quà tặng:', e);
            dropdown.innerHTML = '<div style="padding: 10px 12px; font-size: 13px; color: #ef4444; text-align: center;">Lỗi tải sản phẩm.</div>';
            dropdown.style.display = 'block';
        }
    };
    
    input.addEventListener('focus', fetchAndRender);
    input.addEventListener('click', (e) => {
        fetchAndRender();
        e.stopPropagation();
    });
    
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchAndRender, 250);
    });
    
    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== dropdown && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function openGiftNewModal() {
    activeGiftId = null;
    document.getElementById('giftModalTitle').innerText = 'Thêm Chiến Dịch Quà Tặng';
    document.getElementById('gift-form').reset();
    
    // Defaults
    document.getElementById('gift-start-input').value = new Date().toISOString().slice(0, 10);
    var in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    document.getElementById('gift-end-input').value = in30Days.toISOString().slice(0, 10);

    // Reset dropdown state
    var dropdown = document.getElementById('gift-products-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    document.getElementById('giftModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

async function openGiftEditModal(id) {
    activeGiftId = id;
    document.getElementById('giftModalTitle').innerText = 'Chỉnh sửa Chiến Dịch Quà Tặng';
    
    // Reset dropdown state
    var dropdown = document.getElementById('gift-products-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    try {
        var res = await fetch(`${API_BASE}/cms/promotions/${id}`, { headers: getHeaders() });
        var result = await res.json();
        
        if (result.success && result.data) {
            var item = result.data;
            document.getElementById('gift-name-input').value = item.name || '';
            document.getElementById('gift-min-order-input').value = item.min_order_value || 0;
            document.getElementById('gift-product-input').value = item.gift_product_name || '';
            document.getElementById('gift-qty-input').value = item.gift_product_qty || 1;
            
            if (item.start_date) {
                document.getElementById('gift-start-input').value = new Date(item.start_date).toISOString().slice(0, 10);
            }
            if (item.end_date) {
                document.getElementById('gift-end-input').value = new Date(item.end_date).toISOString().slice(0, 10);
            }
            
            document.getElementById('gift-channel-select').value = item.applicable_channel || 'all';

            document.getElementById('giftModal').classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    } catch (e) {
        showToast('Không thể tải chi tiết quà tặng', 'error');
    }
}

function closeGiftModal() {
    document.getElementById('giftModal').classList.remove('open');
    document.body.style.overflow = '';
}

async function handleGiftSubmit(e) {
    e.preventDefault();

    var name = document.getElementById('gift-name-input').value.trim();
    var min_order_value = Number(document.getElementById('gift-min-order-input').value) || 0;
    var gift_product_name = document.getElementById('gift-product-input').value.trim();
    var gift_product_qty = Number(document.getElementById('gift-qty-input').value) || 1;
    var start_date = document.getElementById('gift-start-input').value;
    var end_date = document.getElementById('gift-end-input').value;
    var applicable_channel = document.getElementById('gift-channel-select').value;

    if (!name || !gift_product_name) {
        showToast('Vui lòng nhập đầy đủ Tên chiến dịch và Sản phẩm quà', 'error');
        return;
    }

    var payload = {
        name,
        type: 'buy_x_get_y',
        discount_value: 0,
        min_order_value,
        applicable_to: 'all',
        applicable_channel,
        gift_product_name,
        gift_product_qty,
        start_date,
        end_date,
        is_active: 1
    };

    try {
        var res;
        if (activeGiftId) {
            res = await fetch(`${API_BASE}/cms/promotions/${activeGiftId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(`${API_BASE}/cms/promotions`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        }

        var result = await res.json();
        if (result.success) {
            showToast(result.message || 'Lưu chiến dịch quà tặng thành công');
            closeGiftModal();
            loadGiftCampaigns();
            loadStats();
        } else {
            showToast(result.message || 'Lỗi xảy ra', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối server', 'error');
    }
}

// ─── SECTION 4: LOYALTY PROGRAM (TAB 3) ────────────────────────────────────────
async function loadLoyaltyTiers() {
    try {
        var res = await fetch(`${API_BASE}/cms/loyalty/tiers`, { headers: getHeaders() });
        var result = await res.json();

        if (result.success && result.data) {
            var tiers = result.data;
            
            // Map tiers dynamically
            tiers.forEach(tier => {
                var prefix = `tier-${tier.tier_code}`;
                var rateInput = document.getElementById(`${prefix}-rate`);
                var spendingDesc = document.getElementById(`${prefix}-spending-desc`);
                
                if (rateInput) {
                    rateInput.value = tier.points_rate || 0;
                    rateInput.dataset.code = tier.tier_code;
                }
                if (spendingDesc) {
                    spendingDesc.textContent = `Từ ${formatVND(tier.min_spending)} ${tier.max_spending ? `– ${formatVND(tier.max_spending)}` : 'trở lên'} tổng chi tiêu`;
                }
            });
        }
    } catch (e) {
        console.error('Failed to load loyalty tiers:', e);
    }
}

async function saveLoyaltyTiers() {
    var tiers = [];
    var inputs = ['tier-member', 'tier-silver', 'tier-gold', 'tier-vip'];
    
    inputs.forEach(id => {
        var el = document.getElementById(`${id}-rate`);
        if (el) {
            tiers.push({
                tier_code: el.dataset.code,
                points_rate: Number(el.value) || 0
            });
        }
    });

    try {
        var res = await fetch(`${API_BASE}/cms/loyalty/tiers`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ tiers })
        });
        var result = await res.json();
        
        if (result.success) {
            showToast('Lưu cấu hình hạng thành viên thành công');
            loadLoyaltyTiers();
        } else {
            showToast(result.message || 'Lỗi xảy ra', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối server', 'error');
    }
}

async function loadLoyaltyConfig() {
    try {
        var res = await fetch(`${API_BASE}/cms/loyalty/config`, { headers: getHeaders() });
        var result = await res.json();

        if (result.success && result.data) {
            var config = result.data;
            
            // Set inputs
            if (document.getElementById('loyalty-rate')) {
                document.getElementById('loyalty-rate').value = config.loyalty_points_per_vnd?.value || 100;
            }
            if (document.getElementById('loyalty-min')) {
                document.getElementById('loyalty-min').value = config.loyalty_min_redeem?.value || 500;
            }
            if (document.getElementById('loyalty-max')) {
                document.getElementById('loyalty-max').value = config.loyalty_max_redeem_per_order?.value || 200000;
            }

            // Switches
            setToggleSwitch('loyalty-allow-web-toggle', !!config.loyalty_allow_web?.value);
            setToggleSwitch('loyalty-allow-pos-toggle', !!config.loyalty_allow_pos?.value);
        }
    } catch (e) {
        console.error('Failed to load loyalty config:', e);
    }
}

async function saveLoyaltyConfig() {
    var loyalty_points_per_vnd = Number(document.getElementById('loyalty-rate').value) || 100;
    var loyalty_min_redeem = Number(document.getElementById('loyalty-min').value) || 500;
    var loyalty_max_redeem_per_order = Number(document.getElementById('loyalty-max').value) || 200000;
    
    var loyalty_allow_web = document.getElementById('loyalty-allow-web-toggle').classList.contains('on');
    var loyalty_allow_pos = document.getElementById('loyalty-allow-pos-toggle').classList.contains('on');

    var payload = {
        loyalty_points_per_vnd,
        loyalty_min_redeem,
        loyalty_max_redeem_per_order,
        loyalty_allow_web,
        loyalty_allow_pos
    };

    try {
        var res = await fetch(`${API_BASE}/cms/loyalty/config`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        var result = await res.json();
        
        if (result.success) {
            showToast('Lưu quy tắc đổi điểm thành công');
            loadLoyaltyConfig();
        } else {
            showToast(result.message || 'Lỗi xảy ra', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối server', 'error');
    }
}

async function loadLoyaltyStats() {
    try {
        var res = await fetch(`${API_BASE}/cms/loyalty/stats`, { headers: getHeaders() });
        var result = await res.json();

        if (result.success && result.data) {
            var stats = result.data;
            
            // Total customers and points system
            document.getElementById('loyalty-total-members').textContent = new Intl.NumberFormat('vi-VN').format(stats.total_customers);
            
            var totalPoints = stats.total_points_system;
            document.getElementById('loyalty-total-points').textContent = totalPoints >= 1000000 ? (totalPoints / 1000000).toFixed(1) + 'M' : new Intl.NumberFormat('vi-VN').format(totalPoints);

            // Distribution bars
            var codes = {
                member: 'bronze',
                silver: 'silver',
                gold: 'gold',
                vip: 'diamond'
            };
            
            // Clear default values first
            ['bronze', 'silver', 'gold', 'diamond'].forEach(color => {
                document.getElementById(`loyalty-${color}-count`).textContent = '0 KH';
                document.getElementById(`loyalty-${color}-bar`).style.width = '0%';
            });

            stats.breakdown.forEach(row => {
                var suffix = codes[row.loyalty_tier];
                if (suffix) {
                    document.getElementById(`loyalty-${suffix}-count`).textContent = `${new Intl.NumberFormat('vi-VN').format(row.customer_count)} KH`;
                    document.getElementById(`loyalty-${suffix}-bar`).style.width = `${row.percentage}%`;
                }
            });
        }
    } catch (e) {
        console.error('Failed to load loyalty stats:', e);
    }
}

// Switch helper
function setToggleSwitch(elementId, isOn) {
    var el = document.getElementById(elementId);
    if (!el) return;
    if (isOn) {
        el.classList.add('on');
    } else {
        el.classList.remove('on');
    }
}

// Toggle switch handler in UI
window.handleToggleSwitchClick = function(el) {
    el.classList.toggle('on');
    el.dataset.active = el.classList.contains('on') ? "true" : "false";
};


// ─── GENERAL HELPERS ──────────────────────────────────────────────────────────
function formatVND(value) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value).replace('₫', '₫');
}

function formatDate(dateObj) {
    var d = new Date(dateObj);
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Expose open methods to HTML
window.openVoucherModal = openVoucherNewModal;
window.openVoucherEditModal = openVoucherEditModal;
window.closeVoucherModal = closeVoucherModal;
window.toggleVoucherStatus = toggleVoucherStatus;
window.cloneVoucher = cloneVoucher;
window.openGiftModal = openGiftNewModal;
window.openGiftEditModal = openGiftEditModal;
window.closeGiftModal = closeGiftModal;
window.toggleDiscountFields = function(val) {
    var group = document.getElementById('discount-value-group');
    var input = document.getElementById('voucher-value-input');
    if (group) {
        if (val === 'freeship') {
            group.style.display = 'none';
            if (input) input.removeAttribute('required');
        } else {
            group.style.display = 'block';
            if (input) input.setAttribute('required', '');
        }
    }
};
