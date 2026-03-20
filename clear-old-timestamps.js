const { query } = require('./lib/pg-direct.ts');

async function clearTimestamps() {
  try {
    console.log('Clearing all old timestamps...');
    
    // Clear all lastLogin and lastLogout
    await query('UPDATE employee SET "lastLogin" = NULL, "lastLogout" = NULL');
    
    console.log('✅ All timestamps cleared. Login again to set correct times.');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

clearTimestamps();
