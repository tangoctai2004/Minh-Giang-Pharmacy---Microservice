/**
 * category-loader.js
 * Hiển thị danh sách sản phẩm từ API
 * Xử lý điều hướng đến product.html khi click vào sản phẩm
 */

document.addEventListener("DOMContentLoaded", async function () {
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('id');
    const page = Math.max(1, Number(params.get('page')) || 1);
    const sort = params.get('sort') || 'newest';

    // Nếu không có category_id, hiển thị tất cả sản phẩm
    await loadProducts(categoryId, page, sort);
});

/**
 * Fetch danh sách sản phẩm từ API
 */
async function loadProducts(categoryId, page, sort) {
    try {
        let url = `http://localhost:8000/api/catalog/products?page=${page}&limit=12&sort=${sort}`;
        
        if (categoryId) {
            url += `&category_id=${categoryId}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (result.success && result.data) {
            renderProductCards(result.data);
            updatePagination(result.pagination, categoryId, sort);
        } else {
            console.error('Lỗi lấy dữ liệu sản phẩm:', result);
        }
    } catch (error) {
        console.error('Lỗi fetch sản phẩm:', error);
    }
}

/**
 * Render product cards vào container
 */
function renderProductCards(products) {
    const container = document.querySelector('.product-grid');
    
    if (!container) {
        console.warn('Không tìm thấy container .product-grid');
        return;
    }

    // Clear existing hardcoded cards (ngoại trừ comment)
    // Chúng ta sẽ replace toàn bộ innerHTML
    container.innerHTML = products.map(product => `
        <div class="product-card">
            <div class="product-image">
                <img src="${product.image_url || '../assets/images/product_frame.png'}" 
                     alt="${product.name}"
                     onerror="this.src='../assets/images/product_frame.png'">
            </div>
            <div class="product-info">
                <h5>
                    <a href="product.html?id=${product.id}" class="product-link">
                        ${escapeHtml(product.name)}
                    </a>
                </h5>
                <div class="product-price">
                    <span class="price-new">${formatPrice(product.price || product.retail_price)}₫</span>
                    ${product.in_stock ? '' : '<span class="out-of-stock" style="color: #dc2626; margin-left: 8px;">Hết hàng</span>'}
                </div>
                <button class="btn-add-cart" onclick="handleAddToCart(event, ${product.id}, '${escapeHtml(product.name)}')">
                    ${product.in_stock ? 'Thêm giỏ hàng' : 'Thông báo'}
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Cập nhật pagination
 */
function updatePagination(pagination, categoryId, sort) {
    const paginationContainer = document.querySelector('.pagination');
    
    if (!paginationContainer) {
        console.warn('Không tìm thấy container .pagination');
        return;
    }

    let paginationHtml = '';
    
    // Previous button
    if (pagination.page > 1) {
        const prevPage = pagination.page - 1;
        const prevUrl = buildPageUrl(categoryId, prevPage, sort);
        paginationHtml += `<a href="${prevUrl}" class="page-btn">‹ Trước</a>`;
    }

    // Page numbers
    for (let i = 1; i <= pagination.pages; i++) {
        const pageUrl = buildPageUrl(categoryId, i, sort);
        if (i === pagination.page) {
            paginationHtml += `<span class="page-btn active">${i}</span>`;
        } else if (
            i === 1 || 
            i === pagination.pages || 
            (i >= pagination.page - 2 && i <= pagination.page + 2)
        ) {
            paginationHtml += `<a href="${pageUrl}" class="page-btn">${i}</a>`;
        } else if (i === 2 || i === pagination.pages - 1) {
            paginationHtml += '<span class="page-btn">...</span>';
        }
    }

    // Next button
    if (pagination.page < pagination.pages) {
        const nextPage = pagination.page + 1;
        const nextUrl = buildPageUrl(categoryId, nextPage, sort);
        paginationHtml += `<a href="${nextUrl}" class="page-btn">Tiếp › </a>`;
    }

    paginationContainer.innerHTML = paginationHtml;

    // Re-bind page button click handlers
    document.querySelectorAll('.page-btn').forEach(btn => {
        if (btn.tagName === 'A') {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = btn.href;
            });
        }
    });
}

/**
 * Build URL cho page
 */
function buildPageUrl(categoryId, page, sort) {
    let url = 'category.html?page=' + page;
    if (categoryId) {
        url += '&id=' + categoryId;
    }
    if (sort) {
        url += '&sort=' + sort;
    }
    return url;
}

/**
 * Format giá tiền VN
 */
function formatPrice(price) {
    if (!price) return '0';
    return new Intl.NumberFormat('vi-VN').format(Math.round(price));
}

/**
 * Escape HTML để tránh XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Handle "Thêm giỏ hàng" click
 */
function handleAddToCart(event, productId, productName) {
    event.preventDefault();
    event.stopPropagation();
    
    // TODO: Implement add to cart logic
    console.log('Thêm vào giỏ hàng:', productId, productName);
    alert(`Chức năng "Thêm giỏ hàng" sẽ được cập nhật. Sản phẩm: ${productName}`);
}

/**
 * Sort functionality
 */
function handleSort(sortValue) {
    const params = new URLSearchParams(window.location.search);
    params.set('sort', sortValue);
    params.set('page', '1');
    window.location.search = params.toString();
}
