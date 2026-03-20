// Fix all UTC timestamps
const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function fixAllUtcTimestamps() {
  console.log('=== FIXING ALL UTC TIMESTAMPS ===');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Get ALL activities
    const { rows } = await client.query('SELECT id, timestamp FROM activities');
    console.log(`Checking ${rows.length} activities`);
    
    let fixed = 0;
    for (const row of rows) {
      const { id, timestamp } = row;
      
      // Skip if already fixed
      if (timestamp && typeof timestamp === 'string' && timestamp.includes('(UTC+8)')) continue;
      
      // Parse timestamp
      const utcDate = new Date(timestamp);
      
      // Convert to Philippines time (UTC+8)
      const phTime = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
      
      const hours = phTime.getUTCHours();
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      const newTimestamp = `${phTime.getUTCMonth() + 1}/${phTime.getUTCDate()}/${phTime.getUTCFullYear()}, ${displayHours}:${phTime.getUTCMinutes().toString().padStart(2, '0')}:${phTime.getUTCSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
      
      await client.query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
      console.log(`Fixed: ${timestamp}`);
      console.log(`  → ${newTimestamp}`);
      fixed++;
    }
    
    console.log(`\nFixed ${fixed} timestamps`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixAllUtcTimestamps();
