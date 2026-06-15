/**
 * disease-group-loader.js
 * Shared loader for disease group listing pages:
 * benh-truyen-nhiem.html, benh-man-tinh.html,
 * benh-la-hiem-gap.html, benh-theo-mua.html
 *
 * - Auto-detects category slug from page filename
 * - All API calls go through Gateway :8000
 * - Graceful fallback when API is unavailable
 */
(function () {
    'use strict';

    var GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
    var CMS_BASE = GATEWAY + '/api/cms';

    function getCleanCategoryName(str) {
        if (!str) return '';
        var slugMap = {
            'kien-thuc-benh-ly': 'Ki\u1ec1n th\u1ee9c b\u1ec7nh l\u00fd',
            'benh-chuyen-khoa': 'B\u1ec7nh chuy\u00ean khoa',
            'co-xuong-khop': 'C\u01a1 \u2013 X\u01b0\u01a1ng \u2013 Kh\u1edbp',
            'benh-man-tinh': 'B\u1ec7nh m\u00e3n t\u00ednh',
            'da-toc-mong': 'Da \u2013 T\u00f3c \u2013 M\u00f3ng',
            'benh-theo-mua': 'B\u1ec7nh theo m\u00f9a',
            'he-than-kinh': 'H\u1ec7 th\u1ea7n kinh',
            'benh-truyen-nhiem': 'B\u1ec7nh truy\u1ec1n nhi\u1ec5m',
            'ho-hap': 'H\u00f4 h\u1ea5p',
            'benh-ung-thu': 'B\u1ec7nh ung th\u01b0',
            'mat': 'M\u1eaft',
            'benh-la-hiem-gap': 'B\u1ec7nh l\u1ea1 / B\u1ec7nh hi\u1ebfm g\u1eb7p',
            'mau': 'M\u00e1u',
            'benh-co-the-nguoi': 'B\u1ec7nh c\u01a1 th\u1ec3 ng\u01b0\u1eddi',
            'tai-mui-hong': 'Tai \u2013 M\u0169i \u2013 H\u1ecdng',
            'benh-theo-doi-tuong': 'B\u1ec7nh theo \u0111\u1ed1i t\u01b0\u1ee3ng',
            'noi-tiet': 'N\u1ed9i ti\u1ebft',
            'rang-ham-mat': 'R\u0103ng \u2013 H\u00e0m \u2013 M\u1eb7t',
            'than-tiet-nieu': 'Th\u1eadn \u2013 Ti\u1ebft ni\u1ec7u',
            'tieu-hoa': 'Ti\u00eau h\u00f3a \u2013 Gan m\u1eadt \u2013 T\u1ee5y',
            'tim-mach': 'Tim m\u1ea1ch \u2013 Huy\u1ebft \u00e1p'
        };

        if (slugMap[str]) return slugMap[str];

        for (var i = 0; i < str.length; i++) {
            if (str.charCodeAt(i) > 255) {
                return str;
            }
        }

        try {
            var win1252Map = {
                0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
                0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D,
                0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
                0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178
            };
            var revWin1252 = {};
            for (var i = 0; i <= 255; i++) revWin1252[i] = i;
            for (var k in win1252Map) {
                if (win1252Map.hasOwnProperty(k)) revWin1252[win1252Map[k]] = parseInt(k);
            }

            var bytes = [];
            for (var j = 0; j < str.length; j++) {
                var code = str.charCodeAt(j);
                if (revWin1252[code] !== undefined) {
                    bytes.push(revWin1252[code]);
                } else if (code <= 0xFF) {
                    bytes.push(code);
                } else {
                    bytes.push(code & 0xFF);
                }
            }
            var decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
            var decodedMap = {
                'B\u1ec7nh truy\ufffd n nhi\u1ec5m': 'B\u1ec7nh truy\u1ec1n nhi\u1ec5m',
                'B\u1ec7nh c\u01a1 th\u1ec3 ng\u01b0\ufffd i': 'B\u1ec7nh c\u01a1 th\u1ec3 ng\u01b0\u1eddi',
                'Tai \u2013 M\u0169i \u2013 H\ufffd ng': 'Tai \u2013 M\u0169i \u2013 H\u1ecdng'
            };
            return decodedMap[decoded] || decoded;
        } catch (e) {
            return str;
        }
    }

    // Detect slug from URL filename
    function detectSlug() {
        var pathname = window.location.pathname;
        var filename = pathname.split('/').pop() || '';
        return filename.replace('.html', '');
    }

    // Render article card skeletons
    function renderArticleSkeletons(container, count) {
        var html = '';
        for (var i = 0; i < count; i++) {
            html += '<div class="article-card-main skeleton-card" style="pointer-events:none">'
                + '<div style="width:100%;height:160px;background:#e5e7eb;border-radius:4px 4px 0 0;"></div>'
                + '<div class="article-card-content">'
                + '<div style="width:60%;height:12px;background:#e5e7eb;border-radius:4px;margin-bottom:12px;"></div>'
                + '<div style="width:100%;height:14px;background:#e5e7eb;border-radius:4px;margin-bottom:6px;"></div>'
                + '<div style="width:85%;height:14px;background:#e5e7eb;border-radius:4px;"></div>'
                + '</div></div>';
        }
        container.innerHTML = html;
    }

    // Render sidebar skeletons
    function renderFeaturedSkeletons(container, count) {
        var html = '';
        for (var i = 0; i < count; i++) {
            html += '<div class="tin-noi-bat-card" style="pointer-events:none">'
                + '<div style="width:100%;height:140px;background:#e5e7eb;border-radius:6px;"></div>'
                + '<div style="width:60%;height:11px;background:#f3f4f6;border-radius:4px;margin-top:8px;"></div>'
                + '<div style="width:100%;height:13px;background:#e5e7eb;border-radius:4px;margin-top:4px;"></div>'
                + '</div>';
        }
        container.innerHTML = html;
    }

    // Render article card
    function renderArticleCard(article, categoryName) {
        var slug = article.slug || '';
        var title = article.title || 'Bai viet';
        var excerpt = article.excerpt || '';
        var thumbnail = article.thumbnail || '';
        if (thumbnail && thumbnail.indexOf('/uploads/') === 0) {
            thumbnail = GATEWAY + thumbnail;
        }
        var catLabel = getCleanCategoryName(article.disease_category) || categoryName || '';
        var href = 'article.html?slug=' + encodeURIComponent(slug);
        var fallback = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzAwIDIwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5Y2EzYWYiPk1pbmggR2lhbmcgUGhhcm1hY3k8L3RleHQ+PC9zdmc+";
        return '<a href="' + href + '" class="article-card-main">'
            + '<img src="' + (thumbnail || fallback) + '" alt="" onerror="this.src=\'' + fallback + '\'">'
            + '<div class="article-card-content">'
            + '<span class="article-category">' + catLabel + '</span>'
            + '<h3>' + title + '</h3>'
            + '<p>' + excerpt + '</p>'
            + '</div></a>';
    }

    // Render featured sidebar card
    function renderFeaturedCard(article) {
        var slug = article.slug || '';
        var title = article.title || '';
        var thumbnail = article.thumbnail || '';
        if (thumbnail && thumbnail.indexOf('/uploads/') === 0) {
            thumbnail = GATEWAY + thumbnail;
        }
        var catLabel = getCleanCategoryName(article.disease_category) || '';
        var href = 'article.html?slug=' + encodeURIComponent(slug);
        var fallback = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzAwIDIwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5Y2EzYWYiPk1pbmggR2lhbmcgUGhhcm1hY3k8L3RleHQ+PC9zdmc+";
        return '<a href="' + href + '" class="tin-noi-bat-card">'
            + '<img src="' + (thumbnail || fallback) + '" alt="" onerror="this.src=\'' + fallback + '\'">'
            + '<span class="article-category" style="margin-bottom:4px;">' + catLabel + '</span>'
            + '<h4>' + title + '</h4>'
            + '</a>';
    }

    // Fetch JSON helper
    function fetchJson(url) {
        return fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            });
    }

    // Main loader
    function loadDiseaseGroupPage() {
        var slug = detectSlug();
        if (!slug || slug.indexOf('benh-') !== 0) return;

        var articlesGrid = document.getElementById('articlesGrid');
        var featuredList = document.getElementById('featuredList');

        if (articlesGrid) renderArticleSkeletons(articlesGrid, 3);
        if (featuredList) renderFeaturedSkeletons(featuredList, 3);

        var categoryId = null;
        var categoryName = '';

        // Step 1: Get disease category info
        fetchJson(CMS_BASE + '/disease-categories/' + slug)
            .then(function (catRes) {
                if (catRes.success && catRes.data) {
                    categoryId = catRes.data.id;
                    categoryName = getCleanCategoryName(catRes.data.slug) || getCleanCategoryName(catRes.data.name) || catRes.data.name || '';
                }
            })
            .catch(function (err) {
                console.warn('[DiseaseGroupLoader] Category fetch failed:', err.message);
            })
            .finally(function () {
                // Step 2: Get articles
                var articleUrl = categoryId
                    ? CMS_BASE + '/articles?disease_category_id=' + categoryId + '&limit=12'
                    : CMS_BASE + '/articles?type=disease&limit=12';

                return fetchJson(articleUrl)
                    .then(function (artRes) {
                        var articles = (artRes.success && Array.isArray(artRes.data)) ? artRes.data : [];
                        if (articlesGrid) {
                            if (articles.length > 0) {
                                articlesGrid.innerHTML = articles.map(function (a) {
                                    return renderArticleCard(a, categoryName);
                                }).join('');
                            } else {
                                articlesGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#9ca3af;">'
                                    + '<p style="font-size:15px;margin:0;">Chua co bai viet cho nhom benh nay.</p>'
                                    + '</div>';
                            }
                        }
                    })
                    .catch(function (err) {
                        console.warn('[DiseaseGroupLoader] Articles fetch failed:', err.message);
                        if (articlesGrid) {
                            articlesGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#9ca3af;">'
                                + '<p style="font-size:15px;margin:0;">Khong the tai bai viet. Vui long thu lai.</p>'
                                + '</div>';
                        }
                    });
            });

        // Step 3: Get featured articles for sidebar (independent)
        fetchJson(CMS_BASE + '/articles?sort=popular&limit=4&type=disease')
            .catch(function () {
                return fetchJson(CMS_BASE + '/articles?sort=popular&limit=4');
            })
            .then(function (featRes) {
                var featured = (featRes && featRes.success && Array.isArray(featRes.data)) ? featRes.data : [];
                if (featuredList) {
                    if (featured.length > 0) {
                        featuredList.innerHTML = featured.map(renderFeaturedCard).join('');
                    } else {
                        featuredList.innerHTML = '<p style="font-size:13px;color:#9ca3af;padding:12px 0;margin:0;">Chua co bai viet noi bat.</p>';
                    }
                }
            })
            .catch(function (err) {
                console.warn('[DiseaseGroupLoader] Featured fetch failed:', err.message);
                if (featuredList) featuredList.innerHTML = '';
            });
    }

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDiseaseGroupPage);
    } else {
        loadDiseaseGroupPage();
    }
})();
