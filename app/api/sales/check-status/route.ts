import { NextResponse } from 'next/server';
import { getAllSalesWithArchiveStatus } from '@/lib/pg-direct';
import { query } from '@/lib/pg-direct';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinet = searchParams.get('cabinet') || 'main';

    console.log('Checking sales status for cabinet:', cabinet);
    
    // Get raw data directly from database
    const rawSales = await query(`
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
    
    console.log('Raw sales from DB:', rawSales.length);
    
    // Get month breakdown
    const monthData = await query(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = false) as active,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = true) as archived,
        COUNT(*) as total
      FROM sale
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month DESC
    `);
    
    // Check specific 2025 months
    const janMarchData = await query(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE COALESCE(archived, false) = true) as archived_count
      FROM sale
      WHERE date >= '2025-01-01' AND date < '2025-04-01'
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month
    `);

    return NextResponse.json({
      cabinet,
      totalSales: rawSales.length,
      hasSales: rawSales.length > 0,
      rawSales: rawSales.slice(0, 20).map(s => ({
        id: s.id.substring(0, 8),
        date: s.date,
        amount: s.amount,
        archived: s.archived,
        cabinet: s.cabinet
      })),
      monthBreakdown: monthData,
      janToMarch2025: janMarchData,
      message: rawSales.length === 0 
        ? 'NO SALES FOUND IN DATABASE' 
        : `Found ${rawSales.length} total sales`
    });
    
  } catch (error: any) {
    console.error('Error checking sales status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check sales status',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
