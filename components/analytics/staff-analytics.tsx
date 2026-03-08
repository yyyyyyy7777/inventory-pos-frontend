"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useProducts } from "@/contexts/products-context"

interface StaffAnalyticsProps {
  cabinet: string
}

const monthlyData = [
  { name: "Week 1", transactions: 45, items: 320 },
  { name: "Week 2", transactions: 52, items: 410 },
  { name: "Week 3", transactions: 48, items: 380 },
  { name: "Week 4", transactions: 61, items: 470 },
]

export function StaffAnalytics({ cabinet }: StaffAnalyticsProps) {
  const { getProductsByCabinet } = useProducts()
  
  // Get low stock products (stock < 20)
  const products = getProductsByCabinet(cabinet)
  const lowStockProducts = products
    .filter(product => product.stock < 20)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 3)

  const getLowStockColor = (stock: number) => {
    if (stock <= 5) return { border: "border-red-300", bg: "from-red-50 to-red-100/50", badge: "bg-red-600", text: "text-red-900", label: "CRITICAL" }
    return { border: "border-yellow-300", bg: "from-yellow-50 to-yellow-100/50", badge: "bg-yellow-600", text: "text-yellow-900", label: "LOW" }
  }

  return (
    <div className="space-y-8">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary/90 via-primary to-primary/80 text-primary-foreground shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-foreground/10" />
          <CardContent className="pt-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
                  Today's Sales
                </p>
                <p className="mt-2 text-3xl font-semibold">₱5,240</p>
                <p className="mt-2 inline-flex items-center rounded-full bg-primary-foreground/10 px-2 py-1 text-xs font-medium">
                  <span className="mr-1 text-emerald-200">▲</span>
                  <span>18 transactions</span>
                </p>
              </div>
              <span className="text-3xl">💵</span>
            </div>
          </CardContent>
        </Card>

        {/* Items Sold */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Items Sold Today
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">142</p>
                <p className="mt-2 text-xs text-emerald-500">Best: Funko POP</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-2 text-2xl">📊</span>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Items */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Low Stock Items
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">3</p>
                <p className="mt-2 text-xs text-destructive">Action needed</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-2 text-2xl">⚠️</span>
            </div>
          </CardContent>
        </Card>

        {/* This Week's Total */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  This Week's Sales
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">₱31,240</p>
                <p className="mt-2 text-xs text-muted-foreground">4 days completed</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-2 text-2xl">📈</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary and Actions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions - First */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              Quick Actions
            </CardTitle>
            <CardDescription>Common tasks for your shift</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button className="w-full p-3 text-left rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors">
                <p className="font-medium text-sm">Start New Transaction</p>
                <p className="text-xs text-muted-foreground">Open POS system</p>
              </button>
              <button className="w-full p-3 text-left rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors">
                <p className="font-medium text-sm">Check Inventory</p>
                <p className="text-xs text-muted-foreground">View stock levels</p>
              </button>
              <button className="w-full p-3 text-left rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors">
                <p className="font-medium text-sm">View Sales Report</p>
                <p className="text-xs text-muted-foreground">Today's performance</p>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Advisory - Second */}
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
              <div className="space-y-2">
                {lowStockProducts.map((product) => {
                  const colors = getLowStockColor(product.stock)
                  return (
                    <div key={product.id} className={`flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r ${colors.bg} border-2 ${colors.border}`}>
                      <div>
                        <p className={`font-medium ${colors.text} text-sm`}>{product.name}</p>
                        <p className={`text-xs ${colors.text} opacity-80`}>Only {product.stock} left in stock</p>
                      </div>
                      <span className={`px-2 py-1 ${colors.badge} text-white text-xs font-semibold rounded`}>{colors.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
