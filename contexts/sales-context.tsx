"use client"

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useProducts } from './products-context';

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
  referenceNumber?: string;
  createdAt?: string;
  updatedAt?: string;
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
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export function SalesProvider({ children }: { children: ReactNode }) {
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSales = useCallback(async (cabinet: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sales?cabinet=${cabinet}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch sales');
      }
      
      const data = await response.json();
      console.log('Raw API response:', data);
      console.log('Database field check:', data.map((s: any) => ({
        id: s.id,
        itemCount: s.items?.length || 0,
        itemsWithDiscountField: s.items?.filter((i: any) => 'isDiscounted' in i).length || 0,
        itemsWithProfitField: s.items?.filter((i: any) => 'profit' in i).length || 0,
        sampleItem: s.items?.[0] ? {
          name: s.items[0].productName,
          hasIsDiscounted: 'isDiscounted' in s.items[0],
          isDiscountedValue: s.items[0].isDiscounted,
          hasProfit: 'profit' in s.items[0],
          profitValue: s.items[0].profit,
          allFields: Object.keys(s.items[0])
        } : null
      })));
      setSales(data);
    } catch (err) {
      console.error('Error fetching sales:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all sales on mount (for all cabinets)
  useEffect(() => {
    const fetchAllSales = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/sales');
        
        if (!response.ok) {
          throw new Error('Failed to fetch sales');
        }
        
        const data = await response.json();
        setSales(data);
      } catch (err) {
        console.error('Error fetching sales:', err);
        setError(err instanceof Error ? err.message : 'Failed to load sales');
      } finally {
        setLoading(false);
      }
    };

    fetchAllSales();
  }, []);

  // Smart refresh: only update when data actually changes
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/api/sales');
        if (response.ok) {
          const data = await response.json();
          // Only update if data has actually changed
          if (JSON.stringify(data) !== JSON.stringify(sales)) {
            setSales(data);
          }
        }
      } catch (err) {
        // Silent fail for background updates
        console.log('Background update check failed:', err);
      }
    };

    // Check for updates every 15 seconds (faster but without loading states)
    const intervalId = setInterval(checkForUpdates, 15000);
    
    return () => clearInterval(intervalId);
  }, [sales]);

  const addSale = async (sale: Omit<SalesRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sale),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || 'Failed to add sale');
      }

      const newSale = await response.json();
      setSales(prev => [newSale, ...prev]);
    } catch (err) {
      console.error('Error adding sale:', err);
      setError(err instanceof Error ? err.message : 'Failed to add sale');
      // addToast("Failed to add sale", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateSale = async (id: string, updates: Partial<SalesRecord>) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/sales/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update sale');
      }

      const updatedSale = await response.json();
      setSales(prev => 
        prev.map(sale => (sale.id === id ? updatedSale : sale))
      );
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
      
      const response = await fetch(`/api/sales/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete sale');
      }

      setSales(prev => prev.filter(sale => sale.id !== id));
    } catch (err) {
      console.error('Error deleting sale:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete sale');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getSalesByCabinet = (cabinet: string) => {
    return sales.filter((sale) => sale.cabinet === cabinet);
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
        refreshSales
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
