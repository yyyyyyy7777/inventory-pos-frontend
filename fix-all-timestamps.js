// Fix all timestamps in database to show correct local time
// Run: node fix-all-timestamps.js

const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function fixAllTimestamps() {
  console.log('=== FIXING ALL TIMESTAMPS ===');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected to database\n');
    
    // Fix ACTIVITIES table
    console.log('Fixing ACTIVITIES table...');
    const { rows: activities } = await client.query('SELECT id, timestamp FROM activities');
    console.log(`Found ${activities.length} activities`);
    
    let activitiesFixed = 0;
    for (const activity of activities) {
      const { id, timestamp } = activity;
      
      if (!timestamp || typeof timestamp !== 'string' || timestamp.includes('(UTC+8)')) continue;
      
      // Parse timestamp and convert to Philippines time
      const date = new Date(timestamp);
      const phTime = new Date(date.getTime() - (8 * 60 * 60 * 1000)); // Subtract 8 hours
      
      const hours = phTime.getHours();
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      const newTimestamp = `${phTime.getMonth() + 1}/${phTime.getDate()}/${phTime.getFullYear()}, ${displayHours}:${phTime.getMinutes().toString().padStart(2, '0')}:${phTime.getSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
      
      await client.query('UPDATE activities SET timestamp = $1 WHERE id = $2', [newTimestamp, id]);
      activitiesFixed++;
    }
    console.log(`Fixed ${activitiesFixed} activities\n`);
    
    // Fix EMPLOYEES table
    console.log('Fixing EMPLOYEES table...');
    const { rows: employees } = await client.query('SELECT id, lastlogin, lastlogout FROM employees');
    console.log(`Found ${employees.length} employees`);
    
    let employeesFixed = 0;
    for (const emp of employees) {
      const { id, lastlogin, lastlogout } = emp;
      
      if (lastlogin && typeof lastlogin === 'string' && !lastlogin.includes('(UTC+8)')) {
        const date = new Date(lastlogin);
        const phTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
        const hours = phTime.getHours();
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const newTime = `${phTime.getMonth() + 1}/${phTime.getDate()}/${phTime.getFullYear()}, ${displayHours}:${phTime.getMinutes().toString().padStart(2, '0')}:${phTime.getSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
        await client.query('UPDATE employees SET lastlogin = $1 WHERE id = $2', [newTime, id]);
        employeesFixed++;
      }
      
      if (lastlogout && typeof lastlogout === 'string' && !lastlogout.includes('(UTC+8)')) {
        const date = new Date(lastlogout);
        const phTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
        const hours = phTime.getHours();
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const newTime = `${phTime.getMonth() + 1}/${phTime.getDate()}/${phTime.getFullYear()}, ${displayHours}:${phTime.getMinutes().toString().padStart(2, '0')}:${phTime.getSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
        await client.query('UPDATE employees SET lastlogout = $1 WHERE id = $2', [newTime, id]);
        employeesFixed++;
      }
    }
    console.log(`Fixed ${employeesFixed} employee timestamps\n`);
    
    // Fix SALES table
    console.log('Fixing SALES table...');
    const { rows: sales } = await client.query('SELECT id, date FROM sales');
    console.log(`Found ${sales.length} sales`);
    
    let salesFixed = 0;
    for (const sale of sales) {
      const { id, date } = sale;
      
      if (!date || typeof date !== 'string' || date.includes('(UTC+8)')) continue;
      
      const saleDate = new Date(date);
      const phTime = new Date(saleDate.getTime() - (8 * 60 * 60 * 1000));
      const hours = phTime.getHours();
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      const newDate = `${phTime.getMonth() + 1}/${phTime.getDate()}/${phTime.getFullYear()}, ${displayHours}:${phTime.getMinutes().toString().padStart(2, '0')}:${phTime.getSeconds().toString().padStart(2, '0')} ${ampm} (UTC+8)`;
      
      await client.query('UPDATE sales SET date = $1 WHERE id = $2', [newDate, id]);
      salesFixed++;
    }
    console.log(`Fixed ${salesFixed} sales timestamps\n`);
    
    console.log('=== ALL TIMESTAMPS FIXED ===');
    console.log(`Activities: ${activitiesFixed}`);
    console.log(`Employees: ${employeesFixed}`);
    console.log(`Sales: ${salesFixed}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixAllTimestamps();
