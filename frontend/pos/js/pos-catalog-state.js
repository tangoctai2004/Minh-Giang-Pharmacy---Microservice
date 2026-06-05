(function (global) {
    'use strict';

    function createInitialState(overrides = {}) {
        return {
            products: [],
            categories: [],
            categoryTree: [],
            cart: [],
            selectedCategoryId: null,
            selectedCategoryName: 'Tất cả danh mục',
            activeRootId: null,
            rxOnly: false,
            inStockOnly: true,
            productLimit: 60,
            productOffset: 0,
            productTotal: 0,
            hasMoreProducts: false,
            loadingProducts: false,
            searchTimer: null,
            detailProduct: null,
            detailSelectedUnitName: null,
            activeHoldSourceId: null,
            holdExpiresAt: null,
            holdingStock: false,
            prescriptionInfo: null,
            calculatorValue: '0',
            voucherDiscount: 0,
            ...overrides
        };
    }

    global.MGPOSCatalogState = {
        createInitialState
    };
})(window);
