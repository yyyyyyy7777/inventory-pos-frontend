import { NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { month, cabinet } = body;

    console.log('=== ARCHIVE STATUS CHECK ===');
    console.log('Received month:', month);
    console.log('Received cabinet:', cabinet);

    if (!month || !cabinet) {
      return NextResponse.json(
        { error: 'Month and cabinet are required' },
        { status: 400 }
      );
    }

    // Parse month (format: "YYYY-MM")
    const [year, monthNum] = month.split('-').map(Number);
    console.log('Parsed year:', year, 'month:', monthNum);
    
    // Build date range using ISO strings
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00.000Z`;
    const endDate = monthNum === 12 
      ? `${year + 1}-01-01T00:00:00.000Z`
      : `${year}-${String(monthNum + 1).padStart(2, '0')}-01T00:00:00.000Z`;

    console.log('Date range:', startDate, 'to', endDate);

    // First, let's see ALL sales for this cabinet (no date filter)
    const allSalesCheck = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = false) as all_active,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = true) as all_archived,
        COUNT(*) as all_total,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM sale
      WHERE cabinet = $1
    `, [cabinet]);

    console.log('All sales for cabinet:', allSalesCheck[0]);

    // Query database directly for counts with date filter
    const result = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = false) as active_count,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = true) as archived_count,
        COUNT(*) as total_count
      FROM sale
      WHERE date >= $1::timestamp 
        AND date < $2::timestamp 
        AND cabinet = $3
    `, [startDate, endDate, cabinet]);

    console.log('Month-specific result:', result[0]);

    // Let's also check what sales exist in this date range
    const sampleSales = await query(`
      SELECT id, date, COALESCE(archived, false) as archived, amount
      FROM sale
      WHERE date >= $1::timestamp 
        AND date < $2::timestamp 
        AND cabinet = $3
      LIMIT 10
    `, [startDate, endDate, cabinet]);

    console.log('Sample sales in range:', sampleSales);

    return NextResponse.json({
      month,
      cabinet,
      startDate,
      endDate,
      allSales: {
        active: parseInt(allSalesCheck[0].all_active),
        archived: parseInt(allSalesCheck[0].all_archived),
        total: parseInt(allSalesCheck[0].all_total),
        earliestDate: allSalesCheck[0].earliest_date,
        latestDate: allSalesCheck[0].latest_date
      },
      monthSales: {
        activeCount: parseInt(result[0].active_count),
        archivedCount: parseInt(result[0].archived_count),
        totalCount: parseInt(result[0].total_count)
      },
      sampleSales: sampleSales,
      hasArchived: parseInt(result[0].archived_count) > 0,
      hasActive: parseInt(result[0].active_count) > 0
    });
    
  } catch (error: any) {
    console.error('Error checking archive status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check archive status',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
