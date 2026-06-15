/**
 * article-loader.js
 * Dynamic template for article.html
 * Reads ?slug= from URL, fetches GET /api/cms/articles/{slug},
 * renders content dynamically.
 * All API calls go through Gateway :8000.
 */
(function () {
    'use strict';

    var GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
    var CMS_BASE = GATEWAY + '/api/cms';
    var CATALOG_BASE = GATEWAY + '/api/catalog';

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

    function getSlugFromCleanName(name) {
        if (!name) return 'disease';
        var cleanToSlug = {
            'Ki\u1ec1n th\u1ee9c b\u1ec7nh l\u00fd': 'kien-thuc-benh-ly',
            'B\u1ec7nh chuy\u00ean khoa': 'benh-chuyen-khoa',
            'C\u01a1 \u2013 X\u01b0\u01a1ng \u2013 Kh\u1edbp': 'co-xuong-khop',
            'B\u1ec7nh m\u00e3n t\u00ednh': 'benh-man-tinh',
            'Da \u2013 T\u00f3c \u2013 M\u00f3ng': 'da-toc-mong',
            'B\u1ec7nh theo m\u00f9a': 'benh-theo-mua',
            'H\u1ec7 th\u1ea7n kinh': 'he-than-kinh',
            'B\u1ec7nh truy\u1ec1n nhi\u1ec5m': 'benh-truyen-nhiem',
            'H\u00f4 h\u1ea5p': 'ho-hap',
            'B\u1ec7nh ung th\u01b0': 'benh-ung-thu',
            'M\u1eaft': 'mat',
            'B\u1ec7nh l\u1ea1 / B\u1ec7nh hi\u1ebfm g\u1eb7p': 'benh-la-hiem-gap',
            'M\u00e1u': 'mau',
            'B\u1ec7nh c\u01a1 th\u1ec3 ng\u01b0\u1eddi': 'benh-co-the-nguoi',
            'Tai \u2013 M\u0169i \u2013 H\u1ecdng': 'tai-mui-hong',
            'B\u1ec7nh theo \u0111\u1ed1i t\u01b0\u1ee3ng': 'benh-theo-doi-tuong',
            'N\u1ed9i ti\u1ebft': 'noi-tiet',
            'R\u0103ng \u2013 H\u00e0m \u2013 M\u1eb7t': 'rang-ham-mat',
            'Th\u1eadn \u2013 Ti\u1ebft ni\u1ec7u': 'than-tiet-nieu',
            'Ti\u00eau h\u00f3a \u2013 Gan m\u1eadt \u2013 T\u1ee5y': 'tieu-hoa',
            'Tim m\u1ea1ch \u2013 Huy\u1ebft \u00e1p': 'tim-mach'
        };
        return cleanToSlug[name] || 'disease';
    }

    function getParam(name) {
        return new URLSearchParams(window.location.search).get(name) || '';
    }

    function escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return dateStr; }
    }

    function estimateReadTime(htmlContent) {
        var text = htmlContent ? htmlContent.replace(/<[^>]*>/g, '') : '';
        var words = text.split(/\s+/).filter(Boolean).length;
        var minutes = Math.max(1, Math.round(words / 200));
        return minutes + ' phut doc';
    }

    function fetchJson(url) {
        return fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            });
    }

    // Show loading skeleton inside article-main
    function showSkeleton() {
        var articleMain = document.querySelector('.article-main');
        if (!articleMain) return;
        articleMain.innerHTML = '<div style="animation:pulse 1.5s infinite;">'
            + '<div style="height:32px;background:#e5e7eb;border-radius:6px;margin-bottom:16px;width:80%;"></div>'
            + '<div style="height:16px;background:#f3f4f6;border-radius:4px;margin-bottom:8px;width:50%;"></div>'
            + '<div style="height:200px;background:#e5e7eb;border-radius:8px;margin:20px 0;"></div>'
            + '<div style="height:15px;background:#f3f4f6;border-radius:4px;margin-bottom:8px;"></div>'
            + '<div style="height:15px;background:#f3f4f6;border-radius:4px;margin-bottom:8px;width:90%;"></div>'
            + '</div>'
            + '<style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}</style>';
    }

    // Show error state
    function showError(msg) {
        var articleMain = document.querySelector('.article-main');
        if (articleMain) {
            articleMain.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#6b7280;">'
                + '<i class="fa-solid fa-triangle-exclamation" style="font-size:48px;color:#d1d5db;margin-bottom:16px;display:block;"></i>'
                + '<h2 style="font-size:20px;font-weight:700;color:#374151;margin-bottom:8px;">Khong tim thay bai viet</h2>'
                + '<p style="font-size:14px;margin-bottom:24px;">' + escHtml(msg) + '</p>'
                + '<a href="disease.html" style="display:inline-block;padding:10px 24px;background:#0b7a3e;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">'
                + '<- Quay lai Benh ly</a></div>';
        }
        var sidebar = document.querySelector('.article-sidebar');
        if (sidebar) sidebar.style.display = 'none';
    }

    // Build table of contents from rendered headings
    function buildTOC(contentEl) {
        var headings = contentEl.querySelectorAll('h2, h3');
        var tocBox = document.getElementById('tocBox');
        if (headings.length < 2) {
            if (tocBox) tocBox.style.display = 'none';
            return;
        }
        var tocContent = document.getElementById('tocContent');
        if (!tocContent) return;

        var items = [];
        var currentH2 = null;
        headings.forEach(function (h, idx) {
            if (!h.id) h.id = 'section-' + idx;
            if (h.tagName === 'H2') {
                currentH2 = { id: h.id, text: h.textContent, children: [] };
                items.push(currentH2);
            } else if (h.tagName === 'H3' && currentH2) {
                currentH2.children.push({ id: h.id, text: h.textContent });
            }
        });

        var html = '<ol class="toc-list">';
        items.forEach(function (item) {
            html += '<li><a href="#' + item.id + '">' + escHtml(item.text) + '</a>';
            if (item.children.length > 0) {
                html += '<ul class="toc-sub">';
                item.children.forEach(function (sub) {
                    html += '<li><a href="#' + sub.id + '">' + escHtml(sub.text) + '</a></li>';
                });
                html += '</ul>';
            }
            html += '</li>';
        });
        html += '</ol>';
        tocContent.innerHTML = html;

        // Smooth scroll for TOC links
        tocContent.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                var id = this.getAttribute('href').substring(1);
                var target = document.getElementById(id);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    // Render related articles in sidebar
    function renderRelatedArticles(articles, container, catSlug) {
        if (!container) return;
        if (!articles || articles.length === 0) {
            var card = container.closest('.sidebar-card');
            if (card) card.style.display = 'none';
            return;
        }
        var html = '';
        articles.slice(0, 6).forEach(function (a) {
            var href = 'article.html?slug=' + encodeURIComponent(a.slug || '');
            html += '<a href="' + href + '">' + escHtml(a.title) + '</a>';
        });

        var showViewAll = articles.length > 6;
        if (showViewAll) {
            var viewAllHref = catSlug ? catSlug + '.html' : 'disease.html';
            html += '<div style="text-align:center;margin-top:12px;padding-top:8px;border-top:1px dashed #f3f4f6;">'
                + '<a href="' + viewAllHref + '" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#0b7a3e;text-decoration:none;padding:6px 16px;border:1px solid #0b7a3e;border-radius:20px;transition:all 0.2s;" '
                + 'onmouseover="this.style.background=\'#0b7a3e\';this.style.color=\'white\'" '
                + 'onmouseout="this.style.background=\'transparent\';this.style.color=\'#0b7a3e\'">'
                + '<i class="fa-solid fa-arrow-right"></i> Xem tất cả'
                + '</a>'
                + '</div>';
        }
        container.innerHTML = html;
    }

    // Render related products in sidebar
    function renderRelatedProducts(products, container) {
        if (!container) return;
        if (!products || products.length === 0) {
            var card = container.closest('.sidebar-card');
            if (card) card.style.display = 'none';
            return;
        }
        var fallback = '../assets/images/product_frame.png';
        var html = '';
        products.slice(0, 3).forEach(function (p) {
            var thumbnail = p.thumbnail || fallback;
            if (thumbnail.indexOf('/assets/') === 0) {
                thumbnail = '..' + thumbnail;
            }
            var price = p.retail_price || p.price || 0;
            var priceStr = price ? new Intl.NumberFormat('vi-VN').format(Math.round(price)) + 'd' : 'Lien he';
            html += '<a href="product.html?id=' + p.id + '" class="sidebar-featured-item">'
                + '<div class="sidebar-featured-img">'
                + '<img src="' + thumbnail + '" alt="' + escHtml(p.name) + '" onerror="this.src=\'' + fallback + '\'">'
                + '<span class="overlay-label">San pham lien quan</span>'
                + '</div>'
                + '<div class="sidebar-featured-text">'
                + '<h4>' + escHtml(p.name) + '</h4>'
                + '<p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#0b7a3e;">' + priceStr + '</p>'
                + '</div></a>';
        });
        container.innerHTML = html;
    }

    // Render related products in grid list under article content
    function renderRelatedProductsGrid(products, container) {
        if (!container) return;
        if (!products || products.length === 0) {
            container.style.display = 'none';
            return;
        }
        var fallback = '../assets/images/product_frame.png';
        var html = '<div style="margin-top: 40px; border-top: 2px solid #eff6ff; padding-top: 24px;">'
            + '<h3 style="font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">'
            + '<i class="fa-solid fa-pills" style="color: #10b981;"></i> Sản phẩm liên quan được đề xuất'
            + '</h3>'
            + '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">';

        products.forEach(function (p) {
            var price = p.retail_price || p.price || 0;
            var priceStr = price ? new Intl.NumberFormat('vi-VN').format(Math.round(price)) + 'đ' : 'Liên hệ';
            var thumb = p.thumbnail_url || p.image_url || p.thumbnail || fallback;
            if (thumb.indexOf('/assets/') === 0) {
                thumb = '..' + thumb;
            }
            if (thumb.indexOf('/uploads/') === 0) {
                thumb = GATEWAY + thumb;
            }
            
            html += '<div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; background: #fff; transition: box-shadow 0.2s;">'
                + '<img src="' + thumb + '" style="width: 100%; height: 120px; object-fit: contain; margin-bottom: 8px; background: #f8fafc; border-radius: 6px;" alt="' + escHtml(p.name) + '" onerror="this.src=\'' + fallback + '\'">'
                + '<h4 style="font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 6px; line-height: 1.4; height: 36px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="' + escHtml(p.name) + '">' + escHtml(p.name) + '</h4>'
                + '<div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 8px;">'
                + '<span style="font-size: 13px; font-weight: 700; color: #ef4444;">' + priceStr + '</span>'
                + '<a href="product.html?id=' + p.id + '" style="background: #10b981; color: white; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer; text-decoration: none;">Chọn mua</a>'
                + '</div>'
                + '</div>';
        });

        html += '</div></div>';
        container.innerHTML = html;
    }

    // Render related articles in slider under article content
    function renderRelatedArticlesGrid(articles, container) {
        if (!container) return;
        if (!articles || articles.length === 0) {
            container.style.display = 'none';
            return;
        }

        var sliderArticles = articles.slice(0, 8);

        // Slider cards
        var sliderCards = sliderArticles.map(function (art) {
            var thumb = art.thumbnail || '../assets/images/placeholder-product.png';
            if (thumb.indexOf('/uploads/') === 0) {
                thumb = GATEWAY + thumb;
            }
            var href = 'article.html?slug=' + encodeURIComponent(art.slug || '');
            return '<div onclick="window.location.href=\'' + href + '\'" style="min-width:160px;max-width:160px;flex-shrink:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;">'
                + '<div style="width:160px;height:100px;background:#f1f5f9;overflow:hidden;">'
                + '<img src="' + thumb + '" style="width:100%;height:100%;object-fit:cover;" alt="' + escHtml(art.title) + '">'
                + '</div>'
                + '<div style="padding:8px 10px;">'
                + '<div style="font-size:11px;font-weight:600;color:#0f172a;line-height:1.4;height:30px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escHtml(art.title) + '</div>'
                + '</div>'
                + '</div>';
        }).join('');

        var html = '<!-- Section: Bài viết liên quan -->'
            + '<div style="margin-top:40px;border-top:2px solid #e2e8f0;padding-top:24px;">'
            + '<h3 style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:8px;">'
            + '<i class="fa-solid fa-newspaper" style="color:#3b82f6;"></i> BÀI VIẾT LIÊN QUAN'
            + '</h3>'
            + '<div style="position:relative;margin-bottom:24px;">'
            + '<div id="client-article-slider" style="display:flex;gap:12px;overflow-x:auto;scroll-behavior:smooth;padding-bottom:8px;scrollbar-width:none;">'
            + sliderCards
            + '</div>'
            + '<button onclick="document.getElementById(\'client-article-slider\').scrollBy({left:-180,behavior:\'smooth\'})" '
            + 'style="position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;background:white;border:1px solid #e2e8f0;box-shadow:0 2px 6px rgba(0,0,0,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#475569;">'
            + '<i class="fa-solid fa-chevron-left"></i>'
            + '</button>'
            + '<button onclick="document.getElementById(\'client-article-slider\').scrollBy({left:180,behavior:\'smooth\'})" '
            + 'style="position:absolute;right:-8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;background:white;border:1px solid #e2e8f0;box-shadow:0 2px 6px rgba(0,0,0,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#475569;">'
            + '<i class="fa-solid fa-chevron-right"></i>'
            + '</button>'
            + '</div>'
            + '</div>';

        container.innerHTML = html;

        setTimeout(function () {
            initClientArticleSlider();
        }, 100);
    }

    function initClientArticleSlider() {
        var slider = document.getElementById('client-article-slider');
        if (!slider || slider.children.length <= 3) return;

        var scrollInterval;
        var startAutoScroll = function () {
            scrollInterval = setInterval(function () {
                if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 10) {
                    slider.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    slider.scrollBy({ left: 172, behavior: 'smooth' });
                }
            }, 3000);
        };

        startAutoScroll();

        slider.addEventListener('mouseenter', function () {
            clearInterval(scrollInterval);
        });
        slider.addEventListener('mouseleave', startAutoScroll);
    }

    // Render breadcrumb dynamically
    function renderBreadcrumb(article) {
        var breadcrumb = document.getElementById('articleBreadcrumb');
        if (!breadcrumb) return;
        var cat = article.disease_category;
        var catName = 'Benh ly';
        var catSlug = 'disease';
        if (cat) {
            if (typeof cat === 'object') {
                catName = getCleanCategoryName(cat.slug) || getCleanCategoryName(cat.name) || cat.name || 'Benh ly';
                catSlug = cat.slug || 'disease';
            } else if (typeof cat === 'string') {
                catName = getCleanCategoryName(cat);
                catSlug = getSlugFromCleanName(catName) || 'disease';
            }
        }
        var catHref = (catSlug === 'disease') ? 'disease.html' : (catSlug + '.html');
        breadcrumb.innerHTML = '<a href="index.html">Trang chu</a><span>&rsaquo;</span>'
            + '<a href="disease.html">Benh ly</a><span>&rsaquo;</span>'
            + '<a href="' + catHref + '">' + escHtml(catName) + '</a><span>&rsaquo;</span>'
            + '<span style="color:#374151;">' + escHtml(article.title || '') + '</span>';
    }

    // Main article render
    function renderArticle(article) {
        var articleMain = document.querySelector('.article-main');
        if (!articleMain) return;

        var title = article.title || 'Bai viet';
        var date = formatDate(article.created_at || article.updated_at);
        var authorObj = article.author;
        var author = (authorObj && authorObj.name) ? authorObj.name : 'Duoc si Minh Giang';
        var content = article.content || '';
        var readTime = estimateReadTime(content);
        var excerpt = article.excerpt || '';
        var tags = article.tags || [];

        var shareUrl = encodeURIComponent(window.location.href);
        var metaHtml = '<div class="article-meta">'
            + (date ? '<span><i class="fa-regular fa-calendar"></i> ' + date + '</span>' : '')
            + '<span><i class="fa-regular fa-user"></i> ' + escHtml(author) + '</span>'
            + '<span><i class="fa-regular fa-clock"></i> ' + readTime + '</span>'
            + '</div>';

        var shareHtml = '<div class="article-share">'
            + '<span>Chia se:</span>'
            + '<a href="https://www.facebook.com/sharer/sharer.php?u=' + shareUrl + '" target="_blank" rel="noopener" class="share-btn share-fb">'
            + '<i class="fa-brands fa-facebook-f"></i>Facebook</a>'
            + '<a href="https://zalo.me/share/url?url=' + shareUrl + '" target="_blank" rel="noopener" class="share-btn share-zalo">'
            + '<i class="fa-solid fa-share-nodes"></i>Zalo</a>'
            + '</div>';

        var introHtml = excerpt
            ? '<div class="intro-quote"><p>' + escHtml(excerpt) + '</p></div>'
            : '';

        var tocHtml = '<div class="toc-box" id="tocBox">'
            + '<div class="toc-header" onclick="toggleTOC()">'
            + '<h3>Tom tat noi dung</h3>'
            + '<button class="toc-toggle" id="tocToggleBtn"><i class="fa-solid fa-chevron-up" id="tocIcon"></i></button>'
            + '</div>'
            + '<div id="tocContent"><p style="color:#9ca3af;font-size:13px;">Dang tai muc luc...</p></div>'
            + '</div>';

        var tagsHtml = '';
        if (tags.length > 0) {
            tagsHtml = '<div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">'
                + '<span style="font-size:13px;font-weight:600;color:#374151;margin-right:10px;">Tags:</span>';
            tags.forEach(function (tag) {
                tagsHtml += '<span style="display:inline-block;background:#f0faf4;color:#0b7a3e;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;margin:2px 4px 2px 0;">' + escHtml(tag) + '</span>';
            });
            tagsHtml += '</div>';
        }

        var productsContainerHTML = '<div id="article-related-products-container"></div>';
        var relatedArticlesContainerHTML = '<div id="article-related-articles-container"></div>';

        articleMain.innerHTML = '<h1 class="article-title">' + escHtml(title) + '</h1>'
            + metaHtml + shareHtml + introHtml + tocHtml
            + '<div class="article-content" id="articleContent">' + content + '</div>'
            + tagsHtml
            + productsContainerHTML
            + relatedArticlesContainerHTML;

        // Build TOC from rendered content
        var contentEl = document.getElementById('articleContent');
        if (contentEl) buildTOC(contentEl);

        // Update page title and meta description
        document.title = title + ' \u2014 Nha Thuoc Minh Giang';
        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && excerpt) metaDesc.setAttribute('content', excerpt);

        // Update breadcrumb
        renderBreadcrumb(article);

        // Ẩn block sản phẩm liên quan cũ ở sidebar
        var sidebarProdsCard = document.querySelector('.sidebar-featured-list');
        if (sidebarProdsCard) {
            var card = sidebarProdsCard.closest('.sidebar-card');
            if (card) card.style.display = 'none';
        }

        // Vẫn giữ tin liên quan dạng text rút gọn ở sidebar kèm nút Xem tất cả
        var cat = article.disease_category;
        var catSlug = 'disease';
        if (cat) {
            if (typeof cat === 'object') {
                catSlug = cat.slug || 'disease';
            } else if (typeof cat === 'string') {
                catSlug = getSlugFromCleanName(getCleanCategoryName(cat)) || 'disease';
            }
        }
        renderRelatedArticles(article.related_articles, document.querySelector('.sidebar-related-list'), catSlug);
        
        // Render Grid sản phẩm liên quan ở cuối bài viết
        var gridContainer = document.getElementById('article-related-products-container');
        if (gridContainer) {
            var relatedProds = article.related_products || [];
            if (relatedProds.length > 0) {
                var ids = relatedProds.map(function (p) { return p.id; }).filter(Boolean).join(',');
                if (ids) {
                    fetchJson(CATALOG_BASE + '/products?ids=' + ids)
                        .then(function (prodRes) {
                            var catalogProds = (prodRes && prodRes.success && Array.isArray(prodRes.data)) ? prodRes.data : [];
                            if (catalogProds.length > 0) {
                                renderRelatedProductsGrid(catalogProds, gridContainer);
                            } else {
                                renderRelatedProductsGrid(relatedProds, gridContainer);
                            }
                        })
                        .catch(function (err) {
                            console.warn('[ArticleLoader] Catalog products fetch failed:', err);
                            renderRelatedProductsGrid(relatedProds, gridContainer);
                        });
                } else {
                    renderRelatedProductsGrid(relatedProds, gridContainer);
                }
            } else {
                renderRelatedProductsGrid(relatedProds, gridContainer);
            }
        }

        // Render Slider Bài viết liên quan ở cuối bài viết (chỉ có slider)
        var articlesGridContainer = document.getElementById('article-related-articles-container');
        if (articlesGridContainer) {
            renderRelatedArticlesGrid(article.related_articles, articlesGridContainer);
        }
    }

    // Load article on page init
    function loadArticle() {
        var slug = getParam('slug');
        if (!slug) {
            showSkeleton();
            setTimeout(function () {
                showError('Khong tim thay bai viet. Vui long thu lai tu trang Benh ly.');
            }, 100);
            return;
        }

        showSkeleton();
        fetchJson(CMS_BASE + '/articles/' + encodeURIComponent(slug))
            .then(function (res) {
                if (!res.success || !res.data) {
                    showError('Bai viet khong ton tai hoac da bi xoa.');
                    return;
                }
                renderArticle(res.data);
            })
            .catch(function (err) {
                if (err.message.indexOf('404') !== -1) {
                    showError('Bai viet khong ton tai hoac da bi xoa.');
                } else {
                    showError('Khong the tai bai viet. Vui long kiem tra ket noi va thu lai.');
                }
                console.error('[ArticleLoader] Load failed:', err);
            });
    }

    // TOC toggle (global for onclick attribute)
    window.toggleTOC = function () {
        var content = document.getElementById('tocContent');
        var icon = document.getElementById('tocIcon');
        if (!content) return;
        var isHidden = content.style.display === 'none';
        content.style.display = isHidden ? '' : 'none';
        if (icon) icon.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    };

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadArticle);
    } else {
        loadArticle();
    }
})();
