const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    // Add sellingPrice to stockbatch
    await client.query(`ALTER TABLE stockbatch ADD COLUMN IF NOT EXISTS "sellingPrice" DOUBLE PRECISION;`);
    console.log('Added sellingPrice to stockbatch');

    // Add unitCost to saleItem
    await client.query(`ALTER TABLE "saleItem" ADD COLUMN IF NOT EXISTS "unitCost" DOUBLE PRECISION DEFAULT 0;`);
    console.log('Added unitCost to saleItem');

    client.release();
    console.log('Done!');
  } catch (error) {
    console.error('Error adding columns:', error);
  } finally {
    pool.end();
  }
}

run();
