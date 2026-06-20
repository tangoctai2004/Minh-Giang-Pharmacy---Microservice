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

function _posApiBase() {
    return localStorage.getItem('MG_API_BASE') || (
        (window.location.origin.includes('localhost:5500') ||
         window.location.origin.includes('localhost:5501') ||
         window.location.origin.includes('127.0.0.1:5500') ||
         window.location.origin.includes('127.0.0.1:5501'))
        ? 'http://localhost:8000/api'
        : window.location.origin.replace(/\/+$/, '') + '/api'
    );
}

function _decodePosJwtPayload(token) {
    try {
        const payload = token.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(normalized), (c) =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')));
    } catch (e) {
        return null;
    }
}

function _isPosJwtExpired(token, skewSeconds = 30) {
    const payload = _decodePosJwtPayload(token);
    return !payload || !payload.exp || payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

function _getValidPosAuth() {
    try {
        const parsed = JSON.parse(localStorage.getItem('MG_POS_AUTH') || 'null');
        if (!parsed || !parsed.accessToken || !parsed.user) return null;
        if (_isPosJwtExpired(parsed.accessToken)) {
            localStorage.removeItem('MG_POS_AUTH');
            return null;
        }
        return parsed;
    } catch (e) {
        localStorage.removeItem('MG_POS_AUTH');
        return null;
    }
}

async function _revokePosRefreshToken(auth) {
    if (!auth || !auth.refreshToken) return;
    try {
        await fetch(_posApiBase() + '/identity/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
    } catch (e) {}
}

function _applyPosUserHeader() {
    // Auth guard
    const parsed = _getValidPosAuth();
    if (!parsed) { window.location.href = 'login.html'; return; }

    try {
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

async function posLogout() {
    const auth = JSON.parse(localStorage.getItem('MG_POS_AUTH') || 'null');
    await _revokePosRefreshToken(auth);
    localStorage.removeItem('MG_POS_AUTH');
    window.location.href = 'login.html';
}

// Auto-apply auth when page loads
document.addEventListener('DOMContentLoaded', () => {
    _applyPosUserHeader();
});
