"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from "react"
import { enhancedSyncService } from "@/lib/enhanced-sync"

interface OfflineContextType {
  isOnline: boolean;
  pendingCount: { indexedDB: number };
  forceSync: () => Promise<void>;
  clearPendingData: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true); // Default to true for SSR
  const [pendingCount, setPendingCount] = useState({ indexedDB: 0 });

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    // Set initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      updatePendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update pending count every 5 seconds
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const updatePendingCount = async () => {
    try {
      const status = await enhancedSyncService.getSyncStatus();
      setPendingCount({ indexedDB: status.pendingCount.indexedDB });
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  };

  const forceSync = async () => {
    if (isOnline) {
      await enhancedSyncService.syncAll();
      await updatePendingCount();
    }
  };

  const clearPendingData = async () => {
    try {
      await enhancedSyncService.forceClearProblematicItems();
      await updatePendingCount();
    } catch (error) {
      console.error('Failed to clear pending data:', error);
    }
  };

  return (
    <OfflineContext.Provider value={{
      isOnline,
      pendingCount,
      forceSync,
      clearPendingData
    }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
