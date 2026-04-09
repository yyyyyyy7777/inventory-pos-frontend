"use client";

import { useEffect, useState } from "react";
import { enhancedSyncService } from "@/lib/enhanced-sync";
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SyncIssuesPanel } from "@/components/sync-issues-panel";
import { db } from "@/lib/indexeddb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SyncStatusIndicator() {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: { indexedDB: number; legacy: { sales: number; inventory: number; activities: number } };
    lastSync: { products?: number; sales?: number; employees?: number; activities?: number };
  }>({
    isOnline: true,
    isSyncing: false,
    pendingCount: { indexedDB: 0, legacy: { sales: 0, inventory: 0, activities: 0 } },
    lastSync: {},
  });

  useEffect(() => {
    // Listen for sync status changes
    const unsubscribe = enhancedSyncService.onSyncStatusChange((status, message) => {
      console.log(`Sync ${status}:`, message);
    });

    // Update status periodically
    const interval = setInterval(async () => {
      const status = await enhancedSyncService.getSyncStatus();
      setSyncStatus(status);

      // Failed sales count (not indexed; keep it lightweight)
      try {
        const failed = await db.sales.filter((s: any) => s?.syncFailed === true).count();
        setFailedCount(failed);
      } catch {
        setFailedCount(0);
      }
    }, 5000);

    // Initial status check
    enhancedSyncService.getSyncStatus().then(setSyncStatus);
    db.sales
      .filter((s: any) => s?.syncFailed === true)
      .count()
      .then(setFailedCount)
      .catch(() => setFailedCount(0));

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const formatLastSync = (timestamp?: number) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {syncStatus.isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-xs font-medium ${syncStatus.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {syncStatus.isOnline ? "Online" : "Offline"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{syncStatus.isOnline ? "Connected to server" : "Working offline - changes will sync when online"}</p>
          </TooltipContent>
        </Tooltip>

        {/* Sync Status */}
        {syncStatus.isSyncing && (
          <Badge variant="secondary" className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Syncing...
          </Badge>
        )}
        {!syncStatus.isSyncing &&
          syncStatus.isOnline &&
          (syncStatus.pendingCount.indexedDB +
            syncStatus.pendingCount.legacy.sales +
            syncStatus.pendingCount.legacy.inventory +
            syncStatus.pendingCount.legacy.activities) >
            0 && (
            <Badge
              role="button"
              tabIndex={0}
              onClick={() => enhancedSyncService.syncAll()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") enhancedSyncService.syncAll();
              }}
              variant="secondary"
              className="text-xs cursor-pointer"
              title="Sync now"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync now
            </Badge>
          )}

        {/* Pending Items */}
        {(syncStatus.pendingCount.indexedDB + syncStatus.pendingCount.legacy.sales + syncStatus.pendingCount.legacy.inventory + syncStatus.pendingCount.legacy.activities) > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                <AlertCircle className="h-3 w-3 mr-1" />
                {syncStatus.pendingCount.indexedDB + syncStatus.pendingCount.legacy.sales + syncStatus.pendingCount.legacy.inventory + syncStatus.pendingCount.legacy.activities} pending
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Pending sync items:</p>
                <p className="text-xs">IndexedDB: {syncStatus.pendingCount.indexedDB}</p>
                <p className="text-xs">Legacy Sales: {syncStatus.pendingCount.legacy.sales}</p>
                <p className="text-xs">Legacy Inventory: {syncStatus.pendingCount.legacy.inventory}</p>
                <p className="text-xs">Legacy Activities: {syncStatus.pendingCount.legacy.activities}</p>
                <p className="text-xs text-muted-foreground">Will sync automatically when online</p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Failed Items */}
        {failedCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                role="button"
                tabIndex={0}
                onClick={() => setIssuesOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setIssuesOpen(true);
                }}
                variant="outline"
                className="text-xs border-red-300 text-red-700 cursor-pointer"
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                {failedCount} failed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Some offline changes failed to sync. Click to review and retry.</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Last Sync Time */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3" />
              <span>
                Last sync: {formatLastSync(syncStatus.lastSync.products)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">Last Sync Times:</p>
              <p className="text-xs">Products: {formatLastSync(syncStatus.lastSync.products)}</p>
              <p className="text-xs">Sales: {formatLastSync(syncStatus.lastSync.sales)}</p>
              <p className="text-xs">Employees: {formatLastSync(syncStatus.lastSync.employees)}</p>
              <p className="text-xs">Activities: {formatLastSync(syncStatus.lastSync.activities)}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      <SyncIssuesPanel open={issuesOpen} onClose={() => setIssuesOpen(false)} />
    </TooltipProvider>
  );
}
