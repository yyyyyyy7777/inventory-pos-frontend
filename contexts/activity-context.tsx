"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useOffline } from './offline-context'
import { db } from '@/lib/indexeddb'
import { enhancedSyncService } from '@/lib/enhanced-sync'
import { offlineStorage } from '@/lib/offline-storage'

interface Activity {
  id: string
  timestamp: string
  username: string
  activity: string
  details?: string
  category: 'sale' | 'employee' | 'system' | 'inventory' | 'product'
  cabinet?: string
  created_at?: string
  synced?: boolean
  lastModified?: number
}

interface ActivityContextType {
  activities: Activity[]
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp' | 'created_at'>) => Promise<void>
  getActivities: () => Activity[]
  refreshActivities: () => Promise<void>
  archiveActivities: (cabinet: string, month: string) => Promise<void>
  unarchiveActivities: (cabinet: string, month: string) => Promise<void>
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
  const { isOnline } = useOffline(); // Move hook to top level

  // Load activities from IndexedDB on mount
  useEffect(() => {
    const loadFromIndexedDB = async () => {
      try {
        const allActivities = await db.activities.toArray();
        setActivities(allActivities);
        setLoading(false);
        console.log('Loaded activities from IndexedDB:', allActivities.length);
      } catch (err) {
        console.error('Error loading from IndexedDB:', err);
        // Fallback to localStorage for migration
        const cachedActivities = localStorage.getItem('cached_activities');
        if (cachedActivities) {
          try {
            const parsed = JSON.parse(cachedActivities);
            setActivities(parsed);
            setLoading(false);
            // Migrate to IndexedDB
            await db.activities.bulkPut(parsed.map((a: Activity) => ({ ...a, synced: true })));
          } catch (migrationErr) {
            console.error('Migration error:', migrationErr);
          }
        }
      }
    };
    
    loadFromIndexedDB();
  }, []);

  // Fetch activities from database
  const fetchActivities = useCallback(async (showLoading = true) => {
    try {
      // If offline, use cached data from IndexedDB
      if (!isOnline) {
        console.log('Offline mode - using cached activities from IndexedDB');
        try {
          const allActivities = await db.activities.toArray();
          if (allActivities.length > 0) {
            setActivities(allActivities);
            console.log('Loaded activities from IndexedDB:', allActivities.length);
          } else {
            console.log('No cached activities in IndexedDB');
          }
        } catch (err) {
          console.error('Error loading from IndexedDB:', err);
          setActivities([]);
        }
        return;
      }

      if (showLoading) setLoading(true)
      
      try {
        const response = await fetch('/api/activities-new?limit=1000')
        if (response.ok) {
          const data = await response.json()
          setActivities(data)
          setLastFetchTime(new Date())
          // Cache activities to IndexedDB
          try {
            await db.activities.clear();
            await db.activities.bulkPut(data.map((a: Activity) => ({ ...a, synced: true, lastModified: Date.now() })));
            console.log('Cached activities to IndexedDB:', data.length);
          } catch (cacheErr) {
            console.warn('Failed to cache to IndexedDB:', cacheErr);
          }
        } else {
          console.error('Failed to fetch activities from database, using fallback')
          // Try to use IndexedDB data as fallback
          try {
            const allActivities = await db.activities.toArray();
            if (allActivities.length > 0) {
              setActivities(allActivities);
              console.log('Using IndexedDB fallback:', allActivities.length);
            } else {
              setActivities([]);
            }
          } catch (err) {
            console.error('Error loading from IndexedDB fallback:', err);
            setActivities([]);
          }
        }
      } catch (fetchErr) {
        console.error('Network error fetching activities, using IndexedDB fallback:', fetchErr)
        // Try to use IndexedDB data as fallback
        try {
          const allActivities = await db.activities.toArray();
          if (allActivities.length > 0) {
            setActivities(allActivities);
            console.log('Using IndexedDB fallback after network error:', allActivities.length);
          } else {
            setActivities([]);
          }
        } catch (err) {
          console.error('Error loading from IndexedDB as fallback:', err);
          setActivities([]);
        }
      }
    } catch (error) {
      console.error('Unexpected error in fetchActivities:', error)
      setActivities([]);
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [isOnline])

  // Load activities on mount
  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Auto-refresh activities less aggressively to reduce cross-user load.
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Only fetch if online and tab is active
      if (navigator.onLine && document.visibilityState === 'visible') {
        // Avoid immediate refetch loops
        if (lastFetchTime && Date.now() - lastFetchTime.getTime() < 15000) {
          return;
        }
        fetchActivities(false) // Don't show loading spinner for background updates
      }
    }, 30000)

    return () => clearInterval(intervalId)
  }, [fetchActivities, lastFetchTime])

  // Process queued archive operations when coming back online
  useEffect(() => {
    if (isOnline) {
      const processQueuedOperations = async () => {
        const queuedOperations = JSON.parse(localStorage.getItem('queuedArchiveOperations') || '[]');
        
        if (queuedOperations.length > 0) {
          console.log('Processing queued archive operations:', queuedOperations.length);
          
          for (const operation of queuedOperations) {
            try {
              if (operation.action === 'archive') {
                await archiveActivities('all', operation.month);
              } else if (operation.action === 'unarchive') {
                await unarchiveActivities('all', operation.month);
              }
            } catch (error) {
              console.error('Failed to process queued archive operation:', error);
            }
          }
          
          // Clear processed operations
          localStorage.removeItem('queuedArchiveOperations');
          console.log('Processed and cleared queued archive operations');
        }
      };

      processQueuedOperations();
    }
  }, [isOnline]);

  // Listen for visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fetchActivities(false) // Refresh when user returns to tab
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchActivities])

  // Add activity to database
  const addActivity = async (activity: Omit<Activity, 'id' | 'timestamp' | 'created_at'>) => {
    // Generate timestamp outside try block so it's available in catch
    const now = new Date();
    const adjustedTime = new Date(now.getTime() - (8 * 60 * 60 * 1000));
    const month = adjustedTime.getMonth() + 1;
    const day = adjustedTime.getDate();
    const year = adjustedTime.getFullYear();
    let hours = adjustedTime.getHours();
    const minutes = adjustedTime.getMinutes();
    const seconds = adjustedTime.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const clientTimestamp = `${month}/${day}/${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
    
    try {
      const activityData = { ...activity, clientTimestamp };
      
      if (isOnline) {
        // Online: Try to save to server first
        const response = await fetch('/api/activities-new', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(activityData),
        });

        if (response.ok) {
          const newActivity = await response.json()
          // Save to IndexedDB
          await db.activities.add({ ...newActivity, synced: true, lastModified: Date.now() });
          setActivities(prev => [newActivity, ...prev])
        } else {
          throw new Error('Failed to save activity');
        }
      } else {
        // Offline: Save to IndexedDB for later sync
        const tempActivity: Activity = {
          ...activityData,
          id: `temp-${Date.now()}`,
          timestamp: clientTimestamp,
          created_at: new Date().toISOString(),
          synced: false,
          lastModified: Date.now(),
        };
        
        await db.activities.add(tempActivity);
        await enhancedSyncService.queueChange('activity', 'create', tempActivity, activity.cabinet || 'main');
        
        console.log('📱 Activity saved offline for later sync:', tempActivity.id);
        
        // Add to local state
        setActivities(prev => [tempActivity, ...prev]);
      }
    } catch (error) {
      // If online request fails, save to IndexedDB
      if (isOnline) {
        console.log('❌ Server request failed, saving activity offline:', error);
        const tempActivity: Activity = {
          ...activity,
          id: `temp-${Date.now()}`,
          timestamp: clientTimestamp,
          created_at: new Date().toISOString(),
          synced: false,
          lastModified: Date.now(),
        };
        
        await db.activities.add(tempActivity);
        await enhancedSyncService.queueChange('activity', 'create', tempActivity, activity.cabinet || 'main');
        
        setActivities(prev => [tempActivity, ...prev]);
      } else {
        console.error('Error adding activity:', error);
      }
    }
  }

  const getActivities = () => activities

  const refreshActivities = async () => {
    await fetchActivities()
  }

  const archiveActivities = async (cabinet: string, month: string) => {
    try {
      const response = await fetch('/api/activities/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          archiveMonth: month,
          cabinet: cabinet,
          action: 'archive'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to archive activities');
      }

      const result = await response.json();
      
      // Refresh activities to get updated list (excluding archived ones)
      await fetchActivities(false); // Don't show loading spinner

      console.log('Activities archived successfully:', result.archivedCount);
      return result;
    } catch (error) {
      console.error('Error archiving activities:', error);
      throw error;
    }
  }

  const unarchiveActivities = async (cabinet: string, month: string) => {
    try {
      const response = await fetch('/api/activities/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          archiveMonth: month,
          cabinet: cabinet,
          action: 'unarchive'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unarchive activities');
      }

      const result = await response.json();
      
      // Refresh activities to get updated list (including unarchived ones)
      await fetchActivities(false); // Don't show loading spinner

      console.log('Activities unarchived successfully:', result.unarchivedCount);
      return result;
    } catch (error) {
      console.error('Error unarchiving activities:', error);
      throw error;
    }
  }

  return (
    <ActivityContext.Provider value={{ activities, addActivity, getActivities, refreshActivities, archiveActivities, unarchiveActivities, loading }}>
      {children}
    </ActivityContext.Provider>
  )
}
