/**
 * disease-page-loader.js
 * Dynamically loads disease specialties and their corresponding articles
 */

const GATEWAY = ((window.MGClientApi && window.MGClientApi.gatewayOrigin) || window.MG_API_GATEWAY_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
const API_BASE = GATEWAY + '/api';

document.addEventListener('DOMContentLoaded', () => {
    const mainEl = document.querySelector('main[data-page-type="specialty-listing"]');
    if (!mainEl) return;

    loadSpecialtyPageData();
});

async function loadSpecialtyPageData() {
    try {
        const slug = window.location.pathname.split('/').pop().replace('.html', '');
        // 1. Fetch subcategories of this level-2 category (e.g. benh-chuyen-khoa or benh-co-the-nguoi)
        const catRes = await fetch(`${API_BASE}/cms/disease-categories/${slug}`);
        const catResult = await catRes.json();
        if (!catResult.success || !catResult.data || !catResult.data.children || catResult.data.children.length === 0) {
            console.warn('[Disease Page Loader] No subcategories found, keeping static fallback.');
            return;
        }

        const categories = catResult.data.children;

        // 2. Fetch all articles
        const artRes = await fetch(`${API_BASE}/cms/articles?limit=200`);
        const artResult = await artRes.json();
        const articles = (artResult.success && artResult.data) ? artResult.data : [];

        // 3. Render sidebar links
        const navEl = document.getElementById('specialtyNav');
        if (navEl) {
            // Icon mapping per page (slug -> icon file), keyed by subcategory slug
            const slugIconMap = {
                // benh-theo-doi-tuong subcategories
                'nam-gioi': '../assets/images/benh-ly/benh-theo-doi-tuong/icon-nam-gioi.png',
                'nu-gioi': '../assets/images/benh-ly/benh-theo-doi-tuong/icon-nu-gioi.png',
                'tre-em': '../assets/images/benh-ly/benh-theo-doi-tuong/icon-tre-em.png',
                'benh-nguoi-cao-tuoi': '../assets/images/benh-ly/benh-theo-doi-tuong/icon-nguoi-cao-tuoi.png',
                // benh-co-the-nguoi subcategories (folder: benh-theo-co-the-nguoi)
                'dau': '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-dau.png',
                'co': '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-co.png',
                'nguc': '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-nguc.png',
                'bung': '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-bung.png',
                'sinh-duc': '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-sinhduc.png',
                'tu-chi': '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-tuchi.png',
                'da': '../assets/images/benh-ly/benh-theo-co-the-nguoi/icon-da.png',
            };
            const fallbackIcons = [
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-co-xuong-khop.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-da-toc-mong.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-he-than-kinh.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-ho-hap.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-mat.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-mau.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-tai-mui-hong.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-noi-tiet.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-rang-ham-mat.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-than-tiet-nieu.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-tieu-hoa-gan-mat-tuy.png',
                '../assets/images/benh-ly/benh-chuyen-khoa/icon-tim-mach-huyet-ap.png'
            ];

            navEl.innerHTML = categories.map((cat, idx) => {
                const icon = cat.icon_url || cat.image_url || slugIconMap[cat.slug] || fallbackIcons[idx % fallbackIcons.length];
                const activeClass = idx === 0 ? 'class="active"' : '';
                const cleanName = getCleanCategoryName(cat.slug) || getCleanCategoryName(cat.name) || cat.name;
                return `
                    <li>
                        <a href="#${cat.slug}" ${activeClass}>
                            <img src="${icon}" alt="${cleanName}" onerror="this.style.display='none'">
                            ${cleanName}
                        </a>
                    </li>
                `;
            }).join('');
        }

        // 4. Render content area
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.innerHTML = categories.map(cat => {
                const catArticles = articles.filter(a => 
                    a.category_id === cat.id || 
                    (Array.isArray(a.tags) && a.tags.includes(cat.slug))
                );
                const articleLinks = catArticles.map(art => `
                    <a href="article.html?slug=${encodeURIComponent(art.slug)}" id="article-${art.id}" style="scroll-margin-top: 100px;">
                        ${art.title}
                    </a>
                `).join('');

                const cleanName = getCleanCategoryName(cat.slug) || getCleanCategoryName(cat.name) || cat.name;
                return `
                    <div class="content-card specialty-card-content" id="${cat.slug}">
                        <h2>${cleanName}</h2>
                        <div class="article-grid">
                            ${articleLinks || '<p style="color:#888; font-size:14px; grid-column: 1/-1;">Ch\u01b0a c\u00f3 b\u00e0i vi\u1ebft cho danh m\u1ee5c n\u00e0y.</p>'}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 5. Reinitialize navigation event handlers and highlights
        initNavigationBehavior();

    } catch (err) {
        console.error('[Disease Page Loader] Failed to load specialty data:', err);
    }
}

function getCleanCategoryName(str) {
    if (!str) return '';
    const slugMap = {
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
        'tim-mach': 'Tim m\u1ea1ch \u2013 Huy\u1ebft \u00e1p',
        // benh-theo-doi-tuong subcategories
        'nam-gioi': 'Nam gi\u1edbi',
        'nu-gioi': 'N\u1eef gi\u1edbi',
        'tre-em': 'Tr\u1ebb em',
        'benh-nguoi-cao-tuoi': 'Ng\u01b0\u1eddi cao tu\u1ed5i',
        // benh-co-the-nguoi subcategories
        'dau': 'Đầu',
        'co': 'Cổ',
        'nguc': 'Ngực',
        'bung': 'Bụng',
        'sinh-duc': 'Cơ quan sinh dục',
        'tu-chi': 'Tứ chi',
        'da': 'Da & Các mô'
    };

    if (slugMap[str]) return slugMap[str];

    for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) > 255) {
            return str;
        }
    }

    try {
        const win1252Map = {
            0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
            0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D,
            0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
            0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178
        };
        const revWin1252 = {};
        for (let i = 0; i <= 255; i++) revWin1252[i] = i;
        for (const k in win1252Map) {
            if (win1252Map.hasOwnProperty(k)) revWin1252[win1252Map[k]] = parseInt(k);
        }

        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (revWin1252[code] !== undefined) {
                bytes.push(revWin1252[code]);
            } else if (code <= 0xFF) {
                bytes.push(code);
            } else {
                bytes.push(code & 0xFF);
            }
        }
        const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        const decodedMap = {
            'B\u1ec7nh truy\ufffd n nhi\u1ec5m': 'B\u1ec7nh truy\u1ec1n nhi\u1ec5m',
            'B\u1ec7nh c\u01a1 th\u1ec3 ng\u01b0\ufffd i': 'B\u1ec7nh c\u01a1 th\u1ec3 ng\u01b0\u1eddi',
            'Tai \u2013 M\u0169i \u2013 H\ufffd ng': 'Tai \u2013 M\u0169i \u2013 H\u1ecdng'
        };
        return decodedMap[decoded] || decoded;
    } catch (e) {
        return str;
    }
}

function initNavigationBehavior() {
    // Smooth scrolling for sidebar links
    document.querySelectorAll('.specialty-list a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Intersection Observer logic to highlight active sidebar link
    const cards = document.querySelectorAll('.specialty-card-content');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                document.querySelectorAll('.specialty-list a').forEach(a => a.classList.remove('active'));
                const navLink = document.querySelector(`.specialty-list a[href="#${entry.target.id}"]`);
                if (navLink) navLink.classList.add('active');
            }
        });
    }, { rootMargin: '-10% 0px -80% 0px' });

    cards.forEach(card => observer.observe(card));

    // Handle hash links on load (e.g. from disease popular list redirect)
    if (window.location.hash) {
        setTimeout(() => {
            const targetEl = document.querySelector(window.location.hash);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // If it is an article, highlight it temporarily
                if (window.location.hash.startsWith('#article-')) {
                    targetEl.style.backgroundColor = '#dcfce7';
                    setTimeout(() => { targetEl.style.backgroundColor = ''; }, 2000);
                }
            }
        }, 500);
    }
}
