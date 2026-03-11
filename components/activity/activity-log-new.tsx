"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, Calendar, User, Activity, RefreshCw, X } from "lucide-react"
import { useActivity } from "@/contexts/activity-context"

export function ActivityLogView({ isAdmin }: { isAdmin: boolean }) {
  const { getActivities, loading, refreshActivities } = useActivity()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const activities = getActivities()

  // Simple Philippines time formatter - display stored time directly
  const formatPhilippinesTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return 'Invalid time'
      
      // Display the stored Philippines time directly (no conversion)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'UTC' // Use UTC to avoid additional timezone conversion
      })
    } catch (error) {
      return 'Invalid time'
    }
  }

  const filteredActivities = activities
    .filter(activity => {
      const searchLower = searchQuery.toLowerCase()
      return activity.username.toLowerCase().includes(searchLower) ||
             activity.activity.toLowerCase().includes(searchLower) ||
             activity.details.toLowerCase().includes(searchLower)
    })
    .slice(0, 50) // Show latest 50

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Latest activities (Philippines Time)</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <Button onClick={refreshActivities} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Activities List */}
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
                <div key={activity.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{activity.activity}</h4>
                      <p className="text-sm text-muted-foreground">by {activity.username}</p>
                      <p className="text-sm mt-2 bg-gray-50 p-2 rounded">{activity.details}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
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
  )
}
