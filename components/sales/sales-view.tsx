"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Filter, Calendar, Package, ArrowUpDown, ArrowUp, ArrowDown, X, RefreshCw, LayoutList, Users, Boxes, Settings, Building2, Home, Folder, FolderOpen, FileText, Globe, Banknote, Smartphone, CreditCard, Tag, FileSpreadsheet, BarChart3, Check, Printer, Archive, Store, Zap, Plus, ShoppingCart, Receipt, TrendingUp, Lock, Unlock } from "lucide-react"
import { PesoIcon } from "@/components/ui/peso-icon"
import { DashboardMetricCard } from "@/components/ui/dashboard-metric-card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSales } from "@/contexts/sales-context"
import { useToast } from "@/contexts/toast-context"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import {
  countUnitsInSale,
  formatSaleLineItemLabel,
  lineCogs,
  lineProfit,
  lineQuantity,
  lineRevenue,
  saleTotalCogs,
  saleTotalRevenue,
} from "@/lib/sale-metrics"
import { finalizeSaleRowsForTable, parseSaleDate } from "@/lib/analytics-from-sales"
import { getPhilippineDayBounds, getPhilippineDayRangeFromYmd } from "@/lib/philippine-time"
import { buildSalesExcelBuffer } from "@/lib/sales-excel-export"

// Helper function to create short sale ID
const createShortSaleId = (fullId: string): string => {
  const prefix = fullId.substring(0, 8).toUpperCase()
  const suffix = fullId.substring(fullId.length - 4).toUpperCase()
  return `${prefix}-${suffix}`
}

const formatSaleDate = (dateValue: string) => {
  const d = parseSaleDate(dateValue);
  if (Number.isNaN(d.getTime())) return dateValue;
  return d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila' });
}

function timePeriodDescription(period: string): string {
  switch (period) {
    case "today":
      return "Today";
    case "weekly":
      return "Last 7 days";
    case "monthly":
      return "Last 30 days";
    case "quarterly":
      return "Last 90 days";
    case "annually":
      return "Last 365 days";
    case "all":
      return "All time (loaded in app)";
    default:
      return "";
  }
}

/** Shown under Total Sales — custom range replaces quick period (not combined). */
function totalSalesPeriodCaption(
  timePeriod: string,
  applied: { startDate: string; endDate: string }
): string {
  if (applied.startDate && applied.endDate) {
    return `Custom: ${applied.startDate} → ${applied.endDate}`;
  }
  if (applied.startDate) return `From ${applied.startDate} onward`;
  if (applied.endDate) return `Through ${applied.endDate}`;
  return timePeriodDescription(timePeriod);
}

function saleAmountNumber(sale: { amount?: unknown }): number {
  const a = sale.amount;
  if (typeof a === "number" && Number.isFinite(a)) return a;
  const s = String(a ?? "").trim().replace(/,/g, "");
  const p = parseFloat(s);
  return Number.isFinite(p) ? p : 0;
}

const PH_MONEY: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

function formatPhpAmount(n: number) {
  return n.toLocaleString("en-PH", PH_MONEY)
}

/** Summary / display: never show negative peso amounts. */
function formatPhpAmountNonNegative(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return formatPhpAmount(Math.max(0, v))
}

interface SalesViewProps {
  isAdmin: boolean
  cabinet: string
  onNewSale?: () => void
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

export function SalesView({ isAdmin, cabinet, onNewSale }: SalesViewProps) {
  const { getSalesByCabinet, refreshSales, addUnarchivedSales, archiveSalesInState, loading } = useSales()
  const { addToast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  
  // Advanced filter states
  const [selectedCategory, setSelectedCategory] = useState("all")
  /** Applied custom range only — when set, quick period below is ignored. */
  const [dateFilter, setDateFilter] = useState({ startDate: "", endDate: "" })
  const [tempDateFilter, setTempDateFilter] = useState({ startDate: "", endDate: "" })
  const [amountFilter, setAmountFilter] = useState("all")
  const [soldAtFilter, setSoldAtFilter] = useState("all")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all")
  const [negotiationFilter, setNegotiationFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [timePeriod, setTimePeriod] = useState("today")
  const [showManageArchives, setShowManageArchives] = useState(false)
  const [manageArchiveMonth, setManageArchiveMonth] = useState("")
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [selectedSale, setSelectedSale] = useState<any | null>(null)
  const [showSaleDetails, setShowSaleDetails] = useState(false)
  const [operatingExpensePercent, setOperatingExpensePercent] = useState<number>(0)
  const [isOpexLocked, setIsOpexLocked] = useState<boolean>(false)
  const [isOpexLoaded, setIsOpexLoaded] = useState(false)

  useEffect(() => {
    const savedOpex = localStorage.getItem("pos_opex_percent")
    const savedLock = localStorage.getItem("pos_opex_locked")
    if (savedOpex) setOperatingExpensePercent(Number(savedOpex))
    if (savedLock) setIsOpexLocked(savedLock === "true")
    setIsOpexLoaded(true)
  }, [])

  useEffect(() => {
    if (isOpexLoaded) {
      localStorage.setItem("pos_opex_percent", operatingExpensePercent.toString())
      localStorage.setItem("pos_opex_locked", isOpexLocked.toString())
    }
  }, [operatingExpensePercent, isOpexLocked, isOpexLoaded])

  const sales = getSalesByCabinet(cabinet)

  const usingCustomSaleDates = Boolean(dateFilter.startDate || dateFilter.endDate)

  const applySalesDateRange = () => {
    if (tempDateFilter.startDate && tempDateFilter.endDate) {
      const startR = getPhilippineDayRangeFromYmd(tempDateFilter.startDate)
      const endR = getPhilippineDayRangeFromYmd(tempDateFilter.endDate)
      if (!startR || !endR) {
        addToast("Invalid date range", "error")
        return
      }
      if (startR.start.getTime() > endR.start.getTime()) {
        addToast("From date cannot be after To date", "error")
        return
      }
    }
    setDateFilter({
      startDate: tempDateFilter.startDate,
      endDate: tempDateFilter.endDate,
    })
    addToast("Date range applied", "success")
  }

  const clearSalesDateRange = () => {
    setTempDateFilter({ startDate: "", endDate: "" })
    setDateFilter({ startDate: "", endDate: "" })
    addToast("Custom date range cleared", "info")
  }

  const toggleAdvancedFilters = () => {
    setShowAdvancedFilters((prev) => {
      const next = !prev
      if (next) {
        setTempDateFilter({ startDate: dateFilter.startDate, endDate: dateFilter.endDate })
      }
      return next
    })
  }

  
  // Debug logging removed (was too noisy and slowed down the app)

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

  // View sale details in modal
  const handleViewSaleDetails = (sale: any) => {
    setSelectedSale(sale)
    setShowSaleDetails(true)
  }

  const handlePrint = () => {
    const totalTransactions = filteredSales.length;
    const totalUnits = filteredSales.reduce((sum, sale) => sum + countUnitsInSale(sale), 0);
    const totalRev = filteredSales.reduce((sum, sale) => sum + saleAmountNumber(sale), 0);
    const avg = totalTransactions > 0 ? totalRev / totalTransactions : 0;
    const totalCogs = lineFinanceDisplay.cogs;
    const totalProfit = lineFinanceDisplay.profit;
    const netRevenue = (totalRev - totalCogs) * (1 - operatingExpensePercent / 100);
    const salesWithDiscount = filteredSales.filter((s: any) => Array.isArray(s.items) && s.items.some((i: any) => i.isDiscounted === true)).length;

    const printContent = `
      <html>
        <head>
          <title>Sales Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .logo-container { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px; }
            .logo-container img { max-height: 50px; }
            h1 { color: #1e293b; margin: 0; font-size: 1.5rem; text-transform: uppercase; }
            .meta { text-align: center; margin-bottom: 30px; font-size: 0.9em; color: #64748b; }
            
            
            .cards-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; background: #f8fafc; }
            .card-title { font-size: 0.8rem; text-transform: uppercase; color: #64748b; margin-bottom: 5px; font-weight: bold; }
            .card-value { font-size: 1.3rem; font-weight: bold; color: #0f172a; }
            .card-sub { font-size: 0.75rem; color: #64748b; margin-top: 5px; }

            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9rem; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .amount { text-align: right; font-weight: bold; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: landscape; }
            }
          </style>
        </head>
        <body>
          <div class="logo-container">
            <img src="/Wheezard logo.png" onerror="this.style.display='none'" alt="LOGO" />
            <h1>SALES REPORT - THE WHEEZARD PH</h1>
          </div>
          <div class="meta">
            Cabinet: <strong>${cabinet.charAt(0).toUpperCase() + cabinet.slice(1)}</strong> | 
            Date: <strong>${new Date().toLocaleDateString()}</strong> | 
            Time Period: <strong>${totalSalesPeriodCaption(timePeriod, dateFilter)}</strong>
          </div>

          <div class="cards-grid">
            <div class="card">
              <div class="card-title">Gross Revenue</div>
              <div class="card-value">₱${formatPhpAmountNonNegative(totalRev)}</div>
              <div class="card-sub">Orders: ${totalTransactions} | Units: ${totalUnits}</div>
            </div>
            <div class="card">
              <div class="card-title">Less COGS</div>
              <div class="card-value">₱${formatPhpAmountNonNegative(totalCogs)}</div>
              <div class="card-sub">Gross Profit: ₱${formatPhpAmountNonNegative(totalProfit)}</div>
            </div>
            <div class="card">
              <div class="card-title">Net Revenue</div>
              <div class="card-value">₱${formatPhpAmountNonNegative(netRevenue)}</div>
              <div class="card-sub">Post-OpEx (${operatingExpensePercent}%)</div>
            </div>
            <div class="card">
              <div class="card-title">Discounted Sales</div>
              <div class="card-value">${salesWithDiscount}</div>
              <div class="card-sub">Out of ${totalTransactions} transactions</div>
            </div>
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
                  <td>${formatSaleDate(String(sale.date || sale.createdAt || sale.soldAt || ""))}</td>
                  <td>${createShortSaleId(sale.id)}</td>
                  <td>${(Array.isArray(sale.items) ? sale.items : []).map((item: any) => formatSaleLineItemLabel(item.productName, item.quantity)).join(', ')}</td>
                  <td>${sale.staffName}</td>
                  <td>${sale.paymentMethod}</td>
                  <td class="amount">₱${formatPhpAmountNonNegative(saleAmountNumber(sale))}</td>
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
      
      // Show message before triggering print dialog
      addToast("Opening print dialog...", "info");
      
      // Trigger print dialog immediately
      printWindow.print();
      
      // Handle print completion or cancellation
      let printHandled = false;
      
      printWindow.onafterprint = () => {
        printHandled = true;
        printWindow.close();
        addToast("Print dialog closed", "info");
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

  const filteredSales = useMemo(() => {
    // Filter first, then dedupe: pre-filter dedupe could drop a valid sale on the selected day
    // when an earlier duplicate row (e.g. sync/merge) shares the same id or requestKey.
    const matched = sales.filter((sale: any) => {
        const items = Array.isArray(sale.items) ? sale.items : []

        const matchesSearch =
          searchQuery === "" ||
          items.some(
            (item: any) =>
              String(item.productName ?? "")
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              String(item.category ?? "")
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
          ) ||
          String(sale.staffName ?? "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          createShortSaleId(sale.id).toLowerCase().includes(searchQuery.toLowerCase())

        const matchesCategory =
          selectedCategory === "all" || items.some((item: any) => item.category === selectedCategory)

        let matchesAmount = true
        if (amountFilter !== "all") {
          const amt = saleAmountNumber(sale)
          switch (amountFilter) {
            case "0-500":
              matchesAmount = amt >= 0 && amt <= 500
              break
            case "500-1000":
              matchesAmount = amt > 500 && amt <= 1000
              break
            case "1000-5000":
              matchesAmount = amt > 1000 && amt <= 5000
              break
            case "5000-plus":
              matchesAmount = amt > 5000
              break
          }
        }

        const matchesSoldAt = soldAtFilter === "all" || sale.soldAt === soldAtFilter
        const matchesPaymentMethod = paymentMethodFilter === "all" || sale.paymentMethod === paymentMethodFilter

        let matchesNegotiation = true
        if (negotiationFilter !== "all") {
          const hasDiscountedItems = items.some((item: any) => item.isDiscounted === true)
          if (negotiationFilter === "discounted") {
            matchesNegotiation = hasDiscountedItems
          } else if (negotiationFilter === "regular") {
            matchesNegotiation = !hasDiscountedItems
          }
        }

        const saleDate = parseSaleDate(sale.date || sale.createdAt || sale.soldAt || "")
        if (Number.isNaN(saleDate.getTime())) return false

        let matchesDate: boolean
        if (dateFilter.startDate || dateFilter.endDate) {
          if (dateFilter.startDate && dateFilter.endDate) {
            const fromR = getPhilippineDayRangeFromYmd(dateFilter.startDate)
            const toR = getPhilippineDayRangeFromYmd(dateFilter.endDate)
            if (!fromR || !toR) {
              matchesDate = false
            } else {
              matchesDate = saleDate >= fromR.start && saleDate < toR.end
            }
          } else if (dateFilter.startDate) {
            const fromR = getPhilippineDayRangeFromYmd(dateFilter.startDate)
            matchesDate = Boolean(fromR && saleDate >= fromR.start)
          } else {
            const toR = getPhilippineDayRangeFromYmd(dateFilter.endDate!)
            matchesDate = Boolean(toR && saleDate < toR.end)
          }
        } else {
          const now = new Date()
          let startDate: Date
          switch (timePeriod) {
            case "all":
              matchesDate = true
              break
            case "today": {
              const { start: phStart, end: phEnd } = getPhilippineDayBounds(now)
              matchesDate = saleDate >= phStart && saleDate < phEnd
              break
            }
            case "weekly":
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              matchesDate = saleDate >= startDate
              break
            case "monthly":
              startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
              matchesDate = saleDate >= startDate
              break
            case "quarterly":
              startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
              matchesDate = saleDate >= startDate
              break
            case "annually":
              startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
              matchesDate = saleDate >= startDate
              break
            default:
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              matchesDate = saleDate >= startDate
          }
        }

        return (
          matchesSearch &&
          matchesCategory &&
          matchesAmount &&
          matchesSoldAt &&
          matchesPaymentMethod &&
          matchesNegotiation &&
          matchesDate
        )
      })

    return finalizeSaleRowsForTable(matched as any, (a: any, b: any) => {
      let comparison = 0
      switch (sortBy) {
        case "date":
          comparison =
            parseSaleDate(b.date || b.createdAt || b.soldAt || "").getTime() -
            parseSaleDate(a.date || a.createdAt || a.soldAt || "").getTime()
          break
        case "amount":
          comparison = saleAmountNumber(b) - saleAmountNumber(a)
          break
        case "staff":
          comparison = String(a.staffName ?? "").localeCompare(String(b.staffName ?? ""))
          break
        default:
          return 0
      }
      return sortDirection === "asc" ? -comparison : comparison
    })
  }, [
    sales,
    searchQuery,
    selectedCategory,
    amountFilter,
    soldAtFilter,
    paymentMethodFilter,
    negotiationFilter,
    timePeriod,
    dateFilter.startDate,
    dateFilter.endDate,
    sortBy,
    sortDirection,
  ])

  /** Sum of line extended prices / costs (from stored line items; excludes tax vs sale.amount). */
  const lineFinance = useMemo(() => {
    let revenue = 0
    let cogs = 0
    for (const sale of filteredSales) {
      revenue += saleTotalRevenue(sale as any)
      cogs += saleTotalCogs(sale as any)
    }
    return {
      revenue,
      cogs,
      profit: revenue - cogs,
    }
  }, [filteredSales])

  const lineFinanceDisplay = useMemo(
    () => ({
      revenue: Math.max(0, lineFinance.revenue),
      cogs: Math.max(0, lineFinance.cogs),
      profit: Math.max(0, lineFinance.profit),
    }),
    [lineFinance]
  )

  const trueTotalSales = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + saleAmountNumber(sale), 0)
  }, [filteredSales])

  const handleExportExcel = async () => {
    const rows = filteredSales as any[]
    const totalTransactions = rows.length
    const totalUnits = rows.reduce((sum, sale) => sum + countUnitsInSale(sale), 0)
    const totalRevenue = rows.reduce((sum, sale) => sum + saleAmountNumber(sale), 0)
    const avgSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    const salesWithDiscount = rows.filter(
      (s) => Array.isArray(s.items) && s.items.some((i: { isDiscounted?: boolean }) => i.isDiscounted === true)
    ).length

    const paymentMap = new Map<string, { count: number; revenue: number }>()
    for (const s of rows) {
      const key = String(s.paymentMethod ?? "Other").trim() || "Other"
      const cur = paymentMap.get(key) ?? { count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += saleAmountNumber(s)
      paymentMap.set(key, cur)
    }

    const filterBits: string[] = []
    if (searchQuery) filterBits.push(`Search: ${searchQuery}`)
    if (selectedCategory !== "all") filterBits.push(`Category: ${selectedCategory}`)
    if (amountFilter !== "all") filterBits.push(`Amount band: ${amountFilter}`)
    if (soldAtFilter !== "all") filterBits.push(`Sold at: ${soldAtFilter}`)
    if (paymentMethodFilter !== "all") filterBits.push(`Payment: ${paymentMethodFilter}`)
    if (negotiationFilter !== "all") filterBits.push(`Lines: ${negotiationFilter}`)
    const filterLine = filterBits.length ? filterBits.join(" | ") : "None (date scope only)"

    const paymentRows = [...paymentMap.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([method, { count, revenue }]) => ({ method, count, revenue }))

    const detailRows = rows.map((sale) => {
      const amt = saleAmountNumber(sale)
      const units = countUnitsInSale(sale)
      const products = Array.isArray(sale.items)
        ? sale.items.map((item: any) => formatSaleLineItemLabel(item.productName, item.quantity)).join("; ")
        : ""
      return {
        date: formatSaleDate(String(sale.date || sale.createdAt || sale.soldAt || "")),
        saleId: createShortSaleId(sale.id),
        units,
        products,
        staff: sale.staffName ?? "",
        paymentMethod: sale.paymentMethod ?? "",
        amount: amt,
        soldAt: String(sale.soldAt ?? ""),
      }
    })

      let logoBuffer: ArrayBuffer | undefined;
      try {
        const res = await fetch('/Wheezard logo.png');
        if (res.ok) {
          logoBuffer = await res.arrayBuffer();
        }
      } catch (err) {
        console.warn('Could not fetch logo for excel export', err);
      }

      try {
      const bytes = await buildSalesExcelBuffer({
        cabinetLabel: cabinet === "all" ? "All cabinets" : cabinet,
        generatedAt: new Date().toLocaleString("en-PH", {
          timeZone: "Asia/Manila",
          dateStyle: "medium",
          timeStyle: "short",
        }),
        dateScopeLabel: totalSalesPeriodCaption(timePeriod, dateFilter),
        filterLine,
        totalTransactions,
        totalUnits,
        totalRevenue,
        totalCOGS: lineFinanceDisplay.cogs,
        totalProfit: lineFinanceDisplay.profit,
        netRevenue: (totalRevenue - lineFinanceDisplay.cogs) * (1 - operatingExpensePercent / 100),
        avgSale,
        salesWithDiscount,
        paymentRows,
        detailRows,
        logoBuffer,
      })

      const blob = new Blob([bytes as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      const safeCabinet = String(cabinet || "all").replace(/[^\w.-]+/g, "_")
      link.setAttribute("href", url)
      link.setAttribute(
        "download",
        `sales_report_${safeCabinet}_${new Date().toISOString().split("T")[0]}.xlsx`
      )
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportSuccess(true)
      const cabinetLabel = cabinet === "all" ? "All cabinets" : cabinet
      const scopeCaption = totalSalesPeriodCaption(timePeriod, dateFilter)
      const filterSummary = filterBits.length ? filterBits.join(" · ") : null
      addToast(
        [
          `Sales report (filtered): ${totalTransactions} transactions, ${totalUnits} units, ₱${totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
          `Cabinet: ${cabinetLabel}. Period: ${scopeCaption}.`,
          filterSummary ? `Filters: ${filterSummary}.` : "No extra filters (date scope only).",
        ].join(" "),
        "success",
        9500
      )
    } catch (e) {
      console.error(e)
      addToast("Could not build Excel file. Try again.", "error")
    }
  }

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
      
      // For archive: show toast and apply optimistic update together
      if (action === 'archive') {
        // Use setTimeout to batch both operations in same render cycle
        setTimeout(() => {
          addToast(`Sales archived successfully!`, "success");
          archiveSalesInState(cabinet, manageArchiveMonth);
        }, 0);
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
      
      // For unarchive: skip status check, just do it and show immediately
      if (action === 'unarchive') {
        addToast(`Unarchiving sales...`, "info");
        
        const response = await fetch(`/api/sales/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            unarchiveMonth: manageArchiveMonth,
            cabinet: cabinet 
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to ${action} sales`);
        }

        const result = await response.json();
        
        // Immediately add the returned sales to state for instant display
        if (result.sales && result.sales.length > 0) {
          addUnarchivedSales(result.sales);
        }
        
        // Show success immediately
        addToast(`${result.unarchivedCount || 0} sales unarchived successfully!`, "success");
        setManageArchiveMonth('');
        return; // Skip the rest for unarchive
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
      
      // Show final success toast for archive
      addToast(`${result.archivedCount || 0} sales archived successfully!`, "success");
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
                <Filter size={14} className="text-[#3B18DA]" />
                <h3 className="font-semibold text-gray-800 text-sm">Sales Filters</h3>
                <span className="bg-[#3B18DA]/10 text-[#3B18DA] px-1.5 py-0.5 rounded-full text-xs">
                  {[selectedCategory !== "all" ? 1 : 0, (dateFilter.startDate || dateFilter.endDate) ? 1 : 0, amountFilter !== "all" ? 1 : 0, soldAtFilter !== "all" ? 1 : 0, paymentMethodFilter !== "all" ? 1 : 0, negotiationFilter !== "all" ? 1 : 0, searchQuery !== "" ? 1 : 0].reduce((a, b) => a + b, 0)}
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
                    <SelectItem value="all"><span className="flex items-center gap-2"><Globe size={14} /> All Categories</span></SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category} className="text-xs">{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <PesoIcon size={10} className="text-orange-600" /> Amount Range
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
                    <SelectItem value="all"><span className="flex items-center gap-2"><CreditCard size={14} /> All Methods</span></SelectItem>
                    <SelectItem value="Cash"><span className="flex items-center gap-2"><Banknote size={14} /> Cash</span></SelectItem>
                    <SelectItem value="QRPH"><span className="flex items-center gap-2"><Smartphone size={14} /> QRPH</span></SelectItem>
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
                      <SelectItem value="regular"><span className="flex items-center gap-2"><PesoIcon size={14} /> Regular Price</span></SelectItem>
                      <SelectItem value="discounted"><span className="flex items-center gap-2"><Tag size={14} /> Discounted</span></SelectItem>
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
                <div className="space-y-1">
                  <Button
                    variant={sortBy === "date" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (sortBy === "date") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                      } else {
                        setSortBy("date")
                        setSortDirection("desc")
                      }
                    }}
                    className="w-full justify-between h-7 text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Calendar size={12} />
                      Date
                    </span>
                    {sortBy === "date" && (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </Button>
                  <Button
                    variant={sortBy === "amount" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (sortBy === "amount") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                      } else {
                        setSortBy("amount")
                        setSortDirection("desc")
                      }
                    }}
                    className="w-full justify-between h-7 text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <PesoIcon size={12} />
                      Amount
                    </span>
                    {sortBy === "amount" && (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </Button>
                  <Button
                    variant={sortBy === "staff" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (sortBy === "staff") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                      } else {
                        setSortBy("staff")
                        setSortDirection("asc")
                      }
                    }}
                    className="w-full justify-between h-7 text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Users size={12} />
                      Staff
                    </span>
                    {sortBy === "staff" && (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-purple-200/80 bg-purple-50/40 p-2">
                <label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                  <Calendar size={10} className="text-purple-600" /> Custom date range
                </label>
                <p className="text-[10px] text-gray-600 leading-snug">
                  Set From and/or To, then Apply. When a custom range is active, the quick period below is ignored.
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
                    <Button type="button" onClick={applySalesDateRange} size="sm" className="flex-1 h-7 bg-[oklch(0.65_0.22_280)] hover:bg-[oklch(0.55_0.20_280)] text-white text-xs">
                      <Check size={10} className="mr-1" /> Apply
                    </Button>
                    <Button type="button" variant="outline" onClick={clearSalesDateRange} size="sm" className="h-7 text-xs px-2">
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Calendar size={10} className="text-purple-600" /> Quick period
                </label>
                <Select value={timePeriod} onValueChange={setTimePeriod} disabled={usingCustomSaleDates}>
                  <SelectTrigger
                    title={usingCustomSaleDates ? "Clear custom date range above to use quick period" : undefined}
                    className="h-7 border-2 focus:border-purple-500 text-xs disabled:opacity-50"
                  >
                    <SelectValue placeholder="Weekly" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today"><span className="flex items-center gap-2"><Calendar size={14} /> Today</span></SelectItem>
                    <SelectItem value="weekly"><span className="flex items-center gap-2"><Calendar size={14} /> This Week</span></SelectItem>
                    <SelectItem value="monthly"><span className="flex items-center gap-2"><Calendar size={14} /> This Month</span></SelectItem>
                    <SelectItem value="quarterly"><span className="flex items-center gap-2"><BarChart3 size={14} /> This Quarter</span></SelectItem>
                    <SelectItem value="annually"><span className="flex items-center gap-2"><FileText size={14} /> This Year</span></SelectItem>
                    <SelectItem value="all"><span className="flex items-center gap-2"><Globe size={14} /> All time</span></SelectItem>
                  </SelectContent>
                </Select>
                {usingCustomSaleDates && (
                  <p className="text-[10px] text-amber-700">Quick period is off while a custom range is applied.</p>
                )}
              </div>

              <Button variant="outline" onClick={() => { setSelectedCategory("all"); setDateFilter({ startDate: "", endDate: "" }); setTempDateFilter({ startDate: "", endDate: "" }); setAmountFilter("all"); setSoldAtFilter("all"); setPaymentMethodFilter("all"); setNegotiationFilter("all"); setSortBy("date"); setSortDirection("desc"); setTimePeriod("today"); setSearchQuery(""); addToast("All filters cleared", "success"); }} className="w-full h-7 text-gray-500 hover:text-gray-700 text-xs">
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
            </div>
            <div className="flex items-center gap-1 lg:gap-2 flex-wrap">
              <Button variant="outline" onClick={handlePrint} className="h-8 px-2 lg:px-3 rounded-md border-2 hover:bg-gray-50 text-xs" title="Print sales report">
                <Printer size={12} className="mr-1" /> Print
              </Button>
              <Button variant="outline" onClick={handleExportExcel} className="h-8 px-2 lg:px-3 rounded-md border-2 hover:bg-gray-50 text-xs" title="Export to Excel">
                <Download size={12} className="mr-1" /> Export
              </Button>
              <Button variant="outline" onClick={() => setShowManageArchives(true)} className="h-8 px-2 lg:px-3 rounded-md border-2 hover:bg-gray-50 text-xs">
                <Archive size={14} className="mr-1" /> <span className="hidden sm:inline">Archive</span>
              </Button>
            </div>
          </div>

          {/* Revenue Summary — full row width; fewer columns on XL so amounts stay readable */}
          <div className="mb-6 mt-4 grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 lg:mb-8 lg:gap-5">
            <DashboardMetricCard
              color="green"
              title="Total Sales"
              value={
                loading ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    …
                  </span>
                ) : (
                  <span className="tabular-nums">
                    ₱
                    {formatPhpAmountNonNegative(trueTotalSales)}
                  </span>
                )
              }
              description={
                <>
                  <span className="block">{totalSalesPeriodCaption(timePeriod, dateFilter)}</span>
                  <span className="mt-0.5 block opacity-80">
                    {loading
                      ? "Loading transactions…"
                      : `Sum of the Amount column · ${filteredSales.length} transaction${
                          filteredSales.length === 1 ? "" : "s"
                        } listed`}
                  </span>
                </>
              }
              icon={<ShoppingCart className="size-5 shrink-0 sm:size-6" aria-hidden />}
            />

            <DashboardMetricCard
              color="orange"
              title="Discounted Sales"
              value={
                filteredSales.filter((sale: any) =>
                  (Array.isArray(sale.items) ? sale.items : []).some((item: any) => item.isDiscounted === true)
                ).length
              }
              description={
                negotiationFilter === "discounted" ? (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Check className="h-3.5 w-3.5" aria-hidden /> Filter active — click to clear
                  </span>
                ) : (
                  "Click card to filter discounted lines"
                )
              }
              icon={<Tag className="size-5 shrink-0 sm:size-6" aria-hidden />}
              onClick={() => setNegotiationFilter(negotiationFilter === "discounted" ? "all" : "discounted")}
              className={
                negotiationFilter === "discounted"
                  ? "ring-2 ring-white/95 ring-offset-2 ring-offset-orange-950"
                  : ""
              }
            />

            <DashboardMetricCard
              color="maroon"
              title="Cost of Goods Sold"
              value={
                loading ? (
                  "…"
                ) : (
                  <span className="tabular-nums">₱{formatPhpAmount(lineFinanceDisplay.cogs)}</span>
                )
              }
              description={
                <>
                  <span className="mt-0.5 block !text-white/80">Cost for selected period</span>
                </>
              }
              icon={<Receipt className="size-5 shrink-0 sm:size-6" aria-hidden />}
            />

            <DashboardMetricCard
              color="blue"
              title="Gross revenue"
              value={
                loading ? (
                  "…"
                ) : (
                  <span className="tabular-nums">₱{formatPhpAmount(trueTotalSales - lineFinanceDisplay.cogs)}</span>
                )
              }
              description={
                <>
                  <span className="mt-0.5 block !text-white/80">Sales - COGS for selected period</span>
                </>
              }
              icon={<Boxes className="size-5 shrink-0 sm:size-6" aria-hidden />}
            />

            <DashboardMetricCard
              color="primary"
              title="Net revenue"
              value={
                loading ? (
                  "…"
                ) : (
                  <span className="tabular-nums">₱{formatPhpAmount((trueTotalSales - lineFinanceDisplay.cogs) * (1 - operatingExpensePercent / 100))}</span>
                )
              }
              description={
                <div onClick={(e) => e.stopPropagation()} className="cursor-default">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white/80 font-medium whitespace-nowrap">Less OpEx:</span>
                    <div className="relative flex items-center gap-1.5">
                      {isOpexLocked ? (
                        <div className="flex items-center h-6 px-2 bg-white/5 border border-white/10 rounded text-xs text-white/90">
                          {operatingExpensePercent}%
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={operatingExpensePercent || ""}
                            onChange={(e) => setOperatingExpensePercent(Number(e.target.value) || 0)}
                            className="h-6 w-16 px-1.5 py-0 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/50 text-right pr-4 focus-visible:ring-1 focus-visible:ring-white/50"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/70">%</span>
                        </div>
                      )}
                      <button 
                        onClick={() => setIsOpexLocked(!isOpexLocked)} 
                        className="p-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white shrink-0"
                        title={isOpexLocked ? "Unlock to edit" : "Lock and save"}
                      >
                        {isOpexLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                    </div>
                  </div>
                  <span className="mt-0.5 block !text-white/80">Net calculated after expenses</span>
                </div>
              }
              icon={<TrendingUp className="size-5 shrink-0 sm:size-6" aria-hidden />}
            />
          </div>

          <Card className="bg-card border-primary/10 overflow-hidden">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg lg:text-xl">Sales Records</CardTitle>
                  <CardDescription className="text-sm">All sales transactions and details</CardDescription>
                </div>
                <div className="flex items-center gap-2 lg:gap-3">
                  <Button
                    variant="outline"
                    onClick={toggleAdvancedFilters}
                    className="h-8 px-3 rounded-md border-2 border-[#3B18DA] hover:bg-[#3B18DA]/10 text-[#3B18DA] text-xs font-medium"
                    title="Toggle filters panel"
                  >
                    <div className="flex items-center gap-1">
                      <Filter size={12} className="text-[#3B18DA]" />
                      Filters
                      {(searchQuery !== "" ||
                        selectedCategory !== "all" ||
                        (dateFilter.startDate || dateFilter.endDate) ||
                        amountFilter !== "all" ||
                        soldAtFilter !== "all" ||
                        paymentMethodFilter !== "all" ||
                        negotiationFilter !== "all" ||
                        timePeriod !== "today") && (
                        <span className="w-2 h-2 bg-[#3B18DA] rounded-full animate-pulse"></span>
                      )}
                    </div>
                  </Button>
                  <Select value={timePeriod} onValueChange={setTimePeriod} disabled={usingCustomSaleDates}>
                    <SelectTrigger
                      title={usingCustomSaleDates ? "Clear custom date range in Filters to use quick period" : undefined}
                      className="h-8 border-2 border-gray-200 hover:border-gray-300 text-xs disabled:opacity-50"
                    >
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today"><span className="flex items-center gap-2"><Calendar size={14} /> Today</span></SelectItem>
                      <SelectItem value="weekly"><span className="flex items-center gap-2"><Calendar size={14} /> This Week</span></SelectItem>
                      <SelectItem value="monthly"><span className="flex items-center gap-2"><Calendar size={14} /> This Month</span></SelectItem>
                      <SelectItem value="quarterly"><span className="flex items-center gap-2"><BarChart3 size={14} /> This Quarter</span></SelectItem>
                      <SelectItem value="annually"><span className="flex items-center gap-2"><FileText size={14} /> This Year</span></SelectItem>
                      <SelectItem value="all"><span className="flex items-center gap-2"><Globe size={14} /> All time</span></SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-600">Total Units Sold</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span>Loading...</span>
                        </div>
                      ) : (
                        <>
                          {filteredSales.reduce((sum, sale) => sum + countUnitsInSale(sale), 0)} <span className="text-sm font-normal text-gray-500">units</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="py-4 px-5 text-left font-semibold text-foreground">Date</th>
                      <th className="py-4 px-5 text-left font-semibold text-foreground">Sale ID</th>
                      <th className="py-4 px-5 text-left font-semibold text-foreground">Products</th>
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
                      <th className="py-4 px-5 text-left font-semibold text-foreground">Staff</th>
                      <th className="py-4 px-5 text-center font-semibold text-foreground">Payment Method</th>
                      <th className="py-4 px-5 text-center font-semibold text-foreground">Reference Number</th>
                      <th className="py-4 px-5 text-right font-semibold text-foreground">Amount</th>
                      <th className="py-4 px-5 text-center font-semibold text-foreground">Location</th>
                      <th className="py-4 px-5 text-center font-semibold text-foreground">Discount</th>
                      <th className="py-4 px-5 text-center font-semibold text-foreground">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading sales...</h3>
                            <p className="text-sm text-gray-500">
                              Please wait while we fetch your sales data
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredSales.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center">
                          <div className="flex flex-col items-center">
                            <PesoIcon size={48} className="text-gray-400 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No sales found</h3>
                            <p className="text-sm text-gray-500 mb-6">
                              {searchQuery || selectedCategory !== "all" || amountFilter !== "all" || soldAtFilter !== "all" || paymentMethodFilter !== "all" || negotiationFilter !== "all" || timePeriod !== "today" || dateFilter.startDate || dateFilter.endDate 
                                ? "No sales match your current filters. Try adjusting or clearing them." 
                                : "Start by making your first sale"}
                            </p>
                            <div className="flex gap-3">
                              <Button onClick={() => onNewSale?.()}>
                                <Plus size={16} className="mr-2" />
                                New Sale
                              </Button>
                              {(searchQuery || selectedCategory !== "all" || amountFilter !== "all" || soldAtFilter !== "all" || paymentMethodFilter !== "all" || negotiationFilter !== "all" || timePeriod !== "today" || dateFilter.startDate || dateFilter.endDate) && (
                                <Button 
                                  variant="outline" 
                                  onClick={() => { 
                                    setSelectedCategory("all"); 
                                    setDateFilter({ startDate: "", endDate: "" }); setTempDateFilter({ startDate: "", endDate: "" }); 
                                    setAmountFilter("all"); 
                                    setSoldAtFilter("all"); 
                                    setPaymentMethodFilter("all"); 
                                    setNegotiationFilter("all"); 
                                    setSortBy("date"); 
                                    setSortDirection("desc"); 
                                    setTimePeriod("today"); 
                                    setSearchQuery(""); 
                                    addToast("All filters cleared", "success"); 
                                  }}
                                >
                                  Clear Filters
                                </Button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSales.map((sale: any, rowIndex: number) => {
                        const lineItems = Array.isArray(sale.items) ? sale.items : []
                        const rowKey = String(sale?.id ?? "").trim() || `row-${rowIndex}`
                        return (
                        <tr key={rowKey} className="hover:bg-muted/50 transition-colors">
                          <td className="py-4 px-5 text-muted-foreground text-sm">{formatSaleDate(String(sale.date || sale.createdAt || sale.soldAt || ""))}</td>
                          <td className="py-4 px-5 text-foreground font-medium">{createShortSaleId(sale.id)}</td>
                          <td className="py-4 px-5 text-muted-foreground text-sm">
                            <div className="max-w-md space-y-1">
                              {lineItems.length <= 3 ? (
                                lineItems.map((item: any, index: number) => (
                                  <span key={index} className="inline-block">
                                    {formatSaleLineItemLabel(item.productName, item.quantity)}
                                    {index < lineItems.length - 1 && <span className="mr-2">, </span>}
                                  </span>
                                ))
                              ) : (
                                <div>
                                  {lineItems.slice(0, 3).map((item: any, index: number) => (
                                    <span key={index} className="inline-block">
                                      {formatSaleLineItemLabel(item.productName, item.quantity)}
                                      <span className="mr-2">, </span>
                                    </span>
                                  ))}
                                  {!expandedSales.has(sale.id) && (
                                    <span className="text-violet-600 cursor-pointer hover:text-violet-800 text-xs" onClick={() => toggleSaleExpansion(sale.id)}>
                                      +{lineItems.length - 3} more...
                                    </span>
                                  )}
                                  {expandedSales.has(sale.id) && (
                                    <div>
                                      {lineItems.slice(3).map((item: any, index: number) => (
                                        <span key={index + 3} className="inline-block">
                                          {formatSaleLineItemLabel(item.productName, item.quantity)}
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
                          <td className="py-4 px-5 text-muted-foreground text-sm">
                            <div className="flex flex-wrap gap-1">
                              {(Array.from(new Set(lineItems.map((item: any) => item.category))) as string[]).slice(0, 2).map((cat, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-[#3B18DA]/10 text-[#3B18DA] rounded text-xs">
                                  {cat}
                                </span>
                              ))}
                              {lineItems.length > 2 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  +{lineItems.length - 2}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-5 text-muted-foreground text-sm">{sale.staffName}</td>
                          <td className="py-4 px-5 text-muted-foreground text-sm text-center">{sale.paymentMethod}</td>
                          <td className="py-4 px-5 text-center">
                            {sale.paymentMethod === 'QRPH' && sale.referenceNumber ? (
                              <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200" title={`Reference: ${sale.referenceNumber}`}>
                                {sale.referenceNumber}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-right font-medium text-foreground tabular-nums">₱{formatPhpAmountNonNegative(saleAmountNumber(sale))}</td>
                          <td className="py-4 px-5 text-muted-foreground text-sm text-center">
                            <span className={`px-3 py-1.5 rounded-full text-xs ${sale.soldAt === 'physical' ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'}`}>
                              {sale.soldAt === 'physical' ? 'Store' : 'Online'}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-center">
                            {lineItems.some((item: any) => item.isDiscounted === true) ? (
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
                            <Button variant="ghost" size="sm" className="text-[#3B18DA] hover:bg-[#3B18DA]/10 p-2" onClick={() => handleViewSaleDetails(sale)} title="View Sale Details">
                              <Store size={16} className="text-[#3B18DA]" />
                            </Button>
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={(open) => {
        if (!open && !exportSuccess) {
          addToast("Export action cancelled", "info");
        }
        setShowExportDialog(open);
      }}>
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

      {/* Sale Details Dialog */}
      <Dialog open={showSaleDetails} onOpenChange={setShowSaleDetails}>
        <DialogContent className="max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#3B18DA]">
              <Store size={20} className="text-[#3B18DA]" />
              Sale Details
            </DialogTitle>
            <DialogDescription>
              Transaction information for {selectedSale && createShortSaleId(selectedSale.id)}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              {/* Sale Info */}
              <div className="bg-[#3B18DA]/10 rounded-lg p-4 space-y-2 border border-[#3B18DA]/20">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{new Date(selectedSale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Staff:</span>
                  <span className="font-medium">{selectedSale.staffName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment:</span>
                  <span className="font-medium flex items-center gap-1">
                    {selectedSale.paymentMethod === 'Cash' ? <Banknote size={14} className="text-[#3B18DA]" /> : <Smartphone size={14} className="text-[#3B18DA]" />}
                    {selectedSale.paymentMethod}
                  </span>
                </div>
                {selectedSale.paymentMethod === 'QRPH' && selectedSale.referenceNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Reference:</span>
                    <span className="font-medium font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {selectedSale.referenceNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Location:</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${selectedSale.soldAt === 'physical' ? 'bg-[#3B18DA]/10 text-[#3B18DA]' : 'bg-[#3B18DA]/10 text-[#3B18DA]'}`}>
                    {selectedSale.soldAt === 'physical' ? 'Physical Store' : 'Online'}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Package size={16} className="text-gray-500" />
                  Items ({selectedSale.items.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {selectedSale.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0 gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{item.productName}</div>
                        <div className="text-xs text-gray-500">
                          Qty {item.quantity} · Sell ₱
                          {formatPhpAmountNonNegative(lineRevenue(item) / Math.max(1, lineQuantity(item)))} ea
                          {item.isDiscounted && (
                            <span className="ml-2 text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-xs">DISCOUNTED</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Cost ₱
                          {formatPhpAmountNonNegative(lineCogs(item) / Math.max(1, lineQuantity(item)))} ea · Line profit ₱
                          {formatPhpAmountNonNegative(lineProfit(item))}
                        </div>
                      </div>
                      <div className="font-semibold text-sm tabular-nums shrink-0">
                        ₱{formatPhpAmountNonNegative(lineRevenue(item))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items revenue:</span>
                  <span>₱{formatPhpAmountNonNegative(saleTotalRevenue(selectedSale))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cost of Goods Sold:</span>
                  <span>₱{formatPhpAmountNonNegative(saleTotalCogs(selectedSale))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gross profit (lines):</span>
                  <span>
                    ₱
                    {formatPhpAmountNonNegative(
                      saleTotalRevenue(selectedSale) - saleTotalCogs(selectedSale)
                    )}
                  </span>
                </div>
                {(() => {
                  const lineRev = saleTotalRevenue(selectedSale);
                  const recordedAmount = saleAmountNumber(selectedSale);
                  const taxAmount = Number(selectedSale.tax) || (recordedAmount > lineRev ? recordedAmount - lineRev : 0);
                  
                  return taxAmount > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax / Adjustments:</span>
                      <span>₱{formatPhpAmountNonNegative(taxAmount)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax applied:</span>
                      <span>None</span>
                    </div>
                  );
                })()}
                <div className="flex justify-between text-lg font-bold">
                  <span>Recorded total:</span>
                  <span className="text-[#3B18DA]">₱{formatPhpAmountNonNegative(saleAmountNumber(selectedSale))}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Recorded total may include tax or adjustments vs line sums.
                </p>
              </div>

              {/* Close Button */}
              <Button 
                onClick={() => setShowSaleDetails(false)} 
                className="w-full bg-[#3B18DA] hover:bg-[#2A1199] text-white"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog open={deleteConfirm.open} title="Delete Sale" description="Are you sure you want to delete this sale? This action cannot be undone." confirmText="Delete" cancelText="Cancel" isDangerous={true} onConfirm={confirmDelete} onCancel={() => setDeleteConfirm({ open: false, id: null })} />
    </>
  )
}
