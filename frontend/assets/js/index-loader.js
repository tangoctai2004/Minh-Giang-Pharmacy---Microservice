/**
 * Loads Catalog data for the client home page.
 * Catalog only supplies product/category/search data; cart and checkout remain outside this file.
 */
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
        }
    };
}

const homeCatalog = {
    iconPool: [
        '../assets/images/icon_category_than_kinh_nao.png',
        '../assets/images/icon_category_vitamin_va_khoang_chat.png',
        '../assets/images/icon_category_suc_khoe_tim_mach.png',
        '../assets/images/icon_category_tang_cuong_de_khang.png',
        '../assets/images/icon_category_ho_tro_tieu_hoa.png',
        '../assets/images/icon_category_noi_tiet_sinh_ly.png',
        '../assets/images/icon_category_dinh_duong.png',
        '../assets/images/icon_category_ho_tro_dieu_tri.png',
        '../assets/images/icon_category_giai_phap_cho_lan_da.png',
        '../assets/images/icon_category_cham_soc_da_mat.png',
        '../assets/images/icon_category_ho_tro_lam_dep.png',
        '../assets/images/icon_category_ho_tro_sinh_duc.png'
    ],

    productSections: [
        { selector: '[data-home-products="flash-sale"]', params: { sort: 'popular', limit: 5, requires_prescription: '0' } },
        { selector: '[data-home-products="deal"]', params: { sort: 'trending', limit: 5, requires_prescription: '0' } },
        { selector: '[data-home-products="best-seller"]', params: { sort: 'best_seller', limit: 5, requires_prescription: '0' } },
        { selector: '[data-home-products="discount"]', params: { sort: 'price_desc', limit: 4, requires_prescription: '0' } },
        { selector: '[data-home-products="exclusive"]', params: { sort: 'newest', limit: 5, requires_prescription: '0' } },
        { selector: '[data-home-products="imported"]', params: { sort: 'popular', limit: 4, requires_prescription: '0' } },
        { selector: '[data-home-products="trending"]', params: { sort: 'trending', limit: 5, requires_prescription: '0' } }
    ],

    activePromotions: [],

    setInitialLoadingState() {
        this.productSections.forEach((section) => {
            const container = document.querySelector(section.selector);
            if (!container) return;
            container.innerHTML = '<div class="catalog-widget-loading">Đang tải sản phẩm...</div>';
        });

        const categories = document.querySelector('[data-home-categories]');
        if (categories) {
            categories.innerHTML = '<div class="catalog-widget-loading">Đang tải danh mục...</div>';
        }

        const topSearches = document.querySelector('[data-home-top-searches]');
        if (topSearches) {
            topSearches.innerHTML = '<span class="catalog-widget-loading">Đang tải tìm kiếm hàng đầu...</span>';
        }
    },

    escape(value) {
        if (window.MGClientApi && typeof window.MGClientApi.escapeHtml === 'function') {
            return window.MGClientApi.escapeHtml(value);
        }
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    formatPrice(value) {
        const number = Number(value || 0);
        if (!number) return 'Liên hệ';
        return new Intl.NumberFormat('vi-VN').format(Math.round(number)) + 'đ';
    },

    productImage(product) {
        return product.thumbnail || product.image_url || '../assets/images/placeholder.png';
    },

    renderProductCard(product) {
        if (window.MGClientApi && typeof window.MGClientApi.renderProductCard === 'function') {
            return window.MGClientApi.renderProductCard(product, {
                discountPercent: product.discount_percent || 0,
                showOldPrice: Boolean(product.original_price && product.original_price > (product.retail_price || product.price || 0))
            });
        }

        const id = Number(product.id);
        const name = this.escape(product.name || 'Sản phẩm');
        const image = this.escape(this.productImage(product));
        const price = this.formatPrice(product.retail_price || product.price);
        const unit = product.base_unit ? ` / ${this.escape(product.base_unit)}` : '';
        const isRx = Boolean(product.requires_prescription);
        const inStock = product.in_stock !== false;
        const badge = product.discount_percent > 0
            ? `<span class="discount-badge">-${Number(product.discount_percent)}%</span>`
            : '';

        let action = `<button class="btn-add-cart" onclick="window.addToCart ? addToCart(${id}, event) : (window.location.href='product.html?id=${id}')">Thêm giỏ hàng</button>`;
        if (isRx) {
            action = `<button class="btn-add-cart btn-consult" onclick="event.preventDefault(); event.stopPropagation(); window.location.href='product.html?id=${id}'">Tư vấn ngay</button>`;
        } else if (!inStock) {
            action = '<button class="btn-add-cart" disabled>Hết hàng</button>';
        }

        const priceHtml = isRx
            ? '<span class="price-new catalog-rx-note">Cần tư vấn dược sĩ</span>'
            : `<span class="price-new">${price}<small>${unit}</small></span>`;

        return `
            <div class="product-card" data-product-id="${id}">
                <div class="product-image">
                    ${badge}
                    <img src="${image}" alt="${name}" onerror="this.src='../assets/images/placeholder.png'">
                </div>
                <div class="product-info">
                    <h5><a href="product.html?id=${id}">${name}</a></h5>
                    <div class="product-price">${priceHtml}</div>
                    ${action}
                </div>
            </div>
        `;
    },

    getSectionDiscountPercent(section) {
        const sectionName = section.selector.match(/"([^"]+)"/)?.[1] || '';
        if (!['flash-sale', 'deal', 'discount'].includes(sectionName)) return 0;

        const percentPromo = this.activePromotions.find((promotion) =>
            promotion.discount_type === 'percent' && Number(promotion.discount_percent || 0) > 0
        );
        return percentPromo ? Number(percentPromo.discount_percent || 0) : 0;
    },

    async loadActivePromotions() {
        try {
            const result = await catalogApi().get('promotions/active', { limit: 6 });
            this.activePromotions = Array.isArray(result.data) ? result.data : [];
        } catch (error) {
            this.activePromotions = [];
            console.error('[HomeCatalog] Promotions error:', error);
        }
    },

    async loadProductSection(section) {
        const container = document.querySelector(section.selector);
        if (!container) return;

        try {
            const result = await catalogApi().get('products', section.params);
            const discountPercent = this.getSectionDiscountPercent(section);
            const products = (result.data || []).map((product) => ({
                ...product,
                discount_percent: Number(product.discount_percent || discountPercent || 0)
            }));
            if (products.length === 0) {
                container.innerHTML = '<div class="catalog-widget-loading">Chưa có sản phẩm phù hợp.</div>';
                return;
            }
            container.innerHTML = products.map((product) => this.renderProductCard(product)).join('');
        } catch (error) {
            console.error('[HomeCatalog] Product section error:', section.selector, error);
            container.innerHTML = '<div class="catalog-widget-loading">Chưa tải được sản phẩm.</div>';
        }
    },

    flattenCategories(nodes, output = []) {
        nodes.forEach((node) => {
            if (node.children && node.children.length > 0) {
                node.children.forEach((child) => output.push(child));
            } else {
                output.push(node);
            }
        });
        return output;
    },

    async loadCategories() {
        const container = document.querySelector('[data-home-categories]');
        if (!container) return;

        try {
            const result = await catalogApi().get('categories/tree');
            const categories = this.flattenCategories(result.data || []).slice(0, 12);
            if (categories.length === 0) {
                container.innerHTML = '<div class="catalog-widget-loading">Chưa có danh mục.</div>';
                return;
            }

            container.innerHTML = categories.map((category, index) => {
                const name = this.escape(category.name);
                const image = this.escape(category.image_url || this.iconPool[index % this.iconPool.length]);
                return `
                    <a href="category.html?id=${Number(category.id)}" class="category-item">
                        <img src="${image}" alt="${name}" onerror="this.src='${this.iconPool[index % this.iconPool.length]}'">
                        <span>${name}</span>
                    </a>
                `;
            }).join('');
        } catch (error) {
            console.error('[HomeCatalog] Categories error:', error);
            container.innerHTML = '<div class="catalog-widget-loading">Chưa tải được danh mục.</div>';
        }
    },

    async loadTopSearches() {
        const container = document.querySelector('[data-home-top-searches]');
        if (!container) return;

        try {
            const result = await catalogApi().get('products/top-searches', { limit: 30 });
            const keywords = result.data || [];
            if (keywords.length === 0) {
                container.innerHTML = '<span class="catalog-widget-loading">Chưa có tìm kiếm hàng đầu.</span>';
                return;
            }

            container.innerHTML = keywords.map((item) => {
                const keyword = this.escape(item.keyword);
                return `<a href="search.html?q=${encodeURIComponent(item.keyword)}" class="tag-item">${keyword}</a>`;
            }).join('');
        } catch (error) {
            console.error('[HomeCatalog] Top searches error:', error);
            container.innerHTML = '<span class="catalog-widget-loading">Chưa tải được tìm kiếm hàng đầu.</span>';
        }
    },

    async init() {
        this.setInitialLoadingState();
        await this.loadActivePromotions();
        await Promise.all([
            this.loadCategories(),
            this.loadTopSearches(),
            ...this.productSections.map((section) => this.loadProductSection(section))
        ]);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    homeCatalog.init();
});
