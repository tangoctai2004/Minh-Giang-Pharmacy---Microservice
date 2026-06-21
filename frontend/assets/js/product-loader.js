/**
 * product-loader.js
 * Cập nhật dữ liệu động cho trang chi tiết sản phẩm mới.
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

function escapeProductHtml(value) {
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

function consult(productId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    window.location.href = `product.html?id=${encodeURIComponent(productId)}`;
}

let currentProduct = null;
const PRODUCT_REVIEWS_PAGE_SIZE = 3;
const productReviewsState = {
    productId: null,
    page: 1,
    total: 0,
    limit: PRODUCT_REVIEWS_PAGE_SIZE
};

document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        console.warn("❌ Không tìm thấy ID sản phẩm trên URL.");
        showErrorMessage("Không tìm thấy sản phẩm");
        return;
    }

    // Save to recently viewed
    saveRecentlyViewed(productId);

    // Fetch Main Data
    fetchProductData(productId).then(product => {
        if (product) {
            // Nạp sản phẩm tương tự dựa trên hoạt chất/danh mục của sản phẩm hiện tại
            fetchAlternativeProducts(productId, product.category?.id);
        }
    });
    
    // Nạp các danh sách chung
    fetchPopularProducts();
    fetchTrendingProducts();
    fetchTopSearches();
    renderRecentlyViewed();

    // Tab switcher logic
    initTabs();

    // Quantity change listener for subtotal recalculation
    const qtyInput = document.getElementById('pdQty');
    qtyInput?.addEventListener('input', () => {
        if (typeof recalculateSubtotal === 'function') {
            recalculateSubtotal();
        }
    });
});

/**
 * Hiển thị thông báo lỗi
 */
function showErrorMessage(message) {
    const container = document.querySelector('.pd-top-layout');
    if (container) {
        container.innerHTML = `
            <div style="background: #fef2f2; border: 1px solid #fca5a5; color: #7f1d1d; padding: 20px; border-radius: 8px; grid-column: span 3;">
                <h3>⚠️ Lỗi</h3>
                <p>${message}</p>
                <a href="category.html" style="color: #0b7a3e; text-decoration: underline;">← Quay lại danh mục</a>
            </div>
        `;
    }
}

/**
 * Fetch Main Product Data
 */
async function fetchProductData(id) {
    try {
        const result = await catalogApi().get(`products/${id}`);

        if (result.success && result.data) {
            updateProductUI(result.data);
            return result.data;
        } else {
            throw new Error(result.message || 'Lỗi dữ liệu');
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu sản phẩm:", error);
        showErrorMessage("Không thể tải thông tin sản phẩm.");
    }
}

function updateProductUI(p) {
    currentProduct = p;

    // 1. Breadcrumb
    const bc = document.getElementById('pdBreadcrumb');
    if (bc) {
        const productName = escapeProductHtml(p.name);
        const categoryName = escapeProductHtml(p.category?.name);
        const categoryId = Number(p.category?.id);
        bc.innerHTML = `
            <a href="index.html">Trang chủ</a> <span>›</span> 
            ${p.category ? `<a href="category.html?id=${categoryId}">${categoryName}</a> <span>›</span>` : ''} 
            <strong style="color:#1f2937;">${productName}</strong>
        `;
    }
    document.title = p.name + " — Nhà Thuốc Minh Giang";

    // 2. Info Col
    document.getElementById('pdBrand').textContent = p.brand?.name || p.manufacturer || "Đang cập nhật";
    document.getElementById('pdName').textContent = p.name;
    
    const stockCountEl = document.getElementById('pdStockCount');
    if (stockCountEl) {
        stockCountEl.textContent = p.total_stock !== undefined ? p.total_stock : 0;
    }
    const stockUnitEl = document.getElementById('pdStockUnit');
    if (stockUnitEl) {
        stockUnitEl.textContent = p.base_unit || 'sản phẩm';
    }
    
    // Specs
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || "—"; };
    setVal('pdSpecReg', p.registration_number);
    setVal('pdSpecUnit', p.base_unit);
    setVal('pdSpecBrand', p.brand?.name || p.manufacturer);
    setVal('pdSpecForm', p.base_unit);
    setVal('pdSpecPack', p.base_unit);
    setVal('pdSpecOrigin', p.country_of_origin || "Việt Nam");
    setVal('pdSpecMfg', p.manufacturer);
    setVal('pdSpecRx', p.requires_prescription ? "Thuốc kê đơn" : "Không");

    // Short Description & Notices
    const shortDescEl = document.getElementById('pdShortDesc');
    if (shortDescEl) {
        let text = p.description || "";
        text = text.replace(/<[^>]*>?/gm, ''); // Xóa thẻ HTML
        if (text.length > 250) text = text.substring(0, 250) + '...';
        shortDescEl.textContent = text || "Chưa có thông tin mô tả ngắn.";
    }

    const rxNotice = document.getElementById('pdPrescriptionNotice');
    const supNotice = document.getElementById('pdSupplementNotice');
    if (p.requires_prescription && rxNotice) {
        rxNotice.style.display = 'block';
    } else if (p.category?.name?.toLowerCase().includes('thực phẩm chức năng') && supNotice) {
        supNotice.style.display = 'block';
    }

    // Clear old countdown interval if exists
    if (window.promoCountdownInterval) {
        clearInterval(window.promoCountdownInterval);
        window.promoCountdownInterval = null;
    }

    // 3. Price Box and Promotions
    const hasPromo = p.promo_info && !p.requires_prescription;
    const discountSticker = document.getElementById('pdDiscountSticker');
    const promoBanner = document.getElementById('pdPromoBanner');
    const promoProgressBox = document.getElementById('pdPromoProgressBox');
    const originalPriceBox = document.getElementById('pdOriginalPriceBox');
    const savingsBox = document.getElementById('pdSavingsBox');
    const voucherBox = document.getElementById('pdVoucherBox');

    // Reset visibility
    if (discountSticker) discountSticker.style.display = 'none';
    if (promoBanner) promoBanner.style.display = 'none';
    if (promoProgressBox) promoProgressBox.style.display = 'none';
    if (originalPriceBox) originalPriceBox.style.display = 'none';
    if (savingsBox) savingsBox.style.display = 'none';
    if (voucherBox) voucherBox.style.display = 'none';

    if (hasPromo) {
        const info = p.promo_info;
        const discountType = info.discount_type;
        const discountValue = Number(info.discount_value);
        const originalPrice = Number(p.original_price || p.retail_price);
        const promoPrice = Number(p.retail_price);

        let pct = 0;
        if (discountType === 'percentage') {
            pct = Math.round(discountValue);
        } else {
            pct = originalPrice > 0 ? Math.round((discountValue / originalPrice) * 100) : 0;
        }

        // Image sticker
        if (discountSticker) {
            discountSticker.textContent = `-${pct}%`;
            discountSticker.style.display = 'flex';
        }

        // Render main price card
        const formatPrice = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val)) + 'đ';
        const priceStr = formatPrice(promoPrice);
        const origPriceStr = formatPrice(originalPrice);
        const savingsAmt = Math.max(0, originalPrice - promoPrice);

        const priceBox = document.getElementById('pdPriceBox');
        if (priceBox) {
            priceBox.innerHTML = `
                <div style="display: flex; align-items: baseline; gap: 8px;">
                    <span id="pdPrice" style="font-size: 26px; font-weight: 700; color: #0b7a3e;">${priceStr}</span>
                    <span id="pdPriceUnit" class="pd-price-unit" style="font-size: 14px; color: #4b5563; font-weight: 400;">/ ${p.base_unit || 'Hộp'}</span>
                </div>
                <div id="pdOriginalPriceBox" style="display: flex; align-items: center; gap: 8px;">
                    <span id="pdOriginalPrice" style="text-decoration: line-through; color: #9ca3af; font-size: 15px;">${origPriceStr}</span>
                    <span id="pdDiscountPercent" style="background: #fef2f2; color: #ef4444; font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #fee2e2;">-${pct}%</span>
                </div>
                ${savingsAmt > 0 ? `
                <div id="pdSavingsBox" style="display: flex; font-size: 13px; color: #16a34a; font-weight: 500;">
                    Tiết kiệm: <span id="pdSavings">${formatPrice(savingsAmt)}</span>
                </div>` : ''}
            `;
        }

        // Setup Countdown
        if (promoBanner) {
            const promoLabel = document.getElementById('pdPromoLabel');
            if (info.tag_name === 'flash-sale') {
                promoLabel.innerHTML = `<i class="fa-solid fa-bolt" style="color:#facc15;"></i> FLASH SALE ĐANG DIỄN RA`;
                promoBanner.style.background = 'linear-gradient(90deg, #dc2626 0%, #ea580c 100%)';
            } else if (info.tag_name === 'deal') {
                promoLabel.innerHTML = `<i class="fa-solid fa-fire" style="color:#facc15;"></i> CƠ HỘI MUA DEAL HOT`;
                promoBanner.style.background = 'linear-gradient(90deg, #ea580c 0%, #f97316 100%)';
            } else {
                promoLabel.innerHTML = `<i class="fa-solid fa-tag"></i> CHƯƠNG TRÌNH KHUYẾN MÃI`;
                promoBanner.style.background = 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)';
            }
            promoBanner.style.display = 'flex';

            const endTime = new Date(info.end_time).getTime();
            const updateTimer = () => {
                const now = new Date().getTime();
                const distance = endTime - now;
                if (distance < 0) {
                    if (window.promoCountdownInterval) clearInterval(window.promoCountdownInterval);
                    const cdEl = document.getElementById('pdPromoCountdown');
                    if (cdEl) cdEl.innerHTML = `<span style="font-weight: 700;">Chương trình đã kết thúc</span>`;
                    return;
                }
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                const dEl = document.getElementById('promoDays');
                const hEl = document.getElementById('promoHours');
                const mEl = document.getElementById('promoMinutes');
                const sEl = document.getElementById('promoSeconds');

                if (dEl) dEl.textContent = String(days).padStart(2, '0');
                if (hEl) hEl.textContent = String(hours).padStart(2, '0');
                if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
                if (sEl) sEl.textContent = String(seconds).padStart(2, '0');
            };
            updateTimer();
            window.promoCountdownInterval = setInterval(updateTimer, 1000);
        }

        // Progress bar for flash-sale
        if (info.tag_name === 'flash-sale' && promoProgressBox) {
            const campaignQty = Number(info.campaign_qty || 0);
            const soldQty = Number(info.sold_qty || 0);
            if (campaignQty > 0) {
                const percent = Math.min(100, Math.round((soldQty / campaignQty) * 100));
                const pBar = document.getElementById('pdPromoProgressBar');
                const pText = document.getElementById('pdPromoProgressText');
                if (pBar) pBar.style.width = `${percent}%`;
                if (pText) pText.textContent = `${soldQty}/${campaignQty} đã bán`;
                promoProgressBox.style.display = 'flex';
            }
        }


    } else {
        if (p.retail_price) {
            const priceStr = new Intl.NumberFormat('vi-VN').format(Math.round(p.retail_price)) + "đ";
            const priceBox = document.getElementById('pdPriceBox');
            if (priceBox) {
                priceBox.innerHTML = `
                    <div style="display: flex; align-items: baseline; gap: 8px;">
                        <span id="pdPrice" style="font-size: 26px; font-weight: 700; color: #eb7c23;">${priceStr}</span>
                        <span id="pdPriceUnit" class="pd-price-unit" style="font-size: 14px; color: #4b5563; font-weight: 400;">/ ${p.base_unit || 'Hộp'}</span>
                    </div>
                `;
            }
        }
    }

    // Recalculate subtotal based on quantity input
    recalculateSubtotal();

    // 4. Gallery
    const mainImg = document.getElementById('pdMainImg');
    if (p.image_url && mainImg) mainImg.src = p.image_url;
    
    let galleryItems = [];
    if (p.image_url) galleryItems.push(p.image_url);
    try {
        if (p.gallery) {
            const arr = typeof p.gallery === 'string' ? JSON.parse(p.gallery) : p.gallery;
            if (Array.isArray(arr)) {
                arr.forEach(img => {
                    if (!galleryItems.includes(img)) galleryItems.push(img);
                });
            }
        }
    } catch(e){}

    const thumbsContainer = document.getElementById('pdThumbs');
    if (thumbsContainer && galleryItems.length > 0) {
        thumbsContainer.innerHTML = galleryItems.slice(0, 5).map((img, i) => `
            <img src="${img}" class="pd-thumb ${i===0 ? 'active' : ''}" onclick="changeImg(this)" onerror="this.src='../assets/images/placeholder.png'">
        `).join('');
    }

    // 5. Content (Tự động tách thành các phần và hiển thị động lên Menu dọc)
    const contentBox = document.querySelector('.pd-content-box');
    if (contentBox) {
        const sections = parseDescriptionSections(p.description);

        const reviewSection = document.getElementById('section-review');
        const reviewHtml = reviewSection ? reviewSection.outerHTML : '';

        const sectionsHtml = [];
        const menuItems = [];

        if (sections.desc) {
            sectionsHtml.push(`
                <div class="pd-content-section" id="section-desc">
                    <h2>Mô tả sản phẩm</h2>
                    <div class="pd-content-html">${formatSectionContent(sections.desc)}</div>
                </div>
            `);
            menuItems.push(`<a href="#section-desc" class="pd-tab-link active">Mô tả sản phẩm</a>`);
        }

        if (sections.ingredients) {
            sectionsHtml.push(`
                <div class="pd-content-section" id="section-ingredients">
                    <h2>Thành phần</h2>
                    <div class="pd-content-html">${formatSectionContent(sections.ingredients)}</div>
                </div>
            `);
            menuItems.push(`<a href="#section-ingredients" class="pd-tab-link ${menuItems.length === 0 ? 'active' : ''}">Thành phần</a>`);
        }

        if (sections.usage) {
            sectionsHtml.push(`
                <div class="pd-content-section" id="section-usage">
                    <h2>Công dụng & Chỉ định</h2>
                    <div class="pd-content-html">${formatSectionContent(sections.usage)}</div>
                </div>
            `);
            menuItems.push(`<a href="#section-usage" class="pd-tab-link ${menuItems.length === 0 ? 'active' : ''}">Công dụng</a>`);
        }

        if (sections.dosage) {
            sectionsHtml.push(`
                <div class="pd-content-section" id="section-dosage">
                    <h2>Cách dùng & Liều dùng</h2>
                    <div class="pd-content-html">${formatSectionContent(sections.dosage)}</div>
                </div>
            `);
            menuItems.push(`<a href="#section-dosage" class="pd-tab-link ${menuItems.length === 0 ? 'active' : ''}">Cách dùng</a>`);
        }

        if (sections.warnings) {
            sectionsHtml.push(`
                <div class="pd-content-section" id="section-warnings">
                    <h2>Lưu ý & Tác dụng phụ</h2>
                    <div class="pd-content-html">${formatSectionContent(sections.warnings)}</div>
                </div>
            `);
            menuItems.push(`<a href="#section-warnings" class="pd-tab-link ${menuItems.length === 0 ? 'active' : ''}">Lưu ý</a>`);
        }

        menuItems.push(`<a href="#section-review" class="pd-tab-link">Đánh giá</a>`);

        // Ghi đè lại nội dung khung chi tiết (bao bọc bằng wrapper thu gọn và thêm nút xem thêm)
        contentBox.innerHTML = `
            <div class="pd-details-wrapper collapsed">
                ${sectionsHtml.join('\n')}
                <div class="readmore-overlay"></div>
            </div>
            <div class="readmore-btn-area">
                <button class="btn-readmore" onclick="toggleReadmore()">Xem thêm <i class="fa-solid fa-chevron-down"></i></button>
            </div>
            ${reviewHtml}
        `;

        // Cập nhật lại danh sách liên kết bên tab menu dọc
        const tabMenu = document.querySelector('.pd-tab-menu');
        if (tabMenu) {
            tabMenu.innerHTML = menuItems.join('\n');
        }

        // Đăng ký lại sự kiện click cuộn mượt cho các thẻ tab mới thêm
        if (typeof initTabs === 'function') {
            initTabs();
        }
    }

    loadProductReviews(p.id);

    // 6. Action buttons
    const btnBuy = document.getElementById('btnBuyNow');
    const btnCart = document.getElementById('btnAddToCart');
    if (p.requires_prescription) {
        if (btnBuy) {
            btnBuy.disabled = false;
            btnBuy.textContent = "Tư vấn dược sĩ";
            btnBuy.onclick = (event) => consult(p.id, event);
        }
        if (btnCart) {
            btnCart.disabled = true;
            btnCart.textContent = "Không bán online";
            btnCart.style.opacity = 0.6;
        }
    } else if (!p.in_stock) {
        if (btnBuy) { btnBuy.disabled = true; btnBuy.textContent = "Hết hàng"; btnBuy.style.opacity = 0.5; }
        if (btnCart) { btnCart.disabled = true; btnCart.textContent = "Hết hàng"; btnCart.style.opacity = 0.5; }
    } else {
        if (btnCart) {
            btnCart.disabled = false;
            btnCart.onclick = (event) => addCurrentProductToCart(event, false);
        }
        if (btnBuy) {
            btnBuy.disabled = false;
            btnBuy.onclick = (event) => addCurrentProductToCart(event, true);
        }
    }

    // Nạp mã giảm giá POS động
    loadDynamicPosVouchers(p);
}

function getClientAuth() {
    try {
        return JSON.parse(localStorage.getItem('MG_CLIENT_AUTH') || 'null');
    } catch (_err) {
        return null;
    }
}

function getCatalogBaseUrl() {
    const gateway = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
    return (window.MG_CATALOG_API_BASE || (gateway + '/api/catalog')).replace(/\/+$/, '');
}

function getClientAuthHeaders() {
    const auth = getClientAuth();
    return auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {};
}

async function fetchCatalogJson(path, options = {}) {
    const url = `${getCatalogBaseUrl()}/${String(path).replace(/^\/+/, '')}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            ...(options.headers || {})
        }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
    }
    return payload;
}

function renderStars(rating = 0) {
    const value = Number(rating || 0);
    return [1, 2, 3, 4, 5].map((star) => (
        `<i class="${value >= star ? 'fa-solid' : 'fa-regular'} fa-star"></i>`
    )).join('');
}

function renderReviewBars(distribution = []) {
    const rows = distribution.length ? distribution : [5, 4, 3, 2, 1].map(rating => ({ rating, percent: 0 }));
    return rows.map((item) => `
        <div class="pd-bar-row">
            <span>${item.rating}<i class="fa-solid fa-star" style="font-size:10px;margin-left:2px"></i></span>
            <div class="pd-bar-track"><div class="pd-bar-fill" style="width:${Number(item.percent || 0)}%"></div></div>
            <span>${Number(item.percent || 0)}%</span>
        </div>
    `).join('');
}

function updateReviewSummary(summary = {}) {
    const average = Number(summary.average || 0);
    const total = Number(summary.total || 0);
    const averageText = average ? average.toFixed(1) : '0.0';
    const countText = `${total} đánh giá`;

    const averageEl = document.getElementById('pdReviewAverage');
    const countEl = document.getElementById('pdReviewCount');
    const starsEl = document.getElementById('pdReviewStars');
    const barsEl = document.getElementById('pdReviewBars');
    const metaStarsEl = document.getElementById('pdMetaReviewStars');
    const metaCountEl = document.getElementById('pdMetaReviewCount');

    if (averageEl) averageEl.textContent = averageText;
    if (countEl) countEl.textContent = countText;
    if (starsEl) starsEl.innerHTML = renderStars(Math.round(average));
    if (barsEl) barsEl.innerHTML = renderReviewBars(summary.distribution || []);
    if (metaStarsEl) metaStarsEl.innerHTML = renderStars(Math.round(average));
    if (metaCountEl) metaCountEl.textContent = countText;
}

function renderReviewList(reviews = []) {
    const list = document.getElementById('pdReviewsList');
    if (!list) return;

    if (!reviews.length) {
        list.innerHTML = '<div class="pd-reviews-empty">Chưa có đánh giá nào cho sản phẩm này.</div>';
        return;
    }

    list.innerHTML = reviews.map((review) => {
        const title = review.title ? `<div class="pd-review-title">${escapeProductHtml(review.title)}</div>` : '';
        const verified = review.is_verified_purchase
            ? '<span class="pd-review-badge"><i class="fa-solid fa-circle-check"></i> Đã mua hàng</span>'
            : '';
        const date = review.created_at
            ? new Date(review.created_at).toLocaleDateString('vi-VN')
            : '';
        return `
            <div class="pd-review-item">
                <div class="pd-review-head">
                    <div>
                        <span class="pd-review-author">${escapeProductHtml(review.customer_name || 'Khách hàng Minh Giang')}</span>
                        ${verified}
                    </div>
                    <div class="pd-review-stars">${renderStars(review.rating)}</div>
                </div>
                ${title}
                <div class="pd-review-comment">${escapeProductHtml(review.comment || '')}</div>
                ${date ? `<div class="pd-review-date">${date}</div>` : ''}
            </div>
        `;
    }).join('');
}

function renderReviewPagination(pagination = {}) {
    const paginationEl = document.getElementById('pdReviewPagination');
    if (!paginationEl) return;

    const total = Number(pagination.total || 0);
    const limit = Number(pagination.limit || PRODUCT_REVIEWS_PAGE_SIZE);
    const page = Number(pagination.page || 1);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    productReviewsState.page = page;
    productReviewsState.total = total;
    productReviewsState.limit = limit;

    if (totalPages <= 1) {
        paginationEl.style.display = 'none';
        paginationEl.innerHTML = '';
        return;
    }

    paginationEl.style.display = 'flex';
    paginationEl.innerHTML = `
        <button class="pd-review-page-btn" type="button" ${page <= 1 ? 'disabled' : ''} onclick="changeProductReviewPage(${page - 1})">
            Trước
        </button>
        <span class="pd-review-page-info">Trang ${page} / ${totalPages}</span>
        <button class="pd-review-page-btn" type="button" ${page >= totalPages ? 'disabled' : ''} onclick="changeProductReviewPage(${page + 1})">
            Sau
        </button>
    `;
}

function changeProductReviewPage(page) {
    if (!productReviewsState.productId) return;
    const totalPages = Math.max(1, Math.ceil(productReviewsState.total / productReviewsState.limit));
    const nextPage = Math.min(totalPages, Math.max(1, Number(page || 1)));
    loadProductReviews(productReviewsState.productId, nextPage, { loadEligibility: false });
}

function renderReviewForm(productId, eligibility) {
    const box = document.getElementById('pdReviewFormBox');
    if (!box) return;

    if (!eligibility?.can_review) {
        box.style.display = 'block';
        box.innerHTML = `
            <div class="pd-review-note">
                ${escapeProductHtml(eligibility?.message || 'Chỉ khách đã mua sản phẩm mới có thể viết đánh giá.')}
            </div>
        `;
        return;
    }

    box.style.display = 'block';
    box.innerHTML = `
        <div class="pd-review-form-title">Viết đánh giá của bạn</div>
        <form id="pdReviewForm" class="pd-review-form-grid">
            <div>
                <div class="pd-review-rating-input" id="pdReviewRatingInput" data-rating="5">
                    ${[1, 2, 3, 4, 5].map((star) => `<button type="button" data-star="${star}" aria-label="${star} sao"><i class="fa-solid fa-star"></i></button>`).join('')}
                </div>
                <div class="pd-review-note">Đánh giá mới sẽ được nhà thuốc duyệt trước khi hiển thị.</div>
            </div>
            <div class="pd-review-fields">
                <input id="pdReviewTitleInput" type="text" maxlength="160" placeholder="Tiêu đề ngắn">
                <textarea id="pdReviewCommentInput" maxlength="1200" required placeholder="Chia sẻ trải nghiệm mua hàng hoặc sử dụng sản phẩm. Không ghi hướng dẫn thay thế tư vấn y tế."></textarea>
                <button class="pd-review-submit" type="submit">Gửi đánh giá</button>
            </div>
        </form>
    `;

    const ratingInput = document.getElementById('pdReviewRatingInput');
    ratingInput?.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-star]');
        if (!button) return;
        const rating = Number(button.dataset.star || 5);
        ratingInput.dataset.rating = String(rating);
        ratingInput.querySelectorAll('button[data-star]').forEach((starButton) => {
            const star = Number(starButton.dataset.star || 0);
            starButton.innerHTML = `<i class="${star <= rating ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
        });
    });

    document.getElementById('pdReviewForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = event.currentTarget.querySelector('.pd-review-submit');
        const payload = {
            rating: Number(ratingInput?.dataset.rating || 5),
            title: document.getElementById('pdReviewTitleInput')?.value || '',
            comment: document.getElementById('pdReviewCommentInput')?.value || '',
        };
        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Đang gửi...';
            const result = await fetchCatalogJson(`products/${productId}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getClientAuthHeaders(),
                },
                body: JSON.stringify(payload),
            });
            box.innerHTML = `<div class="pd-review-note">${escapeProductHtml(result.message || 'Đã gửi đánh giá. Đánh giá sẽ hiển thị sau khi được duyệt.')}</div>`;
        } catch (err) {
            alert(err.message || 'Không gửi được đánh giá.');
            submitButton.disabled = false;
            submitButton.textContent = 'Gửi đánh giá';
        }
    });
}

async function loadProductReviews(productId, page = 1, options = {}) {
    productReviewsState.productId = productId;
    const requestedPage = Math.max(1, Number(page || 1));

    try {
        const [summaryResult, reviewsResult] = await Promise.all([
            fetchCatalogJson(`products/${productId}/reviews/summary`),
            fetchCatalogJson(`products/${productId}/reviews?page=${requestedPage}&limit=${PRODUCT_REVIEWS_PAGE_SIZE}`),
        ]);
        updateReviewSummary(summaryResult.data || {});
        renderReviewList(reviewsResult.data || []);
        renderReviewPagination(reviewsResult.pagination || { page: requestedPage, limit: PRODUCT_REVIEWS_PAGE_SIZE, total: 0 });
    } catch (err) {
        console.warn('[Product Reviews] Không thể tải đánh giá:', err.message);
        updateReviewSummary({ average: 0, total: 0, distribution: [] });
        renderReviewList([]);
        renderReviewPagination({ page: 1, limit: PRODUCT_REVIEWS_PAGE_SIZE, total: 0 });
    }

    if (options.loadEligibility === false) return;

    try {
        const eligibilityResult = await fetchCatalogJson(`products/${productId}/reviews/eligibility`, {
            headers: getClientAuthHeaders(),
        });
        renderReviewForm(productId, eligibilityResult.data || {});
    } catch (err) {
        const box = document.getElementById('pdReviewFormBox');
        if (box) {
            box.style.display = 'block';
            box.innerHTML = `<div class="pd-review-note">${escapeProductHtml(err.message || 'Chưa thể kiểm tra điều kiện đánh giá.')}</div>`;
        }
    }
}

/**
 * Nạp danh sách mã giảm giá POS động từ API cms-service
 */
async function loadDynamicPosVouchers(p) {
    const voucherBox = document.getElementById('pdVoucherBox');
    if (!voucherBox) return;

    // Reset visibility
    voucherBox.style.display = 'none';

    // Nếu là thuốc kê đơn hoặc sản phẩm đang chạy Flash Sale, không hiển thị khuyến mãi/voucher
    if (p.requires_prescription || (p.promo_info && p.promo_info.tag_name === 'flash-sale')) {
        return;
    }

    try {
        const gateway = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
        const res = await fetch(`${gateway}/api/cms/promotions/active`);
        if (!res.ok) return;
        const result = await res.json();
        
        if (result.success && Array.isArray(result.data)) {
            // Lọc các mã voucher (không phải quà tặng tự động buy_x_get_y)
            // áp dụng cho kênh POS (hoặc cả POS & Web)
            const posVouchers = result.data.filter(v => 
                v.code && 
                (v.applicable_channel === 'all' || v.applicable_channel === 'pos') &&
                v.type !== 'buy_x_get_y' &&
                v.is_active === 1
            );

            if (posVouchers.length > 0) {
                // Lấy voucher đầu tiên khả dụng để hiển thị
                const v = posVouchers[0];
                
                let discountDesc = '';
                const val = Number(v.discount_value || 0);
                const minBill = Number(v.min_order_value || 0);
                
                const formatMoney = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
                
                if (v.type === 'percent_discount' || v.type === 'percent') {
                    discountDesc = `giảm ${val}%`;
                    const maxDisc = Number(v.max_discount_amount || 0);
                    if (maxDisc > 0) {
                        discountDesc += ` (tối đa ${formatMoney(maxDisc)})`;
                    }
                } else if (v.type === 'fixed_discount' || v.type === 'fixed') {
                    discountDesc = `giảm ${formatMoney(val)}`;
                } else if (v.type === 'free_shipping' || v.type === 'freeship') {
                    discountDesc = `miễn phí vận chuyển`;
                }

                let condText = '';
                if (minBill > 0) {
                    condText = ` cho đơn hàng từ ${formatMoney(minBill)}`;
                }
                
                voucherBox.innerHTML = `
                    <div style="font-weight: 700; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                        <i class="fa-solid fa-ticket"></i> Mã giảm giá áp dụng tại POS
                    </div>
                    <div style="font-family: monospace; font-size: 11px; background: #fff; padding: 4px 8px; border: 1px solid #bbf7d0; border-radius: 4px; display: inline-block; width: fit-content; font-weight: bold; color: #15803d; margin: 4px 0;">
                        ${escapeProductHtml(v.code)}
                    </div>
                    <div>Nhập mã voucher tại quầy thuốc để được ${discountDesc}${condText} khi thanh toán trực tiếp.</div>
                `;
                voucherBox.style.display = 'flex';
            }
        }
    } catch (e) {
        console.error('[Storefront Load POS Vouchers Error]:', e);
    }
}

function getSelectedQuantity() {
    const input = document.getElementById('pdQty');
    const quantity = Math.max(1, Number.parseInt(input?.value, 10) || 1);
    if (input) input.value = quantity;
    return quantity;
}

async function addCurrentProductToCart(event, goCheckout) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!currentProduct) return;

    if (currentProduct.requires_prescription) {
        alert('Thuốc kê đơn cần được dược sĩ tư vấn và kiểm tra toa trước khi bán.');
        return;
    }
    if (currentProduct.in_stock === false) {
        alert('Sản phẩm hiện đã hết hàng.');
        return;
    }

    const productId = Number(currentProduct.id);
    const quantity = getSelectedQuantity();

    if (typeof window.addToCart !== 'function') {
        alert('Giỏ hàng chưa sẵn sàng, vui lòng tải lại trang.');
        return;
    }

    const added = await window.addToCart(productId, event, { quantity });
    if (!added) return;

    if (goCheckout) {
        window.location.href = 'checkout.html';
    }
}

/**
 * Nghiệp vụ 1: Sản phẩm tương tự (Alternative Products)
 * Tiêu chí: Ưu tiên cùng hoạt chất chính (Active Ingredient) để dược sỹ có thể thay thế khi hết hàng. 
 * Nếu không có, tìm cùng danh mục điều trị (Category).
 */
async function fetchAlternativeProducts(id, categoryId) {
    const container = document.getElementById('pdSimilarProducts');
    if (!container) return;
    try {
        const result = await catalogApi().get(`products/${id}/alternatives`);
        
        let items = result.data?.alternatives || [];
        
        // Fallback: Nếu không tìm thấy thuốc thay thế cùng hoạt chất, tìm theo Danh mục (Category)
        if (items.length === 0 && categoryId) {
            const json2 = await catalogApi().get('products', {
                category_id: categoryId,
                limit: 5,
                exclude_id: id
            });
            items = json2.data || [];
        }

        // Tính toán dynamic height để giới hạn số lượng sản phẩm tương tự
        let displayCount = 3; // Default
        
        // Cần đợi UI render hoàn tất để lấy height chính xác (Dùng setTimeout 0)
        setTimeout(() => {
            const mainBox = document.querySelector('.pd-main-box');
            const actionBox = document.querySelector('.pd-action-box');
            if (mainBox && actionBox) {
                const availableHeight = mainBox.offsetHeight - actionBox.offsetHeight - 20; // 20px gap
                const similarBoxTitleHeight = 50; // Ước tính chiều cao title + padding
                const itemHeight = 72; // Ước tính chiều cao 1 thẻ mini item
                
                const maxItems = Math.floor((availableHeight - similarBoxTitleHeight) / itemHeight);
                displayCount = Math.max(1, maxItems); // Ít nhất 1
                
                // Nếu displayCount lớn hơn số items có sẵn thì cap lại
                displayCount = Math.min(displayCount, items.length);
            }
            
            renderMiniList(container, items.slice(0, displayCount));
        }, 50);
        
    } catch (e) {
        container.innerHTML = '<div style="font-size:13px; color:#999">Không thể tải sản phẩm tương tự.</div>';
    }
}

/**
 * Nghiệp vụ 2: Sản phẩm phổ biến (Popular Products)
 * Tiêu chí: Các sản phẩm y tế thiết yếu, thuốc không kê đơn (OTC), hoặc TPCN bán chạy nhất toàn hệ thống.
 * Không nên lạm dụng hiển thị thuốc kê đơn ở đây.
 */
async function fetchPopularProducts() {
    const container = document.getElementById('pdPopularProducts');
    if (!container) return;
    try {
        // Lọc sort=popular (sales_volume cao nhất)
        const result = await catalogApi().get('products', { limit: 6, sort: 'popular' });
        renderMiniList(container, result.data || []);
    } catch (e) {
        container.innerHTML = '';
    }
}

/**
 * Render Mini Product List for Sidebars
 */
function renderMiniList(container, products) {
    if (!products || products.length === 0) {
        container.innerHTML = '<div style="font-size:13px; color:#999">Không có dữ liệu.</div>';
        return;
    }
    const html = products.map(p => {
        const price = p.retail_price || p.price || 0;
        const id = Number(p.id);
        const name = escapeProductHtml(p.name || 'Sản phẩm');
        const image = escapeProductHtml(p.image_url || p.thumbnail || '../assets/images/placeholder.png');
        const consultHtml = p.requires_prescription 
            ? `<div class="pd-mini-consult">Cần tư vấn từ dược sỹ</div>` 
            : `<div class="pd-mini-price">${new Intl.NumberFormat('vi-VN').format(Math.round(price))}đ</div>`;

        const stockQty = Number(p.total_stock ?? p.available_stock ?? 0);
        let stockHtml = '';
        if (!p.requires_prescription) {
            if (stockQty > 0) {
                stockHtml = '';
            } else {
                stockHtml = `<div class="pd-mini-stock" style="font-size: 11px; color: #9ca3af; font-weight: 500; margin-top: 2px;">Hết hàng</div>`;
            }
        }

        return `
            <a href="product.html?id=${id}" class="pd-mini-item">
                <img src="${image}" class="pd-mini-img" alt="${name}">
                <div class="pd-mini-info">
                    <div class="pd-mini-name">${name}</div>
                    ${consultHtml}
                    ${stockHtml}
                </div>
            </a>
        `;
    }).join('');
    container.innerHTML = html;
}

/**
 * Fetch Tìm kiếm hàng đầu
 */
async function fetchTopSearches() {
    const container = document.getElementById('pdTopSearches');
    if (!container) return;
    try {
        const result = await catalogApi().get('products/top-searches', { t: Date.now() });
        const items = result.data || [];
        
        if (items.length > 0) {
            container.innerHTML = items.map(t => {
                const keyword = String(t.keyword || '');
                return `<a href="search.html?q=${encodeURIComponent(keyword)}" class="pd-tag">${escapeProductHtml(keyword)}</a>`;
            }).join('');
        } else {
            container.innerHTML = '<span class="catalog-widget-loading">Chưa có tìm kiếm hàng đầu.</span>';
        }
    } catch (e) {
        container.innerHTML = '';
    }
}

/**
 * Nghiệp vụ 3: Sản phẩm đang thu hút (Trending Products)
 * Tiêu chí: Các sản phẩm mới về, đang có chương trình khuyến mãi, 
 * hoặc các mặt hàng Thực phẩm chức năng/Dược mỹ phẩm đang HOT (lợi nhuận cao).
 */
async function fetchTrendingProducts() {
    const container = document.getElementById('pdTrendingProducts');
    if (!container) return;
    try {
        // Lấy tối đa 15 sản phẩm để làm Carousel
        const result = await catalogApi().get('products', { limit: 15, sort: 'trending' });
        
        if (result.data) {
            container.innerHTML = result.data.map(p => renderProductCard(p)).join('');
            // Khởi tạo Carousel sau khi nạp xong DOM
            new ProductCarousel('Trending', result.data.length);
        }
    } catch (e) {}
}

/**
 * Render Lịch sử xem hàng (Recently Viewed)
 */
async function renderRecentlyViewed() {
    let viewed = [];
    try { viewed = JSON.parse(localStorage.getItem('mg_recently_viewed')) || []; } catch (e) {}
    if (viewed.length === 0) return;

    const section = document.getElementById('recentlyViewedSection');
    const container = document.getElementById('pdRecentlyViewed');
    if (!section || !container) return;

    section.style.display = 'block';

    try {
        const productIds = viewed.map(v => v.id).join(',');
        // Vẫn dùng limit nhỏ thôi vì list này local (nhưng có thể lên đến 15)
        const result = await catalogApi().get('products', { limit: 15, ids: productIds });
        
        if (result.data) {
            // Sắp xếp lại theo thứ tự local (mới nhất trước)
            const sortedData = result.data.sort((a, b) => {
                const idxA = viewed.findIndex(v => v.id === a.id);
                const idxB = viewed.findIndex(v => v.id === b.id);
                return idxA - idxB;
            });
            container.innerHTML = sortedData.map(p => renderProductCard(p)).join('');
            // Khởi tạo Carousel cho Recently Viewed
            new ProductCarousel('Viewed', sortedData.length);
        }
    } catch (e) {}
}

/**
 * Điều khiển Slider (Carousel)
 */
class ProductCarousel {
    constructor(idPrefix, totalItems) {
        this.track = document.getElementById(`pd${idPrefix}Products`) || document.getElementById(`pdRecently${idPrefix}`);
        this.btnPrev = document.getElementById(`btnPrev${idPrefix}`);
        this.btnNext = document.getElementById(`btnNext${idPrefix}`);
        
        if (!this.track || !this.btnPrev || !this.btnNext) return;

        this.totalItems = totalItems;
        this.itemsPerView = 5; // Số sản phẩm hiển thị trên 1 màn hình
        this.currentIndex = 0;
        this.maxIndex = Math.max(0, this.totalItems - this.itemsPerView);

        // Gap giữa các item (15px) + 1 item width
        // (100% - 60px) / 5 là css, tính ra % để transform
        this.itemWidthPercent = 20; // 100/5
        this.gapPercent = 0; // Sẽ dùng translateX với % của container

        this.init();
    }

    init() {
        this.updateButtons();
        
        this.btnPrev.addEventListener('click', () => {
            // Cuộn lùi 5 sản phẩm, hoặc cuộn về 0
            this.currentIndex = Math.max(0, this.currentIndex - this.itemsPerView);
            this.updateTrack();
        });

        this.btnNext.addEventListener('click', () => {
            // Cuộn tiến 5 sản phẩm
            this.currentIndex = Math.min(this.maxIndex, this.currentIndex + this.itemsPerView);
            this.updateTrack();
        });

        // Tùy chọn Auto-play (Trượt tự động sau 5s)
        this.startAutoPlay();
    }

    updateTrack() {
        // Tính toán khoảng trượt. 
        // 1 item = thẻ (calc(100% - 60px) / 5) + margin-right (15px).
        // Thay vì tính chính xác pixel, ta dịch chuyển theo index * chiều rộng item (bao gồm gap).
        // Công thức dịch theo CSS Flex: 
        // Lấy phần tử đầu tiên để đo đạc kích thước thực tế (pixels).
        const itemNode = this.track.children[0];
        if (!itemNode) return;
        
        // style.css thiết lập gap: 15px cho .carousel-track (hoặc margin-right)
        // Chiều rộng thẻ + khoảng cách
        const itemTotalWidth = itemNode.offsetWidth + 15; 
        
        // Dịch chuyển track theo số Pixel
        this.track.style.transform = `translateX(-${this.currentIndex * itemTotalWidth}px)`;
        
        this.updateButtons();
    }

    updateButtons() {
        this.btnPrev.disabled = this.currentIndex <= 0;
        this.btnNext.disabled = this.currentIndex >= this.maxIndex;
    }

    startAutoPlay() {
        // Tự động cuộn tới nếu chưa hết, nếu hết thì vòng lại 0
        this.interval = setInterval(() => {
            if (this.currentIndex >= this.maxIndex) {
                this.currentIndex = 0;
            } else {
                this.currentIndex = Math.min(this.maxIndex, this.currentIndex + this.itemsPerView);
            }
            this.updateTrack();
        }, 5000); // 5 giây tự động lật trang

        // Dừng cuộn khi di chuột vào
        this.track.parentElement.addEventListener('mouseenter', () => clearInterval(this.interval));
        this.track.parentElement.addEventListener('mouseleave', () => this.startAutoPlay());
    }
}

/**
 * Recently Viewed Logic
 */
function saveRecentlyViewed(id) {
    let viewed = JSON.parse(localStorage.getItem('recently_viewed') || '[]');
    viewed = viewed.filter(v => v != id); // remove if exists
    viewed.unshift(id); // add to top
    if (viewed.length > 5) viewed = viewed.slice(0, 5); // keep max 5
    localStorage.setItem('recently_viewed', JSON.stringify(viewed));
}

async function renderRecentlyViewed() {
    const section = document.getElementById('recentlyViewedSection');
    const container = document.getElementById('pdRecentlyViewed');
    if (!section || !container) return;

    let viewedIds = JSON.parse(localStorage.getItem('recently_viewed') || '[]');
    // Filter out current product to not show it again in "Recently viewed"
    const currentId = new URLSearchParams(window.location.search).get('id');
    viewedIds = viewedIds.filter(id => id != currentId);

    if (viewedIds.length === 0) return;

    try {
        // Fetch all in parallel
        const promises = viewedIds.map(id => catalogApi().get(`products/${id}`).catch(() => null));
        const results = await Promise.all(promises);
        
        const validProducts = results.filter(r => r && r.success && r.data).map(r => r.data);
        
        if (validProducts.length > 0) {
            container.innerHTML = validProducts.map(p => renderProductCard(p)).join('');
            section.style.display = 'block';
        }
    } catch (e) {
        console.error("Lỗi khi tải sản phẩm vừa xem", e);
    }
}

/**
 * Render Product Card (For Grids)
 */
function renderProductCard(p) {
    if (window.MGClientApi && typeof window.MGClientApi.renderProductCard === 'function') {
        return window.MGClientApi.renderProductCard(p);
    }

    const isRx = p.requires_prescription;
    const priceStr = p.retail_price ? new Intl.NumberFormat('en-US').format(Math.round(p.retail_price)) + 'đ' : 'Liên hệ';
    const oldPriceStr = p.retail_price ? new Intl.NumberFormat('en-US').format(Math.round(p.retail_price * 1.05)) + 'đ' : '';
    const id = Number(p.id);
    const name = escapeProductHtml(p.name || 'Sản phẩm');
    const image = escapeProductHtml(p.thumbnail || p.image_url || '../assets/images/placeholder.png');

    let infoHtml = `
        <div class="product-price">
            <span class="price-old">${oldPriceStr}</span>
            <span class="price-new">${priceStr}</span>
        </div>
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
        actionHtml = `<button class="btn-consult" onclick="consult(${id}, event)">Tư vấn ngay</button>`;
    } else if (p.in_stock === false) {
        actionHtml = '<button class="btn-add-cart" disabled>Hết hàng</button>';
    }

    const stockQty = Number(p.total_stock ?? p.available_stock ?? 0);
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
                <img src="${image}" alt="${name}">
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

window.consult = consult;

/**
 * Tab Scroll Spy logic
 */
function initTabs() {
    const links = document.querySelectorAll('.pd-tab-link');
    links.forEach(link => {
        link.removeEventListener('click', handleTabClick);
        link.addEventListener('click', handleTabClick);
    });
}

function handleTabClick(e) {
    e.preventDefault();
    const links = document.querySelectorAll('.pd-tab-link');
    links.forEach(l => l.classList.remove('active'));
    this.classList.add('active');
    
    const targetId = this.getAttribute('href').substring(1);
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
        const wrapper = document.querySelector('.pd-details-wrapper');
        
        if (targetId === 'section-review') {
            if (typeof window.expandDetailsFully === 'function') {
                window.expandDetailsFully();
            }
            setTimeout(() => {
                window.scrollTo({
                    top: targetEl.offsetTop - 100,
                    behavior: 'smooth'
                });
            }, 100);
            return;
        }

        if (wrapper && wrapper.classList.contains('collapsed')) {
            const totalHeight = wrapper.scrollHeight;
            const sectionBottom = targetEl.offsetTop + targetEl.offsetHeight;
            
            // Nếu phần nội dung này vượt quá chiều cao đang hiển thị của khung thu gọn
            if (sectionBottom > wrapper.offsetHeight) {
                if (totalHeight - sectionBottom < 60) {
                    // Nếu đã chạm rất gần đáy, mở rộng hoàn toàn luôn
                    if (typeof window.expandDetailsFully === 'function') {
                        window.expandDetailsFully();
                    }
                } else {
                    // Nới rộng khung vừa đủ để hiện phần này, giữ nguyên nút xem thêm
                    wrapper.style.maxHeight = (sectionBottom + 40) + 'px';
                }
            }
        }

        // Chờ hiệu ứng chuyển đổi chiều cao bắt đầu rồi cuộn mượt
        setTimeout(() => {
            const wrapperOffset = wrapper ? wrapper.offsetTop : 0;
            window.scrollTo({
                top: targetEl.offsetTop + wrapperOffset - 100,
                behavior: 'smooth'
            });
        }, 100);
    }
}

/**
 * Tách nội dung mô tả sản phẩm thô thành các phần: Mô tả, Thành phần, Công dụng, Cách dùng, Lưu ý
 */
function parseDescriptionSections(description) {
    if (!description) return { desc: "Chưa có thông tin mô tả chi tiết." };

    let text = description.trim();

    const sectionKeywords = [
        { key: 'ingredients', label: 'Thành phần', patterns: [/Thành\s+phần/gi, /Hoạt\s+chất/gi] },
        { key: 'usage', label: 'Công dụng', patterns: [/Công\s+dụng/gi, /Chỉ\s+định/gi] },
        { key: 'dosage', label: 'Cách dùng', patterns: [/Cách\s+dùng/gi, /Liều\s+dùng/gi, /Hướng\s+dẫn\s+sử\s+dụng/gi] },
        { key: 'warnings', label: 'Lưu ý', patterns: [/Lưu\s+ý/gi, /Lưu\s+ý/gi, /Thận\s+trọng/gi, /Tác\s+dụng\s+phụ/gi, /Chống\s+chỉ\s+định/gi] }
    ];

    const matches = [];
    sectionKeywords.forEach(sec => {
        let firstIndex = -1;
        let matchedText = '';
        for (let pattern of sec.patterns) {
            const regex = new RegExp(pattern);
            const match = regex.exec(text);
            if (match) {
                if (firstIndex === -1 || match.index < firstIndex) {
                    firstIndex = match.index;
                    matchedText = match[0];
                }
            }
        }
        if (firstIndex !== -1) {
            matches.push({
                key: sec.key,
                label: sec.label,
                index: firstIndex,
                length: matchedText.length,
                patterns: sec.patterns
            });
        }
    });

    matches.sort((a, b) => a.index - b.index);

    const sections = {};
    if (matches.length === 0) {
        sections['desc'] = text;
    } else {
        const firstMatch = matches[0];
        if (firstMatch.index > 0) {
            sections['desc'] = text.substring(0, firstMatch.index).trim();
        }

        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i + 1];
            const startIdx = current.index + current.length;
            const endIdx = next ? next.index : text.length;

            let sectionContent = text.substring(startIdx, endIdx).trim();

            // Xóa các ký tự phi chữ cái (dấu hai chấm, dấu gạch ngang, khoảng trắng...) dư thừa ở đầu phần nội dung
            sectionContent = sectionContent.replace(/^[^a-zA-ZÀ-ỹ]+/i, '').trim();

            sections[current.key] = sectionContent;
        }
    }

    return sections;
}

/**
 * Định dạng văn bản thô thành HTML có ngắt dòng hợp lý, thẻ p, thẻ li, h4 cho sub-heading
 */
function formatSectionContent(text) {
    if (!text) return '';

    let formatted = text.trim();
    if (formatted.includes('<p>') || formatted.includes('<h3>') || formatted.includes('<br>')) {
        return formatted;
    }

    const lines = formatted.split(/\n+/);
    const resultHtml = [];

    lines.forEach(line => {
        let trimmedLine = line.trim();
        if (!trimmedLine) return;

        const subheaderKeywords = [
            'Liều dùng', 'Người lớn', 'Trẻ em', 'Người cao tuổi', 
            'Dược lực học', 'Dược động học', 'Hấp thu', 'Phân bố', 'Chuyển hóa', 'Thải trừ',
            'Triệu chứng', 'Điều trị', 'Chống chỉ định', 'Thận trọng', 'Tác dụng phụ',
            'Lưu ý', 'Làm gì khi dùng quá liều?', 'Làm gì khi quên 1 liều?'
        ];

        let isSubheader = false;
        for (let kw of subheaderKeywords) {
            if (trimmedLine.toLowerCase() === kw.toLowerCase() || 
                (trimmedLine.toLowerCase().startsWith(kw.toLowerCase()) && trimmedLine.length < kw.length + 15)) {
                isSubheader = true;
                break;
            }
        }

        if (isSubheader) {
            resultHtml.push(`<h4 class="detail-subheading">${trimmedLine}</h4>`);
        } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('+') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
            const itemText = trimmedLine.replace(/^[-+•*]\s*/, '');
            resultHtml.push(`<li>${itemText}</li>`);
        } else {
            // Tách các đoạn văn quá dài thành nhóm tối đa 2 câu để dễ đọc
            const sentences = trimmedLine.split(/(?<=\.|\?)\s+(?=[A-ZÀ-ỹ])/g);
            if (sentences.length > 2) {
                for (let i = 0; i < sentences.length; i += 2) {
                    const group = sentences.slice(i, i + 2).join(' ');
                    resultHtml.push(`<p>${group}</p>`);
                }
            } else {
                resultHtml.push(`<p>${trimmedLine}</p>`);
            }
        }
    });

    let htmlString = resultHtml.join('\n');
    htmlString = htmlString.replace(/(<li>.*?<\/li>\n?)+/g, match => `<ul>\n${match}</ul>\n`);

    return htmlString;
}

/**
 * Xem thêm / Thu gọn khung chi tiết
 */
function toggleReadmore() {
    const wrapper = document.querySelector('.pd-details-wrapper');
    if (!wrapper) return;
    if (wrapper.classList.contains('collapsed')) {
        expandDetailsFully();
    } else {
        collapseDetails();
    }
}

function expandDetailsFully() {
    const wrapper = document.querySelector('.pd-details-wrapper');
    const btn = document.querySelector('.btn-readmore');
    if (!wrapper) return;

    wrapper.classList.remove('collapsed');
    wrapper.style.maxHeight = wrapper.scrollHeight + 'px';

    // Đợi transition hoàn tất rồi gỡ max-height để tránh lỗi giao diện co giãn
    setTimeout(() => {
        if (!wrapper.classList.contains('collapsed')) {
            wrapper.style.maxHeight = 'none';
        }
    }, 400);

    if (btn) {
        btn.innerHTML = 'Thu gọn <i class="fa-solid fa-chevron-up"></i>';
    }
}

function collapseDetails() {
    const wrapper = document.querySelector('.pd-details-wrapper');
    const btn = document.querySelector('.btn-readmore');
    if (!wrapper) return;

    wrapper.classList.add('collapsed');
    wrapper.style.maxHeight = '400px';

    if (btn) {
        btn.innerHTML = 'Xem thêm <i class="fa-solid fa-chevron-down"></i>';
    }

    // Cuộn mượt trở lại đầu phần mô tả
    window.scrollTo({
        top: wrapper.offsetTop - 100,
        behavior: 'smooth'
    });
}

// Expose to window scope so onclick in dynamic HTML works
window.toggleReadmore = toggleReadmore;
window.expandDetailsFully = expandDetailsFully;
window.collapseDetails = collapseDetails;

function recalculateSubtotal() {
    if (!currentProduct) return;
    const qty = getSelectedQuantity();
    const price = Number(currentProduct.retail_price || 0);
    const subtotal = qty * price;
    const subtotalStr = new Intl.NumberFormat('vi-VN').format(Math.round(subtotal)) + "đ";
    const pdPriceText = document.getElementById('pdPrice');
    if (pdPriceText) {
        pdPriceText.textContent = subtotalStr;
    }
}
window.recalculateSubtotal = recalculateSubtotal;
