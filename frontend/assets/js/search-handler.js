/**
 * search-handler.js
 * Xử lý gợi ý tìm kiếm thông minh (Autocomplete)
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

(function initSearchHandler() {
    const searchInput = document.getElementById('searchInput');
    const searchSuggest = document.getElementById('searchSuggest');
    const searchBtn = document.querySelector('.search-btn');

    if (!searchInput || !searchSuggest) return;

    let debounceTimer;

    // Lắng nghe sự kiện gõ phím
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim();

        clearTimeout(debounceTimer);
        if (keyword.length < 2) {
            searchSuggest.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSearchSuggestions(keyword);
        }, 300);
    });

    // Xử lý khi nhấn nút tìm kiếm hoặc Enter
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const keyword = searchInput.value.trim();
            if (keyword) {
                window.location.href = `search.html?q=${encodeURIComponent(keyword)}`;
            }
        }
    });

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const keyword = searchInput.value.trim();
            if (keyword) {
                window.location.href = `search.html?q=${encodeURIComponent(keyword)}`;
            }
        });
    }

    // Đóng dropdown khi click ra ngoài
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-area')) {
            searchSuggest.style.display = 'none';
        }
    });

    // Hiện lại dropdown khi focus vào input nếu có keyword
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2 && searchSuggest.innerHTML !== '') {
            searchSuggest.style.display = 'block';
        }
    });

    async function fetchSearchSuggestions(keyword) {
        try {
            const result = await catalogApi().get('products/search-suggest', { q: keyword });

            if (result.success) {
                renderSuggestions(result.data, keyword);
            }
        } catch (error) {
            console.error('[Search] Suggestion error:', error);
        }
    }

    function renderSuggestions(data, keyword) {
        const products = Array.isArray(data?.products) ? data.products : [];
        const categories = Array.isArray(data?.categories) ? data.categories : [];

        if (products.length === 0 && categories.length === 0) {
            searchSuggest.style.display = 'none';
            return;
        }

        let html = '';

        // 1. Render Danh mục gợi ý
        if (categories && categories.length > 0) {
            html += '<div class="suggest-section-title">Danh mục liên quan</div>';
            categories.slice(0, 3).forEach(cat => {
                html += `
                    <a href="category.html?id=${cat.id}" class="suggest-category">
                        <i class="fa-solid fa-layer-group"></i>
                        <span>${escapeSearchHtml(cat.name)}</span>
                    </a>
                `;
            });
        }

        // 2. Render Sản phẩm gợi ý
        if (products && products.length > 0) {
            html += '<div class="suggest-section-title">Sản phẩm gợi ý</div>';
            products.slice(0, 5).forEach(p => {
                // API search-suggest trả về retail_price thay vì price
                const priceValue = p.retail_price ? p.retail_price : 0;
                const priceHtml = `<span class="suggest-price">${new Intl.NumberFormat('vi-VN').format(Math.round(priceValue))}đ</span>`;

                html += `
                    <a href="product.html?id=${p.id}" class="suggest-item">
                        <img src="${escapeSearchHtml(p.image_url || '../assets/images/product1.png')}" alt="${escapeSearchHtml(p.name)}" class="suggest-img">
                        <div class="suggest-info">
                            <div class="suggest-name">${escapeSearchHtml(p.name)}</div>
                            ${priceHtml}
                        </div>
                    </a>
                `;
            });
        }

        // 3. Nút Xem tất cả
        const totalCount = products.length; // Backend thường trả về giới hạn, nhưng ở đây ta giả định data chứa tổng số nếu có
        html += `
            <a href="search.html?q=${encodeURIComponent(keyword)}" class="suggest-view-all">
                Xem tất cả kết quả tìm được
            </a>
        `;

        searchSuggest.innerHTML = html;
        searchSuggest.style.display = 'block';
    }

    function escapeSearchHtml(value) {
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
})();
