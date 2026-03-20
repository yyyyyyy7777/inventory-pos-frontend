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
  const { getUserCredentials, refreshEmployees } = useEmployees()
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
      // Get current client timestamp - real device time
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const year = now.getFullYear();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const clientTimestamp = `${month}/${day}/${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
      
      console.log('=== LOGIN PAGE DEBUG ===');
      console.log('Current client time:', now.toString());
      console.log('Client timestamp being sent:', clientTimestamp);
      
      // Use new API for authentication
      const response = await fetch('/api/auth/login-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, clientTimestamp }),
      })

      console.log('=== LOGIN RESPONSE DEBUG ===');
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const data = await response.json()
      console.log('Response data:', data);

      if (response.ok) {
        // Direct timestamp update with client timestamp
        try {
          const updateResponse = await fetch('/api/employees/update-timestamp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, type: 'login', clientTimestamp })
          });
          const updateData = await updateResponse.json();
          console.log('Direct timestamp update:', updateData);
        } catch (updateError) {
          console.error('Direct update failed:', updateError);
        }
        
        // Refresh employee data to get updated last login time
        await refreshEmployees();
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 sm:px-6">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("/bg wheezard.jpg")',
          opacity: 0.6,
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <Card className="border-2 border-primary/20 shadow-2xl bg-card/95 backdrop-blur-sm transition-all duration-300">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="flex justify-center mb-2">
              <img 
                src="/Wheezard logo.png" 
                alt="The Wheezard PH Logo" 
                className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain"
              />
            </div>
            <CardTitle className="text-lg sm:text-xl md:text-2xl leading-tight">Point of Sale and Inventory System</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-foreground">
                  Username
                </label>
                <HydrationSafeInput
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 sm:h-12 text-base bg-input border-border"
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
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
                    className="h-11 sm:h-12 text-base bg-input border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
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
                className="w-full h-11 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-2"
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
