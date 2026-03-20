// Subtract 8 hours from all timestamps - SIMPLE FIX
const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function subtract8Hours() {
  console.log('=== SUBTRACTING 8 HOURS FROM ALL TIMESTAMPS ===');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Fix ACTIVITIES - subtract 8 hours
    console.log('Subtracting 8 hours from ACTIVITIES...');
    const { rows: activities } = await client.query('SELECT id, timestamp FROM activities');
    console.log(`Found ${activities.length} activities`);
    
    for (const activity of activities) {
      const { id, timestamp } = activity;
      
      if (!timestamp) continue;
      
      // Parse and subtract 8 hours
      const date = new Date(timestamp);
      const adjustedTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
      
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
      
      if (activities.length <= 5) {
        console.log(`Fixed: ${timestamp} → ${newTimestamp}`);
      }
    }
    console.log(`Fixed ${activities.length} activities\n`);
    
    // Fix EMPLOYEE login/logout - subtract 8 hours
    console.log('Subtracting 8 hours from EMPLOYEE timestamps...');
    const { rows: employees } = await client.query('SELECT id, username, "lastLogin", "lastLogout" FROM employee');
    console.log(`Found ${employees.length} employees`);
    
    for (const emp of employees) {
      const { id, username, lastLogin, lastLogout } = emp;
      
      if (lastLogin) {
        const date = new Date(lastLogin);
        const adjustedTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
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
      }
      
      if (lastLogout) {
        const date = new Date(lastLogout);
        const adjustedTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
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
      }
    }
    console.log(`Fixed employee timestamps\n`);
    
    console.log('=== 8 HOURS SUBTRACTED FROM EVERYTHING ===');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

subtract8Hours();
