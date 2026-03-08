const mysql = require('mysql2/promise');

async function testArchiveFunction() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'inventory_pos'
    });
    
    console.log('Testing archive function...');
    
    // Test the exact same logic as in the archiveSales function
    const archiveMonth = '2026-02';
    const cabinet = 'main';
    
    // Parse the archive month (format: "YYYY-MM")
    const [year, month] = archiveMonth.split('-').map(Number);
    const archiveDate = new Date(year, month, 1); // First day of the NEXT month
    
    console.log('Archive date:', archiveDate);
    console.log('Archive month:', archiveMonth);
    console.log('Year:', year, 'Month:', month);
    
    // Check if there are any sales to archive
    const [checkResult] = await connection.execute(
      `SELECT COUNT(*) as count FROM Sale WHERE date < ? AND cabinet = ? AND archived = false`,
      [archiveDate, cabinet]
    );
    
    console.log('Sales to archive:', checkResult[0].count);
    
    if (checkResult[0].count === 0) {
      console.log({
        archivedCount: 0,
        message: 'No sales to archive for this month'
      });
      return;
    }
    
    // Update sales that are before the archive date (current month and earlier)
    const result = await connection.execute(
      `UPDATE Sale SET archived = true WHERE date < ? AND cabinet = ? AND archived = false`,
      [archiveDate, cabinet]
    );
    
    console.log({
      archivedCount: result[0].affectedRows || 0
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testArchiveFunction();
