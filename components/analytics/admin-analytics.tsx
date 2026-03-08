"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
} from "recharts"
import { useRemittance } from "@/contexts/remittance-context"
import { useProducts } from "@/contexts/products-context"

interface AdminAnalyticsProps {
  cabinet: string
}

// Top 3 selling products data
const topProductsData = [
  { name: "Spiderman POP", sales: 145, revenue: 43500 },
  { name: "Pokemon Cards", sales: 98, revenue: 29400 },
  { name: "HP Wand", sales: 76, revenue: 22800 },
]

// Revenue data by time period
const revenueData = {
  weekly: [
    { period: "Mon", revenue: 12000 },
    { period: "Tue", revenue: 15000 },
    { period: "Wed", revenue: 18000 },
    { period: "Thu", revenue: 14000 },
    { period: "Fri", revenue: 22000 },
    { period: "Sat", revenue: 25000 },
    { period: "Sun", revenue: 20000 },
  ],
  monthly: [
    { period: "Week 1", revenue: 65000 },
    { period: "Week 2", revenue: 72000 },
    { period: "Week 3", revenue: 68000 },
    { period: "Week 4", revenue: 75000 },
  ],
  quarterly: [
    { period: "Month 1", revenue: 180000 },
    { period: "Month 2", revenue: 195000 },
    { period: "Month 3", revenue: 210000 },
  ],
  annually: [
    { period: "Q1", revenue: 550000 },
    { period: "Q2", revenue: 580000 },
    { period: "Q3", revenue: 620000 },
    { period: "Q4", revenue: 690000 },
  ],
}

export function AdminAnalytics({ cabinet }: AdminAnalyticsProps) {
  const [timePeriod, setTimePeriod] = useState<"weekly" | "monthly" | "quarterly" | "annually">("weekly")
  const { getProductsByCabinet } = useProducts()
  
  // Get low stock products (stock < 20)
  const products = getProductsByCabinet(cabinet)
  const lowStockProducts = products
    .filter(product => product.stock < 20)
    .sort((a, b) => a.stock - b.stock) // Sort by stock ascending
    .slice(0, 3) // Get top 3 lowest stock items

  const getLowStockColor = (stock: number) => {
    if (stock <= 5) return { border: "border-red-300", bg: "from-red-50 to-red-100/50", badge: "bg-red-600", text: "text-red-900", label: "CRITICAL" }
    return { border: "border-yellow-300", bg: "from-yellow-50 to-yellow-100/50", badge: "bg-yellow-600", text: "text-yellow-900", label: "LOW" }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary/90 via-primary to-primary/80 text-primary-foreground shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-foreground/10" />
          <CardContent className="pt-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
                  Total Sales
                </p>
                <p className="mt-2 text-3xl font-semibold">₱37,200</p>
                <p className="mt-2 inline-flex items-center rounded-full bg-primary-foreground/10 px-2 py-1 text-xs font-medium">
                  <span className="mr-1 text-emerald-200">▲</span>
                  <span>Up 12% vs last week</span>
                </p>
              </div>
              <span className="text-3xl">💰</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Revenue
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">₱189,300</p>
                <p className="mt-2 text-xs text-emerald-500">+8% from last week</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-2 text-2xl">📊</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Stock Items
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">785</p>
                <p className="mt-2 text-xs text-amber-500">15 items low on stock</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-2 text-2xl">�</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Transactions
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">342</p>
                <p className="mt-2 text-xs text-muted-foreground">This week</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-2 text-2xl">✓</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Top 3 Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductsData} margin={{ top: 5, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="sales" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="revenue" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue Overview</CardTitle>
              </div>
              <Select value={timePeriod} onValueChange={(value: "weekly" | "monthly" | "quarterly" | "annually") => setTimePeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData[timePeriod]} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="period" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* Low Stock Advisory - Full Width */}
      <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <div>
                <CardTitle>Low Stock Advisory</CardTitle>
                <CardDescription>Products that need immediate restocking</CardDescription>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-red-100 text-red-800 rounded-full">{lowStockProducts.length} Items</span>
          </div>
        </CardHeader>
        <CardContent>
          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">✓ All products have healthy stock levels</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStockProducts.map((product) => {
                const colors = getLowStockColor(product.stock)
                return (
                  <div key={product.id} className={`relative overflow-hidden rounded-lg border-2 ${colors.border} bg-gradient-to-br ${colors.bg} p-4 hover:shadow-md transition-shadow`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-opacity-30 rounded-full -mr-10 -mt-10" style={{ backgroundColor: colors.badge }}></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`font-semibold ${colors.text} text-sm`}>{product.name}</p>
                          <p className={`text-xs ${colors.text} mt-1 opacity-80`}>Only {product.stock} left in stock</p>
                        </div>
                        <span className={`px-2 py-1 ${colors.badge} text-white text-xs font-bold rounded-full`}>{colors.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
