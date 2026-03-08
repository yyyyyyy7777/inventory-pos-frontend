const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function checkTables() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
  });

  try {
    // List all tables in the public schema
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('All tables in database:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check for case-sensitive duplicates
    const tableNames = result.rows.map(r => r.table_name);
    const lowerCaseNames = tableNames.map(t => t.toLowerCase());
    const duplicates = lowerCaseNames.filter((item, index) => lowerCaseNames.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️ Potential case-sensitive duplicates found:');
      duplicates.forEach(dup => {
        const matching = tableNames.filter(t => t.toLowerCase() === dup);
        console.log(`  ${matching.join(' vs ')}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
