"use client"

import { useState, useEffect } from "react"
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
  DollarSign, 
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
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("weekly");
  const { getProductsByCabinet, loading: productsLoading } = useProducts();

  const fetchAnalytics = async (isPeriodChange = false) => {
    try {
      if (isPeriodChange) {
        setPeriodLoading(true);
      } else {
        setAnalyticsLoading(true);
      }
      setError(null);
      const response = await fetch(`/api/analytics?cabinet=${cabinet}&period=${timePeriod}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const data = await response.json();
      console.log('Analytics data received:', data);
      console.log('Revenue data:', data.revenueData);
      console.log('Top products:', data.topProducts);
      setAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics');
    } finally {
      if (isPeriodChange) {
        setPeriodLoading(false);
      } else {
        setAnalyticsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [cabinet]);

  useEffect(() => {
    fetchAnalytics(true);
  }, [timePeriod]);

  // Get low stock products (available immediately from context)
  const products = getProductsByCabinet(cabinet);
  const lowStockProducts = products
    .filter(product => product.stock < 20)
    .sort((a, b) => a.stock - b.stock);

  const getLowStockColor = (stock: number) => {
    if (stock <= 5) return { border: "border-red-300", bg: "from-red-50 to-red-100/50", badge: "bg-red-600", text: "text-red-900", label: "CRITICAL" };
    return { border: "border-orange-300", bg: "from-orange-50 to-orange-100/50", badge: "bg-orange-600", text: "text-orange-900", label: "LOW" };
  };

  const summary = analyticsData?.summary;
  const revenueData = analyticsData?.revenueData || [];
  const topProducts = analyticsData?.topProducts || [];

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
              <p className="text-sm text-muted-foreground">Current Time</p>
              <p className="text-lg font-semibold">
                {new Date().toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
        </div>
      </div>
        </CardContent>
      </Card>

      {/* Key Metrics Cards - Show immediately with available data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Total Sales Card */}
        <MetricCard
          title="Total Sales"
          value={analyticsLoading ? "..." : formatCurrency(summary?.totalRevenue || 0)}
          change={summary?.revenueGrowth}
          changeType={summary?.revenueGrowth >= 0 ? 'increase' : 'decrease'}
          icon={<DollarSign className="h-6 w-6" />}
          description={analyticsLoading ? "Loading..." : `${summary?.totalTransactions || 0} total transactions`}
          color="green"
        />
        
        {/* Today's Sales Card */}
        <MetricCard
          title="Today's Sales"
          value={analyticsLoading ? "..." : formatCurrency(summary?.todayRevenue || 0)}
          icon={<TrendingUp className="h-6 w-6" />}
          description={analyticsLoading ? "Loading..." : `${summary?.todayTransactions || 0} transactions today`}
          color="blue"
        />
        
        {/* Products Sold Card */}
        <MetricCard
          title="Products Sold"
          value={analyticsLoading ? "..." : (summary?.totalItems || 0).toLocaleString()}
          icon={<Package className="h-6 w-6" />}
          description={analyticsLoading ? "Loading..." : `Average sale: ${formatCurrency(summary?.avgTransactionValue || 0)}`}
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
                  onValueChange={(value: "weekly" | "monthly" | "quarterly" | "yearly") => setTimePeriod(value)}
                  disabled={periodLoading}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
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
            ) : revenueData.length === 0 ? (
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
                <XAxis dataKey="period" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
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
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'revenue' ? 'Revenue' : 'Units Sold'
                  ]}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} />
                <Bar dataKey="quantity" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
  </div>

      {/* Transactions and Items Chart */}
      <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Transaction Analytics
          </CardTitle>
          <CardDescription>
            Transactions and items sold over time
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          {periodLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
          ) : revenueData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No transaction data available for this period
        </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
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
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4, fill: "#6366f1", stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#6366f1", stroke: "#ffffff", strokeWidth: 2 }}
                name="Transactions"
              />
              <Line
                type="monotone"
                dataKey="items"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ r: 4, fill: "#8b5cf6", stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#8b5cf6", stroke: "#ffffff", strokeWidth: 2 }}
                name="Items Sold"
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Advisory */}
      {lowStockProducts.length > 0 && (
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-red-100 p-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
                <div>
                  <CardTitle className="text-gray-900">Low Stock Advisory</CardTitle>
                  <CardDescription className="text-gray-600">
                    Products that need immediate restocking
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
    </>
  )}
  </div>
  );
}