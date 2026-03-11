import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinet = searchParams.get('cabinet') || 'main';
    const period = searchParams.get('period') || 'weekly';

    console.log('Analytics API called with cabinet:', cabinet, 'period:', period);
    
    // Use database-level aggregation for better performance
    const analytics = await generateAnalyticsFromDB(cabinet, period);
    
    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error.message },
      { status: 500 }
    );
  }
}

async function generateAnalyticsFromDB(cabinet: string, period: string) {
  const now = new Date();
  let startDate: Date;
  let dateFormat: string;
  let groupBy: string;

  switch (period) {
    case 'weekly':
      startDate = startOfWeek(now);
      dateFormat = 'EEE';
      groupBy = 'day';
      break;
    case 'monthly':
      startDate = startOfMonth(now);
      dateFormat = 'MMM dd';
      groupBy = 'day';
      break;
    case 'quarterly':
      startDate = subMonths(now, 3);
      dateFormat = 'MMM';
      groupBy = 'month';
      break;
    case 'yearly':
      startDate = subMonths(now, 12);
      dateFormat = 'MMM';
      groupBy = 'month';
      break;
    default:
      startDate = startOfWeek(now);
      dateFormat = 'EEE';
      groupBy = 'day';
  }

  // Use a single optimized query to get summary metrics
  const summaryQuery = await query(`
    SELECT 
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(*) as total_transactions,
      COALESCE(SUM(item_count), 0) as total_items,
      COALESCE(AVG(amount), 0) as avg_transaction_value
    FROM (
      SELECT s.id, s.amount, COUNT(si.id) as item_count
      FROM sale s
      LEFT JOIN "saleItem" si ON s.id = si."saleId"
      WHERE s.cabinet = $1 
        AND s.archived = false
        AND s.date >= $2::timestamp
      GROUP BY s.id, s.amount
    ) subq
  `, [cabinet, startDate]);

  // Get today's metrics with a separate query
  const today = startOfDay(now);
  const todayQuery = await query(`
    SELECT 
      COALESCE(SUM(amount), 0) as today_revenue,
      COUNT(*) as today_transactions,
      COALESCE(SUM(item_count), 0) as today_items
    FROM (
      SELECT s.id, s.amount, COUNT(si.id) as item_count
      FROM sale s
      LEFT JOIN "saleItem" si ON s.id = si."saleId"
      WHERE s.cabinet = $1 
        AND s.archived = false
        AND s.date >= $2::timestamp 
        AND s.date <= $3::timestamp
      GROUP BY s.id, s.amount
    ) subq
  `, [cabinet, today, endOfDay(now)]);

  // Get revenue data grouped by period using database aggregation
  const revenueDataQuery = await query(`
    SELECT 
      CASE 
        WHEN $3 = 'day' THEN TO_CHAR(date, 'Dy')
        ELSE TO_CHAR(date, 'Mon')
      END as period,
      COALESCE(SUM(amount), 0) as revenue,
      COUNT(*) as transactions,
      COALESCE(SUM(item_count), 0) as items
    FROM (
      SELECT s.id, s.amount, s.date, COUNT(si.id) as item_count
      FROM sale s
      LEFT JOIN "saleItem" si ON s.id = si."saleId"
      WHERE s.cabinet = $1 
        AND s.archived = false
        AND s.date >= $2::timestamp
      GROUP BY s.id, s.amount, s.date
    ) subq
    GROUP BY 
      CASE 
        WHEN $3 = 'day' THEN TO_CHAR(date, 'Dy')
        ELSE TO_CHAR(date, 'Mon')
      END
    ORDER BY MIN(date)
  `, [cabinet, startDate, groupBy]);

  // Get top products using database aggregation
  const topProductsQuery = await query(`
    SELECT 
      si."productName" as name,
      COUNT(*) as sales,
      SUM(si.quantity) as quantity,
      SUM(si.price * si.quantity) as revenue
    FROM sale s
    JOIN "saleItem" si ON s.id = si."saleId"
    WHERE s.cabinet = $1 
      AND s.archived = false
      AND s.date >= $2::timestamp
    GROUP BY si."productName"
    ORDER BY revenue DESC
    LIMIT 5
  `, [cabinet, startDate]);

  // Calculate growth by comparing with previous period
  const previousPeriodStart = subDays(startDate, 7);
  const previousRevenueQuery = await query(`
    SELECT COALESCE(SUM(amount), 0) as previous_revenue
    FROM sale
    WHERE cabinet = $1 
      AND archived = false
      AND date >= $2::timestamp 
      AND date < $3::timestamp
  `, [cabinet, previousPeriodStart, startDate]);

  const totalRevenue = parseFloat(summaryQuery[0]?.total_revenue || 0);
  const previousRevenue = parseFloat(previousRevenueQuery[0]?.previous_revenue || 0);
  const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  return {
    summary: {
      totalRevenue,
      totalTransactions: parseInt(summaryQuery[0]?.total_transactions || 0),
      totalItems: parseInt(summaryQuery[0]?.total_items || 0),
      avgTransactionValue: parseFloat(summaryQuery[0]?.avg_transaction_value || 0),
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      todayRevenue: parseFloat(todayQuery[0]?.today_revenue || 0),
      todayTransactions: parseInt(todayQuery[0]?.today_transactions || 0),
      todayItems: parseInt(todayQuery[0]?.today_items || 0)
    },
    revenueData: revenueDataQuery.map((row: any) => ({
      period: row.period,
      revenue: parseFloat(row.revenue),
      sales: parseFloat(row.revenue),
      transactions: parseInt(row.transactions),
      items: parseInt(row.items)
    })),
    topProducts: topProductsQuery.map((row: any) => ({
      name: row.name,
      sales: parseInt(row.sales),
      revenue: parseFloat(row.revenue),
      quantity: parseInt(row.quantity)
    })),
    period,
    generatedAt: now.toISOString()
  };
}
