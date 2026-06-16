/**
 * cart-handler.js
 * Quản lý giỏ hàng phía Client và đồng bộ Server
 */

(function initCartHandler() {
    const GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
    const API_BASE_ORDER = GATEWAY + '/api/order';
    const API_BASE_CATALOG = GATEWAY + '/api/catalog';

    /**
     * Thêm sản phẩm vào giỏ (Xử lý cả Local và Server)
     */
    async function addToCart(productId, event, options = {}) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const auth = _getAuth();
        if (auth && auth.accessToken) {
            // 1. Thêm lên SERVER nếu đã login
            return await _addToCartServer(productId, options);
        } else {
            // 2. Fallback: Lưu tạm vào local storage
            return await _addToCartLocal(productId, options);
        }
    }

    function _normalizeCatalogProduct(product) {
        const price = Number(product.retail_price || product.price || 0);
        return {
            ...product,
            price,
            requires_prescription: Boolean(Number(product.requires_prescription || 0)),
            in_stock: product.in_stock !== false,
            thumbnail: product.thumbnail || product.image_url || product.image
        };
    }

    function _canAddCatalogProduct(product) {
        if (product.requires_prescription) {
            showToast('Thuốc kê đơn cần tư vấn dược sĩ trước khi đặt mua.');
            return false;
        }
        if (!product.in_stock) {
            showToast('Sản phẩm hiện đã hết hàng.');
            return false;
        }
        if (!product.price) {
            showToast('Sản phẩm chưa có giá bán, vui lòng liên hệ nhà thuốc.');
            return false;
        }
        return true;
    }

    /**
     * Gọi API thêm vào giỏ hàng cục bộ (localStorage)
     */
    async function _addToCartLocal(productId, options) {
        try {
            const resProd = await fetch(`${API_BASE_CATALOG}/products/${productId}`);
            const prodData = await resProd.json();
            
            if (!prodData.success) throw new Error('Không lấy được thông tin sản phẩm');
            const p = _normalizeCatalogProduct(prodData.data);
            if (!_canAddCatalogProduct(p)) return false;

            let cart = JSON.parse(localStorage.getItem('MG_CLIENT_CART') || '[]');
            const existingItem = cart.find(item => item.product_id === productId);
            const quantity = options.quantity || 1;

            if (existingItem) {
                existingItem.quantity += quantity;
                existingItem.subtotal = existingItem.quantity * existingItem.unit_price;
            } else {
                // Dùng id timestamp làm id ảo cho cart item cục bộ
                cart.push({
                    id: Date.now(),
                    product_id: productId,
                    product_name: p.name,
                    product_sku: p.sku,
                    thumbnail: p.thumbnail,
                    quantity: quantity,
                    unit_name: p.base_unit || 'Hộp',
                    unit_price: p.price,
                    subtotal: p.price * quantity
                });
            }

            localStorage.setItem('MG_CLIENT_CART', JSON.stringify(cart));
            showToast(`Đã thêm ${p.name} vào giỏ hàng (Local)`);
            updateCartBadge();
            if (typeof window.loadCartData === 'function') {
                window.loadCartData();
            }
            return true;
        } catch (error) {
            console.error('[Cart Local] Error:', error);
            alert('Lỗi khi thêm vào giỏ hàng cục bộ');
            return false;
        }
    }

    /**
     * Gọi API thêm vào giỏ hàng trên server
     */
    async function _addToCartServer(productId, options) {
        try {
            const auth = _getAuth();
            
            // Lấy thêm thông tin sản phẩm từ catalog (để snapshot)
            const resProd = await fetch(`${API_BASE_CATALOG}/products/${productId}`);
            const prodData = await resProd.json();
            
            if (!prodData.success) throw new Error('Không lấy được thông tin sản phẩm');
            const p = _normalizeCatalogProduct(prodData.data);
            if (!_canAddCatalogProduct(p)) return false;

            const response = await fetch(`${API_BASE_ORDER}/cart/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.accessToken}`
                },
                body: JSON.stringify({
                    product_id: productId,
                    product_name: p.name,
                    product_sku: p.sku,
                    thumbnail: p.thumbnail,
                    quantity: options.quantity || 1,
                    unit_name: p.base_unit || 'Hộp',
                    unit_price: p.price
                })
            });

            const result = await response.json();
            if (result.success) {
                showToast(`Đã thêm ${p.name} vào giỏ hàng`);
                updateCartBadge();
                if (typeof window.loadCartData === 'function') {
                    window.loadCartData();
                }
                return true;
            } else {
                alert(result.message || 'Lỗi khi thêm vào giỏ hàng');
                return false;
            }
        } catch (error) {
            console.error('[Cart] Error:', error);
            alert('Không thể kết nối đến máy chủ giỏ hàng');
            return false;
        }
    }

    /**
     * Cập nhật số lượng hiển thị trên icon giỏ hàng
     */
    async function updateCartBadge() {
        const auth = _getAuth();
        const badge = document.querySelector('.cart-count');
        if (!badge) return;

        if (auth && auth.accessToken) {
            try {
                const response = await fetch(`${API_BASE_ORDER}/cart`, {
                    headers: { 'Authorization': `Bearer ${auth.accessToken}` }
                });
                const result = await response.json();
                if (result.success) {
                    const totalCount = (result.data.items || []).length;
                    badge.textContent = totalCount;
                    badge.style.display = totalCount > 0 ? 'flex' : 'none';
                }
            } catch (e) { badge.style.display = 'none'; }
        } else {
            try {
                const cart = JSON.parse(localStorage.getItem('MG_CLIENT_CART') || '[]');
                const totalCount = cart.length;
                badge.textContent = totalCount;
                badge.style.display = totalCount > 0 ? 'flex' : 'none';
            } catch (e) {
                badge.style.display = 'none';
            }
        }
    }

    function _getAuth() {
        try {
            return JSON.parse(localStorage.getItem('MG_CLIENT_AUTH'));
        } catch (e) { return null; }
    }

    /**
     * Hiển thị Toast thông báo nhanh
     */
    function showToast(message) {
        const old = document.getElementById('mg-toast');
        if (old) old.remove();

        const toast = document.createElement('div');
        toast.id = 'mg-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(11, 122, 62, 0.95);
            color: #fff;
            padding: 12px 24px;
            border-radius: 50px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: 'Sarabun', sans-serif;
            font-size: 14px;
            font-weight: 600;
            transition: opacity 0.3s, transform 0.3s;
        `;
        toast.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:8px;"></i> ${message}`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Khởi tạo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateCartBadge);
    } else {
        updateCartBadge();
    }

    // Export ra global scope
    window.addToCart = addToCart;
    window.updateCartBadge = updateCartBadge;
})();
