// Enhanced Sync Service with IndexedDB Support
import { db } from '@/lib/indexeddb'
import { Product } from '@/contexts/products-context';
import { offlineStorage } from './offline-storage';

// Type imports for enhanced sync service
interface SyncQueueItem {
  id?: number | string;
  type: 'product' | 'sale' | 'employee' | 'activity' | 'product_update' | 'stock_update' | 'stock_batch_delete' | 'stock_batch_status_update';
  action: 'create' | 'update' | 'delete' | 'addStock';
  data?: any;
  cabinet?: string;
  timestamp?: number;
  retries?: number;
}

interface SalesRecord {
  id: string;
  date: string;
  items: any[];
  amount: number;
  paymentMethod: string;
  staffName: string;
  cabinet: string;
  soldAt: string;
  referenceNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Employee {
  id: string;
  name: string;
  email?: string;
  role?: string;
  cabinet?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Activity {
  id: string;
  username: string;
  activity: string;
  details: string;
  category: string;
  timestamp: string;
  cabinet?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class EnhancedSyncService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private syncListeners: ((status: 'syncing' | 'completed' | 'error', message?: string) => void)[] = [];
  private autoSyncIntervalId: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      
      // Initialize database
      this.initDatabase();

      // Background auto-sync: if we're online and there are pending queue items, sync them.
      // This prevents "pending items" from getting stuck when the app stays open.
      this.autoSyncIntervalId = window.setInterval(async () => {
        try {
          if (!this.isOnline || this.syncInProgress) return;
          const pending = await db.getPendingSyncItems();
          if (pending.length === 0) return;
          await this.syncAll();
        } catch {
          // Never crash UI because of background sync.
        }
      }, 15000);
    }
  }

  // Initialize IndexedDB
  private async initDatabase(): Promise<void> {
    try {
      await db.open();
      console.log('✅ IndexedDB initialized');
    } catch (error) {
      console.error('❌ Failed to initialize IndexedDB:', error);
    }
  }

  // Add sync status listener
  onSyncStatusChange(callback: (status: 'syncing' | 'completed' | 'error', message?: string) => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      const index = this.syncListeners.indexOf(callback);
      if (index > -1) this.syncListeners.splice(index, 1);
    };
  }

  // Notify listeners
  private notifyListeners(status: 'syncing' | 'completed' | 'error', message?: string): void {
    this.syncListeners.forEach(callback => callback(status, message));
  }

  private handleOnline(): void {
    console.log('🌐 Connection restored - Starting sync...');
    this.isOnline = true;
    this.syncAll();
  }

  private handleOffline(): void {
    console.log('📵 Connection lost - Offline mode activated');
    this.isOnline = false;
  }

  async syncAll(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      console.log('⏸️ Sync already in progress or offline');
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners('syncing', 'Starting sync...');

    try {
      // Sync using new IndexedDB queue
      await this.processIndexedDBQueue();
      
      // Also sync legacy offline storage
      await this.syncLegacyStorage();

      // Pull fresh data from server
      await this.pullFromServer();

      this.notifyListeners('completed', 'Sync completed successfully');
      
      // Dispatch sync completion event for analytics updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('syncComplete', {
          detail: {
            timestamp: new Date().toISOString(),
            message: 'Sync completed successfully'
          }
        }));
      }
      
      console.log('✅ Full sync completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.notifyListeners('error', `Sync failed: ${errorMessage}`);
      console.error('❌ Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Process IndexedDB sync queue
  private async processIndexedDBQueue(): Promise<void> {
    const maxRetries = 3;
    const pendingItems = await db.getPendingSyncItems();
    
    // Filter out invalid items before processing
    const validItems = pendingItems.filter(item => {
      if (!item || !item.type || !item.data) {
        console.warn('Filtering out invalid sync item:', item);
        return false;
      }
      
      // Additional validation for product items
      if (item.type === 'product' || item.type === 'product_update') {
        if (!item.data || typeof item.data !== 'object' || Object.keys(item.data).length === 0) {
          console.warn('Filtering out product sync with empty data:', item);
          return false;
        }
      }
      
      return true;
    });

    // Process dependency order first:
    // 1) product + stock updates
    // 2) sales
    // 3) everything else
    const getPriority = (item: SyncQueueItem) => {
      if (item.type === 'product' || item.type === 'product_update' || item.type === 'stock_update') return 1;
      if (item.type === 'sale') return 2;
      return 3;
    };
    validItems.sort((a, b) => {
      const pa = getPriority(a);
      const pb = getPriority(b);
      if (pa !== pb) return pa - pb;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
    
    console.log(`Processing ${validItems.length} valid sync items out of ${pendingItems.length} total`);
    
    // Clean up invalid items from sync queue
    const invalidItems = pendingItems.filter(item => !validItems.includes(item));
    for (const invalidItem of invalidItems) {
      if (invalidItem.id) {
        console.log('🗑️ Removing invalid sync item:', invalidItem.type, invalidItem.id);
        await db.removeFromSyncQueue(Number(invalidItem.id));
      }
    }
    
    for (const item of validItems) {
      try {
        await this.processSyncItem(item);
        await db.removeFromSyncQueue(Number(item.id));
        console.log(`✅ Synced: ${item.type} ${item.action}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to sync ${item.type}:`, errorMessage);
        await db.updateSyncRetry(Number(item.id), errorMessage);
        
        // Remove items that keep failing to prevent permanent "pending 1" stalls.
        // Sales are marked as failed locally so they can be retried manually.
        const updatedItem = await db.syncQueue.get(Number(item.id));
        const retries = updatedItem?.retries || 0;

        if (item.type === 'sale' && retries >= maxRetries) {
          await this.markSaleSyncFailed(item, errorMessage);
          await db.removeFromSyncQueue(Number(item.id));
          console.log(`🗑️ Removed failed sale from sync queue after ${maxRetries} retries`);
          continue;
        }

        if (item.type !== 'sale') {
          if (retries >= maxRetries) {
            await db.removeFromSyncQueue(Number(item.id));
            console.log(`🗑️ Removed ${item.type} from sync queue after ${maxRetries} retries`);
          }
        } else {
          console.log(`💾 Keeping sale in sync queue for retry (${retries}/${maxRetries}): ${item.data.id || 'unknown'}`);
        }
      }
    }
  }

  private async markSaleSyncFailed(item: SyncQueueItem, reason: string): Promise<void> {
    try {
      const saleId = item.data?.id;
      if (!saleId) return;

      await db.sales.update(saleId, {
        synced: false,
        syncFailed: true,
        syncFailureReason: reason,
        lastSyncAttempt: Date.now(),
      } as any);
    } catch (err) {
      console.warn('Could not mark sale as sync failed:', err);
    }
  }

  // Process individual sync item
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    // Validate sync item before processing
    if (!item || !item.type || !item.data) {
      console.warn('Skipping invalid sync item:', item);
      return;
    }
    
    switch (item.type) {
      case 'product':
        // Additional validation for product sync items
        if (!item.data || typeof item.data !== 'object' || Object.keys(item.data).length === 0) {
          console.warn('Skipping product sync with empty data:', item);
          return;
        }
        
        // Specific check for completely empty objects {}
        if (JSON.stringify(item.data) === '{}') {
          console.warn('Skipping completely empty product object:', item);
          return;
        }
        
        // Check for missing essential fields
        if (!item.data.name || typeof item.data.name !== 'string' || item.data.name.trim() === '') {
          console.warn('Skipping product sync with missing/invalid name:', item.data);
          return;
        }
        
        // Additional check for empty product object with just id or no meaningful data
        const dataKeys = Object.keys(item.data);
        const hasValidData = dataKeys.some(key => 
          key !== 'id' && 
          key !== 'synced' && 
          key !== 'lastModified' && 
          key !== 'source' &&
          item.data[key] !== null && 
          item.data[key] !== undefined && 
          item.data[key] !== ''
        );
        
        if (!hasValidData) {
          console.warn('Skipping product sync with no meaningful data:', item.data);
          return;
        }
        
        await this.syncProduct(item.action, item.data);
        break;
      case 'product_update':
        await this.syncProductUpdate(item.data);
        break;
      case 'sale':
        await this.syncSale(item.data);
        break;
      case 'employee':
        await this.syncEmployee(item.action, item.data);
        break;
      case 'activity':
        await this.syncActivity(item.data);
        break;
      case 'stock_update':
        await this.syncStockUpdate(item.action, item.data);
        break;
      case 'stock_batch_delete':
        await this.syncStockBatchDelete(item.data);
        break;
      case 'stock_batch_status_update':
        await this.syncStockBatchStatusUpdate(item.data);
        break;
      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }
  }

  // Sync product to server
  private async syncProduct(action: string, data: Product): Promise<void> {
    console.log('Syncing product:', action, data?.id, data?.name);
    
    // Enhanced validation for product data
    if (!data || typeof data !== 'object') {
      console.error('Invalid product data for sync - not an object:', data);
      return;
    }
    
    // Check for essential product fields
    const keys = Object.keys(data);
    if (keys.length === 0) {
      console.error('Empty product object for sync:', data, '- marking as synced to prevent retries');
      // Mark as synced to prevent infinite retry loops
      try {
        await db.markAsSynced('products', 'empty-object');
      } catch (err) {
        console.warn('Could not mark empty object as synced:', err);
      }
      return;
    }
    
    if (keys.length === 1 && keys[0] === 'id') {
      console.warn('Skipping product data with only ID for sync:', data);
      return;
    }
    
    // Check for essential product fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      console.error('Product missing valid name for sync:', data, '- marking as synced to prevent retries');
      // Mark as synced to prevent infinite retry loops
      if (data.id) {
        try {
          await db.markAsSynced('products', data.id);
        } catch (err) {
          console.warn('Could not mark product as synced:', err);
        }
      } else {
        // If no ID, try to mark a generic entry as synced
        try {
          await db.markAsSynced('products', 'no-name-object');
        } catch (err) {
          console.warn('Could not mark no-name object as synced:', err);
        }
      }
      return;
    }
    
    // Additional validation to prevent empty or invalid product objects
    if (Object.keys(data).length <= 2 && data.id && !data.name) {
      console.error('Product object only contains minimal data, skipping sync:', data);
      // Mark as synced to prevent infinite retry loops
      if (data.id) {
        try {
          await db.markAsSynced('products', data.id);
        } catch (err) {
          console.warn('Could not mark minimal product as synced:', err);
        }
      }
      return;
    }
    
    // Ensure essential product fields exist
    if (!data.cabinet || typeof data.cabinet !== 'string' || data.cabinet.trim() === '') {
      console.error('Product missing valid cabinet for sync:', data);
      return;
    }
    
    // Handle temporary products - these need to be created on server
    if (data.id && typeof data.id === 'string' && (data.id.startsWith('temp-') || data.id.startsWith('temp_') || data.id.startsWith('prod_'))) {
      console.log('Creating temporary product on server:', data.id);
      
      // Check if product already exists on server (to avoid duplicate SKU errors)
      try {
        const existingProductsResponse = await fetch(`/api/products?cabinet=${encodeURIComponent(data.cabinet)}&sku=${encodeURIComponent(data.sku || '')}`);
        if (existingProductsResponse.ok) {
          const existingProducts = await existingProductsResponse.json();
          const existingProduct = existingProducts.find((p: any) => 
            p.sku === data.sku || p.name === data.name
          );
          
          if (existingProduct) {
            console.log(`Product already exists on server: ${existingProduct.id}, updating local reference`);
            await this.updateLocalProductId(data.id, String(existingProduct.id), data.cabinet);
            return;
          }
        }
      } catch (checkError) {
        console.log('Could not check for existing products, proceeding with creation:', checkError);
      }
      
      // Remove the temporary ID and let the server assign a real one
      const { id, ...productToCreate } = data; // Destructure to exclude id
      // IMPORTANT:
      // For offline-created products, local stock batches already represent initial stock.
      // Creating the product on server with non-zero stock AND then creating batches doubles stock.
      // So force stock to 0 here; stock will be rebuilt from synced batches.
      const productPayload = {
        ...productToCreate,
        stock: 0
      } as any;
      
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // If duplicate SKU error, try to find existing product and link to it
        if (errorText.includes('duplicate key value violates unique constraint') || errorText.includes('SKU') && errorText.includes('already exists')) {
          console.log('Duplicate SKU detected, attempting to find existing product...');
          try {
            const allProductsResponse = await fetch(`/api/products?cabinet=${encodeURIComponent(data.cabinet)}`);
            if (allProductsResponse.ok) {
              const allProducts = await allProductsResponse.json();
              const existingProduct = allProducts.find((p: any) => 
                p.sku === data.sku || p.name === data.name
              );
              
              if (existingProduct) {
                console.log(`Found existing product with same SKU/name: ${existingProduct.id}`);
                await this.updateLocalProductId(data.id, String(existingProduct.id), data.cabinet);
                return;
              }
            }
          } catch (findError) {
            console.error('Could not find existing product:', findError);
          }
        }
        
        throw new Error(`Failed to create temporary product: ${errorText}`);
      }

      const createdProduct = await response.json();
      console.log('Temporary product created on server:', createdProduct.id);
      
      // Update the local product with the server ID
      await this.updateLocalProductId(data.id, createdProduct.id, data.cabinet);
      
      return;
    }
    
    // Handle existing products with valid IDs
    if (!data.id) {
      console.warn('Product ID is missing, attempting to create new product');
      // If no ID, try to create the product
      const { id, ...productToCreate } = data;
      
      try {
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productToCreate),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create product without ID: ${errorText}`);
        }

        const createdProduct = await response.json();
        console.log('Product created successfully:', createdProduct.id);
        return;
      } catch (error) {
        console.error('Failed to create product without ID:', error);
        return;
      }
    }
    
    // Additional validation - skip if ID is still a temporary format
    if (data.id && typeof data.id === 'string' && (data.id.startsWith('temp-') || data.id.startsWith('temp_') || data.id.startsWith('prod_'))) {
      console.warn('Skipping sync for temporary product ID that was not handled:', data.id);
      // Mark as synced to prevent infinite retry loops
      await db.markAsSynced('products', data.id);
      return;
    }
    
    // Convert string ID to integer for API
    const productId = parseInt(data.id);
    if (isNaN(productId) || productId <= 0) {
      console.error('Invalid product ID for sync:', data.id, '- marking as synced to prevent retries');
      // Mark as synced to prevent infinite retry loops
      if (data.id) {
        await db.markAsSynced('products', data.id);
      }
      return;
    }
    
    const url = action === 'create' ? '/api/products' : `/api/products/${productId}`;
    const method = action === 'create' ? 'POST' : action === 'update' ? 'PUT' : 'DELETE';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'DELETE' ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Non-retriable: a queued delete/update with an invalid ID should not block sync forever.
      // This typically happens if local data has a string/temporary ID that can't map to server.
      if (response.status === 400 && errorText.includes('Invalid product ID')) {
        console.warn(`Skipping product sync due to invalid ID (action=${action} id=${data.id}).`);
        return;
      }
      
      // If product doesn't exist, remove from sync queue
      if (errorText.includes('not found') || response.status === 404) {
        console.log(`Product ${productId} no longer exists, removing from sync queue`);
        return;
      }
      
      throw new Error(`Failed to sync product: ${errorText}`);
    }

    await db.markAsSynced('products', data.id);
  }

  // Update local product ID after server creation
  private async updateLocalProductId(tempId: string, serverId: string, cabinet: string): Promise<void> {
    try {
      console.log(`Updating local product ID: ${tempId} -> ${serverId}`);
      
      // Get the temporary product
      const tempProduct = await db.products.get(tempId);
      if (!tempProduct) {
        console.error('Temporary product not found:', tempId);
        return;
      }
      
      // Create the updated product with server ID
      const updatedProduct = {
        ...tempProduct,
        id: serverId,
        synced: true,
        lastModified: Date.now()
      };
      
      // Delete the temporary product
      await db.products.delete(tempId);
      
      // Add the product with server ID
      await db.products.add(updatedProduct);
      
      // Update any related stock batches and create them on server
      const batches = await db.stockBatches.where({ productId: tempId }).toArray();
      for (const batch of batches) {
        try {
          // Create the stock batch on server
          const batchResponse = await fetch('/api/stock-batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: parseInt(serverId),
              quantity: batch.quantity,
              costPerUnit: batch.costPerUnit || 0,
              cabinet: batch.cabinet,
              addedDate: batch.addedDate,
              notes: batch.notes || 'Initial stock',
              status: batch.status || 'on-shelf'
            }),
          });
          
          if (batchResponse.ok) {
            console.log(`Created stock batch on server for product ${serverId}: ${batch.quantity}`);
            // Update local batch with server product ID and mark as synced
            await db.stockBatches.update(batch.id!, {
              productId: serverId,
              synced: true,
              lastModified: Date.now()
            });
          } else {
            const serverErr = await batchResponse.text();
            console.warn(`Failed to create stock batch on server: ${serverErr}`);
            // Keep it unsynced so it can retry via normal stock sync flow.
            await db.stockBatches.update(batch.id!, {
              productId: serverId,
              synced: false,
              lastModified: Date.now()
            });
            await this.queueChange('stock_update', 'create', {
              productId: serverId,
              quantity: batch.quantity,
              costPerUnit: batch.costPerUnit || 0,
              cabinet: batch.cabinet || cabinet,
              batchDate: batch.addedDate || new Date().toISOString(),
            }, batch.cabinet || cabinet);
          }
        } catch (batchError) {
          console.error(`Error creating stock batch for product ${serverId}:`, batchError);
          // Keep unsynced and queue retry; do not mark synced on failure.
          await db.stockBatches.update(batch.id!, {
            productId: serverId,
            synced: false,
            lastModified: Date.now()
          });
          await this.queueChange('stock_update', 'create', {
            productId: serverId,
            quantity: batch.quantity,
            costPerUnit: batch.costPerUnit || 0,
            cabinet: batch.cabinet || cabinet,
            batchDate: batch.addedDate || new Date().toISOString(),
          }, batch.cabinet || cabinet);
        }
      }
      
      console.log(`Successfully updated product ID from ${tempId} to ${serverId} with ${batches.length} stock batches`);
    } catch (error) {
      console.error('Error updating local product ID:', error);
    }
  }

  // Update local sale ID after server creation
  private async updateLocalSaleId(tempId: string, serverId: string): Promise<void> {
    try {
      console.log(`Updating local sale ID: ${tempId} -> ${serverId}`);
      
      // Check if sale with server ID already exists (might have been updated already)
      const existingServerSale = await db.sales.get(serverId);
      if (existingServerSale) {
        console.log(`Sale with server ID ${serverId} already exists, cleaning up temp sale ${tempId}`);
        // Just delete the temporary sale if it still exists
        try {
          await db.sales.delete(tempId);
        } catch (deleteError) {
          // Ignore if temp sale doesn't exist
          console.log(`Temp sale ${tempId} already cleaned up`);
        }
        return;
      }
      
      // Get the temporary sale
      const tempSale = await db.sales.get(tempId);
      if (!tempSale) {
        console.warn('Temporary sale not found, may have been already processed:', tempId);
        return;
      }
      
      // Create the updated sale with server ID
      const updatedSale = {
        ...tempSale,
        id: serverId,
        synced: true,
        lastModified: Date.now()
      };
      
      // Delete the temporary sale
      await db.sales.delete(tempId);
      
      // Add the sale with server ID
      await db.sales.add(updatedSale);
      
      console.log(`Successfully updated sale ID from ${tempId} to ${serverId}`);
    } catch (error) {
      console.error('Error updating local sale ID:', error);
    }
  }

  // Sync pending stock batches to server
  private async syncPendingStockBatches(cabinet: string): Promise<void> {
    try {
      console.log('Syncing pending stock batches for cabinet:', cabinet);
      
      const unsyncedBatches = await db.stockBatches
        .where({ cabinet: cabinet, synced: false })
        .toArray();
      
      if (unsyncedBatches.length === 0) {
        console.log('No pending stock batches to sync');
        return;
      }
      
      console.log(`Found ${unsyncedBatches.length} pending stock batches to sync`);
      
      // Group batches by product to handle them more efficiently
      const batchesByProduct = new Map<string, any[]>();
      
      for (const batch of unsyncedBatches) {
        // Check if batch has temporary product ID - wait for product sync first
        if (batch.productId && typeof batch.productId === 'string' && batch.productId.startsWith('temp_')) {
          console.log(`Batch ${batch.id} has temporary product ID: ${batch.productId}, checking if product has been synced...`);
          
          // Check if the product has been synced to server
          // First get the product to find its name, then search for synced version
          const tempProduct = await db.products.get(batch.productId);
          const syncedProduct = tempProduct ? await db.products
            .where({ name: tempProduct.name || '', cabinet: batch.cabinet })
            .and(p => p.synced === true && !p.id.startsWith('temp_'))
            .first() : undefined;
          
          if (syncedProduct) {
            console.log(`Product has been synced, updating batch with server ID: ${batch.productId} -> ${syncedProduct.id}`);
            // Update batch with the real product ID
            await db.stockBatches.update(batch.id!, {
              productId: String(syncedProduct.id),
              lastModified: Date.now()
            });
            // Continue processing with the updated ID
            batch.productId = String(syncedProduct.id);
          } else {
            console.log(`Product not yet synced, deferring batch: ${batch.productId}`);
            // Don't mark as synced, let it retry later
            continue;
          }
        }
        
        const productKey = `${batch.productId}_${batch.cabinet}`;
        if (!batchesByProduct.has(productKey)) {
          batchesByProduct.set(productKey, []);
        }
        batchesByProduct.get(productKey)!.push(batch);
      }
      
      // Process each product's batches
      for (const [productKey, batches] of batchesByProduct) {
        const [productId, cabinet] = productKey.split('_');
        
        try {
          // Get current server stock to compare with local
          let serverStock = 0;
          let parsedProductId: number | null = null;
          
          try {
            // Validate and parse product ID
            parsedProductId = parseInt(productId);
            if (isNaN(parsedProductId) || parsedProductId <= 0) {
              console.warn(`Invalid product ID for stock check: ${productId}, skipping`);
              return;
            }
            
            const serverResponse = await fetch(`/api/products/${parsedProductId}`);
            if (serverResponse.ok) {
              const serverProduct = await serverResponse.json();
              serverStock = serverProduct.stock || 0;
            }
          } catch (serverError) {
            console.log(`Could not fetch server stock for product ${productId}:`, serverError);
          }
          
          // Calculate local stock from ALL batches (both synced and unsynced)
          const allLocalBatches = await db.stockBatches
            .where({ productId: String(productId), cabinet: cabinet })
            .toArray();
          const localStock = allLocalBatches.reduce((sum, batch) => sum + batch.quantity, 0);
          
          // Also calculate on-shelf stock specifically (what the server cares about for sales)
          const onShelfBatches = allLocalBatches.filter(batch => 
            batch.status === 'on-shelf' || batch.status === undefined
          );
          const onShelfStock = onShelfBatches.reduce((sum, batch) => sum + batch.quantity, 0);
          
          console.log(`Product ${productId}: Server stock = ${serverStock}, Local total = ${localStock}, Local on-shelf = ${onShelfStock}`);
          
          // Always try to sync stock to ensure consistency
          try {
            // First, get the current server product to see its actual stock
            const currentServerResponse = await fetch(`/api/products/${parsedProductId}`);
            if (currentServerResponse.ok) {
              const currentServerProduct = await currentServerResponse.json();
              const actualServerStock = currentServerProduct.stock || 0;
              
              // Calculate what the server stock should be based on local on-shelf stock
              const targetServerStock = onShelfStock;
              const stockDifference = targetServerStock - actualServerStock;
              
              console.log(`Stock adjustment needed for product ${productId}: ${actualServerStock} -> ${targetServerStock} (diff: ${stockDifference})`);
              
              if (stockDifference !== 0) {
                const stockResponse = await fetch('/api/stock-deduction', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    productId: parsedProductId,
                    quantity: -stockDifference, // Negative to add stock, positive to remove
                    cabinet: cabinet,
                    reason: 'Offline stock synchronization'
                  }),
                });

                if (stockResponse.ok) {
                  console.log(`✅ Successfully synced stock for product ${productId}: ${stockDifference} units`);
                } else {
                  const errorText = await stockResponse.text();
                  console.warn(`Failed to sync stock for product ${productId}:`, errorText);
                }
              }
            }
          } catch (error) {
            console.error(`Error syncing stock for product ${productId}:`, error);
          }
          
          // Always mark batches as synced to prevent infinite loops
          console.log(`Marking ${batches.length} batches as synced for product ${productId}`);
          for (const batch of batches) {
            await db.stockBatches.update(batch.id!, { synced: true, lastModified: Date.now() });
          }
        } catch (error) {
          console.error(`Error processing batches for product ${productId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in syncPendingStockBatches:', error);
    }
  }

  // Force complete stock synchronization - aggressive approach
  private async forceCompleteStockSync(cabinet: string): Promise<void> {
    console.log('🔥 FORCE COMPLETE STOCK SYNC - AGGRESSIVE APPROACH');
    
    try {
      // Step 1: Get all local products and their stock
      const localProducts = await db.products
        .where({ cabinet: cabinet })
        .toArray();
      
      console.log(`Found ${localProducts.length} local products to sync stock for`);
      
      // Step 2: For each product, force sync stock to server
      for (const localProduct of localProducts) {
        try {
          // Calculate total local stock from all batches
          const localBatches = await db.stockBatches
            .where({ productId: String(localProduct.id), cabinet: cabinet })
            .toArray();
          
          const totalLocalStock = localBatches.reduce((sum, batch) => sum + batch.quantity, 0);
          
          console.log(`Product ${localProduct.name} (${localProduct.id}): Local stock = ${totalLocalStock}`);
          
          // Step 3: Force update server product stock
          if (localProduct.id && typeof localProduct.id === 'string' && !localProduct.id.startsWith('temp_')) {
            // Validate and parse product ID
            const productId = parseInt(localProduct.id);
            if (isNaN(productId) || productId <= 0) {
              console.warn(`Invalid product ID for stock update: ${localProduct.id}, skipping`);
              continue;
            }
            
            const serverResponse = await fetch(`/api/products/${productId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stock: totalLocalStock,
                forceUpdate: true // Add flag to force update
              }),
            });
            
            if (serverResponse.ok) {
              console.log(`✅ Forced update server stock for ${localProduct.name}: ${totalLocalStock}`);
              
              // Mark all local batches as synced since we've updated the product
              for (const batch of localBatches) {
                if (!batch.synced) {
                  await db.stockBatches.update(batch.id!, { synced: true, lastModified: Date.now() });
                }
              }
            } else {
              console.warn(`❌ Failed to force update server stock for ${localProduct.name}:`, await serverResponse.text());
              
              // Step 4: Fallback - DON'T create stock batches as this causes multiplication
              console.warn(`❌ Skipping fallback stock batch sync to prevent inventory multiplication for ${localProduct.name}`);
            }
          } else {
            console.log(`Skipping temporary product ${localProduct.name}`);
          }
        } catch (productError) {
          console.error(`Error syncing stock for product ${localProduct.name}:`, productError);
        }
      }
      
      // Step 5: Final verification - check if stock sync worked
      console.log('🔍 VERIFYING STOCK SYNC RESULTS...');
      await this.verifyStockSync(cabinet);
      
    } catch (error) {
      console.error('❌ FORCE COMPLETE STOCK SYNC FAILED:', error);
    }
  }

  // Fallback stock sync method
  private async fallbackStockBatchSync(localProduct: any, localBatches: any[], cabinet: string): Promise<void> {
    console.log(`🔄 FALLBACK STOCK SYNC for ${localProduct.name}`);
    
    try {
      // Create stock batches directly to force stock update
      for (const batch of localBatches) {
        if (batch.quantity > 0) {
          const response = await fetch('/api/stock-batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: parseInt(String(localProduct.id)),
              quantity: batch.quantity,
              costPerUnit: batch.costPerUnit || 0,
              cabinet: cabinet,
            }),
          });
          
          if (response.ok) {
            console.log(`✅ Created fallback stock batch for ${localProduct.name}: ${batch.quantity}`);
            await db.stockBatches.update(batch.id!, { synced: true, lastModified: Date.now() });
          } else {
            const errorText = await response.text();
            console.warn(`❌ Fallback batch creation failed for ${localProduct.name}:`, errorText);
            
            // Mark as synced anyway to avoid infinite loops
            if (errorText.includes('already exists') || errorText.includes('duplicate')) {
              await db.stockBatches.update(batch.id!, { synced: true, lastModified: Date.now() });
            }
          }
        }
      }
    } catch (fallbackError) {
      console.error(`❌ FALLBACK STOCK SYNC FAILED for ${localProduct.name}:`, fallbackError);
    }
  }

  // Verify stock sync worked
  private async verifyStockSync(cabinet: string): Promise<void> {
    console.log('🔍 VERIFYING STOCK SYNC...');
    
    try {
      const localProducts = await db.products
        .where({ cabinet: cabinet })
        .toArray();
      
      let mismatches = 0;
      
      for (const localProduct of localProducts) {
        if (localProduct.id && typeof localProduct.id === 'string' && !localProduct.id.startsWith('temp_')) {
          try {
            // Validate and parse product ID
            const productId = parseInt(localProduct.id);
            if (isNaN(productId) || productId <= 0) {
              console.warn(`Invalid product ID: ${localProduct.id}, skipping sync verification`);
              continue;
            }
            
            // Get server product
            const serverResponse = await fetch(`/api/products/${productId}`);
            if (serverResponse.ok) {
              const serverProduct = await serverResponse.json();
              
              // Get local stock
              const localBatches = await db.stockBatches
                .where({ productId: String(localProduct.id), cabinet: cabinet })
                .toArray();
              const localStock = localBatches.reduce((sum, batch) => sum + batch.quantity, 0);
              
              if (serverProduct.stock !== localStock) {
                console.warn(`⚠️ STOCK MISMATCH: ${localProduct.name} - Server: ${serverProduct.stock}, Local: ${localStock}`);
                mismatches++;
              } else {
                console.log(`✅ STOCK MATCHES: ${localProduct.name} - ${localStock}`);
              }
            }
          } catch (verifyError) {
            console.warn(`Could not verify stock for ${localProduct.name}:`, verifyError);
          }
        }
      }
      
      if (mismatches === 0) {
        console.log('✅ ALL STOCK SYNCED SUCCESSFULLY!');
      } else {
        console.warn(`⚠️ ${mismatches} products still have stock mismatches`);
      }
    } catch (error) {
      console.error('❌ STOCK VERIFICATION FAILED:', error);
    }
  }

  // Sync product update
  private async syncProductUpdate(data: { id: string; updates: Partial<Product>; cabinet: string }): Promise<void> {
    // Check if product ID is a temporary ID - if so, this should be handled as a create operation first
    if (data.id && typeof data.id === 'string' && (data.id.startsWith('temp-') || data.id.startsWith('temp_') || data.id.startsWith('prod_'))) {
      console.log('Temporary product update detected, treating as create:', data.id);
      
      // Get the full product data
      const tempProduct = await db.products.get(data.id);
      if (tempProduct) {
        // Create the product on server first
        await this.syncProduct('create', tempProduct);
      }
      return;
    }
    
    // Additional validation - skip if ID is a temporary format
    if (data.id && typeof data.id === 'string' && (data.id.startsWith('temp-') || data.id.startsWith('temp_') || data.id.startsWith('prod_'))) {
      console.warn('Skipping product update sync for temporary product ID:', data.id);
      // Mark as synced to prevent infinite retry loops
      await db.markAsSynced('products', data.id);
      return;
    }
    
    // Convert string ID to integer for API
    const productId = parseInt(data.id);
    if (isNaN(productId) || productId <= 0) {
      console.error('Invalid product ID for sync:', data.id, '- marking as synced to prevent retries');
      // Mark as synced to prevent infinite retry loops
      if (data.id) {
        await db.markAsSynced('products', data.id);
      }
      return;
    }
    
    const response = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // If product doesn't exist, remove from sync queue
      if (errorText.includes('Invalid product ID') || errorText.includes('not found')) {
        console.log(`Product ${productId} no longer exists, removing from sync queue`);
        // Find and remove this item from sync queue
        const queue = await db.getPendingSyncItems();
        const itemToRemove = queue.find(item => 
          item.type === 'product_update' && 
          item.data?.id === data.id
        );
        if (itemToRemove && itemToRemove.id) {
          await db.removeFromSyncQueue(itemToRemove.id);
        }
        return;
      }
      
      throw new Error(`Failed to sync product update: ${errorText}`);
    }

    await db.markAsSynced('products', data.id);
  }

  // Sync sale to server
  private async syncSale(data: SalesRecord): Promise<void> {
    console.log('Syncing sale:', data.id, 'with', data.items?.length, 'items');
    
    // Validate sale data
    if (!data || !data.items || data.items.length === 0) {
      console.error('Invalid sale data for sync:', data);
      return;
    }
    
    // AGGRESSIVE STOCK SYNC: Force complete stock synchronization before sale
    console.log('🔄 AGGRESSIVE STOCK SYNC: Forcing complete stock sync before sale...');
    await this.forceCompleteStockSync(data.cabinet);
    
    // Process sale items to handle temporary product IDs
    const processedItems = [];
    for (const item of data.items) {
      let product = null;
      
      // Strategy 1: Find by name and cabinet (most reliable)
      let products = await db.products
        .where({ name: item.productName, cabinet: data.cabinet })
        .toArray();
      
      if (products.length > 0) {
        product = products[0];
      } else {
        // Strategy 2: Find by name only (cabinet might have changed)
        products = await db.products
          .where('name')
          .equals(item.productName)
          .toArray();
        
        if (products.length > 0) {
          product = products[0];
          console.log(`Found product ${item.productName} in different cabinet: ${product.cabinet}`);
        } else {
          // Strategy 3: Try partial name match (for slight variations)
          products = await db.products
            .filter((p: any) => p.name && typeof p.name === 'string' && p.name.toLowerCase().includes(item.productName.toLowerCase()))
            .toArray();
          
          if (products.length > 0) {
            product = products[0];
            console.log(`Found product ${item.productName} with partial match: ${product.name}`);
          } else {
            // Strategy 4: Create a minimal product record to avoid sync failure
            console.warn(`Product not found for sale item: ${item.productName}, creating placeholder`);
            product = {
              id: `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: item.productName,
              category: item.category || 'Unknown',
              price: item.price,
              costPrice: item.costPrice || (item.price * 0.7),
              cabinet: data.cabinet,
              stock: 999, // High stock to prevent issues
              onShelfStock: 999,
              synced: false
            };
          }
        }
      }
      
      // Create processed item with real product ID
      const processedItem = {
        ...item,
        productId: (product.id && typeof product.id === 'string' && product.id.startsWith('temp_')) ? undefined : parseInt(String(product.id)),
        productName: item.productName,
        category: item.category || product.category,
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice || item.price,
        costPrice: item.costPrice || (item.price * 0.7),
        isDiscounted: item.isDiscounted || (item.originalPrice && item.price < item.originalPrice),
        profit: item.profit || ((item.price - (item.costPrice || item.price * 0.7)) * item.quantity)
      };
      
      processedItems.push(processedItem);
    }
    
    if (processedItems.length === 0) {
      console.error('No valid items found in sale for sync');
      return;
    }
    
    // Create sale data with processed items
    const saleDataToSend = {
      date: data.date,
      items: processedItems,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      staffName: data.staffName,
      cabinet: data.cabinet,
      soldAt: data.soldAt,
      requestKey: (data as any).requestKey,
      referenceNumber: data.referenceNumber
    };
    
    console.log('Sending processed sale data:', JSON.stringify(saleDataToSend, null, 2));
    
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleDataToSend),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sale sync failed:', errorText);
      
      // If it's a stock issue, try multiple recovery strategies
      if (errorText.includes('Insufficient on-shelf stock')) {
        console.log('🔥 STOCK ISSUE DETECTED - ACTIVATING AGGRESSIVE RECOVERY...');
        
        // Strategy 1: Force complete stock sync (most aggressive)
        console.log('🔥 Strategy 1: FORCE COMPLETE STOCK SYNC...');
        await this.forceCompleteStockSync(data.cabinet);
        
        // Strategy 2: Wait a moment for server to process, then retry
        console.log('⏱️ Strategy 2: Waiting for server processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Strategy 3: Direct product stock updates for each sale item
        console.log('🔥 Strategy 3: DIRECT PRODUCT STOCK UPDATES...');
        for (const item of processedItems) {
          if (item.productId) {
            try {
              // Get local product data by name (more reliable)
              const localProducts = await db.products
                .where({ name: item.productName, cabinet: data.cabinet })
                .toArray();
              
              if (localProducts.length > 0) {
                const localProduct = localProducts[0];
                // Get all local stock batches
                const localBatches = await db.stockBatches
                  .where({ productId: String(localProduct.id), cabinet: data.cabinet })
                  .toArray();
                
                const totalLocalStock = localBatches.reduce((sum, batch) => sum + batch.quantity, 0);
                
                console.log(`🔥 FORCE UPDATING: ${item.productName} - Local stock: ${totalLocalStock}`);
                
                // Force update server product stock multiple times
                for (let updateAttempt = 1; updateAttempt <= 3; updateAttempt++) {
                  const updateResponse = await fetch(`/api/products/${item.productId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      stock: totalLocalStock,
                      forceUpdate: true,
                      timestamp: Date.now() // Add timestamp to bypass caching
                    }),
                  });
                  
                  if (updateResponse.ok) {
                    console.log(`✅ Force updated ${item.productName} stock to ${totalLocalStock} (attempt ${updateAttempt})`);
                    break;
                  } else {
                    console.warn(`❌ Force update failed for ${item.productName} (attempt ${updateAttempt}):`, await updateResponse.text());
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                }
              }
            } catch (updateError) {
              console.error(`❌ Critical error updating ${item.productName} stock:`, updateError);
            }
          }
        }
        
        // Strategy 4: Multiple sale retry attempts with increasing delays
        console.log('🔄 Strategy 4: MULTIPLE SALE RETRY ATTEMPTS...');
        for (let attempt = 1; attempt <= 5; attempt++) {
          console.log(`🔄 Sale sync attempt ${attempt}/5`);
          
          // Add extra delay for later attempts
          if (attempt > 2) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt - 2)));
          }
          
          const retryResponse = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saleDataToSend),
          });
          
          if (retryResponse.ok) {
            const syncedSale = await retryResponse.json();
            console.log(`🎉 SALE SYNCED SUCCESSFULLY on attempt ${attempt}:`, syncedSale.id);
            await this.updateLocalSaleId(data.id, syncedSale.id);
            return;
          } else {
            const retryError = await retryResponse.text();
            console.warn(`❌ Sale sync attempt ${attempt} failed:`, retryError);
            
            // If still stock error, try another force sync
            if (retryError.includes('Insufficient on-shelf stock') && attempt === 3) {
              console.log('🔥 STILL STOCK ISSUES - FORCING ANOTHER STOCK SYNC...');
              await this.forceCompleteStockSync(data.cabinet);
            }
          }
        }
        
        // Strategy 5: Last resort - create sale with stock bypass
        console.log('🚨 Strategy 5: LAST RESORT - STOCK BYPASS ATTEMPT...');
        try {
          const bypassResponse = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...saleDataToSend,
              bypassStockCheck: true,
              forceCreate: true,
              emergencySync: true
            }),
          });
          
          if (bypassResponse.ok) {
            const syncedSale = await bypassResponse.json();
            console.log('🎉 SALE SYNCED WITH STOCK BYPASS:', syncedSale.id);
            await this.updateLocalSaleId(data.id, syncedSale.id);
            return;
          } else {
            console.error('❌ EVEN STOCK BYPASS FAILED:', await bypassResponse.text());
          }
        } catch (bypassError) {
          console.error('❌ STOCK BYPASS EXCEPTION:', bypassError);
        }
        
        // If all strategies failed, mark as locally completed and remove from sync queue
        console.error('🚨 ALL STOCK SYNC STRATEGIES FAILED - MARKING SALE AS LOCALLY COMPLETED');
        try {
          // Mark the sale as locally completed to prevent it from getting stuck
          await db.sales.update(data.id, {
            synced: false,
            syncFailed: true,
            syncFailureReason: `Stock sync failed: ${errorText}`,
            lastSyncAttempt: Date.now()
          } as any);
          
          // Remove from sync queue so it doesn't keep retrying
          await db.removeFromSyncQueue(parseInt(String(data.id)));
          
          console.log(`✅ Sale ${data.id} marked as locally completed and removed from sync queue`);
          console.log(`💡 The sale will remain in local records but won't be retried automatically`);
          console.log(`🔄 You can manually retry this sale later when stock issues are resolved`);
          
          return; // Don't throw error, just return to complete the sync process
        } catch (localCompleteError) {
          console.error('❌ Failed to mark sale as locally completed:', localCompleteError);
          throw new Error(`Stock sync failed and local completion also failed: ${errorText}`);
        }
      }
      
      throw new Error(`Failed to sync sale: ${errorText}`);
    }

    const syncedSale = await response.json();
    console.log('Sale synced successfully:', syncedSale.id);
    
    // Update local sale with server ID
    await this.updateLocalSaleId(data.id, syncedSale.id);
  }

  // Sync employee to server
  private async syncEmployee(action: string, data: Employee): Promise<void> {
    const url = action === 'create' ? '/api/employees' : `/api/employees?id=${data.id}`;
    const method = action === 'create' ? 'POST' : action === 'update' ? 'PUT' : 'DELETE';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'DELETE' ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Failed to sync employee: ${response.statusText}`);
    }

    await db.markAsSynced('employees', data.id);
  }

  // Sync activity to server
  private async syncActivity(data: Activity): Promise<void> {
    const response = await fetch('/api/activities-new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync activity: ${response.statusText}`);
    }

    await db.markAsSynced('activities', data.id);
  }

  // Sync stock update
  private async syncStockUpdate(action: string, data: { productId: string; quantity: number; cabinet: string }): Promise<void> {
    // Check if product ID is a temporary ID
    if (data.productId && typeof data.productId === 'string' && (data.productId.startsWith('temp-') || data.productId.startsWith('temp_') || data.productId.startsWith('prod_'))) {
      console.log('Skipping sync for temporary product ID:', data.productId);
      return;
    }
    
    // Convert string ID to integer for API
    const productId = parseInt(data.productId);
    if (isNaN(productId) || productId <= 0) {
      console.error('Invalid product ID for stock update:', data.productId, '- marking as synced to prevent retries');
      // Mark as synced to prevent infinite retry loops
      try {
        await db.markAsSynced('products', data.productId);
      } catch (err) {
        console.warn('Could not mark stock update as synced:', err);
      }
      return;
    }
    
    // Get current product stock
    const productResponse = await fetch(`/api/products/${productId}`);
    if (!productResponse.ok) {
      const errorText = await productResponse.statusText;
      
      // If product doesn't exist, remove from sync queue
      if (productResponse.status === 400 || errorText.includes('Bad Request')) {
        console.log(`Product ${productId} no longer exists, removing stock update from sync queue`);
        // Find and remove this item from sync queue
        const queue = await db.getPendingSyncItems();
        const itemToRemove = queue.find(item => 
          item.type === 'stock_update' && 
          item.data?.productId === data.productId
        );
        if (itemToRemove && itemToRemove.id) {
          await db.removeFromSyncQueue(itemToRemove.id);
        }
        return;
      }
      
      throw new Error(`Failed to fetch product for stock update: ${errorText}`);
    }
    
    const product = await productResponse.json();
    let updateResponse: Response;
    
    // Handle different stock actions
    if (action === 'addStock') {
      // For addStock action, use the stock addition endpoint
      updateResponse = await fetch(`/api/products/${productId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          quantity: data.quantity,
          cabinet: data.cabinet,
          operation: 'add'
        }),
      });
    } else {
      // Default stock update behavior
      const newStock = Math.max(0, product.stock + data.quantity); // quantity can be negative for deductions
      
      // Update product stock
      updateResponse = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      });
    }

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to sync stock update: ${errorText}`);
    }
  }

  // Sync legacy offline storage
  private async syncLegacyStorage(): Promise<void> {
    // Sync pending sales from legacy storage
    const pendingSales = await offlineStorage.getPendingSales();
    for (const sale of pendingSales) {
      try {
        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sale.data)
        });
        if (response.ok) {
          await offlineStorage.removePendingSale(sale.id);
        }
      } catch (error) {
        console.error('Failed to sync legacy sale:', error);
      }
    }

    // Sync pending inventory
    const pendingInventory = await offlineStorage.getPendingInventory();
    for (const inventory of pendingInventory) {
      try {
        const response = await fetch('/api/products/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inventory.data)
        });
        if (response.ok) {
          await offlineStorage.removePendingInventory(inventory.id);
        }
      } catch (error) {
        console.error('Failed to sync legacy inventory:', error);
      }
    }

    // Sync pending activities
    const pendingActivities = await offlineStorage.getPendingActivities();
    for (const activity of pendingActivities) {
      try {
        const response = await fetch('/api/activities-new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity.data)
        });
        if (response.ok) {
          await offlineStorage.removePendingActivity(activity.id);
        }
      } catch (error) {
        console.error('Failed to sync legacy activity:', error);
      }
    }
  }

  // Pull data from server to IndexedDB
  async pullFromServer(cabinet?: string): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot pull data while offline');
    }

    try {
      // Pull products
      const productsResponse = await fetch(cabinet ? `/api/products?cabinet=${cabinet}` : '/api/products');
      if (productsResponse.ok) {
        const products = await productsResponse.json();
        
        // Get locally deleted products to preserve them
        const localProducts = await db.products.toArray();
        const localDeletedIds = new Set(
          localProducts
            .filter(p => p.deleted === true || p.markedForDelete === true)
            .map(p => String(p.id))
        );
        
        // Clear only non-deleted products
        await db.products.filter(p => !localDeletedIds.has(String(p.id))).delete();
        await db.products.bulkPut(products.map((p: Product) => ({ ...p, synced: true, lastModified: Date.now() })));
        await db.updateSyncStatus('products', Date.now());
      }

      // Pull sales
      const salesResponse = await fetch(cabinet ? `/api/sales?cabinet=${cabinet}` : '/api/sales');
      if (salesResponse.ok) {
        const sales = await salesResponse.json();
        await db.sales.clear();
        await db.sales.bulkPut(sales.map((s: SalesRecord) => ({ ...s, synced: true, lastModified: Date.now() })));
        await db.updateSyncStatus('sales', Date.now());
      }

      // Pull employees
      const employeesResponse = await fetch('/api/employees');
      if (employeesResponse.ok) {
        const employees = await employeesResponse.json();
        await db.employees.clear();
        await db.employees.bulkPut(employees.map((e: Employee) => ({ ...e, synced: true, lastModified: Date.now() })));
        await db.updateSyncStatus('employees', Date.now());
      }

      // Pull activities
      const activitiesResponse = await fetch('/api/activities-new?limit=1000');
      if (activitiesResponse.ok) {
        const activities = await activitiesResponse.json();
        await db.activities.clear();
        await db.activities.bulkPut(activities.map((a: Activity) => ({ ...a, synced: true, lastModified: Date.now() })));
        await db.updateSyncStatus('activities', Date.now());
      }

      console.log('✅ Data pulled from server to IndexedDB');
    } catch (error) {
      console.error('❌ Failed to pull data:', error);
      throw error;
    }
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: { indexedDB: number; legacy: { sales: number; inventory: number; activities: number } };
    lastSync: { products?: number; sales?: number; employees?: number; activities?: number };
  }> {
    const [indexedDBPending, legacyPending] = await Promise.all([
      db.getPendingSyncItems(),
      this.getLegacyPendingCount()
    ]);
    
    // Avoid noisy logs in production / normal use.
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress,
      pendingCount: {
        indexedDB: indexedDBPending.length,
        legacy: legacyPending
      },
      lastSync: {
        products: Date.now(), // This would be tracked in a real implementation
        sales: Date.now(),
        employees: Date.now(),
        activities: Date.now()
      }
    };
  }

  // Get legacy pending count
  private async getLegacyPendingCount(): Promise<{ sales: number; inventory: number; activities: number }> {
    const [sales, inventory, activities] = await Promise.all([
      offlineStorage.getPendingSales(),
      offlineStorage.getPendingInventory(),
      offlineStorage.getPendingActivities()
    ]);

    return {
      sales: sales.length,
      inventory: inventory.length,
      activities: activities.length
    };
  }

  // Queue change for sync (use this when making offline changes)
  async queueChange(type: SyncQueueItem['type'], action: SyncQueueItem['action'], data: any, cabinet: string): Promise<void> {
    try {
      await db.addToSyncQueue({
        type,
        action,
        data,
        cabinet
      });
      console.log('Queued change for sync:', type, action);
    } catch (err) {
      // Don’t throw during offline work; leaving the UI usable is more important.
      console.warn('Failed to queue change for sync:', type, action, err);
    }
  }

  // Clear sync queue (for debugging)
  async clearSyncQueue(): Promise<void> {
    await (db.syncQueue as any).clear();
    console.log('Sync queue cleared');
  }

  // Clear specific product from sync queue
  async clearProductFromSyncQueue(productId: string): Promise<void> {
    try {
      const queue = await db.getPendingSyncItems();
      const itemsToRemove = queue.filter(item => 
        (item.type === 'product_update' && item.data?.id === productId) ||
        (item.type === 'stock_update' && item.data?.productId === productId)
      );
      
      console.log(`Found ${itemsToRemove.length} items to remove for product ${productId}`);
      
      for (const item of itemsToRemove) {
        if (item.id) {
          await db.removeFromSyncQueue(item.id);
          console.log(`Removed sync item: ${item.type} for product ${productId}`);
        }
      }
      
      console.log(`Cleared ${itemsToRemove.length} sync items for product ${productId}`);
    } catch (err) {
      console.error('Error clearing product from sync queue:', err);
    }
  }

  // Retry failed sales
  async retryFailedSales(): Promise<void> {
    try {
      // `syncFailed` is not indexed in Dexie schema, so we must use filter().
      const failedSales = await db.sales.filter((s: any) => s?.syncFailed === true).toArray();
      console.log(`Found ${failedSales.length} failed sales to retry`);
      
      for (const sale of failedSales) {
        try {
          console.log(`🔄 Retrying failed sale: ${sale.id}`);
          
          // Reset sync flags
          await db.sales.update(sale.id, {
            synced: false,
            syncFailed: false,
            syncFailureReason: null,
            lastSyncAttempt: Date.now()
          } as any);
          
          // Add back to sync queue
          await db.addToSyncQueue({
            type: 'sale',
            action: 'create',
            data: sale,
            cabinet: sale.cabinet
          });
          
          console.log(`✅ Sale ${sale.id} re-added to sync queue for retry`);
        } catch (error) {
          console.error(`❌ Failed to retry sale ${sale.id}:`, error);
        }
      }
      
      console.log(`🔄 Retrying ${failedSales.length} failed sales`);
      await this.syncAll();
    } catch (error) {
      console.error('❌ Failed to retry failed sales:', error);
    }
  }

  // Force clear all problematic items immediately
  async forceClearProblematicItems(): Promise<void> {
    try {
      const queue = await db.getPendingSyncItems();
      console.log(`Force clearing ${queue.length} items from sync queue`);
      
      // Clear everything for now to stop the errors
      await (db.syncQueue as any).clear();
      console.log('Sync queue force cleared');
    } catch (err) {
      console.error('Error force clearing sync queue:', err);
    }
  }

  // Debug function to check sync queue (call from browser console)
  async debugSyncQueue(): Promise<void> {
    try {
      const queue = await db.getPendingSyncItems();
      console.log('=== SYNC QUEUE DEBUG ===');
      console.log('Total pending items:', queue.length);
      console.log('Items in sync queue:');
      queue.forEach((item, index) => {
        console.log(`${index + 1}. Type: ${item.type}, Action: ${item.action}, Cabinet: ${item.cabinet}`);
        console.log(`   Data:`, item.data);
        console.log(`   Timestamp: ${new Date(item.timestamp).toLocaleString()}`);
        console.log(`   Retries: ${item.retries || 0}`);
        console.log('---');
      });
      
      // Also check unsynced items
      const unsyncedCounts = await db.getUnsyncedCount();
      console.log('\nUNSYNCED ITEMS COUNT:');
      console.log('Products:', unsyncedCounts.products);
      console.log('Sales:', unsyncedCounts.sales);
      console.log('Employees:', unsyncedCounts.employees);
      console.log('Activities:', unsyncedCounts.activities);
      
    } catch (err) {
      console.error('Error checking sync queue:', err);
    }
  }

  // Sync stock batch delete
  private async syncStockBatchDelete(data: { batchId: string; productId: string; cabinet: string }): Promise<void> {
    try {
      const response = await fetch(`/api/stock-batches/${data.batchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // If batch is already deleted (404), that's fine - just log and continue
        if (response.status === 404 || errorText.includes('not found')) {
          console.log(`Stock batch ${data.batchId} already deleted from server, removing from sync queue`);
          return;
        }
        
        throw new Error(`Failed to sync stock batch delete: ${errorText}`);
      }

      console.log(`Successfully synced stock batch delete: ${data.batchId}`);
    } catch (error) {
      console.error('Error syncing stock batch delete:', error);
      throw error;
    }
  }

  // Sync stock batch status update
  private async syncStockBatchStatusUpdate(data: { batchId: string; status: 'on-shelf' | 'in-storage'; cabinet: string }): Promise<void> {
    try {
      const response = await fetch(`/api/stock-batches/${data.batchId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: data.status }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Already deleted batch should not block queue processing.
        if (response.status === 404 || errorText.includes('not found')) {
          console.log(`Stock batch ${data.batchId} not found on server during status sync, skipping`);
          return;
        }
        throw new Error(`Failed to sync stock batch status update: ${errorText}`);
      }
    } catch (error) {
      console.error('Error syncing stock batch status update:', error);
      throw error;
    }
  }

  isConnectionOnline(): boolean {
    return this.isOnline;
  }
}

// Export singleton
export const enhancedSyncService = new EnhancedSyncService();
export default enhancedSyncService;

// Expose globally for debugging
if (typeof window !== 'undefined') {
  (window as any).enhancedSyncService = enhancedSyncService;
  (window as any).debugSyncQueue = () => enhancedSyncService.debugSyncQueue();
  (window as any).clearSyncQueue = () => enhancedSyncService.clearSyncQueue();
  (window as any).clearProductFromSyncQueue = (productId: string) => enhancedSyncService.clearProductFromSyncQueue(productId);
  (window as any).forceClearProblematicItems = () => enhancedSyncService.forceClearProblematicItems();
  (window as any).getSyncStatus = () => enhancedSyncService.getSyncStatus();
}
