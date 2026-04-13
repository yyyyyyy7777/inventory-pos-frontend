"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, Plus, Search, Package, Clock, Trash2, Edit2, Filter, X, Calendar, ArrowUpDown, Zap, Check, AlertTriangle, XCircle, Printer, Download, RefreshCw, Globe, FileText, BarChart3, Folder, ImagePlus } from "lucide-react"
import { PesoIcon } from "@/components/ui/peso-icon"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProducts, type Product, type ProductLocation } from "@/contexts/products-context"
import { useToast } from "@/contexts/toast-context"
import { useActivity } from "@/contexts/activity-context"
import { validateProductForm } from "@/utils/validation"
import { parseLocalDayEnd, parseLocalDayStart } from "@/lib/date-range"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { BatchPriceDisplay } from "@/components/shared/batch-price-display"
import { getCurrentPriceFromBatches, clearPriceCacheOnBatchUpdate } from "@/lib/batch-price"
import { buildInventoryExcelBuffer } from "@/lib/inventory-excel-export"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { compressImageFileToDataUrl } from "@/lib/product-image"

interface InventoryViewProps {
  isAdmin: boolean
  cabinet: string
  username?: string
}

type InventoryItem = Product;

/** Display dates as MM/DD/YY for inventory tables. */
function formatInventoryMMDDYY(value: string | undefined | null): string {
  if (value == null || value === "") return "—"
  const s = String(value).trim()
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    const yy = String(d.getFullYear()).slice(-2)
    return `${mm}/${dd}/${yy}`
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const day = Number(iso[3])
    const mm = String(m).padStart(2, "0")
    const dd = String(day).padStart(2, "0")
    const yy = String(y).slice(-2)
    return `${mm}/${dd}/${yy}`
  }
  return s.length > 12 ? `${s.slice(0, 12)}…` : s
}

const INV_TH =
  "py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-normal leading-tight"

const ADD_PRODUCT_FIELD_CLASS =
  "h-10 w-full rounded-md border-2 border-blue-200/80 bg-background shadow-sm transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none"

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
      
      // Proper FIFO sorting synchronization:
      // 1. Rigorously identify the TRUE 'Current Batch' that the pricing engine uses (Oldest on-shelf with stock, or oldest in-storage with stock).
      // 2. Force the Current Batch to index 0 so it correctly receives the "Current Batch" UI tag.
      // 3. Sort remaining active batches newest-first for readable history.
      // 4. Sort depleted batches newest-first at the bottom.
      const activeBatchesForMath = filteredBatches.filter(b => b.quantity > 0);
      let trueCurrentBatchId = null;
      if (activeBatchesForMath.length > 0) {
        const onShelf = activeBatchesForMath.filter(b => b.status === 'on-shelf');
        if (onShelf.length > 0) {
            trueCurrentBatchId = onShelf.sort((a,b) => new Date(a.addedDate || 0).getTime() - new Date(b.addedDate || 0).getTime())[0].id;
        } else {
            trueCurrentBatchId = activeBatchesForMath.sort((a,b) => new Date(a.addedDate || 0).getTime() - new Date(b.addedDate || 0).getTime())[0].id;
        }
      }

      const sortedBatches = filteredBatches.sort((a, b) => {
        const aDate = new Date(a.addedDate || 0).getTime();
        const bDate = new Date(b.addedDate || 0).getTime();
        
        // Priority 0: True Current Batch is absolutely paramount
        if (a.id === trueCurrentBatchId && b.id !== trueCurrentBatchId) return -1;
        if (b.id === trueCurrentBatchId && a.id !== trueCurrentBatchId) return 1;
        
        // Priority 1: Separate by stock availability
        const aHasStock = a.quantity > 0;
        const bHasStock = b.quantity > 0;
        
        if (aHasStock && !bHasStock) {
          return -1; // A has stock, comes first
        }
        if (!aHasStock && bHasStock) {
          return 1; // B has stock, comes first
        }
        
        // Priority 2: Standard descending view for history layout readability
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
    sellingPrice: 0,
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
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  // Advanced filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [priceRangeFilter, setPriceRangeFilter] = useState({ min: "", max: "" })
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: "",
  })
  const [tempDateFilter, setTempDateFilter] = useState({
    startDate: "",
    endDate: "",
  })
  const [sortBy, setSortBy] = useState("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    if (!showAdvancedFilters) return
    setTempDateFilter({ startDate: dateFilter.startDate, endDate: dateFilter.endDate })
  }, [showAdvancedFilters])

  // Handle date filter confirmation with validation
  const applyDateFilter = () => {
    if (tempDateFilter.startDate && tempDateFilter.endDate) {
      const start = parseLocalDayStart(tempDateFilter.startDate)
      const end = parseLocalDayEnd(tempDateFilter.endDate)
      if (start.getTime() > end.getTime()) {
        addToast("From date cannot be after To date", "error")
        return
      }
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff > 366) {
        addToast("Date range cannot exceed one year", "error")
        return
      }
    }

    setDateFilter({
      startDate: tempDateFilter.startDate,
      endDate: tempDateFilter.endDate,
    })

    if (tempDateFilter.startDate || tempDateFilter.endDate) {
      const message =
        tempDateFilter.startDate && tempDateFilter.endDate
          ? `Showing restocks from ${tempDateFilter.startDate} to ${tempDateFilter.endDate}`
          : tempDateFilter.startDate
            ? `Showing restocks on or after ${tempDateFilter.startDate}`
            : `Showing restocks on or before ${tempDateFilter.endDate}`
      addToast(message, "success")
    }
  }

  // Confirmation dialog for clearing filters
  const [clearConfirm, setClearConfirm] = useState(false);
  
  const handleClearFilters = () => {
    // Check if any filters are actually applied
    const hasFilters = selectedCategory !== "all" ||
                      stockFilter !== "all" ||
                      (dateFilter.startDate || dateFilter.endDate) ||
                      searchQuery !== "";
    
    if (!hasFilters) {
      addToast("No filters to clear", "info");
      return;
    }
    
    setClearConfirm(true);
  }

  const confirmClearFilters = (showToast = true) => {
    setSelectedCategory("all")
    setStockFilter("all")
    setPriceRangeFilter({ min: "", max: "" })
    setDateFilter({
      startDate: "",
      endDate: "",
    })
    setTempDateFilter({ 
      startDate: "", 
      endDate: "" 
    })
    setSortBy("name")
    setSortDirection("asc")
    setSearchQuery("")
    setClearConfirm(false)
    if (showToast) addToast("All filters cleared", "success")
  }

  // Track if filters have been applied and results are empty
  const [filtersApplied, setFiltersApplied] = useState(false)
  
  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    quantity: 1,
    price: 0,
    costPrice: 0,
    location: "physical" as const,
    category: "",
    stock: 0,
    description: "",
    purchaseDate: "",
    purchasePlace: "",
    supplierName: "",
    dimLengthCm: "" as string | number,
    dimWidthCm: "" as string | number,
    dimHeightCm: "" as string | number,
    weightKg: "" as string | number,
    imageUrl: "" as string,
  })
  const [initialStock, setInitialStock] = useState({
    quantity: 1,
    costPerUnit: 0,
  })
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })

  // Force reset loading states whenever a dialog is explicitly opened.
  useEffect(() => {
    if (showAddForm) {
      setIsSavingProduct(false);
      setIsUploadingImage(false);
    }
  }, [showAddForm]);

  useEffect(() => {
    if (editingId !== null) {
      setIsSavingProduct(false);
      setIsUploadingImage(false);
    }
  }, [editingId]);

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
  const handlePrint = async () => {
    addToast("Preparing print layout...", "info");
    
    // Open window immediately to bypass popup blockers
    const printWindow = window.open('', '', 'width=1000,height=600');
    if (!printWindow) {
      addToast("Browser blocked the print popup. Please allow popups.", "error");
      return;
    }
    printWindow.document.write("<html><body><h2 style='font-family: sans-serif; text-align: center; margin-top: 50px;'>Gathering latest prices for print... Please wait.</h2></body></html>");

    const printableRows = [];
    let totalValue = 0;
    
    for (const item of filteredInventory) {
      const batchStats = await getCurrentPriceFromBatches(String(item.id), cabinet);
      const finalPrice = batchStats.price || Number(item.price) || 0;
      const finalCost = batchStats.unitCost || Number(item.costPrice) || 0;
      const stock = Number(item.stock) || 0;
      const capital = stock * finalCost;
      totalValue += capital;
      
      const dims = (item.dimLengthCm != null || item.dimWidthCm != null || item.dimHeightCm != null) 
        ? `${item.dimLengthCm?item.dimLengthCm+"L":""} ${item.dimWidthCm?"× "+item.dimWidthCm+"W":""} ${item.dimHeightCm?"× "+item.dimHeightCm+"H":""}`.trim().replace(/^×\s*/, '')
        : "—";

      printableRows.push(`
        <tr>
          <td>${item.sku || "N/A"}</td>
          <td>${item.name}</td>
          <td>${item.description || "-"}</td>
          <td>${item.category}</td>
          <td class="${stock === 0 ? 'zero-stock' : stock < 20 ? 'low-stock' : ''}">${stock}</td>
          <td class="amount">₱${finalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td class="amount">₱${finalPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td class="amount">₱${(finalPrice - finalCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td class="amount">₱${capital.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td>${dims}</td>
          <td>${item.weightKg != null ? item.weightKg + " kg" : "-"}</td>
          <td>${item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : "-"}</td>
          <td>${item.purchasePlace || "-"}</td>
          <td>${item.supplierName || "-"}</td>
          <td>${item.createdBy || "-"}</td>
          <td>${item.lastUpdatedBy || "-"}</td>
          <td>${item.dateCreated ? new Date(item.dateCreated).toLocaleDateString() : "-"}</td>
          <td>${item.lastModifiedDate ? new Date(item.lastModifiedDate).toLocaleDateString() : "-"}</td>
          <td>${item.lastRestockDate ? new Date(item.lastRestockDate).toLocaleDateString() : "-"}</td>
        </tr>
      `);
    }

    const printContent = `
      <html>
        <head>
          <title>Inventory List - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .logo-container { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px; }
            .logo-container img { max-height: 50px; }
            h1 { color: #1e293b; margin: 0; font-size: 1.5rem; text-transform: uppercase; }
            .meta { text-align: center; margin-bottom: 30px; font-size: 0.9em; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.75rem; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; word-break: break-word; }
            th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .low-stock { color: #dc2626; font-weight: bold; }
            .zero-stock { color: #dc2626; font-weight: bold; background-color: #fef2f2; }
            .amount { text-align: right; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: landscape; margin: 10mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="logo-container">
            <img src="/Wheezard logo.png" onerror="this.style.display='none'" alt="LOGO" />
            <h1>INVENTORY LIST - THE WHEEZARD PH</h1>
          </div>
          <div class="meta">
            Cabinet: <strong>${cabinet}</strong> | 
            Total Products: <strong>${filteredInventory.length}</strong> | 
            Total Capital: <strong>₱${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Stock</th>
                <th class="amount">Unit Cost</th>
                <th class="amount">Selling Price</th>
                <th class="amount">Profit Amount</th>
                <th class="amount">Capital</th>
                <th>Dimensions</th>
                <th>Weight (kg)</th>
                <th>Purchase Date</th>
                <th>Place of Purchase</th>
                <th>Supplier</th>
                <th>Created By</th>
                <th>Updated By</th>
                <th>Date Added</th>
                <th>Last Modified</th>
                <th>Last Restock</th>
              </tr>
            </thead>
            <tbody>
              ${printableRows.join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    // Replace the loading screen with actual content
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Allow images to load before printing
    setTimeout(() => {
      printWindow.print();
      
      let printHandled = false;
      printWindow.onafterprint = () => {
        printHandled = true;
        printWindow.close();
        addToast("Print dialog closed", "info");
      };
      
      setTimeout(() => {
        if (!printWindow.closed && !printHandled) {
          printWindow.close();
          addToast("Print cancelled", "info");
        }
      }, 5000);
    }, 500);
  };

  const filteredInventory = products.filter(item => {
    // Search filter
    const matchesSearch = (item.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.sku || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    
    // Date filter: last restock (or last updated) within optional From / To (inclusive, local calendar days)
    let matchesDate = true;
    if (dateFilter.startDate || dateFilter.endDate) {
      const dateSource = item.lastRestockDate || item.lastUpdated;
      const itemDate = new Date(dateSource);
      if (Number.isNaN(itemDate.getTime())) {
        matchesDate = false;
      } else if (dateFilter.startDate && dateFilter.endDate) {
        const from = parseLocalDayStart(dateFilter.startDate);
        const to = parseLocalDayEnd(dateFilter.endDate);
        matchesDate = itemDate >= from && itemDate <= to;
      } else if (dateFilter.startDate) {
        matchesDate = itemDate >= parseLocalDayStart(dateFilter.startDate);
      } else if (dateFilter.endDate) {
        matchesDate = itemDate <= parseLocalDayEnd(dateFilter.endDate);
      }
    }
      
      return matchesSearch && matchesCategory && matchesStock && matchesPrice && matchesDate;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name": comparison = (a.name || "").localeCompare(b.name || ""); break;
        case "stock": comparison = (b.stock || 0) - (a.stock || 0); break;
        case "price": comparison = (a.price || 0) - (b.price || 0); break;
        case "category": comparison = (a.category || "").localeCompare(b.category || ""); break;
        case "lastRestock":
          const aDate = new Date(a.lastRestockDate || "1970-01-01");
          const bDate = new Date(b.lastRestockDate || "1970-01-01");
          comparison = bDate.getTime() - aDate.getTime();
          break;
        default: return 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  /** Generates a formatted Excel document for the current filtered view */
  const handleExportExcel = async () => {
    // Generate active filter descriptions
    const filterParts: string[] = []
    if (searchQuery.trim()) filterParts.push(`search "${searchQuery.trim()}"`)
    if (selectedCategory !== "all") filterParts.push(`category ${selectedCategory}`)
    if (stockFilter !== "all") filterParts.push(`stock ${stockFilter}`)
    if (priceRangeFilter.min || priceRangeFilter.max) {
      filterParts.push(`price ${priceRangeFilter.min || "…"}–${priceRangeFilter.max || "…"}`)
    }
    if (dateFilter.startDate || dateFilter.endDate) {
      filterParts.push(`restock ${dateFilter.startDate || "…"}→${dateFilter.endDate || "…"}`)
    }

    try {
      const detailRows = [];
      let totalStockUnits = 0;
      let totalInventoryCapital = 0;

      // Asynchronously fetch current tracking data for each filtered row
      for (const item of filteredInventory) {
        const batchStats = await getCurrentPriceFromBatches(String(item.id), cabinet);
        const finalPrice = batchStats.price || Number(item.price) || 0;
        const finalCost = batchStats.unitCost || Number(item.costPrice) || 0;
        const stock = Number(item.stock) || 0;
        const capital = stock * finalCost;
        
        detailRows.push({
          sku: item.sku || "N/A",
          name: item.name,
          description: item.description || "—",
          category: item.category || "Uncategorized",
          stock,
          unitCost: finalCost,
          sellingPrice: finalPrice,
          capital,
          dimensions: (item.dimLengthCm != null || item.dimWidthCm != null || item.dimHeightCm != null) 
            ? `${item.dimLengthCm?item.dimLengthCm+"L":""} ${item.dimWidthCm?"× "+item.dimWidthCm+"W":""} ${item.dimHeightCm?"× "+item.dimHeightCm+"H":""}`.trim().replace(/^×\s*/, '')
            : "—",
          weight: item.weightKg != null ? `${item.weightKg}` : "—",
          purchasePlace: item.purchasePlace || "—",
          supplierName: item.supplierName || "—",
          createdBy: item.createdBy || "—",
          lastUpdatedBy: item.lastUpdatedBy || "—",
          lastRestock: item.lastRestockDate ? new Date(item.lastRestockDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "No restocks",
          dateCreated: item.dateCreated ? new Date(item.dateCreated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Unknown",
          lastModified: item.lastModifiedDate ? new Date(item.lastModifiedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Unknown",
        });

        totalStockUnits += stock;
        totalInventoryCapital += capital;
      }

      let logoBuffer: ArrayBuffer | undefined;
      try {
        const res = await fetch('/Wheezard logo.png');
        if (res.ok) {
          logoBuffer = await res.arrayBuffer();
        }
      } catch (err) {
        console.warn('Could not fetch logo for excel export', err);
      }

      const bytes = await buildInventoryExcelBuffer({
        cabinetLabel: cabinet === "all" ? "All Cabinets" : String(cabinet),
        generatedAt: new Date().toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        filterLine: filterParts.length ? filterParts.join(" · ") : "None (All products in view rules)",
        totalItems: filteredInventory.length,
        totalStockUnits,
        totalInventoryCapital,
        detailRows,
        logoBuffer
      });

      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const safeCab = String(cabinet || "all").replace(/[^\w.-]+/g, "_");
      const filename = `inventory_${safeCab}_${new Date().toISOString().split("T")[0]}.xlsx`;

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast("Inventory exported successfully to modern Excel sheet!", "success");
    } catch (err) {
      console.error("Export error:", err);
      addToast("Failed to compile Excel file.", "error");
    }
  }

  // Check if filters are applied and show toast if results are empty
  const hasActiveFilters = selectedCategory !== "all" ||
                          stockFilter !== "all" ||
                          (dateFilter.startDate || dateFilter.endDate) ||
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

  const openStockDialog = async (product: Product) => {
    try {
      setIsLoadingStock(true)
      setSelectedProductForStock(product)
      
      // Initialize stock form with current product base prices
      setNewStock({
        quantity: 1,
        costPerUnit: product.costPrice || 0,
        sellingPrice: product.price || 0,
        notes: "",
        addedDate: new Date().toISOString()
      });
      
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
              // bulkPut is idempotent and avoids ConstraintError on duplicates.
              await db.stockBatches.bulkPut(indexedDBBatches);
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

    if (Number(newStock.sellingPrice) < Number(newStock.costPerUnit)) {
      addToast("Selling price cannot be lower than the acquired unit cost.", "error");
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
          sellingPrice: newStock.sellingPrice,
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
          sellingPrice: newStock.sellingPrice,
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
        setNewStock({ quantity: 1, costPerUnit: 0, sellingPrice: 0, notes: "", addedDate: new Date().toISOString() });
        
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
          sellingPrice: newStock.sellingPrice || null,
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
          sellingPrice: newStock.sellingPrice,
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
      setNewStock({ quantity: 1, costPerUnit: 0, sellingPrice: 0, notes: "", addedDate: new Date().toISOString() })
      
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

  /** Full calendar days since restock (floor). Used for color bands — NOT Math.ceil, or <24h shows as "1 day". */
  const getStockAge = (createdAt: string): number => {
    const created = new Date(createdAt)
    if (Number.isNaN(created.getTime())) return 0
    const diffMs = Math.max(0, Date.now() - created.getTime())
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  /** Human-readable relative time for stock history (avoids "1 day ago" right after restock). */
  const getStockAgeLabel = (createdAt: string): string => {
    const created = new Date(createdAt)
    if (Number.isNaN(created.getTime())) return ""
    const diffMs = Math.max(0, Date.now() - created.getTime())
    const minutes = Math.floor(diffMs / (1000 * 60))
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes} min ago`
    if (hours < 24) return `${hours} hr ago`
    if (days === 1) return "1 day ago"
    return `${days} days ago`
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
    
    const isOnline = navigator.onLine;
    console.log('Online status:', isOnline);

    const skuTrim = String(newProduct.sku || "").trim()
    if (!skuTrim) {
      addToast("SKU is required.", "error")
      return
    }
    if (!String(newProduct.name || "").trim()) {
      addToast("Product name is required.", "error")
      return
    }
    if (!newProduct.purchaseDate) {
      addToast("Date of purchase is required.", "error")
      return
    }
    if (!String(newProduct.purchasePlace || "").trim()) {
      addToast("Place of purchase is required.", "error")
      return
    }
    const acquiredNum = Number(newProduct.costPrice)
    if (!Number.isFinite(acquiredNum) || acquiredNum <= 0) {
      addToast("Acquired price is required (enter an amount greater than zero).", "error")
      return
    }
    if (Number(newProduct.price) < acquiredNum) {
      addToast("Selling price cannot be lower than the acquired price.", "error")
      return
    }
    if (!String(newProduct.category || "").trim()) {
      addToast("Category is required.", "error")
      return
    }
    
    // Validate form - now require price and quantity since we're creating initial batch
    const validation = validateProductForm(
      {
        name: newProduct.name,
        price: newProduct.price,
        quantity: initialStock.quantity,
        category: newProduct.category,
        costPrice: newProduct.costPrice,
        description: newProduct.description,
        imageUrl: newProduct.imageUrl || undefined,
      },
      true,
      true
    )
    
    console.log('Validation result:', validation);
    
    if (!validation.isValid) {
      addToast(validation.errors[0].message, "error")
      return
    }

    setIsSavingProduct(true);

    try {
      // First create the product
      const numOrU = (v: string | number) => {
        if (v === "" || v === undefined || v === null) return undefined
        const n = typeof v === "number" ? v : parseFloat(String(v))
        return Number.isFinite(n) ? n : undefined
      }
      const productData = {
        name: newProduct.name,
        sku: skuTrim.toUpperCase(),
        quantity: initialStock.quantity,
        price: newProduct.price,
        category: newProduct.category,
        stock: initialStock.quantity,
        location: newProduct.location,
        lastUpdated: new Date().toLocaleDateString('en-CA'),
        cabinet: cabinet,
        description: newProduct.description,
        costPrice: acquiredNum,
        purchaseDate: newProduct.purchaseDate || undefined,
        purchasePlace: newProduct.purchasePlace.trim(),
        supplierName: newProduct.supplierName || undefined,
        dimLengthCm: numOrU(newProduct.dimLengthCm),
        dimWidthCm: numOrU(newProduct.dimWidthCm),
        dimHeightCm: numOrU(newProduct.dimHeightCm),
        weightKg: numOrU(newProduct.weightKg),
        imageUrl: newProduct.imageUrl || undefined,
        createdBy: (username && username.trim()) || "Unknown",
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
      const initialBatchUnitCost = acquiredNum

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
              costPerUnit: initialBatchUnitCost,
              sellingPrice: productData.price,
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
              costPerUnit: initialBatchUnitCost,
              sellingPrice: productData.price,
              cabinet: cabinet,
              isInitialBatch: true,
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
              costPerUnit: initialBatchUnitCost,
              sellingPrice: productData.price,
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
      confirmClearFilters(false)
      
      // Refresh products to ensure stock calculations are up to date
      await refetch()
      
      // Reset forms
      setNewProduct({
        name: "",
        sku: "",
        quantity: 1,
        price: 0,
        costPrice: 0,
        location: "physical" as const,
        category: "",
        stock: 0,
        description: "",
        purchaseDate: "",
        purchasePlace: "",
        supplierName: "",
        dimLengthCm: "",
        dimWidthCm: "",
        dimHeightCm: "",
        weightKg: "",
        imageUrl: "",
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
    } finally {
      setIsSavingProduct(false);
    }
  }

  const handleEditProduct = (product: InventoryItem) => {
    setEditingProduct(product)
    setEditingId(product.id)
  }

  const handleSaveEdit = async () => {
    if (editingProduct) {
      if (Number(editingProduct.price) < Number(editingProduct.costPrice || 0)) {
        addToast("Selling price cannot be lower than the acquired price.", "error");
        return;
      }
      setIsSavingProduct(true);
      try {
        const result = await updateProduct(
          editingProduct.id,
          {
            name: editingProduct.name,
            sku: editingProduct.sku,
            quantity: editingProduct.stock,
            price: editingProduct.price,
            category: editingProduct.category,
            stock: editingProduct.stock,
            description: editingProduct.description,
            costPrice: editingProduct.costPrice,
            purchaseDate: editingProduct.purchaseDate,
            purchasePlace: editingProduct.purchasePlace,
            supplierName: editingProduct.supplierName,
            dimLengthCm: editingProduct.dimLengthCm,
            dimWidthCm: editingProduct.dimWidthCm,
            dimHeightCm: editingProduct.dimHeightCm,
            weightKg: editingProduct.weightKg,
            imageUrl: editingProduct.imageUrl,
            cabinet,
            updatedBy: (username && username.trim()) || "Unknown",
          },
          cabinet
        );
        
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
                  {categories.map((category) => (
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
                <PesoIcon size={10} className="text-yellow-600" />
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
                  <SelectItem value="price"><span className="flex items-center gap-2"><PesoIcon size={14} /> Price</span></SelectItem>
                  <SelectItem value="category"><span className="flex items-center gap-2"><Folder size={14} /> Category</span></SelectItem>
                  <SelectItem value="lastRestock"><span className="flex items-center gap-2"><Calendar size={14} /> Last Restock</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Restock date range (From / To) */}
            <div className="space-y-2 rounded-md border border-purple-200/80 bg-purple-50/40 p-2">
              <label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                <Calendar size={10} className="text-purple-600" />
                Last restock date
              </label>
              <p className="text-[10px] text-gray-600 leading-snug">
                Filters by last restock time (falls back to last updated if never restocked). Set From and/or To, then Apply.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-600 w-9 shrink-0">From</span>
                  <Input
                    type="date"
                    value={tempDateFilter.startDate}
                    onChange={(e) => setTempDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="h-7 flex-1 border-2 focus:border-purple-500 text-xs px-2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-600 w-9 shrink-0">To</span>
                  <Input
                    type="date"
                    value={tempDateFilter.endDate}
                    onChange={(e) => setTempDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="h-7 flex-1 border-2 focus:border-purple-500 text-xs px-2"
                  />
                </div>
                <div className="flex gap-1 pt-0.5">
                  <Button
                    type="button"
                    onClick={applyDateFilter}
                    size="sm"
                    className="flex-1 h-7 bg-[oklch(0.65_0.22_280)] hover:bg-[oklch(0.55_0.20_280)] text-white text-xs"
                  >
                    <Check size={10} className="mr-1" />
                    Apply
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => {
                      setTempDateFilter({ startDate: "", endDate: "" })
                      setDateFilter({ startDate: "", endDate: "" })
                      addToast("Date filter cleared", "info")
                    }}
                  >
                    Clear
                  </Button>
                </div>
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
                    setDateFilter({ startDate: "", endDate: "" })
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
                    setDateFilter({ startDate: "", endDate: "" })
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
                    setDateFilter({ startDate: localDateString, endDate: localDateString })
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                <div className="mt-4 flex items-center justify-between">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input placeholder="Search inventory by name, SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-8 text-sm" />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="h-8 px-3 rounded-md border-2 border-[#3B18DA] hover:bg-[#3B18DA]/10 text-[#3B18DA] text-xs font-medium"
                    title="Toggle filters panel"
                  >
                    <div className="flex items-center gap-1">
                      <Filter size={12} className="text-[#3B18DA]" />
                      Filters
                      {(selectedCategory !== "all" || stockFilter !== "all" || (priceRangeFilter.min || priceRangeFilter.max) || (dateFilter.startDate || dateFilter.endDate) || searchQuery !== "") && (
                        <span className="w-2 h-2 bg-[#3B18DA] rounded-full animate-pulse"></span>
                      )}
                    </div>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto relative rounded-md border border-border">
                  <table className="w-full min-w-[1280px]">
                    <thead className="border-b-2 border-border bg-muted/60 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                      <tr>
                        <th className={`${INV_TH} text-left`}>SKU</th>
                        <th className={`${INV_TH} w-[5.5rem] text-center`}>Photo</th>
                        <th className={`${INV_TH} text-left`}>Name</th>
                        <th className={`${INV_TH} text-left`}>Description</th>
                        <th className={`${INV_TH} text-left`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="-ml-2 h-9 gap-1 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/80"
                              >
                                Category
                                <ArrowUpDown size={14} className="ml-0.5 shrink-0 opacity-70" />
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
                        <th className={`${INV_TH} text-center`}>Stock</th>
                        <th className={`${INV_TH} text-center`}>Current Unit Cost</th>
                        <th className={`${INV_TH} text-center`}>Current Selling Price</th>
                        <th className={`${INV_TH} text-center`}>Profit Amount</th>
                        <th className={`${INV_TH} text-center`}>Capital ₱</th>
                        <th className={`${INV_TH} text-center`}>L×W×H (cm)</th>
                        <th className={`${INV_TH} text-center`}>Weight (kg)</th>
                        <th className={`${INV_TH} text-center`}>Purchase Date</th>
                        <th className={`${INV_TH} text-center`}>Place of Purchase</th>
                        <th className={`${INV_TH} text-center`}>Supplier</th>
                        <th className={`${INV_TH} text-center`}>Created by</th>
                        <th className={`${INV_TH} text-center`}>Date created</th>
                        <th className={`${INV_TH} text-center`}>Last updated by</th>
                        <th className={`${INV_TH} text-center`}>Last modified</th>
                        <th className={`${INV_TH} text-center`}>Last Restock</th>
                        <th className={`${INV_TH} text-center`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredInventory.length === 0 ? (
                          <tr>
                            <td colSpan={19} className="py-12 text-center">
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
                            <tr key={item.id} className="border-b border-border/60 transition-colors hover:bg-muted/40">
                              <td className="py-3.5 px-4 text-left text-sm text-muted-foreground">{item.sku}</td>
                              <td className="py-3.5 px-3 text-center align-middle">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    className="mx-auto h-[80px] w-[80px] rounded-md object-cover ring-1 ring-border"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-left text-sm font-medium text-foreground">{item.name}</td>
                              <td className="max-w-xs truncate py-3.5 px-4 text-left text-sm text-muted-foreground" title={item.description || ""}>
                                {item.description || "-"}
                              </td>
                              <td className="py-3.5 px-4 text-sm text-muted-foreground">
                                <div className="flex flex-wrap gap-1">
                                  <span className="rounded-md bg-[#3B18DA]/10 px-2 py-0.5 text-xs font-medium text-[#3B18DA] ring-1 ring-[#3B18DA]/15">
                                    {item.category}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-flex min-w-[1.75rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    item.stock === 0
                                      ? "bg-red-100 text-red-700"
                                      : item.stock < 20
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-primary/15 text-primary"
                                  }`}
                                >
                                  {item.stock}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center text-sm font-bold tabular-nums text-foreground">
                                <BatchPriceDisplay
                                  productId={String(item.id)}
                                  cabinet={cabinet}
                                  metric="unitCost"
                                  className="text-sm font-bold text-foreground"
                                />
                              </td>
                              <td className="py-3.5 px-4 text-center text-sm font-bold tabular-nums text-foreground">
                                <BatchPriceDisplay
                                  productId={String(item.id)}
                                  cabinet={cabinet}
                                  metric="price"
                                  className="text-sm font-bold text-foreground"
                                />
                              </td>
                              <td className="py-3.5 px-4 text-center text-sm font-bold tabular-nums text-foreground">
                                <BatchPriceDisplay
                                  productId={String(item.id)}
                                  cabinet={cabinet}
                                  metric="profit"
                                  className="text-sm font-bold text-foreground"
                                />
                              </td>
                              <td className="py-3.5 px-4 text-center text-sm font-bold tabular-nums text-foreground">
                                ₱{((Number(item.stock) || 0) * (Number(item.costPrice) || 0)).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="whitespace-nowrap py-3.5 px-3 text-center text-xs tabular-nums text-muted-foreground">
                                {(() => {
                                  const dims = [];
                                  if (item.dimLengthCm != null && item.dimLengthCm.toString().trim() !== '') dims.push(`${item.dimLengthCm}L`);
                                  if (item.dimWidthCm != null && item.dimWidthCm.toString().trim() !== '') dims.push(`${item.dimWidthCm}W`);
                                  if (item.dimHeightCm != null && item.dimHeightCm.toString().trim() !== '') dims.push(`${item.dimHeightCm}H`);
                                  return dims.length > 0 ? dims.join(" × ") : "—";
                                })()}
                              </td>
                              <td className="py-3.5 px-3 text-center text-xs tabular-nums text-muted-foreground">
                                {item.weightKg != null
                                  ? Number(item.weightKg).toLocaleString("en-PH", { maximumFractionDigits: 3 })
                                  : "—"}
                              </td>
                              <td className="whitespace-nowrap py-3.5 px-3 text-center text-xs tabular-nums text-muted-foreground">
                                {item.purchaseDate ? formatInventoryMMDDYY(item.purchaseDate) : "—"}
                              </td>
                              <td className="py-3.5 px-3 text-center text-xs text-muted-foreground">
                                {item.purchasePlace || "—"}
                              </td>
                              <td className="py-3.5 px-3 text-center text-xs text-muted-foreground">
                                {item.supplierName || "—"}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                {item.createdBy ? (
                                  <span
                                    className="inline-block max-w-[7.5rem] truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border"
                                    title={item.createdBy}
                                  >
                                    {item.createdBy}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap py-3.5 px-3 text-center text-xs tabular-nums text-muted-foreground">
                                {item.dateCreated ? formatInventoryMMDDYY(item.dateCreated) : "—"}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                {item.lastUpdatedBy ? (
                                  <span
                                    className="inline-block max-w-[7.5rem] truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border"
                                    title={item.lastUpdatedBy}
                                  >
                                    {item.lastUpdatedBy}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap py-3.5 px-3 text-center text-xs tabular-nums text-muted-foreground">
                                {item.lastModifiedDate ? formatInventoryMMDDYY(item.lastModifiedDate) : "—"}
                              </td>
                              <td className="whitespace-nowrap py-3.5 px-4 text-center text-xs tabular-nums text-muted-foreground">
                                {item.lastRestockDate ? formatInventoryMMDDYY(item.lastRestockDate) : "—"}
                              </td>
                              <td className="py-3.5 px-4 text-center">
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

    <Dialog 
      open={showAddForm} 
      onOpenChange={(open) => {
        setShowAddForm(open);
        if (!open) {
          setIsSavingProduct(false);
          setIsUploadingImage(false);
        }
      }}
    >
      <DialogContent className="max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Add New Product
          </DialogTitle>
          <DialogDescription>
            Complete all required fields to add a product. You can add more stock later from the inventory row actions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="rounded-xl border-2 border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-background to-indigo-50/50 p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold tracking-tight text-blue-900">Product information</h3>
            <p className="mb-5 text-xs text-muted-foreground">
              Fields marked <span className="text-destructive font-semibold">*</span> are required. All other fields are optional.
            </p>
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-900">
                    SKU <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. FUNKO-001"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className={ADD_PRODUCT_FIELD_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-900">
                    Product name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="Product display name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className={ADD_PRODUCT_FIELD_CLASS}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-900">
                    Acquired price (₱) per unit <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    placeholder="Your unit cost"
                    value={newProduct.costPrice || ""}
                    onChange={(e) => setNewProduct({ ...newProduct, costPrice: parseFloat(e.target.value) || 0 })}
                    className={ADD_PRODUCT_FIELD_CLASS}
                    step="0.01"
                    min="0.01"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-900">
                    Selling price (₱) <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newProduct.price || ""}
                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                    className={ADD_PRODUCT_FIELD_CLASS}
                    step="0.01"
                    min="0.01"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-900">
                    Date of purchase <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={newProduct.purchaseDate}
                    onChange={(e) => setNewProduct({ ...newProduct, purchaseDate: e.target.value })}
                    className={ADD_PRODUCT_FIELD_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-900">
                    Place of purchase <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="Store, city, or URL"
                    value={newProduct.purchasePlace}
                    onChange={(e) => setNewProduct({ ...newProduct, purchasePlace: e.target.value })}
                    className={ADD_PRODUCT_FIELD_CLASS}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-900">
                    Initial quantity <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={initialStock.quantity}
                    onChange={(e) => setInitialStock({ ...initialStock, quantity: parseInt(e.target.value, 10) || 1 })}
                    className={ADD_PRODUCT_FIELD_CLASS}
                    min="1"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-900">
                    Category <span className="text-destructive">*</span>
                  </label>
                  <Select value={newProduct.category} onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}>
                    <SelectTrigger className={ADD_PRODUCT_FIELD_CLASS}>
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
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-blue-900">Supplier / seller (optional)</label>
                <Input
                  placeholder="Vendor name"
                  value={newProduct.supplierName}
                  onChange={(e) => setNewProduct({ ...newProduct, supplierName: e.target.value })}
                  className={ADD_PRODUCT_FIELD_CLASS}
                />
              </div>
              <div className="rounded-lg border border-dashed border-blue-200/80 bg-background/80 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-900/80">
                  Item dimensions and weight (optional)
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-blue-800">Length (cm)</label>
                    <Input
                      type="number"
                      value={newProduct.dimLengthCm}
                      onChange={(e) => setNewProduct({ ...newProduct, dimLengthCm: e.target.value })}
                      className={ADD_PRODUCT_FIELD_CLASS}
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-blue-800">Width (cm)</label>
                    <Input
                      type="number"
                      value={newProduct.dimWidthCm}
                      onChange={(e) => setNewProduct({ ...newProduct, dimWidthCm: e.target.value })}
                      className={ADD_PRODUCT_FIELD_CLASS}
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-blue-800">Height (cm)</label>
                    <Input
                      type="number"
                      value={newProduct.dimHeightCm}
                      onChange={(e) => setNewProduct({ ...newProduct, dimHeightCm: e.target.value })}
                      className={ADD_PRODUCT_FIELD_CLASS}
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-blue-800">Weight (kg)</label>
                    <Input
                      type="number"
                      value={newProduct.weightKg}
                      onChange={(e) => setNewProduct({ ...newProduct, weightKg: e.target.value })}
                      className={ADD_PRODUCT_FIELD_CLASS}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-blue-900">Product photo (optional)</label>
                {!newProduct.imageUrl ? (
                  <div className="relative group rounded-md border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-100/50 transition-all">
                    <div className="px-4 py-6 text-center focus-within:ring-2 focus-within:ring-blue-500 rounded-md">
                      <ImagePlus className="mx-auto h-8 w-8 text-blue-400 group-hover:text-blue-600 mb-2 transition-colors" />
                      <p className="text-sm font-medium text-blue-900">Click to upload an image</p>
                      <p className="text-xs text-blue-600/70 mt-1">PNG, JPG, WEBP (auto compressed)</p>
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={isSavingProduct || isUploadingImage}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        setIsUploadingImage(true)
                        try {
                          const url = await compressImageFileToDataUrl(f, 420, 0.82)
                          setNewProduct((p) => ({ ...p, imageUrl: url }))
                          addToast("Image attached", "success")
                        } catch (err: any) {
                          addToast(err?.message || "Could not process image", "error")
                        } finally {
                          setIsUploadingImage(false)
                        }
                        e.target.value = ""
                      }}
                    />
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between p-3 border rounded-md shadow-sm ring-1 ring-border bg-slate-50/30">
                    <div className="flex items-center gap-3">
                      <img src={newProduct.imageUrl} alt="" className="h-20 w-20 rounded-md border object-cover bg-white shadow-sm" />
                      <div className="flex flex-col text-sm">
                        <span className="font-medium text-slate-800">1 image attached</span>
                        <span className="text-xs text-slate-500">Max capacity reached</span>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setNewProduct((p) => ({ ...p, imageUrl: "" }))}>
                      <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-blue-900">Product details (optional)</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => {
                    if (e.target.value.length <= 2000) {
                      setNewProduct({ ...newProduct, description: e.target.value })
                    }
                  }}
                  placeholder="Description, condition, notes…"
                  className={`min-h-[96px] w-full resize-y rounded-md px-3 py-2.5 text-sm ${ADD_PRODUCT_FIELD_CLASS}`}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground">{newProduct.description.length}/2000 characters</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button disabled={isSavingProduct || isUploadingImage} onClick={() => setShowAddForm(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={isSavingProduct || isUploadingImage} onClick={handleAddProduct} className="bg-[#3B18DA] hover:bg-[#2A1199] text-white">
              {isSavingProduct || isUploadingImage ? <Spinner className="mr-2" /> : <Plus size={16} className="mr-2" />}
              {isUploadingImage ? "Compressing Image..." : isSavingProduct ? "Adding Product..." : "Add Product"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={editingId !== null}
      onOpenChange={(open) => {
        if (!open) {
          setEditingId(null)
          setEditingProduct(null)
        }
      }}
    >
      <DialogContent className="mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Update product details</DialogDescription>
        </DialogHeader>
        {editingProduct && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Name</label>
              <Input
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 flex items-center justify-between">
                  SKU
                  <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded mr-1">Not editable</span>
                </label>
                <Input
                  value={editingProduct.sku || ""}
                  disabled
                  onChange={(e) => {}}
                  className="bg-muted text-muted-foreground cursor-not-allowed border-muted-foreground/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 flex items-center justify-between">
                  Stock (units)
                  <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">Not editable</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editingProduct.stock}
                  disabled
                  onChange={() => {}}
                  className="bg-muted text-muted-foreground cursor-not-allowed border-muted-foreground/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Selling price (₱)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editingProduct.price}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 flex items-center justify-between">
                  Acquired price (₱)
                  <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">Not editable</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editingProduct.costPrice ?? 0}
                  disabled
                  onChange={() => {}}
                  className="bg-muted text-muted-foreground cursor-not-allowed border-muted-foreground/20"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Est. capital (stock × acquired)</label>
              <p className="text-sm font-semibold tabular-nums">
                ₱
                {((Number(editingProduct.stock) || 0) * (Number(editingProduct.costPrice) || 0)).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 flex items-center justify-between">
                  Purchase date
                  <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">Not editable</span>
                </label>
                <Input
                  type="date"
                  value={editingProduct.purchaseDate || ""}
                  disabled
                  onChange={() => {}}
                  className="bg-muted text-muted-foreground cursor-not-allowed border-muted-foreground/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 flex items-center justify-between">
                  Place of purchase
                  <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">Not editable</span>
                </label>
                <Input
                  value={editingProduct.purchasePlace || ""}
                  disabled
                  onChange={() => {}}
                  className="bg-muted text-muted-foreground cursor-not-allowed border-muted-foreground/20"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 flex items-center w-fit gap-2">
                Supplier
                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Not editable</span>
              </label>
              <Input
                value={editingProduct.supplierName || ""}
                disabled
                onChange={() => {}}
                className="bg-muted text-muted-foreground cursor-not-allowed border-muted-foreground/20"
              />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">Item dimensions and weight</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  ["dimLengthCm", "Length (cm)"],
                  ["dimWidthCm", "Width (cm)"],
                  ["dimHeightCm", "Height (cm)"],
                  ["weightKg", "Weight (kg)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(editingProduct as any)[key] ?? ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        [key]: e.target.value === "" ? undefined : parseFloat(e.target.value),
                      } as InventoryItem)
                    }
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Photo (optional)</label>
              {!editingProduct.imageUrl ? (
                <div className="relative group rounded-md border-2 border-dashed border-muted hover:border-primary bg-muted/30 hover:bg-muted/50 transition-all mb-2">
                  <div className="px-4 py-5 text-center focus-within:ring-2 focus-within:ring-primary rounded-md">
                    <ImagePlus className="mx-auto h-6 w-6 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
                    <p className="text-sm font-medium text-foreground">Click to upload photo</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP (auto compressed)</p>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={isSavingProduct || isUploadingImage}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f || !editingProduct) return
                      setIsUploadingImage(true)
                      try {
                        const url = await compressImageFileToDataUrl(f, 420, 0.82)
                        setEditingProduct({ ...editingProduct, imageUrl: url })
                        addToast("Image updated", "success")
                      } catch (err: any) {
                        addToast(err?.message || "Could not process image", "error")
                      } finally {
                        setIsUploadingImage(false)
                      }
                      e.target.value = ""
                    }}
                  />
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between p-3 border rounded-md shadow-sm ring-1 ring-border bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <img src={editingProduct.imageUrl} alt="" className="h-14 w-14 rounded-md border object-cover bg-white shadow-sm" />
                    <div className="flex flex-col text-sm">
                      <span className="font-medium text-slate-800">1 image attached</span>
                      <span className="text-xs text-slate-500">Max capacity reached</span>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingProduct({ ...editingProduct, imageUrl: undefined })}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                  </Button>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Category</label>
              <Select
                value={editingProduct.category || ""}
                onValueChange={(value) => setEditingProduct({ ...editingProduct, category: value })}
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
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Product details</label>
              <textarea
                value={editingProduct.description || ""}
                onChange={(e) => {
                  if (e.target.value.length <= 2000) {
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                }}
                className="w-full p-2 border rounded-md resize-y min-h-[80px]"
                maxLength={2000}
              />
              <p className="text-xs text-gray-500 mt-1">{(editingProduct.description || "").length}/2000</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record audit</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Created by</span>
                  <p className="mt-1">
                    {editingProduct.createdBy ? (
                      <span className="inline-block max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                        {editingProduct.createdBy}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last updated by</span>
                  <p className="mt-1">
                    {editingProduct.lastUpdatedBy ? (
                      <span className="inline-block max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                        {editingProduct.lastUpdatedBy}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date created</span>
                  <p className="font-medium">{editingProduct.dateCreated || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last modified</span>
                  <p className="font-medium">{editingProduct.lastModifiedDate || "—"}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button disabled={isSavingProduct || isUploadingImage} onClick={handleSaveEdit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSavingProduct || isUploadingImage ? <Spinner className="mr-2 h-4 w-4" /> : null}
                {isUploadingImage ? "Compressing Image..." : isSavingProduct ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={() => {
                  setEditingId(null)
                  setEditingProduct(null)
                }}
                variant="outline"
              >
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
      <DialogContent className="max-w-3xl mx-4 max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <label className="text-sm font-medium text-green-700 mb-1 block">Acquired Cost (₱) *</label>
                    <Input
                      type="number"
                      value={newStock.costPerUnit}
                      onChange={(e) => setNewStock({ ...newStock, costPerUnit: parseFloat(e.target.value) || 0 })}
                      min="0.01"
                      step="0.01"
                      placeholder="Required"
                      className="border-green-300 focus:border-green-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1 leading-tight">Cost price per unit. Cannot be 0.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-green-700 mb-1 block">Selling Price (₱) *</label>
                    <Input
                      type="number"
                      value={newStock.sellingPrice}
                      onChange={(e) => setNewStock({ ...newStock, sellingPrice: parseFloat(e.target.value) || 0 })}
                      min="0.01"
                      step="0.01"
                      placeholder="Required"
                      className="border-green-300 focus:border-green-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1 leading-tight">Retail price customers pay.</p>
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
                    const age = getStockAge(addition.addedDate)
                    const ageColor = getStockAgeColor(addition.addedDate);
                    const ageLabel = getStockAgeLabel(addition.addedDate)
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
                      {/* Top Row: Info and Actions */}
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <span className="text-xl font-bold tracking-tight text-slate-800">{addition.quantity} <span className="text-sm font-semibold text-slate-500">units</span></span>
                            {/* Current batch indicator */}
                            {index === 0 && hasStock && (
                              <span className="px-2 py-0.5 bg-blue-100/60 border border-blue-200 text-blue-800 text-[10px] font-bold tracking-widest uppercase rounded-full">
                                Current Batch
                              </span>
                            )}
                            {/* Zero stock indicator */}
                            {isZeroStock && (
                              <span className="px-2 py-0.5 bg-red-100/60 border border-red-200 text-red-800 text-[10px] font-bold tracking-widest uppercase rounded-full">
                                Sold Out
                              </span>
                            )}
                          </div>
                          
                          {/* Notes */}
                          {addition.notes && (
                            <p className="text-xs text-slate-500 font-medium">
                              <span className="text-slate-400 mr-1">Note:</span> {addition.notes}
                            </p>
                          )}
                        </div>
                        
                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBatchToDelete(addition)
                            setShowDeleteBatchConfirm(true)
                          }}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                          title="Remove this batch"
                          disabled={isDeletingBatch && batchToDelete?.id === addition.id}
                        >
                          {isDeletingBatch && batchToDelete?.id === addition.id ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </Button>
                      </div>

                      {/* Middle Row: Financial Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1">
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 flex flex-col justify-center">
                          <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-0.5">Acquired</span>
                          <span className="font-mono text-[13px] font-semibold text-slate-700">
                            {addition.costPerUnit != null ? `₱${Number(addition.costPerUnit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                          </span>
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 flex flex-col justify-center">
                          <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-0.5">Retail</span>
                          <span className="font-mono text-[13px] font-bold text-slate-900">
                            {addition.sellingPrice != null 
                              ? `₱${Number(addition.sellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                              : (selectedProductForStock?.price != null 
                                  ? `₱${Number(selectedProductForStock.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                  : 'N/A')}
                          </span>
                        </div>

                        <div className="bg-blue-50/40 border border-blue-100 rounded-md p-2.5 flex flex-col justify-center">
                          <span className="text-[10px] uppercase text-blue-500/80 font-bold tracking-widest mb-0.5">Capital Used</span>
                          <span className="font-mono text-[13px] font-bold text-blue-700">
                            {addition.costPerUnit != null 
                              ? `₱${Number(addition.costPerUnit * (addition.initialQuantity || addition.quantity)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                              : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom row - Status and Date */}
                      <div className="flex items-center justify-between pt-1">
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
                            {ageLabel}
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
