"use client"

import { useState } from "react"
import { LoginPage } from "@/components/auth/login-page"
import { AdminDashboard } from "@/components/dashboards/admin-dashboard"
import { StaffDashboard } from "@/components/dashboards/staff-dashboard"

type UserRole = "admin" | "staff" | null

export default function Home() {
  const [currentUser, setCurrentUser] = useState<{ username: string; role: UserRole } | null>(null)

  const handleLogin = (username: string, role: UserRole) => {
    setCurrentUser({ username, role })
  }

  const handleLogout = () => {
    setCurrentUser(null)
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
