const { query } = require('../lib/mysql-direct.ts');

async function createActivitiesTable() {
  try {
    console.log('Creating activities table...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS activities (
        id VARCHAR(50) PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        username VARCHAR(100) NOT NULL,
        activity TEXT NOT NULL,
        details TEXT NOT NULL,
        category ENUM('product', 'sale', 'employee', 'system', 'inventory') NOT NULL,
        cabinet VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_timestamp (timestamp),
        INDEX idx_category (category),
        INDEX idx_username (username),
        INDEX idx_cabinet (cabinet)
      )
    `);
    
    console.log('✅ Activities table created successfully!');
    
    // Verify table exists
    const result = await query('SHOW TABLES LIKE "activities"');
    if (result.length > 0) {
      console.log('✅ Table verification passed!');
    } else {
      console.log('❌ Table verification failed!');
    }
    
  } catch (error) {
    console.error('❌ Error creating activities table:', error);
  } finally {
    process.exit(0);
  }
}

createActivitiesTable();
