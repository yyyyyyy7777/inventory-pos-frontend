"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, Calendar, User, Activity, Package, DollarSign, Trash2, Edit2, Plus, ArrowUpDown, X, RefreshCw, Wrench } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActivity } from "@/contexts/activity-context"

const activityCategories = [
  { value: "all", label: "All Activities", icon: "📋" },
  { value: "product", label: "Products", icon: "📦" },
  { value: "sale", label: "Sales", icon: "💰" },
  { value: "employee", label: "Employees", icon: "👥" },
  { value: "inventory", label: "Inventory", icon: "�" },
  { value: "system", label: "System", icon: "⚙️" }
]

export function ActivityLogView({ isAdmin }: { isAdmin: boolean }) {
  const { getActivities, loading, refreshActivities } = useActivity()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedCabinet, setSelectedCabinet] = useState("all")
  const [dateFilter, setDateFilter] = useState({ 
    year: "all", 
    month: "all", 
    day: "all",
    startDate: "",
    endDate: ""
  })
  const [sortBy, setSortBy] = useState("timestamp")

  // Function to fix missing cabinets
  const fixMissingCabinets = async () => {
    try {
      const response = await fetch('/api/activities/fix-cabinets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Fixed cabinets:', result);
        alert(`Fixed ${result.updatedCount} activities with missing cabinets!`);
        await refreshActivities();
      } else {
        console.error('Failed to fix cabinets');
        alert('Failed to fix cabinets');
      }
    } catch (error) {
      console.error('Error fixing cabinets:', error);
      alert('Error fixing cabinets');
    }
  }

  const activities = getActivities() // Get all activities from database

  const cabinetOptions = [
    { value: "all", label: "All Cabinets", icon: "🏢" },
    { value: "main", label: "Main", icon: "🏠" },
    { value: "cabinet1", label: "Cabinet 1", icon: "📁" },
    { value: "cabinet2", label: "Cabinet 2", icon: "📂" },
  ]

  const filteredActivities = activities
    .filter((activity) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        activity.username.toLowerCase().includes(searchLower) ||
        activity.activity.toLowerCase().includes(searchLower) ||
        activity.details.toLowerCase().includes(searchLower);
      
      // Category filter - simple and strict matching
      const matchesCategory = selectedCategory === "all" || 
        activity.category === selectedCategory;
      
      // Cabinet filter - use the cabinet field from database
      let matchesCabinet = selectedCabinet === "all";
      if (selectedCabinet !== "all") {
        matchesCabinet = activity.cabinet === selectedCabinet;
      }
      
      // Date filter
      let matchesDate = true;
      if (dateFilter.startDate || dateFilter.endDate) {
        const activityDate = new Date(activity.timestamp);
        const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
        const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
        if (startDate && endDate) {
          matchesDate = activityDate >= startDate && activityDate <= endDate;
        } else if (startDate) {
          matchesDate = activityDate >= startDate;
        } else if (endDate) {
          matchesDate = activityDate <= endDate;
        }
      } else if (dateFilter.year !== "all") {
        const activityDate = new Date(activity.timestamp);
        const activityYear = activityDate.getFullYear();
        const activityMonth = activityDate.getMonth() + 1;
        const activityDay = activityDate.getDate();
        
        matchesDate = activityYear === parseInt(dateFilter.year);
        
        if (matchesDate && dateFilter.month !== "all") {
          matchesDate = activityMonth === parseInt(dateFilter.month);
        }
        
        if (matchesDate && dateFilter.day !== "all") {
          matchesDate = activityDay === parseInt(dateFilter.day);
        }
      }
      
      return matchesSearch && matchesCategory && matchesCabinet && matchesDate;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "timestamp": return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        case "username": return a.username.localeCompare(b.username);
        case "activity": return a.activity.localeCompare(b.activity);
        default: return 0;
      }
    });

  const getCategoryIcon = (category: string) => {
    const cat = activityCategories.find(c => c.value === category);
    return cat ? cat.icon : "📋";
  }

  const getActivityColor = (activity: string) => {
    if (activity.includes("Added") || activity.includes("Created")) return "text-green-600 bg-green-50"
    if (activity.includes("Updated") || activity.includes("Modified")) return "text-blue-600 bg-blue-50"
    if (activity.includes("Deleted") || activity.includes("Removed")) return "text-red-600 bg-red-50"
    if (activity.includes("Processed")) return "text-purple-600 bg-purple-50"
    return "text-gray-600 bg-gray-50"
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* Efficient Sidebar Filter Panel */}
      {showAdvancedFilters && (
        <div className="w-full lg:w-80 bg-white border rounded-lg shadow-sm p-3 h-fit lg:sticky lg:top-3 order-1 lg:order-1 mb-4 lg:mb-0">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-blue-600" />
                <h3 className="font-semibold text-gray-800 text-sm">Activity Filters</h3>
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">
                  {[selectedCategory !== "all" ? 1 : 0, selectedCabinet !== "all" ? 1 : 0, (dateFilter.startDate || dateFilter.endDate) ? 1 : 0, dateFilter.year !== "all" ? 1 : 0].reduce((a, b) => a + b, 0)}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAdvancedFilters(false)} className="h-5 w-5 p-0 hover:bg-gray-100">
                <X size={12} />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Activity size={10} className="text-blue-600" /> Activity Category
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-7 border-2 focus:border-blue-500 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span>{category.icon}</span>
                          <span>{category.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Package size={10} className="text-green-600" /> Cabinet
                </label>
                <Select value={selectedCabinet} onValueChange={setSelectedCabinet}>
                  <SelectTrigger className="h-7 border-2 focus:border-green-500 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {cabinetOptions.map((cabinet) => (
                      <SelectItem key={cabinet.value} value={cabinet.value} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span>{cabinet.icon}</span>
                          <span>{cabinet.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Calendar size={10} className="text-purple-600" /> Date Range
                </label>
                
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Start</label>
                    <Input
                      type="date"
                      value={dateFilter.startDate}
                      onChange={(e) => {
                        setDateFilter(prev => ({ 
                          ...prev, 
                          startDate: e.target.value,
                          year: "all",
                          month: "all", 
                          day: "all"
                        }))
                      }}
                      className="h-7 text-xs border-2 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">End</label>
                    <Input
                      type="date"
                      value={dateFilter.endDate}
                      onChange={(e) => {
                        setDateFilter(prev => ({ 
                          ...prev, 
                          endDate: e.target.value,
                          year: "all",
                          month: "all", 
                          day: "all"
                        }))
                      }}
                      className="h-7 text-xs border-2 focus:border-purple-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-1 my-1">
                  <div className="h-px bg-gray-300 flex-1"></div>
                  <span className="text-xs text-gray-400 px-1">OR</span>
                  <div className="h-px bg-gray-300 flex-1"></div>
                </div>
                
                <div className="grid grid-cols-3 gap-1">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Year</label>
                    <Select value={dateFilter.year} onValueChange={(value) => setDateFilter(prev => ({ ...prev, year: value }))}>
                      <SelectTrigger className="h-7 text-xs border-2 focus:border-purple-500">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Month</label>
                    <Select value={dateFilter.month} onValueChange={(value) => setDateFilter(prev => ({ ...prev, month: value }))}>
                      <SelectTrigger className="h-7 text-xs border-2 focus:border-purple-500">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {[
                          { value: "1", label: "Jan" },
                          { value: "2", label: "Feb" },
                          { value: "3", label: "Mar" },
                          { value: "4", label: "Apr" },
                          { value: "5", label: "May" },
                          { value: "6", label: "Jun" },
                          { value: "7", label: "Jul" },
                          { value: "8", label: "Aug" },
                          { value: "9", label: "Sep" },
                          { value: "10", label: "Oct" },
                          { value: "11", label: "Nov" },
                          { value: "12", label: "Dec" }
                        ].map(month => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Day</label>
                    <Select value={dateFilter.day} onValueChange={(value) => setDateFilter(prev => ({ ...prev, day: value }))}>
                      <SelectTrigger className="h-7 text-xs border-2 focus:border-purple-500">
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <SelectItem key={day} value={day.toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <ArrowUpDown size={10} className="text-indigo-600" /> Sort By
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-7 border-2 focus:border-indigo-500 text-xs">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timestamp">📅 Timestamp (Newest)</SelectItem>
                    <SelectItem value="username">👤 Username</SelectItem>
                    <SelectItem value="activity">📝 Activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory("all")
                    setSelectedCabinet("all")
                    setDateFilter({ 
                      year: "all", 
                      month: "all", 
                      day: "all",
                      startDate: "", 
                      endDate: "" 
                    })
                    setSortBy("timestamp")
                  }}
                  className="w-full h-7 text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear All Filters
                </Button>
              </div>
            </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 order-2 lg:order-2">
        <div className="space-y-4 lg:space-y-6">
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
                className="h-8 px-3 rounded-md border-2 border-blue-300 hover:bg-blue-50 text-blue-700 text-xs font-medium"
                title="Toggle filters panel"
              >
                <div className="flex items-center gap-1">
                  <Filter size={12} />
                  Filters
                  {(selectedCategory !== "all" || selectedCabinet !== "all" || (dateFilter.startDate || dateFilter.endDate) || dateFilter.year !== "all") && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  )}
                </div>
              </Button>
              <Button
                variant="outline"
                onClick={() => refreshActivities()}
                className="h-8 px-3 rounded-md border-2 border-green-300 hover:bg-green-50 text-green-700 text-xs font-medium"
                title="Refresh activities from database"
              >
                <div className="flex items-center gap-1">
                  <RefreshCw size={12} />
                  Refresh
                </div>
              </Button>
            </div>
          </div>

          <Card className="bg-card border-primary/10 overflow-hidden">
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Track all user activities and system changes</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Loading activities...</h3>
                  <p className="text-muted-foreground">
                    Fetching from database
                  </p>
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No activities found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? "Try adjusting your search criteria" : "No activities recorded yet"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 lg:space-y-4">
                  {filteredActivities.map((activity) => (
                    <div key={activity.id} className="bg-white border rounded-lg p-3 lg:p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 lg:gap-3 mb-2">
                            <span className="text-xl lg:text-2xl">{getCategoryIcon(activity.category)}</span>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-foreground text-sm lg:text-base truncate">{activity.activity}</h4>
                              <p className="text-xs lg:text-sm text-muted-foreground">by {activity.username}</p>
                            </div>
                          </div>
                          <div className="text-xs lg:text-sm text-gray-600 bg-gray-50 rounded p-2 lg:p-3 border border-gray-200">
                            <div className="font-medium text-gray-800 mb-1">Details:</div>
                            <div className="whitespace-pre-wrap break-words">{activity.details}</div>
                          </div>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(activity.timestamp)}
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
