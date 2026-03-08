"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
<<<<<<< HEAD
import { Plus, Edit2, Trash2, ChevronDown, Search, Clock, Filter, Package, Calendar, DollarSign, ArrowUpDown, Zap, AlertTriangle, XCircle, Check, X, Printer, Download } from "lucide-react"
=======
import { Plus, Search, Package, Clock, Trash2, Edit2, Filter, X, Calendar, DollarSign, ArrowUpDown, Zap, Check, AlertTriangle, XCircle, Printer, Download, RefreshCw } from "lucide-react"
>>>>>>> clean-branch
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProducts, type Product, type ProductLocation } from "@/contexts/products-context"
import { useToast } from "@/contexts/toast-context"
import { useActivity } from "@/contexts/activity-context"
import { validateProductForm } from "@/utils/validation"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
  
  // Loading states for operations
  const [isAddingStock, setIsAddingStock] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null)
  const [isLoadingStock, setIsLoadingStock] = useState(false)
  // Advanced filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
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
  const [priceFilter, setPriceFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
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
                      priceFilter !== "all" ||
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
    setPriceFilter("all")
    setSortBy("name")
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
            <p><strong>Cabinet:</strong> ${cabinet.charAt(0).toUpperCase() + cabinet.slice(1)}</p>
            <p><strong>Total Items:</strong> ${filteredInventory.length}</p>
            <p><strong>Filters Applied:</strong> ${[
              selectedCategory !== "all" ? `Category: ${selectedCategory}` : null,
              stockFilter !== "all" ? `Stock: ${stockFilter}` : null,
              priceFilter !== "all" ? `Price: ${priceFilter}` : null,
              searchQuery ? `Search: ${searchQuery}` : null
            ].filter(Boolean).join(', ') || 'None'}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Price</th>
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
                  <td>₱${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>${item.lastRestockDate || 'No restocks'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
      addToast("Print dialog opened", "success");
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const headers = ['SKU', 'Product Name', 'Description', 'Category', 'Stock', 'Price', 'Last Restock'];
    const data = filteredInventory.map(item => [
      item.sku,
      item.name,
      item.description || '',
      item.category,
      item.stock.toString(),
      item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
    
    // Price filter
    const matchesPrice = priceFilter === "all" || (() => {
      const price = item.price;
      switch (priceFilter) {
        case "under-100": return price < 100;
        case "100-500": return price >= 100 && price < 500;
        case "500-1000": return price >= 500 && price < 1000;
        case "1000-5000": return price >= 1000 && price < 5000;
        case "5000-plus": return price >= 5000;
        default: return true;
      }
    })();
    
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
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "stock": return b.stock - a.stock;
        case "price": return a.price - b.price;
        case "category": return a.category.localeCompare(b.category);
        case "lastRestock":
          const aDate = new Date(a.lastRestockDate || "1970-01-01");
          const bDate = new Date(b.lastRestockDate || "1970-01-01");
          return bDate.getTime() - aDate.getTime();
        default: return 0;
      }
    });

  // Check if filters are applied and show toast if results are empty
  const hasActiveFilters = selectedCategory !== "all" || 
                          stockFilter !== "all" || 
                          (dateFilter.startDate || dateFilter.endDate) || 
                          dateFilter.year !== "all" || 
                          priceFilter !== "all" ||
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
    setDeleteConfirm({ open: true, id })
  }

  // Open stock dialog and fetch fresh data
  const openStockDialog = async (product: Product) => {
    try {
      setIsLoadingStock(true)
      setSelectedProductForStock(product)
      
      // Always fetch fresh stock data from server
      const response = await fetch(`/api/stock-batches?productId=${product.id}&cabinet=${cabinet}`)
      if (response.ok) {
        const additions = await response.json()
        console.log('Fresh stock data loaded:', additions.map((a: any) => ({id: a.id, quantity: a.quantity})));
        setStockAdditions(additions)
      } else {
        // If no batches exist, set empty array
        setStockAdditions([])
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
    console.log('handleDeleteBatch called with batchId:', batchId);
    console.log('Current stockAdditions in state:', stockAdditions.map(s => ({id: s.id, quantity: s.quantity})));
    console.log('batchToDelete:', batchToDelete);
    console.log('selectedProductForStock:', selectedProductForStock?.name);
    
    if (!batchId || !selectedProductForStock) {
      console.log('Early return - batchId:', batchId, 'selectedProductForStock:', !!selectedProductForStock);
      return
    }

    try {
      setIsDeletingBatch(true)
      
      // Delete the batch via API
      const response = await fetch(`/api/stock-batches/${batchId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete batch')
      }

      // Update local state to reflect the change
      setStockAdditions(prev => prev.filter(batch => batch.id !== batchId))
      
      // Find the deleted batch to get its quantity for stock calculation
      const deletedBatch = stockAdditions.find(batch => batch.id === batchId)
      if (deletedBatch) {
        // Update product stock locally (will be refreshed from server anyway)
        const updatedStock = Math.max(0, (selectedProductForStock.stock || 0) - deletedBatch.quantity)
        
        // Update the selected product state to show real-time stock decrease
        setSelectedProductForStock({
          ...selectedProductForStock,
          stock: updatedStock
        })
        
        addToast(`Removed batch of ${deletedBatch.quantity} units from ${selectedProductForStock.name}`, "success")
        
        addActivity({
          username: username || "Unknown User",
          activity: "Removed stock batch",
          details: `Removed batch of ${deletedBatch.quantity} units from '${selectedProductForStock.name}' (SKU: ${selectedProductForStock.sku || 'N/A'}) in ${cabinet} cabinet - New stock: ${updatedStock} units`,
          category: "product"
        })
      }

      // Refresh the products data to get updated stock
      refetch()
      
    } catch (error) {
      console.error('Error deleting batch:', error)
      addToast(error instanceof Error ? error.message : 'Failed to delete batch', 'error')
    } finally {
      setIsDeletingBatch(false)
      setShowDeleteBatchConfirm(false)
      setBatchToDelete(null)
    }
  }

  // Update batch status function
  const handleUpdateBatchStatus = async (batchId: string, newStatus: string) => {
    try {
      setIsUpdatingStatus(batchId)
      
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
      addToast(error instanceof Error ? error.message : 'Failed to update batch status', 'error')
    } finally {
      setIsUpdatingStatus(null)
    }
  }

  const handleAddStock = async () => {
    if (!selectedProductForStock) return

    // Frontend validation
    const validationErrors = []

    // Validate quantity
    if (!newStock.quantity || newStock.quantity <= 0) {
      validationErrors.push('Quantity must be greater than 0')
    }
    
    if (newStock.quantity > 10000) {
      validationErrors.push('Quantity cannot exceed 10,000 units')
    }

    if (!Number.isInteger(newStock.quantity)) {
      validationErrors.push('Quantity must be a whole number')
    }

    // Validate cost per unit
    if (newStock.costPerUnit < 0) {
      validationErrors.push('Cost per unit cannot be negative')
    }

<<<<<<< HEAD
=======
    if (newStock.costPerUnit === 0) {
      validationErrors.push('Cost per unit cannot be 0')
    }

>>>>>>> clean-branch
    if (newStock.costPerUnit > 999999.99) {
      validationErrors.push('Cost per unit cannot exceed $999,999.99')
    }

    // Check for decimal places in cost
    if (newStock.costPerUnit && !Number.isFinite(newStock.costPerUnit)) {
      validationErrors.push('Cost per unit must be a valid number')
    }

    if (validationErrors.length > 0) {
      addToast(validationErrors.join('; '), 'error')
      return
    }

    try {
      setIsAddingStock(true)
      
      // Add stock batch using the proper API
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
      
      // Refresh stock additions
      const refreshResponse = await fetch(`/api/stock-batches?productId=${selectedProductForStock.id}&cabinet=${cabinet}`)
      if (refreshResponse.ok) {
        const additions = await refreshResponse.json()
        setStockAdditions(additions)
      }
      
      // Force refresh the products list to get updated stock calculations
      await refetch()
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

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      const productToDelete = products.find(p => p.id === deleteConfirm.id)
      deleteProduct(deleteConfirm.id, cabinet)
      
      addActivity({
        username: username || "Unknown User",
        activity: "Deleted product",
        details: `Removed '${productToDelete?.name}' (SKU: ${productToDelete?.sku || 'N/A'}) from ${cabinet} cabinet - Category: ${productToDelete?.category || 'N/A'}`,
        category: "product"
      })
      
      addToast("Product deleted successfully!", "success")
      setDeleteConfirm({ open: false, id: null })
    }
  }

  const handleAddProduct = async () => {
    console.log('Submitting product:', newProduct);
    console.log('Initial stock:', initialStock);
    
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
              <Filter size={14} className="text-blue-600" />
              <h3 className="font-semibold text-gray-800 text-sm">Filters</h3>
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">
                {[selectedCategory !== "all" ? 1 : 0, stockFilter !== "all" ? 1 : 0, (dateFilter.startDate || dateFilter.endDate) ? 1 : 0, priceFilter !== "all" ? 1 : 0, searchQuery !== "" ? 1 : 0].reduce((a, b) => a + b, 0)}
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
                  <SelectItem value="all">🌐 All Categories</SelectItem>
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
                  <SelectItem value="all">� All Stock</SelectItem>
                  <SelectItem value="low">⚠️ Low Stock (&lt;20)</SelectItem>
                  <SelectItem value="out">❌ Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <DollarSign size={10} className="text-orange-600" />
                Price Range
              </label>
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="h-7 border-2 focus:border-orange-500 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="under-100">&lt;₱100</SelectItem>
                  <SelectItem value="100-500">₱100 - ₱500</SelectItem>
                  <SelectItem value="500-1000">₱500 - ₱1,000</SelectItem>
                  <SelectItem value="1000-5000">₱1,000 - ₱5,000</SelectItem>
                  <SelectItem value="5000-plus">₱5,000+</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="name">📝 Product Name</SelectItem>
                  <SelectItem value="stock">📊 Stock Level</SelectItem>
                  <SelectItem value="price">💰 Price</SelectItem>
                  <SelectItem value="category">📁 Category</SelectItem>
                  <SelectItem value="lastRestock">📅 Last Restock</SelectItem>
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
                    setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" })
                    setTempDateFilter({ startDate: "", endDate: "" })
                    setPriceFilter("all")
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
                    setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" })
                    setTempDateFilter({ startDate: "", endDate: "" })
                    setPriceFilter("all")
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
                    setDateFilter({ year: "all", month: "all", day: "all", startDate: localDateString, endDate: localDateString })
                    setTempDateFilter({ startDate: localDateString, endDate: localDateString })
                    setPriceFilter("all")
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by product name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-8 text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="h-8 px-3 rounded-md border-2 border-blue-300 hover:bg-blue-50 text-blue-700 text-xs font-medium"
                  title="Toggle filters panel"
                >
                  <div className="flex items-center gap-1">
                    <Filter size={12} />
                    Filters
                    {(selectedCategory !== "all" || stockFilter !== "all" || (dateFilter.startDate || dateFilter.endDate) || dateFilter.year !== "all" || priceFilter !== "all") && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    )}
                  </div>
                </Button>
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
                {isAdmin && (
                  <Button
                    onClick={() => setShowAddForm(true)}
                    className="h-8 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg text-xs"
                  >
                    <Plus size={14} className="mr-1" />
                    Add Product
                  </Button>
                )}
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
              </CardHeader>
              <CardContent>
                {filteredInventory.length === 0 ? (
                  <EmptyState
                    icon="📦"
                    title="No products found"
                    description={searchQuery ? "Try adjusting your search criteria" : "Start by adding your first product"}
                    action={{ label: "Add Product", onClick: () => setShowAddForm(true) }}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold text-foreground">SKU</th>
                          <th className="py-3 px-4 text-left font-semibold text-foreground">Product Name</th>
                          <th className="py-3 px-4 text-left font-semibold text-foreground">Description</th>
                          <th className="py-3 px-4 text-left font-semibold text-foreground">Last Restock</th>
                          <th className="py-3 px-4 text-left font-semibold text-foreground">Stock</th>
                          <th className="py-3 px-4 text-left font-semibold text-foreground">Price</th>
                          <th className="py-3 px-4 text-left font-semibold text-foreground">Category</th>
                          <th className="py-3 px-4 text-center font-semibold text-foreground">Edit</th>
                          <th className="py-3 px-4 text-center font-semibold text-foreground">Batches</th>
                          <th className="py-3 px-4 text-center font-semibold text-foreground">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredInventory.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 text-muted-foreground text-sm">{item.sku}</td>
                            <td className="py-3 px-4 text-foreground font-medium">{item.name}</td>
                            <td className="py-3 px-4 text-muted-foreground text-sm max-w-xs truncate" title={item.description || ''}>
                              {item.description || '-'}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {item.lastRestockDate || 'No restocks'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                            <td className="py-3 px-4 text-muted-foreground text-sm font-medium">₱{item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">{item.category}</td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:bg-primary/10"
                                onClick={() => handleEditProduct(item)}
                                title="Edit Product"
                              >
                                <Edit2 size={16} />
                              </Button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:bg-blue-10"
                                onClick={() => openStockDialog(item)}
                                title="View Stock Tracking"
                              >
                                <Clock size={16} />
                              </Button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(item.id)}
                                title="Delete Product"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
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
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Product description (optional)..."
                    className="w-full p-2 border rounded-md resize-none h-20 border-blue-300 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowAddForm(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleAddProduct} className="bg-blue-600 hover:bg-blue-700">
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
                  onChange={(e) => setEditingProduct(editingProduct ? { ...editingProduct, description: e.target.value } : null)}
                  placeholder="Product description..."
                  className="w-full p-2 border rounded-md resize-none h-20"
                />
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

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />

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
<<<<<<< HEAD
                      <label className="text-sm font-medium text-green-700 mb-1 block">Cost per Unit (₱)</label>
=======
                      <label className="text-sm font-medium text-green-700 mb-1 block">Cost per Unit (₱) *</label>
>>>>>>> clean-branch
                      <Input
                        type="number"
                        value={newStock.costPerUnit}
                        onChange={(e) => setNewStock({ ...newStock, costPerUnit: parseFloat(e.target.value) || 0 })}
<<<<<<< HEAD
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="border-green-300 focus:border-green-500"
                      />
=======
                        min="0.01"
                        step="0.01"
                        placeholder="Enter cost per unit (required)"
                        className="border-green-300 focus:border-green-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the actual cost price per unit (cannot be 0)</p>
>>>>>>> clean-branch
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-green-700 mb-1 block">Notes</label>
                    <Input
                      value={newStock.notes}
                      onChange={(e) => setNewStock({ ...newStock, notes: e.target.value })}
                      placeholder="e.g., New shipment, Restock"
                      className="border-green-300 focus:border-green-500"
                    />
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
                      <div key={addition.id} className={`bg-white border rounded-lg p-5 shadow-sm space-y-3 ${
                        index === 0 ? 'border-blue-500 border-2' : 'border-gray-200'
                      }`}>
                        {/* Top row - Main info */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Quantity */}
                            <span className="font-semibold text-lg">{addition.quantity} units</span>
                            
                            {/* Price */}
                            {addition.costPerUnit && addition.costPerUnit > 0 && (
                              <span className="text-sm text-green-600">
                                ₱{addition.costPerUnit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                            
                            {/* Current batch indicator */}
                            {index === 0 && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                Current Batch
                              </span>
                            )}
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
<<<<<<< HEAD
                                index === 0 ? 'bg-green-500' : 'bg-blue-500'
=======
                                Number(addition.quantity) === 0 
                                  ? 'bg-red-500' 
                                  : addition.status === 'on-shelf' 
                                    ? 'bg-green-500' 
                                    : 'bg-blue-500'
>>>>>>> clean-branch
                              }`} />
                              {isUpdatingStatus === addition.id ? (
                                <div className="flex items-center gap-2">
                                  <Spinner className="size-3" />
                                  <span className="text-sm text-gray-500">Updating...</span>
                                </div>
<<<<<<< HEAD
                              ) : (
                                <select
                                  value={index === 0 ? 'on-shelf' : 'in-storage'}
=======
                              ) : Number(addition.quantity) === 0 ? (
                                <span className="text-sm text-red-400 italic">Unavailable</span>
                              ) : (
                                <select
                                  value={addition.status || 'in-storage'}
>>>>>>> clean-branch
                                  onChange={(e) => handleUpdateBatchStatus(addition.id, e.target.value)}
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
                        
                        {/* Notes (only if present) */}
                        {addition.notes && (
                          <p className="text-sm text-gray-500 italic pt-2 border-t border-gray-100">
                            "{addition.notes}"
                          </p>
                        )}
                      </div>
                      )
                    })}
                    
                    {/* Summary Card */}
<<<<<<< HEAD
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-blue-600 font-medium">Total Stock</p>
                          <p className="text-xs text-blue-500">All batches combined</p>
                        </div>
                        <span className="text-2xl font-bold text-blue-700">
=======
                    <div className="bg-gradient-to-r from-[oklch(0.2_0.02_280)] to-[oklch(0.15_0.02_280)] border border-[oklch(0.3_0.05_280)] rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-[oklch(0.85_0.05_280)] font-medium">Total Stock</p>
                          <p className="text-xs text-[oklch(0.7_0.03_280)]">All batches combined</p>
                        </div>
                        <span className="text-2xl font-bold text-white">
>>>>>>> clean-branch
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
          if (batchToDelete && batchToDelete.id) {
            const batchId = String(batchToDelete.id); // Ensure it's a string
            console.log('Calling handleDeleteBatch with:', batchId);
            handleDeleteBatch(batchId)
          } else {
            console.log('batchToDelete is null/undefined or has no id');
            // Fallback: try to get the ID from the first batch if available
            if (stockAdditions.length > 0) {
              const fallbackBatchId = String(stockAdditions[0].id);
              console.log('Using fallback batch ID:', fallbackBatchId);
              handleDeleteBatch(fallbackBatchId);
            } else {
              addToast('No batch available to delete', 'error');
            }
          }
        }}
        onCancel={() => {
          setShowDeleteBatchConfirm(false)
          setBatchToDelete(null)
        }}
      />
    </>
  )
}
