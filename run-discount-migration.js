const mysql = require('mysql2/promise');

async function runMigration() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_pos'
    });
    
    console.log('Connected to database');
    
    // Check if columns already exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'SaleItem'
    `, [process.env.DB_NAME || 'inventory_pos']);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('Existing columns:', existingColumns);
    
    // Add originalPrice column if it doesn't exist
    if (!existingColumns.includes('originalPrice')) {
      await connection.execute('ALTER TABLE SaleItem ADD COLUMN originalPrice DECIMAL(10, 2) NULL');
      console.log('✅ Added originalPrice column');
    } else {
      console.log('ℹ️ originalPrice column already exists');
    }
    
    // Add costPrice column if it doesn't exist
    if (!existingColumns.includes('costPrice')) {
      await connection.execute('ALTER TABLE SaleItem ADD COLUMN costPrice DECIMAL(10, 2) NULL');
      console.log('✅ Added costPrice column');
    } else {
      console.log('ℹ️ costPrice column already exists');
    }
    
    // Add isDiscounted column if it doesn't exist
    if (!existingColumns.includes('isDiscounted')) {
      await connection.execute('ALTER TABLE SaleItem ADD COLUMN isDiscounted BOOLEAN DEFAULT FALSE');
      console.log('✅ Added isDiscounted column');
    } else {
      console.log('ℹ️ isDiscounted column already exists');
    }
    
    // Add profit column if it doesn't exist
    if (!existingColumns.includes('profit')) {
      await connection.execute('ALTER TABLE SaleItem ADD COLUMN profit DECIMAL(10, 2) NULL');
      console.log('✅ Added profit column');
    } else {
      console.log('ℹ️ profit column already exists');
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
