"use client"

import { createContext, useContext, ReactNode, useState, useCallback, useRef, useEffect } from "react"

interface AutosaveData {
  key: string
  data: any
  timestamp: number
}

interface AutosaveContextType {
  registerForm: (key: string, getData: () => any) => void
  unregisterForm: (key: string) => void
  restoreData: (key: string) => any | null
  clearData: (key: string) => void
  hasRestorableData: (key: string) => boolean
  getAllRestorableKeys: () => string[]
}

const AutosaveContext = createContext<AutosaveContextType | undefined>(undefined)

const STORAGE_KEY = "wheezard_autosave"

export function AutosaveProvider({ children }: { children: ReactNode }) {
  const formsRef = useRef<Map<string, () => any>>(new Map())
  const [restoredData, setRestoredData] = useState<Map<string, any>>(new Map())

  // Load saved data on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const dataMap = new Map<string, any>()
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          // Only keep data less than 24 hours old
          if (Date.now() - value.timestamp < 24 * 60 * 60 * 1000) {
            dataMap.set(key, value.data)
          }
        })
        setRestoredData(dataMap)
      }
    } catch (e) {
      console.error("Failed to load autosave data:", e)
    }
  }, [])

  const registerForm = useCallback((key: string, getData: () => any) => {
    formsRef.current.set(key, getData)
  }, [])

  const unregisterForm = useCallback((key: string) => {
    formsRef.current.delete(key)
  }, [])

  const saveAllData = useCallback(() => {
    const dataToSave: Record<string, AutosaveData> = {}
    
    formsRef.current.forEach((getData, key) => {
      try {
        const data = getData()
        if (data && Object.keys(data).length > 0) {
          dataToSave[key] = {
            key,
            data,
            timestamp: Date.now()
          }
        }
      } catch (e) {
        console.error(`Failed to autosave ${key}:`, e)
      }
    })

    // Merge with existing saved data
    try {
      const existing = localStorage.getItem(STORAGE_KEY)
      const existingData = existing ? JSON.parse(existing) : {}
      const merged = { ...existingData, ...dataToSave }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    } catch (e) {
      console.error("Failed to save autosave data:", e)
    }
  }, [])

  const restoreData = useCallback((key: string) => {
    return restoredData.get(key) || null
  }, [restoredData])

  const clearData = useCallback((key: string) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        delete parsed[key]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      }
      setRestoredData(prev => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
    } catch (e) {
      console.error("Failed to clear autosave data:", e)
    }
  }, [])

  const hasRestorableData = useCallback((key: string) => {
    return restoredData.has(key)
  }, [restoredData])

  const getAllRestorableKeys = useCallback(() => {
    return Array.from(restoredData.keys())
  }, [restoredData])

  // Save data before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveAllData()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    
    // Also save periodically every 30 seconds
    const interval = setInterval(() => {
      saveAllData()
    }, 30000)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      clearInterval(interval)
    }
  }, [saveAllData])

  return (
    <AutosaveContext.Provider
      value={{
        registerForm,
        unregisterForm,
        restoreData,
        clearData,
        hasRestorableData,
        getAllRestorableKeys
      }}
    >
      {children}
    </AutosaveContext.Provider>
  )
}

export function useAutosave() {
  const context = useContext(AutosaveContext)
  if (context === undefined) {
    throw new Error("useAutosave must be used within an AutosaveProvider")
  }
  return context
}

// Hook for individual forms
export function useFormAutosave<T>(
  formKey: string,
  currentData: T,
  onRestore?: (data: T) => void
) {
  const { registerForm, unregisterForm, restoreData, clearData, hasRestorableData } = useAutosave()
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [pendingRestoreData, setPendingRestoreData] = useState<T | null>(null)

  // Register form for autosaving
  useEffect(() => {
    registerForm(formKey, () => currentData)
    return () => unregisterForm(formKey)
  }, [formKey, currentData, registerForm, unregisterForm])

  // Check for restorable data on mount
  useEffect(() => {
    if (hasRestorableData(formKey)) {
      const saved = restoreData(formKey)
      if (saved && onRestore) {
        setPendingRestoreData(saved)
        setShowRestorePrompt(true)
      }
    }
  }, [formKey, hasRestorableData, restoreData, onRestore])

  const acceptRestore = useCallback(() => {
    if (pendingRestoreData && onRestore) {
      onRestore(pendingRestoreData)
    }
    clearData(formKey)
    setShowRestorePrompt(false)
    setPendingRestoreData(null)
  }, [pendingRestoreData, onRestore, clearData, formKey])

  const rejectRestore = useCallback(() => {
    clearData(formKey)
    setShowRestorePrompt(false)
    setPendingRestoreData(null)
  }, [clearData, formKey])

  return {
    showRestorePrompt,
    acceptRestore,
    rejectRestore,
    hasRestorableData: hasRestorableData(formKey)
  }
}
