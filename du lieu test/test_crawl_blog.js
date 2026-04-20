const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const url = 'https://trungsoncare.com/kien-thuc-y-khoa.html'; // Tên mục có thể là kien-thuc-y-khoa.html hoặc bai-viet.html
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        const $ = cheerio.load(data);
        console.log("Tìm được thẻ tin tức:", $('.ty-blog__item').length || $('.news-item').length);
    } catch (e) {
        if(e.response) {
            console.log("Error status:", e.response.status);
        } else {
            console.log(e.message);
        }
    }
}
test();
