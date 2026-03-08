"use client"

import { forwardRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export interface HydrationSafeInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const HydrationSafeInput = forwardRef<HTMLInputElement, HydrationSafeInputProps>(
  ({ className, type, ...props }, ref) => {
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
      setIsClient(true)
    }, [])

    // Remove any browser extension attributes that cause hydration issues
    const cleanProps = { ...props }
    if ('fdprocessedid' in cleanProps) {
      delete (cleanProps as any).fdprocessedid
    }
    if ('data-testid' in cleanProps) {
      delete (cleanProps as any)['data-testid']
    }
    if ('data-form-type' in cleanProps) {
      delete (cleanProps as any)['data-form-type']
    }

    if (!isClient) {
      // Return a simplified version during SSR to avoid hydration mismatch
      return (
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...cleanProps}
          suppressHydrationWarning
        />
      )
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...cleanProps}
      />
    )
  }
)
HydrationSafeInput.displayName = "HydrationSafeInput"

export { HydrationSafeInput }
