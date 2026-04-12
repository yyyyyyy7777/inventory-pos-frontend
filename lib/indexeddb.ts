import Dexie, { Table } from 'dexie';

// Define interfaces for our database tables
export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  costPrice?: number;
  category: string;
  categoryId?: number;
  stock: number;
  location: 'online' | 'physical' | 'both';
  lastUpdated: string;
  lastRestockDate?: string;
  cabinet: string;
  description?: string;
  purchaseDate?: string;
  purchasePlace?: string;
  supplierName?: string;
  dimLengthCm?: number;
  dimWidthCm?: number;
  dimHeightCm?: number;
  weightKg?: number;
  imageUrl?: string;
  synced?: boolean;
  lastModified?: number;
  deleted?: boolean;
  markedForDelete?: boolean;
  deletedAt?: number;
}

export interface StockBatch {
  id?: number;
  productId: string;
  quantity: number;
  initialQuantity?: number;
  costPerUnit?: number;
  sellingPrice?: number;
  cabinet: string;
  addedDate: string;
  batchDate?: string;
  updatedAt?: string;
  notes?: string;
  synced?: boolean;
  lastModified?: number;
  status?: 'on-shelf' | 'in-storage' | 'sold';
  createdAt?: string;
}

export interface SaleItem {
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
  synced?: boolean;
  lastModified?: number;
}

export interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'manager' | 'staff';
  cabinet: string;
  joinDate: string;
  createdAt?: string;
  updatedAt?: string;
  synced?: boolean;
  lastModified?: number;
}

export interface Activity {
  id: string;
  username: string;
  activity: string;
  details?: string;
  category: 'sale' | 'inventory' | 'employee' | 'system' | 'product';
  timestamp: string;
  createdAt?: string;
  synced?: boolean;
  lastModified?: number;
}

export interface SyncQueueItem {
  id?: number;
  type: 'product' | 'sale' | 'employee' | 'activity' | 'product_update' | 'stock_update' | 'stock_batch_delete' | 'stock_batch_status_update';
  action: 'create' | 'update' | 'delete' | 'addStock';
  data: any;
  cabinet: string;
  timestamp: number;
  retries?: number;
  error?: string;
}

export interface DeletedBatch {
  batchId: string;
  productId: string;
  cabinet: string;
  deletedAt: number;
}

// Define the database
export class POSDatabase extends Dexie {
  products!: Table<Product>;
  sales!: Table<SalesRecord>;
  employees!: Table<Employee>;
  activities!: Table<Activity>;
  syncQueue!: Table<SyncQueueItem>;
  stockBatches!: Table<StockBatch>;
  syncStatus!: Table<{ id: string; lastSync: number; pending: number }>;
  deletedBatches!: Table<DeletedBatch>;

  constructor() {
    super('POSDatabase');
    
    this.version(1).stores({
      products: '++id, name, sku, category, cabinet, synced, lastModified',
      sales: '++id, date, cabinet, synced, lastModified, staffName',
      employees: '++id, name, role, cabinet, synced, lastModified',
      stockBatches: '++id, productId, cabinet, addedDate, synced, lastModified',
      activities: '++id, username, category, timestamp, synced, lastModified',
      syncQueue: '++id, type, action, cabinet, timestamp',
      syncStatus: 'id, lastSync, pending',
      deletedBatches: '++id, batchId, productId, cabinet, deletedAt'
    });
  }

  // Helper method to check if we're online
  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  // Add item to sync queue
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    await this.syncQueue.add({
      ...item,
      timestamp: Date.now(),
      retries: 0
    });
    console.log('Added to sync queue:', item.type, item.action);
  }

  // Get pending sync items
  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    return await this.syncQueue.orderBy('timestamp').toArray();
  }

  // Remove item from sync queue
  async removeFromSyncQueue(id: number): Promise<void> {
    await this.syncQueue.delete(id);
  }

  // Update retry count
  async updateSyncRetry(id: number, error: string): Promise<void> {
    const item = await this.syncQueue.get(id);
    if (item) {
      await this.syncQueue.update(id, {
        retries: (item.retries || 0) + 1,
        error: error
      });
    }
  }

  // Clear sync queue
  async clearSyncQueue(): Promise<void> {
    await this.syncQueue.clear();
  }

  // Get sync status
  async getSyncStatus(type: string): Promise<{ lastSync: number; pending: number } | null> {
    const status = await this.syncStatus.get(type);
    if (status) {
      const pending = await this.syncQueue.count();
      return { lastSync: status.lastSync, pending };
    }
    return null;
  }

  // Update sync status
  async updateSyncStatus(type: string, lastSync: number): Promise<void> {
    await this.syncStatus.put({ id: type, lastSync, pending: 0 });
  }

  // Get unsynced items count
  async getUnsyncedCount(): Promise<{ products: number; sales: number; employees: number; activities: number }> {
    const [products, sales, employees, activities] = await Promise.all([
      this.products.filter(p => p.synced === false).count(),
      this.sales.filter(s => s.synced === false).count(),
      this.employees.filter(e => e.synced === false).count(),
      this.activities.filter(a => a.synced === false).count()
    ]);
    return { products, sales, employees, activities };
  }

  // Mark items as synced
  async markAsSynced(table: 'products' | 'sales' | 'employees' | 'activities', id: string): Promise<void> {
    await this[table].update(id, { synced: true });
  }

  // Bulk mark as synced
  async bulkMarkAsSynced(table: 'products' | 'sales' | 'employees' | 'activities', ids: string[]): Promise<void> {
    await this[table].bulkUpdate(ids.map(id => ({ key: id, changes: { synced: true } })));
  }
}

// Create database instance
export const db = new POSDatabase();

// Export a helper to check if database is ready
export async function initDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('IndexedDB initialized successfully');
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw error;
  }
}

// Export database instance
export default db;
