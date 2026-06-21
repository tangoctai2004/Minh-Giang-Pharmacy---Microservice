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

class ProductCarousel {
    constructor(idPrefix, totalItems) {
        this.track = document.getElementById(`pd${idPrefix}Products`) || document.getElementById(`pdRecently${idPrefix}`);
        this.btnPrev = document.getElementById(`btnPrev${idPrefix}`);
        this.btnNext = document.getElementById(`btnNext${idPrefix}`);
        
        if (!this.track || !this.btnPrev || !this.btnNext) return;

        this.totalItems = totalItems;
        this.itemsPerView = 5;
        this.currentIndex = 0;
        this.maxIndex = Math.max(0, this.totalItems - this.itemsPerView);
        this.init();
    }

    init() {
        this.updateButtons();
        
        this.btnPrev.addEventListener('click', () => {
            this.currentIndex = Math.max(0, this.currentIndex - this.itemsPerView);
            this.updateTrack();
        });

        this.btnNext.addEventListener('click', () => {
            this.currentIndex = Math.min(this.maxIndex, this.currentIndex + this.itemsPerView);
            this.updateTrack();
        });

        this.startAutoPlay();
    }

    updateTrack() {
        const itemNode = this.track.children[0];
        if (!itemNode) return;
        const itemTotalWidth = itemNode.offsetWidth + 15; 
        this.track.style.transform = `translateX(-${this.currentIndex * itemTotalWidth}px)`;
        this.updateButtons();
    }

    updateButtons() {
        if (this.totalItems <= this.itemsPerView) {
            this.btnPrev.style.display = 'none';
            this.btnNext.style.display = 'none';
        } else {
            this.btnPrev.style.display = 'flex';
            this.btnNext.style.display = 'flex';
            this.btnPrev.disabled = this.currentIndex <= 0;
            this.btnNext.disabled = this.currentIndex >= this.maxIndex;
        }
    }

    startAutoPlay() {
        this.interval = setInterval(() => {
            if (this.currentIndex >= this.maxIndex) {
                this.currentIndex = 0;
            } else {
                this.currentIndex = Math.min(this.maxIndex, this.currentIndex + this.itemsPerView);
            }
            this.updateTrack();
        }, 5000);

        this.track.parentElement.addEventListener('mouseenter', () => clearInterval(this.interval));
        this.track.parentElement.addEventListener('mouseleave', () => this.startAutoPlay());
    }
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
        { selector: '[data-home-products="flash-sale"]', params: { sort: 'popular', limit: 15, requires_prescription: '0' } },
        { selector: '[data-home-products="deal"]', params: { sort: 'trending', limit: 15, requires_prescription: '0' } },
        { selector: '[data-home-products="best-seller"]', params: { sort: 'best_seller', limit: 15, requires_prescription: '0' } },
        { selector: '[data-home-products="discount"]', params: { sort: 'price_desc', limit: 15, requires_prescription: '0' } },
        { selector: '[data-home-products="exclusive"]', params: { sort: 'newest', limit: 15, requires_prescription: '0' } },
        { selector: '[data-home-products="imported"]', params: { sort: 'popular', limit: 15, requires_prescription: '0' } },
        { selector: '[data-home-products="trending"]', params: { sort: 'trending', limit: 15, requires_prescription: '0' } }
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
        let tags = [];
        if (product.tags) {
            try {
                tags = Array.isArray(product.tags) ? product.tags : JSON.parse(product.tags);
            } catch (e) { }
        }

        let badge = product.discount_percent > 0
            ? `<span class="discount-badge">-${Number(product.discount_percent)}%</span>`
            : '';

        if (!badge && tags && tags.length > 0) {
            if (tags.includes('exclusive')) {
                badge = `<span class="discount-badge" style="background:#d97706; color:#fff;">Độc quyền</span>`;
            } else if (tags.includes('imported')) {
                badge = `<span class="discount-badge" style="background:#059669; color:#fff;">Nhập khẩu</span>`;
            } else if (tags.includes('flash-sale')) {
                badge = `<span class="discount-badge" style="background:#dc2626; color:#fff;"><i class="fa-solid fa-bolt"></i> Flash Sale</span>`;
            } else if (tags.includes('best-seller')) {
                badge = `<span class="discount-badge" style="background:#2563eb; color:#fff;">Bán chạy</span>`;
            }
        }

        let action = `<button class="btn-add-cart" onclick="window.addToCart ? addToCart(${id}, event) : (window.location.href='product.html?id=${id}')">Thêm giỏ hàng</button>`;
        if (isRx) {
            action = `<button class="btn-add-cart btn-consult" onclick="event.preventDefault(); event.stopPropagation(); window.location.href='product.html?id=${id}'">Tư vấn ngay</button>`;
        } else if (!inStock) {
            action = '<button class="btn-add-cart" disabled>Hết hàng</button>';
        }

        const priceHtml = isRx
            ? '<span class="price-new catalog-rx-note">Cần tư vấn dược sĩ</span>'
            : `<span class="price-new">${price}<small>${unit}</small></span>`;

        const stockQty = Number(product.total_stock ?? product.available_stock ?? 0);
        let stockHtml = '';
        if (!isRx) {
            if (stockQty > 0) {
                stockHtml = '';
            } else {
                stockHtml = `<div class="product-stock-badge" style="font-size: 11px; color: #9ca3af; font-weight: 600; margin-top: 4px; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-boxes-stacked"></i> Hết hàng</div>`;
            }
        }

        return `
            <div class="product-card" data-product-id="${id}">
                <div class="product-image">
                    ${badge}
                    <img src="${image}" alt="${name}" loading="lazy" onerror="this.src='../assets/images/placeholder.png'">
                </div>
                <div class="product-info">
                    <h5><a href="product.html?id=${id}">${name}</a></h5>
                    <div class="product-price">${priceHtml}</div>
                    ${stockHtml}
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
            const carouselMapping = {
                '[data-home-products="flash-sale"]': 'FlashSale',
                '[data-home-products="deal"]': 'Deal',
                '[data-home-products="best-seller"]': 'BestSeller',
                '[data-home-products="discount"]': 'Discount',
                '[data-home-products="exclusive"]': 'Exclusive',
                '[data-home-products="imported"]': 'Imported',
                '[data-home-products="trending"]': 'Trending'
            };
            const prefix = carouselMapping[section.selector];
            if (prefix) {
                new ProductCarousel(prefix, products.length);
            }
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

    async loadBanners() {
        try {
            const gateway = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');

            const resolveImg = (url) => {
                if (!url) return '';
                if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
                    return url;
                }
                if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
                    const cleanPath = url.startsWith('/') ? url : '/' + url;
                    return gateway + cleanPath;
                }
                return url;
            };

            // 1. Fetch hero slides
            const heroRes = await fetch(`${gateway}/api/cms/banners?position=hero&t=${Date.now()}`);
            if (heroRes.ok) {
                const res = await heroRes.json();
                if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                    const banners = res.data;
                    const sliderImages = document.getElementById('heroSliderImages');
                    const sliderDots = document.getElementById('heroSliderDots');

                    if (sliderImages && sliderDots) {
                        sliderImages.innerHTML = banners.map((b) => {
                            const url = b.link_url ? b.link_url : '#';
                            const resolvedImgUrl = resolveImg(b.image_url);
                            return `<img src="${resolvedImgUrl}" alt="${this.escape(b.title)}" class="main-slide" onclick="window.location.href='${url}'" style="cursor:pointer;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;100&quot; height=&quot;100&quot; viewBox=&quot;0 0 100 100&quot;><rect width=&quot;100&quot; height=&quot;100&quot; fill=&quot;%23f1f5f9&quot;/><text x=&quot;50%&quot; y=&quot;50%&quot; dominant-baseline=&quot;middle&quot; text-anchor=&quot;middle&quot; font-family=&quot;sans-serif&quot; font-size=&quot;10&quot; fill=&quot;%2394a3b8&quot;>No Image</text></svg>';">`;
                        }).join('');

                        sliderDots.innerHTML = banners.map((_, index) => {
                            return `<span class="dot ${index === 0 ? 'active' : ''}" onclick="currentSlide(${index})"></span>`;
                        }).join('');

                        if (typeof window.initSlider === 'function') {
                            window.initSlider();
                        }
                    }
                }
            }

            // 2. Fetch side banners
            const sideRes = await fetch(`${gateway}/api/cms/banners?position=sidebar&t=${Date.now()}`);
            if (sideRes.ok) {
                const res = await sideRes.json();
                if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                    const sideBanners = res.data;
                    const container = document.querySelector('.hero-side-banners');
                    if (container) {
                        container.innerHTML = sideBanners.slice(0, 2).map((b) => {
                            const url = b.link_url ? b.link_url : '#';
                            const resolvedImgUrl = resolveImg(b.image_url);
                            return `
                                <a href="${url}" class="side-banner">
                                    <img src="${resolvedImgUrl}" alt="${this.escape(b.title)}">
                                </a>
                            `;
                        }).join('');
                    }
                }
            }

            // 3. Fetch popup banner
            if (sessionStorage.getItem('mg_popup_ad_shown') !== 'true') {
                const popupRes = await fetch(`${gateway}/api/cms/banners?position=popup&t=${Date.now()}`);
                if (popupRes.ok) {
                    const res = await popupRes.json();
                    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                        const popupAd = res.data.find(b => b.is_active !== 0);
                        if (popupAd) {
                            popupAd.image_url = resolveImg(popupAd.image_url);
                            showPopupAdModal(popupAd);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[HomeCatalog] Banners error:', error);
        }
    },

    setupLazyLoadSections() {
        if (!('IntersectionObserver' in window)) {
            // Fallback cho trình duyệt cũ
            this.productSections.forEach(section => this.loadProductSection(section));
            return;
        }

        const observerOptions = {
            root: null,
            rootMargin: '200px 0px', // Load trước khi cuộn tới cách 200px
            threshold: 0.01
        };

        const observer = new IntersectionObserver((entries, self) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const targetElement = entry.target;
                    const selector = targetElement.getAttribute('data-selector');
                    const section = this.productSections.find(s => s.selector === selector);
                    if (section) {
                        this.loadProductSection(section);
                    }
                    self.unobserve(targetElement); // Chỉ load 1 lần duy nhất
                }
            });
        }, observerOptions);

        this.productSections.forEach(section => {
            const gridElement = document.querySelector(section.selector);
            if (gridElement) {
                const parentSection = gridElement.closest('.product-section');
                if (parentSection) {
                    parentSection.setAttribute('data-selector', section.selector);
                    observer.observe(parentSection);
                } else {
                    gridElement.setAttribute('data-selector', section.selector);
                    observer.observe(gridElement);
                }
            }
        });
    },

    async init() {
        this.setInitialLoadingState();

        // Load dynamic configuration to map homepage sections to tag filters
        try {
            let config = {};
            if (typeof window.getStoreConfig === 'function') {
                config = await window.getStoreConfig();
            } else if (window.MGClientApi && typeof window.MGClientApi.getStoreConfig === 'function') {
                config = await window.MGClientApi.getStoreConfig();
            }

            const tagMap = {
                'flash-sale': config.layout_home_tag_flash_sale ?? 'flash-sale',
                'deal': config.layout_home_tag_deal ?? 'deal',
                'best-seller': config.layout_home_tag_best_seller ?? 'best-seller',
                'discount': config.layout_home_tag_discount ?? 'discount',
                'exclusive': config.layout_home_tag_exclusive ?? 'exclusive',
                'imported': config.layout_home_tag_imported ?? 'imported'
            };

            this.productSections.forEach(section => {
                const sectionName = section.selector.match(/"([^"]+)"/)?.[1] || '';
                const mappedTag = tagMap[sectionName];
                if (mappedTag) {
                    section.params.tag = mappedTag;
                } else if (mappedTag === '') {
                    delete section.params.tag;
                }

                // Cập nhật link "Xem tất cả" động cho trang tag.html
                const parentSection = document.querySelector(`[data-home-section="${sectionName}"]`);
                if (parentSection) {
                    const viewAllBtn = parentSection.querySelector('.view-all-btn');
                    if (viewAllBtn) {
                        if (mappedTag) {
                            viewAllBtn.href = `tag.html?tag=${encodeURIComponent(mappedTag)}&title=${encodeURIComponent(sectionName)}`;
                        } else {
                            viewAllBtn.style.display = 'none';
                        }
                    }
                }
            });
        } catch (err) {
            console.error('[HomeCatalog] Failed to load storefront configurations:', err);
        }

        // Load active promotions in parallel
        const promoPromise = this.loadActivePromotions().catch(() => {});
        await promoPromise;

        // Kích hoạt lazy load các phần sản phẩm theo hành vi cuộn chuột ngay lập tức
        this.setupLazyLoadSections();

        // Tải các phần nội dung phụ khác ở background (không block tiến trình hiển thị sản phẩm)
        Promise.all([
            this.loadCategories(),
            this.loadTopSearches(),
            this.loadBanners()
        ]).catch(err => {
            console.error('[HomeCatalog] Background tasks failed:', err);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    homeCatalog.init();
});

function showPopupAdModal(ad) {
    const style = document.createElement('style');
    style.textContent = `
        .popup-ad-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(5px);
            z-index: 100001;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        .popup-ad-overlay.open {
            opacity: 1;
            visibility: visible;
        }
        .popup-ad-container {
            position: relative;
            max-width: 650px;
            width: 90%;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            transform: scale(0.9);
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .popup-ad-overlay.open .popup-ad-container {
            transform: scale(1);
        }
        .popup-ad-img {
            width: 100%;
            display: block;
            object-fit: cover;
        }
        .popup-ad-close {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.6);
            color: #fff;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s;
            backdrop-filter: blur(4px);
        }
        .popup-ad-close:hover {
            background: rgba(15, 23, 42, 0.85);
            transform: rotate(90deg);
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'popup-ad-overlay';

    const url = ad.link_url ? ad.link_url : '#';
    overlay.innerHTML = `
        <div class="popup-ad-container">
            <button class="popup-ad-close" onclick="closePopupAdModal(this)"><i class="fa-solid fa-xmark"></i></button>
            <a href="${url}">
                <img src="${ad.image_url}" class="popup-ad-img" alt="${ad.title || 'Quảng cáo'}">
            </a>
        </div>
    `;

    document.body.appendChild(overlay);
    sessionStorage.setItem('mg_popup_ad_shown', 'true');

    setTimeout(() => {
        overlay.classList.add('open');
    }, 1000);

    window.closePopupAdModal = function (btn) {
        const modal = btn.closest('.popup-ad-overlay');
        if (modal) {
            modal.classList.remove('open');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    };
}
