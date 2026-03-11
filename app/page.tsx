"use client"

import { useState, useEffect, useCallback } from "react"
import { LoginPage } from "@/components/auth/login-page"
import { AdminDashboard } from "@/components/dashboards/admin-dashboard"
import { StaffDashboard } from "@/components/dashboards/staff-dashboard"

type UserRole = "admin" | "staff" | null

const STORAGE_KEY = "currentUserSession"

export default function Home() {
  const [currentUser, setCurrentUser] = useState<{ username: string; role: UserRole } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Log logout activity to database
  const logLogoutActivity = useCallback(async (username: string) => {
    try {
      // Call logout API which logs the activity
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
    } catch (error) {
      console.error('Failed to log logout activity:', error)
    }
  }, [])

  // Check for previous session on mount and log it out
  useEffect(() => {
    const checkPreviousSession = async () => {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY)
        if (stored) {
          const previousUser = JSON.parse(stored)
          if (previousUser?.username) {
            // Log the logout for the previous session
            await logLogoutActivity(previousUser.username)
          }
        }
      } catch (error) {
        console.error('Error checking previous session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkPreviousSession()
  }, [logLogoutActivity])

  // Store current user in sessionStorage and handle page unload
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser))

      // Handle page unload (reload/close) - log logout
      const handleBeforeUnload = () => {
        // Use sendBeacon for reliable delivery during page unload
        const logoutData = JSON.stringify({ username: currentUser.username })
        navigator.sendBeacon('/api/auth/logout', new Blob([logoutData], { type: 'application/json' }))
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [currentUser])

  const handleLogin = (username: string, role: UserRole) => {
    setCurrentUser({ username, role })
  }

  const handleLogout = async () => {
    if (currentUser?.username) {
      await logLogoutActivity(currentUser.username)
    }
    setCurrentUser(null)
    sessionStorage.removeItem(STORAGE_KEY)
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
