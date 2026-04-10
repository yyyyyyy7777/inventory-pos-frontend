"use client"

import React, { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

interface ErrorBoundaryProps {
  children: ReactNode
  /** fullscreen = whole app (default); section = inline panel with local retry */
  variant?: "fullscreen" | "section"
  sectionTitle?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const variant = this.props.variant ?? "fullscreen"
      if (variant === "section") {
        return (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
            <div className="flex justify-center">
              <AlertTriangle size={40} className="text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {this.props.sectionTitle || "Something went wrong in this panel"}
            </h2>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="block w-full text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              Reload page
            </button>
          </div>
        )
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
          <div className="max-w-md text-center">
            <div className="flex justify-center mb-4"><AlertTriangle size={48} className="text-yellow-500" /></div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
