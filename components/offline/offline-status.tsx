"use client"

import { useOffline } from "@/contexts/offline-context"
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function OfflineStatus() {
  const { isOnline, pendingCount, forceSync, syncStatus } = useOffline()
  const totalPending = pendingCount.sales + pendingCount.inventory + pendingCount.activities

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 p-2 bg-background border rounded-lg">
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-xs font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isOnline ? 'Connected to server' : 'Working offline'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Pending Items */}
        {totalPending > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                {totalPending} pending
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Pending items:</p>
                <p className="text-xs">• {pendingCount.sales} sales</p>
                <p className="text-xs">• {pendingCount.inventory} inventory updates</p>
                <p className="text-xs">• {pendingCount.activities} activities</p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Sync Status */}
        {isOnline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-muted-foreground">
                  Last sync: {formatLastSync(syncStatus.sales?.lastSync || null)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Sync Status:</p>
                <p className="text-xs">• Sales: {formatLastSync(syncStatus.sales?.lastSync || null)}</p>
                <p className="text-xs">• Inventory: {formatLastSync(syncStatus.inventory?.lastSync || null)}</p>
                <p className="text-xs">• Activities: {formatLastSync(syncStatus.activities?.lastSync || null)}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Force Sync Button */}
        {isOnline && totalPending > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={forceSync}
                className="h-6 px-2 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync Now
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Force sync all pending data</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
