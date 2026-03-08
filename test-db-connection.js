const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'inventory_pos'
    });
    
    console.log('Testing database connection...');
    
    // Check if Sale table exists and its structure
    const [sales] = await connection.execute('DESCRIBE Sale');
    console.log('Sale table structure:');
    console.table(sales);
    
    // Check if referenceNumber column exists
    const hasReferenceColumn = sales.some(col => col.Field === 'referenceNumber');
    console.log('Has referenceNumber column:', hasReferenceColumn);
    
    if (!hasReferenceColumn) {
      console.log('Adding referenceNumber column...');
      await connection.execute('ALTER TABLE Sale ADD COLUMN referenceNumber VARCHAR(255) NULL');
      console.log('referenceNumber column added successfully');
    }
    
    await connection.end();
    console.log('Database test completed successfully');
  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testConnection();
