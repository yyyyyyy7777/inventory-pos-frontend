// Clean rebuild of activity timestamps - use real device time
const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function cleanRebuildTimestamps() {
  console.log('=== CLEAN REBUILD - USE REAL DEVICE TIME ===');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Reset ACTIVITIES to real device time
    console.log('Resetting ACTIVITIES to real device time...');
    const { rows: activities } = await client.query('SELECT id, timestamp FROM activities');
    console.log(`Found ${activities.length} activities`);
    
    let activitiesFixed = 0;
    for (const activity of activities) {
      const { id, timestamp } = activity;
      
      if (!timestamp) continue;
      
      // Parse the timestamp and convert to real device time (no adjustments)
      const date = new Date(timestamp);
      const realTime = new Date(date); // Use the actual time without adjustments
      
      const month = realTime.getMonth() + 1;
      const day = realTime.getDate();
      const year = realTime.getFullYear();
      let hours = realTime.getHours();
      const minutes = realTime.getMinutes();
      const seconds = realTime.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      
      const newTimestamp = `${month}/${day}/${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
      
      await client.query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
      activitiesFixed++;
      
      if (activitiesFixed <= 5) {
        console.log(`Reset activity: ${timestamp} → ${newTimestamp}`);
      }
    }
    console.log(`Reset ${activitiesFixed} activities\n`);
    
    // Reset EMPLOYEE login/logout to real device time
    console.log('Resetting EMPLOYEE login/logout to real device time...');
    const { rows: employees } = await client.query('SELECT id, username, "lastLogin", "lastLogout" FROM employee');
    console.log(`Found ${employees.length} employees`);
    
    let empFixed = 0;
    for (const emp of employees) {
      const { id, username, lastLogin, lastLogout } = emp;
      
      if (lastLogin) {
        const date = new Date(lastLogin);
        const realTime = new Date(date);
        const month = realTime.getMonth() + 1;
        const day = realTime.getDate();
        const year = realTime.getFullYear();
        let hours = realTime.getHours();
        const minutes = realTime.getMinutes();
        const seconds = realTime.getSeconds();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const newTime = `${month}/${day}/${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
        await client.query('UPDATE employee SET "lastLogin" = $1 WHERE id = $2', [newTime, id]);
        empFixed++;
      }
      
      if (lastLogout) {
        const date = new Date(lastLogout);
        const realTime = new Date(date);
        const month = realTime.getMonth() + 1;
        const day = realTime.getDate();
        const year = realTime.getFullYear();
        let hours = realTime.getHours();
        const minutes = realTime.getMinutes();
        const seconds = realTime.getSeconds();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const newTime = `${month}/${day}/${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
        await client.query('UPDATE employee SET "lastLogout" = $1 WHERE id = $2', [newTime, id]);
        empFixed++;
      }
    }
    console.log(`Reset ${empFixed} employee timestamps\n`);
    
    console.log('=== CLEAN REBUILD COMPLETED ===');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

cleanRebuildTimestamps();
