/**
 * cart-handler.js
 * Quản lý giỏ hàng phía Client (localStorage)
 */

const CART_KEY = 'mg_cart';

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
        const response = await fetch(`http://localhost:8000/api/catalog/products/${productId}`);
        const result = await response.json();

        if (!result.success || !result.data) {
            alert('Không tìm thấy thông tin sản phẩm.');
            return;
        }

        const product = result.data;
        let cart = getCart();
        
        const existingItem = cart.find(item => item.id == productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.retail_price || product.price,
                image: product.image_url || product.thumbnail,
                unit: product.base_unit || 'Hộp',
                quantity: 1
            });
        }

        saveCart(cart);
        
        // Hiệu ứng thông báo
        showToast(`Đã thêm ${product.name} vào giỏ hàng`);
        
    } catch (error) {
        console.error('[Cart] Error adding to cart:', error);
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
