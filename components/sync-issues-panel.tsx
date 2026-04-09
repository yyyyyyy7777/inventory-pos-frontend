"use client";

import { useEffect, useMemo, useState } from "react";
import { enhancedSyncService } from "@/lib/enhanced-sync";
import { db } from "@/lib/indexeddb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, X } from "lucide-react";

type FailedSale = {
  id: string;
  date?: string;
  amount?: number;
  cabinet?: string;
  staffName?: string;
  syncFailureReason?: string | null;
  lastSyncAttempt?: number;
};

export function SyncIssuesPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [failedSales, setFailedSales] = useState<FailedSale[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const load = async () => {
      try {
        const rows = await db.sales
          .filter((s: any) => s?.syncFailed === true)
          .toArray();
        if (cancelled) return;
        setFailedSales(rows as any);
      } catch {
        // If IndexedDB isn’t available, don’t crash UI.
        if (!cancelled) setFailedSales([]);
      }
    };

    load();
    const interval = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open]);

  const count = failedSales.length;

  const sortedFailedSales = useMemo(() => {
    return [...failedSales].sort((a, b) => (b.lastSyncAttempt || 0) - (a.lastSyncAttempt || 0));
  }, [failedSales]);

  const handleRetryAll = async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      await enhancedSyncService.retryFailedSales();
      await enhancedSyncService.syncAll();
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    setLoading(true);
    try {
      await Promise.all(
        failedSales.map((sale) =>
          db.sales.update(sale.id, {
            syncFailed: false,
            syncFailureReason: null,
          } as any)
        )
      );
      setFailedSales([]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
      <Card className="border-orange-200 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              Sync Issues
              <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs">
                {count}
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleRetryAll}
              disabled={!isOnline || loading || count === 0}
              className="h-7"
            >
              <RefreshCw className={`h-3 w-3 mr-2 ${loading ? "animate-spin" : ""}`} />
              Retry all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAll}
              disabled={loading || count === 0}
              className="h-7"
            >
              Clear
            </Button>
            {!isOnline && (
              <span className="text-xs text-muted-foreground ml-auto">Offline</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {count === 0 ? (
            <div className="text-xs text-muted-foreground">No sync issues.</div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
              {sortedFailedSales.slice(0, 20).map((sale) => (
                <div key={sale.id} className="rounded-md border border-orange-100 p-2 bg-orange-50/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">Sale {sale.id}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {sale.cabinet ? `${sale.cabinet} • ` : ""}
                        {sale.staffName ? `${sale.staffName} • ` : ""}
                        {sale.amount != null ? `₱${Number(sale.amount).toLocaleString()}` : ""}
                      </div>
                    </div>
                  </div>
                  {sale.syncFailureReason && (
                    <div className="text-[11px] text-orange-800 mt-1 line-clamp-2">
                      {sale.syncFailureReason}
                    </div>
                  )}
                </div>
              ))}
              {count > 20 && (
                <div className="text-[11px] text-muted-foreground">
                  Showing 20 of {count}.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

