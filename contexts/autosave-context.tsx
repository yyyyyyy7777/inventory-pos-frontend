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
        if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
          return
        }
        // POS cart: only persist when there is something to restore (avoids junk + stale keys).
        if (key.startsWith("pos-cart-")) {
          const cart = (data as { cart?: unknown }).cart
          if (!Array.isArray(cart) || cart.length === 0) {
            return
          }
        }
        dataToSave[key] = {
          key,
          data,
          timestamp: Date.now(),
        }
      } catch (e) {
        console.error(`Failed to autosave ${key}:`, e)
      }
    })

    try {
      const existing = localStorage.getItem(STORAGE_KEY)
      const existingData = existing ? JSON.parse(existing) : {}
      const merged: Record<string, AutosaveData> = { ...existingData, ...dataToSave }

      // Drop pos-cart-* snapshots when the live form currently has an empty cart,
      // so we do not keep re-offering restore after the cart was cleared.
      formsRef.current.forEach((getData, key) => {
        if (!key.startsWith("pos-cart-")) return
        try {
          const data = getData() as { cart?: unknown } | null
          const cart = data?.cart
          if (!Array.isArray(cart) || cart.length === 0) {
            delete merged[key]
          }
        } catch {
          /* ignore */
        }
      })

      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))

      // Keep in-memory restore map aligned with disk without pointless rerenders.
      setRestoredData((prev) => {
        const next = new Map(prev)
        let changed = false

        Object.keys(dataToSave).forEach((k) => {
          const payload = dataToSave[k].data
          const prevVal = next.get(k)
          const same =
            prevVal !== undefined &&
            JSON.stringify(prevVal) === JSON.stringify(payload)
          if (!same) {
            next.set(k, payload)
            changed = true
          }
        })

        formsRef.current.forEach((getData, key) => {
          if (!key.startsWith("pos-cart-")) return
          try {
            const data = getData() as { cart?: unknown } | null
            const cart = data?.cart
            if (!Array.isArray(cart) || cart.length === 0) {
              if (next.has(key)) {
                next.delete(key)
                changed = true
              }
            }
          } catch {
            /* ignore */
          }
        })

        Array.from(next.keys()).forEach((k) => {
          if (!(k in merged)) {
            next.delete(k)
            changed = true
          }
        })

        return changed ? next : prev
      })
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
  onRestore?: (data: T) => void,
  options?: {
    /** If set, restore dialog only when this returns true (e.g. non-empty cart). */
    shouldOfferRestore?: (data: T) => boolean
  }
) {
  const { registerForm, unregisterForm, clearData, hasRestorableData } = useAutosave()
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [pendingRestoreData, setPendingRestoreData] = useState<T | null>(null)
  const onRestoreRef = useRef(onRestore)
  const shouldOfferRef = useRef(options?.shouldOfferRestore)
  /** After accept/reject, do not auto-open again for this formKey (autosave map can refill from periodic save). */
  const restorePromptHandledRef = useRef(false)
  const dismissSessionKey = `autosave_dismissed_${formKey}`
  onRestoreRef.current = onRestore
  shouldOfferRef.current = options?.shouldOfferRestore

  // Register form for autosaving
  useEffect(() => {
    registerForm(formKey, () => currentData)
    return () => unregisterForm(formKey)
  }, [formKey, currentData, registerForm, unregisterForm])

  useEffect(() => {
    restorePromptHandledRef.current = false
  }, [formKey])

  // Offer restore only from persisted snapshot from a previous session.
  // Do NOT react to in-session autosave updates (prevents random popup while adding to cart).
  useEffect(() => {
    if (typeof window === "undefined") return
    if (restorePromptHandledRef.current) return
    if (sessionStorage.getItem(dismissSessionKey) === "1") return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    let parsed: Record<string, AutosaveData>
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    const entry = parsed?.[formKey]
    if (!entry) return
    if (!entry.timestamp || Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) return
    const saved = entry.data as T
    if (saved == null || !onRestoreRef.current) return
    const offer =
      shouldOfferRef.current != null ? shouldOfferRef.current(saved) : true
    if (!offer) return
    setPendingRestoreData(saved)
    setShowRestorePrompt(true)
  }, [formKey, dismissSessionKey])

  const acceptRestore = useCallback(() => {
    restorePromptHandledRef.current = true
    if (typeof window !== "undefined") {
      sessionStorage.setItem(dismissSessionKey, "1")
    }
    const data = pendingRestoreData
    if (data != null) {
      onRestoreRef.current?.(data)
    }
    clearData(formKey)
    setShowRestorePrompt(false)
    setPendingRestoreData(null)
  }, [pendingRestoreData, clearData, formKey, dismissSessionKey])

  const rejectRestore = useCallback(() => {
    restorePromptHandledRef.current = true
    if (typeof window !== "undefined") {
      sessionStorage.setItem(dismissSessionKey, "1")
    }
    clearData(formKey)
    setShowRestorePrompt(false)
    setPendingRestoreData(null)
  }, [clearData, formKey, dismissSessionKey])

  return {
    showRestorePrompt,
    acceptRestore,
    rejectRestore,
    hasRestorableData: hasRestorableData(formKey)
  }
}
