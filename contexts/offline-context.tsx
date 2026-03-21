"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from "react"
import { offlineStorage } from "@/lib/offline-storage"
import { syncService } from "@/lib/sync-service"

interface OfflineContextType {
  isOnline: boolean;
  pendingCount: { sales: number; inventory: number; activities: number };
  syncStatus: { sales: { lastSync: number; pending: number } | null; inventory: { lastSync: number; pending: number } | null; activities: { lastSync: number; pending: number } | null };
  forceSync: () => Promise<void>;
  clearPendingData: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState({ sales: 0, inventory: 0, activities: 0 });
  const [syncStatus, setSyncStatus] = useState({
    sales: null as { lastSync: number; pending: number } | null,
    inventory: null as { lastSync: number; pending: number } | null,
    activities: null as { lastSync: number; pending: number } | null
  });

  useEffect(() => {
    // Initialize offline storage
    offlineStorage.init().catch(console.error);

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
      const count = await syncService.getPendingCount();
      setPendingCount(count);

      // Update sync status
      const [salesStatus, inventoryStatus, activitiesStatus] = await Promise.all([
        offlineStorage.getSyncStatus('sales'),
        offlineStorage.getSyncStatus('inventory'),
        offlineStorage.getSyncStatus('activities')
      ]);

      setSyncStatus({
        sales: salesStatus,
        inventory: inventoryStatus,
        activities: activitiesStatus
      });
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  };

  const forceSync = async () => {
    if (isOnline) {
      await syncService.syncAll();
      await updatePendingCount();
    }
  };

  const clearPendingData = async () => {
    try {
      // Clear all pending data
      const [sales, inventory, activities] = await Promise.all([
        offlineStorage.getPendingSales(),
        offlineStorage.getPendingInventory(),
        offlineStorage.getPendingActivities()
      ]);

      for (const sale of sales) {
        await offlineStorage.removePendingSale(sale.id);
      }

      for (const item of inventory) {
        await offlineStorage.removePendingInventory(item.id);
      }

      for (const activity of activities) {
        await offlineStorage.removePendingActivity(activity.id);
      }

      await updatePendingCount();
    } catch (error) {
      console.error('Failed to clear pending data:', error);
    }
  };

  return (
    <OfflineContext.Provider value={{
      isOnline,
      pendingCount,
      syncStatus,
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
