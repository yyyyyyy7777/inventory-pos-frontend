"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Filter, Calendar, DollarSign, Package, ArrowUpDown, Store, CreditCard, Archive, Printer, X, Zap, Check } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSales } from "@/contexts/sales-context"
import { useToast } from "@/contexts/toast-context"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"

// Helper function to create short sale ID
const createShortSaleId = (fullId: string): string => {
  const prefix = fullId.substring(0, 8).toUpperCase()
  const suffix = fullId.substring(fullId.length - 4).toUpperCase()
  return `${prefix}-${suffix}`
}

interface SalesViewProps {
  isAdmin: boolean
  cabinet: string
}

const categories = [
  "APEX", "Bag", "Banpresto", "Blokees", "Boardgame", "Book", "Cardgame", "Cards",
  "Cosbaby", "Cosbi", "Crochet", "Die Cast", "Ecobag", "Figure", "Five Star", "Food and Snacks",
  "Funko Bitty", "Funko Dorbz", "Funko Keychain", "Funko Kinder Joy", "Funko Gold", "Funko Minis",
  "Funko Pins", "Funko POP", "Funko Rewind", "Funko Soda", "Funko Wocky Wobbler", "Harry Potter Items",
  "Hoodies", "Keychain", "McFarlane", "Mug", "Minis", "Nendoroid", "Others", "Pez", "Pins",
  "Pop Mart", "Profit", "Protectors", "QFig", "QPosket", "Quiccs", "Resins", "SHFiguarts",
  "Shirts", "Sleeves", "Sorcery Box", "Stickers", "Stuffed Toys", "Toploaders", "ZD Toys"
]

export function SalesView({ isAdmin, cabinet }: SalesViewProps) {
  const { getSalesByCabinet, refreshSales, addUnarchivedSales, archiveSalesInState } = useSales()
  const { addToast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  
  // Advanced filter states
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [dateFilter, setDateFilter] = useState({ 
    year: "all", month: "all", day: "all", startDate: "", endDate: ""
  })
  const [amountFilter, setAmountFilter] = useState("all")
  const [soldAtFilter, setSoldAtFilter] = useState("all")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all")
  const [negotiationFilter, setNegotiationFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date")
  const [timePeriod, setTimePeriod] = useState("all")
  const [showManageArchives, setShowManageArchives] = useState(false)
  const [manageArchiveMonth, setManageArchiveMonth] = useState("")
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })

  const sales = getSalesByCabinet(cabinet)
  
  // Debug: Check discount data in sales
  console.log('Sales discount check:', sales.map(sale => ({
    id: sale.id,
    items: sale.items.map((item: any) => ({
      name: item.productName,
      cartPrice: item.price,
      originalPrice: item.originalPrice,
      isDiscounted: item.isDiscounted,
      shouldBeDiscounted: item.originalPrice ? item.price < item.originalPrice : false
    })),
    hasAnyDiscounted: sale.items.some((item: any) => item.isDiscounted)
  })));

  const toggleSaleExpansion = (saleId: string) => {
    setExpandedSales(prev => {
      const newSet = new Set(prev)
      if (newSet.has(saleId)) {
        newSet.delete(saleId)
      } else {
        newSet.add(saleId)
      }
      return newSet
    })
  }

  // Suppress hydration mismatch warnings
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('Expected \'>\', got \'div\'')) return;
      if (typeof args[0] === 'string' && args[0].includes('fdprocessedid')) return;
      originalConsoleError.apply(console, args);
    };
    return () => { console.error = originalConsoleError; };
  }, []);

  // Print sales list
  const handleViewSaleDetails = (sale: any) => {
    const items = sale.items.map((item: any) => 
      `${item.isDiscounted ? '🏷️ ' : ''}${item.productName} (${item.quantity}x) - ₱${item.price.toLocaleString()}${item.isDiscounted ? ` (was ₱${item.originalPrice?.toLocaleString()})` : ''}`
    ).join('\n');
    
    alert(`Sale Details:\n\nID: ${createShortSaleId(sale.id)}\nDate: ${new Date(sale.date).toLocaleDateString()}\nStaff: ${sale.staffName}\nPayment: ${sale.paymentMethod}\nTotal: ₱${sale.amount.toLocaleString()}\n\nItems:\n${items}`);
  };

  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Sales Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .header-info { margin-bottom: 20px; color: #666; }
            .amount { text-align: right; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Sales Report</h1>
          <div class="header-info">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Cabinet:</strong> ${cabinet.charAt(0).toUpperCase() + cabinet.slice(1)}</p>
            <p><strong>Total Sales:</strong> ${filteredSales.length}</p>
            <p><strong>Total Revenue:</strong> ₱${filteredSales.reduce((sum, sale) => sum + sale.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Sale ID</th><th>Products</th><th>Staff</th>
                <th>Payment Method</th><th>Amount</th><th>Sold At</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSales.map(sale => `
                <tr>
                  <td>${new Date(sale.date).toLocaleDateString()}</td>
                  <td>${createShortSaleId(sale.id)}</td>
                  <td>${sale.items.map(item => `${item.productName} (${item.quantity})`).join(', ')}</td>
                  <td>${sale.staffName}</td>
                  <td>${sale.paymentMethod}</td>
                  <td class="amount">₱${sale.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>${sale.soldAt}</td>
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
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      
      // Set success state after printing
      setExportSuccess(true);
      addToast("Sales report printed successfully!", "success");
    }
  };

  // Export sales to Excel
  const handleExportExcel = () => {
    const headers = ['Date', 'Sale ID', 'Products', 'Staff', 'Payment Method', 'Amount', 'Sold At'];
    const data = filteredSales.map(sale => [
      new Date(sale.date).toLocaleDateString(),
      createShortSaleId(sale.id),
      sale.items.map(item => `${item.productName} (${item.quantity})`).join('; '),
      sale.staffName,
      sale.paymentMethod,
      sale.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      sale.soldAt
    ]);

    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_${cabinet}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Set success state after export
    setExportSuccess(true);
    addToast(`Exported ${filteredSales.length} sales to Excel`, "success");
  };

  const filteredSales = sales
    .filter((sale: any) => {
      const matchesSearch = searchQuery === "" || 
        sale.items.some((item: any) => 
          item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        sale.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        createShortSaleId(sale.id).toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === "all" || 
        sale.items.some((item: any) => item.category === selectedCategory);

      let matchesAmount = true;
      if (amountFilter !== "all") {
        switch (amountFilter) {
          case "0-500": matchesAmount = sale.amount >= 0 && sale.amount <= 500; break;
          case "500-1000": matchesAmount = sale.amount > 500 && sale.amount <= 1000; break;
          case "1000-5000": matchesAmount = sale.amount > 1000 && sale.amount <= 5000; break;
          case "5000-plus": matchesAmount = sale.amount > 5000; break;
        }
      }

      const matchesSoldAt = soldAtFilter === "all" || sale.soldAt === soldAtFilter;
      const matchesPaymentMethod = paymentMethodFilter === "all" || sale.paymentMethod === paymentMethodFilter;
      
      // Negotiation filter
      let matchesNegotiation = true;
      if (negotiationFilter !== "all") {
        const hasDiscountedItems = sale.items.some((item: any) => item.isDiscounted === true);
        if (negotiationFilter === "discounted") {
          matchesNegotiation = hasDiscountedItems;
        } else if (negotiationFilter === "regular") {
          matchesNegotiation = !hasDiscountedItems;
        }
      }

      let matchesDate = true;
      const saleDate = new Date(sale.date);
      
      // Apply time period filtering
      if (timePeriod !== "all") {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (timePeriod) {
          case "today":
            matchesDate = saleDate.toDateString() === today.toDateString();
            break;
          case "week":
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = saleDate >= weekAgo;
            break;
          case "month":
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = saleDate >= monthAgo;
            break;
          case "quarter":
            const quarterAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
            matchesDate = saleDate >= quarterAgo;
            break;
          case "year":
            const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
            matchesDate = saleDate >= yearAgo;
            break;
        }
      }
      
      // Apply custom date range filter
      if (dateFilter.startDate || dateFilter.endDate) {
        if (dateFilter.startDate) matchesDate = matchesDate && saleDate >= new Date(dateFilter.startDate);
        if (dateFilter.endDate) matchesDate = matchesDate && saleDate <= new Date(dateFilter.endDate);
      }

      return matchesSearch && matchesCategory && matchesAmount && matchesSoldAt && matchesPaymentMethod && matchesNegotiation && matchesDate;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case "date": return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "amount": return b.amount - a.amount;
        case "staff": return a.staffName.localeCompare(b.staffName);
        default: return 0;
      }
    });

  const handleExportReport = async () => {
    try {
      // Reset success state and open dialog
      setExportSuccess(false);
      setShowExportDialog(true);
    } catch (error) {
      console.error('Export error:', error);
      addToast("Failed to open export dialog", "error");
    }
  };

  const handleArchiveSales = async (action: "archive" | "unarchive") => {
    try {
      if (!manageArchiveMonth) {
        addToast("Please select a month", "error");
        return;
      }
      
      // For archive: apply optimistic update and show success immediately
      if (action === 'archive') {
        archiveSalesInState(cabinet, manageArchiveMonth);
        // Show success immediately - sales disappear and success message at same time
        addToast(`Sales archived successfully!`, "success");
      }
      
      // First check the actual database status via API
      const statusResponse = await fetch('/api/sales/archive-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          month: manageArchiveMonth,
          cabinet: cabinet 
        }),
      });
      
      if (!statusResponse.ok) {
        throw new Error('Failed to check archive status');
      }
      
      const statusData = await statusResponse.json();
      console.log('Archive status check:', statusData);
      
      if (action === 'archive' && statusData.monthSales?.activeCount === 0) {
        addToast(`No active sales to archive for ${manageArchiveMonth}`, "warning");
        return;
      }
      
      if (action === 'unarchive' && statusData.monthSales?.archivedCount === 0) {
        addToast(`No archived sales to unarchive for ${manageArchiveMonth}`, "warning");
        return;
      }
      
      // For unarchive, show info toast
      if (action === 'unarchive') {
        addToast(`Unarchiving ${statusData.monthSales?.archivedCount} sales...`, "info");
      }
      
      const response = await fetch(`/api/sales/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [action === 'archive' ? 'archiveMonth' : 'unarchiveMonth']: manageArchiveMonth,
          cabinet: cabinet 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} sales`);
      }

      const result = await response.json();
      
      // For unarchive, immediately add the returned sales to state for instant display
      if (action === 'unarchive' && result.sales && result.sales.length > 0) {
        addUnarchivedSales(result.sales);
      }
      
      // Show final success toast
      addToast(`${result.archivedCount || result.unarchivedCount || 0} sales ${action}d successfully!`, "success");
      setManageArchiveMonth('');
      
    } catch (error) {
      console.error(`Error ${action}ing sales:`, error);
      addToast(`Failed to ${action} sales: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
      // Refresh on error to restore correct state
      refreshSales(cabinet);
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      addToast("Sale deleted successfully", "success");
      setDeleteConfirm({ open: false, id: null });
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Efficient Sidebar Filter Panel */}
        {showAdvancedFilters && (
          <div className="w-full lg:w-80 bg-white border rounded-lg shadow-sm p-3 h-fit lg:sticky lg:top-3 order-1 lg:order-1 mb-4 lg:mb-0">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-violet-600" />
                <h3 className="font-semibold text-gray-800 text-sm">Sales Filters</h3>
                <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full text-xs">
                  {[selectedCategory !== "all" ? 1 : 0, (dateFilter.startDate || dateFilter.endDate) ? 1 : 0, dateFilter.year !== "all" ? 1 : 0, amountFilter !== "all" ? 1 : 0, soldAtFilter !== "all" ? 1 : 0, paymentMethodFilter !== "all" ? 1 : 0, negotiationFilter !== "all" ? 1 : 0, searchQuery !== "" ? 1 : 0].reduce((a, b) => a + b, 0)}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAdvancedFilters(false)} className="h-5 w-5 p-0 hover:bg-gray-100">
                <X size={12} />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Package size={10} className="text-violet-600" /> Category
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-7 border-2 focus:border-violet-500 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🌐 All Categories</SelectItem>
                    {categories.slice(0, 15).map((category) => (
                      <SelectItem key={category} value={category} className="text-xs">{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <DollarSign size={10} className="text-orange-600" /> Amount Range
                </label>
                <Select value={amountFilter} onValueChange={setAmountFilter}>
                  <SelectTrigger className="h-7 border-2 focus:border-orange-500 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Amounts</SelectItem>
                    <SelectItem value="0-500">₱0 - ₱500</SelectItem>
                    <SelectItem value="500-1000">₱500 - ₱1,000</SelectItem>
                    <SelectItem value="1000-5000">₱1,000 - ₱5,000</SelectItem>
                    <SelectItem value="5000-plus">₱5,000+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Store size={10} className="text-green-600" /> Sold At
                </label>
                <Select value={soldAtFilter} onValueChange={setSoldAtFilter}>
                  <SelectTrigger className="h-7 border-2 focus:border-green-500 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="physical">Physical Store</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <CreditCard size={10} className="text-purple-600" /> Payment Method
                </label>
                <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                  <SelectTrigger className="h-7 border-2 focus:border-purple-500 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">💳 All Methods</SelectItem>
                    <SelectItem value="Cash">💵 Cash</SelectItem>
                    <SelectItem value="QRPH">📱 QRPH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Zap size={10} className="text-orange-600" /> Price Type
                </label>
                <div className="flex gap-1">
                  <Select value={negotiationFilter} onValueChange={setNegotiationFilter}>
                    <SelectTrigger className="h-7 border-2 focus:border-orange-500 text-xs flex-1">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sales</SelectItem>
                      <SelectItem value="regular">💰 Regular Price</SelectItem>
                      <SelectItem value="discounted">Discounted</SelectItem>
                    </SelectContent>
                  </Select>
                  {negotiationFilter !== "all" && (
                    <Button variant="outline" size="sm" onClick={() => setNegotiationFilter("all")} className="h-7 px-2 text-xs" title="Clear filter">
                      <X size={12} />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <ArrowUpDown size={10} className="text-indigo-600" /> Sort By
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-7 border-2 focus:border-indigo-500 text-xs">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">📅 Date</SelectItem>
                    <SelectItem value="amount">💰 Amount</SelectItem>
                    <SelectItem value="staff">👤 Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Calendar size={10} className="text-purple-600" /> Time Period
                </label>
                <Select value={timePeriod} onValueChange={setTimePeriod}>
                  <SelectTrigger className="h-7 border-2 focus:border-purple-500 text-xs">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📊 All Time</SelectItem>
                    <SelectItem value="today">📅 Today</SelectItem>
                    <SelectItem value="week">📆 This Week</SelectItem>
                    <SelectItem value="month">🗓️ This Month</SelectItem>
                    <SelectItem value="quarter">📈 Quarter</SelectItem>
                    <SelectItem value="year">📋 This Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Calendar size={10} className="text-purple-600" /> Date Range
                </label>
                <div className="space-y-1">
                  <Input type="date" value={dateFilter.startDate} onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))} className="h-6 border-2 focus:border-purple-500 text-xs px-2" placeholder="Start date" />
                  <Input type="date" value={dateFilter.endDate} onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))} className="h-6 border-2 focus:border-purple-500 text-xs px-2" placeholder="End date" />
                  <Button onClick={() => addToast("Date filter applied", "success")} size="sm" className="w-full h-6 bg-[oklch(0.65_0.22_280)] hover:bg-[oklch(0.55_0.20_280)] text-white text-xs">
                    <Check size={10} className="mr-1" /> Apply Dates
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Zap size={10} className="text-yellow-600" /> Quick Filters
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <Button variant="outline" onClick={() => { setSelectedCategory("all"); setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" }); setAmountFilter("all"); setSoldAtFilter("all"); setPaymentMethodFilter("all"); setNegotiationFilter("all"); setTimePeriod("all"); addToast("Showing all sales", "info"); }} className="h-6 px-2 border-violet-300 text-violet-700 hover:bg-violet-50 text-xs">All Sales</Button>
                  <Button variant="outline" onClick={() => { setSelectedCategory("all"); setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" }); setAmountFilter("5000-plus"); setSoldAtFilter("all"); setPaymentMethodFilter("all"); setTimePeriod("all"); addToast("Showing high-value sales", "info"); }} className="h-6 px-2 border-green-300 text-green-700 hover:bg-green-50 text-xs">High Value</Button>
                  <Button variant="outline" onClick={() => { setSelectedCategory("all"); setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" }); setAmountFilter("all"); setSoldAtFilter("all"); setPaymentMethodFilter("all"); setTimePeriod("today"); addToast("Showing today's sales", "info"); }} className="h-6 px-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50 text-xs">Today</Button>
                  <Button variant="outline" onClick={() => { setSelectedCategory("all"); setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" }); setAmountFilter("all"); setSoldAtFilter("all"); setPaymentMethodFilter("all"); setTimePeriod("week"); addToast("Showing this week's sales", "info"); }} className="h-6 px-2 border-purple-300 text-purple-700 hover:bg-purple-50 text-xs">This Week</Button>
                  <Button variant="outline" onClick={() => { setSelectedCategory("all"); setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" }); setAmountFilter("all"); setSoldAtFilter("all"); setPaymentMethodFilter("all"); setTimePeriod("month"); addToast("Showing this month's sales", "info"); }} className="h-6 px-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs col-span-2">
                    <Calendar size={8} className="mr-1" /> This Month
                  </Button>
                </div>
              </div>

              <Button variant="outline" onClick={() => { setSelectedCategory("all"); setDateFilter({ year: "all", month: "all", day: "all", startDate: "", endDate: "" }); setAmountFilter("all"); setSoldAtFilter("all"); setPaymentMethodFilter("all"); setNegotiationFilter("all"); setSortBy("date"); setTimePeriod("all"); setSearchQuery(""); addToast("All filters cleared", "success"); }} className="w-full h-7 text-gray-500 hover:text-gray-700 text-xs">
                Clear All Filters
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className={`flex-1 order-2 lg:order-2 ${showAdvancedFilters ? '' : 'w-full'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="Search sales by product, staff, or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-8 text-sm" />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-8 px-3 rounded-md border-2 border-violet-300 hover:bg-violet-50 text-violet-700 text-xs font-medium"
                title="Toggle filters panel"
              >
                <div className="flex items-center gap-1">
                  <Filter size={12} />
                  Filters
                  {(selectedCategory !== "all" || (dateFilter.startDate || dateFilter.endDate) || dateFilter.year !== "all" || amountFilter !== "all" || soldAtFilter !== "all" || paymentMethodFilter !== "all" || negotiationFilter !== "all" || timePeriod !== "all") && (
                    <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></span>
                  )}
                </div>
              </Button>
            </div>
            <div className="flex items-center gap-1 lg:gap-2 flex-wrap">
              <Button variant="outline" onClick={handlePrint} className="h-8 px-2 lg:px-3 rounded-md border-2 hover:bg-gray-50 text-xs" title="Print sales report">
                <Printer size={12} className="mr-1 hidden sm:inline" /> <span className="hidden sm:inline">Print</span><span className="sm:hidden">🖨️</span>
              </Button>
              <Button variant="outline" onClick={handleExportExcel} className="h-8 px-2 lg:px-3 rounded-md border-2 hover:bg-gray-50 text-xs" title="Export to Excel">
                <Download size={12} className="mr-1 hidden sm:inline" /> <span className="hidden sm:inline">Export</span><span className="sm:hidden">📊</span>
              </Button>
              <Button onClick={handleExportReport} className="h-8 px-2 lg:px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex items-center gap-1">
                <Download size={14} /> <span className="hidden sm:inline">Report</span>
              </Button>
              <Button variant="outline" onClick={() => setShowManageArchives(true)} className="h-8 px-2 lg:px-3 rounded-md border-2 hover:bg-gray-50 text-xs">
                <Archive size={14} className="mr-1" /> <span className="hidden sm:inline">Archive</span>
              </Button>
            </div>
          </div>

          {/* Revenue Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 mb-6 lg:mb-8 mt-4 max-w-2xl">
            <Card className="relative overflow-hidden border-2 shadow-md bg-gradient-to-br from-[oklch(0.25_0.15_145)] to-[oklch(0.35_0.18_145)] border-[oklch(0.3_0.12_145)] text-white">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full" />
              <CardContent className="pt-3 pb-3 relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                      Total Sales
                    </p>
                    <p className="text-xl font-bold">
                      ₱{filteredSales.reduce((sum: number, sale: any) => sum + (parseFloat(sale.amount) || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-full p-2 bg-[oklch(0.5_0.15_145)] text-white flex-shrink-0">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={`relative overflow-hidden border-2 shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 ${negotiationFilter === "discounted" ? "border-orange-500" : "border-[oklch(0.65_0.1_85)]"} bg-gradient-to-br from-[oklch(0.6_0.15_85)] to-[oklch(0.7_0.12_90)] text-white`} onClick={() => setNegotiationFilter(negotiationFilter === "discounted" ? "all" : "discounted")} title={negotiationFilter === "discounted" ? "Click to clear filter" : "Click to filter discounted sales"}>
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full" />
              <CardContent className="pt-3 pb-3 relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                      Discounted Sales
                    </p>
                    <p className="text-xl font-bold">
                      {filteredSales.filter((sale: any) => 
                        sale.items.some((item: any) => item.isDiscounted === true)
                      ).length}
                    </p>
                    <p className="text-xs opacity-60">
                      {negotiationFilter === "discounted" ? "✓ Click to clear filter" : "Click to filter discounts"}
                    </p>
                  </div>
                  <div className={`rounded-full p-2 flex-shrink-0 ${negotiationFilter === "discounted" ? "bg-orange-200 text-orange-700" : "bg-[oklch(0.65_0.12_85)] text-white"}`}>
                    <Package className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-primary/10 overflow-hidden">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg lg:text-xl">Sales Records</CardTitle>
                  <CardDescription className="text-sm">All sales transactions and details</CardDescription>
                </div>
                <div className="flex items-center gap-2 lg:gap-3">
                  <Select value={timePeriod} onValueChange={setTimePeriod}>
                    <SelectTrigger className="h-8 border-2 border-gray-200 hover:border-gray-300 text-xs">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">📊 All Time</SelectItem>
                      <SelectItem value="today">📅 Today</SelectItem>
                      <SelectItem value="week">📆 This Week</SelectItem>
                      <SelectItem value="month">🗓️ This Month</SelectItem>
                      <SelectItem value="quarter">📈 Quarter</SelectItem>
                      <SelectItem value="year">📋 This Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-600">Total Sales</div>
                    <div className="text-xl font-bold text-gray-900">₱{filteredSales.reduce((sum: number, sale: any) => sum + (parseFloat(sale.amount) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-xs text-gray-500">
                      {timePeriod === "all" ? "All Time" : timePeriod === "today" ? "Daily" : timePeriod === "week" ? "Weekly" : timePeriod === "month" ? "Monthly" : timePeriod === "quarter" ? "Quarterly" : "Yearly"} • {filteredSales.length} sales
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSales.length === 0 ? (
                <EmptyState icon="💰" title="No sales found" description={searchQuery ? "Try adjusting your search criteria" : "Start by making your first sale"} action={{ label: "New Sale", onClick: () => {} }} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="py-4 px-5 text-left font-semibold text-foreground">Date</th>
                        <th className="py-4 px-5 text-left font-semibold text-foreground">Sale ID</th>
                        <th className="py-4 px-5 text-left font-semibold text-foreground">Products</th>
                        <th className="py-4 px-5 text-left font-semibold text-foreground">Staff</th>
                        <th className="py-4 px-5 text-center font-semibold text-foreground">Payment Method</th>
                        <th className="py-4 px-5 text-right font-semibold text-foreground">Amount</th>
                        <th className="py-4 px-5 text-center font-semibold text-foreground">Location</th>
                        <th className="py-4 px-5 text-center font-semibold text-foreground">Discount</th>
                        <th className="py-4 px-5 text-center font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSales.map((sale: any) => (
                        <tr key={sale.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-4 px-5 text-muted-foreground text-sm">{new Date(sale.date).toLocaleDateString()}</td>
                          <td className="py-4 px-5 text-foreground font-medium">{createShortSaleId(sale.id)}</td>
                          <td className="py-4 px-5 text-muted-foreground text-sm">
                            <div className="max-w-md space-y-1">
                              {sale.items.length <= 3 ? (
                                // Show all items if 3 or less
                                sale.items.map((item: any, index: number) => (
                                  <span key={index} className="inline-block">
                                                                        {item.productName} ({item.quantity})
                                    {index < sale.items.length - 1 && <span className="mr-2">, </span>}
                                  </span>
                                ))
                              ) : (
                                // Show truncated version with expand/collapse for more than 3 items
                                <div>
                                  {sale.items.slice(0, 3).map((item: any, index: number) => (
                                    <span key={index} className="inline-block">
                                                                            {item.productName} ({item.quantity})
                                      <span className="mr-2">, </span>
                                    </span>
                                  ))}
                                  {!expandedSales.has(sale.id) && (
                                    <span className="text-violet-600 cursor-pointer hover:text-violet-800 text-xs" onClick={() => toggleSaleExpansion(sale.id)}>
                                      +{sale.items.length - 3} more...
                                    </span>
                                  )}
                                  {expandedSales.has(sale.id) && (
                                    <div>
                                      {sale.items.slice(3).map((item: any, index: number) => (
                                        <span key={index + 3} className="inline-block">
                                                                                    {item.productName} ({item.quantity})
                                          <span className="mr-2">, </span>
                                        </span>
                                      ))}
                                      <span className="text-violet-600 cursor-pointer hover:text-violet-800 text-xs" onClick={() => toggleSaleExpansion(sale.id)}>
                                        Show less
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-5 text-muted-foreground text-sm">{sale.staffName}</td>
                          <td className="py-4 px-5 text-muted-foreground text-sm text-center">{sale.paymentMethod}</td>
                          <td className="py-4 px-5 text-right font-medium text-foreground">₱{sale.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-4 px-5 text-muted-foreground text-sm text-center">
                            <span className={`px-3 py-1.5 rounded-full text-xs ${sale.soldAt === 'physical' ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'}`}>
                              {sale.soldAt === 'physical' ? 'Store' : 'Online'}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-center">
                            {sale.items.some((item: any) => item.isDiscounted === true) ? (
                              <span className="px-3 py-1.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">
                                Discounted
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 rounded-full text-xs bg-gray-100 text-gray-600">
                                Regular
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <Button variant="ghost" size="sm" className="text-violet-600 hover:bg-violet-10 p-2" onClick={() => handleViewSaleDetails(sale)} title="View Sale Details">
                              <Store size={16} />
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
        </div>
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Sales Report</DialogTitle>
            <DialogDescription>{exportSuccess ? "Sales report exported successfully!" : "Choose your export format and date range"}</DialogDescription>
          </DialogHeader>
          {!exportSuccess && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button onClick={handleExportExcel} className="flex-1"><Download size={16} className="mr-2" /> Excel</Button>
                <Button onClick={handlePrint} variant="outline" className="flex-1"><Printer size={16} className="mr-2" /> Print</Button>
              </div>
            </div>
          )}
          {exportSuccess && (
            <div className="flex justify-center">
              <Button onClick={() => setShowExportDialog(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive Management Dialog */}
      {showManageArchives && (
        <Dialog open={showManageArchives} onOpenChange={setShowManageArchives}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Sales Archives</DialogTitle>
              <DialogDescription>Archive or unarchive sales by month to manage your sales list visibility.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Month</label>
                <Input type="month" value={manageArchiveMonth} onChange={(e) => setManageArchiveMonth(e.target.value)} className="w-full" />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => handleArchiveSales("archive")} className="flex-1" disabled={!manageArchiveMonth}>
                  <Archive size={16} className="mr-2" /> Archive
                </Button>
                <Button onClick={() => handleArchiveSales("unarchive")} variant="outline" className="flex-1" disabled={!manageArchiveMonth}>
                  <Package size={16} className="mr-2" /> Unarchive
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowManageArchives(false)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog open={deleteConfirm.open} title="Delete Sale" description="Are you sure you want to delete this sale? This action cannot be undone." confirmText="Delete" cancelText="Cancel" isDangerous={true} onConfirm={confirmDelete} onCancel={() => setDeleteConfirm({ open: false, id: null })} />
    </>
  )
}
