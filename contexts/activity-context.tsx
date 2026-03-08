"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

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

  // Fetch activities from database
  const fetchActivities = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/activities?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setActivities(data)
      } else {
        console.error('Failed to fetch activities from database')
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load activities on mount
  useEffect(() => {
    fetchActivities()
  }, [])

  // Add activity to database
  const addActivity = async (activity: Omit<Activity, 'id' | 'timestamp' | 'created_at'>) => {
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activity),
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
