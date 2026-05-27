/**
 * cart-handler.js
 * Quản lý giỏ hàng phía Client (localStorage)
 */

const CART_KEY = 'mg_cart';

function catalogApi() {
    if (window.MGCatalogApi) return window.MGCatalogApi;
    const baseUrl = window.MG_CATALOG_API_BASE || 'http://localhost:8000/api/catalog';
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

function normalizeCartProduct(product) {
    if (window.MGClientApi && typeof window.MGClientApi.normalizeProduct === 'function') {
        return window.MGClientApi.normalizeProduct(product);
    }
    const price = Number(product.retail_price || product.price || 0);
    return {
        ...product,
        price,
        retail_price: price,
        requires_prescription: Boolean(Number(product.requires_prescription || 0)),
        in_stock: product.in_stock !== false,
        image_url: product.image_url || product.thumbnail || product.image
    };
}

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
}

/**
 * Thêm sản phẩm vào giỏ
 */
async function addToCart(productId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    console.log(`[Cart] Adding product ID: ${productId}`);

    try {
        // Fetch product info to get name, price, image for the cart
        const result = await catalogApi().get(`products/${productId}`);

        if (!result.success || !result.data) {
            alert('Không tìm thấy thông tin sản phẩm.');
            return;
        }

        const product = result.data;
        const normalizedProduct = normalizeCartProduct(product);

        if (normalizedProduct.requires_prescription) {
            showToast('Thuốc kê đơn cần tư vấn dược sĩ trước khi đặt mua.');
            return;
        }

        if (!normalizedProduct.in_stock) {
            showToast('Sản phẩm hiện đã hết hàng.');
            return;
        }

        if (!normalizedProduct.price) {
            showToast('Sản phẩm chưa có giá bán, vui lòng liên hệ nhà thuốc.');
            return;
        }

        let cart = getCart();
        
        const existingItem = cart.find(item => item.id == productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: normalizedProduct.id,
                sku: normalizedProduct.sku || '',
                name: normalizedProduct.name,
                price: normalizedProduct.price,
                image: normalizedProduct.image_url || normalizedProduct.thumbnail,
                unit: normalizedProduct.base_unit || 'Hộp',
                quantity: 1,
                requires_prescription: normalizedProduct.requires_prescription,
                in_stock: normalizedProduct.in_stock
            });
        }

        saveCart(cart);
        
        // Hiệu ứng thông báo
        showToast(`Đã thêm ${normalizedProduct.name} vào giỏ hàng`);
        
    } catch (error) {
        console.error('[Cart] Error adding to cart:', error);
        showToast('Không thể thêm sản phẩm vào giỏ hàng lúc này.');
    }
}

/**
 * Cập nhật số lượng hiển thị trên icon giỏ hàng
 */
function updateCartBadge() {
    const cart = getCart();
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    const badge = document.querySelector('.cart-count'); // Giả định class này tồn tại trong header
    if (badge) {
        badge.textContent = totalCount;
        badge.style.display = totalCount > 0 ? 'flex' : 'none';
    }
}

/**
 * Hiển thị Toast thông báo nhanh
 */
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #0b7a3e;
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: 'Sarabun', sans-serif;
        font-weight: 500;
        transition: opacity 0.3s;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Khởi tạo badge khi load script
document.addEventListener('DOMContentLoaded', updateCartBadge);
window.addToCart = addToCart;
window.updateCartBadge = updateCartBadge;
window.getCart = getCart;
window.saveCart = saveCart;
window.showToast = showToast;
