(function (global) {
    'use strict';

    var DEFAULT_API_BASE = (
        (window.location.origin.includes('localhost:5500') ||
         window.location.origin.includes('localhost:5501') ||
         window.location.origin.includes('127.0.0.1:5500') ||
         window.location.origin.includes('127.0.0.1:5501'))
        ? 'http://localhost:8000/api'
        : window.location.origin.replace(/\/+$/, '') + '/api'
    );
    var DEFAULT_DIRECT_BASE = 'http://localhost:8002';

    function getApiBase() {
        return localStorage.getItem('MG_API_BASE') || DEFAULT_API_BASE;
    }

    function getAdminToken() {
        try {
            var raw = localStorage.getItem('MG_ADMIN_AUTH');
            if (!raw) return null;
            return JSON.parse(raw).accessToken || null;
        } catch (_err) {
            return null;
        }
    }

    function buildQuery(params = {}) {
        var query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            query.set(key, String(value));
        });
        return query.toString();
    }

    async function request(path, options = {}) {
        var token = getAdminToken();
        var headers = {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
        var gatewayUrl = `${getApiBase().replace(/\/+$/, '')}/catalog${path}`;

        try {
            var response = await fetch(gatewayUrl, { ...options, headers });
            var payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
            return payload;
        } catch (gatewayErr) {
            var response = await fetch(`${DEFAULT_DIRECT_BASE}${path}`, {
                ...options,
                headers: options.headers || {}
            });
            var payload = await response.json().catch(() => null);
            if (!response.ok) throw gatewayErr;
            return payload;
        }
    }

    global.MGAdminCatalogApi = {
        buildQuery,
        request,
        get(path, params = {}) {
            var query = buildQuery(params);
            return request(`${path}${query ? `?${query}` : ''}`);
        },
        post(path, body = {}) {
            return request(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },
        put(path, body = {}) {
            return request(path, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },
        patch(path, body = {}) {
            return request(path, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },
        delete(path) {
            return request(path, { method: 'DELETE' });
        }
    };
})(window);
