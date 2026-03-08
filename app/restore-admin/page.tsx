"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle } from "lucide-react"

export default function AdminRestorePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const restoreAdmin = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/emergency/force-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (data.success) {
        setResult({
          success: true,
          message: `✅ Admin account restored successfully! Login with: admin / admin`
        })
      } else {
        setResult({
          success: false,
          message: `❌ Failed to restore admin: ${data.error}`
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: `❌ Error: ${error.message}`
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
          <CardTitle className="text-2xl">Admin Account Restore</CardTitle>
          <CardDescription>
            Click the button below to restore the administrator account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={restoreAdmin} 
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {loading ? "Restoring..." : "Restore Admin Account"}
          </Button>

          {result && (
            <div className={`p-4 rounded-lg text-center ${
              result.success 
                ? "bg-green-50 text-green-800 border border-green-200" 
                : "bg-red-50 text-red-800 border border-red-200"
            }`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <span className="font-medium">
                  {result.success ? "Success!" : "Error!"}
                </span>
              </div>
              <p className="text-sm">{result.message}</p>
              {result.success && (
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="mt-3 w-full bg-green-600 hover:bg-green-700"
                >
                  Go to Login
                </Button>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center">
            After restoring, you can login with: <strong>admin / admin</strong>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
