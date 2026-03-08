import { NextRequest, NextResponse } from 'next/server';
import { getAllSales } from '@/lib/pg-direct';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinet = searchParams.get('cabinet') || 'main';
    const period = searchParams.get('period') || 'weekly'; // weekly, monthly, quarterly, yearly

    console.log('Analytics API called with cabinet:', cabinet, 'period:', period);
    
    const sales = await getAllSales(cabinet);
    console.log('getAllSales returned', sales.length, 'sales');
    
    if (sales.length === 0) {
      // Return default empty analytics data
      return NextResponse.json({
        summary: {
          totalRevenue: 0,
          totalTransactions: 0,
          totalItems: 0,
          avgTransactionValue: 0,
          revenueGrowth: 0,
          todayRevenue: 0,
          todayTransactions: 0,
          todayItems: 0
        },
        revenueData: [],
        topProducts: [],
        period,
        generatedAt: new Date().toISOString()
      });
    }
    
    // Process sales data for analytics
    const analytics = processSalesData(sales, period);
    
    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error.message },
      { status: 500 }
    );
  }
}

function processSalesData(sales: any[], period: string) {
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

  // Filter sales by date range
  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt || sale.date);
    return saleDate >= startDate && saleDate <= now;
  });

  // Group sales by period
  const groupedSales = filteredSales.reduce((acc: any, sale) => {
    const saleDate = new Date(sale.createdAt || sale.date);
    let key: string;
    
    switch (groupBy) {
      case 'day':
        key = format(saleDate, dateFormat);
        break;
      case 'month':
        key = format(saleDate, dateFormat);
        break;
      default:
        key = format(saleDate, dateFormat);
    }

    if (!acc[key]) {
      acc[key] = {
        period: key,
        revenue: 0,
        sales: 0,
        transactions: 0,
        items: 0
      };
    }

    acc[key].revenue += parseFloat(sale.amount) || 0;
    acc[key].sales += parseFloat(sale.amount) || 0;
    acc[key].transactions += 1;
    acc[key].items += sale.items?.length || 0;

    return acc;
  }, {});

  // Convert to array and sort by date
  const revenueData = Object.values(groupedSales);

  // Calculate top selling products
  const productSales = new Map();
  
  filteredSales.forEach(sale => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item: any) => {
        const productName = item.productName || 'Unknown';
        const existing = productSales.get(productName) || { name: productName, sales: 0, revenue: 0, quantity: 0 };
        existing.sales += 1;
        existing.revenue += (item.price || 0) * (item.quantity || 1);
        existing.quantity += item.quantity || 1;
        productSales.set(productName, existing);
      });
    }
  });

  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  // Calculate summary metrics
  const totalRevenue = parseFloat(filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.amount) || 0), 0).toFixed(2));
  const totalTransactions = filteredSales.length;
  const totalItems = filteredSales.reduce((sum, sale) => sum + (sale.items?.length || 0), 0);
  const avgTransactionValue = totalTransactions > 0 ? parseFloat((totalRevenue / totalTransactions).toFixed(2)) : 0;

  // Calculate growth (compare with previous period)
  const previousPeriodStart = subDays(startDate, 7);
  const previousSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt || sale.date);
    return saleDate >= previousPeriodStart && saleDate < startDate;
  });
  
  const previousRevenue = previousSales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
  const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  // Today's metrics
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);
  const todaySales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt || sale.date);
    return saleDate >= today && saleDate <= todayEnd;
  });

  const todayRevenue = parseFloat(todaySales.reduce((sum, sale) => sum + (parseFloat(sale.amount) || 0), 0).toFixed(2));
  const todayTransactions = todaySales.length;
  const todayItems = todaySales.reduce((sum, sale) => sum + (sale.items?.length || 0), 0);

  return {
    summary: {
      totalRevenue,
      totalTransactions,
      totalItems,
      avgTransactionValue,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      todayRevenue,
      todayTransactions,
      todayItems
    },
    revenueData,
    topProducts,
    period,
    generatedAt: now.toISOString()
  };
}
