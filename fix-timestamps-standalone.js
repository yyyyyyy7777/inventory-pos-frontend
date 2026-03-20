// Standalone script to fix old activity timestamps
// Run with: node fix-timestamps-standalone.js

const { Client } = require('pg');

// Database connection string from your .env.local
const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function fixOldActivityTimestamps() {
  console.log('=== FIXING OLD ACTIVITY TIMESTAMPS ===');
  console.log('Connecting to database...');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected!');
    
    // Get all activities
    const { rows: activities } = await client.query('SELECT id, timestamp FROM activities');
    console.log(`Found ${activities.length} activities to check\n`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const activity of activities) {
      const { id, timestamp } = activity;
      
      // Skip if timestamp is null/undefined
      if (!timestamp || typeof timestamp !== 'string') {
        console.log(`Skipping ${id}: timestamp is null or not a string`);
        skipped++;
        continue;
      }
      
      // Skip if already in correct format with timezone
      if (timestamp.includes('(UTC')) {
        skipped++;
        continue;
      }
      
      // Check if timestamp is in ISO format (contains 'T' or starts with YYYY-MM-DD)
      if (timestamp.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
        try {
          // Parse as UTC date
          const utcDate = new Date(timestamp);
          
          // Convert to Philippines time (UTC+8)
          const phTime = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
          
          const hours = phTime.getUTCHours();
          const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
          const ampm = hours >= 12 ? 'PM' : 'AM';
          
          const newTimestamp = `${phTime.getUTCMonth() + 1}/${phTime.getUTCDate()}/${phTime.getUTCFullYear()}, ${displayHours}:${phTime.getUTCMinutes().toString().padStart(2, '0')}:${phTime.getUTCSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
          
          // Update the activity
          await client.query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
          
          console.log(`✓ Fixed: ${timestamp}`);
          console.log(`  → ${newTimestamp}\n`);
          fixed++;
        } catch (err) {
          console.log(`✗ Failed to fix ${id}: ${timestamp}`);
          skipped++;
        }
      } else if (timestamp) {
        // Old format without timezone - add timezone
        try {
          const match = timestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
          if (match) {
            const newTimestamp = `${match[1]}/${match[2]}/${match[3]}, ${match[4]}:${match[5]}:${match[6]} ${match[7].toUpperCase()} (UTC+8)`;
            await client.query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
            console.log(`✓ Added timezone: ${timestamp} → ${newTimestamp}\n`);
            fixed++;
          } else {
            skipped++;
          }
        } catch (err) {
          skipped++;
        }
      } else {
        skipped++;
      }
    }
    
    console.log('\n=== DONE ===');
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped (already correct): ${skipped}`);
    console.log(`Total: ${activities.length}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

// Check if pg is installed
try {
  require('pg');
  fixOldActivityTimestamps();
} catch (e) {
  console.log('Installing pg module...');
  const { execSync } = require('child_process');
  execSync('npm install pg', { stdio: 'inherit' });
  console.log('pg installed. Run the script again: node fix-timestamps-standalone.js');
}
