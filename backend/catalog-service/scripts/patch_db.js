require('dotenv').config({ path: '../.env' });
const pool = require('../db/pool');

async function patchDb() {
  try {
    // 1. Create some brands
    console.log('Inserting brands...');
    const brands = [
      'Dược Hậu Giang', 'Traphaco', 'Sanofi', 'GSK', 'Pfizer', 'AstraZeneca', 'Rohto', 'Nhất Nhất'
    ];
    for (const b of brands) {
      await pool.query('INSERT IGNORE INTO brands (name, slug) VALUES (?, ?)', [b, b.toLowerCase().replace(/ /g, '-')]);
    }

    const [dbBrands] = await pool.query('SELECT id FROM brands');
    const brandIds = dbBrands.map(b => b.id);

    // 2. Origins
    const origins = ['Việt Nam', 'Pháp', 'Anh', 'Mỹ', 'Nhật Bản', 'Hàn Quốc', 'Ấn Độ'];

    // 3. Update products
    console.log('Fetching products...');
    const [products] = await pool.query('SELECT id FROM products');
    
    console.log(`Updating ${products.length} products...`);
    for (const p of products) {
      const randomBrandId = brandIds[Math.floor(Math.random() * brandIds.length)];
      const randomOrigin = origins[Math.floor(Math.random() * origins.length)];
      
      await pool.query(
        'UPDATE products SET brand_id = ?, country_of_origin = ? WHERE id = ?',
        [randomBrandId, randomOrigin, p.id]
      );
    }

    console.log('Done patching DB!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

patchDb();
