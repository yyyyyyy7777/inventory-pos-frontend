"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, Plus, Search, Package, Clock, Trash2, Edit2, Filter, X, Calendar, DollarSign, ArrowUpDown, Zap, Check, AlertTriangle, XCircle, Printer, Download, RefreshCw, Globe, FileText, BarChart3, Folder } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProducts, type Product, type ProductLocation } from "@/contexts/products-context"
import { useToast } from "@/contexts/toast-context"
import { useActivity } from "@/contexts/activity-context"
import { validateProductForm } from "@/utils/validation"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { BatchPriceDisplay } from "@/components/shared/batch-price-display"
import { getCurrentPriceFromBatches, clearPriceCacheOnBatchUpdate } from "@/lib/batch-price"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"

interface InventoryViewProps {
  isAdmin: boolean
  cabinet: string
  username?: string
}

type InventoryItem = Product;

const categories = [
  "APEX", "Bag", "Banpresto", "Blokees", "Boardgame", "Book", "Cardgame", "Cards",
  "Cosbaby", "Cosbi", "Crochet", "Die Cast", "Ecobag", "Figure", "Five Star", "Food and Snacks",
  "Funko Bitty", "Funko Dorbz", "Funko Keychain", "Funko Kinder Joy", "Funko Gold", "Funko Minis",
  "Funko Pins", "Funko POP", "Funko Rewind", "Funko Soda", "Funko Wocky Wobbler", "Harry Potter Items",
  "Hoodies", "Keychain", "McFarlane", "Mug", "Minis", "Nendoroid", "Others", "Pez", "Pins",
  "Pop Mart", "Profit", "Protectors", "QFig", "QPosket", "Quiccs", "Resins", "SHFiguarts",
  "Shirts", "Sleeves", "Sorcery Box", "Stickers", "Stuffed Toys", "Toploaders", "ZD Toys"
]

export function InventoryView({ isAdmin, cabinet, username }: InventoryViewProps) {
  const { getProductsByCabinet, addProduct, updateProduct, deleteProduct, loading, error, refetch } = useProducts()
  const { addToast } = useToast()
  const { addActivity } = useActivity()
  
  // FIFO batch rotation function - moves next batch from storage to on-shelf when current batch is depleted
  const rotateFIFOBatches = async (productId: string, cabinet: string): Promise<void> => {
    try {
      const { db } = await import('@/lib/indexeddb');
      
      // Get all batches for this product, sorted by added date (oldest first)
      const allBatches = await db.stockBatches
        .where({ productId: String(productId), cabinet: cabinet })
        .toArray();
      
      // Filter out deleted batches
      const deletedBatches = await db.deletedBatches
        .where({ productId: String(productId), cabinet: cabinet })
        .toArray();
      const deletedBatchIds = new Set(deletedBatches.map(db => db.batchId));
      
      const activeBatches = allBatches.filter(batch => !deletedBatchIds.has(String(batch.id)));
      
      // Find current on-shelf batch WITH STOCK (current batch)
      const onShelfBatch = activeBatches.find(batch => batch.status === 'on-shelf' && (Number(batch.quantity) || 0) > 0);
      
      // If no on-shelf batch or on-shelf batch is depleted, rotate to next batch
      if (!onShelfBatch || onShelfBatch.quantity <= 0) {
        // Find oldest batch in storage that has stock > 0
        const storageBatches = activeBatches.filter(batch =>
          batch.status === 'in-storage' && (Number(batch.quantity) || 0) > 0
        );
        const oldestStorageBatch = storageBatches.sort((a, b) => 
          new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime()
        )[0];
        
        if (oldestStorageBatch) {
          console.log(`Rotating FIFO: Moving batch ${oldestStorageBatch.id} from storage to on-shelf (stock: ${oldestStorageBatch.quantity})`);
          
          // Promote the oldest storage batch to on-shelf
          await db.stockBatches.update(oldestStorageBatch.id!, {
            status: 'on-shelf',
            lastModified: Date.now()
          });
          // Current batch changed → refresh price everywhere immediately
          clearPriceCacheOnBatchUpdate(productId, cabinet);
          
          
          console.log(`FIFO rotation completed: Batch ${oldestStorageBatch.id} is now on-shelf`);
        } else {
          console.log('No available batches with stock > 0 to rotate to on-shelf');
          
          // If there was a depleted on-shelf batch, mark it as sold
          if (onShelfBatch && (Number(onShelfBatch.quantity) || 0) <= 0) {
            await db.stockBatches.update(onShelfBatch.id!, {
              status: 'sold',
              lastModified: Date.now()
            });
            console.log(`Marked depleted batch ${onShelfBatch.id} as sold - no replacement available`);
            
            // Clear price cache since the current batch was depleted
            clearPriceCacheOnBatchUpdate(productId, cabinet);
          }
        }
      }
    } catch (error) {
      console.error('Error in FIFO batch rotation:', error);
    }
  };

  // Helper function to filter out deleted batches
  const getFilteredBatches = async (productId: string, cabinet: string) => {
    try {
      const { db } = await import('@/lib/indexeddb');
      
      // Get batches that were deleted offline for this product/cabinet
      const deletedBatches = await db.deletedBatches
        .where({ productId: String(productId), cabinet: cabinet })
        .toArray();
      const deletedBatchIds = new Set(deletedBatches.map(db => db.batchId));
      
      // Get all batches and filter out deleted ones
      const allBatches = await db.stockBatches
        .where({ productId: String(productId), cabinet: cabinet })
        .toArray();
      const filteredBatches = allBatches.filter(batch => !deletedBatchIds.has(String(batch.id)));
      
      // Proper FIFO sorting with 0-stock batch handling:
      // 1. Current batch is the oldest 'on-shelf' batch with stock > 0
      // 2. Batches with stock > 0 sorted by status and date
      // 3. Batches with stock = 0 moved to bottom
      const sortedBatches = filteredBatches.sort((a, b) => {
        // Find the oldest on-shelf batch - this should be the current batch
        const aDate = new Date(a.addedDate || 0).getTime();
        const bDate = new Date(b.addedDate || 0).getTime();
        
        // Priority 1: Separate by stock availability
        const aHasStock = a.quantity > 0;
        const bHasStock = b.quantity > 0;
        
        if (aHasStock && !bHasStock) {
          return -1; // A has stock, comes first
        }
        if (!aHasStock && bHasStock) {
          return 1; // B has stock, comes first
        }
        
        // Priority 2: If both have stock or both don't, sort by status
        if (a.status === 'on-shelf' && b.status === 'on-shelf') {
          return aDate - bDate; // Older on-shelf batch comes first (current)
        }
        
        // If only one is on-shelf, it comes first
        if (a.status === 'on-shelf' && b.status !== 'on-shelf') {
          return -1;
        }
        if (b.status === 'on-shelf' && a.status !== 'on-shelf') {
          return 1;
        }
        
        // For non-on-shelf batches, sort by addedDate (newest first for display)
        return bDate - aDate;
      });
      
      return sortedBatches;
    } catch (err) {
      console.error('Failed to get filtered batches:', err);
      return [];
    }
  }

  // Helper function to get latest restock date from batches
  const getLatestRestockDate = async (productId: string, cabinet: string): Promise<string | null> => {
    try {
      const { db } = await import('@/lib/indexeddb');
      
      // Get batches that were deleted offline for this product/cabinet
      const deletedBatches = await db.deletedBatches
        .where({ productId: String(productId), cabinet: cabinet })
        .toArray();
      const deletedBatchIds = new Set(deletedBatches.map(db => db.batchId));
      
      // Get all batches and filter out deleted ones
      const allBatches = await db.stockBatches
        .where({ productId: String(productId), cabinet: cabinet })
        .toArray();
      const filteredBatches = allBatches.filter(batch => !deletedBatchIds.has(String(batch.id)));
      
      if (filteredBatches.length === 0) {
        return null;
      }
      
      // Find the most recent batch by addedDate
      const latestBatch = filteredBatches.reduce((latest, batch) => {
        const batchDate = new Date(batch.addedDate || 0).getTime();
        const latestDate = new Date(latest.addedDate || 0).getTime();
        return batchDate > latestDate ? batch : latest;
      });
      
      return latestBatch.addedDate || null;
    } catch (err) {
      console.error('Failed to get latest restock date:', err);
      return null;
    }
  }
  const products = getProductsByCabinet(cabinet)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showStockDialog, setShowStockDialog] = useState(false)
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null)
  const [stockAdditions, setStockAdditions] = useState<any[]>([])
  const [newStock, setNewStock] = useState({
    quantity: 1,
    costPerUnit: 0,
    notes: "",
    addedDate: new Date().toISOString()
  })
  const [showRestockConfirm, setShowRestockConfirm] = useState(false)
  const [showDeleteBatchConfirm, setShowDeleteBatchConfirm] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState<any>(null)
  const [showProductNameConfirm, setShowProductNameConfirm] = useState(false)
  const [confirmProductName, setConfirmProductName] = useState('')
  
  // Loading states for operations
  const [isAddingStock, setIsAddingStock] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null)
  const [isLoadingStock, setIsLoadingStock] = useState(false)
  // Advanced filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [priceRangeFilter, setPriceRangeFilter] = useState({ min: "", max: "" })
  const [dateFilter, setDateFilter] = useState({ 
    year: "all", 
    month: "all", 
    day: "all",
    startDate: "", 
    endDate: "" 
  })
  const [tempDateFilter, setTempDateFilter] = useState({ 
    startDate: "", 
    endDate: "" 
  })
    const [sortBy, setSortBy] = useState("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [timePeriod, setTimePeriod] = useState("all")
  
  // Handle date filter confirmation with validation
  const applyDateFilter = () => {
    // Validate date inputs
    if (tempDateFilter.startDate && tempDateFilter.endDate) {
      const start = new Date(tempDateFilter.startDate);
      const end = new Date(tempDateFilter.endDate);
      
      if (start > end) {
        addToast("Start date cannot be after end date", "error");
        return;
      }
      
      // Check if date range is too large (more than 1 year)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        addToast("Date range cannot exceed 1 year", "error");
        return;
      }
    }
    
    setDateFilter(prev => ({ 
      ...prev, 
      startDate: tempDateFilter.startDate,
      endDate: tempDateFilter.endDate,
      year: "all",
      month: "all", 
      day: "all"
    }))
    
    if (tempDateFilter.startDate || tempDateFilter.endDate) {
      const message = tempDateFilter.startDate && tempDateFilter.endDate 
        ? `Date filter applied: ${tempDateFilter.startDate} to ${tempDateFilter.endDate}`
        : tempDateFilter.startDate 
        ? `Date filter applied: From ${tempDateFilter.startDate}`
        : `Date filter applied: Until ${tempDateFilter.endDate}`;
      addToast(message, "success");
    }
  }

  // Confirmation dialog for clearing filters
  const [clearConfirm, setClearConfirm] = useState(false);
  
  const handleClearFilters = () => {
    // Check if any filters are actually applied
    const hasFilters = selectedCategory !== "all" || 
                      stockFilter !== "all" || 
                      (dateFilter.startDate || dateFilter.endDate) || 
                      dateFilter.year !== "all" || 
                      searchQuery !== "";
    
    if (!hasFilters) {
      addToast("No filters to clear", "info");
      return;
    }
    
    setClearConfirm(true);
  }

  const confirmClearFilters = () => {
    setSelectedCategory("all")
    setStockFilter("all")
    setPriceRangeFilter({ min: "", max: "" })
    setDateFilter({ 
      year: "all", 
      month: "all", 
      day: "all",
      startDate: "", 
      endDate: "" 
    })
    setTempDateFilter({ 
      startDate: "", 
      endDate: "" 
    })
    setSortBy("name")
    setSortDirection("asc")
    setSearchQuery("")
    setClearConfirm(false)
    addToast("All filters cleared", "success")
  }

  // Track if filters have been applied and results are empty
  const [filtersApplied, setFiltersApplied] = useState(false)
  
  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    quantity: 1,
    price: 0,
    location: "physical" as const,
    category: "",
    stock: 0,
    description: "",
  })
  const [initialStock, setInitialStock] = useState({
    quantity: 1,
    costPerUnit: 0,
  })
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })

  // Suppress hydration mismatch warnings caused by browser extensions
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorMessage = args[0]?.toString() || '';
      
      // Suppress various hydration errors
      if (errorMessage.includes('Expected \'>\', got \'div\'')) {
        return;
      }
      if (errorMessage.includes('fdprocessedid')) {
        return;
      }
      if (errorMessage.includes('hydration mismatch')) {
        return;
      }
      if (errorMessage.includes('server rendered HTML didn\'t match')) {
        return;
      }
      if (errorMessage.includes('A tree hydrated but some attributes')) {
        return;
      }
      
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // Print inventory list
  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Inventory List - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .low-stock { color: #dc2626; font-weight: bold; }
            .zero-stock { color: #dc2626; font-weight: bold; background-color: #fef2f2; }
            .header-info { margin-bottom: 20px; color: #666; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Inventory List</h1>
          <div class="header-info">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Cabinet:</strong> ${cabinet}</p>
            <p><strong>Total Products:</strong> ${filteredInventory.length}</p>
            <p><strong>Filters Applied:</strong> ${[
              selectedCategory !== "all" ? `Category: ${selectedCategory}` : null,
              stockFilter !== "all" ? `Stock: ${stockFilter}` : null,
              null, // Price filter disabled for batch-based pricing
              searchQuery ? `Search: ${searchQuery}` : null
            ].filter(Boolean).join(', ') || 'None'}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Last Restock</th>
              </tr>
            </thead>
            <tbody>
              ${filteredInventory.map(item => `
                <tr>
                  <td>${item.sku}</td>
                  <td>${item.name}</td>
                  <td>${item.description || '-'}</td>
                  <td>${item.category}</td>
                  <td class="${item.stock === 0 ? 'zero-stock' : item.stock < 20 ? 'low-stock' : ''}">${item.stock}</td>
                  <td>${item.lastRestockDate || 'No restocks'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Show message before triggering print dialog
      addToast("Opening print dialog...", "info");
      
      // Trigger print dialog immediately
      printWindow.print();
      
      // Handle print completion or cancellation
      let printHandled = false;
      
      printWindow.onafterprint = () => {
        printHandled = true;
        printWindow.close();
        addToast("Inventory report printed successfully!", "success");
      };
      
      // Close window if user cancels or closes without printing
      setTimeout(() => {
        if (!printWindow.closed && !printHandled) {
          printWindow.close();
          addToast("Print cancelled", "info");
        }
      }, 2000);
      
      // Fallback cleanup
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.close();
        }
      }, 10000);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const headers = ['SKU', 'Product Name', 'Description', 'Category', 'Stock', 'Last Restock'];
    const data = filteredInventory.map(item => [
      item.sku,
      item.name,
      item.description || '',
      item.category,
      item.stock.toString(),
      item.lastRestockDate || 'No restocks'
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${cabinet}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addToast(`Exported ${filteredInventory.length} items to Excel`, "success");
  };

  const filteredInventory = products.filter(item => {
    // Search filter
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Category filter
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    
    // Stock filter
    const matchesStock = stockFilter === "all" ||
                         (stockFilter === "low" && item.stock > 0 && item.stock < 20) ||
                         (stockFilter === "out" && item.stock === 0);
    
    // Price filter based on current batch price (simplified for now)
    // Note: For optimal performance, this could be enhanced with caching or memoization
    let matchesPrice = true;
    if (priceRangeFilter.min || priceRangeFilter.max) {
      // Use a simple price estimate for filtering - this will be refined
      // For now, we'll use the product's base price as a rough estimate
      const estimatedPrice = item.price || 0;
      
      if (priceRangeFilter.min && estimatedPrice < parseFloat(priceRangeFilter.min)) {
        matchesPrice = false;
      }
      if (priceRangeFilter.max && estimatedPrice > parseFloat(priceRangeFilter.max)) {
        matchesPrice = false;
      }
    }
    
    // Date filter
    let matchesDate = true;
    if (dateFilter.startDate || dateFilter.endDate) {
      // Use lastRestockDate if available, otherwise lastUpdated
      const dateSource = item.lastRestockDate || item.lastUpdated;
      const itemDate = new Date(dateSource);
      const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
      const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
      
      // Normalize dates to midnight for comparison
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);
      itemDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      
      // Debug logging for today filter
      if (dateFilter.startDate && dateFilter.endDate && dateFilter.startDate === dateFilter.endDate) {
        console.log(`Today filter check for ${item.name}:`, {
          dateSource,
          itemDate: itemDate.toISOString(),
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          matchesDate: startDate && endDate ? itemDate >= startDate && itemDate <= endDate : false
        });
      }
      
      if (startDate && endDate) {
        matchesDate = itemDate >= startDate && itemDate <= endDate;
      } else if (startDate) {
        matchesDate = itemDate >= startDate;
      } else if (endDate) {
        // When only endDate is set (like "Today" button), show items up to that date
        matchesDate = itemDate <= endDate;
      }
    } else if (dateFilter.year !== "all") {
        // Use lastRestockDate if available, otherwise lastUpdated
        const dateSource = item.lastRestockDate || item.lastUpdated;
        const itemDate = new Date(dateSource);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth() + 1; // JS months are 0-indexed
        const itemDay = itemDate.getDate();
        
        matchesDate = itemYear === parseInt(dateFilter.year);
        
        if (matchesDate && dateFilter.month !== "all") {
          matchesDate = itemMonth === parseInt(dateFilter.month);
        }
        
        if (matchesDate && dateFilter.day !== "all") {
          matchesDate = itemDay === parseInt(dateFilter.day);
        }
      }
      
      return matchesSearch && matchesCategory && matchesStock && matchesPrice && matchesDate;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name": comparison = a.name.localeCompare(b.name); break;
        case "stock": comparison = b.stock - a.stock; break;
        case "price": comparison = a.price - b.price; break;
        case "category": comparison = a.category.localeCompare(b.category); break;
        case "lastRestock":
          const aDate = new Date(a.lastRestockDate || "1970-01-01");
          const bDate = new Date(b.lastRestockDate || "1970-01-01");
          comparison = bDate.getTime() - aDate.getTime();
          break;
        default: return 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Check if filters are applied and show toast if results are empty
  const hasActiveFilters = selectedCategory !== "all" || 
                          stockFilter !== "all" || 
                          (dateFilter.startDate || dateFilter.endDate) || 
                          dateFilter.year !== "all" || 
                          searchQuery !== "";
  
  React.useEffect(() => {
    if (hasActiveFilters && filteredInventory.length === 0 && !filtersApplied) {
      addToast("No items found matching your filter criteria", "warning");
      setFiltersApplied(true);
    } else if (!hasActiveFilters || filteredInventory.length > 0) {
      setFiltersApplied(false);
    }
  }, [filteredInventory.length, hasActiveFilters, filtersApplied, addToast]);

  const handleDelete = (id: string) => {
    const productToDelete = products.find(p => p.id === id)
    if (productToDelete) {
      setDeleteConfirm({ open: true, id })
      setConfirmProductName('')
    }
  }

  // Open stock dialog and fetch fresh data
  const openStockDialog = async (product: Product) => {
    try {
      setIsLoadingStock(true)
      setSelectedProductForStock(product)
      
      // Check if offline
      const isOnline = navigator.onLine;
      
      if (!isOnline) {
        // Load from IndexedDB when offline, excluding deleted batches
        const filteredBatches = await getFilteredBatches(String(product.id), cabinet);
        console.log('Stock batches loaded from IndexedDB (filtered):', filteredBatches);
        setStockAdditions(filteredBatches);
      } else {
        // Fetch from server when online
        const response = await fetch(`/api/stock-batches?productId=${product.id}&cabinet=${cabinet}`)
        if (response.ok) {
          const additions = await response.json()
          console.log('Fresh stock data loaded:', additions.map((a: any) => ({id: a.id, quantity: a.quantity})));
          setStockAdditions(additions)
          
          // Sync server data to IndexedDB for offline consistency
          try {
            const { db } = await import('@/lib/indexeddb');
            
            // Get batches that were deleted offline for this product/cabinet
            const deletedBatches = await db.deletedBatches
              .where({ productId: String(product.id), cabinet: cabinet })
              .toArray();
            const deletedBatchIds = new Set(deletedBatches.map(db => db.batchId));
            
            // Clear existing batches for this product/cabinet in IndexedDB
            await db.stockBatches
              .where({ productId: String(product.id), cabinet: cabinet })
              .delete();
            
            // Add fresh server data to IndexedDB, excluding deleted batches
            if (additions.length > 0) {
              const filteredAdditions = additions.filter((batch: any) => !deletedBatchIds.has(String(batch.id)));
              const indexedDBBatches = filteredAdditions.map((batch: any) => ({
                ...batch,
                productId: String(batch.productId),
                synced: true,
                lastModified: Date.now()
              }));
              await db.stockBatches.bulkAdd(indexedDBBatches);
            }
            
            console.log('Synced server batch data to IndexedDB, excluding offline deletions');
          } catch (dbError) {
            console.error('Failed to sync batch data to IndexedDB:', dbError);
          }
        } else {
          // If no batches exist, set empty array
          setStockAdditions([])
        }
      }
      setShowStockDialog(true)
    } catch (error: any) {
      console.error('Stock view error:', error)
      addToast("Failed to load stock information", "error")
    } finally {
      setIsLoadingStock(false)
    }
  }

  // Delete stock batch function
  const handleDeleteBatch = async (batchId: string) => {
    if (!batchId || !selectedProductForStock) {
      return
    }

    // Check if we're offline
    const isOnline = navigator.onLine;

    // Optimistic UI: remove immediately and show "deleting" state.
    const previousBatches = stockAdditions;
    const previousSelected = selectedProductForStock;
    const deletedBatchSnapshot = stockAdditions.find((b) => String(b.id) === String(batchId));

    setIsDeletingBatch(true)
    setStockAdditions(prev => prev.filter(batch => String(batch.id) !== String(batchId)));

    if (deletedBatchSnapshot) {
      const remainingBatches = stockAdditions.filter(b => String(b.id) !== String(batchId));
      const updatedStock = remainingBatches.reduce((total, batch) => total + (Number(batch.quantity) || 0), 0);
      setSelectedProductForStock({
        ...selectedProductForStock,
        stock: updatedStock
      });
    }
    
    try {
      if (isOnline) {
        // Online mode - Delete via API
        const response = await fetch(`/api/stock-batches/${batchId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to delete batch')
        }
        
        // Also remove from IndexedDB to maintain consistency
        try {
          const { db } = await import('@/lib/indexeddb');
          await db.stockBatches.delete(String(batchId));
          await db.stockBatches.delete(parseInt(batchId)); // Try both ID types
        } catch (err) {
          console.log('Could not remove from IndexedDB:', err);
        }
      } else {
        // Offline mode - Delete from IndexedDB only, no sync
        const { db } = await import('@/lib/indexeddb');
        
        // Try to delete the batch - handle both string and integer IDs
        let deleteSuccess = false;
        let deletedBatch = null;
        
        try {
          // Try with original batchId first (for string IDs from online batches)
          deletedBatch = await db.stockBatches.get(batchId);
          if (deletedBatch) {
            await db.stockBatches.delete(batchId);
            deleteSuccess = true;
          }
        } catch (error) {
          // Continue to try integer ID
        }
        
        if (!deleteSuccess) {
          try {
            // Try with parseInt for integer IDs (for offline batches)
            deletedBatch = await db.stockBatches.get(parseInt(batchId));
            if (deletedBatch) {
              await db.stockBatches.delete(parseInt(batchId));
              deleteSuccess = true;
            }
          } catch (intError) {
            throw new Error('Failed to delete batch from local storage');
          }
        }
        
        if (deleteSuccess) {
          // Track this deletion to prevent server sync from restoring it
          await db.deletedBatches.add({
            batchId: batchId,
            productId: String(selectedProductForStock.id),
            cabinet: selectedProductForStock.cabinet,
            deletedAt: Date.now()
          });

          // Queue deletion for server sync once connection is restored.
          const { enhancedSyncService } = await import('@/lib/enhanced-sync');
          await enhancedSyncService.queueChange(
            'stock_batch_delete',
            'delete',
            {
              batchId: String(batchId),
              productId: String(selectedProductForStock.id),
              cabinet: selectedProductForStock.cabinet,
            },
            selectedProductForStock.cabinet
          );
          
          addToast(`Batch deleted`, "success");
        } else {
          throw new Error('Batch not found');
        }
      }

      if (deletedBatchSnapshot && selectedProductForStock) {
        // Calculate new stock based on remaining batches (more accurate)
        const remainingBatches = stockAdditions.filter(batch => String(batch.id) !== String(batchId))
        const updatedStock = remainingBatches.reduce((total, batch) => total + (Number(batch.quantity) || 0), 0)
        
        // Update product in IndexedDB and context
        try {
          await updateProduct(String(selectedProductForStock.id), {
            stock: updatedStock
          }, cabinet);
          
          // Don't refresh from IndexedDB - we already updated the state by filtering
          // This prevents the deleted batch from reappearing
          console.log('Batch deletion completed - state already updated');
          
          // Refresh products list to show updated stock count in inventory
          await refetch();
          
          // Run FIFO rotation to ensure proper batch management
          await rotateFIFOBatches(String(selectedProductForStock.id), cabinet);
          
          // Clear price cache to trigger immediate price update across all components
          clearPriceCacheOnBatchUpdate(String(selectedProductForStock.id), cabinet);
        } catch (err) {
          console.error('Failed to update product stock:', err);
          // If update fails, revert optimistic UI
          setStockAdditions(previousBatches);
          setSelectedProductForStock(previousSelected);
        }
        
        addToast(`Removed batch of ${deletedBatchSnapshot.quantity} units from ${selectedProductForStock.name}`, "success")
        
        addActivity({
          username: username || "Unknown User",
          activity: "Removed stock batch",
          details: `Removed batch of ${deletedBatchSnapshot.quantity} units from '${selectedProductForStock.name}' (SKU: ${selectedProductForStock.sku || 'N/A'}) in ${cabinet} cabinet - New stock: ${updatedStock} units`,
          category: "product"
        })
      }

      // Refresh the products data to get updated stock
      refetch()
      
    } catch (error) {
      console.error('Error deleting batch:', error)
      addToast(error instanceof Error ? error.message : 'Failed to delete batch', 'error')
      // Revert optimistic UI on failure
      setStockAdditions(previousBatches);
      setSelectedProductForStock(previousSelected);
    } finally {
      setIsDeletingBatch(false)
      setShowDeleteBatchConfirm(false)
      setBatchToDelete(null)
    }
  }

  // Update batch status function
  const handleUpdateBatchStatus = async (batchId: string, newStatus: 'on-shelf' | 'in-storage') => {
    try {
      setIsUpdatingStatus(batchId)
      
      // Check if we're offline
      const isOnline = navigator.onLine;
      
      if (!isOnline) {
        // Offline mode - update locally in IndexedDB
        const { db } = await import('@/lib/indexeddb');
        await db.stockBatches.update(batchId, { 
          status: newStatus,
          lastModified: Date.now()
        });

        const { enhancedSyncService } = await import('@/lib/enhanced-sync');
        await enhancedSyncService.queueChange(
          'stock_batch_status_update',
          'update',
          { batchId: String(batchId), status: newStatus, cabinet },
          cabinet
        );
        
        // Update local state
        setStockAdditions(prev => 
          prev.map(batch => 
            batch.id === batchId ? { ...batch, status: newStatus } : batch
          )
        );
        
        addToast(`Batch status updated to ${newStatus} (offline)`, "success");
        return;
      }
      
      const response = await fetch(`/api/stock-batches/${batchId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update batch status')
      }

      // Update local state to reflect the change
      setStockAdditions(prev => 
        prev.map(batch => 
          batch.id === batchId ? { ...batch, status: newStatus } : batch
        )
      )

      addToast(`Batch status updated to ${newStatus}`, "success")
      
    } catch (error) {
      console.error('Error updating batch status:', error)
      
      // If fetch fails, try offline fallback
      if (error instanceof Error && error.message.includes('fetch')) {
        try {
          const { db } = await import('@/lib/indexeddb');
          await db.stockBatches.update(batchId, { 
            status: newStatus,
            lastModified: Date.now()
          });

          const { enhancedSyncService } = await import('@/lib/enhanced-sync');
          await enhancedSyncService.queueChange(
            'stock_batch_status_update',
            'update',
            { batchId: String(batchId), status: newStatus, cabinet },
            cabinet
          );
          
          // Update local state
          setStockAdditions(prev => 
            prev.map(batch => 
              batch.id === batchId ? { ...batch, status: newStatus } : batch
            )
          );
          
          addToast(`Batch status updated to ${newStatus} (offline mode)`, "success");
        } catch (offlineError) {
          addToast(error instanceof Error ? error.message : 'Failed to update batch status', 'error')
        }
      } else {
        addToast(error instanceof Error ? error.message : 'Failed to update batch status', 'error')
      }
    } finally {
      setIsUpdatingStatus(null)
    }
  }

  const handleAddStock = async () => {
    if (!selectedProductForStock) return

    // Validate cost per unit
    if (!newStock.costPerUnit || newStock.costPerUnit <= 0) {
      addToast("Cost per unit is required and must be greater than 0", "error");
      return;
    }

    // Check if we're offline
    const isOnline = navigator.onLine;
    
    // Check if product ID is a temporary offline ID (starts with temp- or prod_)
    const isTempId = String(selectedProductForStock.id).startsWith('temp-') || 
                     String(selectedProductForStock.id).startsWith('prod_');
    
    if (!isOnline || isTempId) {
      // Offline mode or temporary product - update locally in IndexedDB
      try {
        setIsAddingStock(true);
        
        // Update product stock locally
        const updatedProduct = {
          ...selectedProductForStock,
          stock: (parseInt(String(selectedProductForStock.stock || '0')) + newStock.quantity),
          lastModified: Date.now(),
          synced: false
        };
        
        // Update in IndexedDB
        const { db } = await import('@/lib/indexeddb');
        await db.products.update(String(selectedProductForStock.id), updatedProduct);
        
        // Update product using the context to ensure state consistency
        await updateProduct(String(selectedProductForStock.id), {
          stock: updatedProduct.stock,
          lastRestockDate: newStock.addedDate || new Date().toISOString()
        }, cabinet);
        
        // Also save the stock batch for offline history
        
        // Check existing batches to implement FIFO properly
        const existingBatches = await db.stockBatches
          .where({ productId: String(selectedProductForStock.id), cabinet: selectedProductForStock.cabinet })
          .toArray();
        
        // FIFO Logic: if there is NO on-shelf stock available, the new batch becomes the current on-shelf batch.
        // This prevents the “only batch with stock” from ending up in storage.
        const hasOnShelfStock = existingBatches.some(
          (b: any) => String(b.status).trim() === 'on-shelf' && (Number(b.quantity) || 0) > 0
        );
        // Rule: if there is a current on-shelf batch with stock, ALL new restocks go to storage.
        // Only if there is NO on-shelf stock at all do we put the new batch on-shelf.
        const batchStatus = hasOnShelfStock ? 'in-storage' : 'on-shelf';
        
        await db.stockBatches.add({
          productId: String(selectedProductForStock.id),
          quantity: newStock.quantity,
          costPerUnit: newStock.costPerUnit,
          cabinet: selectedProductForStock.cabinet,
          addedDate: newStock.addedDate || new Date().toISOString(),
          notes: newStock.notes || 'Offline stock addition',
          status: batchStatus,
          synced: false,
          lastModified: Date.now()
        });
        clearPriceCacheOnBatchUpdate(String(selectedProductForStock.id), selectedProductForStock.cabinet);
        
        // Queue the stock addition for later sync
        const { enhancedSyncService } = await import('@/lib/enhanced-sync');
        await enhancedSyncService.queueChange('product', 'update', {
          productId: selectedProductForStock.id,
          quantity: newStock.quantity,
          costPerUnit: newStock.costPerUnit,
          cabinet: selectedProductForStock.cabinet
        }, selectedProductForStock.cabinet);
        
        addToast(`Added ${newStock.quantity} units to ${selectedProductForStock.name} (offline mode - will sync when online)`, "success");
        
        addActivity({
          username: username || "Unknown User",
          activity: "Added stock to product",
          details: `Added ${newStock.quantity} units to '${selectedProductForStock.name}' (offline mode)`,
          category: "product"
        });
        
        // Reset form
        setNewStock({ quantity: 1, costPerUnit: 0, notes: "", addedDate: new Date().toISOString() });
        
        // Update selected product state
        setSelectedProductForStock(updatedProduct);
        
        // Refresh products list
        await refetch();
        
        // Refresh stock additions from IndexedDB
        const filteredBatches = await getFilteredBatches(String(selectedProductForStock.id), selectedProductForStock.cabinet);
        setStockAdditions(filteredBatches);
        
        // Run FIFO rotation to ensure proper batch management
        await rotateFIFOBatches(String(selectedProductForStock.id), selectedProductForStock.cabinet);
        clearPriceCacheOnBatchUpdate(String(selectedProductForStock.id), selectedProductForStock.cabinet);
        
      } catch (error: any) {
        console.error('Add stock error (offline):', error);
        addToast(error.message || "Failed to add stock", "error");
      } finally {
        setIsAddingStock(false);
      }
      return;
    }

    // Online mode with real product ID - use API
    try {
      setIsAddingStock(true)
      
      const response = await fetch('/api/stock-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductForStock.id,
          quantity: newStock.quantity,
          costPerUnit: newStock.costPerUnit || null,
          cabinet: selectedProductForStock.cabinet,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.details || errorData.error || 'Failed to add stock'
        throw new Error(errorMessage)
      }

        // Also save to IndexedDB for offline history
      try {
        const { db } = await import('@/lib/indexeddb');
        
        // Check existing batches to implement FIFO properly
        const existingBatches = await db.stockBatches
          .where({ productId: String(selectedProductForStock.id), cabinet: selectedProductForStock.cabinet })
          .toArray();
        
        // FIFO Logic: if there is NO on-shelf stock available, the new batch becomes the current on-shelf batch.
        const hasOnShelfStock = existingBatches.some(
          (b: any) => String(b.status).trim() === 'on-shelf' && (Number(b.quantity) || 0) > 0
        );
        const batchStatus = hasOnShelfStock ? 'in-storage' : 'on-shelf';
        
        await db.stockBatches.add({
          productId: String(selectedProductForStock.id),
          quantity: newStock.quantity,
          costPerUnit: newStock.costPerUnit,
          cabinet: selectedProductForStock.cabinet,
          addedDate: newStock.addedDate || new Date().toISOString(),
          notes: newStock.notes || 'Stock addition',
          status: batchStatus,
          synced: true,
          lastModified: Date.now()
        });
        clearPriceCacheOnBatchUpdate(String(selectedProductForStock.id), selectedProductForStock.cabinet);
      } catch (dbError) {
        console.error('Failed to save batch to IndexedDB:', dbError);
      }

      // Stock is already updated in the database by the API, no need to updateProduct here
      // The products context will automatically refresh the data
      
      addToast(`Added ${newStock.quantity} units to ${selectedProductForStock.name}`, "success")
      
      addActivity({
        username: username || "Unknown User",
        activity: "Added stock to product",
        details: `Added ${newStock.quantity} units to '${selectedProductForStock.name}' (SKU: ${selectedProductForStock.sku || 'N/A'}) in ${cabinet} cabinet - New stock: ${(parseInt(String(selectedProductForStock?.stock || '0')) + newStock.quantity)} units`,
        category: "product"
      })
      
      // Reset form and refresh
      setNewStock({ quantity: 1, costPerUnit: 0, notes: "", addedDate: new Date().toISOString() })
      
      // Update selected product state with new stock (single increment)
      setSelectedProductForStock({
        ...selectedProductForStock,
        stock: parseInt(String(selectedProductForStock.stock || '0')) + newStock.quantity
      })
      
      // Refresh stock additions from IndexedDB (which has the notes)
      try {
        const freshBatches = await getFilteredBatches(String(selectedProductForStock.id), cabinet);
        setStockAdditions(freshBatches);
        console.log('Fresh stock data loaded from IndexedDB:', freshBatches);
      } catch (error) {
        console.error('Failed to refresh stock additions:', error);
      }
      
      // Force refresh the products list to get updated stock calculations
      await refetch()
      clearPriceCacheOnBatchUpdate(String(selectedProductForStock.id), selectedProductForStock.cabinet);
    } catch (error: any) {
      console.error('Add stock error:', error)
      addToast(error.message || "Failed to add stock", "error")
    } finally {
      setIsAddingStock(false)
    }
  }

  const getStockAge = (createdAt: string): number => {
    const now = new Date()
    const created = new Date(createdAt)
    const diffTime = Math.abs(now.getTime() - created.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) // days
  }

  const getStockAgeColor = (createdAt: string): string => {
    const age = getStockAge(createdAt)
    if (age > 90) return "text-red-600 bg-red-50" // Old stock
    if (age > 30) return "text-yellow-600 bg-yellow-50" // Medium age
    return "text-green-600 bg-green-50" // New stock
  }

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      const productToDelete = products.find(p => p.id === deleteConfirm.id)
      
      // Verify the typed product name matches exactly
      if (confirmProductName !== productToDelete?.name) {
        addToast("Product name does not match. Please type the exact product name to confirm deletion.", "error")
        return
      }
      
      try {
        await deleteProduct(deleteConfirm.id, cabinet)
        
        addActivity({
          username: username || "Unknown User",
          activity: "Deleted product",
          details: `Removed '${productToDelete?.name}' (SKU: ${productToDelete?.sku || 'N/A'}) from ${cabinet} cabinet - Category: ${productToDelete?.category || 'N/A'}`,
          category: "product"
        })
        
        addToast("Product deleted successfully!", "success")
        setDeleteConfirm({ open: false, id: null })
        setConfirmProductName('')
        
        // Clear any active filters that might be hiding the product list
        handleClearFilters()
        
        // Force refresh to ensure UI updates
        await refetch()
      } catch (error) {
        console.error('Delete product error:', error)
        addToast("Failed to delete product", "error")
      }
    }
  }

  const handleAddProduct = async () => {
    console.log('Submitting product:', newProduct);
    console.log('Initial stock:', initialStock);
    
    // Check if offline first
    const isOnline = navigator.onLine;
    console.log('Online status:', isOnline);
    
    // Validate form - now require price and quantity since we're creating initial batch
    const validation = validateProductForm({
      name: newProduct.name,
      price: newProduct.price,
      quantity: initialStock.quantity,
      category: newProduct.category
    }, false, true) // Don't require quantity for product but require price
    
    console.log('Validation result:', validation);
    
    if (!validation.isValid) {
      addToast(validation.errors[0].message, "error")
      return
    }

    try {
      // First create the product
      const productData = {
        name: newProduct.name,
        sku: newProduct.sku,
        quantity: initialStock.quantity, // Set initial quantity
        price: newProduct.price, // Set selling price
        category: newProduct.category,
        stock: initialStock.quantity, // Set initial stock
        location: newProduct.location,
        lastUpdated: new Date().toLocaleDateString('en-CA'),
        cabinet: cabinet,
        description: newProduct.description,
      };
      
      console.log('Product data being sent:', productData);
      console.log('Stock value:', productData.stock, 'Type:', typeof productData.stock);
      console.log('All required fields check:');
      console.log('- name:', productData.name, 'empty?', !productData.name);
      console.log('- price:', productData.price, 'empty?', !productData.price);
      console.log('- stock:', productData.stock, 'empty?', !productData.stock);
      console.log('- category:', productData.category, 'empty?', !productData.category);
      console.log('- cabinet:', productData.cabinet, 'empty?', !productData.cabinet);
      
      const createdProduct = await addProduct(productData, cabinet)
      
      // Check if product was created successfully
      if (!createdProduct) {
        // Product creation failed - show generic error message
        addToast("Product creation failed. Please try again.", "error")
        return; // Exit early - error is already handled
      }
      
      // Check if it's a SKU conflict error
      if (createdProduct && typeof createdProduct === 'object' && 'error' in createdProduct && createdProduct.isSkuConflict) {
        addToast(createdProduct.error, "error")
        return; // Exit early - SKU conflict
      }
      
      // At this point, TypeScript knows createdProduct is a Product (not an error object)
      const product = createdProduct as Product

      // Only create stock batch if product was created successfully
      try {
        // Check if offline
        const isOnline = navigator.onLine;
        
        if (!isOnline) {
          // Create stock batch locally when offline
          try {
            const { db } = await import('@/lib/indexeddb');
            await db.stockBatches.add({
              productId: String(product.id),
              quantity: initialStock.quantity,
              costPerUnit: newProduct.price,
              cabinet: cabinet,
              addedDate: new Date().toISOString(),
              notes: 'Initial stock',
              status: 'on-shelf', // CRITICAL: Set status to 'on-shelf' for initial stock
              synced: false,
              lastModified: Date.now()
            });
            console.log('Initial stock batch created offline with on-shelf status');
            clearPriceCacheOnBatchUpdate(String(product.id), cabinet);
          } catch (dbError) {
            console.error('Failed to save initial batch to IndexedDB:', dbError);
          }
        } else {
          // Create stock batch via API when online
          const batchResponse = await fetch('/api/stock-batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: product.id,
              quantity: initialStock.quantity,
              costPerUnit: newProduct.price, // Use selling price as initial cost
              cabinet: cabinet,
            }),
          });

          if (!batchResponse.ok) {
            const errorData = await batchResponse.json()
            console.warn('Failed to create initial stock batch:', errorData);
            // Don't fail the whole operation if batch creation fails
          }
          
          // Also save to IndexedDB for offline history
          try {
            const { db } = await import('@/lib/indexeddb');
            await db.stockBatches.add({
              productId: String(product.id),
              quantity: initialStock.quantity,
              costPerUnit: newProduct.price,
              cabinet: cabinet,
              addedDate: new Date().toISOString(),
              notes: 'Initial stock',
              status: 'on-shelf', // CRITICAL: Set status to 'on-shelf' for initial stock
              synced: true,
              lastModified: Date.now()
            });
            clearPriceCacheOnBatchUpdate(String(product.id), cabinet);
          } catch (dbError) {
            console.error('Failed to save initial batch to IndexedDB:', dbError);
          }
        }
      } catch (batchError) {
        console.warn('Stock batch creation failed:', batchError);
        // Don't fail the whole operation if batch creation fails
      }

      addActivity({
        username: username || "Unknown User",
        activity: "Added new product",
        details: `Added '${newProduct.name}' (SKU: ${newProduct.sku || 'Auto-generated'}) to ${cabinet} cabinet - Price: ₱${newProduct.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Category: ${newProduct.category}, Initial Stock: ${initialStock.quantity} units`,
        category: "product"
      })

      addToast(`Product added successfully! ${initialStock.quantity} units added to stock.`, "success")
      
      // Clear any active filters that might be hiding the new product
      handleClearFilters()
      
      // Refresh products to ensure stock calculations are up to date
      await refetch()
      
      // Reset forms
      setNewProduct({
        name: "",
        sku: "",
        quantity: 1,
        price: 0,
        location: "physical" as const,
        category: "",
        stock: 0,
        description: "",
      })
      setInitialStock({
        quantity: 1,
        costPerUnit: 0,
      })
      setShowAddForm(false)
    } catch (error: any) {
      console.error('Add product error:', error)
      const errorMessage = error?.message || 'Failed to add product'
      addToast(errorMessage, "error")
    }
  }

  const handleEditProduct = (product: InventoryItem) => {
    setEditingProduct(product)
    setEditingId(product.id)
  }

  const handleSaveEdit = async () => {
    if (editingProduct) {
      try {
        const result = await updateProduct(editingProduct.id, {
          name: editingProduct.name,
          sku: editingProduct.sku,
          quantity: editingProduct.stock, // Keep quantity synchronized with stock
          price: editingProduct.price,
          category: editingProduct.category,
          stock: editingProduct.stock, // Update stock with new value
          description: editingProduct.description,
        }, cabinet); // Pass cabinet to updateProduct
        
        // Check if update was successful
        if (!result.success) {
          addToast(result.error || "Failed to update product", "error");
          return;
        }
        
        // Track what fields were changed
        const changes = [];
        const originalProduct = products.find(p => p.id === editingProduct.id);
        
        if (editingProduct.name !== originalProduct?.name) {
          changes.push(`Name: '${originalProduct?.name}' → '${editingProduct.name}'`);
        }
        if (editingProduct.sku !== originalProduct?.sku) {
          changes.push(`SKU: '${originalProduct?.sku || 'N/A'}' → '${editingProduct.sku || 'N/A'}'`);
        }
        if (editingProduct.price !== originalProduct?.price) {
          changes.push(`Price: ₱${originalProduct?.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ₱${editingProduct.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }
        if (editingProduct.stock !== originalProduct?.stock) {
          changes.push(`Stock: ${Number(originalProduct?.stock || 0)} → ${Number(editingProduct.stock)} units`);
        }
        if (editingProduct.category !== originalProduct?.category) {
          changes.push(`Category: '${originalProduct?.category}' → '${editingProduct.category}'`);
        }
        if (editingProduct.description !== originalProduct?.description) {
          changes.push('description');
        }
        
        const activityDetails = changes.length === 1 && changes[0] === 'description' 
          ? `Modified '${editingProduct.name}' in ${cabinet} cabinet - Changes: description`
          : `Modified '${editingProduct.name}' in ${cabinet} cabinet - Changes: ${changes.join(', ')}`;
        
        addActivity({
          username: username || "Unknown User",
          activity: "Updated product",
          details: activityDetails,
          category: "product"
        })
        
        addToast(`Product "${editingProduct.name}" updated successfully!`, "success");
        setEditingId(null);
        setEditingProduct(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update product";
        addToast(errorMessage, "error");
      }
    }
  }

  const handleLocationChange = (id: string, newLocation: ProductLocation) => {
    const product = products.find(p => p.id === id);
    if (product) {
      updateProduct(id, { ...product, location: newLocation }, cabinet);
      
      addActivity({
        username: username || "Unknown User",
        activity: "Changed product location",
        details: `Updated '${product.name}' (SKU: ${product.sku || 'N/A'}) location from '${product.location}' to '${newLocation}' in ${cabinet} cabinet`,
        category: "product"
      });
    }
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-3">
      {/* Efficient Sidebar Filter Panel */}
      {showAdvancedFilters && (
        <div className="w-full lg:w-80 bg-white border rounded-lg shadow-sm p-3 h-fit lg:sticky lg:top-3 order-1 lg:order-1 mb-4 lg:mb-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-[#3B18DA]" />
              <h3 className="font-semibold text-gray-800 text-sm">Filters</h3>
              <span className="bg-[#3B18DA]/10 text-[#3B18DA] px-1.5 py-0.5 rounded-full text-xs">
                {[selectedCategory !== "all" ? 1 : 0, stockFilter !== "all" ? 1 : 0, (priceRangeFilter.min || priceRangeFilter.max) ? 1 : 0, (dateFilter.startDate || dateFilter.endDate) ? 1 : 0, searchQuery !== "" ? 1 : 0].reduce((a, b) => a + b, 0)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(false)}
              className="h-5 w-5 p-0 hover:bg-gray-100"
            >
              <X size={12} />
            </Button>
          </div>

          {/* Compact Filters */}
          <div className="space-y-3">
            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Package size={10} className="text-blue-600" />
                Category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-7 border-2 focus:border-blue-500 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"><span className="flex items-center gap-2"><Globe size={14} /> All Categories</span></SelectItem>
                  {categories.slice(0, 15).map((category) => (
                    <SelectItem key={category} value={category} className="text-xs">
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Package size={10} className="text-green-600" />
                Stock Status
              </label>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="h-7 border-2 focus:border-green-500 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="low"><span className="flex items-center gap-2"><AlertTriangle size={14} /> Low Stock (&lt;20)</span></SelectItem>
                  <SelectItem value="out"><span className="flex items-center gap-2"><XCircle size={14} /> Out of Stock</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <DollarSign size={10} className="text-yellow-600" />
                Price Range
              </label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  placeholder="Min"
                  value={priceRangeFilter.min}
                  onChange={(e) => setPriceRangeFilter(prev => ({ ...prev, min: e.target.value }))}
                  className="h-7 text-xs border-2 focus:border-yellow-500"
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={priceRangeFilter.max}
                  onChange={(e) => setPriceRangeFilter(prev => ({ ...prev, max: e.target.value }))}
                  className="h-7 text-xs border-2 focus:border-yellow-500"
                  min="0"
                />
              </div>
            </div>

            {/* Sort */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <ArrowUpDown size={10} className="text-indigo-600" />
                Sort By
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-7 border-2 focus:border-indigo-500 text-xs">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name"><span className="flex items-center gap-2"><FileText size={14} /> Product Name</span></SelectItem>
                  <SelectItem value="stock"><span className="flex items-center gap-2"><BarChart3 size={14} /> Stock Level</span></SelectItem>
                  <SelectItem value="price"><span className="flex items-center gap-2"><DollarSign size={14} /> Price</span></SelectItem>
                  <SelectItem value="category"><span className="flex items-center gap-2"><Folder size={14} /> Category</span></SelectItem>
                  <SelectItem value="lastRestock"><span className="flex items-center gap-2"><Calendar size={14} /> Last Restock</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Calendar size={10} className="text-purple-600" />
                Date Range
              </label>
              <div className="space-y-1">
                <Input
                  type="date"
                  value={tempDateFilter.startDate}
                  onChange={(e) => setTempDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  className="h-6 border-2 focus:border-purple-500 text-xs px-2"
                  placeholder="Start date"
                />
                <Input
                  type="date"
                  value={tempDateFilter.endDate}
                  onChange={(e) => setTempDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  className="h-6 border-2 focus:border-purple-500 text-xs px-2"
                  placeholder="End date"
                />
                <Button
                  onClick={applyDateFilter}
                  size="sm"
                  className="w-full h-6 bg-[oklch(0.65_0.22_280)] hover:bg-[oklch(0.55_0.20_280)] text-white text-xs"
                >
                  <Check size={10} className="mr-1" />
                  Apply Dates
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Zap size={10} className="text-yellow-600" />
                Quick Filters
              </label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory("all")
                    setStockFilter("low")
                    setPriceRangeFilter({ min: "", max: "" })
                    setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" })
                    setTempDateFilter({ startDate: "", endDate: "" })
                    addToast("Showing low stock items", "info")
                  }}
                  className="h-6 px-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50 text-xs"
                >
                  <AlertTriangle size={8} className="mr-1" />
                  Low
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory("all")
                    setStockFilter("out")
                    setPriceRangeFilter({ min: "", max: "" })
                    setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" })
                    setTempDateFilter({ startDate: "", endDate: "" })
                    addToast("Showing out of stock items", "info")
                  }}
                  className="h-6 px-2 border-red-300 text-red-700 hover:bg-red-50 text-xs"
                >
                  <XCircle size={8} className="mr-1" />
                  Out
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const today = new Date();
                    const localDateString = today.getFullYear() + '-' + 
                      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(today.getDate()).padStart(2, '0');
                    setSelectedCategory("all")
                    setStockFilter("all")
                    setPriceRangeFilter({ min: "", max: "" })
                    setDateFilter({ year: "all", month: "all", day: "all", startDate: localDateString, endDate: localDateString })
                    setTempDateFilter({ startDate: localDateString, endDate: localDateString })
                    addToast("Showing today's restocks", "info")
                  }}
                  className="h-6 px-2 border-green-300 text-green-700 hover:bg-green-50 text-xs col-span-2"
                >
                  <Calendar size={8} className="mr-1" />
                  Today
                </Button>
              </div>
            </div>

            {/* Clear Button */}
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="w-full h-7 text-gray-500 hover:text-gray-700 text-xs"
            >
              Clear All Filters
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 order-2 lg:order-2 ${showAdvancedFilters ? '' : 'w-full'}`}>
        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading inventory...</div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center p-8">
            <div className="text-destructive">Error: {error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="flex flex-col gap-4">
              {/* Action Buttons Row */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {filteredInventory.length} of {products.length} items
                  {searchQuery && ` for "${searchQuery}"`}
                  {selectedCategory !== "all" && ` in ${selectedCategory}`}
                  {stockFilter !== "all" && ` with ${stockFilter.replace(/([A-Z])/g, ' $1').trim()}`}
                </div>
                <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  className="h-8 px-3 rounded-md border-2 hover:bg-gray-50 text-xs"
                  title="Print inventory list"
                >
                  <Printer size={12} className="mr-1" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  className="h-8 px-3 rounded-md border-2 hover:bg-gray-50 text-xs"
                  title="Export to Excel"
                >
                  <Download size={12} className="mr-1" />
                  Export
                </Button>
                <Button
                  onClick={() => setShowAddForm(true)}
                  className="h-8 px-3 bg-[#3B18DA] hover:bg-[#2A1199] text-white shadow-lg text-xs"
                >
                  <Plus size={14} className="mr-1" />
                  Add Product
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inventory Items</CardTitle>
                    <CardDescription>All products and stock details</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-600">Total Items</div>
                    <div className="text-xl font-bold text-gray-900">{filteredInventory.length}</div>
                  </div>
                </div>

                {/* Match Sales tab: keep only the Filters button here. */}
                <div className="mt-3 flex items-center justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="h-8 px-3 rounded-md border-2 border-[#3B18DA] hover:bg-[#3B18DA]/10 text-[#3B18DA] text-xs font-medium"
                    title="Toggle filters panel"
                  >
                    <div className="flex items-center gap-1">
                      <Filter size={12} className="text-[#3B18DA]" />
                      Filters
                      {(selectedCategory !== "all" || stockFilter !== "all" || (priceRangeFilter.min || priceRangeFilter.max) || (dateFilter.startDate || dateFilter.endDate) || dateFilter.year !== "all" || searchQuery !== "") && (
                        <span className="w-2 h-2 bg-[#3B18DA] rounded-full animate-pulse"></span>
                      )}
                    </div>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="py-4 px-5 text-left font-semibold text-foreground">
                          SKU
                        </th>
                        <th className="py-4 px-5 text-left font-semibold text-foreground">
                          Name
                        </th>
                        <th className="py-4 px-5 text-left font-semibold text-foreground">
                          Description
                        </th>
                        <th className="py-4 px-5 text-left font-semibold text-foreground">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2 font-semibold hover:bg-muted/80">
                                Category
                                <ArrowUpDown size={14} className="ml-1 text-muted-foreground" />
                                {selectedCategory !== "all" && (
                                  <span className="ml-1 w-2 h-2 bg-violet-500 rounded-full"></span>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Filter Category
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                <DropdownMenuItem onClick={() => setSelectedCategory("all")} className={selectedCategory === "all" ? "bg-accent" : ""}>
                                  <Globe size={14} className="mr-2" />
                                  All Categories
                                  {selectedCategory === "all" && <Check size={12} className="ml-auto text-violet-600" />}
                                </DropdownMenuItem>
                                {categories.map((category) => (
                                  <DropdownMenuItem
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={selectedCategory === category ? "bg-accent" : ""}
                                  >
                                    <Folder size={14} className="mr-2" />
                                    {category}
                                    {selectedCategory === category && <Check size={12} className="ml-auto text-violet-600" />}
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </th>
                        <th className="py-4 px-5 text-center font-semibold text-foreground">
                          Stock
                        </th>
                        <th className="py-4 px-5 text-center font-semibold text-foreground">
                          Current Batch Price
                        </th>
                        <th className="py-4 px-5 text-center font-semibold text-foreground">
                          Last Restock
                        </th>
                        <th className="py-4 px-5 text-center font-semibold text-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredInventory.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center">
                              <div className="flex flex-col items-center">
                                <Package size={48} className="text-gray-400 mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                  {searchQuery || selectedCategory !== "all" || stockFilter !== "all" || dateFilter.startDate || dateFilter.endDate 
                                    ? "No products match your current filters. Try adjusting or clearing them." 
                                    : "Start by adding your first product"}
                                </p>
                                <div className="flex gap-3">
                                  <Button onClick={() => setShowAddForm(true)} className="bg-[#3B18DA] hover:bg-[#2A1199] text-white">
                                    <Plus size={16} className="mr-2" />
                                    Add Product
                                  </Button>
                                  {(searchQuery || selectedCategory !== "all" || stockFilter !== "all" || dateFilter.startDate || dateFilter.endDate) && (
                                    <Button 
                                      variant="outline" 
                                      onClick={() => setClearConfirm(true)}
                                    >
                                      Clear Filters
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredInventory.map((item) => (
                            <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                              <td className="py-4 px-5 text-left text-muted-foreground text-sm">{item.sku}</td>
                              <td className="py-4 px-5 text-left text-foreground font-medium">{item.name}</td>
                              <td className="py-4 px-5 text-left text-muted-foreground text-sm max-w-xs truncate" title={item.description || ''}>
                                {item.description || '-'}
                              </td>
                              <td className="py-4 px-5 text-muted-foreground text-sm">
                                <div className="flex flex-wrap gap-1">
                                  <span className="px-2 py-0.5 bg-[#3B18DA]/10 text-[#3B18DA] rounded text-xs">
                                    {item.category}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    item.stock === 0 
                                      ? "bg-red-100 text-red-700" 
                                      : item.stock < 20 
                                      ? "bg-yellow-100 text-yellow-700" 
                                      : "bg-primary/20 text-primary"
                                  }`}
                                >
                                  {item.stock}
                                </span>
                              </td>
                              <td className="py-4 px-5 text-center text-muted-foreground text-sm font-semibold">
                                <BatchPriceDisplay 
                                  productId={String(item.id)} 
                                  cabinet={cabinet}
                                  className="text-foreground text-sm font-semibold"
                                />
                              </td>
                              <td className="py-4 px-5 text-center text-muted-foreground text-sm">
                                {item.lastRestockDate ? new Date(item.lastRestockDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                }) : '-'}
                              </td>
                              <td className="py-4 px-5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-primary hover:bg-primary/10 h-7 w-7 p-0"
                                    onClick={() => handleEditProduct(item)}
                                    title="Edit Product"
                                  >
                                    <Edit2 size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:bg-blue-10 h-7 w-7 p-0"
                                    onClick={() => openStockDialog(item)}
                                    title="View Stock Tracking"
                                  >
                                    <Clock size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                                    onClick={() => handleDelete(item.id)}
                                    title="Delete Product"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            </div>
          </>
          )}
      </div>
    </div>

    {/* Confirmation Dialog */}
    <ConfirmDialog
      open={clearConfirm}
      title="Clear All Filters"
      description="Are you sure you want to clear all active filters? This will show all items in the inventory."
      confirmText="Clear Filters"
      cancelText="Cancel"
      onConfirm={confirmClearFilters}
      onCancel={() => setClearConfirm(false)}
    />

    <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
      <DialogContent className="max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Add New Product
          </DialogTitle>
          <DialogDescription>
            Enter product details to add to inventory. Stock can be added later using the clock icon.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <h3 className="font-semibold mb-3 text-blue-800">Product Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-blue-700 mb-1 block">Product Name</label>
                <Input
                  placeholder="Enter product name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="border-blue-300 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-blue-700 mb-1 block">SKU</label>
                  <Input
                    placeholder="Product SKU"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="border-blue-300 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-700 mb-1 block">Unit Price (₱)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                    className="border-blue-300 focus:border-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-700 mb-1 block">Initial Quantity</label>
                <Input
                  type="number"
                  placeholder="1"
                  value={initialStock.quantity}
                  onChange={(e) => setInitialStock({ ...initialStock, quantity: parseInt(e.target.value) || 1 })}
                  className="border-blue-300 focus:border-blue-500"
                  min="1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-blue-700 mb-1 block">Category</label>
                <Select value={newProduct.category} onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}>
                  <SelectTrigger className="border-blue-300 focus:border-blue-500">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-700 mb-1 block">Description</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => {
                    if (e.target.value.length <= 50) {
                      setNewProduct({ ...newProduct, description: e.target.value })
                    }
                  }}
                  placeholder="Product description (optional)..."
                  className="w-full p-2 border rounded-md resize-none h-20 border-blue-300 focus:border-blue-500"
                  maxLength={50}
                />
                <p className="text-xs text-gray-500 mt-1">{newProduct.description.length}/50 characters</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowAddForm(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleAddProduct} className="bg-[#3B18DA] hover:bg-[#2A1199] text-white">
              <Plus size={16} className="mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={editingId !== null} onOpenChange={() => setEditingId(null)}>
      <DialogContent className="mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Update product details</DialogDescription>
        </DialogHeader>
        {editingProduct && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">SKU</label>
              <Input
                value={editingProduct?.sku || ''}
                onChange={(e) => setEditingProduct(editingProduct ? { ...editingProduct, sku: e.target.value } : null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
              <textarea
                value={editingProduct?.description || ""}
                onChange={(e) => {
                  if (e.target.value.length <= 50) {
                    setEditingProduct(editingProduct ? { ...editingProduct, description: e.target.value } : null)
                  }
                }}
                placeholder="Product description..."
                className="w-full p-2 border rounded-md resize-none h-20"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">{(editingProduct?.description || "").length}/50 characters</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Category</label>
              <Select
                value={editingProduct?.category || ""}
                onValueChange={(value) => setEditingProduct(editingProduct ? { ...editingProduct, category: value } : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Save Changes
              </Button>
              <Button onClick={() => setEditingId(null)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, id: null })}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Product</DialogTitle>
          <DialogDescription>
            This action cannot be undone. To confirm deletion, please type the product name exactly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-destructive">
              Product to delete:
            </label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm border border-destructive/20">
              {products.find(p => p.id === deleteConfirm.id)?.name || 'Unknown Product'}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmName" className="text-sm font-medium">
              Type product name to confirm:
            </label>
            <Input
              id="confirmName"
              type="text"
              value={confirmProductName}
              onChange={(e) => setConfirmProductName(e.target.value)}
              placeholder="Type the exact product name"
              className="border-destructive/20 focus:border-destructive"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setDeleteConfirm({ open: false, id: null })
              setConfirmProductName('')
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={confirmProductName !== products.find(p => p.id === deleteConfirm.id)?.name}
          >
            Delete Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Stock Tracking Dialog */}
    <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
      <DialogContent className="max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Tracking - {selectedProductForStock?.name}</DialogTitle>
          <DialogDescription>Manage stock batches and track inventory by purchase date</DialogDescription>
        </DialogHeader>
        {selectedProductForStock && (
          <div className="space-y-4">
            {/* Add New Stock Form */}
            <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <h3 className="font-semibold mb-3 text-green-800">Add New Stock</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-green-700 mb-1 block">Quantity</label>
                    <Input
                      type="number"
                      value={newStock.quantity}
                      onChange={(e) => setNewStock({ ...newStock, quantity: parseInt(e.target.value) || 1 })}
                      min="1"
                      placeholder="How many units?"
                      className="border-green-300 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-green-700 mb-1 block">Cost per Unit (₱) *</label>
                    <Input
                      type="number"
                      value={newStock.costPerUnit}
                      onChange={(e) => setNewStock({ ...newStock, costPerUnit: parseFloat(e.target.value) || 0 })}
                      min="0.01"
                      step="0.01"
                      placeholder="Enter cost per unit (required)"
                      className="border-green-300 focus:border-green-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter the actual cost price per unit (cannot be 0)</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-green-700 mb-1 block">Notes</label>
                  <Input
                    value={newStock.notes}
                    onChange={(e) => {
                      if (e.target.value.length <= 50) {
                        setNewStock({ ...newStock, notes: e.target.value })
                      }
                    }}
                    placeholder="e.g., New shipment, Restock"
                    className="border-green-300 focus:border-green-500"
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {newStock.notes.length}/50 characters
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setShowRestockConfirm(true)} className="bg-green-600 hover:bg-green-700" disabled={isAddingStock}>
                    {isAddingStock ? (
                      <>
                        <Spinner className="mr-2" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" />
                        Restock
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Stock History Display */}
            <div>
              <h3 className="font-semibold mb-3">Stock History</h3>
              {isLoadingStock ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="mr-2" />
                  <span className="text-muted-foreground">Loading stock data...</span>
                </div>
              ) : stockAdditions.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-muted rounded-lg">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-1">No stock history yet</p>
                  <p className="text-sm text-muted-foreground">
                    Add your first stock batch below
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stockAdditions.map((addition, index) => {
                    const age = getStockAge(addition.addedDate);
                    const ageColor = getStockAgeColor(addition.addedDate);
                    const isGreen = age < 30;
                    const isYellow = age >= 30 && age <= 90;
                    const isRed = age > 90;
                    
                    // Check if batch has zero stock
                    const isZeroStock = addition.quantity === 0;
                    const hasStock = addition.quantity > 0;
                    
                    const addedDate = new Date(addition.addedDate);
                    const formattedDate = addedDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    });
                    const formattedTime = addedDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });
                    
                    return (
                    <div key={`${addition.id}-${index}`} className={`border rounded-lg p-5 shadow-sm space-y-3 ${
                      isZeroStock 
                        ? 'bg-gray-50 border-gray-300 opacity-60' 
                        : index === 0 
                          ? 'bg-white border-blue-500 border-2' 
                          : 'bg-white border-gray-200'
                    }`}>
                      {/* Top row - Main info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                          {/* Quantity and Notes */}
                          <div className="flex flex-col">
                            <span className="font-semibold text-lg">{addition.quantity} units</span>
                            
                            {/* Notes - simple text display */}
                            {addition.notes && (
                              <p className="text-sm text-gray-700 mt-1 font-medium">
                                Notes: {addition.notes}
                              </p>
                            )}
                          </div>
                          
                          {/* Price and other items */}
                          <div className="flex items-center gap-2">
                            {addition.costPerUnit && addition.costPerUnit > 0 && (
                              <span className="text-sm text-green-600">
                                ₱{addition.costPerUnit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                            
                            {/* Current batch indicator - only for batches with stock > 0 */}
                            {index === 0 && hasStock && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                Current Batch
                              </span>
                            )}
                            
                            {/* Zero stock indicator */}
                            {isZeroStock && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Delete button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBatchToDelete(addition)
                            setShowDeleteBatchConfirm(true)
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove this batch"
                          disabled={isDeletingBatch && batchToDelete?.id === addition.id}
                        >
                          {isDeletingBatch && batchToDelete?.id === addition.id ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      </div>

                      {/* Bottom row - Status and Date */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Status */}
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              Number(addition.quantity) === 0 
                                ? 'bg-red-500' 
                                : addition.status === 'on-shelf' 
                                  ? 'bg-green-500' 
                                  : 'bg-blue-500'
                            }`} />
                            {isUpdatingStatus === addition.id ? (
                              <div className="flex items-center gap-2">
                                <Spinner className="size-3" />
                                <span className="text-sm text-gray-500">Updating...</span>
                              </div>
                            ) : Number(addition.quantity) === 0 ? (
                              <span className="text-sm text-red-400 italic">Unavailable</span>
                            ) : (
                              <select
                                value={addition.status || 'in-storage'}
                                onChange={(e) => handleUpdateBatchStatus(addition.id, e.target.value as 'on-shelf' | 'in-storage')}
                                className="text-sm text-gray-600 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
                              >
                                <option value="on-shelf">On Shelf</option>
                                <option value="in-storage">In Storage</option>
                              </select>
                            )}
                          </div>
                          
                          {/* Age */}
                          <span className="text-sm text-gray-500">
                            {age} {age === 1 ? 'day' : 'days'} ago
                          </span>
                        </div>
                        
                        {/* Date */}
                        <span className="text-sm text-gray-500">
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                    )
                  })}
                  
                  {/* Summary Card */}
                  <div className="bg-gradient-to-r from-[oklch(0.2_0.02_280)] to-[oklch(0.15_0.02_280)] border border-[oklch(0.3_0.05_280)] rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-[oklch(0.85_0.05_280)] font-medium">Total Stock</p>
                        <p className="text-xs text-[oklch(0.7_0.03_280)]">All batches combined</p>
                      </div>
                      <span className="text-2xl font-bold text-white">
                        {Number(selectedProductForStock?.stock || 0)} units
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowStockDialog(false)} variant="outline">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Restock Confirmation Dialog */}
    <ConfirmDialog
      open={showRestockConfirm}
      title="Confirm Restock"
      description={`Are you sure you want to add ${newStock.quantity} units to ${selectedProductForStock?.name}?${newStock.costPerUnit > 0 ? ` Cost per unit: ₱${newStock.costPerUnit.toLocaleString()}` : ''}`}
      confirmText="Restock"
      cancelText="Cancel"
      onConfirm={() => {
        setShowRestockConfirm(false)
        handleAddStock()
      }}
      onCancel={() => setShowRestockConfirm(false)}
    />

    {/* Delete Batch Confirmation Dialog */}
    <ConfirmDialog
      open={showDeleteBatchConfirm}
      title="Remove Batch"
      description={`Are you sure you want to remove this batch of ${batchToDelete?.quantity} units from ${selectedProductForStock?.name}? This will reduce the total stock from ${(selectedProductForStock?.stock || 0)} to ${Math.max(0, (selectedProductForStock?.stock || 0) - (batchToDelete?.quantity || 0))} units.`}
      confirmText="Remove"
      cancelText="Cancel"
      onConfirm={() => {
        console.log('Confirm dialog onConfirm called');
        console.log('batchToDelete at confirm:', batchToDelete);
        setShowDeleteBatchConfirm(false);
        setShowProductNameConfirm(true);
        setConfirmProductName('');
      }}
      onCancel={() => {
        setShowDeleteBatchConfirm(false)
        setBatchToDelete(null)
      }}
    />

    {/* Product Name Confirmation Dialog */}
    <Dialog open={showProductNameConfirm} onOpenChange={setShowProductNameConfirm}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-destructive">⚠️ Confirm Batch Deletion</DialogTitle>
          <DialogDescription>
            To prevent accidental deletion, please type the product name exactly as shown below to confirm:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted p-3 rounded-md">
            <p className="font-semibold text-center text-lg">{selectedProductForStock?.name}</p>
          </div>
          <Input
            placeholder="Type product name to confirm"
            value={confirmProductName}
            onChange={(e) => setConfirmProductName(e.target.value)}
            className="w-full"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowProductNameConfirm(false);
              setConfirmProductName('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmProductName !== selectedProductForStock?.name}
            onClick={() => {
              if (confirmProductName === selectedProductForStock?.name && batchToDelete?.id) {
                const batchId = String(batchToDelete.id);
                console.log('Calling handleDeleteBatch with:', batchId);
                handleDeleteBatch(batchId);
                setShowProductNameConfirm(false);
                setConfirmProductName('');
                setBatchToDelete(null);
              }
            }}
          >
            Delete Batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  )
}
