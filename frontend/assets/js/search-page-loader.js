/**
 * search-page-loader.js
 * Xử lý tải dữ liệu sản phẩm cho trang kết quả tìm kiếm
 */

const API_BASE = 'http://localhost:8000/api/catalog';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    const page = urlParams.get('page') || 1;

    if (!query) {
        renderNoResults('Bạn chưa nhập từ khóa tìm kiếm.');
        return;
    }

    // Cập nhật UI ban đầu
    document.getElementById('searchTerm').textContent = query;
    document.title = `Kết quả tìm kiếm cho "${query}" — Nhà Thuốc Minh Giang`;

    fetchSearchResults(query, page);

    // Xử lý thay đổi sắp xếp
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            fetchSearchResults(query, 1, sortSelect.value);
        });
    }
});

async function fetchSearchResults(query, page = 1, sort = 'popular') {
    const grid = document.getElementById('searchResultGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading">Đang tìm kiếm sản phẩm...</div>';

    try {
        const response = await fetch(`${API_BASE}/products?q=${encodeURIComponent(query)}&page=${page}&limit=28&sort=${sort}`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            document.getElementById('totalCount').textContent = result.pagination.total;
            renderProducts(result.data);
            renderPagination(result.pagination, query);
        } else {
            renderNoResults(`Không tìm thấy sản phẩm nào khớp với từ khóa "${query}".`);
        }
    } catch (error) {
        console.error('[SearchPage] Error:', error);
        renderNoResults('Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại sau.');
    }
}

function renderProducts(products) {
    const grid = document.getElementById('searchResultGrid');
    grid.innerHTML = products.map(p => {
        // Logic hiển thị nút: Nếu cần tư vấn (thuốc kê đơn) thì hiện "Tư vấn ngay", ngược lại hiện "Thêm giỏ hàng"
        const btnText = p.requires_prescription ? 'Tư vấn ngay' : 'Thêm giỏ hàng';
        const btnClass = p.requires_prescription ? 'btn-add-cart btn-consult' : 'btn-add-cart';
        
        // Giá hiển thị
        const priceHtml = p.requires_prescription 
            ? '<span class="price-new" style="font-size:15px; color:#666;">Cần tư vấn từ dược sỹ</span>'
            : `<span class="price-new">${new Intl.NumberFormat('vi-VN').format(Math.round(p.price))}đ</span>`;

        return `
            <div class="product-card" data-product-id="${p.id}">
                <div class="product-image">
                    ${p.discount_percent > 0 ? `<span class="discount-badge">-${p.discount_percent}%</span>` : ''}
                    <img src="${p.image_url || '../assets/images/product1.png'}" alt="${p.name}">
                </div>
                <div class="product-info">
                    <h5><a href="product.html?id=${p.id}">${p.name}</a></h5>
                    <div class="product-price">
                        ${priceHtml}
                    </div>
                    <button class="${btnClass}">${btnText}</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderPagination(pagination, query) {
    const container = document.getElementById('searchPagination');
    if (!container) return;

    const { page, pages } = pagination;
    if (pages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    
    // Nút Previous
    if (page > 1) {
        html += `<button class="page-btn" onclick="changePage('${query}', ${page - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    }

    // Các trang (hiện đơn giản)
    for (let i = 1; i <= pages; i++) {
        if (i > 10) break; // Giới hạn hiển thị 10 trang
        html += `<button class="page-btn ${i == page ? 'active' : ''}" onclick="changePage('${query}', ${i})">${i}</button>`;
    }

    // Nút Next
    if (page < pages) {
        html += `<button class="page-btn" onclick="changePage('${query}', ${page + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    }

    container.innerHTML = html;
}

window.changePage = (query, page) => {
    fetchSearchResults(query, page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderNoResults(message) {
    const grid = document.getElementById('searchResultGrid');
    grid.innerHTML = `
        <div class="no-results" style="grid-column: 1 / -1;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <h2>${message}</h2>
            <p style="margin-top:10px; color:#666;">Hãy thử tìm kiếm với từ khóa khác hoặc kiểm tra lại chính tả.</p>
        </div>
    `;
    document.getElementById('totalCount').textContent = '0';
}
