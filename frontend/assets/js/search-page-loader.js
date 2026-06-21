/**
 * search-page-loader.js
 * Xử lý tải dữ liệu sản phẩm cho trang kết quả tìm kiếm
 */

function catalogApi() {
    if (window.MGCatalogApi) return window.MGCatalogApi;
    const gateway = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
    const baseUrl = window.MG_CATALOG_API_BASE || (gateway + '/api/catalog');
    return {
        async get(path, params) {
            const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`);
            Object.entries(params || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
            });
            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }
    };
}

/**
 * Làm mới widget Tìm kiếm hàng đầu sau khi tracking xong.
 * Retry tới 15 lần (mỗi 100ms) để đợi catalog-widgets.js inject xong.
 */
function refreshTopSearchesWidget(attempt = 0) {
    if (window.MGCatalogWidgets && typeof window.MGCatalogWidgets.init === 'function') {
        window.MGCatalogWidgets.init(true);
        return;
    }
    if (attempt < 15) {
        setTimeout(() => refreshTopSearchesWidget(attempt + 1), 100);
    }
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

const searchState = {
    query: '',
    page: 1,
    limit: 28,
    sort: 'popular'
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    const page = Math.max(1, Number(urlParams.get('page')) || 1);
    const sort = urlParams.get('sort') || 'popular';
    const limit = Number(urlParams.get('limit')) || 28;

    if (!query) {
        renderNoResults('Bạn chưa nhập từ khóa tìm kiếm.');
        return;
    }

    searchState.query = query;
    searchState.page = page;
    searchState.sort = sort;
    searchState.limit = limit;

    // Cập nhật UI ban đầu
    document.getElementById('searchTerm').textContent = query;
    const breadcrumbQuery = document.getElementById('breadcrumbQuery');
    if (breadcrumbQuery) breadcrumbQuery.textContent = `Tìm kiếm: ${query}`;
    document.title = `Kết quả tìm kiếm cho "${query}" — Nhà Thuốc Minh Giang`;

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = sort;
    const limitSelect = document.getElementById('pageLimitSelect');
    if (limitSelect) limitSelect.value = String(limit);

    fetchSearchResults();

    // Xử lý thay đổi sắp xếp
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            searchState.sort = sortSelect.value;
            searchState.page = 1;
            updateSearchUrl();
            fetchSearchResults();
        });
    }

    if (limitSelect) {
        limitSelect.addEventListener('change', () => {
            searchState.limit = Number(limitSelect.value) || 28;
            searchState.page = 1;
            updateSearchUrl();
            fetchSearchResults();
        });
    }
});

function updateSearchUrl() {
    const params = new URLSearchParams();
    params.set('q', searchState.query);
    if (searchState.page > 1) params.set('page', searchState.page);
    if (searchState.sort !== 'popular') params.set('sort', searchState.sort);
    if (searchState.limit !== 28) params.set('limit', searchState.limit);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

async function trackSearchKeyword(keyword) {
    if (!keyword || keyword.trim().length < 2) return;
    try {
        const gateway = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
        const trackUrl = `${gateway}/api/cms/trending-searches/track`;
        await fetch(trackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword.trim() })
        });
    } catch (e) {
        console.warn('[SearchPage] Tracking failed:', e);
    }
}

async function fetchSearchResults() {
    const grid = document.getElementById('searchResultGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading">Đang tìm kiếm sản phẩm...</div>';

    // Theo dõi từ khóa tìm kiếm và đợi hoàn tất
    await trackSearchKeyword(searchState.query);

    // Kích hoạt làm mới widget ngay sau khi track xong.
    // Dùng retry vì catalog-widgets.js có thể đang được inject động bởi components.js
    refreshTopSearchesWidget();

    try {
        const result = await catalogApi().get('products', {
            q: searchState.query,
            page: searchState.page,
            limit: searchState.limit,
            sort: searchState.sort
        });

        if (result.success && result.data.length > 0) {
            document.getElementById('totalCount').textContent = result.pagination.total;
            renderProducts(result.data);
            renderPagination(result.pagination);
        } else {
            renderNoResults(`Không tìm thấy sản phẩm nào khớp với từ khóa "${escapeHtml(searchState.query)}".`);
        }
    } catch (error) {
        console.error('[SearchPage] Error:', error);
        renderNoResults('Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại sau.');
    }
}

function renderProducts(products) {
    const grid = document.getElementById('searchResultGrid');
    if (window.MGClientApi && typeof window.MGClientApi.renderProductCard === 'function') {
        grid.innerHTML = products.map((product) => window.MGClientApi.renderProductCard(product)).join('');
        return;
    }

    grid.innerHTML = products.map(p => {
        const id = Number(p.id);
        const name = escapeHtml(p.name || 'Sản phẩm');
        const image = escapeHtml(p.image_url || p.thumbnail || '../assets/images/product1.png');
        const price = p.price || p.retail_price;
        const unit = p.base_unit ? ` / ${escapeHtml(p.base_unit)}` : '';
        const priceHtml = p.requires_prescription
            ? '<span class="price-new catalog-rx-note">Cần tư vấn dược sĩ</span>'
            : `<span class="price-new">${price ? new Intl.NumberFormat('vi-VN').format(Math.round(price)) + 'đ' : 'Liên hệ'}<small>${unit}</small></span>`;

        let actionHtml = `<button class="btn-add-cart" onclick="window.addToCart ? addToCart(${id}, event) : (window.location.href='product.html?id=${id}')">Thêm giỏ hàng</button>`;
        if (p.requires_prescription) {
            actionHtml = `<button class="btn-add-cart btn-consult" onclick="event.preventDefault(); event.stopPropagation(); window.location.href='product.html?id=${id}'">Tư vấn ngay</button>`;
        } else if (p.in_stock === false) {
            actionHtml = '<button class="btn-add-cart" disabled>Hết hàng</button>';
        }

        const stockQty = Number(p.total_stock ?? p.available_stock ?? 0);
        let stockHtml = '';
        if (!p.requires_prescription) {
            if (stockQty > 0) {
                stockHtml = '';
            } else {
                stockHtml = `<div class="product-stock-badge" style="font-size: 11px; color: #9ca3af; font-weight: 600; margin-top: 4px; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-boxes-stacked"></i> Hết hàng</div>`;
            }
        }

        return `
            <div class="product-card" data-product-id="${id}">
                <div class="product-image">
                    ${p.discount_percent > 0 ? `<span class="discount-badge">-${p.discount_percent}%</span>` : ''}
                    <img src="${image}" alt="${name}" onerror="this.src='../assets/images/placeholder.png'">
                </div>
                <div class="product-info">
                    <h5><a href="product.html?id=${id}">${name}</a></h5>
                    <div class="product-price">
                        ${priceHtml}
                    </div>
                    ${stockHtml}
                    ${actionHtml}
                </div>
            </div>
        `;
    }).join('');
}

function renderPagination(pagination) {
    const container = document.getElementById('searchPagination');
    if (!container) return;

    const page = Number(pagination.page || searchState.page || 1);
    const pages = Number(pagination.pages || pagination.total_pages || 1);
    if (pages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    
    // Nút Previous
    if (page > 1) {
        html += `<button class="page-btn" data-page="${page - 1}"><i class="fa-solid fa-chevron-left"></i></button>`;
    }

    const start = Math.max(1, page - 2);
    const end = Math.min(pages, page + 2);
    if (start > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (start > 2) html += `<span class="page-ellipsis">...</span>`;
    }

    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (end < pages) {
        if (end < pages - 1) html += `<span class="page-ellipsis">...</span>`;
        html += `<button class="page-btn" data-page="${pages}">${pages}</button>`;
    }

    // Nút Next
    if (page < pages) {
        html += `<button class="page-btn" data-page="${page + 1}"><i class="fa-solid fa-chevron-right"></i></button>`;
    }

    container.innerHTML = html;
    container.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextPage = Number(btn.getAttribute('data-page'));
            if (!nextPage || nextPage === searchState.page) return;
            searchState.page = nextPage;
            updateSearchUrl();
            fetchSearchResults();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function renderNoResults(message) {
    const grid = document.getElementById('searchResultGrid');
    grid.innerHTML = `
        <div class="no-results" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 24px;">
            <div style="text-align: center;">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                <h2 style="font-size: 20px; color: #4b5563;">${message}</h2>
                <p style="margin-top:10px; color:#6b7280; font-size: 15px;">Hãy thử tìm kiếm với từ khóa khác hoặc kiểm tra lại chính tả.</p>
            </div>
            <div class="top-searches" style="margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 24px; width: 100%; text-align: left;">
                <h3 style="font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 14px;">Gợi ý từ khóa tìm kiếm hàng đầu:</h3>
                <div class="top-search-links">
                    <span class="catalog-widget-loading">Đang tải tìm kiếm hàng đầu...</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('totalCount').textContent = '0';

    const pagination = document.getElementById('searchPagination');
    if (pagination) pagination.innerHTML = '';
}
