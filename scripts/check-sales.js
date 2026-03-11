const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkSales() {
  const client = await pool.connect();
  
  try {
    console.log('=== CHECKING SALES TABLE ===\n');
    
    // Check if sale table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sale'
      )
    `);
    console.log('Sale table exists:', tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      console.log('SALE TABLE DOES NOT EXIST!');
      return;
    }
    
    // Get table structure
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sale'
      ORDER BY ordinal_position
    `);
    console.log('\nTable columns:', columns.rows.map(c => c.column_name).join(', '));
    
    // Check for archived column
    const hasArchived = columns.rows.some(c => c.column_name === 'archived');
    console.log('Has archived column:', hasArchived);
    
    // Get total count
    const totalCount = await client.query('SELECT COUNT(*) FROM sale');
    console.log('\nTotal sales in database:', totalCount.rows[0].count);
    
    if (parseInt(totalCount.rows[0].count) === 0) {
      console.log('\n!!! NO SALES FOUND IN DATABASE !!!');
      return;
    }
    
    // Get all sales with dates and archive status
    const allSales = await client.query(`
      SELECT 
        id,
        date,
        amount,
        "paymentMethod",
        "staffName",
        cabinet,
        COALESCE(archived, false) as archived
      FROM sale 
      ORDER BY date DESC
    `);
    
    console.log('\n=== ALL SALES ===');
    console.log('ID | Date | Amount | Payment | Staff | Cabinet | Archived');
    console.log('-'.repeat(100));
    
    for (const sale of allSales.rows) {
      const date = new Date(sale.date).toISOString().split('T')[0];
      console.log(
        `${sale.id.substring(0, 8)}... | ${date} | ${sale.amount} | ${sale.paymentMethod} | ${sale.staffName} | ${sale.cabinet} | ${sale.archived}`
      );
    }
    
    // Group by month
    console.log('\n=== SALES BY MONTH ===');
    const monthCounts = await client.query(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = false) as active,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = true) as archived,
        COUNT(*) as total
      FROM sale
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month DESC
    `);
    
    console.log('Month | Active | Archived | Total');
    console.log('-'.repeat(50));
    for (const row of monthCounts.rows) {
      console.log(`${row.month} | ${row.active} | ${row.archived} | ${row.total}`);
    }
    
    // Check for specific months
    console.log('\n=== CHECKING JAN-MARCH 2025 ===');
    const janMarch = await client.query(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = true) as archived
      FROM sale
      WHERE date >= '2025-01-01' AND date < '2025-04-01'
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month
    `);
    
    if (janMarch.rows.length === 0) {
      console.log('NO SALES FOUND for Jan-March 2025');
    } else {
      for (const row of janMarch.rows) {
        console.log(`${row.month}: ${row.count} sales (${row.archived} archived)`);
      }
    }
    
  } catch (error) {
    console.error('Error checking sales:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSales();
