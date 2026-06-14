/**
 * disease-resolver.js
 * Dynamically resolves dead article links (href="#") on listing pages to dynamic URLs
 * (article.html?slug=...) by matching them with crawled database records or slugifying them.
 * Also dynamically populates the sidebar "Tin noi bat" if present.
 *
 * 100% ASCII-clean.
 */
(function () {
    'use strict';

    var GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
    var API_BASE = GATEWAY + '/api';

    function cleanString(str) {
        if (!str) return '';
        return str.toLowerCase()
            .replace(/[\u00e0\u00e1\u1ea1\u1ea3\u00e3\u00e2\u1ea7\u1ea5\u1ead\u1ea9\u1eab\u0103\u1eb1\u1eaf\u1eb7\u1eb3\u1eb5]/g, 'a')
            .replace(/[\u00e8\u00e9\u1eb9\u1ebb\u1ebd\u00ea\u1ec1\u1ebf\u1ec7\u1ec3\u1ec5]/g, 'e')
            .replace(/[\u00ec\u00ed\u1ecb\u1ec9\u0129]/g, 'i')
            .replace(/[\u00f2\u00f3\u1ecd\u1ecf\u00f5\u00f4\u1ed3\u1ed1\u1ed9\u1ed5\u1ed7\u01a1\u1edd\u1edb\u1ee3\u1edf\u1ee1]/g, 'o')
            .replace(/[\u00f9\u00fa\u1ee5\u1ee7\u0169\u01b0\u1eeb\u1ee9\u1ef1\u1eed\u1eef]/g, 'u')
            .replace(/[\u1ef3\u00fd\u1ef5\u1ef7\u1ef9]/g, 'y')
            .replace(/[\u0111]/g, 'd')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    function slugify(str) {
        if (!str) return '';
        return str.toLowerCase()
            .replace(/[\u00e0\u00e1\u1ea1\u1ea3\u00e3\u00e2\u1ea7\u1ea5\u1ead\u1ea9\u1eab\u0103\u1eb1\u1eaf\u1eb7\u1eb3\u1eb5]/g, 'a')
            .replace(/[\u00e8\u00e9\u1eb9\u1ebb\u1ebd\u00ea\u1ec1\u1ebf\u1ec7\u1ec3\u1ec5]/g, 'e')
            .replace(/[\u00ec\u00ed\u1ecb\u1ec9\u0129]/g, 'i')
            .replace(/[\u00f2\u00f3\u1ecd\u1ecf\u00f5\u00f4\u1ed3\u1ed1\u1ed9\u1ed5\u1ed7\u01a1\u1edd\u1edb\u1ee3\u1edf\u1ee1]/g, 'o')
            .replace(/[\u00f9\u00fa\u1ee5\u1ee7\u0169\u01b0\u1eeb\u1ee9\u1ef1\u1eed\u1eef]/g, 'u')
            .replace(/[\u1ef3\u00fd\u1ef5\u1ef7\u1ef9]/g, 'y')
            .replace(/[\u0111]/g, 'd')
            .replace(/[^a-z0-9\s\-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/\-+/g, '-')
            .trim();
    }

    var manualMap = {
        'viem-phoi-huong-dan-nhan-biet-dieu-tri-va-phong-ngua-hieu-qua': 'viem-phoi-la-gi-10-dau-hieu-viem-phoi-nguoi-lon',
        'hen-phe-quan-nguyen-nhan-trieu-chung-va-cach-dieu-tri-hieu-qua-nhat-2025': 'hen-phe-quan-la-gi-cach-dieu-tri-hen-suyen-nguoi-lon',
        'ro-loan-tieu-hoa-la-gi-trieu-chung-nguyen-nhan-va-cach-chua-ro-loan-tieu-hoa': 'roi-loan-tieu-hoa',
        'viem-dai-trang-giai-ma-nguyen-nhan-va-cham-dut-noi-lo-ve-tieu-hoa': 'viem-dai-trang',
        'trao-nguoc-da-day-thuc-quan-gerd-nguyen-nhan-trieu-chung-va-meo-lam-giam-trao-nguoc-da-day': 'trao-nguoc-da-day-thuc-quan',
        'gan-nhiem-mo-fld-nguyen-nhan-trieu-chung-chan-doan-va-dieu-tri': 'gan-nhiem-mo-fld',
        'viem-tai-giua-o-nguoi-lon-va-nhung-bien-chung-nguy-hiem': 'viem-tai-giua-nguoi-lon-va-nhung-bien-chung-nguy-hiem',
        'viem-xoang-la-gi-tai-sao-benh-viem-xoang-lai-kho-chua': 'viem-xoang-la-gi-tai-sao-benh-viem-xoang-lai-kho-chua',
        'viem-amidan-la-gi-nguyen-nhan-trieu-chung-va-5-cach-dieu-tri-hieu-qua': 'viem-amidan-la-gi-nguyen-nhan-trieu-chung-va-5-cach-dieu-tri-hieu-qua',
        'trieu-chung-ung-thu-vom-hong-nhan-biet-som-de-tang-co-hoi-chua-khoi': 'trieu-chung-ung-thu-vom-hong-nhan-biet-som-de-tang-co-hoi-chua-khoi',
        'ung-thu-da-day-dau-hieu-chan-doan-va-phuong-phap-phau-thuat': 'ung-thu-da-day',
        'nguy-co-ngo-doc-botulinum-dau-hieu-nhan-biet-theo-tung-giai-doan': 'ngo-doc-botulinum',
        'benh-uon-van-nguyen-nhan-trieu-chung-nguy-hiem-cach-dieu-tri-va-phong-ngua-hieu-qua': 'benh-uon-van-nguyen-nhan-trieu-chung-nguy-hiem-cach-dieu-tri-va-phong-ngua-hieu-qua',
        'benh-giang-mai-nguyen-nhan-trieu-chung-theo-giai-doan-cach-dieu-tri': 'benh-giang-mai-nguyen-nhan-trieu-chung-theo-giai-doan-cach-dieu-tri'
    };

    function findMatchingArticle(linkText, articles) {
        var cleanLink = cleanString(linkText);
        if (!cleanLink) return null;

        // 1. Exact match
        for (var i = 0; i < articles.length; i++) {
            if (cleanString(articles[i].title) === cleanLink) {
                return articles[i];
            }
        }

        // 2. Inclusion match (one contains the other)
        for (var i = 0; i < articles.length; i++) {
            var cleanTitle = cleanString(articles[i].title);
            if (cleanTitle.indexOf(cleanLink) !== -1 || cleanLink.indexOf(cleanTitle) !== -1) {
                return articles[i];
            }
        }

        // 3. Word overlap match (if at least 75% of words in cleanLink match cleanTitle)
        var linkWords = cleanLink.split(/\s+/).filter(Boolean);
        if (linkWords.length >= 3) {
            for (var i = 0; i < articles.length; i++) {
                var titleWords = cleanString(articles[i].title).split(/\s+/).filter(Boolean);
                var matchCount = 0;
                for (var j = 0; j < linkWords.length; j++) {
                    if (titleWords.indexOf(linkWords[j]) !== -1) {
                        matchCount++;
                    }
                }
                if (matchCount / linkWords.length >= 0.75) {
                    return articles[i];
                }
            }
        }

        return null;
    }

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
        return slugMap[str] || str;
    }

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

    function getLinkTitle(link) {
        var heading = link.querySelector('h3, h4');
        if (heading) {
            return (heading.textContent || '').trim();
        }
        return (link.textContent || '').trim();
    }

    function resolvePageLinks() {
        // Step 1: Fetch articles from API
        fetch(API_BASE + '/cms/articles?limit=200')
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (result) {
                var articles = (result && result.success && Array.isArray(result.data)) ? result.data : [];

                // Find all article links on the page (typically under main section grids)
                var links = document.querySelectorAll('main a');
                links.forEach(function (link) {
                    var href = link.getAttribute('href') || '';
                    if (href === '#' || href === '' || href.indexOf('article-benh-gut.html') !== -1) {
                        var text = getLinkTitle(link);
                        if (text.length > 5) {
                            var matched = findMatchingArticle(text, articles);
                            if (matched) {
                                link.setAttribute('href', 'article.html?slug=' + encodeURIComponent(matched.slug));
                            } else {
                                var s = slugify(text);
                                var mappedSlug = manualMap[s] || s;
                                link.setAttribute('href', 'article.html?slug=' + encodeURIComponent(mappedSlug));
                            }
                        }
                    }
                });
            })
            .catch(function (err) {
                console.warn('[DiseaseResolver] Link resolution failed:', err);
                // Simple slugify fallback in case API is down
                var links = document.querySelectorAll('main a');
                links.forEach(function (link) {
                    var href = link.getAttribute('href') || '';
                    if (href === '#' || href === '') {
                        var text = getLinkTitle(link);
                        if (text.length > 5) {
                            var s = slugify(text);
                            var mappedSlug = manualMap[s] || s;
                            link.setAttribute('href', 'article.html?slug=' + encodeURIComponent(mappedSlug));
                        }
                    }
                });
            });

        // Step 2: Fetch and render featured sidebar articles if container exists
        var featuredList = document.querySelector('.tin-noi-bat-list');
        if (featuredList) {
            fetch(API_BASE + '/cms/articles?sort=popular&limit=4&type=disease')
                .catch(function () {
                    return fetch(API_BASE + '/cms/articles?sort=popular&limit=4');
                })
                .then(function (res) { return res.json(); })
                .then(function (featRes) {
                    var featured = (featRes && featRes.success && Array.isArray(featRes.data)) ? featRes.data : [];
                    if (featured.length > 0) {
                        featuredList.innerHTML = featured.map(renderFeaturedCard).join('');
                    }
                })
                .catch(function (err) {
                    console.warn('[DiseaseResolver] Featured news sidebar population failed:', err);
                });
        }
    }

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolvePageLinks);
    } else {
        resolvePageLinks();
    }
})();
