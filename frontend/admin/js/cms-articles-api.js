/**
 * cms-articles-api.js
 * Frontend controller for Medical Content CMS (cms-articles.html) in Admin Portal.
 * Handles stats, articles listing/filtering/pagination, disease categories, base64 media uploads,
 * related products autocomplete, and standard rich-text articles editor.
 */

var API_BASE = localStorage.getItem('MG_API_BASE') || (
    (window.location.origin.includes('localhost:5500') ||
     window.location.origin.includes('localhost:5501') ||
     window.location.origin.includes('127.0.0.1:5500') ||
     window.location.origin.includes('127.0.0.1:5501'))
    ? 'http://localhost:8000/api'
    : window.location.origin.replace(/\/+$/, '') + '/api'
);

// State Management
var currentPage = 1;
var currentLimit = 10;
var currentCategoryId = 'all';
var currentCategoryType = 'all'; // 'all', 'article', 'disease'
var searchQuery = '';
var statusFilter = 'all';
var sortFilter = 'newest';

var activeArticleId = null; // null for 'new'
var articleTags = [];
var coverImageUrl = '';
var selectedProducts = []; // items linked { id, name }
var productCache = [];
var relatedArticles = []; // bài viết liên quan cùng danh mục

// On DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
    initCmsPage();
    setupEventListeners();
});

async function initCmsPage() {
    loadStats();
    await loadCategories();
    loadArticles();
    loadCategoriesList(); // Tab 2 Table
    loadMediaLibrary(); // Tab 3 Gallery
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function getHeaders() {
    var authRaw = localStorage.getItem('MG_ADMIN_AUTH');
    var token = '';
    if (authRaw) {
        try {
            token = JSON.parse(authRaw).accessToken || '';
        } catch (e) {}
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}


function debounce(func, wait) {
    var timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function toSlug(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '')
        .replace(/(\s+)/g, '-')
        .replace(/-+/g, '-')
}

function resolveImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    if (url.startsWith('..') || url.startsWith('assets/')) {
        return url;
    }
    var base = API_BASE.replace(/\/api\/?$/, '');
    var separator = url.startsWith('/') ? '' : '/';
    return base + separator + url;
}

// ──────────────────────────────────────────────
// EVENT LISTENERS SETUP
// ──────────────────────────────────────────────
function setupEventListeners() {
    // Search input (Tab 1)
    document.getElementById('article-search-input')?.addEventListener('input', debounce(() => {
        currentPage = 1;
        searchQuery = document.getElementById('article-search-input').value;
        loadArticles();
    }, 300));

    // Status filter
    document.getElementById('article-status-filter')?.addEventListener('change', () => {
        currentPage = 1;
        statusFilter = document.getElementById('article-status-filter').value;
        loadArticles();
    });

    // Sort filter
    document.getElementById('article-sort-filter')?.addEventListener('change', () => {
        sortFilter = document.getElementById('article-sort-filter').value;
        loadArticles();
    });

    // Add Category Form (Tab 2)
    document.getElementById('category-add-form')?.addEventListener('submit', handleCategoryAdd);

    // Media Search (Tab 3)
    document.getElementById('media-search-input')?.addEventListener('input', debounce(() => {
        loadMediaLibrary();
    }, 300));

    // Cover image uploader in Editor Modal
    var fileInputCover = document.getElementById('article-cover-file-input');
    fileInputCover?.addEventListener('change', handleCoverUpload);

    // Related products input autocomplete
    var prodInput = document.getElementById('article-product-search');
    prodInput?.addEventListener('input', debounce(handleProductSearch, 300));
    prodInput?.addEventListener('focus', handleProductSearch);
    
    // Hide product dropdown when click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#article-product-search') && !e.target.closest('#article-product-dropdown')) {
            document.getElementById('article-product-dropdown').style.display = 'none';
        }
    });

    // Related articles input autocomplete
    var artInput = document.getElementById('article-article-search');
    artInput?.addEventListener('input', debounce(handleArticleSearch, 300));
    artInput?.addEventListener('focus', handleArticleSearch);
    
    // Hide article dropdown when click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#article-article-search') && !e.target.closest('#article-article-dropdown')) {
            var dropdown = document.getElementById('article-article-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    });

    // Tags input
    var tagInput = document.getElementById('article-tag-input');
    tagInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            var val = tagInput.value.trim();
            if (val && !articleTags.includes(val)) {
                articleTags.push(val);
                renderTagsChips();
                schedulePreviewUpdate();
            }
            tagInput.value = '';
        }
    });

    // Media file input click
    var mediaInput = document.getElementById('media-file-input');
    mediaInput?.addEventListener('change', handleMediaUpload);

    // Media drag & drop
    var dropzone = document.getElementById('media-dropzone');
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.background = '#f1f5f9';
            dropzone.style.borderColor = '#3b82f6';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.background = '#f8fafc';
            dropzone.style.borderColor = '#cbd5e1';
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.background = '#f8fafc';
            dropzone.style.borderColor = '#cbd5e1';
            
            var files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadImageFile(files[0]);
            }
        });
        dropzone.addEventListener('click', () => {
            mediaInput.click();
        });
    }

    // Auto suggest inputs for new categories
    var catNameInput = document.getElementById('cat-name-input');
    catNameInput?.addEventListener('input', (e) => {
        var val = e.target.value.trim();
        var slugInput = document.getElementById('cat-slug-input');
        if (slugInput) slugInput.value = toSlug(val);
        suggestIconAndColor(val);
    });

    var picker = document.getElementById('cat-color-picker');
    var colorInp = document.getElementById('cat-color-input');
    picker?.addEventListener('input', (e) => {
        if (colorInp) colorInp.value = e.target.value;
    });
    colorInp?.addEventListener('input', (e) => {
        var val = e.target.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(val) && picker) {
            picker.value = val;
        }
    });

    // Category icon upload button trigger click
    var btnUploadCatIcon = document.getElementById('btn-upload-cat-icon');
    var catIconFileInput = document.getElementById('cat-icon-file-input');
    
    btnUploadCatIcon?.addEventListener('click', () => {
        catIconFileInput?.click();
    });
    
    catIconFileInput?.addEventListener('change', handleCatIconUpload);

    // Init Icon Picker components
    initIconPicker();
}

// ──────────────────────────────────────────────
// STATS CARD LOADING
// ──────────────────────────────────────────────
async function loadStats() {
    try {
        var res = await fetch(`${API_BASE}/cms/articles/admin/stats`, { headers: getHeaders() });
        var result = await res.json();
        if (result.success && result.data) {
            var stats = result.data;
            document.getElementById('stat-total-articles').innerText = stats.total_articles || 0;
            document.getElementById('stat-published-articles').innerText = stats.published_articles || 0;
            document.getElementById('stat-draft-articles').innerText = stats.draft_articles || 0;
            document.getElementById('stat-total-views').innerText = (stats.total_views || 0).toLocaleString('vi-VN');
        }
    } catch (e) {
        console.error('Error loading stats:', e);
    }
}

// ──────────────────────────────────────────────
// CATEGORIES & SIDEBAR
// ──────────────────────────────────────────────
var globalCategories = [];

async function loadCategories() {
    try {
        var res = await fetch(`${API_BASE}/cms/categories`, { headers: getHeaders() });
        var result = await res.json();
        if (result.success && Array.isArray(result.data)) {
            globalCategories = result.data;
            renderSidebarCategories();
            populateCategorySelect();
            populateParentCategorySelect();
        }
    } catch (e) {
        console.error('Error loading categories:', e);
    }
}

function populateParentCategorySelect() {
    var parentSelect = document.getElementById('cat-parent-select');
    if (!parentSelect) return;
    
    var currentVal = parentSelect.value;
    
    parentSelect.innerHTML = '<option value="">(Không có - Danh mục gốc)</option>';
    
    // Sort categories alphabetically
    var sortedCats = [...globalCategories].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    
    sortedCats.forEach(cat => {
        var typeText = cat.type === 'article' ? 'Chủ đề' : cat.type === 'disease' ? 'Bệnh lý' : 'Khuyến mãi';
        parentSelect.innerHTML += `<option value="${cat.id}">${cat.name} (${typeText})</option>`;
    });
    
    if (currentVal && globalCategories.some(c => c.id == currentVal)) {
        parentSelect.value = currentVal;
    }
}

function renderSidebarCategories() {
    var list = document.getElementById('sidebar-category-list');
    if (!list) return;

    // Reset list keeping the 'All' item
    var allItem = list.querySelector('[data-id="all"]');
    list.innerHTML = '';
    if (allItem) list.appendChild(allItem);

    // Group categories to show in sidebar:
    // 1. type = 'article' (General topics)
    // 2. type = 'disease' and parent_id = 2 (Pathology level-2 parent groups)
    var rootArticles = globalCategories.filter(cat => cat.type === 'article');
    var rootDiseases = globalCategories.filter(cat => cat.type === 'disease' && cat.parent_id === 2);

    // Render General flat article topics
    rootArticles.forEach(cat => {
        var item = document.createElement('div');
        item.className = 'category-tree-item';
        item.setAttribute('data-id', cat.id);
        item.setAttribute('data-type', 'article');
        
        var iconHtml = '';
        if (cat.image_url && (cat.image_url.includes('/') || cat.image_url.includes('.'))) {
            iconHtml = `<img src="${resolveImageUrl(cat.image_url)}" style="width:16px;height:16px;object-fit:contain;">`;
        } else {
            var iconClass = cat.image_url || 'fa-regular fa-newspaper';
            iconHtml = `<i class="${iconClass}"></i>`;
        }
        item.innerHTML = `
            <div class="cat-icon" style="background: #eff6ff; color: #3b82f6;">
                ${iconHtml}
            </div>
            <div class="cat-info">
                <h4>${cat.name}</h4>
                <p>Kiến thức chung</p>
            </div>
        `;
        item.onclick = () => window.filterByCategory(item, cat.id, 'article');
        list.appendChild(item);
    });

    // Render Disease categories (collapsible tree)
    rootDiseases.forEach(parent => {
        var groupContainer = document.createElement('div');
        groupContainer.className = 'category-group-container';
        groupContainer.style.borderBottom = '1px solid var(--admin-border)';

        var parentItem = document.createElement('div');
        parentItem.className = 'category-tree-item parent-item';
        parentItem.setAttribute('data-id', parent.id);
        parentItem.setAttribute('data-type', 'disease');
        parentItem.style.borderBottom = 'none';

        var children = globalCategories.filter(cat => cat.parent_id === parent.id);
        var hasChildren = children.length > 0;
        var parentIcon = parent.image_url || 'fa-solid fa-notes-medical';

        parentItem.innerHTML = `
            ${hasChildren ? `<span class="expand-toggle" style="padding: 4px 8px; cursor: pointer; color: #94a3b8; font-size: 11px; transition: transform 0.2s; display: inline-block;"><i class="fa-solid fa-chevron-right"></i></span>` : `<span style="width: 25px;"></span>`}
            <div class="cat-icon" style="background: #fef2f2; color: #ef4444; margin-left: ${hasChildren ? '0' : '6px'};">
                <i class="${parentIcon}"></i>
            </div>
            <div class="cat-info" style="cursor: pointer;">
                <h4 style="font-weight: 700;">${parent.name}</h4>
                <p>Chuyên khoa bệnh lý</p>
            </div>
        `;

        var childrenPanel = document.createElement('div');
        childrenPanel.className = 'category-children-panel';
        childrenPanel.style.cssText = 'display: none; padding-left: 20px; background: #fafafa; border-top: 1px dashed #e2e8f0;';

        if (hasChildren) {
            var toggleBtn = parentItem.querySelector('.expand-toggle');
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                var isCollapsed = childrenPanel.style.display === 'none';
                childrenPanel.style.display = isCollapsed ? 'block' : 'none';
                toggleBtn.style.transform = isCollapsed ? 'rotate(90deg)' : 'rotate(0deg)';
            };
        }

        parentItem.onclick = (e) => {
            if (e.target.closest('.expand-toggle')) return;
            window.filterByCategory(parentItem, parent.id, 'disease');
        };

        groupContainer.appendChild(parentItem);

        if (hasChildren) {
            children.forEach(child => {
                var childItem = document.createElement('div');
                childItem.className = 'category-tree-item child-item';
                childItem.setAttribute('data-id', child.id);
                childItem.setAttribute('data-type', 'child');
                childItem.style.padding = '8px 12px 8px 30px';
                childItem.style.borderBottom = 'none';

                var iconHtml = '';
                if (child.image_url && (child.image_url.includes('/') || child.image_url.includes('.'))) {
                    iconHtml = `<img src="${resolveImageUrl(child.image_url)}" style="width:16px;height:16px;object-fit:contain;">`;
                } else {
                    var childIcon = child.image_url || 'fa-solid fa-circle-notch';
                    iconHtml = `<i class="${childIcon}" style="font-size:12px;"></i>`;
                }

                childItem.innerHTML = `
                    <div class="cat-icon" style="width:24px; height:24px; background:#fff; color:#64748b; border:1px solid #e2e8f0;">
                        ${iconHtml}
                    </div>
                    <div class="cat-info">
                        <h4 style="font-size:12px; font-weight:500;">${child.name}</h4>
                    </div>
                `;
                childItem.onclick = (e) => {
                    e.stopPropagation();
                    window.filterByCategory(childItem, child.id, 'child');
                };
                childrenPanel.appendChild(childItem);
            });
            groupContainer.appendChild(childrenPanel);
        }

        list.appendChild(groupContainer);
    });

    // Update total count on the "All" item
    fetch(`${API_BASE}/cms/articles/admin`, { headers: getHeaders() })
        .then(r => r.json())
        .then(res => {
            if (res.success && res.pagination) {
                var totalCountEl = document.getElementById('sidebar-all-count');
                if (totalCountEl) totalCountEl.innerText = res.pagination.total || 0;
            }
        }).catch(err => console.error(err));
}

function populateCategorySelect() {
    var select = document.getElementById('article-category-select');
    if (!select) return;
    
    // We populate with sub-categories or any category that makes sense to categorize articles.
    var options = globalCategories.filter(cat => 
        cat.type === 'article' || (cat.type === 'disease' && cat.parent_id !== null && cat.parent_id !== 2)
    );
    
    select.innerHTML = options.map(cat => 
        `<option value="${cat.id}">${cat.name} (${cat.type === 'article' ? 'Chủ đề' : 'Bệnh học'})</option>`
    ).join('');
}

window.filterByCategory = function(el, catId, catType = 'all') {
    document.querySelectorAll('.category-tree-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    
    currentPage = 1;
    currentCategoryId = catId;
    currentCategoryType = (catType === 'child' || catType === 'article') ? 'article' : 'disease';
    loadArticles();
};

// ──────────────────────────────────────────────
// ARTICLES LISTING & CRUD
// ──────────────────────────────────────────────
async function loadArticles() {
    try {
        var container = document.getElementById('articles-list-container');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;display:block;"></i>Đang tải danh sách bài viết...</div>';

        var params = new URLSearchParams({
            page: currentPage,
            limit: currentLimit
        });

        if (statusFilter !== 'all') {
            params.set('status', statusFilter);
        }
        
        if (currentCategoryId !== 'all') {
            if (currentCategoryType === 'article') {
                params.set('category_id', currentCategoryId);
            } else if (currentCategoryType === 'disease') {
                params.set('disease_category_id', currentCategoryId);
            }
        }

        if (searchQuery.trim()) {
            params.set('q', searchQuery.trim());
        }

        var res = await fetch(`${API_BASE}/cms/articles/admin?${params.toString()}`, {
            headers: getHeaders()
        });
        var result = await res.json();
        
        if (!result.success || !Array.isArray(result.data)) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;">Không tải được dữ liệu: ${result.message || 'Lỗi không xác định'}</div>`;
            return;
        }

        var articles = result.data;
        
        // Client-side popular sorting
        if (sortFilter === 'popular') {
            articles.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        }

        if (articles.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;background:#fff;border-radius:10px;border:1px dashed var(--admin-border);">Không tìm thấy bài viết nào phù hợp.</div>';
            updatePagination(0, 0, 0);
            return;
        }

        container.innerHTML = '';
        articles.forEach(art => {
            var card = document.createElement('div');
            card.className = 'article-card';
            
            // Format status badge
            var statusText = 'Bản nháp';
            var statusClass = 'draft';
            if (art.status === 'published') {
                statusText = 'Đã xuất bản';
                statusClass = 'published';
            } else if (art.status === 'archived') {
                statusText = 'Đã lưu trữ';
                statusClass = 'draft';
            }

            // Thumbnail url or placeholder
            var thumb = art.thumbnail_url;
            var thumbHtml = '';
            if (thumb) {
                thumbHtml = `<img src="${resolveImageUrl(thumb)}" class="article-thumbnail" alt="${art.title}">`;
            } else {
                thumbHtml = `<div class="article-thumbnail"><i class="fa-solid fa-newspaper"></i></div>`;
            }

            // Format date
            var dateStr = art.published_at 
                ? new Date(art.published_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : new Date(art.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

            card.innerHTML = `
                ${thumbHtml}
                <div class="article-body" onclick="openArticleEditor(${art.id})">
                    <h3>${art.title}</h3>
                    <div class="article-meta">
                        <span><i class="fa-regular fa-folder"></i> ${art.category_name || 'Chưa phân loại'}</span>
                        <span><i class="fa-regular fa-eye"></i> ${art.view_count || 0} lượt xem</span>
                        <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        <span class="pub-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="article-excerpt">${art.excerpt || 'Không có tóm tắt nội dung...'}</div>
                </div>
                <div class="article-actions">
                    <button class="btn-icon" style="color:var(--admin-primary);" onclick="openArticleEditor(${art.id})" title="Chỉnh sửa"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button class="btn-icon" style="color:#ef4444;" onclick="event.stopPropagation(); deleteArticle(${art.id})" title="Lưu trữ/Xóa"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            `;
            container.appendChild(card);
        });

        // Update Pagination
        var pag = result.pagination || { total: articles.length, page: 1, limit: currentLimit };
        var total = pag.total || 0;
        var from = total > 0 ? (currentPage - 1) * currentLimit + 1 : 0;
        var to = Math.min(currentPage * currentLimit, total);
        updatePagination(total, from, to);

    } catch (e) {
        console.error('Error loadArticles:', e);
    }
}

function updatePagination(total, from, to) {
    var info = document.querySelector('.pagination .page-info');
    if (info) {
        info.innerText = `Hiển thị ${from} – ${to} trên ${total} bài viết`;
    }

    var controls = document.querySelector('.pagination .page-controls');
    if (!controls) return;

    controls.innerHTML = '';
    var totalPages = Math.ceil(total / currentLimit);

    if (totalPages <= 1) return;

    // Prev Button
    var prev = document.createElement('button');
    prev.disabled = currentPage === 1;
    prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prev.onclick = () => { if (currentPage > 1) { currentPage--; loadArticles(); } };
    controls.appendChild(prev);

    // Number Buttons
    for (let i = 1; i <= totalPages; i++) {
        var btn = document.createElement('button');
        btn.className = currentPage === i ? 'active' : '';
        btn.innerText = i;
        btn.onclick = () => { currentPage = i; loadArticles(); };
        controls.appendChild(btn);
    }

    // Next Button
    var next = document.createElement('button');
    next.disabled = currentPage === totalPages;
    next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    next.onclick = () => { if (currentPage < totalPages) { currentPage++; loadArticles(); } };
    controls.appendChild(next);
}

// ──────────────────────────────────────────────
// EDITOR MODAL LOGIC
// ──────────────────────────────────────────────
window.openArticleEditor = async function(modeOrId) {
    var modal = document.getElementById('articleEditorModal');
    if (!modal) return;

    // Render preview ngay (preview luôn hiển thị)
    renderLivePreview();

    // Clear previous details
    document.getElementById('article-title-input').value = '';
    document.getElementById('article-excerpt-input').value = '';
    document.getElementById('article-content-body').innerHTML = '<p style="color:#9ca3af;font-style:italic;">Nhập nội dung bài viết tại đây. Sử dụng thanh công cụ để định dạng văn bản và thêm hình ảnh...</p>';
    document.getElementById('article-category-select').selectedIndex = 0;
    document.getElementById('article-author-select').selectedIndex = 0;
    document.getElementById('article-product-search').value = '';
    document.getElementById('article-product-dropdown').style.display = 'none';
    
    // Reset state
    articleTags = [];
    coverImageUrl = '';
    selectedProducts = [];
    relatedArticles = [];
    renderTagsChips();
    renderRelatedProducts();
    renderRelatedArticlesSettings();
    resetCoverUploaderUI();

    if (modeOrId === 'new') {
        activeArticleId = null;
        document.getElementById('editorTitle').innerText = 'Viết Bài Mới';
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        renderLivePreview();
    } else {
        activeArticleId = modeOrId;
        document.getElementById('editorTitle').innerText = 'Chỉnh Sửa Bài Viết';
        
        try {
            showToast('Đang tải thông tin chi tiết bài viết...', 'info');

            // Gọi trực tiếp GET /cms/articles/:id kèm token admin
            // để backend nhận diện quyền admin → cho phép xem bài draft/archived
            var detailRes = await fetch(`${API_BASE}/cms/articles/${modeOrId}`, { headers: getHeaders() });
            var detailResult = await detailRes.json();

            if (detailResult.success && detailResult.data) {
                    var detail = detailResult.data;
                    document.getElementById('article-title-input').value = detail.title || '';
                    document.getElementById('article-excerpt-input').value = detail.excerpt || '';
                    document.getElementById('article-content-body').innerHTML = detail.content || '';
                    
                    if (detail.category_id) {
                        document.getElementById('article-category-select').value = detail.category_id;
                    }
                    if (detail.author_id) {
                        document.getElementById('article-author-select').value = detail.author_id;
                    }

                    // Tags parsing
                    try {
                        articleTags = Array.isArray(detail.tags) ? detail.tags : JSON.parse(detail.tags || '[]');
                    } catch(e) {
                        articleTags = [];
                    }
                    renderTagsChips();

                    // Cover image
                    if (detail.thumbnail_url) {
                        coverImageUrl = detail.thumbnail_url;
                        updateCoverUploaderUI(coverImageUrl);
                    }

                    // Related Products loading
                    selectedProducts = detail.related_products || [];
                    // Đẩy dữ liệu product thật vào cache để preview
                    selectedProducts.forEach(p => {
                        if (!productCache.some(item => item.id === p.id)) {
                            productCache.push({
                                id: p.id,
                                name: p.name,
                                price: p.price,
                                thumbnail_url: p.thumbnail || p.thumbnail_url
                            });
                        }
                    });
                    
                    if (selectedProducts.length === 0) {
                        autoSuggestProducts(detail.title);
                    } else {
                        renderRelatedProducts();
                    }

                    // Related Articles loading
                    relatedArticles = detail.related_articles || [];
                    renderRelatedArticlesSettings();

                    modal.classList.add('open');
                    document.body.style.overflow = 'hidden';
                    // Cập nhật preview sau khi load xong dữ liệu bài viết
                    renderLivePreview();
            } else {
                    showToast('Không lấy được chi tiết bài viết: ' + detailResult.message, 'error');
            }
        } catch(e) {
            showToast('Lỗi tải thông tin bài viết: ' + e.message, 'error');
        }
    }
};

window.closeArticleEditor = function() {
    var modal = document.getElementById('articleEditorModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
};

// Tags render
function renderTagsChips() {
    var container = document.getElementById('article-tags-container');
    if (!container) return;
    
    // Clear and keep input
    var input = document.getElementById('article-tag-input');
    container.innerHTML = '';
    
    articleTags.forEach((tag, idx) => {
        var chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `
            ${tag}
            <button type="button" onclick="removeTag(${idx})"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(chip);
    });
    
    if (input) container.appendChild(input);
    input?.focus();
}

window.removeTag = function(idx) {
    articleTags.splice(idx, 1);
    renderTagsChips();
    schedulePreviewUpdate();
};

// Rich editor command helper
window.execCmd = function(command, value = null) {
    document.execCommand(command, false, value);
};

window.insertImagePrompt = function() {
    // Tạo input file ẩn để chọn ảnh từ máy tính
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', async (e) => {
        var file = e.target.files[0];
        if (!file) { fileInput.remove(); return; }

        // Kiểm tra kích thước (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            showToast('Ảnh quá lớn. Tối đa 50MB mỗi file.', 'error');
            fileInput.remove();
            return;
        }

        showToast('Đang tải ảnh lên...', 'info');

        try {
            var reader = new FileReader();
            reader.onloadend = async () => {
                var base64String = reader.result;

                // Upload lên CMS media service
                var uploadRes = await fetch(`${API_BASE}/cms/media`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        original_name: file.name,
                        mime_type: file.type,
                        media_type: 'image',
                        data_base64: base64String
                    })
                });
                var uploadResult = await uploadRes.json();

                if (uploadResult.success && uploadResult.data && uploadResult.data.file_url) {
                    var imgUrl = uploadResult.data.file_url;
                    var resolvedImgUrl = resolveImageUrl(imgUrl);

                    // Chèn ảnh vào editor với style responsive + center
                    var imgHtml = `
                        <div style="text-align:center;margin:16px 0;">
                            <img src="${resolvedImgUrl}" alt="${file.name}" 
                                 style="max-width:100%;height:auto;border-radius:8px;cursor:pointer;"
                                 onclick="this.style.maxWidth = this.style.maxWidth === '50%' ? '100%' : this.style.maxWidth === '100%' ? '75%' : '50%';"
                                 title="Click để thay đổi kích cỡ (100% → 75% → 50%)">
                        </div>
                        <p></p>
                    `;

                    // Focus editor và chèn
                    var editorBody = document.getElementById('article-content-body');
                    editorBody.focus();
                    document.execCommand('insertHTML', false, imgHtml);

                    showToast('Đã chèn ảnh vào bài viết!', 'success');
                    schedulePreviewUpdate();
                } else {
                    showToast('Không tải được ảnh: ' + (uploadResult.message || 'Lỗi'), 'error');
                }
                fileInput.remove();
            };
            reader.readAsDataURL(file);
        } catch (err) {
            showToast('Lỗi tải ảnh: ' + err.message, 'error');
            fileInput.remove();
        }
    });

    fileInput.click();
};

window.insertLinkPrompt = function() {
    var url = prompt("Nhập URL liên kết:");
    if (url) document.execCommand("createLink", false, url);
};

window.insertTablePrompt = function() {
    var rows = prompt("Nhập số hàng:", "3");
    var cols = prompt("Nhập số cột:", "3");
    if (rows && cols) {
        var html = '<table style="width:100%; border-collapse: collapse; margin: 10px 0;">';
        for (let r = 0; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) {
                html += '<td style="border: 1px solid #cbd5e1; padding: 8px;">&nbsp;</td>';
            }
            html += '</tr>';
        }
        html += '</table>';
        document.execCommand("insertHTML", false, html);
    }
};

window.insertCallout = function(type) {
    var text = prompt("Nhập nội dung lưu ý/cảnh báo:");
    if (text) {
        var bgColor = type === 'info' ? '#eff6ff' : '#fef2f2';
        var borderColor = type === 'info' ? '#3b82f6' : '#ef4444';
        var textColor = type === 'info' ? '#1d4ed8' : '#991b1b';
        var icon = type === 'info' ? 'fa-circle-info' : 'fa-triangle-exclamation';
        var html = `
            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 12px 16px; border-radius: 6px; color: ${textColor}; margin: 12px 0; display: flex; gap: 10px; align-items: flex-start;">
                <i class="fa-solid ${icon}" style="margin-top: 3px;"></i>
                <div>${text}</div>
            </div>
            <p></p>
        `;
        document.execCommand("insertHTML", false, html);
    }
};

window.insertIntroBox = function() {
    var text = prompt("Nhập nội dung đoạn tóm tắt mở đầu (hoặc nhấn OK để chèn mẫu):", "Nhập đoạn tóm tắt mở đầu hoặc lời khuyên của bác sĩ tại đây...");
    if (text === null) return; // cancel
    
    var html = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; position: relative; margin: 18px 0; font-family: inherit;">
            <div style="color: #10b981; font-size: 54px; line-height: 1; font-family: Georgia, serif; position: absolute; top: -10px; left: 16px; font-weight: bold; user-select: none;">“</div>
            <div style="margin-top: 14px; font-size: 14px; color: #374151; line-height: 1.6; font-style: italic;">
                ${text}
            </div>
        </div>
        <p></p>
    `;
    document.execCommand("insertHTML", false, html);
};

window.insertTocBox = function() {
    var html = `
        <div style="border: 1px solid #005824; border-radius: 12px; padding: 18px 20px; margin: 18px 0; background: #fff; font-family: inherit;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px; cursor: pointer;" 
                 onclick="const content = this.nextElementSibling; content.style.display = content.style.display === 'none' ? 'block' : 'none'; const icon = this.querySelector('i'); icon.className = content.style.display === 'none' ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';">
                <span style="font-weight: 700; font-size: 15px; color: #005824; user-select: none;">Tóm tắt nội dung</span>
                <i class="fa-solid fa-chevron-up" style="color: #005824; font-size: 12px;"></i>
            </div>
            <div style="display: block;">
                <ol style="margin: 0; padding-left: 20px; color: #16a34a; font-weight: 600; font-size: 14px; line-height: 2;">
                    <li><span style="color: #16a34a; cursor: pointer;">1. Dấu hiệu bệnh là gì?</span></li>
                    <li><span style="color: #16a34a; cursor: pointer;">2. Bệnh nên kiêng gì?</span></li>
                    <li><span style="color: #16a34a; cursor: pointer;">3. Chăm sóc người bệnh như thế nào?</span></li>
                </ol>
            </div>
        </div>
        <p></p>
    `;
    document.execCommand("insertHTML", false, html);
};

// Cover Image Uploader Handlers
window.triggerCoverUpload = function() {
    document.getElementById('article-cover-file-input').click();
};

async function handleCoverUpload(e) {
    var file = e.target.files[0];
    if (!file) return;

    showToast('Đang tải ảnh đại diện lên...', 'info');
    
    try {
        var reader = new FileReader();
        reader.onloadend = async () => {
            var base64String = reader.result;
            
            var uploadRes = await fetch(`${API_BASE}/cms/media`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    original_name: file.name,
                    mime_type: file.type,
                    media_type: 'image',
                    data_base64: base64String
                })
            });
            var uploadResult = await uploadRes.json();
            
            if (uploadResult.success && uploadResult.data) {
                coverImageUrl = uploadResult.data.file_url;
                updateCoverUploaderUI(coverImageUrl);
                showToast('Đã tải ảnh đại diện lên thành công!');
                schedulePreviewUpdate();
                loadMediaLibrary(); // Sync Tab 3 gallery too
            } else {
                showToast('Tải lên thất bại: ' + uploadResult.message, 'error');
            }
        };
        reader.readAsDataURL(file);
    } catch(err) {
        showToast('Lỗi tải ảnh: ' + err.message, 'error');
    }
}

function updateCoverUploaderUI(url) {
    var uploader = document.getElementById('article-cover-uploader');
    if (!uploader) return;
    
    var resolvedUrl = resolveImageUrl(url);
    
    uploader.innerHTML = `
        <img src="${resolvedUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;max-height:100px;">
        <span style="font-size:10px;color:#ef4444;position:absolute;bottom:4px;right:4px;background:rgba(255,255,255,0.8);padding:2px 6px;border-radius:4px;" onclick="event.stopPropagation(); resetCoverUploaderUI(true)">Thay đổi</span>
    `;
    uploader.style.padding = '0';
    uploader.style.position = 'relative';
}

function resetCoverUploaderUI(clearUrl = false) {
    if (clearUrl) coverImageUrl = '';
    var uploader = document.getElementById('article-cover-uploader');
    if (!uploader) return;

    uploader.innerHTML = `
        <i class="fa-solid fa-image" style="color:#94a3b8;font-size:22px;display:block;margin-bottom:6px;"></i>
        <span style="font-size:11px;color:#9ca3af;">Chọn từ máy tính</span>
    `;
    uploader.style.padding = '20px';
    uploader.style.position = 'static';
}

// Autocomplete Medicines logic
async function handleProductSearch() {
    var term = document.getElementById('article-product-search').value.trim();
    var dropdown = document.getElementById('article-product-dropdown');
    if (!dropdown) return;

    try {
        var queryParams = new URLSearchParams({ limit: '10', status: 'active' });
        if (term) {
            queryParams.set('q', term);
        }
        var res = await fetch(`${API_BASE}/catalog/products?${queryParams.toString()}`, { headers: getHeaders() });
        var result = await res.json();
        
        var products = [];
        if (result.success && Array.isArray(result.data)) {
            products = result.data;
        } else if (result.success && result.data && Array.isArray(result.data.data)) {
            products = result.data.data;
        }

        // Cache products for preview details
        products.forEach(p => {
            if (!productCache.some(item => item.id === p.id)) {
                productCache.push(p);
            }
        });
        
        // Filter: Keep active/in-stock products
        var inStockProducts = products.filter(prod => prod.in_stock === true || Number(prod.total_stock) > 0);
        
        if (inStockProducts.length === 0) {
            dropdown.innerHTML = '<div style="padding: 8px 12px; font-size: 12px; color: #9ca3af; text-align: center;">Không có sản phẩm nào.</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = inStockProducts.map(prod => `
            <div class="dropdown-item" style="padding:8px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid #f1f5f9;" onclick="addProductChip(${prod.id}, '${prod.name.replace(/'/g, "\\'")}')">
                <strong>${prod.name}</strong> <span style="color:#10b981;font-size:11px;">(Tồn: ${prod.total_stock || 0})</span>
            </div>
        `).join('');
        
        dropdown.style.display = 'block';
    } catch(e) {
        console.error('Error searching products:', e);
    }
}

window.addProductChip = function(id, name) {
    if (!selectedProducts.some(p => p.id === id)) {
        selectedProducts.push({ id, name });
        renderRelatedProducts();
        schedulePreviewUpdate();
    }
    document.getElementById('article-product-search').value = '';
    document.getElementById('article-product-dropdown').style.display = 'none';
};

window.removeProductChip = function(id) {
    selectedProducts = selectedProducts.filter(p => p.id !== id);
    renderRelatedProducts();
    schedulePreviewUpdate();
};

// Autocomplete Articles logic
async function handleArticleSearch() {
    var term = document.getElementById('article-article-search').value.trim();
    var dropdown = document.getElementById('article-article-dropdown');
    if (!dropdown) return;

    try {
        var queryParams = new URLSearchParams({ limit: '10' });
        if (term) {
            queryParams.set('q', term);
        }
        var res = await fetch(`${API_BASE}/cms/articles/admin?${queryParams.toString()}`, { headers: getHeaders() });
        var result = await res.json();
        
        var articles = [];
        if (result.success && Array.isArray(result.data)) {
            articles = result.data;
        }

        // Không gợi ý bài viết đang sửa
        if (activeArticleId !== null) {
            articles = articles.filter(a => Number(a.id) !== Number(activeArticleId));
        }
        
        if (articles.length === 0) {
            dropdown.innerHTML = '<div style="padding: 8px 12px; font-size: 12px; color: #9ca3af; text-align: center;">Không có bài viết nào.</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = articles.map(art => `
            <div class="dropdown-item" style="padding:8px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid #f1f5f9;" onclick="addArticleChip(${art.id}, '${art.title.replace(/'/g, "\\'")}')">
                <strong>${art.title}</strong>
            </div>
        `).join('');
        
        dropdown.style.display = 'block';
    } catch(e) {
        console.error('Error searching articles:', e);
    }
}

window.addArticleChip = function(id, title) {
    if (!relatedArticles.some(a => Number(a.id) === Number(id))) {
        relatedArticles.push({ id, title });
        renderRelatedArticlesSettings();
        schedulePreviewUpdate();
    }
    document.getElementById('article-article-search').value = '';
    document.getElementById('article-article-dropdown').style.display = 'none';
};

window.removeArticleChip = function(id) {
    relatedArticles = relatedArticles.filter(a => Number(a.id) !== Number(id));
    renderRelatedArticlesSettings();
    schedulePreviewUpdate();
};

function renderRelatedArticlesSettings() {
    var list = document.getElementById('article-related-articles-list');
    if (!list) return;

    list.innerHTML = '';
    if (!relatedArticles || relatedArticles.length === 0) {
        list.innerHTML = '<div style="font-size:11px;color:#9ca3af;font-style:italic;">Chưa liên kết bài viết liên quan nào.</div>';
        return;
    }

    relatedArticles.forEach(art => {
        var chip = document.createElement('div');
        chip.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#f1f5f9;border:1px solid #cbd5e1;padding:4px 8px;border-radius:6px;font-size:11px;margin-bottom:6px;';
        chip.innerHTML = `
            <span style="font-weight:500;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${art.title}</span>
            <button type="button" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:12px;" onclick="removeArticleChip(${art.id})"><i class="fa-solid fa-xmark"></i></button>
        `;
        list.appendChild(chip);
    });
}

function renderRelatedProducts() {
    var list = document.getElementById('article-related-products-list');
    if (!list) return;

    list.innerHTML = '';
    if (selectedProducts.length === 0) {
        list.innerHTML = '<div style="font-size:11px;color:#9ca3af;font-style:italic;">Chưa liên kết sản phẩm điều trị nào.</div>';
        return;
    }

    selectedProducts.forEach(prod => {
        var chip = document.createElement('div');
        chip.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#f1f5f9;border:1px solid #cbd5e1;padding:4px 8px;border-radius:6px;font-size:11px;margin-bottom:6px;';
        chip.innerHTML = `
            <span style="font-weight:500;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${prod.name}</span>
            <button type="button" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:12px;" onclick="removeProductChip(${prod.id})"><i class="fa-solid fa-xmark"></i></button>
        `;
        list.appendChild(chip);
    });
}

// Auto suggest products based on title keywords — gọi API catalog thực tế
async function autoSuggestProducts(title) {
    if (!title) return;

    // Trích xuất từ khóa y khoa từ tiêu đề bài viết
    var medKeywords = {
        'gout': 'gout', 'gut': 'gout', 'gút': 'gout',
        'da dày': 'dạ dày', 'dạ dày': 'dạ dày', 'tiêu hóa': 'tiêu hóa', 'đại tràng': 'đại tràng',
        'tim': 'tim mạch', 'huyết áp': 'huyết áp', 'tim mạch': 'tim mạch',
        'khớp': 'xương khớp', 'xương': 'xương khớp', 'cột sống': 'xương khớp',
        'da liễu': 'da liễu', 'mụn': 'da liễu', 'da': 'da liễu',
        'hô hấp': 'hô hấp', 'phổi': 'hô hấp', 'ho': 'ho', 'cảm': 'cảm cúm',
        'thận': 'thận', 'gan': 'gan', 'tiểu đường': 'tiểu đường', 'mắt': 'mắt',
        'não': 'thần kinh', 'thần kinh': 'thần kinh', 'quên': 'bổ não',
        'vitamin': 'vitamin', 'tăng đề kháng': 'vitamin', 'miễn dịch': 'vitamin',
        'trẻ em': 'trẻ em', 'trẻ': 'trẻ em', 'sốt': 'hạ sốt',
    };

    var titleLower = title.toLowerCase();
    var searchTerm = '';

    // Tìm từ khóa phù hợp nhất trong tiêu đề
    for (const [keyword, query] of Object.entries(medKeywords)) {
        if (titleLower.includes(keyword)) {
            searchTerm = query;
            break;
        }
    }

    // Nếu không tìm thấy từ khóa chuyên khoa → dùng 2 từ đầu của tiêu đề
    if (!searchTerm) {
        var words = title.split(/\s+/).filter(w => w.length > 2);
        searchTerm = words.slice(0, 2).join(' ');
    }

    if (!searchTerm) return;

    try {
        var queryParams = new URLSearchParams({ limit: '5', q: searchTerm });
        var res = await fetch(`${API_BASE}/catalog/products?${queryParams.toString()}`, { headers: getHeaders() });
        var result = await res.json();

        var products = [];
        if (result.success && Array.isArray(result.data)) {
            products = result.data;
        } else if (result.success && result.data && Array.isArray(result.data.data)) {
            products = result.data.data;
        }

        if (products.length > 0) {
            // Cache sản phẩm cho preview
            products.forEach(p => {
                if (!productCache.some(item => item.id === p.id)) {
                    productCache.push(p);
                }
            });

            selectedProducts = products.slice(0, 3).map(p => ({ id: p.id, name: p.name }));
        } else {
            // Fallback: thử search generic "vitamin" hoặc "thuốc"
            var fallbackRes = await fetch(`${API_BASE}/catalog/products?limit=3&q=vitamin`, { headers: getHeaders() });
            var fallbackResult = await fallbackRes.json();
            var fallbackProducts = [];
            if (fallbackResult.success && Array.isArray(fallbackResult.data)) {
                fallbackProducts = fallbackResult.data;
            } else if (fallbackResult.success && fallbackResult.data && Array.isArray(fallbackResult.data.data)) {
                fallbackProducts = fallbackResult.data.data;
            }

            fallbackProducts.forEach(p => {
                if (!productCache.some(item => item.id === p.id)) productCache.push(p);
            });

            selectedProducts = fallbackProducts.slice(0, 3).map(p => ({ id: p.id, name: p.name }));
        }

        renderRelatedProducts();
        schedulePreviewUpdate();
    } catch (e) {
        console.error('autoSuggestProducts error:', e);
        // Giữ sản phẩm hiện tại nếu có lỗi
    }
}

// SAVE Article Form
window.saveArticle = async function(status) {
    var title = document.getElementById('article-title-input').value.trim();
    var excerpt = document.getElementById('article-excerpt-input').value.trim();
    var content = document.getElementById('article-content-body').innerHTML.trim();
    var category_id = document.getElementById('article-category-select').value;
    var author_id = document.getElementById('article-author-select').value;

    if (!title) {
        showToast('Vui lòng nhập tiêu đề bài viết!', 'error');
        return;
    }
    if (!content || content.includes('Nhập nội dung bài viết tại đây')) {
        showToast('Vui lòng soạn thảo nội dung chính!', 'error');
        return;
    }

    var payload = {
        title,
        excerpt,
        content,
        category_id: Number(category_id),
        author_id: Number(author_id) || null,
        thumbnail_url: coverImageUrl || null,
        tags: articleTags,
        status: status, // 'draft' or 'published'
        related_products: selectedProducts,
        related_articles: relatedArticles
    };

    showToast('Đang lưu bài viết...', 'info');

    try {
        var res, result;
        if (activeArticleId === null) {
            // New Article
            res = await fetch(`${API_BASE}/cms/articles`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            // Edit Article
            res = await fetch(`${API_BASE}/cms/articles/${activeArticleId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        }

        result = await res.json();

        if (result.success) {
            showToast('Lưu bài viết thành công!', 'success');
            closeArticleEditor();
            loadStats();
            loadArticles();
        } else {
            showToast('Lưu bài viết thất bại: ' + result.message, 'error');
        }
    } catch(e) {
        showToast('Lỗi lưu bài viết: ' + e.message, 'error');
    }
};

// DELETE Article (Soft delete)
window.deleteArticle = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn lưu trữ (xóa tạm thời) bài viết này không?')) return;
    
    showToast('Đang xử lý...', 'info');
    try {
        var res = await fetch(`${API_BASE}/cms/articles/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        var result = await res.json();
        
        if (result.success) {
            showToast('Đã chuyển bài viết vào mục lưu trữ (Soft Deleted).');
            loadStats();
            loadArticles();
        } else {
            showToast('Xóa bài viết thất bại: ' + result.message, 'error');
        }
    } catch(e) {
        showToast('Lỗi xóa bài viết: ' + e.message, 'error');
    }
};


// ──────────────────────────────────────────────
// TAB 2: CATEGORIES MANAGEMENT (Table + Quick Add)
// ──────────────────────────────────────────────
// Build a tree of category nodes from flat list
function buildCategoryTree(categories) {
    var map = {};
    var roots = [];
    
    // Initialize map
    categories.forEach(cat => {
        map[cat.id] = { ...cat, children: [] };
    });
    
    // Link parents and children
    categories.forEach(cat => {
        var node = map[cat.id];
        if (cat.parent_id && map[cat.parent_id]) {
            map[cat.parent_id].children.push(node);
        } else {
            roots.push(node);
        }
    });
    
    // Sort roots & children by sort_order first, then by name alphabetically
    var sortFn = (a, b) => {
        var orderA = a.sort_order || 0;
        var orderB = b.sort_order || 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'vi');
    };
    
    roots.sort(sortFn);
    Object.values(map).forEach(node => {
        node.children.sort(sortFn);
    });
    
    return roots;
}

// Generate category tree table rows HTML
function generateTreeRows(nodes, depth = 0, parentPath = []) {
    var html = '';
    
    nodes.forEach(node => {
        var hasChildren = node.children && node.children.length > 0;
        var indent = depth * 24; // 24px indent per depth level
        
        // Dot color based on type
        var dotColor = '#3b82f6'; // blue for article
        if (node.type === 'disease') dotColor = '#ef4444'; // red for disease
        if (node.type === 'promotion') dotColor = '#10b981'; // green for promotion
        
        // CSS classes to handle show/hide
        var pathClass = parentPath.map(id => `parent-${id}`).join(' ');
        var isHiddenStyle = depth > 0 ? 'style="display: none;"' : '';
        
        // Chevron caret if it has children
        var toggleCaret = '';
        if (hasChildren) {
            toggleCaret = `<span class="cat-tree-toggle" style="display:inline-block; width:16px; text-align:center; margin-right:6px; cursor:pointer; color:#94a3b8; transition:transform 0.2s;"><i class="fa-solid fa-chevron-right"></i></span>`;
        } else {
            toggleCaret = `<span style="display:inline-block; width:16px; margin-right:6px;"></span>`;
        }
        
        // Render icon
        var iconHtml = '';
        if (node.image_url) {
            if (node.image_url.includes('/') || node.image_url.includes('.')) {
                var resolvedUrl = resolveImageUrl(node.image_url);
                iconHtml = `<img src="${resolvedUrl}" style="width:20px;height:20px;object-fit:contain;margin-right:8px;border-radius:4px;vertical-align:middle;">`;
            } else {
                iconHtml = `<i class="${node.image_url}" style="font-size:14px;color:#64748b;margin-right:8px;vertical-align:middle;width:20px;text-align:center;"></i>`;
            }
        } else {
            iconHtml = `<i class="fa-solid fa-folder" style="font-size:14px;color:#94a3b8;margin-right:8px;vertical-align:middle;width:20px;text-align:center;"></i>`;
        }
        
        var clickHandler = hasChildren ? `onclick="event.stopPropagation(); toggleCategoryRow(${node.id}, this)"` : '';
        
        html += `
            <tr class="cat-row ${pathClass}" data-id="${node.id}" data-parent-id="${node.parent_id || ''}" data-depth="${depth}" ${isHiddenStyle}>
                <td style="font-weight:600; color:#0f172a; padding-left: ${indent + 12}px; cursor: ${hasChildren ? 'pointer' : 'default'};" ${clickHandler}>
                    <div style="display:flex; align-items:center;">
                        ${toggleCaret}
                        ${iconHtml}
                        <span class="cat-name">${node.name}</span>
                    </div>
                </td>
                <td><code style="font-size:12px; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${node.slug}</code></td>
                <td style="text-align:center; font-weight:600;">
                    ${node.type === 'article' ? 'Chủ đề' : node.type === 'disease' ? 'Bệnh lý' : 'Khuyến mãi'}
                </td>
                <td style="text-align:right;">
                    <button class="btn-icon" style="color:#ef4444;" onclick="event.stopPropagation(); deleteCategory(${node.id})" title="Xóa danh mục"><i class="fa-regular fa-trash-can"></i></button>
                </td>
            </tr>
        `;
        
        if (hasChildren) {
            html += generateTreeRows(node.children, depth + 1, [...parentPath, node.id]);
        }
    });
    
    return html;
}

// Collapsible category tree toggling
window.toggleCategoryRow = function(catId, element) {
    var caretSpan = element.querySelector('.cat-tree-toggle');
    if (!caretSpan) return;
    var icon = caretSpan.querySelector('i');
    if (!icon) return;
    
    var isExpanded = icon.classList.contains('fa-chevron-down');
    
    if (isExpanded) {
        icon.className = 'fa-solid fa-chevron-right';
        collapseDescendants(catId);
    } else {
        icon.className = 'fa-solid fa-chevron-down';
        expandDirectChildren(catId);
    }
};

function collapseDescendants(catId) {
    var descendants = document.querySelectorAll(`.cat-row.parent-${catId}`);
    descendants.forEach(row => {
        row.style.display = 'none';
        var caretSpan = row.querySelector('.cat-tree-toggle');
        if (caretSpan) {
            var icon = caretSpan.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-chevron-right';
        }
    });
}

function expandDirectChildren(catId) {
    var children = document.querySelectorAll(`.cat-row[data-parent-id="${catId}"]`);
    children.forEach(row => {
        row.style.display = '';
    });
}

// Icon Picker Popover suggestions
var iconSuggestions = {
    medicine: [
        'fa-solid fa-pills',
        'fa-solid fa-capsules',
        'fa-solid fa-prescription-bottle-medical',
        'fa-solid fa-prescription',
        'fa-solid fa-tablets',
        'fa-solid fa-droplet',
        'fa-solid fa-kit-medical',
        'fa-solid fa-prescription-bottle',
        'fa-solid fa-jar-wheat'
    ],
    body: [
        'fa-solid fa-brain',
        'fa-solid fa-bone',
        'fa-solid fa-lungs',
        'fa-solid fa-eye',
        'fa-solid fa-ear-listen',
        'fa-solid fa-heart-pulse',
        'fa-solid fa-hand-dots',
        'fa-solid fa-tooth',
        'fa-solid fa-person',
        'fa-solid fa-person-cane',
        'fa-solid fa-baby',
        'fa-solid fa-face-smile'
    ],
    disease: [
        'fa-solid fa-notes-medical',
        'fa-solid fa-stethoscope',
        'fa-solid fa-user-doctor',
        'fa-solid fa-hospital',
        'fa-solid fa-thermometer',
        'fa-solid fa-bandage',
        'fa-solid fa-virus',
        'fa-solid fa-head-side-cough',
        'fa-solid fa-head-side-virus',
        'fa-solid fa-shield-virus',
        'fa-solid fa-syringe',
        'fa-solid fa-folder'
    ]
};

function initIconPicker() {
    var popover = document.getElementById('icon-picker-popover');
    var toggleBtn = document.getElementById('btn-show-icon-picker');
    var iconInput = document.getElementById('cat-icon-input');
    var iconPreview = document.getElementById('cat-icon-preview');
    
    if (!popover || !toggleBtn || !iconInput) return;
    
    // Populate grids
    for (const [category, icons] of Object.entries(iconSuggestions)) {
        var grid = popover.querySelector(`.icon-grid[data-category="${category}"]`);
        if (grid) {
            grid.innerHTML = icons.map(iconClass => `
                <button type="button" class="icon-pick-btn" data-icon="${iconClass}" style="width:34px;height:34px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;color:#475569;transition:all 0.15s;padding:0;" title="${iconClass}">
                    <i class="${iconClass}"></i>
                </button>
            `).join('');
        }
    }
    
    // Toggle popover
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        var isVisible = popover.style.display === 'block';
        popover.style.display = isVisible ? 'none' : 'block';
    });
    
    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#icon-picker-popover') && !e.target.closest('#btn-show-icon-picker')) {
            popover.style.display = 'none';
        }
    });
    
    // Icon click
    popover.addEventListener('click', (e) => {
        var btn = e.target.closest('.icon-pick-btn');
        if (btn) {
            var iconClass = btn.getAttribute('data-icon');
            iconInput.value = iconClass;
            updateIconPreview(iconClass);
            popover.style.display = 'none';
        }
    });
    
    // Sync manual type
    iconInput.addEventListener('input', () => {
        updateIconPreview(iconInput.value.trim());
    });
}

function updateIconPreview(val) {
    var preview = document.getElementById('cat-icon-preview');
    if (!preview) return;
    
    if (!val) {
        preview.innerHTML = '<i class="fa-solid fa-folder"></i>';
        return;
    }
    
    if (val.includes('/') || val.includes('.')) {
        var resolvedUrl = resolveImageUrl(val);
        preview.innerHTML = `<img src="${resolvedUrl}" style="width:100%;height:100%;object-fit:contain;">`;
    } else {
        preview.innerHTML = `<i class="${val}"></i>`;
    }
}

// Upload category image icon
async function handleCatIconUpload(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Chỉ chấp nhận các file định dạng hình ảnh!', 'error');
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        showToast('Kích thước ảnh quá lớn (tối đa 20MB).', 'error');
        return;
    }

    showToast('Đang tải ảnh icon lên...', 'info');

    try {
        var reader = new FileReader();
        reader.onloadend = async () => {
            var base64String = reader.result;

            var res = await fetch(`${API_BASE}/cms/media`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    original_name: file.name,
                    mime_type: file.type,
                    media_type: 'image',
                    data_base64: base64String
                })
            });

            var result = await res.json();
            if (result.success && result.data && result.data.file_url) {
                var imgUrl = result.data.file_url;
                var input = document.getElementById('cat-icon-input');
                if (input) {
                    input.value = imgUrl;
                    updateIconPreview(imgUrl);
                }
                showToast('Tải ảnh icon thành công!');
            } else {
                showToast('Tải lên thất bại: ' + result.message, 'error');
            }
        };
        reader.readAsDataURL(file);
    } catch(err) {
        showToast('Lỗi tải ảnh: ' + err.message, 'error');
    }
}

async function loadCategoriesList() {
    var tbody = document.getElementById('categories-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#6b7280;padding:20px;">Đang tải danh sách chuyên mục...</td></tr>';
    
    try {
        var res = await fetch(`${API_BASE}/cms/categories`, { headers: getHeaders() });
        var result = await res.json();
        if (result.success && Array.isArray(result.data)) {
            var categories = result.data;
            if (categories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#6b7280;padding:20px;">Không có chuyên mục nào.</td></tr>';
                return;
            }

            var tree = buildCategoryTree(categories);
            tbody.innerHTML = generateTreeRows(tree);
        } else {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#ef4444;padding:20px;">Lỗi: ${result.message || 'Không thể tải'}</td></tr>`;
        }
    } catch(e) {
        console.error('Error loadCategoriesList:', e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#ef4444;padding:20px;">Lỗi hệ thống khi tải danh sách.</td></tr>';
    }
}

async function handleCategoryAdd(e) {
    e.preventDefault();
    var name = document.getElementById('cat-name-input').value.trim();
    var slug = document.getElementById('cat-slug-input').value.trim();
    var type = document.getElementById('cat-type-select').value;
    var parent_id_val = document.getElementById('cat-parent-select').value;
    var icon = document.getElementById('cat-icon-input').value.trim();
    var desc = document.getElementById('cat-desc-input').value.trim();

    if (!name) return;

    var payload = {
        name,
        type: type,
        slug: slug || toSlug(name),
        parent_id: parent_id_val ? Number(parent_id_val) : null,
        description: desc || null,
        image_url: icon || null
    };

    showToast('Đang tạo chuyên mục...', 'info');

    try {
        var res = await fetch(`${API_BASE}/cms/categories`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        var result = await res.json();
        if (result.success) {
            showToast('Đã tạo chuyên mục mới thành công!');
            document.getElementById('category-add-form').reset();
            var preview = document.getElementById('cat-icon-preview');
            if (preview) preview.innerHTML = '<i class="fa-solid fa-folder"></i>';
            loadCategories(); // Refresh Sidebar
            loadCategoriesList(); // Refresh Tab 2 table
        } else {
            showToast('Tạo chuyên mục thất bại: ' + result.message, 'error');
        }
    } catch(err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

window.deleteCategory = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa chuyên mục này?')) return;
    
    showToast('Đang xóa...', 'info');
    try {
        var res = await fetch(`${API_BASE}/cms/categories/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        var result = await res.json();
        if (result.success) {
            showToast('Xóa chuyên mục thành công!');
            loadCategories(); // Refresh sidebar
            loadCategoriesList(); // Refresh table
        } else {
            showToast('Không thể xóa chuyên mục: ' + result.message, 'error');
        }
    } catch(e) {
        showToast('Lỗi xóa chuyên mục: ' + e.message, 'error');
    }
};


// ──────────────────────────────────────────────
// TAB 3: MEDIA LIBRARY (Gallery & Base64 Uploads)
// ──────────────────────────────────────────────
async function loadMediaLibrary() {
    var grid = document.getElementById('media-grid');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#6b7280;padding:40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;display:block;"></i>Đang tải hình ảnh...</div>';

    var search = document.getElementById('media-search-input')?.value.trim();
    var params = new URLSearchParams({
        media_type: 'image',
        limit: '30'
    });
    if (search) params.set('q', search);

    try {
        var res = await fetch(`${API_BASE}/cms/media?${params.toString()}`, { headers: getHeaders() });
        var result = await res.json();
        
        if (result.success && Array.isArray(result.data)) {
            var mediaList = result.data;
            if (mediaList.length === 0) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#6b7280;padding:20px;border:1px dashed var(--admin-border);border-radius:10px;">Thư viện trống. Hãy kéo thả ảnh để tải lên!</div>';
                return;
            }

            grid.innerHTML = mediaList.map(img => {
                var url = img.file_url;
                var resolvedUrl = resolveImageUrl(url);
                
                return `
                    <div style="background:#fff;border:1px solid var(--admin-border);border-radius:8px;padding:8px;position:relative;display:flex;flex-direction:column;align-items:center;transition:box-shadow 0.2s;" class="media-card-item">
                        <img src="${resolvedUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;background:#f8fafc;" alt="${img.original_name}">
                        <div style="font-size:11px;color:#334155;text-align:center;margin-top:6px;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;" title="${img.original_name}">${img.original_name}</div>
                        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${(img.file_size / 1024).toFixed(1)} KB</div>
                        
                        <!-- Overlay options on hover -->
                        <div style="position:absolute;top:6px;right:6px;display:flex;gap:4px;">
                            <button class="btn-icon" style="background:rgba(255,255,255,0.9);box-shadow:0 2px 4px rgba(0,0,0,0.1);width:24px;height:24px;color:#10b981;" onclick="downloadMedia('${resolvedUrl}', '${img.original_name.replace(/'/g, "\\'")}')" title="Tải ảnh về máy"><i class="fa-solid fa-download" style="font-size:11px;"></i></button>
                            <button class="btn-icon" style="background:rgba(255,255,255,0.9);box-shadow:0 2px 4px rgba(0,0,0,0.1);width:24px;height:24px;color:var(--admin-primary);" onclick="copyToClipboard('${resolvedUrl}')" title="Sao chép liên kết ảnh"><i class="fa-regular fa-copy" style="font-size:11px;"></i></button>
                            <button class="btn-icon" style="background:rgba(255,255,255,0.9);box-shadow:0 2px 4px rgba(0,0,0,0.1);width:24px;height:24px;color:#ef4444;" onclick="deleteMedia(${img.id})" title="Xóa ảnh"><i class="fa-regular fa-trash-can" style="font-size:11px;"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch(e) {
        console.error('Error loadMediaLibrary:', e);
    }
}

window.triggerMediaUpload = function() {
    document.getElementById('media-file-input').click();
};

function handleMediaUpload(e) {
    var file = e.target.files[0];
    if (file) {
        uploadImageFile(file);
    }
}

async function uploadImageFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Chỉ chấp nhận các file định dạng hình ảnh!', 'error');
        return;
    }

    showToast('Đang tải file lên...', 'info');

    try {
        var reader = new FileReader();
        reader.onloadend = async () => {
            var base64String = reader.result;

            var res = await fetch(`${API_BASE}/cms/media`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    original_name: file.name,
                    mime_type: file.type,
                    media_type: 'image',
                    data_base64: base64String
                })
            });

            var result = await res.json();
            if (result.success) {
                showToast('Đã tải hình ảnh lên thư viện thành công!');
                loadMediaLibrary(); // Refresh grid
            } else {
                showToast('Tải lên thất bại: ' + result.message, 'error');
            }
        };
        reader.readAsDataURL(file);
    } catch(e) {
        showToast('Lỗi tải file: ' + e.message, 'error');
    }
}

window.deleteMedia = async function(id) {
    if (!confirm('Bạn có chắc muốn xóa ảnh này khỏi thư viện?')) return;

    showToast('Đang xóa...', 'info');
    try {
        var res = await fetch(`${API_BASE}/cms/media/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        var result = await res.json();
        if (result.success) {
            showToast('Đã xóa ảnh thành công!');
            loadMediaLibrary(); // Refresh grid
        } else {
            showToast('Xóa ảnh thất bại: ' + result.message, 'error');
        }
    } catch(e) {
        showToast('Lỗi xóa ảnh: ' + e.message, 'error');
    }
};

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã sao chép liên kết vào bộ nhớ tạm!');
    }).catch(err => {
        showToast('Lỗi copy: ' + err.message, 'error');
    });
};

window.downloadMedia = async function(url, originalName) {
    try {
        showToast('Đang chuẩn bị tải ảnh...', 'info');
        const res = await fetch(url);
        if (!res.ok) throw new Error('Không thể tải file từ server');
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = originalName || 'downloaded_image';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        showToast('Tải ảnh thành công!');
    } catch (e) {
        showToast('Lỗi khi tải ảnh: ' + e.message, 'error');
    }
};

// ──────────────────────────────────────────────
// LIVE PREVIEW & TOGGLING LOGIC
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// LIVE PREVIEW — Auto-render khi soạn thảo
// ──────────────────────────────────────────────

var _previewTimer = null;

/** Debounced live preview: gọi renderLivePreview sau 300ms idle */
function schedulePreviewUpdate() {
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() => renderLivePreview(), 300);
}

/** Gắn event listeners lên các trường soạn thảo để tự động cập nhật preview */
function setupLivePreviewListeners() {
    var titleInput = document.getElementById('article-title-input');
    var excerptInput = document.getElementById('article-excerpt-input');
    var contentBody = document.getElementById('article-content-body');
    var catSelect = document.getElementById('article-category-select');
    var authorSelect = document.getElementById('article-author-select');

    if (titleInput) titleInput.addEventListener('input', schedulePreviewUpdate);
    if (excerptInput) excerptInput.addEventListener('input', schedulePreviewUpdate);
    if (contentBody) {
        contentBody.addEventListener('input', schedulePreviewUpdate);
        // MutationObserver cho trường hợp toolbar thay đổi nội dung (bold, heading...)
        var observer = new MutationObserver(schedulePreviewUpdate);
        observer.observe(contentBody, { childList: true, subtree: true, characterData: true });
    }
    if (catSelect) catSelect.addEventListener('change', schedulePreviewUpdate);
    if (authorSelect) authorSelect.addEventListener('change', schedulePreviewUpdate);
}

// Backward compatibility — giữ window.switchModalTab để tránh lỗi nếu đâu đó còn gọi
window.switchModalTab = function() {
    renderLivePreview();
};

// Khởi tạo listeners khi trang load
document.addEventListener('DOMContentLoaded', () => {
    setupLivePreviewListeners();
});

function renderLivePreview() {
    var previewWrapper = document.getElementById('editor-preview-wrapper');
    if (!previewWrapper) return;

    var title = document.getElementById('article-title-input').value.trim() || 'Tiêu đề bài viết';
    var excerpt = document.getElementById('article-excerpt-input').value.trim() || 'Tóm tắt bài viết sẽ hiển thị ở đây...';
    var content = document.getElementById('article-content-body').innerHTML.trim();
    if (content.includes('Nhập nội dung bài viết tại đây') || !content) {
        content = '<p style="color:#9ca3af;font-style:italic;">Nội dung bài viết chưa được soạn thảo...</p>';
    }

    var catSelect = document.getElementById('article-category-select');
    var catName = catSelect.options[catSelect.selectedIndex]?.text || 'Chưa phân loại';

    var authorSelect = document.getElementById('article-author-select');
    var authorName = authorSelect.options[authorSelect.selectedIndex]?.text || 'Dược sĩ Minh Giang';
    var todayStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    var coverHtml = '';
    if (coverImageUrl) {
        var resolvedCover = resolveImageUrl(coverImageUrl);
        coverHtml = `<img src="${resolvedCover}" style="width: 100%; max-height: 360px; object-fit: cover; border-radius: 12px; margin-bottom: 24px;" alt="Cover">`;
    }

    var tagsHtml = '';
    if (articleTags.length > 0) {
        tagsHtml = `
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
                ${articleTags.map(tag => `<span style="background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 20px;"># ${tag}</span>`).join('')}
            </div>
        `;
    }

    var productsHtml = '';
    if (selectedProducts.length > 0) {
        productsHtml = `
            <div style="margin-top: 40px; border-top: 2px solid #eff6ff; padding-top: 24px;">
                <h3 style="font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-pills" style="color: #10b981;"></i> Sản phẩm liên quan được đề xuất
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">
                    ${selectedProducts.map(prod => {
                        var cached = productCache.find(p => p.id === prod.id) || {};
                        var price = cached.price ? Number(cached.price).toLocaleString('vi-VN') + 'đ' : 'Liên hệ';
                        var thumb = cached.thumbnail_url || '../assets/images/placeholder-product.png';
                        return `
                            <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; background: #fff; transition: box-shadow 0.2s;">
                                <img src="${thumb}" style="width: 100%; height: 120px; object-fit: contain; margin-bottom: 8px; background: #f8fafc; border-radius: 6px;" alt="${prod.name}">
                                <h4 style="font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 6px; line-height: 1.4; height: 36px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${prod.name}">${prod.name}</h4>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 8px;">
                                    <span style="font-size: 13px; font-weight: 700; color: #ef4444;">${price}</span>
                                    <button type="button" style="background: #10b981; color: white; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">Chọn mua</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    previewWrapper.innerHTML = `
        <div style="font-size: 13px; font-weight: 600; color: #3b82f6; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">${catName}</div>
        <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.3; margin-bottom: 12px;">${title}</h1>
        <div style="font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
            <span>Đăng bởi <strong>${authorName}</strong></span>
            <span>•</span>
            <span>${todayStr}</span>
            <span>•</span>
            <span><i class="fa-regular fa-eye"></i> 0 lượt đọc</span>
        </div>
        ${coverHtml}
        <div style="font-size: 14px; font-weight: 500; color: #475569; line-height: 1.6; border-left: 3px solid #cbd5e1; padding-left: 14px; margin-bottom: 20px; font-style: italic;">
            ${excerpt}
        </div>
        <div style="font-size: 15px; color: #334155; line-height: 1.7;" class="storefront-content-preview">
            ${content}
        </div>
        ${tagsHtml}
        ${productsHtml}
        ${buildRelatedArticlesHtml(catName)}
    `;

    // Khởi tạo slider auto-scroll sau khi render
    setTimeout(() => initPreviewSlider(), 100);
}

/** Tạo HTML section "BÀI VIẾT LIÊN QUAN" gồm slider + list */
function buildRelatedArticlesHtml(catName) {
    if (!relatedArticles || relatedArticles.length === 0) return '';

    var sliderArticles = relatedArticles.slice(0, 8);
    var listArticles = relatedArticles.slice(0, 6);
    var catSlug = document.getElementById('article-category-select')?.value || '';

    // Slider cards
    var sliderCards = sliderArticles.map(art => {
        var thumb = art.thumbnail || '/uploads/cms/articles/placeholder.webp';
        return `
            <div style="min-width:160px;max-width:160px;flex-shrink:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;">
                <div style="width:160px;height:100px;background:#f1f5f9;overflow:hidden;">
                    <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" alt="${art.title}" onerror="this.style.display='none'">
                </div>
                <div style="padding:8px 10px;">
                    <div style="font-size:11px;font-weight:600;color:#0f172a;line-height:1.4;height:30px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${art.title}</div>
                </div>
            </div>
        `;
    }).join('');

    // List items
    var listItems = listArticles.map(art => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;">
            <div style="width:6px;height:6px;background:#3b82f6;border-radius:50%;flex-shrink:0;margin-top:6px;"></div>
            <div style="font-size:12px;color:#334155;line-height:1.5;font-weight:500;">${art.title}</div>
        </div>
    `).join('');

    var showViewAll = relatedArticles.length > 6;

    return `
        <!-- Section: Bài viết liên quan -->
        <div style="margin-top:40px;border-top:2px solid #e2e8f0;padding-top:24px;">
            <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-newspaper" style="color:#3b82f6;"></i> BÀI VIẾT LIÊN QUAN
            </h3>

            <!-- Slider carousel -->
            <div style="position:relative;margin-bottom:24px;">
                <div id="preview-article-slider" style="display:flex;gap:12px;overflow-x:auto;scroll-behavior:smooth;padding-bottom:8px;scrollbar-width:none;">
                    ${sliderCards}
                </div>
                <button onclick="document.getElementById('preview-article-slider').scrollBy({left:-180,behavior:'smooth'})" 
                    style="position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;background:white;border:1px solid #e2e8f0;box-shadow:0 2px 6px rgba(0,0,0,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#475569;">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button onclick="document.getElementById('preview-article-slider').scrollBy({left:180,behavior:'smooth'})" 
                    style="position:absolute;right:-8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;background:white;border:1px solid #e2e8f0;box-shadow:0 2px 6px rgba(0,0,0,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#475569;">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>

            <!-- Sidebar-style list -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                <h4 style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                    <i class="fa-solid fa-list" style="color:#6b7280;"></i> TIN LIÊN QUAN
                </h4>
                ${listItems}
                ${showViewAll ? `
                <div style="text-align:center;margin-top:12px;">
                    <a href="#" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#3b82f6;text-decoration:none;padding:6px 16px;border:1px solid #3b82f6;border-radius:20px;transition:all 0.2s;" 
                       onmouseover="this.style.background='#3b82f6';this.style.color='white'" 
                       onmouseout="this.style.background='transparent';this.style.color='#3b82f6'">
                        <i class="fa-solid fa-arrow-right"></i> Xem tất cả
                    </a>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

/** Khởi tạo auto-scroll cho slider trong preview */
function initPreviewSlider() {
    var slider = document.getElementById('preview-article-slider');
    if (!slider || slider.children.length <= 3) return;

    var scrollInterval;
    var startAutoScroll = () => {
        scrollInterval = setInterval(() => {
            if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 10) {
                slider.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                slider.scrollBy({ left: 172, behavior: 'smooth' });
            }
        }, 3000);
    };

    slider.addEventListener('mouseenter', () => clearInterval(scrollInterval));
    slider.addEventListener('mouseleave', startAutoScroll);
    startAutoScroll();
}

// ──────────────────────────────────────────────
// AUTO-SUGGESTION FOR DISEASE CATEGORIES
// ──────────────────────────────────────────────
function suggestIconAndColor(name) {
    if (!name) return;
    var nameLower = name.toLowerCase();

    var icon = 'fa-solid fa-notes-medical';
    var color = '#3b82f6'; // Mặc định xanh dương

    if (nameLower.includes('tim') || nameLower.includes('huyet ap') || nameLower.includes('huyết áp')) {
        icon = 'fa-solid fa-heart-pulse';
        color = '#ef4444'; // Đỏ
    } else if (nameLower.includes('da ') || nameLower.includes('da-liễu') || nameLower.includes('tóc') || nameLower.includes('móng') || nameLower.includes('da liễu')) {
        icon = 'fa-solid fa-hand-dots';
        color = '#f59e0b'; // Vàng cam
    } else if (nameLower.includes('não') || nameLower.includes('than kinh') || nameLower.includes('thần kinh') || nameLower.includes('đầu')) {
        icon = 'fa-solid fa-brain';
        color = '#8b5cf6'; // Tím
    } else if (nameLower.includes('hô hấp') || nameLower.includes('phổi') || nameLower.includes('ho hap')) {
        icon = 'fa-solid fa-lungs';
        color = '#06b6d4'; // Cyan
    } else if (nameLower.includes('tiêu hóa') || nameLower.includes('dạ dày') || nameLower.includes('bụng') || nameLower.includes('tieu hoa') || nameLower.includes('da day')) {
        icon = 'fa-solid fa-apple-whole';
        color = '#10b981'; // Xanh lá
    } else if (nameLower.includes('xương') || nameLower.includes('khớp') || nameLower.includes('xuong') || nameLower.includes('khop')) {
        icon = 'fa-solid fa-bone';
        color = '#64748b'; // Xám đá
    } else if (nameLower.includes('mắt') || nameLower.includes('mat')) {
        icon = 'fa-solid fa-eye';
        color = '#ec4899'; // Hồng
    } else if (nameLower.includes('tai') || nameLower.includes('mũi') || nameLower.includes('họng')) {
        icon = 'fa-solid fa-ear-listen';
        color = '#14b8a6'; // Xanh ngọc
    } else if (nameLower.includes('thận') || nameLower.includes('tiết niệu') || nameLower.includes('than') || nameLower.includes('tiet nieu')) {
        icon = 'fa-solid fa-droplet';
        color = '#2563eb'; // Xanh hoàng gia
    } else if (nameLower.includes('nam')) {
        icon = 'fa-solid fa-mars';
        color = '#1d4ed8'; // Xanh đậm
    } else if (nameLower.includes('nữ') || nameLower.includes('phụ nữ')) {
        icon = 'fa-solid fa-venus';
        color = '#db2777'; // Magenta
    } else if (nameLower.includes('trẻ') || nameLower.includes('em bé') || nameLower.includes('nhi')) {
        icon = 'fa-solid fa-baby';
        color = '#fbbf24'; // Vàng sáng
    } else if (nameLower.includes('già') || nameLower.includes('cao tuổi') || nameLower.includes('lão')) {
        icon = 'fa-solid fa-person-cane';
        color = '#4b5563'; // Xám tối
    }

    var iconInput = document.getElementById('cat-icon-input');
    if (iconInput) {
        iconInput.value = icon;
        updateIconPreview(icon);
    }

    var colorPicker = document.getElementById('cat-color-picker');
    if (colorPicker) colorPicker.value = color;

    var colorInput = document.getElementById('cat-color-input');
    if (colorInput) colorInput.value = color;
}
