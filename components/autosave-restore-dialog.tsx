"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAutosave } from "@/contexts/autosave-context"
import { useEffect, useState } from "react"
import { RotateCcw, X } from "lucide-react"

export function AutosaveRestoreDialog() {
  const { getAllRestorableKeys, restoreData, clearData } = useAutosave()
  const [open, setOpen] = useState(false)
  const [restorableKeys, setRestorableKeys] = useState<string[]>([])

  useEffect(() => {
    const keys = getAllRestorableKeys()
    if (keys.length > 0) {
      setRestorableKeys(keys)
      setOpen(true)
    }
  }, [getAllRestorableKeys])

  const handleRestore = (key: string) => {
    const data = restoreData(key)
    // Emit custom event for the specific form to handle
    window.dispatchEvent(new CustomEvent("autosave:restore", { detail: { key, data } }))
    clearData(key)
    setRestorableKeys(prev => prev.filter(k => k !== key))
    if (restorableKeys.length <= 1) {
      setOpen(false)
    }
  }

  const handleDismissAll = () => {
    restorableKeys.forEach(key => clearData(key))
    setOpen(false)
    setRestorableKeys([])
  }

  const getFormLabel = (key: string) => {
    const labels: Record<string, string> = {
      "new-product": "New Product Form",
      "edit-product": "Edit Product Form",
      "new-sale": "New Sale",
      "new-employee": "New Employee Form",
      "edit-employee": "Edit Employee Form",
      "remittance": "Remittance Form",
      "settings": "Settings"
    }
    return labels[key] || key
  }

  if (restorableKeys.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Restore Unsaved Data?
          </DialogTitle>
          <DialogDescription>
            We found unsaved data from your previous session. Would you like to restore it?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {restorableKeys.map(key => (
            <div key={key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium">{getFormLabel(key)}</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleRestore(key)}>
                  Restore
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  clearData(key)
                  setRestorableKeys(prev => prev.filter(k => k !== key))
                }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={handleDismissAll}>
            Dismiss All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
