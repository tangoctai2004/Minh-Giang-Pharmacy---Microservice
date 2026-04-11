/**
 * pos-auth.js
 * Centralized auth logic for POS kiosk pages
 */

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
