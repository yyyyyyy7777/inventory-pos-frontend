const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function cleanupDuplicates() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
  });

  try {
    // Drop the capitalized duplicate tables
    // Order matters due to foreign key constraints
    
    console.log('Dropping duplicate capitalized tables...');
    
    await pool.query('DROP TABLE IF EXISTS "SaleItem" CASCADE');
    console.log('✓ Dropped SaleItem');
    
    await pool.query('DROP TABLE IF EXISTS "Sale" CASCADE');
    console.log('✓ Dropped Sale');
    
    await pool.query('DROP TABLE IF EXISTS "StockBatch" CASCADE');
    console.log('✓ Dropped StockBatch');
    
    await pool.query('DROP TABLE IF EXISTS "Product" CASCADE');
    console.log('✓ Dropped Product');
    
    await pool.query('DROP TABLE IF EXISTS "Employee" CASCADE');
    console.log('✓ Dropped Employee');
    
    await pool.query('DROP TABLE IF EXISTS "Category" CASCADE');
    console.log('✓ Dropped Category');
    
    await pool.query('DROP TABLE IF EXISTS "User" CASCADE');
    console.log('✓ Dropped User');
    
    await pool.query('DROP TABLE IF EXISTS "OrderItem" CASCADE');
    console.log('✓ Dropped OrderItem');
    
    await pool.query('DROP TABLE IF EXISTS "Order" CASCADE');
    console.log('✓ Dropped Order');
    
    console.log('\nCleanup complete! Remaining tables:');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

cleanupDuplicates();
