/**
 * product-loader.js
 * Chèn dữ liệu động vào đúng các thẻ ID trong trang product.html 
 * mà không làm thay đổi cấu trúc giao diện gốc.
 */

document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        console.warn("❌ Không tìm thấy ID sản phẩm trên URL. Thêm ?id=<product_id>");
        showErrorMessage("Không tìm thấy sản phẩm");
        return;
    }

    fetchProductData(productId);
});

/**
 * Fetch dữ liệu sản phẩm từ API
 */
async function fetchProductData(id) {
    try {
        console.log(`📦 Fetching product ${id}...`);
        
        const response = await fetch(`http://localhost:8000/api/catalog/products/${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();

        if (result.success && result.data) {
            console.log('✅ Dữ liệu sản phẩm:', result.data);
            updateProductUI(result.data);
        } else {
            throw new Error(result.message || 'API trả về success: false');
        }
    } catch (error) {
        console.error("❌ Lỗi khi tải dữ liệu sản phẩm:", error);
        showErrorMessage("Không thể tải thông tin sản phẩm. Vui lòng thử lại.");
    }
}

/**
 * Hiển thị thông báo lỗi
 */
function showErrorMessage(message) {
    const container = document.querySelector('.pd-top') || document.querySelector('.container');
    if (container) {
        container.innerHTML = `
            <div style="background: #fef2f2; border: 1px solid #fca5a5; color: #7f1d1d; padding: 20px; border-radius: 8px;">
                <h3>⚠️ Lỗi</h3>
                <p>${message}</p>
                <a href="category.html" style="color: #0b7a3e; text-decoration: underline;">← Quay lại danh mục</a>
            </div>
        `;
    }
}

function updateProductUI(p) {
    // 1. Cập nhật Title và Breadcrumb
    const breadcrumbTitle = document.getElementById('pd-breadcrumb-title');
    const pageTitle = document.getElementById('pd-name');
    if (breadcrumbTitle) breadcrumbTitle.textContent = p.name;
    if (pageTitle) pageTitle.textContent = p.name;
    document.title = p.name + " — Nhà Thuốc Minh Giang";

    // 2. Cập nhật Breadcrumb danh mục
    const catParent = document.getElementById('pd-cat-parent');
    const catCurrent = document.getElementById('pd-cat-current');
    if (p.category) {
        if (catCurrent) {
            catCurrent.textContent = p.category.name;
            catCurrent.href = `category.html?id=${p.category.id}`;
        }
        if (p.category.parent && catParent) {
            catParent.textContent = p.category.parent.name;
            catParent.href = `category.html?id=${p.category.parent.id}`;
        }
    }

    // 3. Cập nhật Thương hiệu & Đánh giá & Tồn kho
    const brandContainer = document.getElementById('pd-brand');
    const salesCount = document.getElementById('pd-sales');
    const stockStatus = document.getElementById('pd-stock-status');
    
    if (p.brand && brandContainer) {
        brandContainer.textContent = p.brand.name;
        brandContainer.href = `category.html?brand_id=${p.brand.id}`;
    }
    
    if (salesCount) salesCount.textContent = `Đã bán ${formatNumber(p.sales_volume || 0)}`;
    
    // Hiển thị tồn kho
    if (stockStatus) {
        const stockHtml = p.in_stock 
            ? `<span style="color: #22c55e; font-weight: 600;">✓ Còn hàng</span> <span style="color: #9ca3af;">(${formatNumber(p.total_stock || 0)} ${p.base_unit || 'cái'})</span>`
            : `<span style="color: #dc2626; font-weight: 600;">✗ Hết hàng</span>`;
        stockStatus.innerHTML = stockHtml;
    }

    // 4. Cập nhật Giá
    const priceNew = document.getElementById('pd-price-new');
    const priceOld = document.getElementById('pd-price-old');
    const discountTag = document.getElementById('pd-discount');

    if (p.retail_price !== undefined) {
        const formattedPrice = new Intl.NumberFormat('vi-VN').format(p.retail_price) + "₫";
        if (priceNew) {
            const unitText = p.base_unit ? `/ ${p.base_unit}` : "";
            priceNew.innerHTML = `${formattedPrice}<span class="pd-price-unit">${unitText}</span>`;
        }
        
        // Giả lập giá cũ (thường cao hơn 10-20%)
        const oldPriceVal = Math.round(p.retail_price * 1.15);
        if (priceOld) priceOld.textContent = new Intl.NumberFormat('vi-VN').format(oldPriceVal) + "₫";
        if (discountTag) discountTag.textContent = "-15%";
    }

    // 5. Cập nhật Hình ảnh & Gallery
    const mainImg = document.getElementById('pdMainImg');
    if (p.image_url && mainImg) {
        mainImg.src = p.image_url;
        mainImg.alt = p.name;
    }
    
    const thumbContainer = document.querySelector('.pd-thumbs');
    if (thumbContainer && (p.gallery || p.image_url)) {
        let galleryItems = [];
        if (p.image_url) galleryItems.push(p.image_url);
        
        // Gallery có thể là string JSON hoặc Array tùy API
        let additionalImgs = [];
        try {
            if (p.gallery) {
                additionalImgs = typeof p.gallery === 'string' ? JSON.parse(p.gallery) : p.gallery;
            }
        } catch(e) {
            console.warn('Lỗi parse gallery:', e);
        }
        
        if (Array.isArray(additionalImgs) && additionalImgs.length > 0) {
            galleryItems = [...galleryItems, ...additionalImgs];
        }

        if (galleryItems.length > 0) {
            // Giới hạn 4 ảnh
            const displayImages = galleryItems.slice(0, 4);
            thumbContainer.innerHTML = displayImages.map((img, i) => `
                <img src="${img}" 
                     alt="Hình ảnh ${i+1}" 
                     class="pd-thumb ${i===0 ? 'active' : ''}" 
                     onclick="changeImg(this)"
                     onerror="this.src='../assets/images/product_frame.png'">
            `).join('');
        }
    }

    // 6. Cập nhật Mô tả ngắn
    const shortDesc = document.getElementById('pd-short-desc');
    if (p.description && shortDesc) {
        const desc = p.description.replace(/<[^>]*>/g, ''); // Remove HTML tags
        shortDesc.textContent = desc.length > 250 ? desc.substring(0, 250) + "..." : desc;
    }

    // 7. Cập nhật Bảng thông số (Spec Table)
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "Đang cập nhật";
    };

    setVal('pd-sku', p.sku);
    setVal('pd-spec-cat', p.category?.name);
    setVal('pd-spec-brand', p.brand?.name || "—");
    setVal('pd-spec-form', p.base_unit);
    setVal('pd-spec-packing', p.base_unit);
    setVal('pd-spec-ingredient', p.active_ingredient || "—");
    setVal('pd-spec-origin', p.country_of_origin || "Việt Nam");
    setVal('pd-spec-reg', p.registration_number || "—");
    setVal('pd-spec-manufacturer', p.manufacturer || "—");
    setVal('pd-spec-prescription', p.requires_prescription ? "Thuốc kê đơn (cần hóa đơn)" : "Thuốc không kê đơn");

    // 8. Cập nhật nội dung các Tabs
    const detailDesc = document.getElementById('pd-detail-desc');
    if (detailDesc) {
        const desc = p.description || "Thông tin sản phẩm đang được cập nhật...";
        detailDesc.innerHTML = typeof desc === 'string' && desc.includes('<') 
            ? desc 
            : `<p>${desc.replace(/\n/g, '<br>')}</p>`;
    }

    // Đổ dữ liệu từ specifications vào các tab tương ứng
    if (p.specifications && Array.isArray(p.specifications)) {
        p.specifications.forEach(spec => {
            let targetId = '';
            const key = (spec.spec_key || '').toLowerCase();
            
            if (key.includes('thành phần') || key.includes('công dụng')) {
                targetId = 'pd-tab-content-ingredients';
            } else if (key.includes('công dụng')) {
                targetId = 'pd-tab-content-usage';
            } else if (key.includes('liều dùng') || key.includes('cách dùng')) {
                targetId = 'pd-tab-content-dosage';
            } else if (key.includes('bảo quản')) {
                targetId = 'pd-tab-content-storage';
            }
            
            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) {
                    const content = (spec.spec_value || '').replace(/\n/g, '<br>');
                    el.innerHTML = `<p>${content}</p>`;
                }
            }
        });
    }

    // 9. Disable/Enable nút "Mua ngay" và "Thêm giỏ" nếu hết hàng
    const buyNowBtn = document.querySelector('button[onclick*="mua"]') || document.querySelector('.btn-buy-now');
    const addToCartBtn = document.querySelector('.btn-add-cart') || document.querySelector('[onclick*="add-cart"]');
    
    if (!p.in_stock) {
        if (buyNowBtn) {
            buyNowBtn.disabled = true;
            buyNowBtn.style.opacity = '0.5';
            buyNowBtn.style.cursor = 'not-allowed';
            buyNowBtn.textContent = 'Hết hàng';
        }
        if (addToCartBtn) {
            addToCartBtn.disabled = true;
            addToCartBtn.style.opacity = '0.5';
            addToCartBtn.style.cursor = 'not-allowed';
            addToCartBtn.textContent = 'Hết hàng - Thông báo';
        }
    }

    console.log('✅ Cập nhật UI thành công');
}

/**
 * Format số thành dạng có dấu phẩy
 */
function formatNumber(num) {
    return new Intl.NumberFormat('vi-VN').format(num);
}
