/**
 * cms-loader.js — Tải dữ liệu động từ CMS Service cho trang client
 *
 * Các phần được làm động:
 *  1. Hero banner slider    ← GET /api/cms/banners?position=hero
 *  2. Side banners          ← GET /api/cms/banners?position=sidebar
 *  3. Header popup banner   ← GET /api/cms/banners?position=popup
 *  4. Top searches          ← GET /api/cms/trending-searches?context=product
 *  5. Khuyến mãi popup      ← GET /api/cms/promotions/active
 *  6. Articles section      ← GET /api/cms/articles?limit=4
 *  7. Disease categories    ← GET /api/cms/categories?type=disease
 *
 * Tất cả đều có fallback graceful: nếu API lỗi, giữ nguyên nội dung HTML tĩnh.
 */

const CMS_API = 'http://localhost:8000/api/cms';

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

async function cmsGet(path) {
  try {
    const res = await fetch(`${CMS_API}${path}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (e) {
    console.warn('[CMS Loader]', path, '→ lỗi kết nối, dùng nội dung tĩnh');
    return null;
  }
}

function formatPrice(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HERO BANNER SLIDER
// ─────────────────────────────────────────────────────────────────────────────

async function loadHeroBanners() {
  const banners = await cmsGet('/banners?position=hero');
  if (!banners || !banners.length) return; // fallback: giữ ảnh tĩnh

  const sliderImages = document.getElementById('heroSliderImages');
  const sliderDots = document.getElementById('heroSliderDots');
  if (!sliderImages || !sliderDots) return;

  sliderImages.innerHTML = banners.map(b => `
    <a href="${b.link_url || '#'}" class="main-slide-link" style="display:block;width:100%;height:100%;flex-shrink:0;">
      <img src="${b.image_url}" alt="${b.title}" class="main-slide" style="width:100%;height:100%;object-fit:cover;">
    </a>
  `).join('');

  sliderDots.innerHTML = banners.map((_, i) => `
    <span class="dot ${i === 0 ? 'active' : ''}" onclick="currentSlide(${i})"></span>
  `).join('');

  // Re-init slider với số slide mới
  window._totalSlides = banners.length;
  window._currentSlideIndex = 0;
  _updateSlider();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SIDE BANNERS
// ─────────────────────────────────────────────────────────────────────────────

async function loadSideBanners() {
  const banners = await cmsGet('/banners?position=sidebar');
  if (!banners || !banners.length) return;

  const sideContainer = document.querySelector('.hero-side-banners');
  if (!sideContainer) return;

  sideContainer.innerHTML = banners.map(b => `
    <a href="${b.link_url || '#'}" class="side-banner">
      <img src="${b.image_url}" alt="${b.title}" style="width:100%;border-radius:8px;display:block;">
    </a>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. HEADER POPUP / TOP BANNER
// ─────────────────────────────────────────────────────────────────────────────

async function loadHeaderBanner() {
  const banners = await cmsGet('/banners?position=popup');
  if (!banners || !banners.length) return;

  // Tìm element header-banner sau khi component load xong
  const waitForHeader = (retries = 10) => {
    const headerBanner = document.querySelector('.header-banner');
    if (headerBanner) {
      const b = banners[0];
      headerBanner.innerHTML = `
        <a href="${b.link_url || '#'}">
          <img src="${b.image_url}" alt="${b.title}" style="width:100%;display:block;">
        </a>
      `;
    } else if (retries > 0) {
      setTimeout(() => waitForHeader(retries - 1), 300);
    }
  };
  waitForHeader();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TOP SEARCHES / TRENDING
// ─────────────────────────────────────────────────────────────────────────────

async function loadTrendingSearches() {
  const keywords = await cmsGet('/trending-searches?context=product&limit=20');
  if (!keywords || !keywords.length) return;

  // Trang index.html có .tags-container trong section "Tìm kiếm hàng đầu"
  const tagContainers = document.querySelectorAll('.tags-container, .top-search-links');
  if (!tagContainers.length) return;

  const html = keywords.map(k => `
    <a href="search.html?q=${encodeURIComponent(k.keyword)}"
       class="tag-item"
       onclick="trackSearch('${k.keyword.replace(/'/g, "\\'")}')">
      ${k.keyword}
    </a>
  `).join('');

  tagContainers.forEach(c => { c.innerHTML = html; });
}

// Ghi nhận lượt tìm kiếm khi người dùng click hot search tag
window.trackSearch = async function(keyword) {
  try {
    await fetch(`${CMS_API}/trending-searches/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, context: 'product' }),
    });
  } catch (e) { /* silent */ }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. PROMOTIONS ACTIVE — Hiển thị badge/thông báo khuyến mãi
// ─────────────────────────────────────────────────────────────────────────────

async function loadActivePromotions() {
  const promos = await cmsGet('/promotions/active');
  if (!promos || !promos.length) return;

  // Lưu danh sách promo vào window để checkout dùng
  window.MG_ACTIVE_PROMOTIONS = promos;

  // Hiển thị banner khuyến mãi nổi bật (promo đầu tiên)
  const promo = promos[0];
  const promoEl = document.getElementById('cms-promo-banner');
  if (promoEl) {
    const discountText = promo.type === 'percent_discount'
      ? `Giảm ${promo.discount_value}%`
      : promo.type === 'free_shipping'
        ? 'Miễn phí vận chuyển'
        : `Giảm ${formatPrice(promo.discount_value)}`;

    promoEl.innerHTML = `
      <div style="background:linear-gradient(90deg,#dc2626,#f97316);color:#fff;padding:10px 20px;
                  border-radius:8px;display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <i class="fa-solid fa-bolt" style="font-size:18px;"></i>
        <div>
          <strong>${promo.name}</strong> — ${discountText}
          ${promo.code ? `<span style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:4px;margin-left:8px;font-size:13px;">
            Mã: <b>${promo.code}</b></span>` : ''}
        </div>
        ${promo.end_date ? `<span style="margin-left:auto;font-size:12px;opacity:.85;">
          Đến ${new Date(promo.end_date).toLocaleDateString('vi-VN')}</span>` : ''}
      </div>
    `;
    promoEl.style.display = 'block';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ARTICLES — Hiển thị bài viết sức khỏe mới nhất
// ─────────────────────────────────────────────────────────────────────────────

async function loadLatestArticles() {
  const result = await cmsGet('/articles?limit=4&page=1');
  // result là array khi gọi trực tiếp hoặc có meta pagination
  const articles = Array.isArray(result) ? result : (result?.data || result);
  if (!articles || !articles.length) return;

  const container = document.getElementById('cms-articles-grid');
  if (!container) return;

  container.innerHTML = articles.map(a => `
    <article class="cms-article-card" onclick="window.location.href='article.html?slug=${a.slug}'" style="cursor:pointer;">
      <div class="cms-article-thumb" style="
        border-radius:10px;overflow:hidden;margin-bottom:10px;height:160px;background:#f0fdf4;">
        <img src="${a.thumbnail_url || '../assets/images/product_frame.png'}"
             alt="${a.title}"
             style="width:100%;height:100%;object-fit:cover;"
             onerror="this.src='../assets/images/product_frame.png'">
      </div>
      <div style="padding:0 4px;">
        <span style="font-size:12px;color:#0b7a3e;font-weight:600;text-transform:uppercase;">
          ${a.category_name || 'Sức khoẻ'}
        </span>
        <h4 style="font-size:14px;font-weight:700;color:#1f2937;margin:6px 0;line-height:1.4;
                   display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
          ${a.title}
        </h4>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#9ca3af;margin-top:6px;">
          <i class="fa-regular fa-eye"></i> ${a.view_count || 0} lượt xem
          <span>·</span>
          <i class="fa-regular fa-calendar"></i>
          ${a.published_at ? new Date(a.published_at).toLocaleDateString('vi-VN') : ''}
        </div>
      </div>
    </article>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. DISEASE CATEGORIES — Hiển thị nhóm bệnh từ CMS
// ─────────────────────────────────────────────────────────────────────────────

// Map tạm icon cho nhóm bệnh (có thể thay bằng image_url từ DB)
const DISEASE_ICONS = [
  '../assets/images/icon_category_than_kinh_nao.png',
  '../assets/images/icon_category_suc_khoe_tim_mach.png',
  '../assets/images/icon_category_tang_cuong_de_khang.png',
  '../assets/images/icon_category_ho_tro_tieu_hoa.png',
  '../assets/images/icon_category_vitamin_va_khoang_chat.png',
  '../assets/images/icon_category_noi_tiet_sinh_ly.png',
  '../assets/images/icon_category_dinh_duong.png',
  '../assets/images/icon_category_ho_tro_dieu_tri.png',
];

async function loadDiseaseCategories() {
  const cats = await cmsGet('/categories?type=disease');
  if (!cats || !cats.length) return;

  // Trang disease.html có .disease-groups-grid
  const grid = document.querySelector('.disease-groups-grid');
  if (!grid) return;

  grid.innerHTML = cats.slice(0, 8).map((cat, idx) => `
    <div class="disease-group-card"
         onclick="window.location.href='disease.html?category_id=${cat.id}'"
         style="cursor:pointer;">
      <img src="${cat.image_url || DISEASE_ICONS[idx % DISEASE_ICONS.length]}"
           alt="${cat.name}"
           onerror="this.src='${DISEASE_ICONS[idx % DISEASE_ICONS.length]}'">
      <h4>${cat.name}</h4>
      <p>${cat.description || 'Thông tin bệnh lý'}</p>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. DISEASE PAGE — Bài viết theo danh mục bệnh (disease.html)
// ─────────────────────────────────────────────────────────────────────────────

async function loadDiseaseArticles() {
  // Lấy từ query param
  const params = new URLSearchParams(location.search);
  const categoryId = params.get('category_id');
  const slug = params.get('slug');

  let url = '/articles?limit=8&page=1';
  if (categoryId) url += `&category_id=${categoryId}`;

  const result = await cmsGet(url);
  const articles = Array.isArray(result) ? result : null;
  if (!articles || !articles.length) return;

  // Cập nhật danh sách bài viết phổ biến (tra cứu phổ biến)
  const popularList = document.querySelector('.popular-article-list');
  if (popularList) {
    popularList.innerHTML = articles.slice(0, 5).map(a => `
      <li onclick="window.location.href='article.html?slug=${a.slug}'" style="cursor:pointer;">
        <span class="article-title">${a.title}</span>
        <span class="article-icon"><i class="fa-solid fa-chevron-right"></i></span>
      </li>
    `).join('');
  }

  // Tra cứu theo chữ cái — fetch từ tất cả articles và phân loại
  buildAlphabetIndex(articles);
}

function buildAlphabetIndex(articles) {
  // Xây dựng index chữ cái từ article titles
  window._articleAlphaIndex = {};
  articles.forEach(a => {
    // Lấy chữ đầu tiên (normalize: Á→A, Ổ→O...)
    const firstChar = a.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .charAt(0)
      .toUpperCase();
    if (!window._articleAlphaIndex[firstChar]) {
      window._articleAlphaIndex[firstChar] = [];
    }
    window._articleAlphaIndex[firstChar].push(a);
  });

  // Override filterByLetter để dùng data thực từ API
  if (typeof window.filterByLetter === 'function') {
    const origFilter = window.filterByLetter;
    window.filterByLetter = function(letter) {
      // Update button style (reuse logic cũ)
      document.querySelectorAll('.alpha-btn').forEach(b => {
        b.className = b.textContent.trim() === letter ? 'alpha-btn red' : 'alpha-btn green';
      });

      document.getElementById('alphaLetter').textContent = letter;
      const articlesForLetter = window._articleAlphaIndex[letter] || [];
      const listEl = document.getElementById('alphaList');
      const emptyEl = document.getElementById('alphaEmpty');

      if (articlesForLetter.length > 0) {
        emptyEl.style.display = 'none';
        listEl.style.display = 'block';
        listEl.innerHTML = articlesForLetter.map(a =>
          `<li><a href="article.html?slug=${a.slug}">
            <i class="fa-solid fa-angle-right"></i> ${a.title}
          </a></li>`
        ).join('');
      } else {
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'Chưa có bài viết cho chữ cái này.';
        listEl.style.display = 'none';
        listEl.innerHTML = '';
      }
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KHỞI CHẠY — Auto-detect trang và load tương ứng
// ─────────────────────────────────────────────────────────────────────────────

async function initCmsLoader() {
  const path = window.location.pathname;
  const isIndex = path.endsWith('index.html') || path.endsWith('/client/') || path.endsWith('/');
  const isDisease = path.includes('disease.html');

  // Chạy song song tất cả tasks liên quan
  const tasks = [];

  // Chạy cho mọi trang client
  tasks.push(loadTrendingSearches());
  tasks.push(loadHeaderBanner());

  if (isIndex) {
    tasks.push(loadHeroBanners());
    tasks.push(loadSideBanners());
    tasks.push(loadActivePromotions());
    tasks.push(loadLatestArticles());
  }

  if (isDisease) {
    tasks.push(loadDiseaseCategories());
    tasks.push(loadDiseaseArticles());
  }

  await Promise.allSettled(tasks);
  console.log('[CMS Loader] ✅ Hoàn tất tải dữ liệu CMS');
}

// Chờ components.js load xong (vì dùng mg-include) rồi mới chạy CMS loader
// Components.js thường hoàn thành sau ~300ms
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initCmsLoader, 400));
} else {
  setTimeout(initCmsLoader, 400);
}
