/**
 * home-page-loader.js
 * Loads homepage content dynamically from API Gateway
 */

const GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
const API_BASE = GATEWAY + '/api';

document.addEventListener('DOMContentLoaded', () => {
    loadBanners();
    loadCategories();
    loadTrendingSearches();
    loadAllProductGrids();
});

// Helper to format currency
function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

// Render a single product card
function createProductCardHtml(p) {
    const isRx = p.requires_prescription;
    const formattedPrice = formatVND(p.retail_price || 0);
    const link = `product.html?id=${p.id}`;
    const imgUrl = p.image_url || '../assets/images/product_frame.png';
    const rxBadge = isRx ? '<span class="rx-badge" style="background:#ef4444; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">Rx</span>' : '';
    
    let infoHtml = `
        <div class="product-price">
            <span class="price-new">${formattedPrice}</span>
        </div>
    `;
    if (isRx) {
        infoHtml = `
            <div class="product-price">
                <span class="price-new" style="font-size:14px;color:#6b7280;font-style:italic;">Cần tư vấn từ dược sỹ</span>
            </div>
        `;
    }

    let actionHtml = `<button class="btn-add-cart" onclick="addToCart(${p.id}, event)">Thêm giỏ hàng</button>`;
    if (isRx) {
        actionHtml = `<button class="btn-add-cart btn-consult" onclick="event.preventDefault(); event.stopPropagation(); window.location.href='product.html?id=${p.id}'">Tư vấn ngay</button>`;
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
        <div class="product-card" data-product-id="${p.id}" onclick="window.location.href='${link}'" style="cursor: pointer;">
            <div class="product-image">
                <img src="${imgUrl}" alt="${p.name}" onerror="this.src='../assets/images/product_frame.png'">
            </div>
            <div class="product-info" onclick="event.stopPropagation();">
                <h5><a href="${link}">${p.name}</a>${rxBadge}</h5>
                ${infoHtml}
                ${stockHtml}
                ${actionHtml}
            </div>
        </div>
    `;
}

// 1. Load Banners
async function loadBanners() {
    try {
        const response = await fetch(`${API_BASE}/cms/banners?position=hero`);
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
            const sliderImages = document.getElementById('heroSliderImages');
            const sliderDots = document.getElementById('heroSliderDots');
            
            if (sliderImages) {
                sliderImages.innerHTML = result.data.map((banner, index) => `
                    <div class="slide ${index === 0 ? 'active' : ''}">
                        <img src="${banner.image_url}" alt="${banner.title || 'Banner'}">
                    </div>
                `).join('');
            }
            if (sliderDots) {
                sliderDots.innerHTML = result.data.map((_, index) => `
                    <span class="dot ${index === 0 ? 'active' : ''}" onclick="currentSlide(${index + 1})"></span>
                `).join('');
            }
        }
    } catch (e) {
        console.warn('[Home Page Loader] Error loading banners, using fallback:', e);
    }
}

// 2. Load Categories
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/catalog/categories`);
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
            const container = document.getElementById('grid-danh-muc-san-pham');
            if (container) {
                // Take top 10 categories
                const categories = result.data.slice(0, 10);
                const icons = [
                    '../assets/images/icon_category_than_kinh_nao.png',
                    '../assets/images/icon_category_vitamin_va_khoang_chat.png',
                    '../assets/images/icon_category_suc_khoe_tim_mach.png',
                    '../assets/images/icon_category_tang_cuong_de_khang.png',
                    '../assets/images/icon_category_ho_tro_tieu_hoa.png',
                    '../assets/images/icon_category_noi_tiet_sinh_ly.png',
                    '../assets/images/icon_category_dinh_duong.png',
                    '../assets/images/icon_category_ho_tro_dieu_tri.png'
                ];
                container.innerHTML = categories.map((cat, idx) => `
                    <a href="category.html?id=${cat.id}" class="category-item">
                        <img src="${cat.icon_url || icons[idx % icons.length]}" alt="${cat.name}" onerror="this.src='../assets/images/icon_category_than_kinh_nao.png'">
                        <span>${cat.name}</span>
                    </a>
                `).join('');
            }
        }
    } catch (e) {
        console.warn('[Home Page Loader] Error loading categories, using fallback:', e);
    }
}

// 3. Load Trending Searches
async function loadTrendingSearches() {
    try {
        const response = await fetch(`${API_BASE}/cms/trending-searches`);
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
            const container = document.getElementById('grid-trending-searches');
            if (container) {
                container.innerHTML = result.data.map(item => `
                    <a href="category.html?q=${encodeURIComponent(item.keyword)}" class="tag-item" onclick="trackSearch('${item.keyword}')">${item.keyword}</a>
                `).join('');
            }
        }
    } catch (e) {
        console.warn('[Home Page Loader] Error loading trending searches, using fallback:', e);
    }
}

async function trackSearch(keyword) {
    try {
        await fetch(`${API_BASE}/cms/trending-searches/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword })
        });
    } catch (e) { /* ignore */ }
}

// 4. Load All Product Grids
async function loadAllProductGrids() {
    const sections = [
        { id: 'grid-flash-sale', url: `${API_BASE}/catalog/products?limit=5&sort=newest` },
        { id: 'grid-deal-sieu-khung', url: `${API_BASE}/catalog/products?limit=5&sort=best_seller` },
        { id: 'grid-san-pham-ban-chay', url: `${API_BASE}/catalog/products?limit=5&sort=best_seller` },
        { id: 'grid-giam-gia', url: `${API_BASE}/catalog/products?limit=4&sort=popular` },
        { id: 'grid-san-pham-doc-quyen', url: `${API_BASE}/catalog/products?limit=5&sort=trending` },
        { id: 'grid-nhap-khau', url: `${API_BASE}/catalog/products?limit=4&origins=Mỹ,Pháp,Đức,Nhật,Úc,Hàn Quốc` },
        { id: 'grid-dang-thu-hut', url: `${API_BASE}/catalog/products?limit=6&sort=popular` }
    ];

    for (const sec of sections) {
        const el = document.getElementById(sec.id);
        if (!el) continue;

        try {
            const res = await fetch(sec.url);
            const result = await res.json();
            if (result.success && result.data && result.data.length > 0) {
                el.innerHTML = result.data.map(createProductCardHtml).join('');
            }
        } catch (e) {
            console.warn(`[Home Page Loader] Error loading product grid [${sec.id}], using fallback:`, e);
        }
    }
}
