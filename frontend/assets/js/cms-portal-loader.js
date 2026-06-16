/**
 * cms-portal-loader.js
 * Dynamic loader for health.html (Góc sức khỏe) and news.html (Tin tức y tế)
 * Fetches data from CMS Service /api/cms/articles
 */

(function () {
    'use strict';

    const GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
    const CMS_BASE = GATEWAY + '/api/cms';

    let currentCategory = 'all';
    let cmsType = 'health'; // 'health' or 'news'

    function getCleanCategoryName(slugOrName) {
        if (!slugOrName) return '';
        const norm = String(slugOrName).toLowerCase().trim();
        const mapping = {
            'suc-khoe-tong-quat': 'Sức khỏe tổng quát',
            'tu-van-dung-thuoc': 'Tư vấn dùng thuốc',
            'tin-tuc-y-te': 'Tin tức y tế',
            'nguoi-cao-tuoi': 'Người cao tuổi',
            'chuong-trinh-khuyen-mai': 'Khuyến mãi'
        };
        return mapping[norm] || slugOrName;
    }

    // Render skeleton loaders
    function renderSkeletons(gridEl, sidebarEl) {
        if (gridEl) {
            gridEl.innerHTML = Array(6).fill().map(() => `
                <div class="article-card-main skeleton-card" style="pointer-events:none; opacity: 0.7;">
                    <div style="width:100%; height:160px; background:#e5e7eb;"></div>
                    <div class="article-card-content">
                        <div style="width:50%; height:12px; background:#e5e7eb; border-radius:4px; margin-bottom:10px;"></div>
                        <div style="width:90%; height:15px; background:#e5e7eb; border-radius:4px; margin-bottom:8px;"></div>
                        <div style="width:75%; height:15px; background:#e5e7eb; border-radius:4px;"></div>
                    </div>
                </div>
            `).join('');
        }
        if (sidebarEl) {
            sidebarEl.innerHTML = Array(4).fill().map(() => `
                <div class="tin-noi-bat-card" style="pointer-events:none; opacity: 0.7;">
                    <div style="width:100%; height:120px; background:#e5e7eb; border-radius:6px;"></div>
                    <div style="width:80%; height:13px; background:#e5e7eb; border-radius:4px; margin-top:8px;"></div>
                </div>
            `).join('');
        }
    }

    // Render Article Cards
    function renderArticleCard(art) {
        const title = art.title || 'Bài viết';
        const excerpt = art.excerpt || 'Đang cập nhật tóm tắt nội dung...';
        const slug = art.slug || '';
        let thumbnail = art.thumbnail_url || art.thumbnail || '';
        if (thumbnail && thumbnail.indexOf('/uploads/') === 0) {
            thumbnail = GATEWAY + thumbnail;
        }
        const fallback = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzAwIDIwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5Y2EzYWYiPk1pbmggR2lhbmcgUGhhcm1hY3k8L3RleHQ+PC9zdmc+";
        const catName = getCleanCategoryName(art.category_name);
        const href = `article.html?slug=${encodeURIComponent(slug)}`;

        return `
            <a href="${href}" class="article-card-main">
                <img src="${thumbnail || fallback}" alt="${title}" onerror="this.src='${fallback}'">
                <div class="article-card-content">
                    <span class="article-category" style="${cmsType === 'news' ? 'color:#1e3a8a; background:#eff6ff;' : ''}">${catName}</span>
                    <h3>${title}</h3>
                    <p>${excerpt}</p>
                </div>
            </a>
        `;
    }

    // Render Sidebar Cards
    function renderSidebarCard(art) {
        const title = art.title || '';
        const slug = art.slug || '';
        let thumbnail = art.thumbnail_url || art.thumbnail || '';
        if (thumbnail && thumbnail.indexOf('/uploads/') === 0) {
            thumbnail = GATEWAY + thumbnail;
        }
        const fallback = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzAwIDIwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5Y2EzYWYiPk1pbmggR2lhbmcgUGhhcm1hY3k8L3RleHQ+PC9zdmc+";
        const href = `article.html?slug=${encodeURIComponent(slug)}`;

        return `
            <a href="${href}" class="tin-noi-bat-card">
                <img src="${thumbnail || fallback}" alt="${title}" onerror="this.src='${fallback}'">
                <h4>${title}</h4>
            </a>
        `;
    }

    async function fetchJson(url) {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    // Load main content list
    async function loadArticles(catId = 'all', searchQuery = '') {
        const gridEl = document.getElementById('articlesGrid');
        if (!gridEl) return;

        gridEl.innerHTML = Array(3).fill().map(() => `
            <div class="article-card-main skeleton-card" style="pointer-events:none; opacity: 0.7;">
                <div style="width:100%; height:160px; background:#e5e7eb;"></div>
                <div class="article-card-content">
                    <div style="width:50%; height:12px; background:#e5e7eb; border-radius:4px; margin-bottom:10px;"></div>
                    <div style="width:90%; height:15px; background:#e5e7eb; border-radius:4px; margin-bottom:8px;"></div>
                </div>
            </div>
        `).join('');

        try {
            let url = '';
            if (cmsType === 'health') {
                if (catId === 'all') {
                    url = `${CMS_BASE}/articles?type=article&limit=100`;
                } else {
                    url = `${CMS_BASE}/articles?category_id=${catId}&limit=100`;
                }
            } else {
                // news type
                url = `${CMS_BASE}/articles?category_id=4&limit=100`;
            }

            if (searchQuery.trim()) {
                url += `&q=${encodeURIComponent(searchQuery.trim())}`;
            }

            const result = await fetchJson(url);
            let articles = (result && result.success && Array.isArray(result.data)) ? result.data : [];

            // Filter out category 4 for health page
            if (cmsType === 'health') {
                articles = articles.filter(a => Number(a.category_id) !== 4);
            }

            if (articles.length === 0) {
                gridEl.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #9ca3af;">
                        <i class="fa-solid fa-folder-open" style="font-size: 48px; margin-bottom: 15px; display: block; color: #d1d5db;"></i>
                        <p style="font-size: 15px; margin: 0;">Không tìm thấy bài viết nào phù hợp.</p>
                    </div>
                `;
                return;
            }

            gridEl.innerHTML = articles.map(renderArticleCard).join('');
        } catch (e) {
            console.error('[CMS Loader] Error loading articles:', e);
            gridEl.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #f87171;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                    <p style="font-size: 15px; margin: 0;">Lỗi kết nối máy chủ. Vui lòng thử lại sau.</p>
                </div>
            `;
        }
    }

    // Load sidebar popular articles
    async function loadFeatured() {
        const sidebarEl = document.getElementById('featuredList');
        if (!sidebarEl) return;

        try {
            let url = '';
            if (cmsType === 'health') {
                url = `${CMS_BASE}/articles?type=article&sort=popular&limit=8`;
            } else {
                url = `${CMS_BASE}/articles?category_id=4&sort=popular&limit=8`;
            }

            const result = await fetchJson(url);
            let articles = (result && result.success && Array.isArray(result.data)) ? result.data : [];

            if (cmsType === 'health') {
                articles = articles.filter(a => Number(a.category_id) !== 4);
            }

            // Slice to popular top 4 after filter
            articles = articles.slice(0, 4);

            if (articles.length === 0) {
                sidebarEl.innerHTML = '<p style="color: #9ca3af; font-size: 13px; padding: 10px 0; margin: 0;">Chưa có bài viết nổi bật.</p>';
                return;
            }

            sidebarEl.innerHTML = articles.map(renderSidebarCard).join('');
        } catch (e) {
            console.warn('[CMS Loader] Error loading popular sidebar:', e);
            sidebarEl.innerHTML = '';
        }
    }

    // Globally exposed switch category tab function
    window.switchCategory = function (catId) {
        currentCategory = catId;
        const tabs = document.querySelectorAll('#categoryTabs .tab-pill');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-category-id') == String(catId)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        const headerEl = document.getElementById('listHeader');
        if (headerEl) {
            const tabNameMap = {
                'all': 'BÀI VIẾT MỚI NHẤT',
                '1': 'SỨC KHỎE TỔNG QUÁT',
                '3': 'TƯ VẤN DÙNG THUỐC',
                '6': 'SỨC KHỎE NGƯỜI CAO TUỔI'
            };
            headerEl.textContent = tabNameMap[catId] || 'DANH SÁCH BÀI VIẾT';
        }

        // Clear search box on tab change
        const searchInput = document.getElementById('cmsSearch');
        if (searchInput) searchInput.value = '';

        loadArticles(catId);
    };

    // Globally exposed search function
    window.triggerCmsSearch = function () {
        const searchInput = document.getElementById('cmsSearch');
        if (!searchInput) return;

        const q = searchInput.value.trim();
        const headerEl = document.getElementById('listHeader');
        if (headerEl) {
            headerEl.textContent = q ? `KẾT QUẢ TÌM KIẾM: "${q}"` : (cmsType === 'news' ? 'TIN TỨC MỚI NHẤT' : 'BÀI VIẾT MỚI NHẤT');
        }

        loadArticles(currentCategory, q);
    };

    function init() {
        const mainEl = document.querySelector('main[data-cms-type]');
        if (!mainEl) return;

        cmsType = mainEl.getAttribute('data-cms-type') || 'health';

        const gridEl = document.getElementById('articlesGrid');
        const sidebarEl = document.getElementById('featuredList');

        renderSkeletons(gridEl, sidebarEl);
        loadArticles(currentCategory);
        loadFeatured();

        // Add Enter key event listener to search input
        const searchInput = document.getElementById('cmsSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    window.triggerCmsSearch();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
