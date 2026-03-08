const { query } = require('../lib/mysql-direct.ts');

async function restoreAdminNow() {
  try {
    console.log('Restoring admin user...');
    
    // Check if admin already exists
    const existingAdmin = await query(
      'SELECT * FROM employees WHERE id = 0 OR username = "admin"'
    );
    
    if (existingAdmin.length > 0) {
      console.log('Admin user already exists:', existingAdmin[0]);
      return;
    }
    
    // Restore admin user
    await query(`
      INSERT INTO employees (
        id, name, username, password, role, status, joinDate
      ) VALUES (
        0, 'Administrator', 'admin', 'admin123', 'admin', 'active', CURDATE()
      )
    `);
    
    // Verify restoration
    const restoredAdmin = await query(
      'SELECT * FROM employees WHERE id = 0'
    );
    
    console.log('✅ Admin user restored successfully!');
    console.log('Login details:');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Restored admin:', restoredAdmin[0]);
    
  } catch (error) {
    console.error('❌ Error restoring admin:', error);
  } finally {
    process.exit(0);
  }
}

restoreAdminNow();
