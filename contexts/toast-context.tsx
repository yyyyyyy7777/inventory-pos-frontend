"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = "info", duration?: number) => {
    const id =
      (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    // Use longer duration for error messages to ensure users notice them
    const defaultDuration = type === "error" ? 6000 : type === "warning" ? 5000 : 3000
    const finalDuration = duration !== undefined ? duration : defaultDuration
    const newToast: Toast = { id, message, type, duration: finalDuration }

    // Limit to maximum 3 toasts at once
    setToasts((prev) => {
      const updatedToasts = [...prev, newToast]
      // Keep only the latest 3 toasts
      if (updatedToasts.length > 3) {
        return updatedToasts.slice(-3)
      }
      return updatedToasts
    })

    if (finalDuration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, finalDuration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}
