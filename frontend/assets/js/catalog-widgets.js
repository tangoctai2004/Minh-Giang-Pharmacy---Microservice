/**
 * Dynamic catalog widgets used by shared client components.
 * Handles top searches and featured products wherever the components are included.
 */
(function initCatalogWidgets(global) {
    const DEFAULT_CATALOG_BASE = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '') + '/api/catalog';
    const initializedFeaturedSections = new WeakSet();
    const initializedTopSearchContainers = new WeakSet();
    let cachedTopSearches = null;
    let cachedFeaturedProducts = null;

    function trimSlash(value) {
        return String(value || '').replace(/\/+$/, '');
    }

    function catalogApi() {
        if (global.MGCatalogApi) return global.MGCatalogApi;
        const baseUrl = trimSlash(global.MG_CATALOG_API_BASE || DEFAULT_CATALOG_BASE);
        return {
            async get(path, params) {
                const url = new URL(`${baseUrl}/${String(path).replace(/^\/+/, '')}`);
                Object.entries(params || {}).forEach(([key, value]) => {
                    if (value === undefined || value === null || value === '') return;
                    url.searchParams.set(key, value);
                });
                const response = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            }
        };
    }

    function escapeHtml(value) {
        if (global.MGClientApi && typeof global.MGClientApi.escapeHtml === 'function') {
            return global.MGClientApi.escapeHtml(value);
        }
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderProductCard(product) {
        if (global.MGClientApi && typeof global.MGClientApi.renderProductCard === 'function') {
            return global.MGClientApi.renderProductCard(product);
        }

        const id = Number(product.id || 0);
        const name = escapeHtml(product.name || 'Sản phẩm');
        const image = escapeHtml(product.thumbnail || product.image_url || '../assets/images/product_frame.png');
        const price = Number(product.retail_price || product.price || 0);
        const priceText = price ? new Intl.NumberFormat('vi-VN').format(Math.round(price)) + 'đ' : 'Liên hệ';
        const isRx = Boolean(Number(product.requires_prescription || 0));

        let infoHtml = `
            <div class="product-price"><span class="price-new">${priceText}</span></div>
        `;
        if (isRx) {
            infoHtml = `
                <div class="product-price">
                    <span class="price-new" style="font-size:14px;color:#6b7280;font-style:italic;">Cần tư vấn từ dược sỹ</span>
                </div>
            `;
        }

        let actionHtml = `<button class="btn-add-cart" onclick="window.addToCart ? addToCart(${id}, event) : (window.location.href='product.html?id=${id}')">Thêm giỏ hàng</button>`;
        if (isRx) {
            actionHtml = `<button class="btn-add-cart btn-consult" onclick="event.preventDefault(); event.stopPropagation(); window.location.href='product.html?id=${id}'">Tư vấn ngay</button>`;
        } else if (product.in_stock === false) {
            actionHtml = '<button class="btn-add-cart" disabled>Hết hàng</button>';
        }

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
                <div class="product-image" onclick="window.location.href='product.html?id=${id}'" style="cursor:pointer;">
                    <img src="${image}" alt="${name}" onerror="this.src='../assets/images/product_frame.png'">
                </div>
                <div class="product-info">
                    <h5><a href="product.html?id=${id}">${name}</a></h5>
                    ${infoHtml}
                    ${stockHtml}
                </div>
                ${actionHtml}
            </div>
        `;
    }

    async function loadTopSearches() {
        const containers = Array.from(document.querySelectorAll('.top-search-links'))
            .filter((container) => !initializedTopSearchContainers.has(container));
        if (!containers.length) return;

        try {
            if (!cachedTopSearches) {
                const result = await catalogApi().get('products/top-searches', { limit: 30, t: Date.now() });
                cachedTopSearches = Array.isArray(result.data) ? result.data : [];
            }
            const items = cachedTopSearches;
            if (!items.length) return;

            const html = items.map((item) => {
                const keyword = String(item.keyword || '').trim();
                if (!keyword) return '';
                return `<a href="search.html?q=${encodeURIComponent(keyword)}">${escapeHtml(keyword)}</a>`;
            }).join('');

            containers.forEach((container) => {
                container.innerHTML = html;
                initializedTopSearchContainers.add(container);
            });
        } catch (error) {
            console.error('[CatalogWidgets] Top searches error:', error);
        }
    }

    async function loadFeaturedProducts() {
        const sections = Array.from(document.querySelectorAll('.featured-products-section'))
            .filter((section) => !initializedFeaturedSections.has(section));
        if (!sections.length) return;

        try {
            if (!cachedFeaturedProducts) {
                const result = await catalogApi().get('products', {
                    limit: 15,
                    sort: 'trending',
                    requires_prescription: '0'
                });
                cachedFeaturedProducts = Array.isArray(result.data) ? result.data.slice(0, 15) : [];
            }
            const products = cachedFeaturedProducts;
            if (!products.length) return;

            sections.forEach((section) => {
                renderFeaturedCarousel(section, products);
                initializedFeaturedSections.add(section);
            });
        } catch (error) {
            console.error('[CatalogWidgets] Featured products error:', error);
        }
    }

    function renderFeaturedCarousel(section, products) {
        const oldGrid = section.querySelector('.product-grid, .featured-grid, .catalog-featured-viewport');
        if (!oldGrid) return;

        const viewport = document.createElement('div');
        viewport.className = 'catalog-featured-viewport';
        viewport.innerHTML = `
            <div class="catalog-featured-track">
                ${products.map(renderProductCard).join('')}
            </div>
        `;
        oldGrid.replaceWith(viewport);

        const track = viewport.querySelector('.catalog-featured-track');
        const buttons = section.querySelectorAll('.slider-btn, .catalog-featured-btn');
        viewport.style.overflow = 'hidden';
        viewport.style.width = '100%';
        track.style.display = 'flex';
        track.style.flexWrap = 'nowrap';
        track.style.gap = '16px';
        track.style.alignItems = 'stretch';
        track.style.transition = 'transform 0.35s ease';

        let index = 0;
        let timer = null;

        const visibleCount = () => {
            if (global.matchMedia('(max-width: 640px)').matches) return 1;
            if (global.matchMedia('(max-width: 900px)').matches) return 2;
            if (global.matchMedia('(max-width: 1200px)').matches) return 3;
            return 5;
        };

        const maxIndex = () => Math.max(0, products.length - visibleCount());
        const applyCardLayout = () => {
            const count = visibleCount();
            const basis = count === 1 ? '100%' : `calc((100% - ${(count - 1) * 16}px) / ${count})`;
            track.querySelectorAll('.product-card').forEach((card) => {
                card.style.flex = `0 0 ${basis}`;
                card.style.maxWidth = basis;
                card.style.minWidth = '0';
                card.style.boxSizing = 'border-box';
            });
            track.querySelectorAll('.product-image').forEach((imageBox) => {
                imageBox.style.height = '180px';
                imageBox.style.aspectRatio = 'auto';
                imageBox.style.display = 'flex';
                imageBox.style.alignItems = 'center';
                imageBox.style.justifyContent = 'center';
            });
        };
        const update = () => {
            applyCardLayout();
            const card = track.querySelector('.product-card');
            if (!card) return;
            const gap = Number.parseFloat(getComputedStyle(track).gap || '0') || 0;
            const step = card.getBoundingClientRect().width + gap;
            track.style.transform = `translateX(-${index * step}px)`;
        };

        const move = (direction) => {
            const max = maxIndex();
            if (max === 0) {
                index = 0;
            } else {
                index = direction > 0 ? index + 1 : index - 1;
                if (index > max) index = 0;
                if (index < 0) index = max;
            }
            update();
        };

        buttons.forEach((button, buttonIndex) => {
            button.type = 'button';
            button.innerHTML = `<i class="fa-solid fa-arrow-${buttonIndex === 0 ? 'left' : 'right'}"></i>`;
            button.setAttribute('aria-label', buttonIndex === 0 ? 'Sản phẩm trước' : 'Sản phẩm tiếp theo');
            button.addEventListener('click', (event) => {
                event.preventDefault();
                move(buttonIndex === 0 ? -1 : 1);
                restart();
            });
        });

        function restart() {
            if (timer) clearInterval(timer);
            timer = setInterval(() => move(1), 3200);
        }

        viewport.addEventListener('mouseenter', () => {
            if (timer) clearInterval(timer);
        });
        viewport.addEventListener('mouseleave', restart);
        global.addEventListener('resize', update);

        update();
        restart();
    }

    async function init(force = false) {
        if (force === true) {
            cachedTopSearches = null;
            document.querySelectorAll('.top-search-links').forEach(el => initializedTopSearchContainers.delete(el));
        }
        await Promise.all([loadTopSearches(), loadFeaturedProducts()]);
    }

    global.MGCatalogWidgets = { init };
    init();

    let observerTimer = null;
    const observer = new MutationObserver(() => {
        if (observerTimer) clearTimeout(observerTimer);
        observerTimer = setTimeout(init, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})(window);
