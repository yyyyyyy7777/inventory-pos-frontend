"use client"

import { useState, useEffect, useCallback } from "react"
import { LoginPage } from "@/components/auth/login-page"
import { AdminDashboard } from "@/components/dashboards/admin-dashboard"
import { StaffDashboard } from "@/components/dashboards/staff-dashboard"
import { useEmployees } from "@/contexts/employees-context"

type UserRole = "admin" | "staff" | null

const STORAGE_KEY = 'inventory-pos-session-v1'

export default function Home() {
  const { refreshEmployees } = useEmployees()
  const [currentUser, setCurrentUser] = useState<{ username: string; role: UserRole } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Log logout activity to database
  const logLogoutActivity = useCallback(async (username: string) => {
    try {
      // Get current client timestamp - real device time minus 8 hours
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
      
      // Direct timestamp update with client timestamp
      try {
        const updateResponse = await fetch('/api/employees/update-timestamp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, type: 'logout', clientTimestamp })
        });
        const updateData = await updateResponse.json();
        console.log('Direct logout timestamp update:', updateData);
      } catch (updateError) {
        console.error('Direct logout update failed:', updateError);
      }
      
      // REMOVED: Don't call logout-new API here to avoid duplicate activity logging
      
    } catch (error) {
      console.error('Failed to log logout activity:', error)
    }
  }, [])

  // Check for existing session on mount and restore it
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        console.log('Checking for existing session:', stored);
        if (stored) {
          const sessionData = JSON.parse(stored)
          if (sessionData?.username && sessionData?.role) {
            console.log('Restoring session for:', sessionData.username);
            // Restore the user session
            setCurrentUser({ username: sessionData.username, role: sessionData.role })
          } else {
            // Invalid session data, clear it
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch (error) {
        console.error('Error checking session:', error)
        localStorage.removeItem(STORAGE_KEY)
      } finally {
        setIsLoading(false)
      }
    }

    checkExistingSession()
  }, [])

  // Store current user in localStorage when it changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser))
      console.log('Session saved for:', currentUser.username);
    } else {
      // Only remove if explicitly logged out (not on page refresh)
      // The beforeunload handler will manage refresh scenarios
    }
  }, [currentUser])

  // Handle page unload for logout logging (but don't clear session on refresh)
  useEffect(() => {
    if (!currentUser) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only log logout if this is a real page close, not a refresh
      // We can't reliably detect refresh vs close, so we'll log it but keep session
      // The next page load will restore the session
      
      const logoutData = JSON.stringify({ username: currentUser.username })
      
      try {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: logoutData,
          keepalive: true
        }).catch(() => {
          navigator.sendBeacon('/api/auth/logout', new Blob([logoutData], { type: 'application/json' }))
        })
      } catch (e) {
        navigator.sendBeacon('/api/auth/logout', new Blob([logoutData], { type: 'application/json' }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentUser])

  const handleLogin = (username: string, role: UserRole) => {
    setCurrentUser({ username, role })
  }

  const handleLogout = async () => {
    if (currentUser?.username) {
      try {
        await logLogoutActivity(currentUser.username)
        console.log('Logout activity logged for:', currentUser.username)
        // Refresh employee data to get updated last logout time
        await refreshEmployees()
      } catch (error) {
        console.error('Failed to log logout:', error)
      }
    }
    // Clear user state and storage
    setCurrentUser(null)
    localStorage.removeItem(STORAGE_KEY)
    console.log('Session cleared - user logged out');
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    )
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-background" suppressHydrationWarning>
        <LoginPage onLogin={handleLogin} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background" suppressHydrationWarning>
      {currentUser.role === "admin" ? (
        <AdminDashboard username={currentUser.username} onLogout={handleLogout} />
      ) : (
        <StaffDashboard username={currentUser.username} onLogout={handleLogout} />
      )}
    </main>
  )
}
