import { NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinet = searchParams.get('cabinet') || 'main';

    console.log('Getting all sales for recovery, cabinet:', cabinet);

    // Get all sales including archived
    const sales = await query(`
      SELECT 
        id,
        date,
        amount,
        "paymentMethod",
        "staffName",
        cabinet,
        "soldAt",
        COALESCE(archived, false) as archived,
        "referenceNumber",
        "createdAt"
      FROM sale 
      WHERE cabinet = $1
      ORDER BY date DESC
    `, [cabinet]);

    // Get stats
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = false) as active,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = true) as archived,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM sale
      WHERE cabinet = $1
    `, [cabinet]);

    console.log(`Found ${sales.length} total sales (${stats[0].archived} archived)`);

    return NextResponse.json({
      cabinet,
      sales,
      stats: {
        total: parseInt(stats[0].total),
        active: parseInt(stats[0].active),
        archived: parseInt(stats[0].archived),
        earliestDate: stats[0].earliest_date,
        latestDate: stats[0].latest_date
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching all sales:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sales',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
