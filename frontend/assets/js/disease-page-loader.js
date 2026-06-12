/**
 * disease-page-loader.js
 * Dynamically loads disease specialties and their corresponding articles
 */

const API_BASE = 'http://localhost:8000/api';

document.addEventListener('DOMContentLoaded', () => {
    const mainEl = document.querySelector('main[data-page-type="specialty-listing"]');
    if (!mainEl) return;

    loadSpecialtyPageData();
});

async function loadSpecialtyPageData() {
    try {
        // 1. Fetch categories of type 'disease'
        const catRes = await fetch(`${API_BASE}/cms/categories?type=disease`);
        const catResult = await catRes.json();
        if (!catResult.success || !catResult.data || catResult.data.length === 0) {
            console.warn('[Disease Page Loader] No disease categories found, keeping static fallback.');
            return;
        }

        const categories = catResult.data;

        // 2. Fetch all articles
        const artRes = await fetch(`${API_BASE}/cms/articles?limit=200`);
        const artResult = await artRes.json();
        const articles = (artResult.success && artResult.data) ? artResult.data : [];

        // 3. Render sidebar links
        const navEl = document.getElementById('specialtyNav');
        if (navEl) {
            const icons = [
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
                const icon = cat.image_url || icons[idx % icons.length];
                const activeClass = idx === 0 ? 'class="active"' : '';
                return `
                    <li>
                        <a href="#${cat.slug}" ${activeClass}>
                            <img src="${icon}" alt="${cat.name}" onerror="this.style.display='none'">
                            ${cat.name}
                        </a>
                    </li>
                `;
            }).join('');
        }

        // 4. Render content area
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.innerHTML = categories.map(cat => {
                const catArticles = articles.filter(a => a.category_id === cat.id);
                const articleLinks = catArticles.map(art => `
                    <a href="#article-${art.id}" id="article-${art.id}" style="scroll-margin-top: 100px;">
                        ${art.title}
                    </a>
                `).join('');

                return `
                    <div class="content-card specialty-card-content" id="${cat.slug}">
                        <h2>${cat.name}</h2>
                        <div class="article-grid">
                            ${articleLinks || '<p style="color:#888; font-size:14px; grid-column: 1/-1;">Chưa có bài viết cho danh mục này.</p>'}
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
