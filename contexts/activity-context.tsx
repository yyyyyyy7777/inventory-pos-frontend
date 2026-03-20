"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface Activity {
  id: string
  timestamp: string
  username: string
  activity: string
  details: string
  category: 'product' | 'sale' | 'employee' | 'system' | 'inventory'
  cabinet?: string
  created_at?: string
}

interface ActivityContextType {
  activities: Activity[]
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp' | 'created_at'>) => Promise<void>
  getActivities: () => Activity[]
  refreshActivities: () => Promise<void>
  loading: boolean
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined)

export function useActivity() {
  const context = useContext(ActivityContext)
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider')
  }
  return context
}

interface ActivityProviderProps {
  children: React.ReactNode
}

export function ActivityProvider({ children }: ActivityProviderProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null)

  // Fetch activities from database
  const fetchActivities = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      const response = await fetch('/api/activities-new?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setActivities(data)
        setLastFetchTime(new Date())
      } else {
        console.error('Failed to fetch activities from database')
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  // Load activities on mount
  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Auto-refresh activities every 5 seconds (background polling)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchActivities(false) // Don't show loading spinner for background updates
    }, 5000)

    return () => clearInterval(intervalId)
  }, [fetchActivities])

  // Listen for visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchActivities(false) // Refresh when user returns to tab
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchActivities])

  // Add activity to database
  const addActivity = async (activity: Omit<Activity, 'id' | 'timestamp' | 'created_at'>) => {
    try {
      // Generate client timestamp with explicit local timezone (subtract 8 hours)
      const now = new Date();
      const adjustedTime = new Date(now.getTime() - (8 * 60 * 60 * 1000));
      const hours = adjustedTime.getHours();
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      // Add timezone offset to make it clear this is local time
      const tzOffset = -now.getTimezoneOffset() / 60; // Hours from UTC
      const tzSign = tzOffset >= 0 ? '+' : '-';
      const clientTimestamp = `${adjustedTime.getMonth() + 1}/${adjustedTime.getDate()}/${adjustedTime.getFullYear()}, ${displayHours}:${adjustedTime.getMinutes().toString().padStart(2, '0')}:${adjustedTime.getSeconds().toString().padStart(2, '0')} ${ampm} (UTC${tzSign}${Math.abs(tzOffset)})`;
      
      const response = await fetch('/api/activities-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...activity, clientTimestamp }),
      })

      if (response.ok) {
        const newActivity = await response.json()
        setActivities(prev => [newActivity, ...prev])
      } else {
        console.error('Failed to add activity to database')
      }
    } catch (error) {
      console.error('Error adding activity:', error)
    }
  }

  const getActivities = () => activities

  const refreshActivities = async () => {
    await fetchActivities()
  }

  return (
    <ActivityContext.Provider value={{ activities, addActivity, getActivities, refreshActivities, loading }}>
      {children}
    </ActivityContext.Provider>
  )
}
