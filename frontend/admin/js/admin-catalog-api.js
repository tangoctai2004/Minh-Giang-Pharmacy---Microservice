(function (global) {
    'use strict';

    const DEFAULT_API_BASE = 'http://localhost:8000/api';
    const DEFAULT_DIRECT_BASE = 'http://localhost:8002';

    function getApiBase() {
        return localStorage.getItem('MG_API_BASE') || DEFAULT_API_BASE;
    }

    function getAdminToken() {
        try {
            const raw = localStorage.getItem('MG_ADMIN_AUTH');
            if (!raw) return null;
            return JSON.parse(raw).accessToken || null;
        } catch (_err) {
            return null;
        }
    }

    function buildQuery(params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            query.set(key, String(value));
        });
        return query.toString();
    }

    async function request(path, options = {}) {
        const token = getAdminToken();
        const headers = {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
        const gatewayUrl = `${getApiBase().replace(/\/+$/, '')}/catalog${path}`;

        try {
            const response = await fetch(gatewayUrl, { ...options, headers });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
            return payload;
        } catch (gatewayErr) {
            const response = await fetch(`${DEFAULT_DIRECT_BASE}${path}`, {
                ...options,
                headers: options.headers || {}
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw gatewayErr;
            return payload;
        }
    }

    global.MGAdminCatalogApi = {
        buildQuery,
        request,
        get(path, params = {}) {
            const query = buildQuery(params);
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
        delete(path) {
            return request(path, { method: 'DELETE' });
        }
    };
})(window);
