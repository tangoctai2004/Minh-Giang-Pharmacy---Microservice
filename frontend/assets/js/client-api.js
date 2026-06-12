/**
 * Shared API helpers for client pages.
 * Keeps public Catalog calls in one place so pages do not hard-code URLs.
 */
(function initClientApi(global) {
    const DEFAULT_GATEWAY_ORIGIN = 'http://localhost:8000';

    function trimSlash(value) {
        return String(value || '').replace(/\/+$/, '');
    }

    function resolveGatewayOrigin() {
        if (global.MG_API_GATEWAY_ORIGIN) {
            return trimSlash(global.MG_API_GATEWAY_ORIGIN);
        }

        const origin = global.location && global.location.origin;
        if (!origin || origin === 'null') return DEFAULT_GATEWAY_ORIGIN;

        const isStaticPreview = origin && (
            origin.includes('localhost:5500') ||
            origin.includes('localhost:5501') ||
            origin.includes('127.0.0.1:5500') ||
            origin.includes('127.0.0.1:5501')
        );

        return isStaticPreview ? DEFAULT_GATEWAY_ORIGIN : trimSlash(origin || DEFAULT_GATEWAY_ORIGIN);
    }

    function buildUrl(basePath, path, params) {
        const cleanBase = trimSlash(basePath);
        const cleanPath = String(path || '').replace(/^\/+/, '');
        const url = new URL(`${cleanBase}/${cleanPath}`);

        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '') return;
                if (Array.isArray(value)) {
                    if (value.length > 0) url.searchParams.set(key, value.join(','));
                    return;
                }
                url.searchParams.set(key, value);
            });
        }

        return url.toString();
    }

    async function getJson(basePath, path, params, options) {
        const response = await fetch(buildUrl(basePath, path, params), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            ...(options || {})
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            payload = null;
        }

        if (!response.ok) {
            const message = payload && payload.message ? payload.message : `HTTP ${response.status}`;
            throw new Error(message);
        }

        return payload;
    }

    async function sendJson(basePath, path, body, options) {
        const response = await fetch(buildUrl(basePath, path), {
            method: options?.method || 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...(options?.headers || {})
            },
            body: JSON.stringify(body || {})
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            payload = null;
        }

        if (!response.ok) {
            const message = payload && payload.message ? payload.message : `HTTP ${response.status}`;
            throw new Error(message);
        }

        return payload;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(value, fallback = 'Liên hệ') {
        const number = Number(value || 0);
        if (!number) return fallback;
        return new Intl.NumberFormat('vi-VN').format(Math.round(number)) + 'đ';
    }

    function productImage(product, fallback = '../assets/images/product_frame.png') {
        return product?.thumbnail || product?.image_url || product?.image || fallback;
    }

    function normalizeProduct(product = {}) {
        const price = Number(product.retail_price || product.price || 0);
        const inStock = product.in_stock !== false && Number(product.total_stock ?? product.available_stock ?? 1) > 0;
        return {
            ...product,
            id: Number(product.id),
            price,
            retail_price: Number(product.retail_price || price || 0),
            image_url: productImage(product),
            requires_prescription: Boolean(Number(product.requires_prescription || 0)),
            in_stock: inStock
        };
    }

    function canAddToCart(product = {}) {
        const normalized = normalizeProduct(product);
        return !normalized.requires_prescription && normalized.in_stock && normalized.price > 0;
    }

    function renderProductCard(product = {}, options = {}) {
        const item = normalizeProduct(product);
        const id = Number(item.id || 0);
        const name = escapeHtml(item.name || 'Sản phẩm');
        const image = escapeHtml(productImage(item));
        const unit = item.base_unit ? ` / ${escapeHtml(item.base_unit)}` : '';
        const priceHtml = item.requires_prescription
            ? '<span class="price-new catalog-rx-note">Cần tư vấn dược sĩ</span>'
            : `<span class="price-new">${formatPrice(item.price)}<small>${unit}</small></span>`;

        const oldPrice = Number(options.oldPrice || item.original_price || 0);
        const oldPriceHtml = options.showOldPrice && oldPrice > item.price
            ? `<span class="price-old">${formatPrice(oldPrice)}</span>`
            : '';

        const discountPercent = Number(options.discountPercent ?? item.discount_percent ?? 0);
        const badgeHtml = discountPercent > 0
            ? `<span class="discount-badge">-${Math.round(discountPercent)}%</span>`
            : '';

        let actionHtml = `<button class="btn-add-cart" onclick="window.addToCart ? addToCart(${id}, event) : (window.location.href='product.html?id=${id}')">Thêm giỏ hàng</button>`;
        if (item.requires_prescription) {
            actionHtml = `<button class="btn-add-cart btn-consult" onclick="event.preventDefault(); event.stopPropagation(); window.location.href='product.html?id=${id}'">Tư vấn ngay</button>`;
        } else if (!item.in_stock) {
            actionHtml = '<button class="btn-add-cart" disabled>Hết hàng</button>';
        }

        if (options.hideAction) actionHtml = '';

        return `
            <div class="product-card" data-product-id="${id}">
                <div class="product-image" onclick="window.location.href='product.html?id=${id}'" style="cursor:pointer;">
                    ${badgeHtml}
                    <img src="${image}" alt="${name}" onerror="this.src='../assets/images/product_frame.png'">
                </div>
                <div class="product-info">
                    <h5><a href="product.html?id=${id}">${name}</a></h5>
                    <div class="product-price">
                        ${oldPriceHtml}
                        ${priceHtml}
                    </div>
                    ${actionHtml}
                </div>
            </div>
        `;
    }

    const gatewayOrigin = resolveGatewayOrigin();
    const catalogBase = trimSlash(global.MG_CATALOG_API_BASE || `${gatewayOrigin}/api/catalog`);

    global.MGClientApi = {
        gatewayOrigin,
        catalogBase,
        buildUrl,
        getJson,
        escapeHtml,
        formatPrice,
        productImage,
        normalizeProduct,
        canAddToCart,
        renderProductCard,
        catalog: {
            baseUrl: catalogBase,
            url: (path, params) => buildUrl(catalogBase, path, params),
            get: (path, params, options) => getJson(catalogBase, path, params, options),
            post: (path, body, options) => sendJson(catalogBase, path, body, { ...(options || {}), method: 'POST' })
        }
    };

    global.MGCatalogApi = global.MGClientApi.catalog;
})(window);
