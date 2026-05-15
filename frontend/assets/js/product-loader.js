/**
 * product-loader.js
 * Cập nhật dữ liệu động cho trang chi tiết sản phẩm mới.
 */

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
        const response = await fetch(`http://localhost:8000/api/catalog/products/${id}`);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const result = await response.json();

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
    // 1. Breadcrumb
    const bc = document.getElementById('pdBreadcrumb');
    if (bc) {
        bc.innerHTML = `
            <a href="index.html">Trang chủ</a> <span>›</span> 
            ${p.category ? `<a href="category.html?id=${p.category.id}">${p.category.name}</a> <span>›</span>` : ''} 
            <strong style="color:#1f2937;">${p.name}</strong>
        `;
    }
    document.title = p.name + " — Nhà Thuốc Minh Giang";

    // 2. Info Col
    document.getElementById('pdBrand').textContent = p.brand?.name || p.manufacturer || "Đang cập nhật";
    document.getElementById('pdName').textContent = p.name;
    document.getElementById('pdSku').textContent = `SKU: ${p.sku}`;
    
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

    // 3. Price Box
    if (p.retail_price) {
        const priceStr = new Intl.NumberFormat('vi-VN').format(Math.round(p.retail_price)) + "đ";
        document.getElementById('pdPrice').textContent = priceStr;
        document.getElementById('pdPriceBox').innerHTML = `${priceStr} <span class="pd-price-unit">/ ${p.base_unit || 'Hộp'}</span>`;
    }

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

    // 5. Content
    const contentHtml = document.getElementById('pdContentHtml');
    if (contentHtml) {
        let desc = p.description || "Chưa có thông tin mô tả chi tiết.";
        if (!desc.includes('<')) desc = `<p>${desc.replace(/\n/g, '<br>')}</p>`;
        
        // Cố gắng định dạng lại content cho đẹp nếu là text thô
        desc = desc.replace(/Thành phần\s+Hàm lượng/g, '<h3>Thành phần</h3>');
        desc = desc.replace(/Công dụng/g, '<h3>Công dụng</h3>');
        desc = desc.replace(/Cách dùng/g, '<h3>Cách dùng</h3>');
        
        contentHtml.innerHTML = desc;
    }

    // 6. Action buttons
    const btnBuy = document.getElementById('btnBuyNow');
    const btnCart = document.getElementById('btnAddToCart');
    if (!p.in_stock) {
        if (btnBuy) { btnBuy.disabled = true; btnBuy.textContent = "Hết hàng"; btnBuy.style.opacity = 0.5; }
        if (btnCart) { btnCart.disabled = true; btnCart.textContent = "Hết hàng"; btnCart.style.opacity = 0.5; }
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
        const response = await fetch(`http://localhost:8000/api/catalog/products/${id}/alternatives`);
        if (!response.ok) throw new Error();
        const result = await response.json();
        
        let items = result.data?.alternatives || [];
        
        // Fallback: Nếu không tìm thấy thuốc thay thế cùng hoạt chất, tìm theo Danh mục (Category)
        if (items.length === 0 && categoryId) {
            const res2 = await fetch(`http://localhost:8000/api/catalog/products?category_id=${categoryId}&limit=5&exclude_id=${id}`);
            const json2 = await res2.json();
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
        const response = await fetch(`http://localhost:8000/api/catalog/products?limit=6&sort=popular`);
        const result = await response.json();
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
        const consultHtml = p.requires_prescription 
            ? `<div class="pd-mini-consult">Cần tư vấn từ dược sỹ</div>` 
            : `<div class="pd-mini-price">${new Intl.NumberFormat('vi-VN').format(Math.round(price))}đ</div>`;

        return `
            <a href="product.html?id=${p.id}" class="pd-mini-item">
                <img src="${p.image_url || '../assets/images/placeholder.png'}" class="pd-mini-img" alt="${p.name}">
                <div class="pd-mini-info">
                    <div class="pd-mini-name">${p.name}</div>
                    ${consultHtml}
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
        const response = await fetch(`http://localhost:8000/api/catalog/products/top-searches`);
        if (!response.ok) throw new Error();
        const result = await response.json();
        const items = result.data || [];
        
        if (items.length > 0) {
            container.innerHTML = items.map(t => `<a href="search.html?q=${encodeURIComponent(t.keyword)}" class="pd-tag">${t.keyword}</a>`).join('');
        } else {
            container.innerHTML = `
                <a href="#" class="pd-tag">Nước hồng sâm</a>
                <a href="#" class="pd-tag">Vitamin nhóm B</a>
                <a href="#" class="pd-tag">Bổ sung canxi</a>
                <a href="#" class="pd-tag">Men vi sinh</a>
                <a href="#" class="pd-tag">Khẩu trang</a>
            `;
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
        const response = await fetch(`http://localhost:8000/api/catalog/products?limit=15&sort=trending`);
        const result = await response.json();
        
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
        const response = await fetch(`http://localhost:8000/api/catalog/products?limit=15&ids=${productIds}`);
        const result = await response.json();
        
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
        const promises = viewedIds.map(id => fetch(`http://localhost:8000/api/catalog/products/${id}`).then(r => r.ok ? r.json() : null));
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
    const isRx = p.requires_prescription;
    const priceStr = p.retail_price ? new Intl.NumberFormat('en-US').format(Math.round(p.retail_price)) + 'đ' : 'Liên hệ';
    const oldPriceStr = p.retail_price ? new Intl.NumberFormat('en-US').format(Math.round(p.retail_price * 1.05)) + 'đ' : '';

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

    let actionHtml = `<button class="btn-add-cart" onclick="addToCart(${p.id}, event)">Thêm giỏ hàng</button>`;
    if (isRx) {
        actionHtml = `<button class="btn-consult" onclick="consult(${p.id}, event)">Tư vấn ngay</button>`;
    }

    return `
        <div class="product-card">
            <div class="product-image" onclick="window.location.href='product.html?id=${p.id}'" style="cursor:pointer;">
                <img src="${p.thumbnail || p.image_url || '../assets/images/placeholder.png'}" alt="${p.name}">
            </div>
            <div class="product-info">
                <h5><a href="product.html?id=${p.id}">${p.name}</a></h5>
                ${infoHtml}
            </div>
            ${actionHtml}
        </div>
    `;
}

/**
 * Tab Scroll Spy logic
 */
function initTabs() {
    const links = document.querySelectorAll('.pd-tab-link');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            links.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            const targetId = this.getAttribute('href').substring(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                window.scrollTo({
                    top: targetEl.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
    });
}
