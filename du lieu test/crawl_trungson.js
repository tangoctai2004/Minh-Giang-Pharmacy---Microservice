const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');
const xml2js = require('xml2js');
const crypto = require('crypto');
const slugify = require('slugify');

// Define specific configurations
const DATA_DIR = __dirname;
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const MAX_PRODUCTS = parseInt(process.env.MAX_PRODUCTS || '2000', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '1', 10);
const RESET_OUTPUT = process.env.RESET_OUTPUT === '1';
const REFRESH_SITEMAP = process.env.REFRESH_SITEMAP !== '0';
const REQUEST_DELAY_MIN_MS = parseInt(process.env.REQUEST_DELAY_MIN_MS || '2500', 10);
const REQUEST_DELAY_MAX_MS = parseInt(process.env.REQUEST_DELAY_MAX_MS || '6000', 10);
const STOP_ON_FAILURE_RATE = process.env.STOP_ON_FAILURE_RATE !== '0';
const FAILURE_RATE_CHECK_AFTER = parseInt(process.env.FAILURE_RATE_CHECK_AFTER || '20', 10);
const MAX_FAILURE_RATE = parseFloat(process.env.MAX_FAILURE_RATE || '0.5');
const PRODUCT_JSON_PATH = path.join(DATA_DIR, 'ts_products_real.json');
const PRODUCT_CSV_PATH = path.join(DATA_DIR, 'ts_products_real.csv');
const SQL_FILE_PATH = path.join(__dirname, '../infrastructure/database/99_seed_trungson_real.sql');
const LIVE_LOG_PATH = path.join(DATA_DIR, process.env.LIVE_LOG_FILE || 'crawl_trungson_live.log');

// Create folders if none exists
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);

function appendLiveLog(level, args) {
    const message = args.map(arg => {
        if (typeof arg === 'string') return arg;
        try {
            return JSON.stringify(arg);
        } catch {
            return String(arg);
        }
    }).join(' ');
    fs.appendFileSync(LIVE_LOG_PATH, `[${new Date().toISOString()}] [${level}] ${message}\n`, 'utf-8');
}

console.log = (...args) => {
    appendLiveLog('INFO', args);
    originalConsoleLog(...args);
};

console.error = (...args) => {
    appendLiveLog('ERROR', args);
    originalConsoleError(...args);
};

function generateSlug(text) {
    if (!text) return '';
    return slugify(text, { lower: true, strict: true, locale: 'vi' });
}

function normalizeText(text) {
    return generateSlug(String(text || '').normalize('NFC'));
}

function normalizeUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function productSlugFromUrl(url) {
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        return normalizeText(parts[parts.length - 1] || '');
    } catch {
        const parts = String(url || '').split('/').filter(Boolean);
        return normalizeText((parts[parts.length - 1] || '').replace('.html', ''));
    }
}

function imageSlugFromUrl(url) {
    const imageName = decodeURIComponent(String(url || '').split('/').pop() || '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/-\d+$/i, '');
    return normalizeText(imageName);
}

function stableDigits(input, length) {
    const hex = crypto.createHash('sha1').update(String(input || '')).digest('hex');
    let digits = '';
    for (let i = 0; digits.length < length; i += 8) {
        const chunk = hex.slice(i, i + 8) || hex;
        digits += String(parseInt(chunk, 16));
    }
    return digits.slice(0, length);
}

function stableSku(sourceUrl, name) {
    return `TS-${stableDigits(sourceUrl || name, 8)}`;
}

function stableBarcode(sourceUrl, name) {
    return `893${stableDigits(`${sourceUrl || name}:barcode`, 10)}`;
}

function readExistingProducts() {
    if (RESET_OUTPUT || !fs.existsSync(PRODUCT_JSON_PATH)) return [];

    try {
        const raw = fs.readFileSync(PRODUCT_JSON_PATH, 'utf-8').trim();
        if (!raw) return [];
        const products = JSON.parse(raw);
        if (Array.isArray(products)) return products;
        console.warn(`[WARN] ${PRODUCT_JSON_PATH} không phải array JSON, bỏ qua dữ liệu cũ.`);
    } catch (e) {
        console.warn(`[WARN] Không đọc được ${PRODUCT_JSON_PATH}: ${e.message}`);
    }

    return [];
}

function buildExistingIndexes(products) {
    const indexes = {
        sourceUrls: new Set(),
        names: new Set(),
        imageUrls: new Set(),
        slugs: new Set(),
        skus: new Set(),
        barcodes: new Set(),
    };

    for (const product of products) {
        const sourceUrl = normalizeUrl(product.source_url);
        const nameKey = normalizeText(product.name);
        const imageUrl = normalizeUrl(product.image_url);
        const sourceSlug = productSlugFromUrl(product.source_url);
        const imageSlug = imageSlugFromUrl(product.image_url);

        if (sourceUrl) indexes.sourceUrls.add(sourceUrl);
        if (nameKey) indexes.names.add(nameKey);
        if (imageUrl) indexes.imageUrls.add(imageUrl);
        if (sourceSlug) indexes.slugs.add(sourceSlug);
        if (imageSlug) indexes.slugs.add(imageSlug);
        if (product.sku) indexes.skus.add(product.sku);
        if (product.barcode) indexes.barcodes.add(product.barcode);
    }

    return indexes;
}

function isKnownUrl(url, indexes) {
    const normalizedUrl = normalizeUrl(url);
    const urlSlug = productSlugFromUrl(url);
    return indexes.sourceUrls.has(normalizedUrl) || indexes.slugs.has(urlSlug);
}

function isDuplicateProduct(product, indexes) {
    const sourceUrl = normalizeUrl(product.source_url);
    const nameKey = normalizeText(product.name);
    const imageUrl = normalizeUrl(product.image_url);
    const sourceSlug = productSlugFromUrl(product.source_url);
    const imageSlug = imageSlugFromUrl(product.image_url);

    return (
        (sourceUrl && indexes.sourceUrls.has(sourceUrl)) ||
        (nameKey && indexes.names.has(nameKey)) ||
        (imageUrl && indexes.imageUrls.has(imageUrl)) ||
        (sourceSlug && indexes.slugs.has(sourceSlug)) ||
        (imageSlug && indexes.slugs.has(imageSlug)) ||
        (product.sku && indexes.skus.has(product.sku)) ||
        (product.barcode && indexes.barcodes.has(product.barcode))
    );
}

function addProductToIndexes(product, indexes) {
    const sourceUrl = normalizeUrl(product.source_url);
    const nameKey = normalizeText(product.name);
    const imageUrl = normalizeUrl(product.image_url);
    const sourceSlug = productSlugFromUrl(product.source_url);
    const imageSlug = imageSlugFromUrl(product.image_url);

    if (sourceUrl) indexes.sourceUrls.add(sourceUrl);
    if (nameKey) indexes.names.add(nameKey);
    if (imageUrl) indexes.imageUrls.add(imageUrl);
    if (sourceSlug) indexes.slugs.add(sourceSlug);
    if (imageSlug) indexes.slugs.add(imageSlug);
    if (product.sku) indexes.skus.add(product.sku);
    if (product.barcode) indexes.barcodes.add(product.barcode);
}

function writeJsonProducts(products) {
    fs.writeFileSync(PRODUCT_JSON_PATH, `${JSON.stringify(products, null, 2)}\n`, 'utf-8');
}

const headerKeys = ['sku','name','category_id','active_ingredient','registration_number','manufacturer','requires_prescription','base_unit','cost_price','retail_price','image_url','gallery','description','barcode','source_url'];

const toCsvRow = (obj) => {
    return headerKeys.map(key => {
        const v = obj[key];
        if (v === null || v === undefined) return '""';
        if (typeof v === 'string') return `"${String(v).replace(/"/g, '""')}"`;
        if (Array.isArray(v)) return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
        return `"${v}"`;
    }).join(',');
};

function writeCsvProducts(products) {
    const rows = [headerKeys.join(','), ...products.map(toCsvRow)];
    fs.writeFileSync(PRODUCT_CSV_PATH, `${rows.join('\n')}\n`, 'utf-8');
}

function ensureSqlFile() {
    if (RESET_OUTPUT || !fs.existsSync(SQL_FILE_PATH)) {
        const sqlHeader = `-- TRUNG SON CARE REAL SEEDER\nUSE mg_catalog;\n\n`;
        fs.writeFileSync(SQL_FILE_PATH, sqlHeader, 'utf-8');
    }
}

const escapeSql = (str) => {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "''");
};

function productToSql(p) {
    const sku = `'${escapeSql(p.sku)}'`;
    const name = `'${escapeSql(p.name)}'`;
    const category_id = p.category_id || 'NULL';
    const active_ingredient = p.active_ingredient ? `'${escapeSql(p.active_ingredient)}'` : 'NULL';
    const registration_number = p.registration_number ? `'${escapeSql(p.registration_number)}'` : 'NULL';
    const manufacturer = p.manufacturer ? `'${escapeSql(p.manufacturer)}'` : 'NULL';
    const requires_prescription = p.requires_prescription || 0;
    const base_unit = p.base_unit ? `'${escapeSql(p.base_unit)}'` : "'Hộp'";
    const cost_price = p.cost_price || 0;
    const retail_price = p.retail_price || 0;
    const image_url = p.image_url ? `'${escapeSql(p.image_url)}'` : 'NULL';
    const gallery = p.gallery && p.gallery.length > 0 ? `'${escapeSql(JSON.stringify(p.gallery))}'` : 'NULL';
    const description = p.description ? `'${escapeSql(p.description)}'` : 'NULL';
    const barcode = p.barcode ? `'${escapeSql(p.barcode)}'` : 'NULL';

    return `INSERT IGNORE INTO products (sku, name, category_id, active_ingredient, registration_number, manufacturer, requires_prescription, base_unit, cost_price, retail_price, image_url, gallery, description, barcode) VALUES (${sku}, ${name}, ${category_id}, ${active_ingredient}, ${registration_number}, ${manufacturer}, ${requires_prescription}, ${base_unit}, ${cost_price}, ${retail_price}, ${image_url}, ${gallery}, ${description}, ${barcode});\n`;
}

let categoryList = [];
let categoryIdCounter = 1;
let catSlugToId = {};

async function parseCategories() {
    console.log("==> Bước 1: Thu thập cấu trúc Danh Mục Đa Cấp từ Trung Sơn Care...");
    try {
        const { data: html } = await axios.get('https://trungsoncare.com', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(html);

        const validRoots = ['Thuốc', 'Thực phẩm chức năng', 'Dược mỹ phẩm', 'Chăm sóc cá nhân', 'Mẹ & bé', 'Dụng cụ y tế'];
        const topMenus = $('.ty-menu__items > .ty-menu__item');

        topMenus.each((idx, el) => {
            let text = $(el).find('> a.ty-menu__item-link').text().trim();
            if (!text) text = $(el).find('> a .menu-title').text().trim();

            if (validRoots.includes(text)) {
                const rootId = categoryIdCounter++;
                const slug = generateSlug(text);
                categoryList.push({
                    id: rootId,
                    name: text,
                    slug: slug,
                    parent_id: null
                });
                catSlugToId[slug] = rootId;

                const submenus = $(el).find('.ty-menu__submenu-item > a.ty-menu__submenu-link, .sub-menu-list > ul > .menu-item > a');
                submenus.each((i, sub) => {
                    const subText = $(sub).text().trim();
                    const subUrl = $(sub).attr('href');
                    if (subText) {
                        const subSlug = generateSlug(subText);
                        const subId = categoryIdCounter++;
                        categoryList.push({
                            id: subId,
                            name: subText,
                            slug: subSlug,
                            parent_id: rootId
                        });
                        
                        // Extract original slug from URL
                        let urlSlug = '';
                        if (subUrl) {
                            const parts = subUrl.split('/');
                            urlSlug = parts[parts.length - 1].replace('.html', '');
                            catSlugToId[urlSlug] = subId;
                        }
                        catSlugToId[subSlug] = subId;
                    }
                });
            }
        });
        
        fs.writeFileSync(path.join(DATA_DIR, 'ts_categories.json'), JSON.stringify(categoryList, null, 2));
        console.log(`[SUCCESS] Đã lưu ${categoryList.length} danh mục vào ts_categories.json`);
    } catch(e) {
        console.error("Lỗi khi cào categories:", e.message);
    }
}

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0'
];

async function scrapeProduct(url, retries = 0) {
    try {
        const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
        const { data: html } = await axios.get(url, {
             headers: { 
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
             },
             timeout: 15000
        });
        const $ = cheerio.load(html);

        const name = $('title').text().replace('- Trung Sơn Pharma', '').trim();
        const priceStr = $('.ty-price-num').first().text().replace(/[^\d]/g, '');
        const retailPrice = priceStr ? parseInt(priceStr, 10) : 0;
        
        let manufacturer = '';
        let baseUnit = 'Hộp';
        let registrationNumber = '';
        let activeIngredient = '';
        
        $('.clearfix').each((i, el) => {
            const label = $(el).find('.ty-control-group__label').text().trim();
            const val = $(el).find('.ty-control-group__item').text().trim();
            if (label.includes('Thương hiệu')) manufacturer = val;
            if (label.includes('Quy cách')) baseUnit = val.split(' ')[0] || 'Hộp';
            if (label.includes('Số') && label.includes('công bố')) registrationNumber = val;
            if (label.includes('Số đăng ký')) registrationNumber = val;
            if (label.includes('Thành phần')) activeIngredient = val;
        });

        if (!manufacturer) {
             const brandDiv = $('.mb10:contains("Thương hiệu")');
             if(brandDiv.length) manufacturer = brandDiv.find('a').text().trim();
        }

        // Parent Category Fallback
        let categoryId = 1;
        $('.ty-breadcrumbs__a').each((i, el) => {
            const bcHref = $(el).attr('href');
            if (bcHref) {
                const parts = bcHref.split('/');
                const last = parts[parts.length - 1];
                const slug = last.replace('.html', '');
                if (catSlugToId[slug]) categoryId = catSlugToId[slug];
            }
        });

        const requiresPrescription = name.toLowerCase().includes('kê đơn') || name.toLowerCase().includes('rx') ? 1 : 0;
        const imageUrl = $('.cm-image-previewer').attr('href') || $('.ty-pict').attr('src') || '';
        
        let gallery = [];
        $('.ty-product-thumbnails__item img').each((i, el) => {
            const src = $(el).attr('src');
            if (src) {
               const fullSrc = src.replace('thumbnails/80/80/', '').replace('thumbnails/160/160/', '');
               if (!gallery.includes(fullSrc)) gallery.push(fullSrc);
            }
        });
        
        const description = $('#content_description').text().replace(/\s+/g, ' ').trim().substring(0, 1000);

        const productSku = stableSku(url, name);

        return {
           sku: productSku,
           name: name,
           category_id: categoryId,
           active_ingredient: activeIngredient,
           registration_number: registrationNumber,
           manufacturer: manufacturer,
           requires_prescription: requiresPrescription,
           base_unit: baseUnit || 'Hộp',
           cost_price: Math.round(retailPrice * 0.7),
           retail_price: retailPrice,
           image_url: imageUrl,
           gallery: gallery,
           description: description,
           barcode: stableBarcode(url, name),
           source_url: normalizeUrl(url),
        };
    } catch (error) {
        if (error.response && error.response.status === 429) {
            if (retries < 5) {
                console.log(` ⚠️ Bị khoá IP (Lỗi 429) tại ${url}. Tự động ngủ đông 5 phút để được ân xá rồi cày tiếp...`);
                await new Promise(r => setTimeout(r, 5 * 60 * 1000)); // Ngủ 5 phút
                return scrapeProduct(url, retries + 1);
            }
        }
        console.log(` - Lỗi tải ${url}: ${error.message}`);
        return null;
    }
}



async function getAllProductUrls() {
    console.log("==> Bước 2: Tải Sitemap để lấy đường dẫn các Sản phẩm...");
    try {
        let sitemapData = '';
        const localSitemapPath = path.join(DATA_DIR, 'ts_sitemap.xml');
        if (!REFRESH_SITEMAP && fs.existsSync(localSitemapPath)) {
            sitemapData = fs.readFileSync(localSitemapPath, 'utf-8');
        } else {
            const rs = await axios.get('https://trungsoncare.com/sitemap.xml');
            sitemapData = rs.data;
            fs.writeFileSync(localSitemapPath, sitemapData, 'utf-8');
        }

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(sitemapData);
        const urls = result.urlset.url.map(u => u.loc[0]);
        
        const validPrefixes = ['/thuoc/', '/thuc-pham-chuc-nang/', '/duoc-my-pham/', '/cham-soc-ca-nhan/', '/me-va-be/', '/dung-cu-y-te/'];
        
        let productUrls = urls.filter(u => {
            return validPrefixes.some(prefix => u.includes(prefix)) && u.endsWith('/');
        });
        
        // Shuffle array to get variety and slice
        for (let i = productUrls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [productUrls[i], productUrls[j]] = [productUrls[j], productUrls[i]];
        }

        return productUrls;
    } catch (e) {
        console.error("Lỗi sitemap:", e.message);
        return [];
    }
}

async function runCrawl() {
    await parseCategories();
    const existingProducts = readExistingProducts();
    const existingIndexes = buildExistingIndexes(existingProducts);
    const allUrls = await getAllProductUrls();
    const urls = allUrls.filter(url => !isKnownUrl(url, existingIndexes)).slice(0, MAX_PRODUCTS);

    if(urls.length === 0){
        console.log("Không còn URL sản phẩm mới để cào. Nếu muốn cào lại từ đầu, chạy với RESET_OUTPUT=1.");
        return;
    }

    console.log(`Tìm thấy ${allUrls.length} URL sản phẩm. Đã có ${existingProducts.length} sản phẩm, còn ${urls.length} URL mới sẽ cào.`);
    console.log(`==> Bước 3: Bắt đầu tải tối đa ${urls.length} sản phẩm mới (Concurrency: ${CONCURRENCY})...`);
    
    let completed = 0;
    let skippedDuplicate = 0;
    let failedLoads = 0;
    const products = existingProducts;

    writeJsonProducts(products);
    writeCsvProducts(products);
    ensureSqlFile();

    for (let i = 0; i < urls.length; i += CONCURRENCY) {
        const batch = urls.slice(i, i + CONCURRENCY);
        const promises = batch.map(url => scrapeProduct(url));
        const batchResults = await Promise.all(promises);
        
        const validResults = batchResults.filter(r => r !== null);
        failedLoads += batchResults.length - validResults.length;
        
        // Ghi trực tiếp liên tục vào file ngay lập tức
        for(let z = 0; z < validResults.length; z++) {
            let p = validResults[z];

            if (isDuplicateProduct(p, existingIndexes)) {
                skippedDuplicate++;
                console.log(` - Bỏ qua sản phẩm đã có: ${p.name}`);
                continue;
            }
            
            addProductToIndexes(p, existingIndexes);
            products.push(p);
            writeJsonProducts(products);
            writeCsvProducts(products);
            fs.appendFileSync(SQL_FILE_PATH, productToSql(p), 'utf-8');
            completed++;
        }
        
        const checkedCount = Math.min(i + CONCURRENCY, urls.length);
        const failureRate = checkedCount > 0 ? failedLoads / checkedCount : 0;
        console.log(`Progress: Đã cào thêm ${completed} sản phẩm mới, bỏ qua ${skippedDuplicate} trùng, lỗi tải ${failedLoads}, đã kiểm tra ${checkedCount}/${urls.length} URL.`);

        if (STOP_ON_FAILURE_RATE && checkedCount >= FAILURE_RATE_CHECK_AFTER && failureRate >= MAX_FAILURE_RATE) {
            console.log(`Dừng sớm vì tỉ lệ lỗi tải ${(failureRate * 100).toFixed(1)}% >= ${(MAX_FAILURE_RATE * 100).toFixed(1)}% sau ${checkedCount} URL.`);
            break;
        }
        
        // Random hóa quãng nghỉ giữa các lượt cào (từ 2.5s đến 6s) để tránh bị hệ thống nhận diện là Bot
        const delayRange = Math.max(0, REQUEST_DELAY_MAX_MS - REQUEST_DELAY_MIN_MS);
        const randomDelay = Math.floor(Math.random() * delayRange) + REQUEST_DELAY_MIN_MS;
        await new Promise(r => setTimeout(r, randomDelay)); 
    }

    console.log(`\n🎉 HOÀN TẤT!`);
    console.log(`- Đã cào thêm ${completed} sản phẩm mới, tổng hiện có ${products.length} sản phẩm.`);
    console.log(`- Đã bỏ qua ${skippedDuplicate} sản phẩm trùng trong lúc cào.`);
    console.log(`- Dữ liệu lưu tại: ts_products_real.json và ts_products_real.csv`);
    console.log(`- File SQL nạp cấu hình: ${SQL_FILE_PATH}`);
    console.log(`- Hình ảnh: Giữ nguyên đường dẫn gốc từ Trung Sơn Care (không tải về).`);
}

runCrawl();
