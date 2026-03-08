const { query } = require('./lib/mysql-direct.ts');

async function checkStockAddition() {
  try {
    console.log('Checking stockaddition table...');
    const rows = await query('SELECT * FROM stockaddition LIMIT 5');
    console.log('Stock addition records:', rows.length, 'records found');
    if (rows.length > 0) {
      console.log('Sample record:', rows[0]);
    }
    
    console.log('\nChecking product table...');
    const products = await query('SELECT id, name, stock FROM product LIMIT 3');
    console.log('Products:', products.length, 'records found');
    if (products.length > 0) {
      console.log('Sample product:', products[0]);
    }
    
    console.log('\nChecking last restock query...');
    const restockQuery = `
      SELECT productId, MAX(addedDate) as lastRestockDate
      FROM stockaddition 
      WHERE cabinet = 'main'
      GROUP BY productId
      LIMIT 5
    `;
    const restockRows = await query(restockQuery);
    console.log('Restock query results:', restockRows);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkStockAddition();
