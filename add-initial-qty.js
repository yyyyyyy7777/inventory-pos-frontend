const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    // Add initialQuantity to stockbatch
    await client.query(`ALTER TABLE stockbatch ADD COLUMN IF NOT EXISTS "initialQuantity" INTEGER;`);
    console.log('Added initialQuantity column to stockbatch');

    // Backfill historical quantities
    const updateResult = await client.query(`UPDATE stockbatch SET "initialQuantity" = quantity WHERE "initialQuantity" IS NULL;`);
    console.log(`Backfilled initialQuantity for ${updateResult.rowCount} rows`);

    client.release();
    console.log('Migration successful!');
  } catch (error) {
    console.error('Error adding columns:', error);
  } finally {
    pool.end();
  }
}

run();
