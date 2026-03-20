"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, Calendar, User, Activity, RefreshCw, X, Package, DollarSign, Users, Boxes, Settings, LayoutList, ArrowUpDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActivity } from "@/contexts/activity-context"
import { formatToLocalTime } from "@/lib/datetime-utils"

const activityCategories = [
  { value: "all", label: "All Activities", icon: LayoutList },
  { value: "product", label: "Products", icon: Package },
  { value: "sale", label: "Sales", icon: DollarSign },
  { value: "employee", label: "Employees", icon: Users },
  { value: "inventory", label: "Inventory", icon: Boxes },
  { value: "system", label: "System", icon: Settings }
]

export function ActivityLogView({ isAdmin }: { isAdmin: boolean }) {
  const { getActivities, loading, refreshActivities } = useActivity()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("timestamp")
  const [dateFilter, setDateFilter] = useState({ 
    year: "all", month: "all", day: "all", startDate: "", endDate: "" 
  })

  const activities = getActivities()

  // Refresh activities on mount to show latest data - run only once
  useEffect(() => {
    console.log('ActivityLogView mounted, refreshing activities...')
    // Long delay to ensure any logout from page reload is committed to DB
    const timer = setTimeout(() => {
      refreshActivities().then(() => {
        console.log('Activities refreshed, count:', activities.length)
      })
    }, 3000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Use the fixed formatToLocalTime function that handles timezone properly
  const formatPhilippinesTime = (timestamp: string) => {
    return formatToLocalTime(timestamp, { includeSeconds: true });
  }

  const filteredActivities = activities
    .filter(activity => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = activity.username.toLowerCase().includes(searchLower) ||
             activity.activity.toLowerCase().includes(searchLower) ||
             activity.details.toLowerCase().includes(searchLower)
      const matchesCategory = selectedCategory === "all" || activity.category === selectedCategory
      
      // Date filter
      let matchesDate = true
      if (dateFilter.startDate || dateFilter.endDate) {
        const activityDate = new Date(activity.timestamp)
        if (dateFilter.startDate) matchesDate = matchesDate && activityDate >= new Date(dateFilter.startDate)
        if (dateFilter.endDate) matchesDate = matchesDate && activityDate <= new Date(dateFilter.endDate)
      }
      
      return matchesSearch && matchesCategory && matchesDate
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "timestamp": return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        case "username": return a.username.localeCompare(b.username)
        case "activity": return a.activity.localeCompare(b.activity)
        default: return 0
      }
    })

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* Sidebar Filter Panel - Same as Sales Tab */}
      {showAdvancedFilters && (
        <div className="w-full lg:w-80 bg-white border rounded-lg shadow-sm p-3 h-fit lg:sticky lg:top-3 order-1 lg:order-1 mb-4 lg:mb-0">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-primary" />
              <h3 className="font-semibold text-gray-800 text-sm">Activity Filters</h3>
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-xs">
                {[selectedCategory !== "all" ? 1 : 0, (dateFilter.startDate || dateFilter.endDate) ? 1 : 0, searchQuery !== "" ? 1 : 0].reduce((a, b) => a + b, 0)}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAdvancedFilters(false)} className="h-5 w-5 p-0 hover:bg-gray-100">
              <X size={12} />
            </Button>
          </div>

          <div className="space-y-3">
            {/* Category Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Package size={10} className="text-primary" /> Category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-7 border-2 focus:border-primary text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {activityCategories.map((cat) => {
                    const Icon = cat.icon
                    return (
                      <SelectItem key={cat.value} value={cat.value} className="text-xs cursor-pointer">
                        <span className="flex items-center gap-2">
                          <Icon size={14} />
                          {cat.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <ArrowUpDown size={10} className="text-indigo-600" /> Sort By
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-7 border-2 focus:border-indigo-500 text-xs">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timestamp"><span className="flex items-center gap-2"><Calendar size={14} /> Timestamp</span></SelectItem>
                  <SelectItem value="username"><span className="flex items-center gap-2"><User size={14} /> Username</span></SelectItem>
                  <SelectItem value="activity"><span className="flex items-center gap-2"><Activity size={14} /> Activity</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Calendar size={10} className="text-purple-600" /> Date Range
              </label>
              <div className="space-y-1">
                <Input 
                  type="date" 
                  value={dateFilter.startDate} 
                  onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))} 
                  className="h-6 border-2 focus:border-purple-500 text-xs px-2" 
                />
                <Input 
                  type="date" 
                  value={dateFilter.endDate} 
                  onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))} 
                  className="h-6 border-2 focus:border-purple-500 text-xs px-2" 
                />
              </div>
            </div>

            {/* Clear All */}
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedCategory("all")
                setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" })
                setSortBy("timestamp")
                setSearchQuery("")
              }} 
              className="w-full h-7 text-gray-500 hover:text-gray-700 text-xs"
            >
              Clear All Filters
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 order-2 lg:order-2">
        <div className="space-y-4">
          {/* Header with Search and Filters Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search activities by user, action, or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-8 text-sm"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-8 px-3 rounded-md border-2 border-primary/30 hover:bg-primary/10 text-primary text-xs font-medium"
              >
                <div className="flex items-center gap-1">
                  <Filter size={12} />
                  Filters
                  {(selectedCategory !== "all" || (dateFilter.startDate || dateFilter.endDate) || searchQuery !== "") && (
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                  )}
                </div>
              </Button>
            </div>
            <Button onClick={refreshActivities} variant="outline" size="sm" className="h-8">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Activity Log Card */}
          <Card>
            <CardHeader>
              <CardDescription>Latest activities</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading activities...</p>
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No activities found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((activity) => (
                    <div key={activity.id} className="border rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm sm:text-base">{activity.activity}</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">by {activity.username}</p>
                          <p className="text-xs sm:text-sm mt-2 bg-gray-50 p-2 rounded break-words">{activity.details}</p>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <p className="text-xs sm:text-sm font-medium">
                            {formatPhilippinesTime(activity.timestamp)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.category}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
