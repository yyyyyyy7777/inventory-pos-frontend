const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres.zdhglheplaejejnavfix:TheWheezardPH123@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function createAdmin() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
  });

  try {
    // Check if admin already exists
    const checkResult = await pool.query('SELECT * FROM employee WHERE username = $1', ['admin']);
    
    if (checkResult.rows.length > 0) {
      console.log('Admin user already exists');
      // Update password to ensure it's correct
      await pool.query(
        'UPDATE employee SET password = $1, role = $2, status = $3 WHERE username = $4',
        ['$2b$10$SLpwnbNI65fLOC12U2kPg.8dUNRSFIU9IdVu.RNtYrGMBs.w184/6', 'admin', 'active', 'admin']
      );
      console.log('Admin password updated');
    } else {
      // Create admin user
      await pool.query(
        'INSERT INTO employee (name, username, password, role, status, "joinDate", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())',
        ['Administrator', 'admin', '$2b$10$SLpwnbNI65fLOC12U2kPg.8dUNRSFIU9IdVu.RNtYrGMBs.w184/6', 'admin', 'active']
      );
      console.log('Admin user created successfully');
    }
    
    // Verify
    const verifyResult = await pool.query('SELECT id, name, username, role, status FROM employee WHERE username = $1', ['admin']);
    console.log('Admin user:', verifyResult.rows[0]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

createAdmin();
