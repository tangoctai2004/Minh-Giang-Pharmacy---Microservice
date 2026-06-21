/**
 * Script điều khiển trang Danh sách sản phẩm theo Tag (Tag Product Page)
 * Tải sản phẩm theo tag đặc biệt, áp dụng banner và màu sắc tương ứng.
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
            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }
    };
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

const tagConfigs = {
    'flash-sale': {
        banner: '../assets/images/banner_flash_sale.png',
        containerClass: 'bg-green-container',
        title: 'Flash Sale'
    },
    'deal': {
        banner: '../assets/images/banner_deal_sieu_khung.png',
        containerClass: 'bg-green-container',
        title: 'Deal Siêu Khủng'
    },
    'best-seller': {
        banner: '../assets/images/banner_san_pham_ban_chay.png',
        containerClass: 'bg-green-container',
        title: 'Sản Phẩm Bán Chạy'
    },
    'discount': {
        banner: '../assets/images/banner_giam_gia.png',
        containerClass: 'bg-green-container',
        title: 'Giảm Giá Cực Sốc'
    },
    'exclusive': {
        banner: '../assets/images/banner_san_pham_doc_quyen.png',
        containerClass: 'bg-yellow-container',
        title: 'Sản Phẩm Độc Quyền'
    },
    'imported': {
        banner: '../assets/images/banner_nhap_khau_100.png',
        containerClass: 'bg-red-container',
        title: 'Nhập Khẩu 100%'
    }
};

class TagPage {
    constructor() {
        this.params = new URLSearchParams(window.location.search);
        this.tag = this.params.get('tag') || '';
        this.titleParam = this.params.get('title') || '';
        
        // Cố gắng tìm cấu hình phù hợp từ tag hoặc titleParam
        this.configKey = Object.keys(tagConfigs).find(k => 
            k === this.tag || k === this.titleParam || this.titleParam.toLowerCase().includes(k)
        );
        this.config = tagConfigs[this.configKey] || {
            banner: '',
            containerClass: 'bg-green-container',
            title: this.titleParam || this.tag || 'Khuyến mãi'
        };

        // Trạng thái lọc
        this.filters = {
            tag: this.tag,
            page: Math.max(1, Number(this.params.get('page')) || 1),
            limit: 30, // 30 sản phẩm mỗi trang cho lưới 5 cột chẵn (6 hàng)
            sort: this.params.get('sort') || 'popular'
        };

        // DOM Elements
        this.els = {
            breadcrumbTitle: document.getElementById('breadcrumbTitle'),
            sectionContainer: document.getElementById('tagSectionContainer'),
            bannerImg: document.getElementById('tagBannerImg'),
            sortSelect: document.getElementById('sortSelect'),
            productList: document.getElementById('productList'),
            loading: document.getElementById('loadingProducts'),
            empty: document.getElementById('emptyProducts'),
            pagination: document.getElementById('paginationBox'),
            productCount: document.getElementById('productCount')
        };

        this.init();
    }

    init() {
        this.applyLayoutTheme();
        this.syncControlsFromUrl();
        this.bindEvents();
        this.loadProducts();
        this.loadTopSearches().catch(err => console.error(err));
    }

    async applyLayoutTheme() {
        // Đặt tiêu đề tab trình duyệt và breadcrumb
        document.title = `${this.config.title} — Nhà Thuốc Minh Giang`;
        if (this.els.breadcrumbTitle) {
            this.els.breadcrumbTitle.textContent = this.config.title;
        }

        // Áp dụng class màu nền tương ứng cho section
        if (this.els.sectionContainer) {
            // Xóa hết các class bg-container cũ
            this.els.sectionContainer.classList.remove('bg-green-container', 'bg-yellow-container', 'bg-red-container', 'bg-white-container');
            this.els.sectionContainer.classList.add(this.config.containerClass);
        }

        // Đặt banner tương ứng
        if (this.els.bannerImg) {
            let bannerSrc = this.config.banner;
            if (window.getStoreConfig) {
                try {
                    const storeConfig = await window.getStoreConfig();
                    if (storeConfig && this.configKey) {
                        const mappedKey = this.configKey.replace(/-/g, '_');
                        const val = storeConfig['layout_home_header_' + mappedKey];
                        if (val) {
                            const gateway = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
                            if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:')) {
                                bannerSrc = val;
                            } else if (val.startsWith('/uploads/') || val.startsWith('uploads/')) {
                                const cleanPath = val.startsWith('/') ? val : '/' + val;
                                bannerSrc = gateway + cleanPath;
                            } else {
                                bannerSrc = val;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching dynamic banner for tag page:', e);
                }
            }

            if (bannerSrc) {
                this.els.bannerImg.src = bannerSrc;
                this.els.bannerImg.alt = this.config.title;
                this.els.bannerImg.parentElement.style.display = 'block';
            } else {
                this.els.bannerImg.parentElement.style.display = 'none';
            }
        }
    }

    syncControlsFromUrl() {
        if (this.els.sortSelect) {
            this.els.sortSelect.value = this.filters.sort;
        }
    }

    updateUrl() {
        const params = new URLSearchParams();
        params.set('tag', this.filters.tag);
        if (this.titleParam) params.set('title', this.titleParam);
        if (Number(this.filters.page) > 1) params.set('page', this.filters.page);
        if (String(this.filters.sort) !== 'popular') params.set('sort', this.filters.sort);
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }

    bindEvents() {
        if (this.els.sortSelect) {
            this.els.sortSelect.addEventListener('change', (e) => {
                this.filters.sort = e.target.value;
                this.filters.page = 1;
                this.updateUrl();
                this.loadProducts();
            });
        }
    }

    async loadProducts() {
        if (this.els.loading) this.els.loading.style.display = 'block';
        if (this.els.productList) this.els.productList.style.display = 'none';
        if (this.els.empty) this.els.empty.style.display = 'none';
        if (this.els.pagination) this.els.pagination.innerHTML = '';
        if (this.els.productCount) this.els.productCount.textContent = '0';

        try {
            const json = await catalogApi().get('products', {
                tag: this.filters.tag,
                page: this.filters.page,
                limit: this.filters.limit,
                sort: this.filters.sort,
                requires_prescription: '0' // Chỉ hiển thị các sản phẩm không kê đơn ở trang khuyến mãi
            });
            
            if (json.success && json.data) {
                const data = json.data;
                const total = (json.pagination && json.pagination.total) || data.length;

                if (this.els.productCount) {
                    this.els.productCount.textContent = total;
                }

                if (data.length > 0) {
                    if (this.els.productList) {
                        this.els.productList.innerHTML = data.map(p => this.createProductCard(p)).join('');
                        this.els.productList.style.display = 'grid';
                    }
                    this.renderPagination(json.pagination);
                } else {
                    if (this.els.empty) this.els.empty.style.display = 'block';
                }
            }
        } catch (e) {
            console.error(e);
            if (this.els.empty) this.els.empty.style.display = 'block';
        } finally {
            if (this.els.loading) this.els.loading.style.display = 'none';
        }
    }

    createProductCard(p) {
        if (window.MGClientApi && typeof window.MGClientApi.renderProductCard === 'function') {
            return window.MGClientApi.renderProductCard(p);
        }

        const id = Number(p.id);
        const name = escapeHtml(p.name || 'Sản phẩm');
        const image = escapeHtml(p.thumbnail || p.image_url || '../assets/images/placeholder.png');
        
        // Tính toán hiển thị giá và khuyến mãi
        const hasOldPrice = Boolean(p.original_price && p.original_price > (p.retail_price || p.price || 0));
        const originalPriceFmt = hasOldPrice ? new Intl.NumberFormat('vi-VN').format(Math.round(p.original_price)) + 'đ' : '';
        const priceFmt = p.retail_price || p.price
            ? new Intl.NumberFormat('vi-VN').format(Math.round(p.retail_price || p.price)) + 'đ'
            : 'Liên hệ';
        
        let actionHtml = '';
        let infoHtml = '';

        if (p.requires_prescription) {
            infoHtml = `<div class="product-contact-note" style="color:#6b7280; font-size:13px; font-weight:500; min-height:20px;">Cần tư vấn dược sĩ</div>`;
            actionHtml = `<button class="btn-add-cart btn-consult" onclick="event.preventDefault(); event.stopPropagation(); window.location.href='product.html?id=${id}'">Tư vấn ngay</button>`;
        } else if (p.in_stock === false) {
            infoHtml = `<div class="product-price" style="min-height:20px;"><span class="price-new" style="color:#ea580c; font-weight:700;">${priceFmt}</span></div>`;
            actionHtml = `<button class="btn-add-cart" disabled>Hết hàng</button>`;
        } else {
            const oldPriceHtml = hasOldPrice ? `<span class="price-old" style="font-size:13px; text-decoration:line-through; color:#9ca3af; margin-right:6px;">${originalPriceFmt}</span>` : '';
            infoHtml = `
                <div class="product-price" style="min-height:20px; display:flex; align-items:center;">
                    ${oldPriceHtml}
                    <span class="price-new" style="color:#ea580c; font-weight:700;">${priceFmt}</span>
                </div>
            `;
            actionHtml = `<button class="btn-add-cart" onclick="window.addToCart ? addToCart(${id}, event) : (window.location.href='product.html?id=${id}')">Thêm giỏ hàng</button>`;
        }

        const stockQty = Number(p.total_stock ?? p.available_stock ?? 0);
        let stockHtml = '';
        if (!p.requires_prescription) {
            if (stockQty > 0) {
                stockHtml = '';
            } else {
                stockHtml = `<div class="product-stock-badge" style="font-size: 11px; color: #9ca3af; font-weight: 600; margin-top: 4px; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; padding: 0 12px;"><i class="fa-solid fa-boxes-stacked"></i> Hết hàng</div>`;
            }
        }

        let badge = p.discount_percent > 0
            ? `<span class="discount-badge">-${Number(p.discount_percent)}%</span>`
            : '';

        if (!badge && p.tags) {
            let tags = [];
            try {
                tags = Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags);
            } catch (e) {}
            if (tags && tags.length > 0) {
                if (tags.includes('exclusive')) {
                    badge = `<span class="discount-badge" style="background:#d97706; color:#fff;">Độc quyền</span>`;
                } else if (tags.includes('imported')) {
                    badge = `<span class="discount-badge" style="background:#059669; color:#fff;">Nhập khẩu</span>`;
                }
            }
        }

        return `
            <div class="product-card" data-product-id="${id}" onclick="window.location.href='product.html?id=${id}'">
                <div class="product-image" style="cursor:pointer;">
                    ${badge}
                    <img src="${image}" alt="${name}" onerror="this.src='../assets/images/placeholder.png'">
                </div>
                <div class="product-info">
                    <h5><a href="product.html?id=${id}">${name}</a></h5>
                    ${infoHtml}
                </div>
                ${stockHtml}
                ${actionHtml}
            </div>
        `;
    }

    renderPagination(pagination) {
        if (!pagination || pagination.pages <= 1) return;
        
        const currentPage = Number(pagination.page || this.filters.page || 1);
        const pages = Number(pagination.pages || pagination.total_pages || 1);
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(pages, currentPage + 2);
        let html = `<button class="page-btn" style="width:auto;" data-page="${Math.max(1, currentPage - 1)}">&larr; TRƯỚC</button>`;

        if (start > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (start > 2) html += `<span class="page-ellipsis">...</span>`;
        }

        for (let i = start; i <= end; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (end < pages) {
            if (end < pages - 1) html += `<span class="page-ellipsis">...</span>`;
            html += `<button class="page-btn" data-page="${pages}">${pages}</button>`;
        }

        html += `<button class="page-btn" style="width:auto;" data-page="${Math.min(pages, currentPage + 1)}">TIẾP THEO &rarr;</button>`;
        
        this.els.pagination.innerHTML = html;

        this.els.pagination.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const p = parseInt(e.currentTarget.getAttribute('data-page'));
                if (p && p !== this.filters.page) {
                    this.filters.page = p;
                    this.updateUrl();
                    this.loadProducts();
                    window.scrollTo({ top: 150, behavior: 'smooth' });
                }
            });
        });
    }

    async loadTopSearches() {
        const container = document.querySelector('.top-search-links');
        if (!container) return;

        try {
            const result = await catalogApi().get('products/top-searches', { limit: 10 });
            const keywords = result.data || [];
            if (keywords.length === 0) {
                container.innerHTML = '<span class="catalog-widget-loading">Chưa có tìm kiếm hàng đầu.</span>';
                return;
            }

            container.innerHTML = keywords.map((item) => {
                const keyword = escapeHtml(item.keyword);
                return `<a href="search.html?q=${encodeURIComponent(item.keyword)}" class="tag-item">${keyword}</a>`;
            }).join('');
        } catch (error) {
            console.error('[TagPage] Top searches error:', error);
            container.innerHTML = '<span class="catalog-widget-loading">Chưa tải được tìm kiếm hàng đầu.</span>';
        }
    }
}

// Khởi chạy
document.addEventListener('DOMContentLoaded', () => {
    new TagPage();
});
