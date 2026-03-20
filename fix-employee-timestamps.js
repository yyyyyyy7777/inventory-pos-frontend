/**
 * Fix existing employee timestamps to new format
 */

const { query } = require('./lib/pg-direct.ts');

async function fixEmployeeTimestamps() {
  try {
    console.log('Fixing employee timestamps...');
    
    // Get all employees
    const employees = await query('SELECT id, username, "lastLogin", "lastLogout" FROM employee');
    
    for (const emp of employees) {
      console.log(`Processing ${emp.username}:`);
      console.log(`  Current lastLogin: ${emp.lastLogin}`);
      console.log(`  Current lastLogout: ${emp.lastLogout}`);
      
      // Set to empty for now so new login will update with correct format
      await query(
        'UPDATE employee SET "lastLogin" = NULL, "lastLogout" = NULL WHERE username = $1',
        [emp.username]
      );
      
      console.log(`  ✓ Cleared old timestamps for ${emp.username}`);
    }
    
    console.log('✅ All employee timestamps cleared. Login again to set correct times.');
    
  } catch (error) {
    console.error('Error fixing timestamps:', error);
  }
}

fixEmployeeTimestamps();
