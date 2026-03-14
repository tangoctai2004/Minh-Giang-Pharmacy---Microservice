
document.addEventListener('DOMContentLoaded', () => {
  const mainEl = document.querySelector('main[data-page-type]');
  
  // Exit if not a disease page
  if (!mainEl) return;
  
  // Extract page configuration from HTML attributes
  const urlParams = new URLSearchParams(location.search);
  const querySlug = urlParams.get('slug');
  
  const pageConfig = {
    type: mainEl.getAttribute('data-page-type'),      // "card-listing" or "specialty-listing"
    slug: querySlug || mainEl.getAttribute('data-page-slug'),  // Override with query param if exists
    title: mainEl.getAttribute('data-page-title'),    // "Bệnh ung thư", "Bệnh chuyên khoa", etc.
    isRedirected: !!querySlug,  // Flag to indicate if came from 301 redirect
  };
  
  console.log('[Disease Page Loader] Page Config:', pageConfig);
  
  console.log('[Disease Page Loader] ✓ Hardcoded content loaded');
});
