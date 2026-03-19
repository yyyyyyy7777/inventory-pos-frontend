"use client"

import { useState, useEffect, useCallback } from "react"
import { LoginPage } from "@/components/auth/login-page"
import { AdminDashboard } from "@/components/dashboards/admin-dashboard"
import { StaffDashboard } from "@/components/dashboards/staff-dashboard"

type UserRole = "admin" | "staff" | null

const STORAGE_KEY = 'inventory-pos-session-v1'

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

  // Check for previous session on mount (handles reloads and closes)
  useEffect(() => {
    const checkPreviousSession = async () => {
      try {
        // Use localStorage instead of sessionStorage - it persists through reloads
        const stored = localStorage.getItem(STORAGE_KEY)
        console.log('Checking for previous session:', stored);
        if (stored) {
          const previousUser = JSON.parse(stored)
          if (previousUser?.username) {
            console.log('Found previous session for:', previousUser.username);
            // Log the logout activity for the interrupted session
            try {
              await logLogoutActivity(previousUser.username);
              console.log('Successfully logged logout for:', previousUser.username);
            } catch (err) {
              console.error('Failed to log reload logout:', err);
            }
            // Clear the old session after logging
            localStorage.removeItem(STORAGE_KEY)
            console.log('Cleared previous session for:', previousUser.username);
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

  // Store current user in localStorage and handle page unload
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser))

      // Handle page unload (reload/close) - DON'T clear localStorage here, let checkPreviousSession handle it
      const handleBeforeUnload = () => {
        // Try to log logout, but localStorage will persist for checkPreviousSession to find
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
    } else {
      localStorage.removeItem(STORAGE_KEY)
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
    localStorage.removeItem(STORAGE_KEY)
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
