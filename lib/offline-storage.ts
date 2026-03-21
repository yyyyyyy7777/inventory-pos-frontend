// Offline Storage Service with IndexedDB
export class OfflineStorage {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'wheezard-pos-offline';
  private readonly VERSION = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores for different data types
        if (!db.objectStoreNames.contains('pending-sales')) {
          const salesStore = db.createObjectStore('pending-sales', { keyPath: 'id', autoIncrement: true });
          salesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('pending-inventory')) {
          const inventoryStore = db.createObjectStore('pending-inventory', { keyPath: 'id', autoIncrement: true });
          inventoryStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('pending-activities')) {
          const activitiesStore = db.createObjectStore('pending-activities', { keyPath: 'id', autoIncrement: true });
          activitiesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('sync-status')) {
          db.createObjectStore('sync-status', { keyPath: 'type' });
        }
      };
    });
  }

  async addPendingSale(saleData: any): Promise<number> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-sales'], 'readwrite');
      const store = transaction.objectStore('pending-sales');
      
      const request = store.add({
        ...saleData,
        timestamp: Date.now(),
        type: 'sale'
      });
      
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async addPendingInventoryUpdate(inventoryData: any): Promise<number> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-inventory'], 'readwrite');
      const store = transaction.objectStore('pending-inventory');
      
      const request = store.add({
        ...inventoryData,
        timestamp: Date.now(),
        type: 'inventory'
      });
      
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async addPendingActivity(activityData: any): Promise<number> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-activities'], 'readwrite');
      const store = transaction.objectStore('pending-activities');
      
      const request = store.add({
        ...activityData,
        timestamp: Date.now(),
        type: 'activity'
      });
      
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSales(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-sales'], 'readonly');
      const store = transaction.objectStore('pending-sales');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingInventory(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-inventory'], 'readonly');
      const store = transaction.objectStore('pending-inventory');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingActivities(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-activities'], 'readonly');
      const store = transaction.objectStore('pending-activities');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingSale(id: number): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-sales'], 'readwrite');
      const store = transaction.objectStore('pending-sales');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingInventory(id: number): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-inventory'], 'readwrite');
      const store = transaction.objectStore('pending-inventory');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingActivity(id: number): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-activities'], 'readwrite');
      const store = transaction.objectStore('pending-activities');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async setSyncStatus(type: string, status: { lastSync: number; pending: number }): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync-status'], 'readwrite');
      const store = transaction.objectStore('sync-status');
      const request = store.put({ type, ...status });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncStatus(type: string): Promise<{ lastSync: number; pending: number } | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync-status'], 'readonly');
      const store = transaction.objectStore('sync-status');
      const request = store.get(type);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
