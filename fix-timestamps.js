const { query } = require('./lib/pg-direct.ts');

async function fixOldActivityTimestamps() {
  console.log('=== FIXING OLD ACTIVITY TIMESTAMPS ===');
  
  try {
    // Get all activities
    const activities = await query('SELECT id, timestamp FROM activities');
    console.log(`Found ${activities.length} activities to check`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const activity of activities) {
      const { id, timestamp } = activity;
      
      // Check if timestamp is in ISO format (contains 'T' and 'Z' or looks like 2026-03-21...)
      if (timestamp && (timestamp.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(timestamp))) {
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
          await query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
          
          console.log(`Fixed activity ${id}: ${timestamp} → ${newTimestamp}`);
          fixed++;
        } catch (err) {
          console.log(`Failed to fix activity ${id}: ${timestamp} - ${err.message}`);
          skipped++;
        }
      } else if (timestamp && !timestamp.includes('(UTC')) {
        // Old format without timezone indicator - assume it's already local time but add timezone
        try {
          // Try to parse and add timezone
          const match = timestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
          if (match) {
            const newTimestamp = `${match[1]}/${match[2]}/${match[3]}, ${match[4]}:${match[5]}:${match[6]} ${match[7].toUpperCase()} (UTC+8)`;
            await query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
            console.log(`Added timezone to activity ${id}: ${timestamp} → ${newTimestamp}`);
            fixed++;
          } else {
            skipped++;
          }
        } catch (err) {
          console.log(`Failed to fix activity ${id}: ${timestamp}`);
          skipped++;
        }
      } else {
        // Already in correct format
        skipped++;
      }
    }
    
    console.log('\n=== DONE ===');
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped (already correct): ${skipped}`);
    console.log(`Total: ${activities.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixOldActivityTimestamps();
