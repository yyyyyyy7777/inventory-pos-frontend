"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { db } from '@/lib/indexeddb';
import { enhancedSyncService } from '@/lib/enhanced-sync';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export type ProductLocation = 'online' | 'physical' | 'both';

export interface StockBatch {
  id: string;
  productId: string;
  quantity: number;
  costPerUnit?: number;
  batchDate: string;
  expiryDate?: string;
  cabinet: string;
  status: 'on-shelf' | 'in-storage' | 'depleted' | 'reserved' | 'damaged';
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  /** Per-unit amount paid to acquire stock (inventory “acquired price”). */
  costPrice?: number;
  category: string;
  categoryId?: number;
  stock: number;
  location: ProductLocation;
  lastUpdated: string;
  lastRestockDate?: string;
  cabinet: string;
  /** Long product details / notes */
  description?: string;
  purchaseDate?: string;
  purchasePlace?: string;
  supplierName?: string;
  dimLengthCm?: number;
  dimWidthCm?: number;
  dimHeightCm?: number;
  weightKg?: number;
  /** Data URL (jpeg) or https URL */
  imageUrl?: string;
  /** Staff username who created the product (server). */
  createdBy?: string;
  /** Staff username who last saved changes (server). */
  lastUpdatedBy?: string;
  /** When the product row was first created (server). */
  dateCreated?: string;
  /** When the product row was last updated (server). */
  lastModifiedDate?: string;
  /** Sent on PUT only; not stored on the client model after merge. */
  updatedBy?: string;
  stockBatches?: StockBatch[];
  synced?: boolean;
  lastModified?: number;
  deleted?: boolean;
  markedForDelete?: boolean;
  deletedAt?: number;
}

interface ProductsContextType {
  products: Product[];
  getProductsByCabinet: (cabinet: string) => Product[];
  decrementProductStockLocally: (productId: string, quantity: number, cabinet: string) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>, cabinet: string) => Promise<Product | { error: string; isSkuConflict: true } | undefined>;
  updateProduct: (id: string, updates: Partial<Product>, cabinet: string) => Promise<{ success: boolean; error: string; data?: undefined; } | { success: boolean; data: any; error?: undefined; }>;
  deleteProduct: (id: string, cabinet: string) => Promise<void>;
  addStockBatch: (productId: string, quantity: number, costPerUnit?: number, expiryDate?: string, cabinet?: string) => Promise<void>;
  getStockBatches: (productId: string, cabinet: string) => Promise<StockBatch[]>;
  getOnShelfStock: (productId: string, cabinet: string) => Promise<number>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  syncStock: (cabinet?: string) => Promise<void>;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Record<string, Product[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Check online status and load cached data from IndexedDB
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      
      // Load products from IndexedDB immediately
      const loadFromIndexedDB = async () => {
        try {
          const allProducts = await db.products.toArray();
          // Group by cabinet
          const productsByCabinet: Record<string, Product[]> = {};
          allProducts.forEach((product) => {
            const cabinet = product.cabinet || 'main';
            if (!productsByCabinet[cabinet]) {
              productsByCabinet[cabinet] = [];
            }
            productsByCabinet[cabinet].push(product);
          });
          setProducts(productsByCabinet);
          setLoading(false);
          console.log('Loaded products from IndexedDB:', allProducts.length);
        } catch (err) {
          console.error('Error loading from IndexedDB:', err);
          // Fallback to localStorage for migration
          const cachedProducts = localStorage.getItem('cached_products');
          if (cachedProducts) {
            try {
              const parsed = JSON.parse(cachedProducts);
              setProducts(parsed);
              setLoading(false);
              // Migrate to IndexedDB
              const allProducts = Object.values(parsed).flat() as Product[];
              await db.products.bulkPut(allProducts);
              console.log('Migrated products from localStorage to IndexedDB');
            } catch (migrationErr) {
              console.error('Migration error:', migrationErr);
            }
          }
        }
      };
      
      loadFromIndexedDB();

      // Listen for online/offline events
      const handleOnline = () => {
        setIsOnline(true);
        enhancedSyncService.syncAll();
      };
      const handleOffline = () => setIsOnline(false);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Cache products to IndexedDB
  const cacheProducts = async (productsData: Record<string, Product[]>) => {
    try {
      const allProducts = Object.values(productsData).flat();
      // Only update if we have products (don't clear if API returns empty)
      if (allProducts.length === 0) {
        console.log('Not caching empty products array');
        return;
      }
      // Use bulkPut instead of bulkAdd to handle duplicates
      await db.products.bulkPut(allProducts.map(p => ({ ...p, synced: true, lastModified: Date.now() })));
      console.log('Cached products to IndexedDB:', allProducts.length);
    } catch (err) {
      console.error('Error caching to IndexedDB:', err);
      // Fallback to localStorage
      localStorage.setItem('cached_products', JSON.stringify(productsData));
    }
  };

  // Fetch products from database
  const fetchProducts = async (cabinet: string = 'main') => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/products?cabinet=${cabinet}`, { cache: 'no-store', headers: { 'Pragma': 'no-cache' } });
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      
      const data = await response.json();
      if (!Array.isArray(data)) {
        console.warn('fetchProducts: API returned non-array, ignoring update');
        return;
      }
      setProducts(prev => ({
        ...prev,
        [cabinet]: data,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize products on mount and when cabinet changes
  useEffect(() => {
    // Don't fetch if we're offline - IndexedDB already loaded in first useEffect
    if (!isOnline || !navigator.onLine) {
      console.log('Offline mode - skipping API fetch, using IndexedDB data');
      return;
    }
    
    // Fetch all products on mount (for all cabinets)
    const fetchAllProducts = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        
        // Fetch all products first
        const response = await fetch('/api/products?cabinet=all', { cache: 'no-store', headers: { 'Pragma': 'no-cache' } });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.log('API Response error text:', errorText);
          throw new Error(`Failed to fetch products (${response.status})`);
        }
        
        const allProducts = await response.json();

        if (!Array.isArray(allProducts)) {
          console.warn('fetchAllProducts: API returned non-array, keeping local data');
          return;
        }
        
        // Only update if we got products from API
        if (allProducts.length === 0) {
          console.log('API returned no products, keeping IndexedDB data');
          return;
        }
        
        // Get local products to preserve offline changes
        const localProductsByCabinet: Record<string, Product[]> = {};
        try {
          const allLocalProducts = await db.products.toArray();
          const localProductsGrouped: Record<string, Product[]> = {};
          allLocalProducts.forEach((product) => {
            const cabinet = product.cabinet || 'main';
            if (!localProductsGrouped[cabinet]) {
              localProductsGrouped[cabinet] = [];
            }
            localProductsGrouped[cabinet].push(product);
          });
          Object.assign(localProductsByCabinet, localProductsGrouped);
        } catch (cacheError) {
          console.log('Could not load cached products:', cacheError);
        }
        
        // Merge server products with local changes, preserving offline stock updates
        const productsByCabinet: Record<string, Product[]> = {};
        allProducts.forEach((serverProduct: any) => {
          const cabinet = serverProduct.cabinet || 'main';
          if (!productsByCabinet[cabinet]) {
            productsByCabinet[cabinet] = [];
          }
          
          // Check if we have local changes for this product
          const localProducts = localProductsByCabinet[cabinet] || [];
          const localProduct = localProducts.find(p => 
            p.name === serverProduct.name || 
            (p.id && p.id === serverProduct.id.toString()) ||
            (p.sku && p.sku === serverProduct.sku)
          );
          
          // Use server data but preserve local stock if it was modified offline
          const mergedProduct: Product = {
            ...serverProduct,
            cabinet,
            id: serverProduct.id.toString(),
            // Preserve local stock if it exists and was recently modified
            stock: localProduct && (localProduct.lastModified || 0) > (serverProduct.lastModified || 0) 
              ? localProduct.stock 
              : serverProduct.stock,
            // Preserve other local modifications
            synced: !localProduct || localProduct.synced,
            lastModified: localProduct ? Math.max(serverProduct.lastModified || 0, localProduct.lastModified || 0) : (serverProduct.lastModified || 0)
          };
          
          productsByCabinet[cabinet].push(mergedProduct);
        });
        
        // Add any local products that don't exist on server (temporary products)
        Object.keys(localProductsByCabinet).forEach(cabinet => {
          const localProducts = localProductsByCabinet[cabinet];
          localProducts.forEach(localProduct => {
            const existsOnServer = productsByCabinet[cabinet]?.find(p => 
              p.name === localProduct.name || 
              p.id === localProduct.id ||
              (p.sku && localProduct.sku && p.sku === localProduct.sku)
            );
            
            if (!existsOnServer && (localProduct.id?.startsWith('temp_') || localProduct.id?.startsWith('temp-'))) {
              if (!productsByCabinet[cabinet]) {
                productsByCabinet[cabinet] = [];
              }
              productsByCabinet[cabinet].push(localProduct);
            }
          });
        });
        
        setProducts(productsByCabinet);
        cacheProducts(productsByCabinet);
        
        console.log('Merged server and local products, preserving offline stock changes');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products';
        let usedIndexedDbFallback = false;

        // If fetch fails and we have IndexedDB data, use that quietly.
        try {
          const allProducts = await db.products.toArray();
          if (allProducts.length > 0) {
            const productsByCabinet: Record<string, Product[]> = {};
            allProducts.forEach((product) => {
              const cabinet = product.cabinet || 'main';
              if (!productsByCabinet[cabinet]) {
                productsByCabinet[cabinet] = [];
              }
              productsByCabinet[cabinet].push(product);
            });
            setProducts(productsByCabinet);
            setError(null); // keep UI healthy when fallback data exists
            usedIndexedDbFallback = true;
            console.log('Using IndexedDB fallback for products:', allProducts.length);
          }
        } catch (cacheErr) {
          console.error('Error loading from IndexedDB as fallback:', cacheErr);
        }

        // Only surface hard error if there is no fallback data.
        if (!usedIndexedDbFallback) {
          if (!errorMessage.includes('SKU') && !errorMessage.includes('already exists')) {
            setError(errorMessage);
          }
          console.error('Error fetching products:', err);
        } else {
          console.warn('Products API unavailable; continued with cached products.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllProducts();
  }, [isOnline]);

  // Realtime cross-user updates (admin/staff)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) return;

    let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      // Missing env vars; skip realtime without crashing.
      return;
    }

    let refreshTimer: any = null;
    const scheduleProductsRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        // Pulling products keeps local IndexedDB + UI consistent across users.
        // Use lightweight /api/products, not full pullFromServer().
        fetch('/api/products?cabinet=all', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then(async (allProducts) => {
            if (!allProducts || !Array.isArray(allProducts) || allProducts.length === 0) return;

            const productsByCabinet: Record<string, Product[]> = {};
            allProducts.forEach((p: any) => {
              const c = p.cabinet || 'main';
              (productsByCabinet[c] ||= []).push(p);
            });
            setProducts((prev) => ({ ...prev, ...productsByCabinet }));
            await cacheProducts(productsByCabinet);
          })
          .catch(() => {
            // Silent fail; realtime should never break offline/online UX.
          });
      }, 600);
    };

    const scheduleBatchRefresh = (productId?: string, cabinet?: string) => {
      if (!productId || !cabinet) {
        scheduleProductsRefresh();
        return;
      }

      // Refresh batches for pricing/stock correctness (POS + Inventory)
      fetch(`/api/stock-batches?productId=${encodeURIComponent(productId)}&cabinet=${encodeURIComponent(cabinet)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(async (batches) => {
          if (!batches || !Array.isArray(batches)) return;

          // If server returns no batches, keep local batches (important for newly created products
          // where the initial batch may exist locally before server-side batch rows exist).
          if (batches.length === 0) {
            scheduleProductsRefresh();
            return;
          }

          // Replace local batches for this product/cabinet
          await db.stockBatches
            .where({ productId: String(productId), cabinet })
            .delete();

          // Use bulkPut to avoid IndexedDB ConstraintError when records already exist.
          await db.stockBatches.bulkPut(
            batches.map((b: any) => ({
              // Prefer stable server id when present.
              ...(b.id != null ? { id: b.id } : {}),
              productId: String(b.productId),
              quantity: Number(b.quantity) || 0,
              costPerUnit: b.costPerUnit ?? 0,
              cabinet: b.cabinet || cabinet,
              addedDate: b.addedDate || new Date().toISOString(),
              notes: b.notes,
              status: b.status || 'in-storage',
              synced: true,
              lastModified: Date.now(),
            }))
          );

          // Ensure price cache updates everywhere
          const { clearPriceCacheOnBatchUpdate } = await import('@/lib/batch-price');
          clearPriceCacheOnBatchUpdate(String(productId), cabinet);

          scheduleProductsRefresh();
        })
        .catch(() => {
          // Silent fail.
        });
    };

    const channel = supabase
      .channel('realtime-inventory-pos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product' },
        () => scheduleProductsRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stockbatch' },
        (payload: any) => {
          const row = payload?.new || payload?.old;
          scheduleBatchRefresh(String(row?.productId || ''), String(row?.cabinet || 'main'));
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase?.removeChannel(channel);
    };
  }, []);

  // Note:
  // We avoid periodic full product polling because realtime subscriptions already
  // keep data synchronized across users. Removing this interval reduces repeated
  // heavy requests and improves dashboard/POS responsiveness under concurrent use.

  const getProductsByCabinet = (cabinet: string) => {
    const asArray = (value: unknown): Product[] =>
      Array.isArray(value) ? (value as Product[]) : [];

    const rawList =
      cabinet === 'all'
        ? Object.values(products).flatMap(asArray)
        : asArray(products[cabinet]);

    return rawList.filter(
      (product) =>
        product &&
        typeof product === 'object' &&
        typeof product.id === 'string' &&
        product.id.length > 0 &&
        !product.deleted &&
        !product.markedForDelete
    );
  };

  // Immediate local stock deduction used by POS after confirmed sale creation.
  // This prevents stock from appearing unchanged when background refresh fails.
  const decrementProductStockLocally = async (productId: string, quantity: number, cabinet: string) => {
    if (quantity <= 0) return;

    setProducts(prev => ({
      ...prev,
      [cabinet]: (prev[cabinet] || []).map((product) => {
        if (product.id !== productId) return product;
        const nextStock = Math.max(0, (product.stock || 0) - quantity);
        return {
          ...product,
          stock: nextStock,
          quantity: nextStock,
          lastModified: Date.now(),
          synced: isOnline ? product.synced : false
        };
      }),
    }));

    try {
      const existingProduct = await db.products.get(productId);
      if (existingProduct) {
        const nextStock = Math.max(0, (existingProduct.stock || 0) - quantity);
        await db.products.update(productId, {
          stock: nextStock,
          quantity: nextStock,
          lastModified: Date.now(),
          synced: isOnline ? existingProduct.synced : false
        });
      }
    } catch (err) {
      console.warn('Failed to persist local stock deduction:', err);
    }
  };

  const addProduct = async (product: Omit<Product, 'id'>, cabinet: string): Promise<Product | { error: string; isSkuConflict: true } | undefined> => {
    try {
      setError(null);
      console.log('Adding product:', product); // Debug log
      console.log('Online status:', isOnline); // Debug log
      
      // Check if offline first
      if (!isOnline) {
        console.warn('Offline mode detected, creating temporary product');
        // Create a temporary product with generated ID
        const tempProduct = {
          ...product,
          id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          lastUpdated: new Date().toLocaleDateString('en-CA'),
          synced: false,
          lastModified: Date.now(),
        };
        
        setProducts((prev) => ({
          ...prev,
          [cabinet]: [tempProduct, ...(prev[cabinet] || [])],
        }));
        
        // Save to IndexedDB
        await db.products.add(tempProduct);

        // Create initial local stock batch so stock history works offline.
        if ((tempProduct.stock || 0) > 0) {
          await db.stockBatches.add({
            productId: tempProduct.id,
            quantity: tempProduct.stock,
            costPerUnit: tempProduct.costPrice || 0,
            cabinet,
            addedDate: new Date().toISOString(),
            status: 'on-shelf',
            synced: false,
            lastModified: Date.now(),
            notes: 'Initial stock (offline create)'
          });
        }
        
        // Queue for sync when online
        await enhancedSyncService.queueChange('product', 'create', tempProduct, cabinet);
        
        return tempProduct;
      }
      
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      });

      console.log('Response status:', response.status); // Debug log
      console.log('Response ok:', response.ok); // Debug log

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = { error: 'Server error occurred' };
        }
        
        // Handle empty error objects or missing error messages
        const errorMessage = errorData?.error || 
                           (response.status >= 500 ? 'Server error occurred' : 
                            response.status === 400 ? 'Bad request' : 
                            'Failed to add product');
        
        // Handle SKU conflicts specially - don't set error state, return error info
        if (errorMessage.includes('SKU') && errorMessage.includes('already exists')) {
          console.warn('SKU conflict detected:', errorMessage);
          // Return a special object to indicate SKU conflict
          return { error: errorMessage, isSkuConflict: true };
        }
        
      // Handle database connection errors or offline mode
        if (errorMessage === 'Failed to connect to database' || 
            errorMessage?.includes('database') ||
            errorMessage?.includes('connection') ||
            errorMessage?.includes('ENOTFOUND') ||
            response.status === 503 ||
            !isOnline) {
          console.warn('Database not available, using offline mode');
          // Create a temporary product with generated ID
          const tempProduct = {
            ...product,
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            lastUpdated: new Date().toLocaleDateString('en-CA'),
            synced: false,
            lastModified: Date.now(),
          };
          
          setProducts((prev) => ({
            ...prev,
            [cabinet]: [tempProduct, ...(prev[cabinet] || [])],
          }));
          
          // Save to IndexedDB
          await db.products.add(tempProduct);

          // Create initial local stock batch so stock history works offline.
          if ((tempProduct.stock || 0) > 0) {
            await db.stockBatches.add({
              productId: tempProduct.id,
              quantity: tempProduct.stock,
              costPerUnit: tempProduct.costPrice || 0,
              cabinet,
              addedDate: new Date().toISOString(),
              status: 'on-shelf',
              synced: false,
              lastModified: Date.now(),
              notes: 'Initial stock (offline fallback)'
            });
          }
          
          // Queue for sync when online
          await enhancedSyncService.queueChange('product', 'create', tempProduct, cabinet);
          
          return tempProduct;
        }
        
        // Set error state for other errors but don't throw - let UI handle the error display
        setError(errorMessage);
        return; // Don't throw error - let calling component handle it
      }

      const newProduct = await response.json();
      console.log('New product created:', newProduct); // Debug log
      
      setProducts((prev) => ({
        ...prev,
        [cabinet]: [newProduct, ...(prev[cabinet] || [])],
      }));
      
      return newProduct; // Return the created product
    } catch (err) {
      console.error('Add product error:', err);
      
      // Handle network errors or offline mode more comprehensively
      if (err instanceof Error && (
        err.message.includes('fetch') || 
        err.message.includes('Network') || 
        err.message.includes('ENOTFOUND') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ERR_INTERNET_DISCONNECTED') ||
        !isOnline
      )) {
        console.warn('Network error or offline detected, creating temporary product');
        // Create a temporary product with generated ID
        const tempProduct = {
          ...product,
          id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          lastUpdated: new Date().toLocaleDateString('en-CA'),
          synced: false,
          lastModified: Date.now(),
        };
        
        setProducts((prev) => ({
          ...prev,
          [cabinet]: [tempProduct, ...(prev[cabinet] || [])],
        }));
        
        // Save to IndexedDB
        await db.products.add(tempProduct);

        // Create initial local stock batch so stock history works offline.
        if ((tempProduct.stock || 0) > 0) {
          await db.stockBatches.add({
            productId: tempProduct.id,
            quantity: tempProduct.stock,
            costPerUnit: tempProduct.costPrice || 0,
            cabinet,
            addedDate: new Date().toISOString(),
            status: 'on-shelf',
            synced: false,
            lastModified: Date.now(),
            notes: 'Initial stock (offline network fallback)'
          });
        }
        
        // Queue for sync when online
        await enhancedSyncService.queueChange('product', 'create', tempProduct, cabinet);
        
        return tempProduct;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to add product');
      throw err;
      
      // Don't throw the error to prevent console.error from showing
      // The error state is set for UI display
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>, cabinet: string) => {
    try {
      setError(null);
      
      // If offline, update locally in IndexedDB
      if (!isOnline) {
        console.log('Offline mode - updating product locally in IndexedDB');
        
        // Update in state
        setProducts(prev => ({
          ...prev,
          [cabinet]: (prev[cabinet] || []).map((product) =>
            product.id === id ? { ...product, ...updates, synced: false, lastModified: Date.now() } : product
          ),
        }));
        
        // Update in IndexedDB
        const existingProduct = await db.products.get(id);
        if (existingProduct) {
          await db.products.update(id, { ...updates, synced: false, lastModified: Date.now() });
        }
        
        // Queue for sync when online
        await enhancedSyncService.queueChange('product_update', 'update', { id, updates, cabinet }, cabinet);
        
        return { success: true, data: { ...updates, id } as Product };
      }

      const idTrim = String(id).trim()
      const isServerNumericId = /^\d+$/.test(idTrim) && Number(idTrim) > 0

      // Offline-created `temp_*` or any non-numeric id cannot use REST /api/products/[id]
      if (!isServerNumericId) {
        const existing =
          (await db.products.get(id)) ||
          (() => {
            const list = products[cabinet] || []
            return list.find((p) => p.id === id)
          })()
        const merged = existing
          ? ({ ...existing, ...updates, id, synced: false, lastModified: Date.now() } as Product)
          : ({ ...updates, id, synced: false, lastModified: Date.now() } as Product)

        setProducts((prev) => {
          const list = [...(prev[cabinet] || [])]
          const ix = list.findIndex((p) => p.id === id)
          if (ix >= 0) list[ix] = merged
          else list.unshift(merged)
          return { ...prev, [cabinet]: list }
        })

        if (existing) {
          await db.products.update(id, { ...updates, synced: false, lastModified: Date.now() })
        } else {
          await db.products.put(merged)
        }

        await enhancedSyncService.queueChange(
          'product_update',
          'update',
          { id, updates, cabinet },
          cabinet
        )

        return { success: true, data: merged }
      }

      const response = await fetch(`/api/products/${idTrim}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        // Try to get the actual error message from the response
        let errorMessage = 'Failed to update product';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If we can't parse the error response, use the default message
        }
        
        // Don't throw error for SKU conflicts, just return error result
        if (errorMessage.includes('already exists')) {
          console.warn('SKU conflict detected during update:', errorMessage);
          return { success: false, error: errorMessage };
        }
        
        // Set error state and return error result for other errors
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const updatedProduct = await response.json();
      
      setProducts((prev) => ({
        ...prev,
        [cabinet]: (prev[cabinet] || []).map((product) =>
          product.id === id ? updatedProduct : product
        ),
      }));
      
      return { success: true, data: updatedProduct };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update product';
      
      // If it's a network error or offline, update locally in IndexedDB
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('fetch') || errorMessage.includes('Network') || !isOnline) {
        console.log('Network error or offline - updating product locally in IndexedDB');
        
        // Update in state
        setProducts(prev => ({
          ...prev,
          [cabinet]: (prev[cabinet] || []).map((product) =>
            product.id === id ? { ...product, ...updates, synced: false, lastModified: Date.now() } : product
          ),
        }));
        
        // Update in IndexedDB
        const existingProduct = await db.products.get(id);
        if (existingProduct) {
          await db.products.update(id, { ...updates, synced: false, lastModified: Date.now() });
        }
        
        // Queue for sync when online
        await enhancedSyncService.queueChange('product_update', 'update', { id, updates, cabinet }, cabinet);
        
        return { success: true, data: { ...updates, id } as Product };
      }
      
      // Only set error state for non-SKU errors
      if (!errorMessage.includes('SKU')) {
        setError(errorMessage);
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const addStockBatch = async (productId: string, quantity: number, costPerUnit?: number, expiryDate?: string, cabinet?: string) => {
    try {
      setError(null);
      
      // If offline, queue for later sync
      if (!isOnline) {
        console.log('Offline mode - queuing stock batch for sync');
        const targetCabinet = cabinet || 'main';

        // Persist stock batch locally immediately so stock history shows offline.
        await db.stockBatches.add({
          productId,
          quantity,
          costPerUnit: costPerUnit || 0,
          cabinet: targetCabinet,
          addedDate: new Date().toISOString(),
          status: 'on-shelf',
          synced: false,
          lastModified: Date.now(),
          notes: 'Restock (offline)'
        });

        await enhancedSyncService.queueChange('stock_update', 'create', {
          productId,
          quantity,
          costPerUnit,
          expiryDate,
          cabinet: targetCabinet,
          batchDate: new Date().toISOString(),
        }, targetCabinet);
        
        // Update local product stock
        const product = await db.products.get(productId);
        if (product) {
          await db.products.update(productId, {
            stock: product.stock + quantity,
            lastModified: Date.now(),
            synced: false,
          });
          
          // Update state
          setProducts(prev => ({
            ...prev,
            [targetCabinet]: (prev[targetCabinet] || []).map(p =>
              p.id === productId ? { ...p, stock: p.stock + quantity } : p
            ),
          }));
        }
        
        return;
      }
      
      const response = await fetch('/api/stock-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity,
          costPerUnit,
          expiryDate,
          cabinet: cabinet || 'main'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add stock batch');
      }

      // Refresh from server and update IndexedDB
      await enhancedSyncService.pullFromServer(cabinet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add stock batch');
      throw err;
    }
  };

  const getStockBatches = async (productId: string, cabinet: string): Promise<StockBatch[]> => {
    try {
      // If offline, load from IndexedDB
      if (!navigator.onLine) {
        console.log('Offline mode - loading stock batches from IndexedDB');
        const batches = await db.stockBatches
          .where({ productId, cabinet })
          .toArray();
        return batches.map(batch => ({
          ...batch,
          id: batch.id?.toString() || '',
          status: 'on-shelf' as const,
          createdAt: batch.addedDate,
          batchDate: batch.addedDate,
          updatedAt: batch.addedDate,
        }));
      }

      const response = await fetch(`/api/stock-batches?productId=${productId}&cabinet=${cabinet}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch stock batches');
      }

      return await response.json();
    } catch (err) {
      console.error('Error fetching stock batches:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stock batches');
      return [];
    }
  };

  const getOnShelfStock = async (productId: string, cabinet: string): Promise<number> => {
    try {
      const batches = await getStockBatches(productId, cabinet);
      const onShelfBatches = batches.filter(batch => batch.status === 'on-shelf');
      return onShelfBatches.reduce((total, batch) => total + batch.quantity, 0);
    } catch (err) {
      console.error('Error getting on-shelf stock:', err);
      return 0;
    }
  };

  const deleteProduct = async (id: string, cabinet: string) => {
    try {
      setError(null);
      const isTempProductId = id.startsWith('temp_') || id.startsWith('temp-');
      
      // Temp products are local-only until synced: always delete locally,
      // even if currently online.
      if (isTempProductId) {
        setProducts((prev) => ({
          ...prev,
          [cabinet]: (prev[cabinet] || []).filter((product) => product.id !== id),
        }));

        await db.products.delete(id);
        await db.stockBatches.where({ productId: id, cabinet }).delete();

        // Remove queued sync items related to this temp product.
        await db.syncQueue
          .filter((q: any) =>
            q.cabinet === cabinet &&
            (
              q.data?.id === id ||
              q.data?.productId === id ||
              (q.type === 'product' && q.data?.id === id)
            )
          )
          .delete();
        return;
      }
      
      // If offline, mark for deletion and queue for sync
      if (!isOnline) {
        console.log('Offline mode - queuing product deletion');
        
        // Get the complete product data before deletion
        const productToDelete = await db.products.get(id);
        
        // Remove from state
        setProducts((prev) => ({
          ...prev,
          [cabinet]: (prev[cabinet] || []).filter((product) => product.id !== id),
        }));
        
        // Mark as deleted in IndexedDB instead of removing completely
        const currentProduct = await db.products.get(id);
        if (currentProduct) {
          await db.products.update(id, {
            ...currentProduct,
            deleted: true,
            markedForDelete: true,
            deletedAt: Date.now(),
            synced: false
          });
        }
        
        // Queue for sync when online with complete product data
        if (productToDelete) {
          await enhancedSyncService.queueChange('product', 'delete', productToDelete, cabinet);
        } else {
          console.warn('Product not found in IndexedDB for deletion sync:', id);
        }
        
        return;
      }

      const response = await fetch(`/api/products/manage?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      setProducts((prev) => ({
        ...prev,
        [cabinet]: (prev[cabinet] || []).filter((product) => product.id !== id),
      }));
      
      // Remove from IndexedDB
      await db.products.delete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      throw err;
    }
  };

  // Helper function to get all products across all cabinets
  const getAllProducts = () => {
    return Object.values(products).flatMap((x) => (Array.isArray(x) ? x : []));
  };

  // Refetch function to refresh all products
  const refetch = async () => {
    try {
      // If offline, don't try to fetch - use cached data
      if (!isOnline) {
        console.log('Offline mode - cannot refetch, using cached products');
        return;
      }

      setLoading(true);
      setError(null);
      
      // Fetch all products
      const response = await fetch('/api/products?cabinet=all', { cache: 'no-store', headers: { 'Pragma': 'no-cache' } });
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      
      const allProducts = await response.json();

      if (!Array.isArray(allProducts)) {
        console.warn('refetch: API returned non-array products');
        throw new Error('Invalid products response');
      }
      
      // Group products by cabinet
      const productsByCabinet: Record<string, Product[]> = {};
      allProducts.forEach((product: Product) => {
        const cabinet = product.cabinet || 'main';
        if (!productsByCabinet[cabinet]) {
          productsByCabinet[cabinet] = [];
        }
        productsByCabinet[cabinet].push(product);
      });
      
      setProducts(productsByCabinet);
      cacheProducts(productsByCabinet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
      console.error('Error refetching products:', err);
      
      // If refetch fails and we have IndexedDB data, use that
      try {
        const allProducts = await db.products.toArray();
        if (allProducts.length > 0) {
          const productsByCabinet: Record<string, Product[]> = {};
          allProducts.forEach((product) => {
            const cabinet = product.cabinet || 'main';
            if (!productsByCabinet[cabinet]) {
              productsByCabinet[cabinet] = [];
            }
            productsByCabinet[cabinet].push(product);
          });
          setProducts(productsByCabinet);
          setError(null); // Clear error since we have IndexedDB data
          console.log('Fallback to IndexedDB:', allProducts.length, 'products');
        }
      } catch (cacheErr) {
        console.error('Error loading from IndexedDB as fallback:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual stock sync function for recovery
  const syncStock = async (cabinet?: string) => {
    try {
      console.log(' Manual stock sync initiated...');
      
      // Trigger enhanced sync service to sync stock batches
      const { enhancedSyncService } = await import('@/lib/enhanced-sync');
      await enhancedSyncService.syncAll();
      
      // Refresh products to get updated stock
      await refetch();
      
      console.log(' Manual stock sync completed');
    } catch (error) {
      console.error(' Manual stock sync failed:', error);
    }
  };

  return (
    <ProductsContext.Provider
      value={{ 
        products: getAllProducts(), 
        getProductsByCabinet, 
        decrementProductStockLocally,
        addProduct, 
        updateProduct, 
        deleteProduct,
        addStockBatch,
        getStockBatches,
        getOnShelfStock,
        loading,
        error,
        refetch,
        syncStock
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}
