"use client"

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useProducts } from './products-context';
import { useOffline } from './offline-context';
import { db } from '@/lib/indexeddb';
import { enhancedSyncService } from '@/lib/enhanced-sync';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

// Client-side UUID generator
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface SaleItem {
  id?: number;
  productName: string;
  category: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  costPrice?: number;
  isDiscounted?: boolean;
  profit?: number;
}

export interface SalesRecord {
  id: string;
  date: string;
  items: SaleItem[];
  amount: number;
  paymentMethod: string;
  staffName: string;
  cabinet: string;
  soldAt: 'online' | 'physical';
  requestKey?: string;
  referenceNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  synced?: boolean;
  lastModified?: number;
}

interface SalesContextType {
  sales: SalesRecord[];
  loading: boolean;
  error: string | null;
  addSale: (sale: Omit<SalesRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSale: (id: string, updates: Partial<SalesRecord>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  getSalesByCabinet: (cabinet: string) => SalesRecord[];
  refreshSales: (cabinet: string) => Promise<void>;
  addUnarchivedSales: (sales: SalesRecord[]) => void;
  archiveSalesInState: (cabinet: string, month: string) => void;
  retryFailedSales: () => Promise<void>;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export function SalesProvider({ children }: { children: ReactNode }) {
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { isOnline } = useOffline(); // Move hook to top level

  // Load sales from server when online, or IndexedDB when offline
  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      try {
        // If online, fetch from server first
        if (isOnline) {
          console.log('🌐 Online - fetching sales from server...');
          try {
            const response = await fetch('/api/sales');
            if (response.ok) {
              const data = await response.json();
              console.log('📊 Sales loaded from API:', data.length, 'sales');
              setSales(data);
              // Update IndexedDB with fresh server data
              await cacheSales(data);
              return; // Exit early since we have server data
            }
          } catch (apiErr) {
            console.warn('⚠️ Failed to fetch from server, falling back to IndexedDB:', apiErr);
          }
        }
        
        // Offline or server failed: load from IndexedDB
        console.log('📱 Loading sales from IndexedDB...');
        const allSales = await db.sales.toArray();
        setSales(allSales);
        console.log('Loaded sales from IndexedDB:', allSales.length);
      } catch (err) {
        console.error('Error loading sales:', err);
        // Fallback to localStorage for migration
        const cachedSales = localStorage.getItem('cached_sales');
        if (cachedSales) {
          try {
            const parsed = JSON.parse(cachedSales);
            setSales(parsed);
            // Migrate to IndexedDB
            await db.sales.bulkPut(parsed.map((s: SalesRecord) => ({ ...s, synced: true })));
          } catch (migrationErr) {
            console.error('Migration error:', migrationErr);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadSales();
  }, [isOnline]);

  // Cache sales to IndexedDB
  const cacheSales = async (salesData: SalesRecord[]) => {
    try {
      await db.sales.clear();
      await db.sales.bulkPut(salesData.map(s => ({ ...s, synced: true, lastModified: Date.now() })));
      console.log('Cached sales to IndexedDB:', salesData.length);
    } catch (err) {
      console.error('Error caching to IndexedDB:', err);
      // Fallback to localStorage
      localStorage.setItem('cached_sales', JSON.stringify(salesData));
    }
  };

  const refreshSales = useCallback(async (cabinet: string) => {
    try {
      // If offline, don't try to fetch - use cached data
      if (!isOnline) {
        console.log('Offline mode - using cached sales');
        return;
      }

      // Keep this refresh lightweight; avoid forcing global loading state
      // for background sync checks.
      setError(null);
      const response = await fetch(`/api/sales?cabinet=${cabinet}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn('refreshSales: API returned non-OK response', {
          status: response.status,
          statusText: response.statusText,
          cabinet,
          details: errorText
        });
        // Do not throw here; keep current data and fallback path below.
        return;
      }
      
      const data = await response.json();
      console.log('Raw API response:', data);
      setSales(data);
      cacheSales(data);
    } catch (err) {
      console.warn('refreshSales: fetch failed, using cached fallback when possible:', err);
      
      // If fetch fails and we have IndexedDB data, use that
      try {
        const allSales = await db.sales.toArray();
        if (allSales.length > 0) {
          setSales(allSales);
          setError(null);
          console.log('Fallback to IndexedDB:', allSales.length, 'sales');
        }
      } catch (cacheErr) {
        console.warn('refreshSales: IndexedDB fallback failed:', cacheErr);
      }
    }
  }, [isOnline]);

  // Realtime cross-user sales updates (admin/staff)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) return;

    let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return;
    }

    let t: any = null;
    const schedule = (cabinet?: string) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        refreshSales(cabinet || 'main').catch(() => {
          // Silent fail to avoid “errors” in normal offline/online transitions.
        });
      }, 500);
    };

    const channel = supabase
      .channel('realtime-sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale' }, (payload: any) => {
        const row = payload?.new || payload?.old;
        schedule(row?.cabinet);
      })
      .subscribe();

    return () => {
      if (t) clearTimeout(t);
      supabase?.removeChannel(channel);
    };
  }, [refreshSales]);

  // Note:
  // We intentionally avoid periodic full-list polling here.
  // Sales are already kept fresh by:
  // 1) realtime subscriptions above, and
  // 2) explicit refreshes after critical actions (e.g. processing a sale).
  // This prevents multi-user request storms that slow down dashboard/POS loading.

  const updateBatchQuantitiesAfterSale = async (items: any[], cabinet: string) => {
  try {
    console.log('Updating batch quantities for sale items:', items);
    
    // Import price cache clearing function
    const { clearPriceCacheOnBatchUpdate } = await import('../lib/batch-price');
    
    // Track products that need price cache clearing
    const productsToUpdate = new Set<string>();
    
    for (const item of items) {
      // Find product by name since sale items don't have productId
      const products = await db.products
        .where({ name: item.productName, cabinet: cabinet })
        .toArray();
      
      if (products.length === 0) {
        console.warn(`Product not found: ${item.productName} in cabinet ${cabinet}`);
        continue;
      }
      
      const product = products[0]; // Use first match
      console.log(`Found product: ${product.name} with ID: ${product.id}`);
      
      // Get batches for this product in FIFO order (oldest on-shelf first)
      const batches = await db.stockBatches
        .where({ productId: String(product.id), cabinet: cabinet })
        .toArray();
      
      // Sort by FIFO: oldest on-shelf first, then by date
      const sortedBatches = batches.sort((a, b) => {
        // On-shelf batches come first
        if (a.status === 'on-shelf' && b.status !== 'on-shelf') return -1;
        if (b.status === 'on-shelf' && a.status !== 'on-shelf') return 1;
        
        // Then by date (oldest first for FIFO)
        const aDate = new Date(a.addedDate || 0).getTime();
        const bDate = new Date(b.addedDate || 0).getTime();
        return aDate - bDate;
      });
      
      console.log('Batches for product', product.id, ':', sortedBatches.map(b => ({id: b.id, quantity: b.quantity, status: b.status})));
      
      let remainingQuantity = item.quantity;
      let batchUpdated = false;
      
      for (const batch of sortedBatches) {
        if (remainingQuantity <= 0) break;
        
        if (batch.quantity > 0) {
          const quantityToDeduct = Math.min(remainingQuantity, batch.quantity);
          const newQuantity = batch.quantity - quantityToDeduct;
          
          console.log(`Deducting ${quantityToDeduct} from batch ${batch.id}, new quantity: ${newQuantity}`);
          
          // Update batch quantity
          await db.stockBatches.update(batch.id, {
            quantity: newQuantity,
            lastModified: Date.now()
          });
          
          remainingQuantity -= quantityToDeduct;
          batchUpdated = true;
        }
      }
      
      // Only clear cache if batches were actually updated
      if (batchUpdated) {
        productsToUpdate.add(String(product.id));
      }
      
      if (remainingQuantity > 0) {
        console.warn(`Insufficient stock for product ${product.name}. Still need ${remainingQuantity} units.`);
      }
      
      // Update product stock to reflect batch changes (only if not already handled by POS)
      // Check if this sale is being processed by POS (which already handles stock depletion)
      const isPOSSale = items.some((item: any) => 
        item.costPrice !== undefined // POS items have costPrice set
      );
      
      if (!isPOSSale) {
        const updatedBatches = await db.stockBatches
          .where({ productId: String(product.id), cabinet: cabinet })
          .toArray();
        
        const totalStock = updatedBatches.reduce((sum, batch) => sum + batch.quantity, 0);
        
        await db.products.update(product.id, {
          stock: totalStock,
          lastModified: Date.now()
        });
        
        console.log(`Updated product ${product.name} stock to ${totalStock} (non-POS sale)`);
      } else {
        console.log(`Skipping stock update for ${product.name} - handled by POS depletion logic`);
      }
    }
    
    // Batch clear price cache for all affected products
    if (productsToUpdate.size > 0) {
      console.log(`Clearing price cache for ${productsToUpdate.size} products:`, Array.from(productsToUpdate));
      for (const productId of productsToUpdate) {
        clearPriceCacheOnBatchUpdate(productId, cabinet);
      }
    }
    
    console.log('Batch quantities updated successfully');
  } catch (error) {
    console.error('Error updating batch quantities:', error);
    // Don't throw error - sale should still complete even if batch update fails
  }
};

const addSale = async (sale: Omit<SalesRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      setError(null);
      
      // Generate sale ID and timestamps
      const saleId = generateUUID();
      const now = new Date().toISOString();
      
      const saleRecord: SalesRecord = {
        ...sale,
        id: saleId,
        createdAt: now,
        updatedAt: now,
        synced: false,
        lastModified: Date.now(),
      };
      
      // Always save to IndexedDB first
      await db.sales.add(saleRecord);
      
      // Update local state immediately for responsive UI
      setSales(prev => [saleRecord, ...prev]);
      
      // Update batch quantities asynchronously to avoid blocking sale completion
      updateBatchQuantitiesAfterSale(sale.items, sale.cabinet).catch(error => {
        console.error('Background batch update failed:', error);
      });
      
      // Dispatch event for real-time analytics updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('newTransaction', {
          detail: {
            sale: saleRecord,
            cabinet: sale.cabinet,
            amount: sale.amount,
            timestamp: now
          }
        }));
      }
      
      if (isOnline) {
        // Online: sync in background so POS "processing" is not blocked by network latency.
        void (async () => {
          try {
            const response = await fetch('/api/sales', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(sale),
            });

            if (response.ok) {
              const newSale = await response.json();
              // Update with server response and mark as synced
              await db.sales.update(saleId, { ...newSale, synced: true });
              setSales(prev => prev.map(s => s.id === saleId ? { ...newSale, synced: true } : s));
              console.log('✅ Sale synced to server successfully:', newSale.id);
            } else {
              const errorText = await response.text();
              console.log('❌ Server failed to create sale, keeping locally:', errorText);
              await enhancedSyncService.queueChange('sale', 'create', saleRecord, sale.cabinet);
            }
          } catch (error) {
            console.log('❌ Server request failed, keeping sale locally:', error);
            await enhancedSyncService.queueChange('sale', 'create', saleRecord, sale.cabinet);
          }
        })();
      } else {
        // Offline: Queue for later sync
        await enhancedSyncService.queueChange('sale', 'create', saleRecord, sale.cabinet);
        console.log('📱 Sale saved offline for later sync:', saleId);
      }
    } catch (error) {
      console.error('Error adding sale:', error);
      setError(error instanceof Error ? error.message : 'Failed to add sale');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateSale = async (id: string, updates: Partial<SalesRecord>) => {
    try {
      setLoading(true);
      setError(null);
      
      // Update in IndexedDB first
      const updateData: Partial<SalesRecord> = { 
        ...updates, 
        synced: false, 
        lastModified: Date.now(),
      };
      await db.sales.update(id, updateData);
      
      // Update local state
      setSales(prev => 
        prev.map(sale => (sale.id === id ? { ...sale, ...updates, synced: false } : sale))
      );
      
      if (isOnline) {
        // Try to sync to server
        try {
          const response = await fetch(`/api/sales/${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });

          if (response.ok) {
            const updatedSale = await response.json();
            // Mark as synced in IndexedDB
            await db.sales.update(id, { ...updatedSale, synced: true });
            setSales(prev => 
              prev.map(sale => (sale.id === id ? { ...updatedSale, synced: true } : sale))
            );
          } else {
            // Queue for later sync
            const sale = await db.sales.get(id);
            if (sale) {
              await enhancedSyncService.queueChange('sale', 'update', { id, updates, cabinet: sale.cabinet }, sale.cabinet);
            }
          }
        } catch (error) {
          console.log('❌ Server update failed, queued for sync:', error);
          const sale = await db.sales.get(id);
          if (sale) {
            await enhancedSyncService.queueChange('sale', 'update', { id, updates, cabinet: sale.cabinet }, sale.cabinet);
          }
        }
      } else {
        // Offline: queue for sync
        const sale = await db.sales.get(id);
        if (sale) {
          await enhancedSyncService.queueChange('sale', 'update', { id, updates, cabinet: sale.cabinet }, sale.cabinet);
        }
      }
    } catch (err) {
      console.error('Error updating sale:', err);
      setError(err instanceof Error ? err.message : 'Failed to update sale');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteSale = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get sale for cabinet info before deleting
      const sale = await db.sales.get(id);
      const cabinet = sale?.cabinet || 'main';
      
      // Delete from IndexedDB
      await db.sales.delete(id);
      
      // Update local state
      setSales(prev => prev.filter(sale => sale.id !== id));
      
      if (isOnline) {
        // Try to sync to server
        try {
          const response = await fetch(`/api/sales/${id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            console.log('❌ Server delete failed, queued for sync');
            await enhancedSyncService.queueChange('sale', 'delete', { id }, cabinet);
          }
        } catch (error) {
          console.log('❌ Server delete failed, queued for sync:', error);
          await enhancedSyncService.queueChange('sale', 'delete', { id }, cabinet);
        }
      } else {
        // Offline: queue for sync
        await enhancedSyncService.queueChange('sale', 'delete', { id }, cabinet);
        console.log('📱 Sale delete queued for sync:', id);
      }
    } catch (err) {
      console.error('Error deleting sale:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete sale');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addUnarchivedSales = useCallback((newSales: SalesRecord[]) => {
    setSales(prev => [...newSales, ...prev]);
  }, []);

  const archiveSalesInState = useCallback((cabinet: string, month: string) => {
    // Parse month (format: "YYYY-MM")
    const [year, monthNum] = month.split('-').map(Number);
    
    // Create date range for the month
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = monthNum === 12 
      ? new Date(year + 1, 0, 1)
      : new Date(year, monthNum, 1);

    // Optimistically mark sales as archived to remove from view
    setSales(prev => prev.map(sale => {
      const saleDate = new Date(sale.date);
      const isInMonth = saleDate >= startDate && saleDate < endDate && sale.cabinet === cabinet;
      
      if (isInMonth) {
        return { ...sale, archived: true };
      }
      return sale;
    }));
  }, []);

  const getSalesByCabinet = (cabinet: string) => {
    if (cabinet === 'all') {
      return sales.filter((sale) => !sale.archived)
    }
    return sales.filter((sale) => sale.cabinet === cabinet && !sale.archived)
  };

  // Manually retry failed sales sync
  const retryFailedSales = async () => {
    try {
      console.log('🔄 Manually retrying failed sales sync...');
      await enhancedSyncService.syncAll();
      await refreshSales('all'); // Refresh sales after sync attempt for all cabinets
      console.log('✅ Manual retry completed');
    } catch (error) {
      console.error('❌ Manual retry failed:', error);
    }
  };

  return (
    <SalesContext.Provider 
      value={{ 
        sales, 
        loading, 
        error, 
        addSale, 
        updateSale, 
        deleteSale, 
        getSalesByCabinet,
        refreshSales,
        addUnarchivedSales,
        archiveSalesInState,
        retryFailedSales
      }}
    >
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const context = useContext(SalesContext);
  if (context === undefined) {
    throw new Error('useSales must be used within a SalesProvider');
  }
  return context;
}
