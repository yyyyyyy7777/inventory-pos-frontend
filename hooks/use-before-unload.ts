"use client"

import { useEffect, useCallback } from "react"

export function useBeforeUnload(enabled: boolean = true, message: string = "You have unsaved changes. Are you sure you want to leave?") {
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (enabled) {
      e.preventDefault()
      e.returnValue = message
      return message
    }
  }, [enabled, message])

  useEffect(() => {
    if (enabled) {
      window.addEventListener("beforeunload", handleBeforeUnload)
    }
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [enabled, handleBeforeUnload])
}

// Hook with conditional enable based on state changes
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean, message?: string) {
  useBeforeUnload(hasUnsavedChanges, message)
}
