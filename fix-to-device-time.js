// Fix all timestamps to match current device time (4:55 AM)
const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function fixToCurrentDeviceTime() {
  console.log('=== FIXING TO CURRENT DEVICE TIME (4:55 AM) ===');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Get current device time (4:55 AM adjustment)
    const now = new Date();
    console.log('Current device time:', now.toString());
    
    // Calculate the adjustment needed (from 12:55 PM to 4:55 AM = -8 hours)
    const adjustmentMs = -8 * 60 * 60 * 1000;
    
    // Fix ACTIVITIES
    console.log('Fixing ACTIVITIES to current device time...');
    const { rows: activities } = await client.query('SELECT id, timestamp FROM activities');
    console.log(`Found ${activities.length} activities`);
    
    let activitiesFixed = 0;
    for (const activity of activities) {
      const { id, timestamp } = activity;
      
      if (!timestamp) continue;
      
      // Parse existing timestamp and adjust to current device time
      const date = new Date(timestamp);
      const adjustedTime = new Date(date.getTime() + adjustmentMs);
      
      const month = adjustedTime.getMonth() + 1;
      const day = adjustedTime.getDate();
      const year = adjustedTime.getFullYear();
      let hours = adjustedTime.getHours();
      const minutes = adjustedTime.getMinutes();
      const seconds = adjustedTime.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      
      const newTimestamp = `${month}/${day}/${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
      
      await client.query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
      activitiesFixed++;
      
      if (activitiesFixed <= 5) {
        console.log(`Fixed activity: ${timestamp} → ${newTimestamp}`);
      }
    }
    console.log(`Fixed ${activitiesFixed} activities\n`);
    
    // Fix EMPLOYEE login/logout
    console.log('Fixing EMPLOYEE login/logout to current device time...');
    const { rows: employees } = await client.query('SELECT id, username, "lastLogin", "lastLogout" FROM employee');
    console.log(`Found ${employees.length} employees`);
    
    let empFixed = 0;
    for (const emp of employees) {
      const { id, username, lastLogin, lastLogout } = emp;
      
      if (lastLogin) {
        const date = new Date(lastLogin);
        const adjustedTime = new Date(date.getTime() + adjustmentMs);
        const month = adjustedTime.getMonth() + 1;
        const day = adjustedTime.getDate();
        const year = adjustedTime.getFullYear();
        let hours = adjustedTime.getHours();
        const minutes = adjustedTime.getMinutes();
        const seconds = adjustedTime.getSeconds();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const newTime = `${month}/${day}/${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
        await client.query('UPDATE employee SET "lastLogin" = $1 WHERE id = $2', [newTime, id]);
        empFixed++;
      }
      
      if (lastLogout) {
        const date = new Date(lastLogout);
        const adjustedTime = new Date(date.getTime() + adjustmentMs);
        const month = adjustedTime.getMonth() + 1;
        const day = adjustedTime.getDate();
        const year = adjustedTime.getFullYear();
        let hours = adjustedTime.getHours();
        const minutes = adjustedTime.getMinutes();
        const seconds = adjustedTime.getSeconds();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const newTime = `${month}/${day}/${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
        await client.query('UPDATE employee SET "lastLogout" = $1 WHERE id = $2', [newTime, id]);
        empFixed++;
      }
    }
    console.log(`Fixed ${empFixed} employee timestamps\n`);
    
    console.log('=== ALL TIMESTAMPS FIXED TO CURRENT DEVICE TIME ===');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixToCurrentDeviceTime();
