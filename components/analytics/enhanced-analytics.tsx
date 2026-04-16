"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts"
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Package, 
  Users,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle
} from "lucide-react"
import { useProducts } from "@/contexts/products-context"
import { useSales, SaleItem } from "@/contexts/sales-context"
import { db } from "@/lib/indexeddb"
import { countUnitsInSale } from "@/lib/sale-metrics"
import {
  summarizeSalesForPeriod,
  parseSaleDate,
  finalizeSaleRowsForTable,
  type SalesPeriodFilter,
} from "@/lib/analytics-from-sales"
import { getPhilippineDayBounds } from "@/lib/philippine-time"
import { PesoIcon } from "@/components/ui/peso-icon"

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    totalItems: number;
    avgTransactionValue: number;
    revenueGrowth: number;
    todayRevenue: number;
    todayTransactions: number;
    todayItems: number;
  };
  revenueData: Array<{
    period: string;
    revenue: number;
    sales: number;
    transactions: number;
    items: number;
  }>;
  topProducts: Array<{
    name: string;
    sales: number;
    revenue: number;
    quantity: number;
  }>;
  period: string;
  generatedAt: string;
}

interface EnhancedAnalyticsProps {
  cabinet: string
  username?: string
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

const formatCurrency = (amount: number | null | undefined) => {
  const num = typeof amount === 'number' ? amount : parseFloat(amount as any) || 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const MetricCard = ({ 
  title, 
  value, 
  change, 
  changeType, 
  icon, 
  description,
  color = "primary"
}: {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ReactNode;
  description?: string;
  color?: "primary" | "green" | "blue" | "indigo" | "purple" | "orange" | "red" | "maroon";
}) => {
  const getColorClasses = () => {
    switch (color) {
      case "green":
        return "bg-gradient-to-br from-[oklch(0.25_0.15_145)] to-[oklch(0.35_0.18_145)] border-[oklch(0.3_0.12_145)] text-white";
      case "blue":
        return "bg-gradient-to-br from-[oklch(0.25_0.15_280)] to-[oklch(0.35_0.18_280)] border-[oklch(0.3_0.12_280)] text-white";
      case "orange":
        return "bg-gradient-to-br from-[oklch(0.6_0.15_85)] to-[oklch(0.7_0.12_90)] border-[oklch(0.65_0.1_87)] text-white";
      case "maroon":
        return "bg-gradient-to-br from-[oklch(0.3_0.15_25)] to-[oklch(0.4_0.12_30)] border-[oklch(0.35_0.1_27)] text-white";
      case "red":
        return "bg-gradient-to-br from-red-50 to-red-100 border-red-200 text-red-900";
      default:
        return "bg-gradient-to-br from-violet-50 to-purple-100 border-violet-200 text-violet-900";
    }
  };

  const getIconBg = () => {
    switch (color) {
      case "green":
        return "bg-[oklch(0.5_0.15_145)] text-white";
      case "blue":
        return "bg-[oklch(0.5_0.15_280)] text-white";
      case "orange":
        return "bg-[oklch(0.65_0.12_85)] text-white";
      case "maroon":
        return "bg-[oklch(0.55_0.1_25)] text-white";
      case "red":
        return "bg-red-200 text-red-700";
      default:
        return "bg-violet-200 text-violet-700";
    }
  };

  const getChangeColor = () => {
    if (changeType === 'increase') return 'text-green-600';
    if (changeType === 'decrease') return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = () => {
    if (changeType === 'increase') return <ArrowUpRight className="h-4 w-4" />;
    if (changeType === 'decrease') return <ArrowDownRight className="h-4 w-4" />;
    return null;
  };

  return (
    <Card className={`relative overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all duration-300 ${getColorClasses()}`}>
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full" />
      <CardContent className="pt-4 sm:pt-6 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 sm:space-y-2 flex-1">
            <p className="text-xs sm:text-sm font-medium uppercase tracking-wide opacity-80">
              {title}
            </p>
            <p className="text-2xl sm:text-3xl font-bold">
              {value}
            </p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 ${getChangeColor()}`}>
                {getChangeIcon()}
                <span className="text-sm font-medium">
                  {Math.abs(change)}%
                </span>
                <span className="text-xs opacity-70">
                  vs last period
                </span>
          </div>
            )}
            {description && (
              <p className="text-xs opacity-70">
                {description}
              </p>
            )}
      </div>
          <div className={`rounded-full p-2 sm:p-3 ${getIconBg()} flex-shrink-0`}>
            <div className="h-5 w-5 sm:h-6 sm:w-6">
              {icon}
        </div>
      </div>
    </div>
      </CardContent>
    </Card>
  );
};

export function EnhancedAnalytics({ cabinet, username }: EnhancedAnalyticsProps) {
  const isSaleArchived = (value: unknown) =>
    value === true || value === "true" || value === 1 || value === "1";

  // Ensure cabinet has a stable default value to prevent useEffect dependency issues
  const cabinetValue = cabinet || 'all';
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<"weekly" | "monthly" | "quarterly" | "annually" | "all">("weekly");
  const { getProductsByCabinet, loading: productsLoading } = useProducts();
  const { sales, loading: salesLoading } = useSales();
  const [todaySalesData, setTodaySalesData] = useState<{ revenue: number; transactions: number; items: number }>({ revenue: 0, transactions: 0, items: 0 });
  const [todaySalesLoading, setTodaySalesLoading] = useState(false);
  const [periodSummaryData, setPeriodSummaryData] = useState<{ revenue: number; transactions: number; items: number; avgTransactionValue: number }>({ revenue: 0, transactions: 0, items: 0, avgTransactionValue: 0 });

  // Unified data source for consistent transaction filtering - defined first
  const getUnifiedTransactions = async (dateRange?: { start: Date, end: Date }) => {
    try {
      console.log('Getting unified transactions for analytics...');
      
      // Use same data source as sales tab for consistency
      const filteredSales = cabinetValue === 'all' 
        ? sales.filter((sale) => !isSaleArchived((sale as any).archived))
        : sales.filter((sale) => sale.cabinet === cabinetValue && !isSaleArchived((sale as any).archived));
      
      // Filter by date range if provided ([start, end) — same as Sales tab "today" / PH day bounds)
      let finalSales = filteredSales;
      if (dateRange) {
        finalSales = filteredSales.filter((sale) => {
          try {
            const saleDate = parseSaleDate(
              String(sale.date || sale.createdAt || sale.soldAt || "")
            );
            if (Number.isNaN(saleDate.getTime())) return false;
            return saleDate >= dateRange.start && saleDate < dateRange.end;
          } catch {
            return false;
          }
        });
      }

      const deduped = finalizeSaleRowsForTable(finalSales as any);

      console.log(`Unified transactions: ${deduped.length} total after filtering`);
      return deduped;
      
    } catch (error) {
      console.error('Error getting unified transactions:', error);
      return [];
    }
  };

  // Generate analytics from local IndexedDB data for offline mode
  const generateOfflineAnalytics = async () => {
    try {
      console.log('Generating analytics from local IndexedDB data...');
      
      // Use same data source as sales tab for consistency
      const filteredSales = cabinetValue === 'all' 
        ? sales.filter((sale) => !isSaleArchived((sale as any).archived))
        : sales.filter((sale) => sale.cabinet === cabinetValue && !isSaleArchived((sale as any).archived));
      
      const {
        revenue: totalRevenue,
        transactions: totalTransactions,
        items: totalItems,
        periodSales,
      } = summarizeSalesForPeriod(filteredSales, cabinetValue, timePeriod as SalesPeriodFilter);
      const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
      
      // Generate revenue data for charts with period-aware grouping
      const revenueData: Array<{
        period: string;
        revenue: number;
        sales: number;
        transactions: number;
        items: number;
      }> = [];
      const periodBuckets = new Map<string, { label: string; revenue: number; sales: number; transactions: number; items: number }>();

      const getPeriodBucket = (saleDate: Date) => {
        if (timePeriod === 'all') {
          const key = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
          const label = saleDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          return { key, label };
        }
        if (timePeriod === 'weekly') {
          // Group by week start (Sunday) for weekly trend.
          const start = new Date(saleDate);
          start.setDate(start.getDate() - start.getDay());
          start.setHours(0, 0, 0, 0);
          const key = start.toISOString();
          const label = `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          return { key, label };
        }

        if (timePeriod === 'monthly') {
          // Group by month for monthly trend.
          const key = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
          const label = `Month of ${saleDate.toLocaleDateString('en-US', { month: 'long' })}`;
          return { key, label };
        }

        if (timePeriod === 'quarterly') {
          // Group by quarter labels (Q1..Q4) for the selected range.
          const quarter = Math.floor(saleDate.getMonth() / 3) + 1;
          const start = new Date(saleDate.getFullYear(), (quarter - 1) * 3, 1);
          const key = start.toISOString();
          const label = `Q${quarter} ${saleDate.getFullYear()}`;
          return { key, label };
        }

        // annually: group by year
        const start = new Date(saleDate.getFullYear(), 0, 1);
        const key = start.toISOString();
        const label = `${saleDate.getFullYear()}`;
        return { key, label };
      };
      
      periodSales.forEach(sale => {
        try {
          const dateField = sale.date || sale.createdAt;
          if (!dateField) return;
          const saleDate = new Date(dateField);
          const { key, label } = getPeriodBucket(saleDate);

          if (!periodBuckets.has(key)) {
            periodBuckets.set(key, { label, revenue: 0, sales: 0, transactions: 0, items: 0 });
          }
          
          const bucketData = periodBuckets.get(key);
          if (!bucketData) return;
          const amount = typeof sale.amount === 'number' ? sale.amount : parseFloat(sale.amount) || 0;
          bucketData.revenue += amount;
          bucketData.sales += 1;
          bucketData.transactions += 1;
          bucketData.items += countUnitsInSale(sale);
        } catch (err) {
          console.warn('Error processing sale for revenue data:', err);
        }
      });
      
      // Convert map to array and sort chronologically by bucket key
      Array.from(periodBuckets.entries())
        .sort(([keyA], [keyB]) => new Date(keyA).getTime() - new Date(keyB).getTime())
        .forEach(([, data]) => {
        revenueData.push({
          period: data.label,
          revenue: data.revenue,
          sales: data.sales,
          transactions: data.transactions,
          items: data.items
        });
      });
      
      // Generate top products
      const productSales = new Map();
      periodSales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach((item: any) => {
            const productName = item.productName || item.name || 'Unknown Product';
            if (!productSales.has(productName)) {
              productSales.set(productName, { quantity: 0, revenue: 0 });
            }
            const productData = productSales.get(productName);
            productData.quantity += item.quantity || 1;
            productData.revenue += (item.price || 0) * (item.quantity || 1);
          });
        }
      });
      
      const topProducts = Array.from(productSales.entries())
        .map(([name, data]) => ({ 
          name, 
          quantity: data.quantity, 
          revenue: data.revenue,
          sales: data.quantity // Use quantity as sales count (number of times sold)
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3);
      
      const analyticsData = {
        summary: {
          totalRevenue,
          totalTransactions,
          totalItems,
          avgTransactionValue,
          revenueGrowth: 0, // Can't calculate growth without historical data
          todayRevenue: 0, // Not available in offline analytics
          todayTransactions: 0, // Not available in offline analytics  
          todayItems: 0 // Not available in offline analytics
        },
        revenueData,
        topProducts,
        period: timePeriod,
        generatedAt: new Date().toISOString(),
        _isOffline: true
      };
      
      console.log('Generated offline analytics:', analyticsData);
      return analyticsData;
      
    } catch (error) {
      console.error('Error generating offline analytics:', error);
      return null;
    }
  };

  // fetchAnalytics function - always use client-side data to match sales tab
  const fetchAnalytics = useCallback(async (isPeriodChange = false) => {
    try {
      if (isPeriodChange) {
        setPeriodLoading(true);
      } else {
        setAnalyticsLoading(true);
      }
      setError(null);
      
      console.log('Generating analytics from client-side data (same as sales tab)');
      
      // Always use client-side data to match sales tab
      const clientAnalytics = await generateOfflineAnalytics();
      if (clientAnalytics) {
        setAnalyticsData(clientAnalytics);
        setPeriodSummaryData({
          revenue: clientAnalytics.summary.totalRevenue,
          transactions: clientAnalytics.summary.totalTransactions,
          items: clientAnalytics.summary.totalItems,
          avgTransactionValue: clientAnalytics.summary.avgTransactionValue
        });
        
        console.log('Client-side analytics generated successfully');
      } else {
        throw new Error('Failed to generate analytics from client data');
      }
    } catch (error) {
      console.error('Error generating analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics');
      const cacheKey = `cached_analytics_${cabinetValue}_${timePeriod}_v2`;
      const cachedAnalytics = localStorage.getItem(cacheKey);
      if (cachedAnalytics) {
        try {
          const data = JSON.parse(cachedAnalytics);
          setAnalyticsData(data);
          setError(null); // Clear error since we have cached data
        } catch (cacheErr) {
          console.error('Error loading cached analytics as fallback:', cacheErr);
        }
      }
    } finally {
      setAnalyticsLoading(false);
      setPeriodLoading(false);
    }
  }, [cabinetValue, timePeriod, sales]);

  // calculateTodaySales function - defined before useEffect that uses it
  const calculateTodaySales = useCallback(async () => {
    // Prevent multiple simultaneous calculations
    if (todaySalesLoading) {
      console.log('Today sales calculation already in progress, skipping...');
      return;
    }

    setTodaySalesLoading(true);
    console.log('Starting Today sales calculation with unified data source...');
    try {
      const { start: today, end: tomorrow } = getPhilippineDayBounds(new Date());

      console.log('Date range:', { today: today.toISOString(), tomorrow: tomorrow.toISOString() });
      console.log('Cabinet filter:', cabinetValue);
      console.log('Online status:', navigator.onLine);

      // Use unified data source for consistency
      const todaySales = await getUnifiedTransactions({ start: today, end: tomorrow });

      // Use persisted sale.amount so dashboard matches Sales tab totals exactly
      // (includes VAT when VAT is enabled at checkout).
      const todayRevenue = todaySales.reduce((sum: number, sale: any) => {
        const saleAmount = typeof sale.amount === 'number' ? sale.amount : parseFloat(String(sale.amount)) || 0;
        return sum + saleAmount;
      }, 0);
      const todayTransactions = todaySales.length;
      const todayItems = todaySales.reduce((sum: number, sale: any) => sum + countUnitsInSale(sale), 0);

      console.log('Today sales calculated with unified data source:', {
        revenue: todayRevenue,
        transactions: todayTransactions,
        items: todayItems,
        dataSource: 'Unified (IndexedDB + Context)'
      });

      setTodaySalesData({
        revenue: todayRevenue,
        transactions: todayTransactions,
        items: todayItems
      });

    } catch (error) {
      console.error('Error calculating today\'s sales:', error);
      setTodaySalesData({ revenue: 0, transactions: 0, items: 0 });
    } finally {
      setTodaySalesLoading(false);
      console.log('Today sales calculation completed');
    }
  }, [cabinetValue, sales]); // Add sales dependency for real-time updates

  // Event listeners useEffect - now all functions are defined before this
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleNewTransaction = (event: CustomEvent) => {
      console.log('New transaction detected, updating analytics:', event.detail);
      // Immediately update today's sales for real-time feedback
      calculateTodaySales();
      // Update analytics if online, otherwise regenerate offline analytics
      if (navigator.onLine) {
        fetchAnalytics();
      } else {
        generateOfflineAnalytics().then(data => {
          if (data) {
            setAnalyticsData(data);
            setPeriodSummaryData({
              revenue: data.summary.totalRevenue,
              transactions: data.summary.totalTransactions,
              items: data.summary.totalItems,
              avgTransactionValue: data.summary.avgTransactionValue
            });
          }
        });
      }
    };

    const handleSyncComplete = (event: CustomEvent) => {
      console.log('Sync completed, refreshing analytics:', event.detail);
      // Full refresh after sync to ensure data consistency
      fetchAnalytics();
      calculateTodaySales();
    };

    const handleOnlineStatusChange = () => {
      console.log('Online status changed, refreshing analytics:', navigator.onLine);
      if (navigator.onLine) {
        // When coming back online, fetch fresh data
        fetchAnalytics();
        calculateTodaySales();
      } else {
        // When going offline, generate from local data
        generateOfflineAnalytics().then(data => {
          if (data) {
            setAnalyticsData(data);
            setPeriodSummaryData({
              revenue: data.summary.totalRevenue,
              transactions: data.summary.totalTransactions,
              items: data.summary.totalItems,
              avgTransactionValue: data.summary.avgTransactionValue
            });
          }
        });
      }
    };

    // Register event listeners
    window.addEventListener('newTransaction', handleNewTransaction as EventListener);
    window.addEventListener('syncComplete', handleSyncComplete as EventListener);
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('newTransaction', handleNewTransaction as EventListener);
      window.removeEventListener('syncComplete', handleSyncComplete as EventListener);
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, [calculateTodaySales, fetchAnalytics]);

  // Fetch analytics on component mount, when cabinet / period / sales data changes
  useEffect(() => {
    // Avoid rendering "0" analytics while core data is still loading on first load.
    if (productsLoading || salesLoading) return;
    fetchAnalytics();
  }, [fetchAnalytics, productsLoading, salesLoading]);

  // Recalculate today's sales when cabinet or sales list changes
  useEffect(() => {
    calculateTodaySales();
  }, [calculateTodaySales]);

  // Get low stock products (available immediately from context)
  const products = getProductsByCabinet(cabinetValue);
  const lowStockProducts = products
    .filter(product => product.stock < 20)
    .sort((a, b) => a.stock - b.stock);

  // Derive today's metrics directly from current sales context so "Today's Sales"
  // card stays accurate even when chart buckets are empty or delayed.
  const todayMetrics = useMemo(() => {
    const { start: startOfToday, end: startOfTomorrow } = getPhilippineDayBounds(new Date());
    const normalizedCabinet = String(cabinetValue || '').trim().toLowerCase();

    const filteredByCabinetToday = sales.filter((sale) => {
      if (isSaleArchived((sale as any).archived)) return false;
      const saleCabinet = String(sale.cabinet || '').trim().toLowerCase();
      if (normalizedCabinet !== 'all' && saleCabinet !== normalizedCabinet) return false;

      const saleDate = parseSaleDate(sale.date || sale.createdAt || '');
      if (Number.isNaN(saleDate.getTime())) return false;
      return saleDate >= startOfToday && saleDate < startOfTomorrow;
    });

    // Match staff dashboard behavior: if cabinet-matched today sales are empty,
    // fall back to all today's sales to avoid false zeros from cabinet mismatch data.
    const todaysSales = filteredByCabinetToday.length > 0 || normalizedCabinet === 'all'
      ? filteredByCabinetToday
      : sales.filter((sale) => {
          if (isSaleArchived((sale as any).archived)) return false;
          const saleDate = parseSaleDate(sale.date || sale.createdAt || '');
          if (Number.isNaN(saleDate.getTime())) return false;
          return saleDate >= startOfToday && saleDate < startOfTomorrow;
        });

    const revenue = todaysSales.reduce((sum, sale) => {
      const amount = typeof sale.amount === 'number' ? sale.amount : parseFloat(String(sale.amount)) || 0;
      return sum + amount;
    }, 0);

    return {
      revenue,
      transactions: todaysSales.length,
      items: todaysSales.reduce((sum, sale) => sum + countUnitsInSale(sale), 0)
    };
  }, [sales, cabinetValue]);

  const getLowStockColor = (stock: number) => {
    if (stock <= 5) return { bg: "bg-red-100", badge: "bg-red-600", text: "text-red-900", label: "CRITICAL" };
    return { bg: "bg-orange-100", badge: "bg-orange-600", text: "text-orange-900", label: "LOW" };
  };

  const summary = analyticsData?.summary;
  const revenueData = analyticsData?.revenueData || [];
  const topProducts = analyticsData?.topProducts || [];

  // Use unified data source for Today's card to match graph exactly
  console.log('Available revenueData periods:', revenueData.map(d => d.period));
  
  // Look for today's data in revenueData with multiple fallback patterns
  const todayRevenueData = revenueData.find(data => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    return data.period === 'Today' || 
           data.period?.toLowerCase().includes('today') ||
           data.period === todayStr ||
           data.period === today.toLocaleDateString('en-US', { weekday: 'long' });
  });
  
  // Use unified data source for consistency
  const todayTransactionsFromGraph = todayRevenueData?.transactions || todaySalesData.transactions;
  const todayRevenueFromGraph = todayRevenueData?.revenue || todaySalesData.revenue;
  
  console.log('Today data sources:', {
    revenueDataFound: !!todayRevenueData,
    revenueDataTransactions: todayRevenueData?.transactions,
    unifiedTransactions: todaySalesData.transactions,
    finalTransactions: todayTransactionsFromGraph,
    revenueDataRevenue: todayRevenueData?.revenue,
    unifiedRevenue: todaySalesData.revenue,
    finalRevenue: todayRevenueFromGraph
  });

  return (
    <div className="space-y-8">
      {/* Welcome Message */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Welcome back, {username}! 👋
              </h2>
              <p className="text-muted-foreground mt-1">
                Here's your business overview for today
              </p>
        </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Dashboard</p>
              <p className="text-lg font-semibold">
                Analytics Overview
              </p>
              <p className="text-sm text-muted-foreground">
                Real-time insights
              </p>
        </div>
      </div>
        </CardContent>
      </Card>

      {/* Key Metrics Cards - Show immediately with available data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Total Sales Card - Shows period-specific data */}
        <MetricCard
          title="Total Sales"
          value={analyticsLoading ? "..." : formatCurrency(periodSummaryData.revenue)}
          change={summary?.revenueGrowth ?? 0}
          changeType={(summary?.revenueGrowth ?? 0) >= 0 ? 'increase' : 'decrease'}
          icon={<PesoIcon size={24} className="h-6 w-6" />}
          description={analyticsLoading ? "Loading..." : `Revenue for selected period`}
          color="green"
        />
        
        {/* Today's Sales Card */}
        <MetricCard
          title="Today's Sales"
          value={analyticsLoading ? "..." : formatCurrency(todaySalesData.revenue)}
          icon={<TrendingUp className="h-6 w-6" />}
          description={analyticsLoading ? "Loading..." : `${todaySalesData.transactions} transactions today`}
          color="blue"
        />
        
        {/* Units sold (sum of quantities) — same basis as Sales tab */}
        <MetricCard
          title="Overall Units Sold"
          value={analyticsLoading ? "..." : periodSummaryData.items.toLocaleString()}
          icon={<Package className="h-6 w-6" />}
          description={analyticsLoading ? "Loading..." : "Selected period"}
          color="orange"
        />
        
        {/* Low Stock Items Card - Shows immediately from products context */}
        <MetricCard
          title="Low Stock Items"
          value={productsLoading ? "..." : lowStockProducts.length}
          icon={<AlertTriangle className="h-6 w-6" />}
          description={lowStockProducts.length > 0 ? "Action needed" : "All good"}
          color="maroon"
        />
  </div>

      {/* Charts Section - Show loading state only for charts */}
      {analyticsLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-80 w-full" />
              </CardContent>
            </Card>
          ))}
    </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
              <div>
                <h3 className="font-semibold text-red-900">Error loading analytics</h3>
                <p className="text-sm text-red-700">{error}</p>
          </div>
              <Button onClick={() => fetchAnalytics()} variant="outline" size="sm" className="ml-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
        </div>
          </CardContent>
        </Card>
      ) : !analyticsData ? null : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
            {/* Sales Performance */}
            <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Sales Performance
                </CardTitle>
                <CardDescription>
                  Track sales trends over time ({timePeriod})
                </CardDescription>
          </div>
              <div className="flex items-center gap-2">
                <Select 
                  value={timePeriod} 
                  onValueChange={(value: "weekly" | "monthly" | "quarterly" | "annually" | "all") => setTimePeriod(value)}
                  disabled={periodLoading}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => fetchAnalytics(true)} variant="outline" size="sm" disabled={periodLoading}>
                  <RefreshCw className={`h-4 w-4 ${periodLoading ? 'animate-spin' : ''}`} />
                </Button>
          </div>
        </div>
          </CardHeader>
          <CardContent className="relative">
            {periodLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
            ) : (revenueData || []).length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No sales data available for this period
          </div>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="period" 
                  stroke="#6b7280" 
                  tick={{ fontSize: 12 }} 
                  tickMargin={10} 
                  minTickGap={20} 
                />
                <YAxis 
                  stroke="#6b7280" 
                  width={65} 
                  tick={{ fontSize: 12 }} 
                  tickFormatter={(val) => (val >= 1000 ? `₱${(val/1000)}k` : `₱${val}`)} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fill="url(#colorRevenue)"
                  dot={{ r: 4, fill: "#6366f1", stroke: "#ffffff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#6366f1", stroke: "#ffffff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Best Sellers */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Best Sellers
            </CardTitle>
            <CardDescription>
              Most popular products this month
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            {periodLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
            ) : topProducts.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No product sales data available
          </div>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  stroke="#6b7280"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#6b7280" 
                  width={65}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(val) => (val >= 1000 ? `₱${(val/1000)}k` : `₱${val}`)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

            {/* Transaction Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Transaction Analysis
                </CardTitle>
                <CardDescription>
                  Transaction trends and patterns ({timePeriod})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {periodLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : (revenueData || []).length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No transaction data available for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="period" 
                        stroke="#6b7280"
                        tick={{ fontSize: 12 }} 
                        tickMargin={10} 
                        minTickGap={20} 
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        width={45}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(val) => (val >= 1000 ? `${(val/1000)}k` : `${val}`)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="transactions" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                        name="Transactions"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="items" 
                        stroke="#6366f1" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#6366f1", stroke: "#ffffff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#6366f1", stroke: "#ffffff", strokeWidth: 2 }}
                        name="Items Sold"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Low Stock Advisory */}
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Low Stock Advisory
              </CardTitle>
              <CardDescription>
                Products that need restocking soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : lowStockProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Package className="h-12 w-12 mb-2 text-green-600" />
                  <p className="text-green-700 font-medium">All products are well stocked!</p>
                  <p className="text-sm text-green-600">No items need immediate attention</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground font-medium">
                    {lowStockProducts.length} products need attention
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {lowStockProducts.slice(0, 10).map((product, index) => {
                      const stockColor = getLowStockColor(product.stock);
                      return (
                        <div 
                          key={product.id} 
                          className={`flex items-center justify-between p-3 rounded-lg ${stockColor.bg} hover:shadow-md transition-all duration-200`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${stockColor.badge}`}></div>
                            <div>
                              <p className={`font-medium ${stockColor.text}`}>{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.category} • Cabinet: {product.cabinet}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${stockColor.text}`}>{product.stock}</p>
                            <p className="text-xs text-muted-foreground">units left</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {lowStockProducts.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center pt-2 border-t">
                      ... and {lowStockProducts.length - 10} more products
                    </p>
                  )}
                </div>
              )}
            </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
