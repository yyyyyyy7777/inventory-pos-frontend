const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const products = await pool.query(`
      SELECT p.id, p.name, p.stock as current_stock, 
             COALESCE((SELECT SUM(quantity) FROM stockbatch WHERE "productId" = p.id), 0) as batch_sum
      FROM product p
    `);
    
    let fixed = 0;
    for (const row of products.rows) {
      if (row.batch_sum > 0 && Number(row.current_stock) !== Number(row.batch_sum)) {
        console.log(`Fixing ${row.name} (ID: ${row.id}): stock ${row.current_stock} -> ${row.batch_sum}`);
        await pool.query('UPDATE product SET stock = $1 WHERE id = $2', [row.batch_sum, row.id]);
        fixed++;
      }
    }
    
    console.log(`Fixed ${fixed} products.`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
