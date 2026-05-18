/**
 * index-loader.js
 * Phụ trách nạp dữ liệu sản phẩm động từ API lên trang chủ
 */

const API_CATALOG = 'http://localhost:8000/api/catalog';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Nạp Flash Sale
    loadProductGrid('flashSaleGrid', { limit: 5, sort: 'newest' });

    // 2. Nạp Deal siêu khủng
    loadProductGrid('dealSieuKhungGrid', { limit: 5, sort: 'best_seller' });

    // 3. Nạp Sản phẩm mới
    loadProductGrid('sanPhamMoiGrid', { limit: 5, sort: 'newest' });

    // 4. Nạp Sản phẩm bán chạy
    loadProductGrid('sanPhamBanChayGrid', { limit: 5, sort: 'best_seller' });

    // 5. Nạp Giảm giá 38%
    loadProductGrid('giamGiaGrid', { limit: 4, sort: 'discount' });

    // 6. Nạp Nhập khẩu 100%
    loadProductGrid('nhapKhauGrid', { limit: 4, sort: 'newest' });

    // 7. Nạp Sản phẩm đang thu hút
    loadProductGrid('sanPhamThuHutGrid', { limit: 5, sort: 'best_seller' });
});

async function loadProductGrid(containerId, params) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`${API_CATALOG}/products?${query}`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            container.innerHTML = result.data.map(p => renderProductCard(p)).join('');
        }
    } catch (error) {
        console.error(`[IndexLoader] Error loading ${containerId}:`, error);
    }
}

function renderProductCard(p) {
    const oldPrice = Math.round(p.retail_price * 1.1);
    const newPrice = Math.round(p.retail_price);
    const format = (v) => new Intl.NumberFormat('vi-VN').format(v) + 'đ';

    return `
        <div class="product-card" data-product-id="${p.id}">
            <div class="product-image">
                <span class="discount-badge">-10%</span>
                <img src="${p.thumbnail || p.image_url || '../assets/images/product1.png'}" alt="${p.name}" onerror="this.src='../assets/images/product1.png'">
            </div>
            <div class="product-info">
                <h5><a href="product.html?id=${p.id}">${p.name}</a></h5>
                <div class="product-price">
                    <span class="price-old">${format(oldPrice)}</span>
                    <span class="price-now">${format(newPrice)}</span>
                </div>
                <button class="btn-add-cart" onclick="addToCart(${p.id}, event)">Thêm giỏ hàng</button>
            </div>
        </div>
    `;
}
