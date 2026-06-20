/**
 * Mega Menu Loader
 * Fetches category tree and handles dynamic rendering of the navigation menu.
 */

function catalogApi() {
    if (window.MGCatalogApi) return window.MGCatalogApi;
    const gateway = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
    const baseUrl = window.MG_CATALOG_API_BASE || (gateway + '/api/catalog');
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

// Bind to window so components.js can invoke after HTML is loaded
window.initMegaMenu = initMegaMenu;

async function initMegaMenu() {
    console.log('[MegaMenu] Initializing...');
    const navList = document.getElementById('main-nav-list');
    if (!navList) return;

    try {
        const result = await catalogApi().get('categories/tree');

        if (result.success && result.data) {
            // Dynamically populate disease subcategories for B\u1ec7nh l\u00fd (7000)
            var diseaseCat = null;
            if (Array.isArray(result.data)) {
                for (var i = 0; i < result.data.length; i++) {
                    if (result.data[i].id === 7000) {
                        diseaseCat = result.data[i];
                        break;
                    }
                }
            }
            if (diseaseCat) {
                diseaseCat.children = [
                    { id: 'benh-chuyen-khoa', name: 'B\u1ec7nh chuy\u00ean khoa' },
                    { id: 'benh-man-tinh', name: 'B\u1ec7nh m\u00e3n t\u00ednh' },
                    { id: 'benh-theo-mua', name: 'B\u1ec7nh theo m\u00f9a' },
                    { id: 'benh-truyen-nhiem', name: 'B\u1ec7nh truy\u1ec1n nhi\u1ec5m' },
                    { id: 'benh-ung-thu', name: 'B\u1ec7nh ung th\u01b0' },
                    { id: 'benh-la-hiem-gap', name: 'B\u1ec7nh l\u1ea1 / B\u1ec7nh hi\u1ebfm g\u1eb7p' },
                    { id: 'benh-co-the-nguoi', name: 'B\u1ec7nh c\u01a1 th\u1ec3 ng\u01b0\u1eddi' },
                    { id: 'benh-theo-doi-tuong', name: 'B\u1ec7nh theo \u0111\u1ed1i t\u01b0\u1ee3ng' }
                ];
            }

            renderNavList(navList, result.data);

            // Auto-load content for the first rich category (usually Thu\u1ed1c)
            const firstRichCat = result.data.find(cat => cat.children && cat.children.length > 0 && ![7000, 8000, 9000].includes(cat.id));
            if (firstRichCat && firstRichCat.children[0]) {
                loadSubNav(firstRichCat.id, firstRichCat.children[0].id, firstRichCat.children[0].children);
            }
        }
    } catch (error) {
        console.error('[MegaMenu] Error fetching categories:', error);
    }
}

function getCategoryUrl(cat) {
    const mapping = {
        7000: 'disease.html',
        8000: 'health.html',
        9000: 'news.html'
    };
    if (typeof cat.id === 'string' && cat.id.indexOf('benh-') === 0) {
        return cat.id + '.html';
    }
    return mapping[cat.id] || `category.html?id=${cat.id}`;
}

function renderNavList(container, categories) {
    container.innerHTML = categories.map(cat => {
        const isSimple = [7000, 8000, 9000].includes(cat.id);
        if (isSimple) return renderSimpleItem(cat);
        return renderRichItem(cat);
    }).join('');

    // Re-initialize dropdown handler (centering & hover logic)
    if (typeof initDropdownHandler === 'function') {
        initDropdownHandler();
    }

    // Hover Level 1 nav items to load first Level 2 subcategory
    const navItems = container.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            const dropdownContent = item.querySelector('.dropdown-content');
            if (dropdownContent) {
                const parentId = dropdownContent.getAttribute('data-parent-id');
                const firstSubItem = dropdownContent.querySelector('.dropdown-cat-item');
                if (firstSubItem) {
                    const subId = firstSubItem.getAttribute('data-id');
                    const grid = document.getElementById(`grid-${parentId}`);
                    if (grid && (!grid.querySelector('.product-card') && !grid.querySelector('.no-products') && !grid.querySelector('.error'))) {
                        handleSubCategoryHover(parentId, subId);
                    }
                }
            }
        });
    });

    let hoverTimeout = null;
    let pendingCatItem = null;

    // Hover Level 2 sidebar items with hover-intent delay (150ms)
    container.addEventListener('mouseover', (e) => {
        const catItem = e.target.closest('.dropdown-cat-item');
        if (catItem) {
            if (catItem.classList.contains('active') || catItem === pendingCatItem) {
                return;
            }

            const dropdownContent = catItem.closest('.dropdown-content');
            if (!dropdownContent) return;
            const parentId = dropdownContent.getAttribute('data-parent-id');
            const subId = catItem.getAttribute('data-id');

            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
            pendingCatItem = catItem;

            hoverTimeout = setTimeout(() => {
                catItem.parentElement.querySelectorAll('.dropdown-cat-item').forEach(li => li.classList.remove('active'));
                catItem.classList.add('active');
                handleSubCategoryHover(parentId, subId);
                pendingCatItem = null;
            }, 150);
        }
    });

    container.addEventListener('mouseout', (e) => {
        const catItem = e.target.closest('.dropdown-cat-item');
        if (catItem && !catItem.contains(e.relatedTarget)) {
            if (catItem === pendingCatItem) {
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }
                pendingCatItem = null;
            }
        }
    });
}

function renderRichItem(cat) {
    return `
        <li class="nav-item">
            <a href="${getCategoryUrl(cat)}">${cat.name} <i class="fa-solid fa-chevron-down arrow-down"></i></a>
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
                                <a href="${getCategoryUrl(l3)}" class="subnav-pill" data-id="${l3.id}" onclick="loadProducts(${cat.id}, ${l3.id}, event)">
                                    <img src="../assets/images/category.png" alt="Icon">
                                    <span>${l3.name}</span>
                                </a>
                            `).join('') : ''}
                        </div>
                        <div class="dropdown-products-header">
                            <div class="header-title-area">
                                <span class="header-title">B\u00e1n ch\u1ea1y nh\u1ea5t</span>
                                <span class="separator">|</span>
                                <a href="${getCategoryUrl(cat)}" class="view-all">Xem t\u1ea5t c\u1ea3 <i class="fa-solid fa-chevron-right"></i></a>
                            </div>
                        </div>
                        <div class="products-grid" id="grid-${cat.id}"></div>
                    </div>
                </div>
            </div>
        </li>
    `;
}

function renderSimpleItem(cat) {
    const hasChildren = cat.children && cat.children.length > 0;
    const arrow = hasChildren ? ' <i class="fa-solid fa-chevron-down arrow-down"></i>' : '';
    const dropdown = hasChildren ? `
        <div class="dropdown-menu dropdown-simple">
            <div class="dropdown-content">
                <ul class="dropdown-simple-list">
                    ${cat.children.map(sub => `
                        <li class="dropdown-simple-item"><a href="${getCategoryUrl(sub)}">${sub.name}</a></li>
                    `).join('')}
                </ul>
            </div>
        </div>
    ` : '';

    return `
        <li class="nav-item nav-item-simple">
            <a href="${getCategoryUrl(cat)}">${cat.name}${arrow}</a>
            ${dropdown}
        </li>
    `;
}

async function handleSubCategoryHover(parentId, subId) {
    if (!window.categoryTree) {
        const result = await catalogApi().get('categories/tree');
        window.categoryTree = result.data;
    }

    const parentCat = window.categoryTree.find(c => c.id == parentId);
    if (!parentCat) return;

    const subCat = parentCat.children.find(s => s.id == subId);
    if (!subCat) return;

    loadSubNav(parentId, subId, subCat.children);
}

function loadSubNav(parentId, subId, level3Cats) {
    const subnav = document.getElementById(`subnav-${parentId}`);
    if (!subnav) return;

    subnav.innerHTML = level3Cats.map(l3 => `
        <a href="${getCategoryUrl(l3)}" class="subnav-pill" data-id="${l3.id}" onclick="loadProducts(${parentId}, ${l3.id}, event)">
            <img src="../assets/images/category.png" alt="Icon">
            <span>${l3.name}</span>
        </a>
    `).join('');

    loadProducts(parentId, subId);
}

async function loadProducts(parentId, categoryId, event) {
    if (event) event.preventDefault();

    const grid = document.getElementById(`grid-${parentId}`);
    if (!grid) return;

    // Hiển thị 4 card skeleton để giữ khung layout ổn định trong khi tải API
    grid.innerHTML = Array(4).fill().map(() => `
        <div class="product-card skeleton">
            <div class="skeleton-img"></div>
            <div class="product-info" style="display: flex; flex-direction: column; flex: 1;">
                <div class="skeleton-text skeleton-title"></div>
                <div class="skeleton-text skeleton-title-2"></div>
                <div class="skeleton-text skeleton-price"></div>
                <div class="skeleton-btn"></div>
            </div>
        </div>
    `).join('');

    try {
        const result = await catalogApi().get('products', {
            category_id: categoryId,
            limit: 4,
            sort: 'best_seller'
        });

        if (result.success && result.data.length > 0) {
            if (window.MGClientApi && typeof window.MGClientApi.renderProductCard === 'function') {
                grid.innerHTML = result.data.map((product) => {
                    const cardHtml = window.MGClientApi.renderProductCard(product);
                    return cardHtml.replace('class="product-card', 'class="product-card fade-in-card');
                }).join('');
                return;
            }

            grid.innerHTML = result.data.map(p => `
                <div class="product-card fade-in-card" data-product-id="${p.id}">
                    <div class="product-image">
                        <span class="discount-badge">-8%</span>
                        <img src="${p.image_url || '../assets/images/product1.png'}" alt="${p.name}">
                    </div>
                    <div class="product-info">
                        <h5><a href="product.html?id=${p.id}">${p.name}</a></h5>
                        <div class="product-price">
                            <span class="price-old">${new Intl.NumberFormat('en-US').format(Math.round(p.price * 1.1))}\u0111</span>
                            <span class="price-new">${new Intl.NumberFormat('en-US').format(Math.round(p.price))}\u0111</span>
                        </div>
                        <button class="btn-add-cart" onclick="event.stopPropagation(); event.preventDefault(); window.addToCart ? addToCart(${p.id}, event) : (window.location.href='product.html?id=${p.id}')">Th\u00eam gi\u1ecf h\u00e0ng</button>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<div class="no-products">Ch\u01b0a c\u00f3 s\u1ea3n ph\u1ea9m trong danh m\u1ee5c n\u00e0y.</div>';
        }
    } catch (error) {
        console.error('[MegaMenu] Error loading products:', error);
        grid.innerHTML = '<div class="error">L\u1ed7i khi t\u1ea3i s\u1ea3n ph\u1ea9m.</div>';
    }
}
