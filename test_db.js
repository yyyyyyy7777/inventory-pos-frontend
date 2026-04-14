const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres', ssl: { rejectUnauthorized: false } });
async function test() {
  await client.connect();
  try {
    const res1 = await client.query('SELECT id, name, username, role, "joinDate", "lastLogin", "lastLogout", "createdAt", "updatedAt" FROM employee ORDER BY role ASC, name ASC');
    console.log('Employees:', res1.rowCount);
  } catch (err) {
    console.error('Employees err 1:', err.message);
    try {
      const res2 = await client.query('SELECT id, name, username, role, "joinDate", "createdAt", "updatedAt" FROM employee ORDER BY "createdAt" DESC');
      console.log('Employees 2:', res2.rowCount);
    } catch (e2) {
      console.error('Employees err 2:', e2.message);
    }
  }

  try {
    const ares = await client.query('SELECT * FROM activities ORDER BY timestamp DESC LIMIT 10 OFFSET 0');
    console.log('Activities:', ares.rowCount);
  } catch (e) {
    console.error('Activities err:', e.message);
  }
  
  await client.end();
}
test();
