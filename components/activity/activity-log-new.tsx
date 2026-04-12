"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, Calendar, User, Activity, RefreshCw, X, Package, Users, Boxes, Settings, LayoutList, ArrowUpDown, Archive, FolderOpen } from "lucide-react"
import { PesoIcon } from "@/components/ui/peso-icon"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActivity } from "@/contexts/activity-context"
import { formatToLocalTime } from "@/lib/datetime-utils"
import { useToast } from "@/contexts/toast-context"
import { useOffline } from "@/contexts/offline-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const activityCategories = [
  { value: "all", label: "All Activities", icon: LayoutList },
  { value: "product", label: "Products", icon: Package },
  { value: "sale", label: "Sales", icon: PesoIcon },
  { value: "employee", label: "Employees", icon: Users },
  { value: "inventory", label: "Inventory", icon: Boxes },
  { value: "system", label: "System", icon: Settings }
]

export function ActivityLogView({ isAdmin }: { isAdmin: boolean }) {
  const { getActivities, loading, refreshActivities, archiveActivities, unarchiveActivities } = useActivity()
  const { addToast } = useToast()
  const { isOnline } = useOffline()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("timestamp")
  const [dateFilter, setDateFilter] = useState({ 
    year: "all", month: "all", day: "all", startDate: "", endDate: "" 
  })
  const [mounted, setMounted] = useState(false)
  const [showManageArchives, setShowManageArchives] = useState(false)
  const [manageArchiveMonth, setManageArchiveMonth] = useState("")
  const [isArchiving, setIsArchiving] = useState(false)
  const [archiveStatus, setArchiveStatus] = useState<{activeCount: number, archivedCount: number, totalCount: number} | null>(null)

  const activities = getActivities()

  // Prevent SSR issues by only rendering on client
  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Use absolute timestamp for all activities
  const formatPhilippinesTime = (timestamp: string, category: string) => {
    return formatToLocalTime(timestamp, { includeSeconds: true });
  }

  // Parse timestamp for comparison without timezone issues
  const parseTimestampForSort = (timestamp: string): number => {
    // Try to match timezone-aware format first (e.g., "3/20/2026, 5:30:00 PM (UTC+8)")
    let match = timestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:, | )(\d{1,2}):(\d{2}):(\d{2}) (AM|PM) \(UTC([+-]\d+)\)$/);
    
    // Fall back to old format without timezone
    if (!match) {
      match = timestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:, | )(\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/);
    }
    
    if (match) {
      const [, month, day, year, hours, minutes, seconds, ampm] = match;
      let hour24 = parseInt(hours);
      if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
      if (ampm === 'AM' && hour24 === 12) hour24 = 0;
      // Create a sortable string: YYYYMMDDHHmmss
      return parseInt(`${year}${month.padStart(2, '0')}${day.padStart(2, '0')}${hour24.toString().padStart(2, '0')}${minutes}${seconds}`);
    }
    // Fallback to Date parsing (for ISO format)
    return new Date(timestamp).getTime();
  }

  const checkArchiveStatus = async (month: string) => {
    if (!month) {
      setArchiveStatus(null);
      return;
    }

    // If offline, calculate status from local activities
    if (!isOnline) {
      try {
        const activities = getActivities();
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

        const monthActivities = activities.filter(activity => {
          const activityDate = new Date(activity.timestamp);
          return activityDate >= startDate && activityDate <= endDate;
        });

        setArchiveStatus({
          activeCount: monthActivities.length,
          archivedCount: 0, // Offline mode doesn't track archived activities
          totalCount: monthActivities.length
        });

        addToast("Archive status calculated from local data (offline mode)", "info");
      } catch (error) {
        console.error('Error calculating offline archive status:', error);
        setArchiveStatus(null);
      }
      return;
    }

    // Online mode: use API
    try {
      const statusResponse = await fetch('/api/activities/archive-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          month: month,
          cabinet: 'all'
        }),
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setArchiveStatus(statusData.monthActivities);
      } else {
        setArchiveStatus(null);
      }
    } catch (error) {
      console.error('Error checking archive status:', error);
      setArchiveStatus(null);
    }
  };

  const handleArchiveActivities = async (action: "archive" | "unarchive") => {
    if (!manageArchiveMonth) {
      addToast("Please select a month", "error");
      return;
    }

    // If offline, queue the operation for later sync
    if (!isOnline) {
      addToast(`${action === 'archive' ? 'Archive' : 'Unarchive'} operation queued for when you're back online`, "info");
      
      // Store the operation in localStorage for later sync
      const queuedOperation = {
        action,
        month: manageArchiveMonth,
        timestamp: Date.now()
      };
      
      const existingQueue = JSON.parse(localStorage.getItem('queuedArchiveOperations') || '[]');
      existingQueue.push(queuedOperation);
      localStorage.setItem('queuedArchiveOperations', JSON.stringify(existingQueue));
      
      // Close dialog
      setManageArchiveMonth('');
      setShowManageArchives(false);
      setIsArchiving(false);
      return;
    }

    setIsArchiving(true);
    
    try {
      // First check the actual database status via API
      const statusResponse = await fetch('/api/activities/archive-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          month: manageArchiveMonth,
          cabinet: 'all' // Activities are not cabinet-specific
        }),
      });
      
      if (!statusResponse.ok) {
        throw new Error('Failed to check archive status');
      }
      
      const statusData = await statusResponse.json();
      console.log('Archive status check:', statusData);
      
      // Check if there are any activities in the selected month
      const totalActivities = statusData.monthActivities?.totalCount || 0;
      
      if (totalActivities === 0) {
        addToast(`No activities found for ${manageArchiveMonth}`, "info");
        return;
      }
      
      if (action === 'archive' && statusData.monthActivities?.activeCount === 0) {
        addToast(`No active activities to archive for ${manageArchiveMonth}. All activities are already archived.`, "info");
        return;
      }
      
      if (action === 'unarchive' && statusData.monthActivities?.archivedCount === 0) {
        addToast(`No archived activities to unarchive for ${manageArchiveMonth}. All activities are already active.`, "info");
        return;
      }
      
      // Perform the archive/unarchive operation
      let result;
      if (action === 'unarchive') {
        result = await unarchiveActivities('all', manageArchiveMonth);
      } else {
        result = await archiveActivities('all', manageArchiveMonth);
      }
      
      // Show success toast ONLY after the archive operation completes
      const count = action === 'archive' 
        ? statusData.monthActivities?.activeCount || 0
        : statusData.monthActivities?.archivedCount || 0;
      
      addToast(`${count} activities ${action}d successfully!`, "success");
      
      // Close dialog and reset
      setManageArchiveMonth('');
      setShowManageArchives(false);
      
    } catch (error) {
      console.error(`Error ${action}ing activities:`, error);
      addToast(`Failed to ${action} activities: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
      // Refresh on error to restore correct state
      refreshActivities();
    } finally {
      setIsArchiving(false);
    }
  };

  const filteredActivities = activities
    .filter(activity => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = activity.username.toLowerCase().includes(searchLower) ||
             activity.activity.toLowerCase().includes(searchLower) ||
             (activity.details?.toLowerCase().includes(searchLower) || false)
      const matchesCategory = selectedCategory === "all" || activity.category === selectedCategory
      
      // Date filter - skip during SSR to avoid timezone issues
      let matchesDate = true
      if (mounted && (dateFilter.startDate || dateFilter.endDate)) {
        const activityTime = parseTimestampForSort(activity.timestamp)
        const startTime = dateFilter.startDate ? parseInt(dateFilter.startDate.replace(/-/g, '')) * 1000000 : 0
        const endTime = dateFilter.endDate ? parseInt(dateFilter.endDate.replace(/-/g, '')) * 1000000 : 999999999999
        matchesDate = activityTime >= startTime && activityTime <= endTime
      }
      
      return matchesSearch && matchesCategory && matchesDate
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "timestamp": return parseTimestampForSort(b.timestamp) - parseTimestampForSort(a.timestamp)
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
              <Filter size={14} className="text-[#3B18DA]" />
              <h3 className="font-semibold text-gray-800 text-sm">Activity Filters</h3>
              <span className="bg-[#3B18DA]/10 text-[#3B18DA] px-1.5 py-0.5 rounded-full text-xs">
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
                className="h-8 px-3 rounded-md border-2 border-[#3B18DA] hover:bg-[#3B18DA]/10 text-[#3B18DA] text-xs font-medium"
              >
                <div className="flex items-center gap-1">
                  <Filter size={12} className="text-[#3B18DA]" />
                  Filters
                  {(selectedCategory !== "all" || (dateFilter.startDate || dateFilter.endDate) || searchQuery !== "") && (
                    <span className="w-2 h-2 bg-[#3B18DA] rounded-full animate-pulse"></span>
                  )}
                </div>
              </Button>
            </div>
            <Button onClick={refreshActivities} variant="outline" size="sm" className="h-8">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => {
              setShowManageArchives(true);
              setArchiveStatus(null);
              setManageArchiveMonth('');
            }} className="h-8 px-3 rounded-md border-2 hover:bg-gray-50 text-xs">
              <Archive size={14} className="mr-1" /> <span className="hidden sm:inline">Archive</span>
            </Button>
          </div>

          {/* Activity Log Card */}
          <Card>
            <CardHeader>
              <CardDescription>Latest activities</CardDescription>
            </CardHeader>
            <CardContent>
              {loading || !mounted ? (
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
                            {formatPhilippinesTime(activity.timestamp, activity.category)}
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
    {/* Archive Management Dialog */}
      {showManageArchives && (
        <Dialog open={showManageArchives} onOpenChange={(open) => {
              setShowManageArchives(open);
              if (!open) {
                setArchiveStatus(null);
                setManageArchiveMonth('');
              }
            }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Activity Archives</DialogTitle>
              <DialogDescription>
                Archive or unarchive activities by month to manage your activity log visibility.
                {!isOnline && (
                  <span className="text-orange-600 font-medium"> (Offline Mode - Operations will be queued)</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Month</label>
                <Input 
                  type="month" 
                  value={manageArchiveMonth} 
                  onChange={(e) => {
                    setManageArchiveMonth(e.target.value);
                    checkArchiveStatus(e.target.value);
                  }} 
                  className="w-full" 
                />
              </div>
              
              {/* Activity Status Display */}
              {archiveStatus && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Activity Summary for {manageArchiveMonth}</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">{archiveStatus.activeCount}</div>
                      <div className="text-gray-600">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-orange-600">{archiveStatus.archivedCount}</div>
                      <div className="text-gray-600">Archived</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-600">{archiveStatus.totalCount}</div>
                      <div className="text-gray-600">Total</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button onClick={() => handleArchiveActivities("archive")} className="flex-1" disabled={!manageArchiveMonth || isArchiving}>
                  {isArchiving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Archiving...
                    </>
                  ) : (
                    <>
                      <Archive size={16} className="mr-2" /> Archive
                    </>
                  )}
                </Button>
                <Button onClick={() => handleArchiveActivities("unarchive")} variant="outline" className="flex-1" disabled={!manageArchiveMonth || isArchiving}>
                  {isArchiving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Unarchiving...
                    </>
                  ) : (
                    <>
                      <FolderOpen size={16} className="mr-2" /> Unarchive
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowManageArchives(false)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
