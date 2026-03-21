// Background Sync Service
import { offlineStorage } from './offline-storage';

export class SyncService {
  private isOnline: boolean = true; // Default to online for SSR
  private syncInProgress: boolean = false;

  constructor() {
    // Only add event listeners on client-side
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      // Listen for online/offline events
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
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
    console.log('🔄 Starting background sync...');

    try {
      // Sync pending sales
      await this.syncSales();
      
      // Sync pending inventory updates
      await this.syncInventory();
      
      // Sync pending activities
      await this.syncActivities();

      console.log('✅ Background sync completed');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncSales(): Promise<void> {
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
          console.log(`✅ Synced sale: ${sale.data.id || sale.id}`);
        } else {
          console.error(`❌ Failed to sync sale: ${sale.id}`);
        }
      } catch (error) {
        console.error(`❌ Error syncing sale ${sale.id}:`, error);
      }
    }

    await offlineStorage.setSyncStatus('sales', {
      lastSync: Date.now(),
      pending: (await offlineStorage.getPendingSales()).length
    });
  }

  private async syncInventory(): Promise<void> {
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
          console.log(`✅ Synced inventory update: ${inventory.data.id}`);
        } else {
          console.error(`❌ Failed to sync inventory: ${inventory.id}`);
        }
      } catch (error) {
        console.error(`❌ Error syncing inventory ${inventory.id}:`, error);
      }
    }

    await offlineStorage.setSyncStatus('inventory', {
      lastSync: Date.now(),
      pending: (await offlineStorage.getPendingInventory()).length
    });
  }

  private async syncActivities(): Promise<void> {
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
          console.log(`✅ Synced activity: ${activity.data.type}`);
        } else {
          console.error(`❌ Failed to sync activity: ${activity.id}`);
        }
      } catch (error) {
        console.error(`❌ Error syncing activity ${activity.id}:`, error);
      }
    }

    await offlineStorage.setSyncStatus('activities', {
      lastSync: Date.now(),
      pending: (await offlineStorage.getPendingActivities()).length
    });
  }

  async getPendingCount(): Promise<{ sales: number; inventory: number; activities: number }> {
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

  isConnectionOnline(): boolean {
    return this.isOnline;
  }
}

export const syncService = new SyncService();
