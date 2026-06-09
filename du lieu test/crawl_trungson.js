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
const MAX_PRODUCTS = 2000;
const CONCURRENCY = 1;

// Create folders if none exists
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

function generateSlug(text) {
    if (!text) return '';
    return slugify(text, { lower: true, strict: true, locale: 'vi' });
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

        const productSku = 'TS-' + Math.floor(10000 + Math.random() * 90000);

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
           barcode: '893' + Math.floor(1000000000 + Math.random() * 9000000000),
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
        if (fs.existsSync('ts_sitemap.xml')) {
            sitemapData = fs.readFileSync('ts_sitemap.xml', 'utf-8');
        } else {
            const rs = await axios.get('https://trungsoncare.com/sitemap.xml');
            sitemapData = rs.data;
        }

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(sitemapData);
        const urls = result.urlset.url.map(u => u.loc[0]);
        
        const validPrefixes = ['/thuoc/', '/thuc-pham-chuc-nang/', '/duoc-my-pham/', '/cham-soc-ca-nhan/', '/me-va-be/', '/dung-cu-y-te/'];
        
        let productUrls = urls.filter(u => {
            return validPrefixes.some(prefix => u.includes(prefix)) && u.endsWith('/');
        });
        
        console.log(`Tìm thấy ${productUrls.length} urls khớp tiêu chí sản phẩm. Chọn lấy ngẫu nhiên ${MAX_PRODUCTS}.`);
        
        // Shuffle array to get variety and slice
        for (let i = productUrls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [productUrls[i], productUrls[j]] = [productUrls[j], productUrls[i]];
        }

        return productUrls.slice(0, MAX_PRODUCTS);
    } catch (e) {
        console.error("Lỗi sitemap:", e.message);
        return [];
    }
}

async function runCrawl() {
    await parseCategories();
    const urls = await getAllProductUrls();

    if(urls.length === 0){
        console.log("Không lấy được URL tự động, kiểm tra lại ts_sitemap.xml");
        return;
    }

    console.log(`==> Bước 3: Bắt đầu tải ${urls.length} sản phẩm (Concurrency: ${CONCURRENCY})...`);
    
    let completed = 0;

    // Chuẩn bị file
    const jsonPath = path.join(DATA_DIR, 'ts_products_real.json');
    const csvPath = path.join(DATA_DIR, 'ts_products_real.csv');
    const sqlFilePath = path.join(__dirname, '../infrastructure/database/99_seed_trungson_real.sql');
    
    // Ghi Header
    fs.writeFileSync(jsonPath, '[\n', 'utf-8');
    
    const headerKeys = ['sku','name','category_id','active_ingredient','registration_number','manufacturer','requires_prescription','base_unit','cost_price','retail_price','image_url','gallery','description','barcode'];
    fs.writeFileSync(csvPath, headerKeys.join(',') + '\n', 'utf-8');
    
    const sqlHeader = `-- TRUNG SON CARE REAL SEEDER\nUSE mg_catalog;\n\n`;
    fs.writeFileSync(sqlFilePath, sqlHeader, 'utf-8');

    const toCsvRow = (obj) => {
        return Object.values(obj).map(v => {
            if (v === null || v === undefined) return '""';
            if (typeof v === 'string') return `"${String(v).replace(/"/g, '""')}"`;
            if (Array.isArray(v)) return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
            return `"${v}"`;
        }).join(',');
    };

    const escapeSql = (str) => {
        if (!str) return '';
        return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
    };

    for (let i = 0; i < urls.length; i += CONCURRENCY) {
        const batch = urls.slice(i, i + CONCURRENCY);
        const promises = batch.map(url => scrapeProduct(url));
        const batchResults = await Promise.all(promises);
        
        const validResults = batchResults.filter(r => r !== null);
        
        // Ghi trực tiếp liên tục vào file ngay lập tức
        for(let z = 0; z < validResults.length; z++) {
            let p = validResults[z];
            
            // Append JSON
            const comma = (completed === 0 && z === 0) ? '' : ',\n';
            fs.appendFileSync(jsonPath, comma + JSON.stringify(p, null, 2), 'utf-8');
            
            // Append CSV
            fs.appendFileSync(csvPath, toCsvRow(p) + '\n', 'utf-8');
            
            // Append SQL
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
            const gallery = p.gallery && p.gallery.length > 0 ? `'${JSON.stringify(p.gallery)}'` : 'NULL';
            const description = p.description ? `'${escapeSql(p.description)}'` : 'NULL';
            const barcode = p.barcode ? `'${escapeSql(p.barcode)}'` : 'NULL';

            const sql = `INSERT IGNORE INTO products (sku, name, category_id, active_ingredient, registration_number, manufacturer, requires_prescription, base_unit, cost_price, retail_price, image_url, gallery, description, barcode) VALUES (${sku}, ${name}, ${category_id}, ${active_ingredient}, ${registration_number}, ${manufacturer}, ${requires_prescription}, ${base_unit}, ${cost_price}, ${retail_price}, ${image_url}, ${gallery}, ${description}, ${barcode});\n`;
            
            fs.appendFileSync(sqlFilePath, sql, 'utf-8');
        }
        
        completed += validResults.length;
        console.log(`Progress: Đã cào được ${completed}/${urls.length} (${((completed/urls.length)*100).toFixed(1)}%) sản phẩm.`);
        
        // Random hóa quãng nghỉ giữa các lượt cào (từ 2.5s đến 6s) để tránh bị hệ thống nhận diện là Bot
        const randomDelay = Math.floor(Math.random() * 3500) + 2500;
        await new Promise(r => setTimeout(r, randomDelay)); 
    }
    
    // Chốt đuôi file JSON
    fs.appendFileSync(jsonPath, '\n]', 'utf-8');

    console.log(`\n🎉 HOÀN TẤT!`);
    console.log(`- Đã cào xong ${completed} sản phẩm thật.`);
    console.log(`- Dữ liệu lưu tại: ts_products_real.json và ts_products_real.csv`);
    console.log(`- File SQL nạp cấu hình: ${sqlFilePath}`);
    console.log(`- Hình ảnh: Giữ nguyên đường dẫn gốc từ Trung Sơn Care (không tải về).`);
}

runCrawl();
