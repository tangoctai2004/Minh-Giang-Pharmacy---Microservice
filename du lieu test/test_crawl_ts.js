const fs = require('fs');
const cheerio = require('cheerio');
const axios = require('axios');
const crypto = require('crypto');
const slugify = require('slugify');

function generateSlug(text) {
    return slugify(text, { lower: true, strict: true, locale: 'vi' });
}

let catSlugToId = {};

async function scrapeProduct(url) {
    try {
        const { data: html } = await axios.get(url, {
             headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
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
            if (label.includes('Quy cách')) baseUnit = val.split(' ')[0] || 'Hộp'; // Just get the first word or the full string
            if (label.includes('Số Giấy công bố') || label.includes('Số đăng ký')) registrationNumber = val;
            if (label.includes('Thành phần')) activeIngredient = val;
        });

        // Alternate selector for Brand
        if (!manufacturer) {
             const brandDiv = $('.mb10:contains("Thương hiệu")');
             if(brandDiv.length) {
                 manufacturer = brandDiv.find('a').text().trim();
             }
        }

        // Requires Prescription
        const requiresPrescription = name.toLowerCase().includes('kê đơn') || name.toLowerCase().includes('rx') ? 1 : 0;

        const imageUrl = $('.cm-image-previewer').attr('href') || '';
        
        let gallery = [];
        $('.ty-product-thumbnails__item img').each((i, el) => {
            const src = $(el).attr('src');
            if (src) {
               const fullSrc = src.replace('thumbnails/80/80/', '').replace('thumbnails/160/160/', '');
               if (!gallery.includes(fullSrc)) gallery.push(fullSrc);
            }
        });
        
        // Description
        const description = $('#content_description').text().trim().substring(0, 500);

        const productData = {
           sku: 'TS-' + Math.floor(Math.random() * 100000),
           name: name,
           category_id: 11,
           active_ingredient: activeIngredient,
           registration_number: registrationNumber,
           manufacturer: manufacturer,
           requires_prescription: requiresPrescription,
           base_unit: baseUnit,
           cost_price: Math.round(retailPrice * 0.7),
           retail_price: retailPrice,
           image_url: imageUrl,
           gallery: gallery,
           description: description,
           barcode: '893' + Math.floor(1000000000 + Math.random() * 9000000000),
        };
        
        console.log(JSON.stringify(productData, null, 2));

    } catch (error) {
        console.error("Error scraping product:", error.message);
    }
}

scrapeProduct("https://trungsoncare.com/thuoc/thuoc-panadol-xanh-500mg-ha-sot-va-dieu-tri-dau-nhe-den-trung-binh-10-vi-x-12-vien/");
