'use client'

import { useEffect } from 'react'

export function HydrationFix() {
  useEffect(() => {
    // Suppress browser extension hydration warnings on client side only
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = typeof args[0] === 'string' ? args[0] : '';
      
      // Suppress hydration warnings and browser extension attributes
      if (message.includes('hydration') || 
          message.includes('fdprocessedid') ||
          message.includes('server rendered HTML') ||
          message.includes('client properties')) {
        return;
      }
      
      originalConsoleError.apply(console, args);
    };
  }, [])

  return null
}
