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
    
    // Use local timezone dates to match database format
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = monthNum === 12 
      ? new Date(year + 1, 0, 1)
      : new Date(year, monthNum, 1);

    console.log('Date range:', startDate, 'to', endDate);

    // Single optimized query to get all needed statistics
    const result = await query(`
      SELECT 
        -- Overall cabinet stats
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = false) as all_active,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = true) as all_archived,
        COUNT(*) as all_total,
        MIN(date) as earliest_date,
        MAX(date) as latest_date,
        -- Month-specific stats
        COUNT(*) FILTER (WHERE date >= $1::timestamp AND date < $2::timestamp AND COALESCE(archived, false) = false) as active_count,
        COUNT(*) FILTER (WHERE date >= $1::timestamp AND date < $2::timestamp AND COALESCE(archived, false) = true) as archived_count,
        COUNT(*) FILTER (WHERE date >= $1::timestamp AND date < $2::timestamp) as total_count
      FROM sale
      WHERE cabinet = $3
    `, [startDate, endDate, cabinet]);

    console.log('Optimized result:', result[0]);

    return NextResponse.json({
      month,
      cabinet,
      startDate,
      endDate,
      allSales: {
        active: parseInt(result[0].all_active),
        archived: parseInt(result[0].all_archived),
        total: parseInt(result[0].all_total),
        earliestDate: result[0].earliest_date,
        latestDate: result[0].latest_date
      },
      monthSales: {
        activeCount: parseInt(result[0].active_count),
        archivedCount: parseInt(result[0].archived_count),
        totalCount: parseInt(result[0].total_count)
      },
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
