const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const DATA_DIR = __dirname;
const SITEMAP_PATH = path.join(DATA_DIR, 'ts_sitemap.xml');
const SQL_PATH = path.join(__dirname, '../infrastructure/database/99_seed_cms_blogs.sql');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
];

// Helper: Lấy 50 bài ngẫu nhiên từ sitemap
function getBlogUrls() {
    try {
        const smContent = fs.readFileSync(SITEMAP_PATH, 'utf-8');
        const regex = /<loc>(https:\/\/trungsoncare\.com\/(benh-ly|suc-khoe-tong-quat|nguoi-cao-tuoi)\/[^<]+)<\/loc>/g;
        let match;
        const urls = [];
        
        while ((match = regex.exec(smContent)) !== null) {
            urls.push({ url: match[1], category: match[2] });
        }

        // Shuffle
        for (let i = urls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [urls[i], urls[j]] = [urls[j], urls[i]];
        }
        
        console.log(`Đã tìm thấy ${urls.length} link bài viết y tế. Tiến hành lấy ngẫu nhiên top 50...`);
        return urls.slice(0, 50);
    } catch (e) {
        console.error("Lỗi đọc sitemap:", e.message);
        return [];
    }
}

const escapeSql = (str) => {
    if (!str) return '';
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
};

const removeScripts = (html) => {
    if (!html) return '';
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
};

async function scrapeBlog(item, retries = 0) {
    try {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const { data: html } = await axios.get(item.url, {
             headers: { 'User-Agent': ua, 'Accept': 'text/html' },
             timeout: 10000
        });
        const $ = cheerio.load(html);

        const title = $('h1').text().trim();
        if(!title) return null;

        const contentRaw = $('.ty-wysiwyg-content').first().html();
        const content = removeScripts(contentRaw);
        
        const thumbnailUrl = $('meta[property="og:image"]').attr('content') || '';
        
        // Excerpt logic: Lấy text 250 ký tự đầu tiên
        let excerpt = $('.ty-wysiwyg-content').first().text().replace(/\s+/g, ' ').trim().substring(0, 250);
        if (excerpt) excerpt += '...';

        const parts = item.url.split('/');
        const slug = parts[parts.length - 2] || ('bai-viet-' + Math.floor(Math.random()*10000));

        // Tự động map sang ID categories
        let categoryId = 1; // Default
        if (item.category === 'benh-ly') categoryId = 2; // Giả sử ID 2 là Bệnh lý

        return {
            title,
            slug,
            content,
            excerpt,
            thumbnail_url: thumbnailUrl,
            category_id: categoryId,
            tags: JSON.stringify([item.category, "suc-khoe", "tu-van"]),
            status: "published",
        };
    } catch (error) {
        if (error.response && error.response.status === 429) {
            if (retries < 3) {
                console.log(` ⚠️ Bị khoá IP (429) tại bài ${item.url}. Ngủ đông 5 phút...`);
                await new Promise(r => setTimeout(r, 5 * 60 * 1000));
                return scrapeBlog(item, retries + 1);
            }
        }
        console.log(` - Lỗi tải ${item.url}: ${error.message}`);
        return null;
    }
}

async function run() {
    const urls = getBlogUrls();
    if(urls.length === 0) return;

    fs.writeFileSync(SQL_PATH, `-- MOCK BLOGS: 50 BÀI VIẾT TỪ TRUNG SƠN CARE\nUSE mg_cms;\n\n`, 'utf-8');

    let completed = 0;
    for (let i = 0; i < urls.length; i++) {
        const item = urls[i];
        
        const blog = await scrapeBlog(item);
        if (blog) {
            const sql = `INSERT IGNORE INTO articles (title, slug, content, excerpt, thumbnail_url, category_id, tags, status, published_at, view_count) VALUES ('${escapeSql(blog.title)}', '${escapeSql(blog.slug)}', '${escapeSql(blog.content)}', '${escapeSql(blog.excerpt)}', '${escapeSql(blog.thumbnail_url)}', ${blog.category_id}, '${escapeSql(blog.tags)}', '${blog.status}', NOW(), ${Math.floor(Math.random()*1000)}); \n`;
            
            fs.appendFileSync(SQL_PATH, sql, 'utf-8');
            completed++;
            console.log(`[${i+1}/${urls.length}] (+) Cào thành công bài: ${blog.title.substring(0, 40)}...`);
        }
        
        await new Promise(r => setTimeout(r, 2000 + Math.random()*2000));
    }

    console.log(`\n🎉 HOÀN TẤT VÀ LÊN MÂM! Đã bốc được ${completed} Bài viết Blog Y khoa!`);
    console.log(`- File Database đã được nhồi trực tiếp vào: ${SQL_PATH}`);
}

run();
