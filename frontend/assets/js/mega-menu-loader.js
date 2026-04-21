/**
 * Mega Menu Loader
 * Fetches category tree and handles dynamic rendering of the navigation menu.
 */

const API_GATEWAY = 'http://localhost:8000/api/catalog';

// Gắn vào window để components.js có thể gọi sau khi nạp xong HTML
window.initMegaMenu = initMegaMenu;

async function initMegaMenu() {
    console.log('[MegaMenu] Initializing...');
    const navList = document.getElementById('main-nav-list');
    if (!navList) return;

    try {
        const response = await fetch(`${API_GATEWAY}/categories/tree`);
        const result = await response.json();

        if (result.success && result.data) {
            renderNavList(navList, result.data);

            // Tự động load nội dung cho danh mục đầu tiên (Thuốc) để sẵn sàng khi hover
            const firstRichCat = result.data.find(cat => cat.children && cat.children.length > 0 && ![7000, 8000, 9000].includes(cat.id));
            if (firstRichCat && firstRichCat.children[0]) {
                loadSubNav(firstRichCat.id, firstRichCat.children[0].id, firstRichCat.children[0].children);
            }
        }
    } catch (error) {
        console.error('[MegaMenu] Error fetching categories:', error);
    }
}

function renderNavList(container, categories) {
    container.innerHTML = categories.map(cat => {
        const isSimple = [7000, 8000, 9000].includes(cat.id);
        if (isSimple) return renderSimpleItem(cat);
        return renderRichItem(cat);
    }).join('');

    // Kích hoạt lại dropdown handler (centering & hover logic)
    if (typeof initDropdownHandler === 'function') {
        initDropdownHandler();
    }

    // Thêm event delegation cho các mục Level 1 (nav-item)
    // Để khi hover vào Level 1 thì tự động load sản phẩm của mục Level 2 đầu tiên
    const navItems = container.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            const dropdownContent = item.querySelector('.dropdown-content');
            if (dropdownContent) {
                const parentId = dropdownContent.getAttribute('data-parent-id');
                const firstSubItem = dropdownContent.querySelector('.dropdown-cat-item');
                if (firstSubItem) {
                    const subId = firstSubItem.getAttribute('data-id');
                    // Chỉ load nếu chưa có sản phẩm nào (tránh load lại nhiều lần vô ích)
                    const grid = document.getElementById(`grid-${parentId}`);
                    if (grid && (grid.innerHTML.trim() === '' || grid.querySelector('.loading'))) {
                        handleSubCategoryHover(parentId, subId);
                    }
                }
            }
        });
    });

    // Thêm event delegation cho sidebar items (Level 2)
    container.addEventListener('mouseover', (e) => {
        const catItem = e.target.closest('.dropdown-cat-item');
        if (catItem) {
            const dropdownContent = catItem.closest('.dropdown-content');
            if (!dropdownContent) return;
            const parentId = dropdownContent.getAttribute('data-parent-id');
            const subId = catItem.getAttribute('data-id');

            // Xử lý active state
            catItem.parentElement.querySelectorAll('.dropdown-cat-item').forEach(li => li.classList.remove('active'));
            catItem.classList.add('active');

            // Load Level 3 & Products
            handleSubCategoryHover(parentId, subId);
        }
    });
}

function renderRichItem(cat) {
    return `
        <li class="nav-item">
            <a href="category.html">${cat.name} <i class="fa-solid fa-chevron-down arrow-down"></i></a>
            <div class="dropdown-menu">
                <div class="dropdown-content" data-parent-id="${cat.id}">
                    <div class="dropdown-sidebar">
                        <ul class="dropdown-categories">
                            ${cat.children.map((sub, idx) => `
                                <li class="dropdown-cat-item ${idx === 0 ? 'active' : ''}" data-id="${sub.id}">
                                    <span>${sub.name}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    <div class="dropdown-products">
                        <div class="dropdown-subnav" id="subnav-${cat.id}">
                            ${cat.children[0] ? cat.children[0].children.map(l3 => `
                                <a href="category.html" class="subnav-pill" data-id="${l3.id}" onclick="loadProducts(${cat.id}, ${l3.id}, event)">
                                    <img src="../assets/images/category.png" alt="Icon">
                                    <span>${l3.name}</span>
                                </a>
                            `).join('') : ''}
                        </div>
                        <div class="dropdown-products-header">
                            <div class="header-title-area">
                                <span class="header-title">Bán chạy nhất</span>
                                <span class="separator">|</span>
                                <a href="category.html" class="view-all">Xem tất cả <i class="fa-solid fa-chevron-right"></i></a>
                            </div>
                        </div>
                        <div class="products-grid" id="grid-${cat.id}">
                            <!-- Product cards go here -->
                        </div>
                    </div>
                </div>
            </div>
        </li>
    `;
}

function renderSimpleItem(cat) {
    return `
        <li class="nav-item nav-item-simple">
            <a href="category.html">${cat.name} <i class="fa-solid fa-chevron-down arrow-down"></i></a>
            <div class="dropdown-menu dropdown-simple">
                <div class="dropdown-content">
                    <ul class="dropdown-simple-list">
                        ${cat.children.map(sub => `
                            <li class="dropdown-simple-item"><a href="category.html">${sub.name}</a></li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </li>
    `;
}

async function handleSubCategoryHover(parentId, subId) {
    // Tìm dữ liệu cache từ tree hoặc fetch lại nếu cần
    // Để đơn giản và nhanh, ta có thể lưu tree vào biến toàn cục
    if (!window.categoryTree) {
        const response = await fetch(`${API_GATEWAY}/categories/tree`);
        const result = await response.json();
        window.categoryTree = result.data;
    }

    const parentCat = window.categoryTree.find(c => c.id == parentId);
    if (!parentCat) return;

    const subCat = parentCat.children.find(s => s.id == subId);
    if (!subCat) return;

    loadSubNav(parentId, subId, subCat.children);
    loadProducts(parentId, subId);
}

function loadSubNav(parentId, subId, level3Cats) {
    const subnav = document.getElementById(`subnav-${parentId}`);
    if (!subnav) return;

    subnav.innerHTML = level3Cats.map(l3 => `
        <a href="category.html" class="subnav-pill" data-id="${l3.id}" onclick="loadProducts(${parentId}, ${l3.id}, event)">
            <img src="../assets/images/category.png" alt="Icon">
            <span>${l3.name}</span>
        </a>
    `).join('');

    // Mặc định load sản phẩm cho subId (Level 2)
    loadProducts(parentId, subId);
}

async function loadProducts(parentId, categoryId, event) {
    if (event) event.preventDefault();

    const grid = document.getElementById(`grid-${parentId}`);
    if (!grid) return;

    grid.innerHTML = '<div class="loading">Đang tải...</div>';

    try {
        const response = await fetch(`${API_GATEWAY}/products?category_id=${categoryId}&limit=4&sort=best_seller`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            grid.innerHTML = result.data.map(p => `
                <div class="product-card" data-product-id="${p.id}">
                    <div class="product-image">
                        <span class="discount-badge">-8%</span>
                        <img src="${p.image_url || '../assets/images/product1.png'}" alt="${p.name}">
                    </div>
                    <div class="product-info">
                        <h5><a href="product.html?id=${p.id}">${p.name}</a></h5>
                        <div class="product-price">
                            <span class="price-old">${new Intl.NumberFormat('en-US').format(Math.round(p.price * 1.1))}đ</span>
                            <span class="price-new">${new Intl.NumberFormat('en-US').format(Math.round(p.price))}đ</span>
                        </div>
                        <button class="btn-add-cart">Thêm giỏ hàng</button>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<div class="no-products">Chưa có sản phẩm trong danh mục này.</div>';
        }
    } catch (error) {
        console.error('[MegaMenu] Error loading products:', error);
        grid.innerHTML = '<div class="error">Lỗi khi tải sản phẩm.</div>';
    }
}
