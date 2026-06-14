/**
 * pos-auth.js
 * Centralized auth logic for POS kiosk pages
 */

// Intercept fetch globally to automatically redirect to login when 401 Unauthorized occurs
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch.apply(this, args);
            if (response.status === 401) {
                console.warn('Authentication token expired or unauthorized. Logging out...');
                localStorage.removeItem('MG_POS_AUTH');
                // Ensure we don't end up in an infinite redirect loop if already on login.html
                if (!window.location.pathname.endsWith('login.html')) {
                    window.location.href = 'login.html';
                }
            }
            return response;
        } catch (error) {
            throw error;
        }
    };
})();

function _applyPosUserHeader() {
    // Auth guard
    const authRaw = localStorage.getItem('MG_POS_AUTH');
    if (!authRaw) { window.location.href = 'login.html'; return; }

    try {
        const parsed = JSON.parse(authRaw);
        if (!parsed.accessToken || !parsed.user) { window.location.href = 'login.html'; return; }

        const fullName = parsed.user.full_name;
        if (!fullName) { window.location.href = 'login.html'; return; }

        // Update topbar user info
        const userSpans = document.querySelectorAll('.pos-topbar-user span');
        if (userSpans.length >= 2) {
            userSpans[1].textContent = fullName;
        }

        // Update avatar
        const avatar = document.querySelector('.pos-topbar-user .avatar');
        if (avatar) {
            const initials = fullName.split(' ').pop().charAt(0).toUpperCase();
            avatar.innerHTML = `<i class="fa-solid fa-user"></i>`;
            avatar.textContent = initials;
        }
    } catch (e) {
        window.location.href = 'login.html';
    }
}

function posLogout() {
    localStorage.removeItem('MG_POS_AUTH');
    window.location.href = 'login.html';
}

// Auto-apply auth when page loads
document.addEventListener('DOMContentLoaded', () => {
    _applyPosUserHeader();
});
