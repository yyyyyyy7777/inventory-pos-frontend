const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: false
});

async function addStatusColumn() {
  try {
    await pool.query(`ALTER TABLE employee ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
    console.log('✓ Status column added successfully');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

addStatusColumn();
