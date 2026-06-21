/**
 * Script điều khiển trang Danh mục (Category Page)
 * Tự động tải Danh mục con, Bộ lọc (Filters), và Danh sách sản phẩm.
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

function toList(value) {
    return value ? String(value).split(',').filter(Boolean) : [];
}

class CategoryPage {
    constructor() {
        this.params = new URLSearchParams(window.location.search);
        this.categoryId = this.params.get('id') || 1000; // Default to Thuốc (ID: 1000)
        
        // Filter States
        this.filters = {
            category_id: this.categoryId,
            page: Math.max(1, Number(this.params.get('page')) || 1),
            limit: Number(this.params.get('limit')) || 28,
            sort: this.params.get('sort') || 'popular',
            requires_prescription: this.params.has('rx') ? this.params.get('rx') : '',
            price_min: this.params.get('price_min'),
            price_max: this.params.get('price_max'),
            brand_ids: toList(this.params.get('brand_ids')),
            origins: toList(this.params.get('origins')),
            indications: []
        };

        // DOM Elements
        this.els = {
            breadcrumb: document.getElementById('catBreadcrumb'),
            title: document.getElementById('mainCategoryTitle'),
            subCatGrid: document.getElementById('subCategoriesGrid'),
            subCatsWrapper: document.getElementById('subCatsWrapper'),
            btnViewMoreSub: document.getElementById('btnViewMoreSubcats'),
            tabAll: document.getElementById('tabAllProducts'),
            tabNonRx: document.getElementById('tabNonRxProducts'),
            tabRx: document.getElementById('tabRxProducts'),
            
            sortSelect: document.getElementById('sortSelect'),
            limitSelect: document.getElementById('limitSelect'),
            
            productList: document.getElementById('productList'),
            loading: document.getElementById('loadingProducts'),
            empty: document.getElementById('emptyProducts'),
            pagination: document.getElementById('paginationBox'),
            
            priceBlock: document.getElementById('catPriceBlock'),
            searchBrand: document.getElementById('searchBrand'),
            searchOrigin: document.getElementById('searchOrigin'),
            listBrand: document.getElementById('listBrand'),
            listOrigin: document.getElementById('listOrigin')
        };

        this.syncControlsFromUrl();
        this.init();
    }

    syncControlsFromUrl() {
        if (this.els.sortSelect) this.els.sortSelect.value = this.filters.sort;
        if (this.els.limitSelect) this.els.limitSelect.value = String(this.filters.limit);
        document.querySelectorAll('.cat-tab-btn').forEach(btn => {
            btn.classList.toggle('active', (btn.getAttribute('data-rx') || '') === (this.filters.requires_prescription || ''));
        });
        if (this.els.priceBlock && this.filters.price_min !== null) {
            this.els.priceBlock.querySelectorAll('.price-block-btn').forEach(btn => {
                const matchMin = (btn.getAttribute('data-min') || '') === (this.filters.price_min || '');
                const matchMax = (btn.getAttribute('data-max') || '') === (this.filters.price_max || '');
                btn.classList.toggle('active', matchMin && matchMax);
            });
        }
    }

    updateUrl() {
        const params = new URLSearchParams();
        params.set('id', this.filters.category_id);
        if (Number(this.filters.page) > 1) params.set('page', this.filters.page);
        if (String(this.filters.sort) !== 'popular') params.set('sort', this.filters.sort);
        if (Number(this.filters.limit) !== 28) params.set('limit', this.filters.limit);
        if (this.filters.requires_prescription === '0' || this.filters.requires_prescription === '1') {
            params.set('rx', this.filters.requires_prescription);
        }
        if (this.filters.price_min) params.set('price_min', this.filters.price_min);
        if (this.filters.price_max) params.set('price_max', this.filters.price_max);
        if (this.filters.brand_ids.length > 0) params.set('brand_ids', this.filters.brand_ids.join(','));
        if (this.filters.origins.length > 0) params.set('origins', this.filters.origins.join(','));
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }

    async init() {
        this.bindEvents();
        
        // Parallel fetching
        await Promise.all([
            this.loadCategoryTree(),
            this.loadFilters(),
            this.loadProducts()
        ]);
    }

    bindEvents() {
        // Toggles cho sidebar (Collapse/Expand)
        document.querySelectorAll('[data-toggle]').forEach(el => {
            el.addEventListener('click', () => {
                const target = document.getElementById(el.getAttribute('data-toggle'));
                const icon = el.querySelector('i');
                if (target.style.display === 'none') {
                    target.style.display = 'block';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                } else {
                    target.style.display = 'none';
                    if (icon) icon.style.transform = 'rotate(180deg)';
                }
            });
        });

        // Toggle subcategories
        if (this.els.btnViewMoreSub) {
            this.els.btnViewMoreSub.addEventListener('click', () => {
                this.els.btnViewMoreSub.classList.toggle('expanded');
                if (this.currentCategoryChildren) {
                    this.renderSubCategories(this.currentCategoryChildren);
                }
            });
        }

        // Tabs
        [this.els.tabAll, this.els.tabNonRx, this.els.tabRx].forEach(tab => {
            if (!tab) return;
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.cat-tab-btn').forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filters.requires_prescription = e.currentTarget.getAttribute('data-rx') || '';
                this.filters.page = 1;
                this.updateUrl();
                this.loadProducts();
            });
        });

        // Sort & Limit
        if (this.els.sortSelect) {
            this.els.sortSelect.addEventListener('change', (e) => {
                this.filters.sort = e.target.value;
                this.filters.page = 1;
                this.updateUrl();
                this.loadProducts();
            });
        }
        if (this.els.limitSelect) {
            this.els.limitSelect.addEventListener('change', (e) => {
                this.filters.limit = e.target.value;
                this.filters.page = 1;
                this.updateUrl();
                this.loadProducts();
            });
        }

        // Price Blocks
        if (this.els.priceBlock) {
            this.els.priceBlock.addEventListener('click', (e) => {
                if (e.target.classList.contains('price-block-btn')) {
                    const isActive = e.target.classList.contains('active');
                    this.els.priceBlock.querySelectorAll('.price-block-btn').forEach(b => b.classList.remove('active'));
                    
                    if (isActive) {
                        this.filters.price_min = null;
                        this.filters.price_max = null;
                    } else {
                        e.target.classList.add('active');
                        this.filters.price_min = e.target.getAttribute('data-min') || null;
                        this.filters.price_max = e.target.getAttribute('data-max') || null;
                    }
                    this.filters.page = 1;
                    this.updateUrl();
                    this.loadProducts();
                }
            });
        }

        // Live Search for Filters
        this.setupLiveSearch(this.els.searchBrand, this.els.listBrand);
        this.setupLiveSearch(this.els.searchOrigin, this.els.listOrigin);
    }

    setupLiveSearch(inputEl, listEl) {
        if (!inputEl || !listEl) return;
        inputEl.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            Array.from(listEl.children).forEach(li => {
                const label = li.textContent.toLowerCase();
                li.style.display = label.includes(query) ? 'flex' : 'none';
            });
        });
    }

    async loadCategoryTree() {
        try {
            const json = await catalogApi().get('categories/tree');
            if (json.success) {
                const tree = json.data;
                const path = this.findCategoryPathInTree(tree, Number(this.categoryId));
                if (path && path.length > 0) {
                    const current = path[path.length - 1];
                    if (this.els.title) this.els.title.textContent = current.name;
                    document.title = `${current.name} — Nhà Thuốc Minh Giang`;
                    
                    // Nạp Breadcrumb động
                    if (this.els.breadcrumb) {
                        let html = `<a href="index.html">Trang chủ</a>`;
                        path.forEach((cat, index) => {
                            html += ` <span>›</span> `;
                            if (index === path.length - 1) {
                                html += `<strong style="color:#1f2937;">${escapeHtml(cat.name)}</strong>`;
                            } else {
                                html += `<a href="category.html?id=${cat.id}">${escapeHtml(cat.name)}</a>`;
                            }
                        });
                        this.els.breadcrumb.innerHTML = html;
                    }

                    if (current.children && current.children.length > 0) {
                        this.currentCategoryChildren = current.children;
                        if (this.els.subCatsWrapper) this.els.subCatsWrapper.style.display = 'block';
                        this.renderSubCategories(current.children);
                    } else {
                        if (this.els.subCatsWrapper) this.els.subCatsWrapper.style.display = 'none';
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    findCategoryInTree(tree, id) {
        for (let node of tree) {
            if (node.id === id) return node;
            if (node.children) {
                const found = this.findCategoryInTree(node.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    findCategoryPathInTree(tree, id, path = []) {
        for (let node of tree) {
            const currentPath = [...path, node];
            if (node.id === id) return currentPath;
            if (node.children) {
                const found = this.findCategoryPathInTree(node.children, id, currentPath);
                if (found) return found;
            }
        }
        return null;
    }

    renderSubCategories(children) {
        if (!this.els.subCatGrid) return;
        
        // Random icons cho giống mẫu
        const icons = ['fa-pills', 'fa-capsules', 'fa-prescription-bottle-medical', 'fa-heart-pulse', 'fa-lungs', 'fa-tooth', 'fa-eye', 'fa-brain'];
        
        const isExpanded = this.els.btnViewMoreSub && this.els.btnViewMoreSub.classList.contains('expanded');
        const displayLimit = isExpanded ? children.length : 9;
        
        const html = children.slice(0, displayLimit).map((c, i) => `
            <a href="category.html?id=${c.id}" class="subcat-card">
                <div class="subcat-icon"><i class="fa-solid ${icons[i % icons.length]}"></i></div>
                <span>${escapeHtml(c.name)}</span>
            </a>
        `).join('');
        
        this.els.subCatGrid.innerHTML = html;

        if (children.length > 9) {
            this.els.btnViewMoreSub.style.display = 'block';
            this.els.btnViewMoreSub.innerHTML = isExpanded ? '<i class="fa-solid fa-chevron-up"></i> Thu gọn' : '<i class="fa-solid fa-chevron-down"></i> Xem thêm danh mục';
        } else {
            if (this.els.btnViewMoreSub) this.els.btnViewMoreSub.style.display = 'none';
        }
    }

    async loadFilters() {
        try {
            const json = await catalogApi().get('products/filters', { category_id: this.categoryId });
            
            if (json.success && json.data) {
                const { brands, origins, rx_count, non_rx_count } = json.data;
                
                this.renderFilterList(this.els.listBrand, brands, 'brand_ids');
                this.renderFilterList(this.els.listOrigin, origins, 'origins', 'name'); // Origin is string

                if (this.els.tabNonRx && non_rx_count !== undefined) {
                    this.els.tabNonRx.textContent = `Thuốc không kê đơn (${non_rx_count})`;
                }
                if (this.els.tabRx && rx_count !== undefined) {
                    this.els.tabRx.textContent = `Thuốc kê đơn (${rx_count})`;
                }
                if (this.els.tabAll) {
                    this.els.tabAll.textContent = `Tất cả (${Number(non_rx_count || 0) + Number(rx_count || 0)})`;
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    renderFilterList(container, items, filterKey, valKey = 'id') {
        if (!container || !items) return;
        
        container.innerHTML = items.map((item, i) => {
            const id = `flt_${filterKey}_${i}`;
            const val = item[valKey];
            const checked = this.filters[filterKey].includes(String(val)) ? 'checked' : '';
            return `
                <li>
                    <input type="checkbox" id="${id}" value="${escapeHtml(val)}" ${checked}>
                    <label for="${id}">${escapeHtml(item.name || item.val)} (${Number(item.count || 0)})</label>
                </li>
            `;
        }).join('');

        // Listen for changes
        container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', () => {
                const checked = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
                this.filters[filterKey] = checked;
                this.filters.page = 1;
                this.updateUrl();
                this.loadProducts();
            });
        });
    }

    async loadProducts() {
        if (this.els.loading) this.els.loading.style.display = 'block';
        if (this.els.productList) this.els.productList.style.display = 'none';
        if (this.els.empty) this.els.empty.style.display = 'none';
        if (this.els.pagination) this.els.pagination.innerHTML = '';

        try {
            const json = await catalogApi().get('products', {
                category_id: this.filters.category_id,
                page: this.filters.page,
                limit: this.filters.limit,
                sort: this.filters.sort,
                price_min: this.filters.price_min,
                price_max: this.filters.price_max,
                brand_ids: this.filters.brand_ids,
                origins: this.filters.origins,
                indications: this.filters.indications,
                requires_prescription: this.filters.requires_prescription || undefined
            });
            
            if (json.success && json.data) {
                let data = json.data;

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
            infoHtml = `<div class="product-price" style="min-height:20px;"><span class="price-new" style="color:#ea580c; font-weight:700;">${priceFmt}</span></div>`;
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

        // Tái sử dụng thẻ sản phẩm chuẩn của Minh Giang Pharmacy
        return `
            <div class="product-card" data-product-id="${id}">
                <div class="product-image" onclick="window.location.href='product.html?id=${id}'" style="cursor:pointer;">
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
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                }
            });
        });
    }
}

// Khởi chạy
document.addEventListener('DOMContentLoaded', () => {
    new CategoryPage();
});
