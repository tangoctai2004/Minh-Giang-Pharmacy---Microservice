/**
 * admin-loader.js
 * Loads live order stats, inventory alerts, and revenue chart on the admin dashboard.
 */

var API_BASE = localStorage.getItem('MG_API_BASE') || (
    (window.location.origin.includes('localhost:5500') ||
     window.location.origin.includes('localhost:5501') ||
     window.location.origin.includes('127.0.0.1:5500') ||
     window.location.origin.includes('127.0.0.1:5501'))
    ? 'http://localhost:8000/api'
    : window.location.origin.replace(/\/+$/, '') + '/api'
);

document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
});

async function initAdminDashboard() {
    await Promise.all([
        loadOrderStats(),
        loadInventoryAlerts()
    ]);
    loadAdminRevenueChart(7);
}

// ========== ORDER STATS ==========
async function loadOrderStats() {
    try {
        var today = new Date().toISOString().slice(0, 10);
        var [posRes, webRes] = await Promise.all([
            fetch(`${API_BASE}/order/orders?channel=pos&date_from=${today}&date_to=${today}&limit=1`, {
                headers: { 'Authorization': `Bearer ${getAdminToken()}` }
            }),
            fetch(`${API_BASE}/order/orders?channel=web&date_from=${today}&date_to=${today}&limit=1`, {
                headers: { 'Authorization': `Bearer ${getAdminToken()}` }
            })
        ]);

        var posData = await posRes.json();
        var webData = await webRes.json();

        var posCount = posData.success ? (posData.pagination?.total ?? 0) : 0;
        var webCount = webData.success ? (webData.pagination?.total ?? 0) : 0;

        setText('statPosOrders', posCount);
        setText('statWebOrders', webCount);

        // Revenue = tổng từ POS (tính tạm từ count * avg, hoặc để '—' nếu không có endpoint riêng)
        // Hiển thị POS orders trend
        setTrend('statPosOrdersTrend', posCount, null, 'đơn hôm nay');
        setTrend('statWebOrdersTrend', webCount, null, 'đơn hôm nay');

        // Revenue placeholder (cần API /reports/revenue nếu có)
        setText('statRevenue', '—');
        document.getElementById('statRevenueTrend')?.setAttribute('class', 'summary-card-trend');
        setText('statRevenueTrend', 'Chưa có dữ liệu doanh thu');
    } catch (e) {
        console.error('[Admin] loadOrderStats failed:', e);
        ['statRevenue', 'statPosOrders', 'statWebOrders'].forEach(id => setText(id, '—'));
    }
}

// ========== INVENTORY ALERTS ==========
async function loadInventoryAlerts() {
    try {
        var res = await fetch(`${API_BASE}/catalog/inventory`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });
        var result = await res.json();

        if (result.success && result.data) {
            var inventory = result.data;

            // Low stock (≤ 10)
            var lowStock = inventory
                .filter(item => Number(item.stock_total) <= 10)
                .sort((a, b) => Number(a.stock_total) - Number(b.stock_total))
                .slice(0, 5);
            renderLowStockTable(lowStock, inventory.filter(i => Number(i.stock_total) <= 10).length);

            // Expiring soon
            var expiring = inventory
                .filter(item => item.nearest_expiry !== null)
                .map(item => ({ ...item, expiryDate: new Date(item.nearest_expiry) }))
                .sort((a, b) => a.expiryDate - b.expiryDate)
                .slice(0, 5);
            renderExpiringTable(expiring);

            // Update card 4
            var lowCount = inventory.filter(i => Number(i.stock_total) <= 10).length;
            setText('statLowStock', lowCount);
            setText('statLowStockLabel', `sản phẩm cần nhập thêm`);
        }
    } catch (e) {
        console.error('[Admin] loadInventoryAlerts failed:', e);
        renderTableError('lowStockTableBody', 3, 'Không thể tải dữ liệu tồn kho');
        renderTableError('expiringTableBody', 4, 'Không thể tải dữ liệu tồn kho');
        setText('statLowStock', '—');
    }
}

function renderLowStockTable(items, totalCount) {
    var tbody = document.getElementById('lowStockTableBody');
    var badge = document.getElementById('lowStockCount');
    if (!tbody) return;

    if (badge) badge.textContent = `${totalCount} sản phẩm`;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:#10b981;">
            <i class="fa-solid fa-circle-check" style="font-size:20px;"></i><br>Không có sản phẩm sắp hết hàng
        </td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        var isCritical = Number(item.stock_total) <= 5;
        return `<tr>
            <td class="table-medicine-name">${item.name}</td>
            <td class="table-sku">${item.sku}</td>
            <td><span class="${isCritical ? 'stock-critical' : 'stock-low'}">${item.stock_total}</span></td>
        </tr>`;
    }).join('');
}

function renderExpiringTable(items) {
    var tbody = document.getElementById('expiringTableBody');
    var badge = document.getElementById('expiringCount');
    if (!tbody) return;

    if (badge) badge.textContent = `${items.length} lô hàng`;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:#10b981;">
            <i class="fa-solid fa-calendar-check" style="font-size:20px;"></i><br>Không có lô hàng sắp hết hạn
        </td></tr>`;
        return;
    }

    var now = new Date();
    tbody.innerHTML = items.map(item => {
        var diffDays = Math.ceil((item.expiryDate - now) / 86400000);
        var isUrgent = diffDays <= 30;
        var dateStr = item.expiryDate.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
        return `<tr>
            <td class="table-medicine-name">${item.name}</td>
            <td class="table-sku">${item.sku || item.batch_code || '—'}</td>
            <td><span class="expiry-badge ${isUrgent ? 'urgent' : 'soon'}">
                <i class="${isUrgent ? 'fa-solid fa-triangle-exclamation' : 'fa-regular fa-clock'}"></i> ${dateStr}
            </span></td>
            <td><button class="btn-restock" onclick="handleRestock('${item.name}')">
                <i class="fa-solid fa-rotate"></i> Nhập thêm
            </button></td>
        </tr>`;
    }).join('');
}

// ========== REVENUE CHART ==========
window.loadAdminRevenueChart = async function(days = 7) {
    var chartBars = document.getElementById('revenueChartBars');
    if (!chartBars) return;

    // Tạo mảng ngày gần nhất
    var dayLabels = ['CN','T2','T3','T4','T5','T6','T7'];
    var dates = [];
    for (let i = days - 1; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d);
    }

    try {
        // Lấy đơn POS + web trong khoảng ngày
        var from = dates[0].toISOString().slice(0, 10);
        var to = dates[dates.length - 1].toISOString().slice(0, 10);

        var [posRes, webRes] = await Promise.all([
            fetch(`${API_BASE}/order/orders?channel=pos&date_from=${from}&date_to=${to}&limit=1000`, {
                headers: { 'Authorization': `Bearer ${getAdminToken()}` }
            }),
            fetch(`${API_BASE}/order/orders?channel=web&date_from=${from}&date_to=${to}&limit=1000`, {
                headers: { 'Authorization': `Bearer ${getAdminToken()}` }
            })
        ]);

        var posData = await posRes.json();
        var webData = await webRes.json();
        var allOrders = [
            ...(posData.success ? posData.data : []),
            ...(webData.success ? webData.data : [])
        ];

        // Group by date
        var revenueByDate = {};
        dates.forEach(d => { revenueByDate[d.toISOString().slice(0, 10)] = 0; });
        allOrders.forEach(o => {
            var dateKey = new Date(o.created_at).toISOString().slice(0, 10);
            if (revenueByDate[dateKey] !== undefined) {
                revenueByDate[dateKey] += Number(o.total_amount || 0);
            }
        });

        var values = Object.values(revenueByDate);
        var maxVal = Math.max(...values, 1);
        var maxBarPx = 180;

        chartBars.innerHTML = dates.map((d, i) => {
            var val = values[i];
            var height = Math.max(8, Math.round((val / maxVal) * maxBarPx));
            var label = dayLabels[d.getDay()];
            var isToday = d.toDateString() === new Date().toDateString();
            var valLabel = val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : (val / 1000).toFixed(0) + 'K';
            return `<div class="chart-bar" style="height:${height}px;background:${isToday ? 'linear-gradient(180deg,#34d399,#10b981)' : 'linear-gradient(180deg,#10b981,#059669)'};">
                <span class="chart-bar-value">${val > 0 ? valLabel : '0'}</span>
                <span class="chart-bar-label" ${isToday ? 'style="font-weight:700;"' : ''}>${label}</span>
            </div>`;
        }).join('');

        // Animate
        chartBars.querySelectorAll('.chart-bar').forEach((bar, i) => {
            var h = bar.style.height;
            bar.style.height = '0';
            bar.style.transition = `height 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 0.07}s`;
            setTimeout(() => bar.style.height = h, 50);
        });

        // Update revenue card
        var todayKey = new Date().toISOString().slice(0, 10);
        var todayRevenue = revenueByDate[todayKey] || 0;
        setText('statRevenue', formatM(todayRevenue));
        setTrend('statRevenueTrend', todayRevenue, null, 'doanh thu hôm nay');

    } catch (e) {
        console.error('[Admin] loadAdminRevenueChart failed:', e);
    }
};

// ========== HELPERS ==========
function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setTrend(id, val, prev, suffix) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = val + ' ' + suffix;
    el.className = 'summary-card-trend';
}

function renderTableError(tbodyId, colspan, msg) {
    var el = document.getElementById(tbodyId);
    if (el) el.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;padding:20px;color:#ef4444;">
        <i class="fa-solid fa-circle-exclamation"></i> ${msg}
    </td></tr>`;
}

function formatM(amount) {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K';
    return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

function handleRestock(medName) {
    if (confirm(`Xác nhận tạo yêu cầu nhập thêm hàng cho: ${medName}?`)) {
        showToast(`Đã gửi yêu cầu nhập hàng cho: ${medName}`, 'success');
    }
}

function getAdminToken() {
    try {
        var auth = JSON.parse(localStorage.getItem('MG_ADMIN_AUTH') || '{}');
        return auth.accessToken || '';
    } catch (e) { return ''; }
}

// Global
window.handleRestock = handleRestock;
window.loadAdminRevenueChart = window.loadAdminRevenueChart;
