"use client"

import type React from "react"
import { useState } from "react"
import { HydrationSafeButton } from "@/components/ui/hydration-safe-button"
import { HydrationSafeInput } from "@/components/ui/hydration-safe-input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"
import { useEmployees } from "@/contexts/employees-context"

interface LoginPageProps {
  onLogin: (username: string, role: "admin" | "staff") => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { getUserCredentials } = useEmployees()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Use API for authentication
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok) {
        onLogin(data.user.username, data.user.role)
      } else {
        setError(data.error || 'Invalid username or password')
      }
    } catch (error) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("/bg wheezard.jpg")',
          opacity: 0.6,
          backgroundSize: '100% 105%',
        }}
      />
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <Card className="border-2 border-primary/20 shadow-2xl bg-card/95 backdrop-blur-sm transition-all duration-300">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center mb-2">
              <img 
                src="/Wheezard logo.png" 
                alt="The Wheezard PH Logo" 
                className="w-32 h-32 object-contain"
              />
            </div>
            <CardTitle className="text-2xl">Point of Sale and Inventory System</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-foreground">
                  Username
                </label>
                <HydrationSafeInput
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-10 bg-input border-border"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <HydrationSafeInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 bg-input border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1} // Prevent focusing the button when tabbing through form
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              <HydrationSafeButton
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mb-6"
              >
                {loading ? "Signing In..." : "Sign In"}
              </HydrationSafeButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
