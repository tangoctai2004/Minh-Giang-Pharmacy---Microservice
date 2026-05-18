/**
 * Script điều khiển trang Danh mục (Category Page)
 * Tự động tải Danh mục con, Bộ lọc (Filters), và Danh sách sản phẩm.
 */

class CategoryPage {
    constructor() {
        this.apiBase = 'http://localhost:8000/api/catalog';
        this.params = new URLSearchParams(window.location.search);
        this.categoryId = this.params.get('id') || 1000; // Default to Thuốc (ID: 1000)
        
        // Filter States
        this.filters = {
            category_id: this.categoryId,
            page: 1,
            limit: 28,
            sort: 'popular',
            requires_prescription: '0',
            price_min: null,
            price_max: null,
            brand_ids: [],
            origins: [],
            indications: []
        };

        // DOM Elements
        this.els = {
            title: document.getElementById('mainCategoryTitle'),
            subCatGrid: document.getElementById('subCategoriesGrid'),
            subCatsWrapper: document.getElementById('subCatsWrapper'),
            btnViewMoreSub: document.getElementById('btnViewMoreSubcats'),
            tabNonRx: document.getElementById('tabNonRxProducts'),
            tabRx: document.getElementById('tabRxProducts'),
            
            sortSelect: document.getElementById('sortSelect'),
            limitSelect: document.getElementById('limitSelect'),
            
            productList: document.getElementById('productList'),
            loading: document.getElementById('loadingProducts'),
            empty: document.getElementById('emptyProducts'),
            pagination: document.getElementById('paginationBox'),
            
            priceBlock: document.getElementById('catPriceBlock'),
            listBrand: document.getElementById('listBrand'),
            listOrigin: document.getElementById('listOrigin')
        };

        this.init();
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
        [this.els.tabNonRx, this.els.tabRx].forEach(tab => {
            if (!tab) return;
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.cat-tab-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.filters.requires_prescription = e.target.getAttribute('data-rx');
                this.filters.page = 1;
                this.loadProducts();
            });
        });

        // Sort & Limit
        if (this.els.sortSelect) {
            this.els.sortSelect.addEventListener('change', (e) => {
                this.filters.sort = e.target.value;
                this.filters.page = 1;
                this.loadProducts();
            });
        }
        if (this.els.limitSelect) {
            this.els.limitSelect.addEventListener('change', (e) => {
                this.filters.limit = e.target.value;
                this.filters.page = 1;
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
            const res = await fetch(`${this.apiBase}/categories/tree`);
            const json = await res.json();
            if (json.success) {
                // Find current category
                const tree = json.data;
                const current = this.findCategoryInTree(tree, Number(this.categoryId));
                if (current) {
                    this.els.title.textContent = current.name;
                    document.title = `${current.name} — Nhà Thuốc Minh Giang`;
                    
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

    renderSubCategories(children) {
        if (!this.els.subCatGrid) return;
        
        // Random icons cho giống mẫu
        const icons = ['fa-pills', 'fa-capsules', 'fa-prescription-bottle-medical', 'fa-heart-pulse', 'fa-lungs', 'fa-tooth', 'fa-eye', 'fa-brain'];
        
        const isExpanded = this.els.btnViewMoreSub && this.els.btnViewMoreSub.classList.contains('expanded');
        const displayLimit = isExpanded ? children.length : 9;
        
        const html = children.slice(0, displayLimit).map((c, i) => `
            <a href="category.html?id=${c.id}" class="subcat-card">
                <div class="subcat-icon"><i class="fa-solid ${icons[i % icons.length]}"></i></div>
                <span>${c.name}</span>
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
            const res = await fetch(`${this.apiBase}/products/filters?category_id=${this.categoryId}`);
            const json = await res.json();
            
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
            return `
                <li>
                    <input type="checkbox" id="${id}" value="${val}">
                    <label for="${id}">${item.name || item.val} (${item.count})</label>
                </li>
            `;
        }).join('');

        // Listen for changes
        container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', () => {
                const checked = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
                this.filters[filterKey] = checked;
                this.filters.page = 1;
                this.loadProducts();
            });
        });
    }

    async loadProducts() {
        this.els.loading.style.display = 'block';
        this.els.productList.style.display = 'none';
        this.els.empty.style.display = 'none';
        this.els.pagination.innerHTML = '';

        try {
            let url = `${this.apiBase}/products?category_id=${this.filters.category_id}&page=${this.filters.page}&limit=${this.filters.limit}&sort=${this.filters.sort}`;
            
            if (this.filters.price_min) url += `&price_min=${this.filters.price_min}`;
            if (this.filters.price_max) url += `&price_max=${this.filters.price_max}`;
            if (this.filters.brand_ids.length > 0) url += `&brand_ids=${this.filters.brand_ids.join(',')}`;
            if (this.filters.origins.length > 0) url += `&origins=${this.filters.origins.join(',')}`;
            if (this.filters.indications.length > 0) url += `&indications=${this.filters.indications.join(',')}`;
            if (this.filters.requires_prescription) url += `&requires_prescription=${this.filters.requires_prescription}`;

            const res = await fetch(url);
            const json = await res.json();
            
            if (json.success && json.data) {
                let data = json.data;

                if (data.length > 0) {
                    this.els.productList.innerHTML = data.map(p => this.createProductCard(p)).join('');
                    this.els.productList.style.display = 'grid';
                    this.renderPagination(json.pagination);
                } else {
                    this.els.empty.style.display = 'block';
                }
            }
        } catch (e) {
            console.error(e);
            this.els.empty.style.display = 'block';
        } finally {
            this.els.loading.style.display = 'none';
        }
    }

    createProductCard(p) {
        const priceFmt = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.retail_price);
        
        let actionHtml = '';
        let infoHtml = '';

        if (p.requires_prescription) {
            infoHtml = `<div class="product-contact-note" style="color:#6b7280; font-size:13px; font-weight:500; height: 20px;">Cần tư vấn từ dược sỹ</div>`;
            actionHtml = `<button class="btn-add-cart" style="background:#0b7a3e; color:#fff; border:none; width:100%; padding:10px 16px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#096532'" onmouseout="this.style.background='#0b7a3e'" onclick="window.location.href='product.html?id=${p.id}'">Tư vấn ngay</button>`;
        } else {
            infoHtml = `<div class="product-price" style="height: 20px;"><span class="price-new" style="color:#ea580c; font-weight:700;">${priceFmt}</span></div>`;
            actionHtml = `<button class="btn-add-cart" style="background:#0b7a3e; color:#fff; border:none; width:100%; padding:10px 16px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#096532'" onmouseout="this.style.background='#0b7a3e'" onclick="addToCart(${p.id}, event)">Thêm giỏ hàng</button>`;
        }

        // Tái sử dụng thẻ sản phẩm chuẩn của Minh Giang Pharmacy
        return `
            <div class="product-card">
                <div class="product-image" onclick="window.location.href='product.html?id=${p.id}'" style="cursor:pointer;">
                    <img src="${p.thumbnail || p.image_url || '../assets/images/placeholder.png'}" alt="${p.name}">
                </div>
                <div class="product-info">
                    <h5><a href="product.html?id=${p.id}">${p.name}</a></h5>
                    ${infoHtml}
                </div>
                ${actionHtml}
            </div>
        `;
    }

    renderPagination(pagination) {
        if (!pagination || pagination.pages <= 1) return;
        
        let html = `<button class="page-btn" style="width:auto;" data-page="${Math.max(1, pagination.page - 1)}">&larr; TRƯỚC</button>`;
        
        for (let i = 1; i <= pagination.pages; i++) {
            html += `<button class="page-btn ${i === pagination.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        html += `<button class="page-btn" style="width:auto;" data-page="${Math.min(pagination.pages, pagination.page + 1)}">TIẾP THEO &rarr;</button>`;
        
        this.els.pagination.innerHTML = html;

        this.els.pagination.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const p = parseInt(e.currentTarget.getAttribute('data-page'));
                if (p && p !== this.filters.page) {
                    this.filters.page = p;
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
