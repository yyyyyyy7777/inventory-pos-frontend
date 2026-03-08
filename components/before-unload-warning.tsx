"use client"

import { useBeforeUnload } from "@/hooks/use-before-unload"

export function BeforeUnloadWarning() {
  // Enable warning for all page refreshes/closes
  useBeforeUnload(true, "Are you sure you want to leave? Any unsaved changes may be lost.")
  
  return null
}
