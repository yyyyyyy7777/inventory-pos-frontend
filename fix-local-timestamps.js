// Fix timestamps - they're showing UTC+8 when they should be local time
const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function fixTimestampsToLocalTime() {
  console.log('=== FIXING TIMESTAMPS TO LOCAL DEVICE TIME ===');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Get all activities
    const { rows } = await client.query('SELECT id, timestamp FROM activities');
    console.log(`Checking ${rows.length} activities`);
    
    let fixed = 0;
    for (const row of rows) {
      const { id, timestamp } = row;
      
      // Skip if not in UTC format (contains 'T')
      if (!timestamp || typeof timestamp !== 'string' || !timestamp.includes('T')) continue;
      
      // Parse UTC timestamp and convert to Philippines time (subtract 8 hours, not add)
      const utcDate = new Date(timestamp);
      const localTime = new Date(utcDate.getTime() - (8 * 60 * 60 * 1000));
      
      const hours = localTime.getUTCHours();
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      const newTimestamp = `${localTime.getUTCMonth() + 1}/${localTime.getUTCDate()}/${localTime.getUTCFullYear()}, ${displayHours}:${localTime.getUTCMinutes().toString().padStart(2, '0')}:${localTime.getUTCSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
      
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

fixTimestampsToLocalTime();
