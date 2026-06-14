(function (global) {
    'use strict';

    const DEFAULT_API_BASE = (
        (window.location.origin.includes('localhost:5500') ||
         window.location.origin.includes('localhost:5501') ||
         window.location.origin.includes('127.0.0.1:5500') ||
         window.location.origin.includes('127.0.0.1:5501'))
        ? 'http://localhost:8000/api'
        : window.location.origin.replace(/\/+$/, '') + '/api'
    );
    const DEFAULT_DIRECT_BASE = 'http://localhost:8002';

    function getApiBase() {
        return localStorage.getItem('MG_API_BASE') || DEFAULT_API_BASE;
    }

    function getPosAuthToken() {
        try {
            const raw = localStorage.getItem('MG_POS_AUTH');
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

    function isBarcodeLike(value) {
        return /^[0-9]{8,14}$/.test(String(value || '').trim());
    }

    function normalizeUnits(product = {}) {
        const sourceUnits = Array.isArray(product.sale_units)
            ? product.sale_units
            : (Array.isArray(product.units) ? product.units : []);
        const baseUnit = {
            unit_name: product.base_unit || 'Đơn vị',
            conversion_qty: 1,
            of_unit: product.base_unit || 'Đơn vị',
            retail_price: Number(product.price || product.retail_price || 0),
            available_qty: Number(product.available_stock || 0),
            is_base: true,
            barcode: product.barcode || null
        };
        const extraUnits = sourceUnits.map((unit) => {
            const conversionQty = Number(unit.conversion_qty || 1);
            return {
                ...unit,
                conversion_qty: conversionQty,
                retail_price: Number(unit.retail_price || product.retail_price || product.price || 0),
                available_qty: Number.isFinite(Number(unit.available_qty))
                    ? Number(unit.available_qty)
                    : Math.floor(Number(product.available_stock || 0) / conversionQty),
                barcode: unit.barcode || null
            };
        });
        return [baseUnit, ...extraUnits]
            .filter((unit) => unit.unit_name)
            .filter((unit, index, list) =>
                index === list.findIndex((candidate) => candidate.unit_name === unit.unit_name)
            )
            .sort((a, b) =>
                Number(b.is_base || 0) - Number(a.is_base || 0) ||
                Number(a.sort_order || 0) - Number(b.sort_order || 0)
            );
    }

    function normalizeProduct(product = {}) {
        const availableStock = Number(product.available_stock ?? product.total_stock ?? 0);
        const preferredUnitName = product.barcode_match?.type === 'unit'
            ? product.barcode_match.unit_name
            : null;
        const normalized = {
            ...product,
            id: Number(product.id || product.product_id || 0),
            product_id: Number(product.product_id || product.id || 0),
            price: Number(product.price || product.retail_price || 0),
            retail_price: Number(product.retail_price || product.price || 0),
            total_stock: Number(product.total_stock || 0),
            reserved_stock: Number(product.reserved_stock || 0),
            available_stock: availableStock,
            requires_prescription: Number(product.requires_prescription || 0),
            in_stock: availableStock > 0,
            preferred_unit_name: preferredUnitName || product.preferred_unit_name || null
        };
        normalized.units = normalizeUnits(normalized);
        normalized.sale_units = normalized.units;
        return normalized;
    }

    async function request(path, options = {}) {
        const token = getPosAuthToken();
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
            const directUrl = `${DEFAULT_DIRECT_BASE}${path}`;
            const response = await fetch(directUrl, { ...options, headers: options.headers || {} });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw gatewayErr;
            return payload;
        }
    }

    async function searchProducts(params = {}) {
        const query = buildQuery(params);
        const result = await request(`/products/pos-search${query ? `?${query}` : ''}`);
        if (result && Array.isArray(result.data)) {
            result.data = result.data.map(normalizeProduct);
        }
        return result;
    }

    async function findByBarcode(barcode) {
        const cleanBarcode = String(barcode || '').trim();
        if (!cleanBarcode) return null;
        try {
            const result = await request(`/products/barcode/${encodeURIComponent(cleanBarcode)}`);
            if (result.success && result.data) return normalizeProduct(result.data);
        } catch (_err) {
            // Fallback to POS search, because some stores encode unit barcodes only in search data.
        }
        const fallback = await searchProducts({ barcode: cleanBarcode, limit: 1, offset: 0 });
        return fallback.success && fallback.data.length ? fallback.data[0] : null;
    }

    global.MGPOSCatalogApi = {
        request,
        get: request,
        post(path, body) {
            return request(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {})
            });
        },
        searchProducts,
        findByBarcode,
        normalizeProduct,
        normalizeUnits,
        buildQuery,
        isBarcodeLike,
        getPosAuthToken
    };
})(window);
