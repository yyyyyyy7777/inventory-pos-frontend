"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  TrendingUp,
  RefreshCw,
  Target,
  Clock,
  Plus,
  Eye,
  BarChart3,
  AlertTriangle
} from "lucide-react"
import { useProducts } from "@/contexts/products-context"
import { useSales } from "@/contexts/sales-context"
import { db } from "@/lib/indexeddb"
import { countUnitsInSale } from "@/lib/sale-metrics"
import { mapStaffTimePeriodToSalesPeriod, summarizeSalesForPeriod } from "@/lib/analytics-from-sales"

interface StaffAnalyticsProps {
  cabinet: string
  username?: string
  onViewChange?: (view: "dashboard" | "inventory" | "sales" | "pos") => void
}

type TimePeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly"

interface StaffAnalyticsData {
  summary: {
    todayRevenue: number;
    todayTransactions: number;
    todayItems: number;
    weeklyRevenue: number;
    weeklyTransactions: number;
    weeklyItems: number;
  };
  weeklyData: Array<{
    day: string;
    revenue: number;
    transactions: number;
    items: number;
  }>;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const StaffMetricCard = ({ 
  title, 
  value, 
  icon, 
  description,
  trend,
  color = "primary"
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "primary" | "green" | "blue" | "orange" | "maroon";
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
      default:
        return "bg-violet-200 text-violet-700";
    }
  };

  const getTrendColor = () => {
    return trend?.isPositive ? "text-emerald-600" : "text-red-600";
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
            {trend && (
              <div className={`flex items-center gap-1 ${getTrendColor()}`}>
                <TrendingUp className={`h-3 w-3 ${!trend.isPositive ? 'rotate-180' : ''}`} />
                <span className="text-sm font-medium">
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-xs opacity-75">
                  from yesterday
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

export function EnhancedStaffAnalytics({ cabinet, username, onViewChange }: StaffAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<StaffAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("weekly");
  const { getProductsByCabinet, loading: productsLoading } = useProducts();
  const { sales, loading: salesLoading } = useSales();
  const [todaySalesData, setTodaySalesData] = useState<{ revenue: number; transactions: number; items: number }>({ revenue: 0, transactions: 0, items: 0 });
  const [todaySalesLoading, setTodaySalesLoading] = useState(false);
  const [periodSummaryData, setPeriodSummaryData] = useState<{ revenue: number; transactions: number; items: number }>({ revenue: 0, transactions: 0, items: 0 });

  useEffect(() => {
    const salesPeriod = mapStaffTimePeriodToSalesPeriod(timePeriod);
    const { revenue, transactions, items } = summarizeSalesForPeriod(sales, cabinet, salesPeriod);
    setPeriodSummaryData({ revenue, transactions, items });
  }, [sales, cabinet, timePeriod]);

  // Calculate today's sales from both online and offline data
  const calculateTodaySales = useCallback(async () => {
    // Prevent multiple simultaneous calculations
    if (todaySalesLoading) {
      return;
    }

    setTodaySalesLoading(true);
    try {
      // Get today's date range in local timezone
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today (00:00:00)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow (00:00:00)

      let todaySales: any[] = [];

      // Try to get sales from context first
      if (sales && sales.length > 0) {
        todaySales = sales.filter(sale => {
          try {
            const saleDate = new Date(sale.date);
            const matchesCabinet = !cabinet || cabinet === 'all' || sale.cabinet === cabinet;
            const isToday = saleDate >= today && saleDate < tomorrow;
            return matchesCabinet && isToday;
          } catch (dateError) {
            return false;
          }
        });
      }

      // If no sales from context, try direct IndexedDB query
      if (todaySales.length === 0) {
        try {
          const allSales = await db.sales.toArray();
          todaySales = allSales.filter(sale => {
            try {
              const saleDate = new Date(sale.date);
              const matchesCabinet = !cabinet || cabinet === 'all' || sale.cabinet === cabinet;
              const isToday = saleDate >= today && saleDate < tomorrow;
              return matchesCabinet && isToday;
            } catch (e) {
              return false;
            }
          });
        } catch (dbError) {
          // Silent fail; keep UX smooth.
        }
      }

      // If still no sales, try API as last resort
      if (todaySales.length === 0 && navigator.onLine) {
        try {
          const response = await fetch(`/api/sales?cabinet=${cabinet}&startDate=${today.toISOString()}&endDate=${tomorrow.toISOString()}`);
          if (response.ok) {
            const apiSales = await response.json();
            todaySales = apiSales || [];
          }
        } catch (apiError) {
          // Silent fail; keep UX smooth.
        }
      }

      const todayRevenue = todaySales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
      const todayTransactions = todaySales.length;
      const todayItems = todaySales.reduce((sum, sale) => sum + countUnitsInSale(sale), 0);

      // If no sales found with cabinet filter, try without cabinet filter as fallback
      if (todaySales.length === 0 && sales && sales.length > 0) {
        const allTodaySales = sales.filter(sale => {
          try {
            const saleDate = new Date(sale.date);
            const isToday = saleDate >= today && saleDate < tomorrow;
            return isToday;
          } catch (dateError) {
            return false;
          }
        });
        
        const allTodayRevenue = allTodaySales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
        const allTodayTransactions = allTodaySales.length;
        const allTodayItems = allTodaySales.reduce((sum, sale) => sum + countUnitsInSale(sale), 0);
        
        setTodaySalesData({ revenue: allTodayRevenue, transactions: allTodayTransactions, items: allTodayItems });
      } else {
        setTodaySalesData({ revenue: todayRevenue, transactions: todayTransactions, items: todayItems });
      }
    } catch (error) {
      setTodaySalesData({ revenue: 0, transactions: 0, items: 0 });
    } finally {
      setTodaySalesLoading(false);
    }
  }, [sales, cabinet, todaySalesLoading]);

  const fetchStaffAnalytics = async (isPeriodChange = false) => {
    try {
      if (isPeriodChange) {
        setPeriodLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      console.log(`🔄 Fetching staff analytics for cabinet: ${cabinet}, period: ${timePeriod}`);
      // Fetch data for selected period
      const response = await fetch(`/api/analytics?cabinet=${cabinet}&period=${timePeriod}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Staff analytics data received:', data);
      
      // Check if this is fallback data
      const isFallbackData = data._isFallback || data.topProducts?.[0]?.name?.includes('Sample Product') || false;
      if (isFallbackData) {
        console.log('⚠️ Staff using fallback data - database connection unavailable', data._error);
      }
      
      // Validate data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid analytics data received');
      }
      
      // Ensure revenueData is an array
      if (!data.revenueData || !Array.isArray(data.revenueData)) {
        console.warn('Revenue data is missing or not an array, using empty array');
        data.revenueData = [];
      }
      
      // Cards use client-side totals (same rules as Sales tab); API is for charts only
      const periodSummary = summarizeSalesForPeriod(
        sales,
        cabinet,
        mapStaffTimePeriodToSalesPeriod(timePeriod)
      );

      // Process data for staff view
      const today = new Date();
      const todayData = data.revenueData?.find((d: any) => 
        d.period === today.toLocaleDateString('en-US', { weekday: 'short' })
      );

      const staffAnalytics: StaffAnalyticsData = {
        summary: {
          todayRevenue: todayData?.revenue || 0,
          todayTransactions: todayData?.transactions || 0,
          todayItems: todayData?.items || 0,
          weeklyRevenue: periodSummary.revenue,
          weeklyTransactions: periodSummary.transactions,
          weeklyItems: periodSummary.items,
        },
        weeklyData: data.revenueData?.map((d: any) => ({
          day: d.period,
          revenue: d.revenue,
          transactions: d.transactions,
          items: d.items
        })) || []
      };

      setAnalyticsData(staffAnalytics);
      
      // Clear any existing errors when data loads successfully
      if (isFallbackData) {
        setError('Using sample data - database connection unavailable. Charts show example data.');
      } else {
        setError(null);
      }
    } catch (error) {
      console.error('Error fetching staff analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
      setPeriodLoading(false);
    }
  };

  useEffect(() => {
    if (productsLoading || salesLoading) return;
    fetchStaffAnalytics();
  }, [cabinet, productsLoading, salesLoading]);

  useEffect(() => {
    if (productsLoading || salesLoading) return;
    fetchStaffAnalytics(true);
  }, [timePeriod, productsLoading, salesLoading]);

  // Calculate today's sales whenever sales data changes
  useEffect(() => {
    calculateTodaySales();
  }, [calculateTodaySales]);

  // Get low stock products
  const products = getProductsByCabinet(cabinet);
  const lowStockProducts = products
    .filter(product => product.stock < 20)
    .sort((a, b) => a.stock - b.stock);

  const getLowStockColor = (stock: number) => {
    if (stock <= 5) return { border: "border-red-300", bg: "from-red-50 to-red-100/50", badge: "bg-red-600", text: "text-red-900", label: "CRITICAL" };
    return { border: "border-amber-300", bg: "from-amber-50 to-amber-100/50", badge: "bg-amber-600", text: "text-amber-900", label: "LOW" };
  };

  // Handle quick actions
  const handleQuickAction = (action: "dashboard" | "inventory" | "sales" | "pos") => {
    onViewChange?.(action);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-80 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2">
              <TrendingUp className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900">Error loading analytics</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <Button onClick={() => fetchStaffAnalytics()} variant="outline" size="sm" className="ml-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analyticsData) {
    return null;
  }

  const { summary, weeklyData } = analyticsData;

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
                Here's your performance overview for today
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Current Time</p>
              <p className="text-lg font-semibold">
                {new Date().toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StaffMetricCard
          title={`${timePeriod === 'daily' ? "Today's" : timePeriod === 'weekly' ? "Weekly" : timePeriod === 'monthly' ? "Monthly" : timePeriod === 'quarterly' ? "Quarterly" : "Yearly"} Sales`}
          value={formatCurrency(periodSummaryData.revenue)}
          icon={<DollarSign className="h-6 w-6" />}
          description={`${periodSummaryData.transactions} transactions`}
          color="blue"
        />
        
        <StaffMetricCard
          title={`${timePeriod === 'daily' ? "Today's" : timePeriod === 'weekly' ? "Weekly" : timePeriod === 'monthly' ? "Monthly" : timePeriod === 'quarterly' ? "Quarterly" : "Yearly"} Items Sold`}
          value={periodSummaryData.items.toLocaleString()}
          icon={<Package className="h-6 w-6" />}
          description="Units sold"
          color="orange"
        />
        
        <StaffMetricCard
          title={`${timePeriod === 'daily' ? "Today's" : timePeriod === 'weekly' ? "Weekly" : timePeriod === 'monthly' ? "Monthly" : timePeriod === 'quarterly' ? "Quarterly" : "Yearly"} Total`}
          value={formatCurrency(periodSummaryData.revenue)}
          icon={<TrendingUp className="h-6 w-6" />}
          description={`${periodSummaryData.transactions} transactions this ${timePeriod}`}
          color="green"
        />
        
        <StaffMetricCard
          title="Low Stock Items"
          value={lowStockProducts.length}
          icon={<ShoppingCart className="h-6 w-6" />}
          description={lowStockProducts.length > 0 ? "Action needed" : "All good"}
          color="maroon"
        />
      </div>

      {/* Performance Chart and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Performance Chart */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-violet-50/50 to-purple-50/30 border-violet-200/50 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-violet-900">
                  <Target className="h-5 w-5" />
                  {timePeriod === 'daily' ? "Today's" : timePeriod === 'weekly' ? "Weekly" : timePeriod === 'monthly' ? "Monthly" : timePeriod === 'quarterly' ? "Quarterly" : "Yearly"} Performance
                </CardTitle>
                <CardDescription className="text-violet-700">
                  Your sales performance for the selected period
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select 
                  value={timePeriod} 
                  onValueChange={(value: TimePeriod) => setTimePeriod(value)}
                  disabled={periodLoading}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Today</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => fetchStaffAnalytics(true)} variant="outline" size="sm" disabled={periodLoading}>
                  <RefreshCw className={`h-4 w-4 ${periodLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {periodLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : weeklyData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No sales data available for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weeklyData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" />
                  <YAxis stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'revenue' ? formatCurrency(value) : value,
                      name === 'revenue' ? 'Revenue' : name === 'transactions' ? 'Transactions' : 'Items'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-violet-50/50 to-purple-50/30 border-violet-200/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-violet-900">
              <Clock className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription className="text-violet-700">
              Common tasks for your shift
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                onClick={() => handleQuickAction('pos')}
                className="w-full justify-start h-auto p-4 bg-[oklch(0.35_0.2_280)] hover:bg-[oklch(0.45_0.18_280)] text-white"
              >
                <Plus className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Start New Sale</p>
                  <p className="text-xs opacity-80">Open POS system</p>
                </div>
              </Button>
              
              <Button 
                onClick={() => handleQuickAction('inventory')}
                variant="outline" 
                className="w-full justify-start h-auto p-4 border-[oklch(0.3_0.05_280)] hover:bg-[oklch(0.25_0.02_280)] hover:border-[oklch(0.35_0.1_280)]"
              >
                <Eye className="h-4 w-4 mr-3 text-[oklch(0.65_0.22_280)]" />
                <div className="text-left">
                  <p className="font-medium">Check Inventory</p>
                  <p className="text-xs text-muted-foreground">View stock levels</p>
                </div>
              </Button>
              
              <Button 
                onClick={() => handleQuickAction('sales')}
                variant="outline" 
                className="w-full justify-start h-auto p-4 border-[oklch(0.3_0.05_280)] hover:bg-[oklch(0.25_0.02_280)] hover:border-[oklch(0.35_0.1_280)]"
              >
                <BarChart3 className="h-4 w-4 mr-3 text-[oklch(0.65_0.22_280)]" />
                <div className="text-left">
                  <p className="font-medium">View Sales History</p>
                  <p className="text-xs text-muted-foreground">Today's transactions</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-red-100 p-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-gray-900">Low Stock Alert</CardTitle>
                  <CardDescription className="text-gray-600">
                    Notify admin about these items
                  </CardDescription>
                </div>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-red-100 text-red-800 rounded-full">
                {lowStockProducts.length} Items
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
              {lowStockProducts.map((product) => {
                const colors = getLowStockColor(product.stock);
                return (
                  <div key={product.id} className={`relative overflow-hidden rounded-lg border-2 ${colors.border} bg-gradient-to-br ${colors.bg} p-4 hover:shadow-md transition-shadow`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-opacity-30 rounded-full -mr-10 -mt-10" style={{ backgroundColor: colors.badge }}></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`font-semibold ${colors.text} text-sm`}>{product.name}</p>
                          <p className={`text-xs ${colors.text} mt-1 opacity-80`}>Only {product.stock} left in stock</p>
                          <p className={`text-xs ${colors.text} mt-1 opacity-60`}>SKU: {product.sku}</p>
                        </div>
                        <span className={`px-2 py-1 ${colors.badge} text-white text-xs font-bold rounded-full`}>{colors.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
