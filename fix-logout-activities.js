// Fix logout timestamps and activities by subtracting 8 hours
const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function fixLogoutAndActivities() {
  console.log('=== FIXING LOGOUT AND ACTIVITIES - MINUS 8 HOURS ===');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Fix ACTIVITIES table again
    console.log('Fixing ACTIVITIES table...');
    const { rows: activities } = await client.query('SELECT id, timestamp FROM activities');
    console.log(`Found ${activities.length} activities`);
    
    let activitiesFixed = 0;
    for (const activity of activities) {
      const { id, timestamp } = activity;
      
      if (!timestamp) continue;
      
      // Parse timestamp and subtract 8 hours
      const date = new Date(timestamp);
      const adjustedTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
      
      const hours = adjustedTime.getUTCHours();
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      const newTimestamp = `${adjustedTime.getUTCMonth() + 1}/${adjustedTime.getUTCDate()}/${adjustedTime.getUTCFullYear()}, ${displayHours}:${adjustedTime.getUTCMinutes().toString().padStart(2, '0')}:${adjustedTime.getUTCSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
      
      await client.query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
      activitiesFixed++;
      
      if (activitiesFixed <= 5) {
        console.log(`Fixed activity: ${timestamp} → ${newTimestamp}`);
      }
    }
    console.log(`Fixed ${activitiesFixed} activities\n`);
    
    // Fix EMPLOYEE logout times
    console.log('Fixing EMPLOYEE logout times...');
    const { rows: employees } = await client.query('SELECT id, username, "lastLogout" FROM employee WHERE "lastLogout" IS NOT NULL');
    console.log(`Found ${employees.length} employees with logout times`);
    
    let logoutFixed = 0;
    for (const emp of employees) {
      const { id, username, lastLogout } = emp;
      
      if (lastLogout) {
        const date = new Date(lastLogout);
        const adjustedTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
        const hours = adjustedTime.getUTCHours();
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const newTime = `${adjustedTime.getUTCMonth() + 1}/${adjustedTime.getUTCDate()}/${adjustedTime.getUTCFullYear()}, ${displayHours}:${adjustedTime.getUTCMinutes().toString().padStart(2, '0')}:${adjustedTime.getUTCSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
        await client.query('UPDATE employee SET "lastLogout" = $1 WHERE id = $2', [newTime, id]);
        logoutFixed++;
        
        if (logoutFixed <= 3) {
          console.log(`Fixed logout for ${username}: ${lastLogout} → ${newTime}`);
        }
      }
    }
    console.log(`Fixed ${logoutFixed} logout times\n`);
    
    console.log('=== ALL FIXES COMPLETED ===');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixLogoutAndActivities();
