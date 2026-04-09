import { StockBatch } from './indexeddb';

// Cache for batch prices to prevent repeated fetching
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface BatchPriceResult {
  price: number;
  batchId?: string;
  batchInfo?: {
    id: string;
    costPerUnit: number;
    quantity: number;
    status: string;
    addedDate: string;
  };
}

/**
 * Get the current price from stock batches using consistent FIFO logic
 * Prioritizes on-shelf batches first, then falls back to FIFO for storage batches
 * Falls back to product base price if no batches with valid costPerUnit exist
 */
export async function getCurrentPriceFromBatches(
  productId: string, 
  cabinet: string
): Promise<BatchPriceResult> {
  const cacheKey = `${productId}-${cabinet}`;
  const now = Date.now();
  
  // Check cache first
  const cached = priceCache.get(cacheKey);
  // Never trust cached "0" because it commonly happens during startup/new-product race conditions.
  if (cached && cached.price > 0 && (now - cached.timestamp) < CACHE_DURATION) {
    return { price: cached.price };
  }
  
  try {
    // Works offline too: read local IndexedDB batches and compute the current batch price.
    
    console.log(`Fetching batches for product ${productId} in cabinet ${cabinet}`);
    
    const { db } = await import('./indexeddb');
    
    // Get all batches for this product
    const batches = await db.stockBatches
      .where({ productId: String(productId), cabinet })
      .toArray();
    
    console.log(`Found ${batches.length} total batches for product ${productId}`);
    
    // Filter out deleted batches
    const deletedBatches = await db.deletedBatches
      .where({ productId: String(productId), cabinet })
      .toArray();
    const deletedBatchIds = new Set(deletedBatches.map(db => db.batchId));
    
    const activeBatches = batches.filter(batch => !deletedBatchIds.has(String(batch.id)));
    
    console.log(`Found ${activeBatches.length} active batches after filtering deleted ones`);
    
    if (activeBatches.length === 0) {
      // No batches found - try to get product base price as fallback
      console.log(`No active batches found for product ${productId} - trying to get product base price`);
      try {
        const { db } = await import('./indexeddb');
        const product = await db.products.get(String(productId));
        const basePrice = Number((product as any)?.price);
        if (Number.isFinite(basePrice) && basePrice > 0) {
          console.log(`Using product base price ${basePrice} for product ${productId}`);
          const result = { price: basePrice };
          priceCache.set(cacheKey, { price: basePrice, timestamp: now });
          return result;
        }
      } catch (productError) {
        console.error('Error getting product base price:', productError);
      }
      
      console.log(`No product base price found for product ${productId} - price set to 0`);
      return { price: 0 };
    }
    
    let selectedBatch: StockBatch | undefined;
    
    // Current batch definition:
    // - the OLDEST on-shelf batch with quantity > 0 (FIFO)
    const onShelfBatch = activeBatches
      .filter(batch => batch.status === 'on-shelf' && batch.quantity > 0)
      .sort((a, b) => new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime())[0];
    
    if (onShelfBatch) {
      selectedBatch = onShelfBatch;
      console.log(`Using on-shelf batch ${onShelfBatch.id} price: ${onShelfBatch.costPerUnit} for product ${productId}`);
    } else {
      // Second priority: FIFO for storage batches with stock (oldest first)
      const storageBatches = activeBatches.filter(batch => 
        (batch.status === 'in-storage' || !batch.status) && batch.quantity > 0
      );
      
      console.log(`Found ${storageBatches.length} storage batches with stock for product ${productId}`);
      
      if (storageBatches.length > 0) {
        selectedBatch = storageBatches.sort((a, b) => 
          new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime()
        )[0];
        console.log(`Using FIFO storage batch ${selectedBatch.id} (added: ${selectedBatch.addedDate}) price: ${selectedBatch.costPerUnit} for product ${productId}`);
      } else {
        console.log(`No storage batches with stock found for product ${productId}`);
      }
    }
    
    if (selectedBatch) {
      // Handle case where costPerUnit might be undefined or null
      const price = Number((selectedBatch as any)?.costPerUnit) || 0;
      
      if (price > 0) {
        const result = {
          price,
          batchId: String(selectedBatch.id),
          batchInfo: {
            id: String(selectedBatch.id),
            costPerUnit: price,
            quantity: selectedBatch.quantity || 0,
            status: selectedBatch.status || 'unknown',
            addedDate: selectedBatch.addedDate || new Date().toISOString()
          }
        };
        
        // Update cache
        priceCache.set(cacheKey, { price, timestamp: now });
        console.log(`Successfully calculated price ${price} for product ${productId} using batch ${selectedBatch.id}`);
        return result;
      } else {
        console.log(`Selected batch ${selectedBatch.id} has no valid costPerUnit for product ${productId} - trying product base price`);
      }
    }
    
    // No valid batch with price found - try to get product base price as fallback
    console.log(`No valid batch with price found for product ${productId} - trying to get product base price`);
    try {
      const { db } = await import('./indexeddb');
      const product = await db.products.get(String(productId));
      const basePrice = Number((product as any)?.price);
      if (Number.isFinite(basePrice) && basePrice > 0) {
        console.log(`Using product base price ${basePrice} as fallback for product ${productId}`);
        const result = { price: basePrice };
        priceCache.set(cacheKey, { price: basePrice, timestamp: now });
        return result;
      }
    } catch (productError) {
      console.error('Error getting product base price as fallback:', productError);
    }
    
    console.log(`No product base price found for product ${productId} - price set to 0`);
    return { price: 0 };
    
  } catch (error) {
    console.error('Error getting current price from batches:', error);
    // Try to use cached price on error
    if (cached && cached.price > 0) {
      console.log(`Error occurred, using cached price for product ${productId}: ${cached.price}`);
      return { price: cached.price };
    }
    
    // Try to get product base price as fallback on error
    console.log(`Error occurred, trying to get product base price for product ${productId}`);
    try {
      const { db } = await import('./indexeddb');
      const product = await db.products.get(String(productId));
      const basePrice = Number((product as any)?.price);
      if (Number.isFinite(basePrice) && basePrice > 0) {
        console.log(`Using product base price ${basePrice} as fallback for product ${productId} (error case)`);
        const result = { price: basePrice };
        priceCache.set(cacheKey, { price: basePrice, timestamp: now });
        return result;
      }
    } catch (productError) {
      console.error('Error getting product base price as fallback (error case):', productError);
    }
    
    // Always return a valid result to prevent loading state issues
    console.log(`Error occurred and no cache or product price available, returning 0 for product ${productId}`);
    return { price: 0 };
  }
}

/**
 * Clear the price cache for a specific product or all products
 */
export function clearPriceCache(productId?: string, cabinet?: string) {
  if (productId && cabinet) {
    const cacheKey = `${productId}-${cabinet}`;
    priceCache.delete(cacheKey);
    console.log(`Cleared price cache for product ${productId} in cabinet ${cabinet}`);
  } else {
    priceCache.clear();
    console.log('Cleared all price cache');
  }
}

/**
 * Clear price cache when a batch is updated, deleted, or depleted
 * This ensures immediate price updates across all components
 */
export function clearPriceCacheOnBatchUpdate(productId: string, cabinet: string) {
  clearPriceCache(productId, cabinet);
  
  // Trigger a custom event to notify all BatchPriceDisplay components to refresh
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('batchPriceUpdate', {
      detail: { productId, cabinet }
    });
    window.dispatchEvent(event);
    console.log(`Triggered batch price update event for product ${productId} in cabinet ${cabinet}`);
  }
}

/**
 * Clear price cache for multiple products (useful for bulk operations)
 */
export function clearPriceCacheForProducts(productIds: string[], cabinet: string) {
  productIds.forEach(productId => {
    clearPriceCache(productId, cabinet);
  });
  
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('batchPriceBulkUpdate', {
      detail: { productIds, cabinet }
    });
    window.dispatchEvent(event);
    console.log(`Triggered bulk batch price update for ${productIds.length} products in cabinet ${cabinet}`);
  }
}

/**
 * Get cache statistics for debugging
 */
export function getPriceCacheStats() {
  return {
    size: priceCache.size,
    keys: Array.from(priceCache.keys()),
    entries: Array.from(priceCache.entries()).map(([key, value]) => ({
      key,
      price: value.price,
      timestamp: new Date(value.timestamp).toISOString(),
      age: Date.now() - value.timestamp
    }))
  };
}
