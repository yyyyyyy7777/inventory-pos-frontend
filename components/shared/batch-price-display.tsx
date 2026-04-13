import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentPriceFromBatches, clearPriceCache } from '@/lib/batch-price';

interface BatchPriceDisplayProps {
  productId: string;
  cabinet: string;
  className?: string;
  showBatchInfo?: boolean;
  metric?: 'price' | 'unitCost' | 'profit';
  onPriceChange?: (price: number) => void;
}

export const BatchPriceDisplay: React.FC<BatchPriceDisplayProps> = ({ 
  productId, 
  cabinet, 
  className = "", 
  showBatchInfo = false,
  metric = 'price',
  onPriceChange 
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [batchInfo, setBatchInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef<boolean>(true);
  const lastProductIdRef = useRef<string>("");
  const lastCabinetRef = useRef<string>("");
  const onPriceChangeRef = useRef(onPriceChange);

  // Update the ref when onPriceChange changes
  useEffect(() => {
    onPriceChangeRef.current = onPriceChange;
  }, [onPriceChange]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Listen for batch price update events
    const handleBatchPriceUpdate = (event: CustomEvent) => {
      const { productId: updatedProductId, cabinet: updatedCabinet } = event.detail;
      if (updatedProductId === productId && updatedCabinet === cabinet) {
        console.log(`BatchPriceDisplay: Received update event for product ${productId}, refreshing price`);
        // Clear the cached refs to force a refresh
        lastProductIdRef.current = "";
        lastCabinetRef.current = "";
        loadPrice(true); // Pass true to indicate this is an update
      }
    };

    const handleBatchPriceBulkUpdate = (event: CustomEvent) => {
      const { productIds } = event.detail;
      if (productIds.includes(productId)) {
        console.log(`BatchPriceDisplay: Received bulk update event for product ${productId}, refreshing price`);
        // Clear the cached refs to force a refresh
        lastProductIdRef.current = "";
        lastCabinetRef.current = "";
        loadPrice(true); // Pass true to indicate this is an update
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('batchPriceUpdate', handleBatchPriceUpdate as EventListener);
      window.addEventListener('batchPriceBulkUpdate', handleBatchPriceBulkUpdate as EventListener);
    }
    
    return () => {
      mountedRef.current = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('batchPriceUpdate', handleBatchPriceUpdate as EventListener);
        window.removeEventListener('batchPriceBulkUpdate', handleBatchPriceBulkUpdate as EventListener);
      }
    };
  }, [productId, cabinet]);

  const loadPrice = useCallback(async (isUpdate = false) => {
    // Only refetch if productId or cabinet actually changed
    if (!isUpdate && productId === lastProductIdRef.current && cabinet === lastCabinetRef.current) {
      return;
    }

    lastProductIdRef.current = productId;
    lastCabinetRef.current = cabinet;
    
    let isCancelled = false;
    
    try {
      if (isUpdate) {
        setUpdating(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const action = isUpdate ? "Updating" : "Loading";
      console.log(`BatchPriceDisplay: ${action} price for product ${productId} in cabinet ${cabinet}`);
      
      const result = await getCurrentPriceFromBatches(productId, cabinet);
      
      if (!isCancelled && mountedRef.current) {
        const oldVal = displayValue;
        const newVal = metric === 'unitCost' ? (result.unitCost ?? 0) : metric === 'profit' ? (result.price - (result.unitCost ?? 0)) : result.price;
        setDisplayValue(newVal);
        setBatchInfo(result.batchInfo || null);
        setLoading(false);
        setUpdating(false);
        
        // Notify parent component of price change using ref to avoid dependency issues
        if (onPriceChangeRef.current) {
          onPriceChangeRef.current(newVal);
        }
        
        // Log price changes for debugging
        if (isUpdate && oldVal !== newVal) {
          console.log(`BatchPriceDisplay: Value changed from ₱${oldVal} to ₱${newVal} for product ${productId}`);
        }
        
        console.log(`BatchPriceDisplay: ${action} complete - value ${newVal} for product ${productId}`);
      }
    } catch (err) {
      if (!isCancelled && mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load price');
      }
    } finally {
      if (!isCancelled && mountedRef.current) {
        if (isUpdate) {
          setUpdating(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [productId, cabinet]);

  useEffect(() => {
    loadPrice();
  }, [loadPrice]);

  // Manual refresh function
  const refreshPrice = () => {
    clearPriceCache(productId, cabinet);
    // Trigger re-fetch by updating refs
    lastProductIdRef.current = "";
    lastCabinetRef.current = "";
  };

  if (loading) {
    return (
      <span className={className}>
        <span className="opacity-60">Loading...</span>
      </span>
    );
  }

  if (updating) {
    return (
      <span className={className}>
        <span className="text-blue-500 animate-pulse">Updating...</span>
      </span>
    );
  }

  if (error) {
    return (
      <span className={className}>
        <span className="text-red-500">Error</span>
        {showBatchInfo && (
          <button 
            onClick={refreshPrice}
            className="ml-1 text-xs text-blue-500 hover:text-blue-700"
          >
            Retry
          </button>
        )}
      </span>
    );
  }

  if (displayValue === 0) {
    return (
      <span className={className}>
        <span className="opacity-75">
          {metric === 'profit' ? '-' : `No ${metric === 'unitCost' ? 'Cost' : 'Price'}`}
        </span>
        {showBatchInfo && (
          <button 
            onClick={refreshPrice}
            className="ml-1 text-xs text-blue-500 hover:text-blue-700"
          >
            Refresh
          </button>
        )}
      </span>
    );
  }

  return (
    <span className={`${className} ${updating ? 'animate-pulse' : ''}`}>
      ₱{displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {showBatchInfo && batchInfo && (
        <div className="text-xs text-gray-500 mt-1">
          Batch: {batchInfo.id} ({batchInfo.status})
          <br />
          Stock: {batchInfo.quantity} units
          <br />
          Added: {new Date(batchInfo.addedDate).toLocaleDateString()}
        </div>
      )}
    </span>
  );
};

export default BatchPriceDisplay;
