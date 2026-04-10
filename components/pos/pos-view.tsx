"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, ShoppingCart, Package, Search, MapPin, Calendar, User, Banknote, Smartphone, Globe, Store, Printer, FileSpreadsheet, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProducts, type Product } from "@/contexts/products-context"
import { useSales, type SaleItem, type SalesRecord } from "@/contexts/sales-context"
import { useFormAutosave } from "@/contexts/autosave-context"
import { useToast } from "@/contexts/toast-context"
import { useActivity } from "@/contexts/activity-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { BatchPriceDisplay } from "@/components/shared/batch-price-display"
import { getCurrentPriceFromBatches } from "@/lib/batch-price"

// Type for receipt display (different from SaleItem)
interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  totalPrice: number;
  isDiscounted?: boolean;
}

interface ReceiptData {
  cabinet: string;
  date: string;
  time: string;
  staff: string;
  paymentMethod: string;
  location: string;
  referenceNumber?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  cashReceived: string;
  change: string;
}

interface POSViewProps {
  cabinet: string
  username: string
}

interface CartItem {
  id: string
  name: string
  price: number
  originalPrice: number
  costPrice: number
  quantity: number
  isDiscounted: boolean
}

const categories = [
  "All Categories", "APEX", "Bag", "Banpresto", "Blokees", "Boardgame", "Book", "Cardgame", "Cards",
  "Cosbaby", "Cosbi", "Crochet", "Die Cast", "Ecobag", "Figure", "Five Star", "Food and Snacks",
  "Funko Bitty", "Funko Dorbz", "Funko Keychain", "Funko Kinder Joy", "Funko Gold", "Funko Minis",
  "Funko Pins", "Funko POP", "Funko Rewind", "Funko Soda", "Funko Wocky Wobbler", "Harry Potter Items",
  "Hoodies", "Keychain", "McFarlane", "Mug", "Minis", "Nendoroid", "Others", "Pez", "Pins",
  "Pop Mart", "Profit", "Protectors", "QFig", "QPosket", "Quiccs", "Resins", "SHFiguarts",
  "Shirts", "Sleeves", "Sorcery Box", "Stickers", "Stuffed Toys", "Toploaders", "ZD Toys"
]

export function POSView({ cabinet, username }: POSViewProps) {
  const { getProductsByCabinet, decrementProductStockLocally, getOnShelfStock, loading: productsLoading } = useProducts()
  const products = getProductsByCabinet(cabinet)
  const { addSale, refreshSales } = useSales()
  const { addToast } = useToast()
  const { addActivity } = useActivity()
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [showOutOfStock, setShowOutOfStock] = useState(false)
  const [sortAlpha, setSortAlpha] = useState<"none" | "az" | "za">("none")
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [completedSale, setCompletedSale] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [receiptTime, setReceiptTime] = useState<Date | null>(null)
  const [saleLocation, setSaleLocation] = useState<'online' | 'physical'>('physical')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qrph'>('cash')
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [cashAmount, setCashAmount] = useState<string>('')
  const [change, setChange] = useState<number>(0)
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [showQrphConfirmDialog, setShowQrphConfirmDialog] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [currentSaleData, setCurrentSaleData] = useState<any>(null)
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [taxRate, setTaxRate] = useState<number>(12)
  const [priceEditingEnabled, setPriceEditingEnabled] = useState(false)
  const [discountConfirmDialog, setDiscountConfirmDialog] = useState(false)
  const [discountTimeouts, setDiscountTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map())
  const [onShelfStock, setOnShelfStock] = useState<Record<string, number>>({})
  /** Online: false until first /api/stock-batches response for this mount/catalog (avoids empty flash). */
  const [onShelfStockReady, setOnShelfStockReady] = useState(false)
  const [isProcessingSale, setIsProcessingSale] = useState(false)
  const saleSubmitLockRef = useRef(false)
  const saleLockKey = `pos-sale-lock-${cabinet}`

  type PosCartAutosave = {
    cart?: CartItem[]
    searchQuery?: string
    selectedCategory?: string
    saleLocation?: string
    paymentMethod?: string
  }

  const restorePosCartFromAutosave = useCallback(
    (restoredData: PosCartAutosave) => {
      if (Array.isArray(restoredData.cart)) {
        setCart(restoredData.cart)
      }
      setSearchQuery(restoredData.searchQuery ?? "")
      setSelectedCategory(restoredData.selectedCategory ?? "All Categories")
      const loc = restoredData.saleLocation
      setSaleLocation(loc === "online" || loc === "physical" ? loc : "physical")
      const pm = restoredData.paymentMethod
      setPaymentMethod(pm === "qrph" || pm === "cash" ? pm : "cash")
      addToast("Restored your previous cart session", "info")
    },
    [addToast]
  )

  const { showRestorePrompt, acceptRestore, rejectRestore } = useFormAutosave(
    `pos-cart-${cabinet}`,
    { cart, searchQuery, selectedCategory, saleLocation, paymentMethod },
    restorePosCartFromAutosave,
    {
      shouldOfferRestore: (data) =>
        Array.isArray(data.cart) && data.cart.length > 0,
    }
  )

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])
  
  // Cleanup discount timeouts on unmount
  useEffect(() => {
    return () => {
      discountTimeouts.forEach(timeout => clearTimeout(timeout));
    }
  }, [])
  
  // Log products for debugging
  useEffect(() => {
    console.log('Products in POS:', products);
    console.log('Current cabinet:', cabinet);
  }, [products, cabinet])

  // Radix Select throws if value is not present in items; keep category in sync.
  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory("All Categories")
    }
  }, [selectedCategory])

  const productIdsKey =
    products.length === 0
      ? ""
      : products
          .map((p) => String(p.id))
          .sort()
          .join("|")

  // Fetch on-shelf stock (deps stable via productIdsKey, not new products[] each render)
  useEffect(() => {
    let cancelled = false

    if (products.length === 0) {
      setOnShelfStockReady(true)
      return () => {
        cancelled = true
      }
    }

    setOnShelfStockReady(false)

    const fetchOnShelfStock = async () => {
      try {
        const response = await fetch(`/api/stock-batches?batch=all&cabinet=${cabinet}`)
        if (cancelled) return
        if (response.ok) {
          const stockMap = await response.json()
          setOnShelfStock(stockMap)
        }
      } catch (err) {
        console.error("Error fetching on-shelf stock:", err)
      } finally {
        if (!cancelled) setOnShelfStockReady(true)
      }
    }

    void fetchOnShelfStock()
    return () => {
      cancelled = true
    }
  }, [cabinet, productIdsKey])

  const filteredProducts = products.filter((product) => {
    const nameStr = String(product.name ?? "")
    const skuStr = String(product.sku ?? "")
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      nameStr.toLowerCase().includes(q) || skuStr.toLowerCase().includes(q)

    const matchesCategory =
      selectedCategory === "All Categories" || product.category === selectedCategory

    const stockQty = Number(product.stock) || 0

    // List by product.stock so items are not hidden when batch API omits them or
    // stock is only in non–on-shelf batches. On-shelf is enforced in addToCart when online.
    if (showOutOfStock) {
      return matchesSearch && matchesCategory
    }
    return matchesSearch && matchesCategory && stockQty > 0
  })

  const visibleProducts = React.useMemo(() => {
    if (sortAlpha === "none") return filteredProducts
    const dir = sortAlpha === "az" ? 1 : -1
    return [...filteredProducts].sort(
      (a, b) => dir * String(a.name ?? "").localeCompare(String(b.name ?? ""))
    )
  }, [filteredProducts, sortAlpha])

  
  const addToCart = async (product: Product) => {
    // Check if there's a completed sale receipt showing
    if (showReceipt && currentSaleData) {
      // Show toast notification instead of adding to cart
      addToast("Please start a new sale before adding items to cart.", "warning");
      return;
    }

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine
    const useStockUntilShelfHydrates =
      isOffline ||
       (typeof navigator !== "undefined" && navigator.onLine && !onShelfStockReady)
    const shelfKey = String(product.id)
    const availableOnShelf = useStockUntilShelfHydrates
      ? product.stock || 0
      : Number(onShelfStock[shelfKey]) || 0
    if (availableOnShelf <= 0) {
      addToast(`${product.name} is not available on shelf. Please transfer from storage first.`, "error");
      return;
    }

    // Check if product is in stock
    if (product.stock <= 0) {
      console.log('Cannot add out of stock product to cart');
      return;
    }
    
    // Calculate how many items are already in the cart
    const currentQuantityInCart = cart.reduce((total, item) => 
      item.id === product.id ? total + item.quantity : total, 0
    );
    
    // Check if we can add more of this item
    if (currentQuantityInCart >= product.stock) {
      console.log('Not enough stock available');
      return;
    }
    
    // Get current batch price
    const { price: batchPrice } = await getCurrentPriceFromBatches(String(product.id), cabinet);
    
    // Update or add the item to the cart
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      // Set receipt time if this is the first item in cart
      if (prevCart.length === 0) {
        setReceiptTime(new Date());
      }

      if (existingItem) {
        return prevCart.map((item): CartItem =>
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        const newItem: CartItem = {
          id: product.id,
          name: product.name,
          price: batchPrice,
          originalPrice: batchPrice,
          costPrice: product.costPrice || batchPrice * 0.7, // Default to 70% of selling price if no cost price
          quantity: 1,
          isDiscounted: false,
        };
        return [...prevCart, newItem];
      }
    });
  }

  const removeFromCart = (id: string) => {
    // Prevent removal if receipt is showing (sale completed)
    if (showReceipt && currentSaleData) {
      addToast("Cannot modify cart after sale completion. Please start a new sale.", "warning");
      return;
    }
    setCart(cart.filter((item) => item.id !== id));
  }

  const updateQuantity = (id: string, quantity: number) => {
    // Prevent modification if receipt is showing (sale completed)
    if (showReceipt && currentSaleData) {
      addToast("Cannot modify cart after sale completion. Please start a new sale.", "warning");
      return;
    }
    
    if (quantity <= 0) {
      removeFromCart(id);
    } else {
      // Find the product to check stock
      const product = products.find((p) => p.id === id);
      if (product && quantity > product.stock) {
        // Don't allow adding more than available stock
        quantity = product.stock;
      }
      setCart(
        cart.map((item) =>
          item.id === id ? { ...item, quantity } : item
        )
      );
    }
  }

  const updateItemPrice = (id: string, newPrice: number) => {
    // Prevent modification if receipt is showing (sale completed)
    if (showReceipt && currentSaleData) {
      addToast("Cannot modify cart after sale completion. Please start a new sale.", "warning");
      return;
    }
    
    const cartItem = cart.find(item => item.id === id);
    if (cartItem && newPrice > cartItem.originalPrice) {
      addToast("Price cannot be increased above original price. Only discounts are allowed.", "error");
      return;
    }
    
    // Clear any existing timeout for this item
    const existingTimeout = discountTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set a new timeout to show discount toast after user stops typing
    const timeout = setTimeout(() => {
      const currentItem = cart.find(item => item.id === id);
      if (currentItem && newPrice < currentItem.originalPrice && newPrice !== currentItem.price) {
        const discountAmount = (currentItem.originalPrice - newPrice) * currentItem.quantity;
        addToast(`Discount applied: ₱${discountAmount.toLocaleString()} saved on ${currentItem.name}`, "success");
      }
      // Remove timeout from map
      setDiscountTimeouts(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }, 1000); // Wait 1 second after user stops typing
  
  // Add timeout to map
  setDiscountTimeouts(prev => {
    const newMap = new Map(prev);
    newMap.set(id, timeout);
    return newMap;
  });
  
  setCart(cart.map(item => {
    if (item.id === id) {
      const isDiscounted = newPrice < item.originalPrice;
      return { 
        ...item, 
        price: Math.max(0, newPrice), 
        isDiscounted 
      };
    }
    return item;
  }));
  };

  const total = cart.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0)

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    setShowPaymentDialog(true);
  }

  const exportToExcel = (saleData: ReceiptData) => {
    // Create CSV that matches receipt design
    let csvContent = '\ufeff'; // UTF-8 BOM for Excel
    csvContent += 'The WheezardPH\n';
    csvContent += 'The WheezardPH\n\n';
    csvContent += 'Cabinet: ' + saleData.cabinet + '\n';
    csvContent += saleData.date + ' • ' + saleData.time + '\n';
    csvContent += 'Staff: ' + saleData.staff + '\n\n';
    
    csvContent += 'ITEMS PURCHASED\n';
    csvContent += 'Item,Quantity × Price = Total\n';
    
    saleData.items.forEach((item: any) => {
      csvContent += `"${item.name}","${item.quantity} × ₱${item.unitPrice.toLocaleString()} = ₱${item.totalPrice.toLocaleString()}"\n`;
    });
    
    csvContent += '\nPRICE BREAKDOWN\n';
    csvContent += 'Subtotal,₱' + saleData.subtotal.toLocaleString() + '\n';
    if (taxEnabled) {
      csvContent += 'Tax (' + taxRate + '%),₱' + saleData.tax.toLocaleString() + '\n';
    }
    csvContent += 'TOTAL,₱' + saleData.total.toLocaleString() + '\n';
    
    if (saleData.paymentMethod === 'Cash') {
      csvContent += '\nPAYMENT INFO\n';
      csvContent += 'Payment Method,Cash\n';
      csvContent += 'Cash Received,' + saleData.cashReceived + '\n';
      csvContent += 'Change,' + saleData.change + '\n';
    } else {
      csvContent += '\nPAYMENT INFO\n';
      csvContent += 'Payment Method,QRPH\n';
      if (saleData.referenceNumber) {
        csvContent += 'Reference Number,' + saleData.referenceNumber + '\n';
      }
    }
    
    csvContent += '\n*** Thank You! ***\n';
    csvContent += 'Please come again!\n';
    csvContent += saleData.location + '\n';
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `TheWheezardPH_Receipt_${currentTime.getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const printReceipt = (saleData: ReceiptData) => {
    // Create HTML content for printing with direct image reference
    let printContent = `
    <html>
    <head>
      <style>
        @page {
          size: 80mm 200mm;
          margin: 5mm;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          margin: 0;
          padding: 8px;
          line-height: 1.2;
        }
        .receipt {
          width: 100%;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding: 8px 0;
          margin-bottom: 8px;
        }
        .logo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
        }
        .logo {
          height: 32px;
          width: 32px;
          margin-right: 6px;
          object-fit: contain;
        }
        .store-name {
          font-size: 14px;
          font-weight: bold;
        }
        .info-left {
          text-align: left;
          margin: 2px 0;
          font-size: 9px;
        }
        .items-header {
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 4px 0;
          margin: 6px 0;
          font-weight: bold;
          font-size: 10px;
        }
        .item {
          margin: 2px 0;
          font-size: 9px;
        }
        .totals {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 6px 0;
          margin: 6px 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          font-size: 9px;
        }
        .grand-total {
          font-weight: bold;
          font-size: 11px;
        }
        .payment-info {
          margin: 6px 0;
          font-size: 9px;
        }
        .footer {
          text-align: center;
          border-top: 1px dashed #000;
          padding: 6px 0;
          margin-top: 10px;
          font-size: 8px;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="logo-container">
            <img src="/Wheezard%20logo.png" alt="The WheezardPH" class="logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display:none;"><Sparkles size={32} /></span>
            <div class="store-name">The WheezardPH</div>
          </div>
        </div>

        <div class="info-left">Cabinet: ${saleData.cabinet}</div>
        <div class="info-left">${saleData.date} • ${saleData.time}</div>
        <div class="info-left">Staff: ${saleData.staff}</div>

        <div class="items-header">
          ITEMS PURCHASED
        </div>

        <div class="items-list">
    `;
    
    saleData.items.forEach((item: ReceiptItem) => {
      printContent += `
          <div class="item">
            ${item.name}
            <br>
            ${item.quantity} × ₱${item.unitPrice.toLocaleString()} = ₱${item.totalPrice.toLocaleString()}
          </div>
      `;
    });
    
    printContent += `
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>₱${saleData.subtotal.toLocaleString()}</span>
          </div>`;
    
    if (taxEnabled) {
      printContent += `
          <div class="total-row">
            <span>Tax (${taxRate}%):</span>
            <span>₱${saleData.tax.toLocaleString()}</span>
          </div>`;
    }
    
    printContent += `
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>₱${saleData.total.toLocaleString()}</span>
          </div>
        </div>

        <div class="payment-info">
          <div>Payment: ${saleData.paymentMethod === 'Cash' ? 'Cash' : 'QRPH'}</div>
    `;
    
    if (saleData.paymentMethod === 'Cash') {
      printContent += `
          <div>Cash Received: ${saleData.cashReceived}</div>
          <div>Change: ${saleData.change}</div>`;
    }
    
    printContent += `
        </div>

        <div class="footer">
          <div>*** Thank You! ***</div>
          <div>Please come again!</div>
          <div style="margin-top: 6px;">${saleData.location}</div>
        </div>
      </div>
    </body>
    </html>
    `;
    
    // Create print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  }

  // Create live receipt data
  const getLiveReceiptData = (): ReceiptData => {
    const finalTotal = Math.round(total * (1 + (taxEnabled ? taxRate / 100 : 0)));
    const tax = Math.round(total * (taxEnabled ? taxRate / 100 : 0));
    
    return {
      cabinet,
      date: receiptTime ? receiptTime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : currentTime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: receiptTime ? receiptTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      staff: username,
      paymentMethod: paymentMethod === 'cash' ? 'Cash' : 'QRPH',
      location: saleLocation === 'online' ? 'Online' : 'Physical',
      items: cart.map((item: CartItem): ReceiptItem => {
        return {
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          originalPrice: item.originalPrice,
          totalPrice: item.price * item.quantity,
          isDiscounted: item.isDiscounted
        };
      }),
      subtotal: total,
      tax: tax,
      total: finalTotal,
      cashReceived: paymentMethod === 'cash' && cashAmount ? `₱${parseFloat(cashAmount).toLocaleString()}` : 'N/A',
      change: paymentMethod === 'cash' ? `₱${(parseFloat(cashAmount) - finalTotal).toLocaleString()}` : 'N/A'
    };
  }

  const processSale = async () => {
    // Prevent duplicate submits even before React state updates finish.
    if (saleSubmitLockRef.current) {
      addToast("A sale is already being processed. Please wait.", "warning");
      return;
    }

    // Cross-reload lock with short TTL to avoid accidental duplicate sale creation
    // when staff refreshes while an in-flight request is still processing.
    const nowMs = Date.now();
    try {
      const existingLock = localStorage.getItem(saleLockKey);
      if (existingLock) {
        const lockTime = Number(existingLock);
        if (!Number.isNaN(lockTime) && nowMs - lockTime < 45000) {
          addToast("Previous sale is still processing. Please wait a few seconds.", "warning");
          return;
        }
      }
      localStorage.setItem(saleLockKey, String(nowMs));
    } catch {
      // Ignore localStorage failures; in-memory lock still protects current tab.
    }

    saleSubmitLockRef.current = true;
    setIsProcessingSale(true);
    
    try {
      console.log('Processing sale with payment method:', paymentMethod);
      console.log('Cash amount:', cashAmount);
      console.log('Reference number:', referenceNumber);
      console.log('Cart items:', cart.length);
      
      const finalTotal = Math.round(total * (1 + (taxEnabled ? taxRate / 100 : 0)));
      const tax = Math.round(total * (taxEnabled ? taxRate / 100 : 0));
      const cashReceived = parseFloat(cashAmount) || 0;
      const calculatedChange = paymentMethod === 'cash' ? cashReceived - finalTotal : 0;
      
      console.log('Final total:', finalTotal);
      console.log('Cash received:', cashReceived);
      console.log('Calculated change:', calculatedChange);
      
      // Validate cash payment
      if (paymentMethod === 'cash') {
        if (!cashAmount || cashAmount.trim() === '') {
          console.log('Cash payment failed: No cash amount entered');
          addToast("Please enter the cash amount received", "error");
          setIsProcessingSale(false);
          return;
        }
        if (cashReceived < finalTotal) {
          console.log('Cash payment failed: Insufficient cash');
          addToast("Insufficient cash amount. Please enter at least ₱" + finalTotal.toLocaleString(), "error");
          setIsProcessingSale(false);
          return;
        }
      }
      
      // Validate QRPH payment
      if (paymentMethod === 'qrph' && !referenceNumber.trim()) {
        console.log('QRPH payment failed: No reference number');
        addToast("Please enter the QRPH reference number", "error");
        setIsProcessingSale(false);
        return;
      }
      
      // Prepare sale items first so we never leave receipt state half-updated on validation failure.
      const saleItems: SaleItem[] = [];
      for (const item of cart) {
        const product = products.find((p) => p.id === item.id);
        if (!product) {
          addToast(
            `Product not found (try refreshing inventory): ${item.name || item.id}`,
            "error"
          );
          return;
        }
        const isDiscounted = item.price < item.originalPrice;
        console.log(
          `Discount check for ${item.name}: sale price=${item.price}, original price=${item.originalPrice}, isDiscounted=${isDiscounted}`
        );
        const costBasis = item.costPrice || item.originalPrice * 0.7;
        saleItems.push({
          productName: item.name,
          category: product.category || "Unknown",
          quantity: item.quantity,
          price: item.price,
          originalPrice: item.originalPrice,
          costPrice: costBasis,
          isDiscounted,
          profit: (item.price - costBasis) * item.quantity,
        });
        console.log(`Sale item for ${item.name}:`, saleItems[saleItems.length - 1]);
      }

      const saleData: ReceiptData = {
        cabinet,
        date: currentTime.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        time: currentTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        staff: username,
        paymentMethod: paymentMethod === "cash" ? "Cash" : "QRPH",
        location: saleLocation === "online" ? "Online" : "Physical",
        referenceNumber: paymentMethod === "qrph" ? referenceNumber : undefined,
        items: cart.map(
          (item: CartItem): ReceiptItem => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            originalPrice: item.originalPrice,
            totalPrice: item.price * item.quantity,
            isDiscounted: item.isDiscounted,
          })
        ),
        subtotal: total,
        tax: tax,
        total: finalTotal,
        cashReceived:
          paymentMethod === "cash" ? `₱${cashReceived.toLocaleString()}` : "N/A",
        change:
          paymentMethod === "cash"
            ? `₱${calculatedChange.toLocaleString()}`
            : "N/A",
      };

      setCurrentSaleData(saleData);
      setChange(calculatedChange);
      
      // Persist the final payable amount (VAT-inclusive when enabled).
      const totalAmount = finalTotal;
      
      // Use ISO timestamp for reliable timezone-safe storage/parsing.
      const saleTimestamp = new Date().toISOString();
      
      // Add the sale to the database
      const saleDataToSend: Omit<SalesRecord, 'id' | 'createdAt' | 'updatedAt'> = {
        date: saleTimestamp,
        items: saleItems,
        amount: totalAmount,
        paymentMethod: paymentMethod === 'cash' ? 'Cash' : 'QRPH',
        staffName: username,
        cabinet: cabinet,
        soldAt: saleLocation,
        requestKey: `${cabinet}-${username}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        referenceNumber: paymentMethod === 'qrph' ? referenceNumber : undefined,
      };
      
      console.log('Sending sale data:', JSON.stringify(saleDataToSend, null, 2));
      
      // Wait only for sale creation. Activity logging runs in the background
      // so cashier flow is not delayed by activity API latency.
      await addSale(saleDataToSend);

      // Deduct product stock in local state immediately.
      // This keeps POS stock accurate even when background refresh/API sync is delayed.
      await Promise.allSettled(
        cart.map((item) => decrementProductStockLocally(item.id, item.quantity, cabinet))
      );

      void (async () => {
        try {
          const activityItemsList = saleItems.map(item => `${item.productName} (${item.quantity}x @ ₱${item.price})`).join(', ');
          const activityDetails = paymentMethod === 'qrph' && referenceNumber
            ? `Sold ${saleItems.length} item(s) in ${cabinet} cabinet - Items: ${activityItemsList} - Total: ₱${totalAmount.toFixed(2)} - Payment: QRPH - Reference: ${referenceNumber} - Location: ${saleLocation}`
            : `Sold ${saleItems.length} item(s) in ${cabinet} cabinet - Items: ${activityItemsList} - Total: ₱${totalAmount.toFixed(2)} - Payment: ${paymentMethod.toUpperCase()} - Location: ${saleLocation}`;

          await addActivity({
            username: username,
            activity: "Processed sale",
            details: activityDetails,
            category: "sale"
          });
        } catch (activityError) {
          console.error('Background activity logging failed:', activityError);
        }
      })();
      
      console.log('Sale added successfully!');
      
      // Only close dialog and show receipt AFTER sale is confirmed
      setShowPaymentDialog(false);
      setShowReceipt(true);
      addToast("Sale completed successfully!", "success");
      
      // Clear cart and reset states
      setCart([]);
      setReceiptTime(null);
      setReferenceNumber('');
      setCashAmount('');
      setChange(0);
      rejectRestore();
      
      // Refresh data in background (non-blocking)
      setTimeout(() => {
        refreshSales(cabinet).catch(err => console.error('Failed to refresh sales:', err));
      }, 100);
      
    } catch (error) {
      console.error('Error processing sale:', error);
      addToast("Failed to process sale. Please try again.", "error");
      // Keep dialog open on error so user can retry
    } finally {
      saleSubmitLockRef.current = false;
      try {
        localStorage.removeItem(saleLockKey);
      } catch {
        // Ignore localStorage failures.
      }
      setIsProcessingSale(false);
    }
  }

  return (
    <>
      {/* Restore Prompt Dialog */}
      {showRestorePrompt && (
        <Dialog open={showRestorePrompt} onOpenChange={(open) => !open && rejectRestore()}>
          <DialogContent className="max-w-md mx-4">
            <DialogHeader>
              <DialogTitle>Restore Previous Session?</DialogTitle>
              <DialogDescription>
                You have unsaved items from your previous cart session. Would you like to restore them?
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3">
              <Button
                onClick={acceptRestore}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Restore Cart
              </Button>
              <Button
                onClick={rejectRestore}
                variant="outline"
                className="flex-1"
              >
                Start Fresh
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex flex-col xl:grid xl:grid-cols-3 gap-4 lg:gap-6">
      {/* Cart - Shows first on mobile, sticky on desktop */}
      <div className="xl:col-span-1 order-first xl:order-last">
        <Card className="bg-card border-primary/10 xl:sticky xl:top-8 h-fit shadow-md">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShoppingCart size={18} />
              Cart
              <span className="ml-auto text-sm font-normal text-muted-foreground">({cart.length} items)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 && !showReceipt && (
              <p className="text-muted-foreground text-center py-8">Your cart is empty</p>
            )}
            
            {cart.length > 0 && !showReceipt && (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="border border-border rounded-lg p-3 bg-muted/50">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-foreground text-sm">{item.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromCart(item.id)}
                          disabled={showReceipt && currentSaleData}
                          title={showReceipt && currentSaleData ? "Cannot delete items after sale completion" : "Remove item"}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {priceEditingEnabled ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">₱</span>
                              <Input
                                type="number"
                                value={item.price}
                                onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                className="w-20 h-6 text-xs px-1"
                                disabled={showReceipt && currentSaleData}
                              />
                            </div>
                          ) : (
                            <div>
                              <p className={`text-muted-foreground ${item.isDiscounted ? 'line-through text-xs' : ''}`}>
                                ₱{item.originalPrice.toLocaleString()}
                              </p>
                              {item.isDiscounted && (
                                <p className="text-orange-600 font-medium">
                                  ₱{item.price.toLocaleString()}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const newQuantity = parseInt(e.target.value) || 0;
                              const maxStock = products.find((p) => p.id === item.id)?.stock || 0;
                              if (newQuantity >= 0 && newQuantity <= maxStock) {
                                updateQuantity(item.id, newQuantity);
                              }
                            }}
                            className="w-20 h-8 text-center font-medium"
                            min="0"
                            max={products.find((p) => p.id === item.id)?.stock || 0}
                            disabled={showReceipt && currentSaleData}
                            title={showReceipt && currentSaleData ? "Cannot modify quantity after sale completion" : "Type quantity for bulk orders"}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tax Controls */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center">
                      <input
                        type="checkbox"
                        checked={taxEnabled}
                        onChange={(e) => setTaxEnabled(e.target.checked)}
                        className="mr-2"
                      />
                      Enable Tax
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-muted-foreground">Tax Rate:</label>
                      <Input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                        disabled={!taxEnabled}
                        className="w-16 h-8 text-sm"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  
                  {cart.length > 0 && (
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center">
                        <input
                          type="checkbox"
                          checked={priceEditingEnabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDiscountConfirmDialog(true);
                            } else {
                              setPriceEditingEnabled(false);
                            }
                          }}
                          className="mr-2"
                        />
                        Enable Discount
                      </label>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleCompleteSale}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10"
                  disabled={cart.length === 0}
                >
                  Complete Sale
                </Button>
              </>
            )}

            {/* Live Receipt Display - Shows when cart has items OR after sale completion */}
            {(cart.length > 0 || showReceipt) && (
                  <div className="border-t border-border pt-4">
                    <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 space-y-4">
                      {/* Store Info */}
                      <div className="text-center border-b-2 border-gray-300 pb-4">
                        <div className="flex items-center justify-center mb-2">
                          <img 
                            src={encodeURI('/Wheezard logo.png')} 
                            alt="The WheezardPH" 
                            className="h-10 w-10 sm:h-12 sm:w-12 mr-2 object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          <h3 className="font-bold text-base sm:text-lg text-gray-900">The WheezardPH</h3>
                        </div>
                        <div className="text-left space-y-1">
                          <p className="text-xs sm:text-sm text-gray-700 font-medium flex items-center gap-1">
                            <MapPin size={14} className="text-gray-500" /> Cabinet: {cabinet}
                          </p>
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <Calendar size={14} className="text-gray-500" /> {receiptTime?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) || currentTime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • {receiptTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <User size={14} className="text-gray-500" /> Staff: {username}
                          </p>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2">
                        <div className="font-bold text-xs sm:text-sm border-b-2 border-gray-300 pb-2 text-gray-900">
                          {showReceipt ? 'ITEMS PURCHASED' : 'CURRENT ITEMS'}
                        </div>
                        <div className={showReceipt ? "" : "max-h-32 overflow-y-auto"}>
                          {showReceipt && currentSaleData ? (
                            currentSaleData.items.length === 0 ? (
                              <div className="text-xs sm:text-sm text-gray-500 text-center py-4">No items in cart</div>
                            ) : (
                              currentSaleData.items.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between items-start py-2 border-b border-gray-100">
                                  <div className="flex-1">
                                    <div className="font-medium text-xs sm:text-sm text-gray-900">
                                      {item.name}
                                      {item.isDiscounted && <span className="ml-2 text-[10px] sm:text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">DISCOUNTED</span>}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-gray-600">
                                      {item.quantity} × 
                                      {item.isDiscounted ? (
                                        <span>
                                          <span className="line-through text-gray-400">₱{Number(item.originalPrice ?? 0).toLocaleString()}</span>
                                          <span className="text-orange-600 font-medium ml-1">₱{Number(item.unitPrice ?? 0).toLocaleString()}</span>
                                        </span>
                                      ) : (
                                        <span>₱{Number(item.unitPrice ?? 0).toLocaleString()}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right font-semibold text-xs sm:text-sm text-gray-900 min-w-16 sm:min-w-20">
                                    ₱{Number(item.totalPrice ?? 0).toLocaleString()}
                                  </div>
                                </div>
                              ))
                            )
                          ) : (
                            cart.length === 0 ? (
                              <div className="text-xs sm:text-sm text-gray-500 text-center py-4">No items in cart</div>
                            ) : (
                              cart.map((item, index) => {
                                const itemTotal = item.price * item.quantity;
                                return (
                                  <div key={item.id} className="flex justify-between items-start py-2 border-b border-gray-100">
                                    <div className="flex-1">
                                      <div className="font-medium text-xs sm:text-sm text-gray-900">
                                        {item.name}
                                        {item.isDiscounted && <span className="ml-2 text-[10px] sm:text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">DISCOUNTED</span>}
                                      </div>
                                      <div className="text-[10px] sm:text-xs text-gray-600">
                                        {item.quantity} × 
                                        {item.isDiscounted ? (
                                          <span>
                                            <span className="line-through text-gray-400">₱{item.originalPrice.toLocaleString()}</span>
                                            <span className="text-orange-600 font-medium ml-1">₱{item.price.toLocaleString()}</span>
                                            <span className="text-green-600 ml-1">(Save ₱{((item.originalPrice - item.price) * item.quantity).toLocaleString()})</span>
                                          </span>
                                        ) : (
                                          <span>₱{item.price.toLocaleString()}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right font-semibold text-xs sm:text-sm text-gray-900 min-w-16 sm:min-w-20">
                                      ₱{itemTotal.toLocaleString()}
                                    </div>
                                  </div>
                                );
                              })
                            )
                          )}
                        </div>
                      </div>

                      {/* Price Breakdown */}
                      {(showReceipt && currentSaleData) || cart.length > 0 ? (
                        <div className="border-t-2 border-b-2 border-gray-300 py-3 sm:py-4 space-y-2 sm:space-y-3">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-700">Subtotal:</span>
                            <span className="text-gray-900">
                              ₱{(showReceipt && currentSaleData ? currentSaleData.subtotal : total).toLocaleString()}
                            </span>
                          </div>
                          {(taxEnabled || (showReceipt && currentSaleData && currentSaleData.tax > 0)) && (
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-gray-700">Tax ({showReceipt && currentSaleData && Number(currentSaleData.subtotal) > 0
                                ? ((Number(currentSaleData.tax) / Number(currentSaleData.subtotal)) * 100).toFixed(1)
                                : taxRate}%):</span>
                              <span className="text-gray-900">
                                ₱{(showReceipt && currentSaleData ? currentSaleData.tax : Math.round(total * taxRate / 100)).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm sm:text-lg font-bold">
                            <span className="text-gray-900">TOTAL:</span>
                            <span className="text-gray-900">
                              ₱{(showReceipt && currentSaleData ? currentSaleData.total : Math.round(total * (1 + (taxEnabled ? taxRate / 100 : 0)))).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {/* Payment Info */}
                      {showReceipt && currentSaleData && (
                        <div className="text-center space-y-2 sm:space-y-3 border-b border-gray-200 pb-4">
                          <div className="text-xs sm:text-sm text-gray-700 font-medium">
                            Payment: <span className="font-semibold text-gray-900">{currentSaleData.paymentMethod === 'Cash' ? <span className="flex items-center gap-1 inline-flex"><Banknote size={16} /> Cash</span> : <span className="flex items-center gap-1 inline-flex"><Smartphone size={16} /> QRPH</span>}</span>
                          </div>
                          {currentSaleData.paymentMethod === 'Cash' && (
                            <>
                              <div className="text-xs sm:text-sm text-gray-700 font-medium">
                                Cash Received: <span className="font-semibold text-gray-900">{currentSaleData.cashReceived}</span>
                              </div>
                              <div className="text-xs sm:text-sm text-gray-700 font-medium">
                                Change: <span className="font-semibold text-gray-900">{currentSaleData.change}</span>
                              </div>
                            </>
                          )}
                          {currentSaleData.paymentMethod === 'QRPH' && currentSaleData.referenceNumber && (
                            <div className="text-xs sm:text-sm text-gray-700 font-medium">
                              Reference: <span className="font-semibold text-gray-900">{currentSaleData.referenceNumber}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="text-center pt-2 border-t border-gray-200">
                        <p className="text-[10px] sm:text-xs text-gray-500 flex items-center justify-center gap-1"><Smartphone size={12} /> {saleLocation === 'online' ? 'Online Order' : 'Physical Store'}</p>
                      </div>

                      {/* Action Buttons - Only show after sale completion */}
                      {showReceipt && (
                        <div className="flex gap-2 sm:gap-3 pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs sm:text-sm font-medium py-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                            onClick={() => {
                              const receiptData = showReceipt && currentSaleData ? currentSaleData : getLiveReceiptData();
                              printReceipt(receiptData);
                            }}
                          >
                            <Printer size={16} className="mr-1" /> Print
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs sm:text-sm font-medium py-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                            onClick={() => {
                              const receiptData = showReceipt && currentSaleData ? currentSaleData : getLiveReceiptData();
                              exportToExcel(receiptData);
                            }}
                          >
                            <FileSpreadsheet size={16} className="mr-1" /> Excel
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 text-xs sm:text-sm font-medium py-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => {
                              setShowReceipt(false);
                              setCurrentSaleData(null);
                              setReceiptTime(null);
                            }}
                          >
                            New Sale
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
          </CardContent>
        </Card>
      </div>

      {/* Products Section */}
      <div className="xl:col-span-2 space-y-4">
        {/* Live Time Display */}
        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={16} />
            <span className="font-medium">
              {currentTime.toLocaleDateString('en-US', { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-lg font-bold text-primary">
            <span className="tabular-nums">
              {currentTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
              })}
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={saleLocation} onValueChange={(value) => setSaleLocation(value as 'online' | 'physical')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Store Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online"><span className="flex items-center gap-2"><Globe size={16} /> Online</span></SelectItem>
              <SelectItem value="physical"><span className="flex items-center gap-2"><Store size={16} /> Physical</span></SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showOutOfStock ? "default" : "outline"}
            onClick={() => setShowOutOfStock(!showOutOfStock)}
            className="whitespace-nowrap"
          >
            {showOutOfStock ? "Hide Out of Stock" : "Show Out of Stock"}
          </Button>
          <Select value={sortAlpha} onValueChange={(v) => setSortAlpha(v as any)}>
            <SelectTrigger className="w-full sm:w-28 whitespace-nowrap">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default</SelectItem>
              <SelectItem value="az">A–Z</SelectItem>
              <SelectItem value="za">Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Product Grid - Responsive for all devices */}
        {productsLoading && products.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[min(50vh,280px)] rounded-xl border border-dashed border-border bg-muted/25 px-6 py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/45 mb-3" aria-hidden />
            <p className="text-base font-medium text-foreground">No products found</p>
            <p className="text-sm text-muted-foreground mt-1.5">Nothing matches your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
            {visibleProducts.map((product) => (
              <Card
                key={product.id}
                className={`relative overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer ${
                  product.stock > 0 
                    ? 'bg-gradient-to-br from-[oklch(0.55_0.15_280)] to-[oklch(0.65_0.20_280)] border-[oklch(0.6_0.18_280)]' 
                    : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300 opacity-60'
                }`}
                onClick={() => addToCart(product)}
              >
                {/* Glossy overlay */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full" />
                
                <CardContent className="p-3 sm:p-4 relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Category - small, italic, muted */}
                      <p className={`text-[10px] sm:text-[11px] italic truncate ${
                        product.stock > 0 ? 'text-white/60' : 'text-gray-400'
                      }`}>
                        {product.category}
                      </p>
                      
                      {/* Product Name - large, distinctive color */}
                      <p className={`text-base sm:text-lg font-bold leading-snug truncate drop-shadow-md ${
                        product.stock > 0 ? 'text-yellow-300' : 'text-gray-600'
                      }`}>
                        {product.name}
                      </p>
                      
                      {/* SKU - small, mono */}
                      <p className={`text-[10px] font-mono truncate ${
                        product.stock > 0 ? 'text-white/50' : 'text-gray-400'
                      }`}>
                        SKU: {product.sku}
                      </p>
                      
                      {/* Stock info */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className={`text-[10px] sm:text-xs ${
                          product.stock > 0 ? 'text-white/70' : 'text-gray-400'
                        }`}>
                          Stock:
                        </span>
                        <span className={`text-[10px] sm:text-xs font-bold ${
                          product.stock > 0 ? 'text-green-300 drop-shadow-sm' : 'text-red-400'
                        }`}>
                          {product.stock}
                        </span>
                      </div>
                    </div>
                    
                    {/* Icon */}
                    <div className={`rounded-full p-2 sm:p-2.5 flex-shrink-0 shadow-md ${
                      product.stock > 0 
                        ? 'bg-[oklch(0.75_0.25_280)]' 
                        : 'bg-gray-300'
                    }`}>
                      <Package size={18} className={product.stock > 0 ? 'text-[oklch(0.25_0.05_280)]' : 'text-gray-500'} />
                    </div>
                  </div>

                  {/* Price and Add Button */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/25">
                    <div className={`text-lg sm:text-xl font-bold drop-shadow-sm ${
                      product.stock > 0 ? 'text-white' : 'text-gray-600'
                    }`}>
                      <BatchPriceDisplay 
                        productId={String(product.id)} 
                        cabinet={cabinet}
                        className="text-white"
                      />
                    </div>
                    <Button
                      size="sm"
                      className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex-shrink-0 shadow-lg ${
                        product.stock > 0 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                          : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (product.stock > 0) {
                          addToCart(product);
                        }
                      }}
                      disabled={product.stock <= 0}
                    >
                      <Plus size={20} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Payment Method Selection Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        // Prevent closing while processing
        if (!open && isProcessingSale) return;
        setShowPaymentDialog(open);
      }}>
        <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          {/* Loading Overlay */}
          {isProcessingSale && (
            <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center rounded-lg">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
              <p className="text-lg font-semibold text-primary">Processing Sale...</p>
              <p className="text-sm text-muted-foreground mt-2">Please wait</p>
            </div>
          )}
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
            <DialogDescription>
              Choose how the customer will pay
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className="h-20 flex flex-col gap-2"
                onClick={() => {
                  setPaymentMethod('cash');
                  setCashAmount('');
                  setChange(0);
                }}
              >
                <Banknote size={24} />
                <span className="font-medium">Cash</span>
              </Button>
              
              <Button
                variant={paymentMethod === 'qrph' ? 'default' : 'outline'}
                className="h-20 flex flex-col gap-2"
                onClick={() => {
                  setPaymentMethod('qrph');
                  setCashAmount('');
                  setChange(0);
                  setReferenceNumber('');
                }}
              >
                <Smartphone size={24} />
                <span className="font-medium">QRPH</span>
              </Button>
            </div>
            
            {paymentMethod === 'qrph' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Reference Number</label>
                  <Input
                    type="text"
                    placeholder="Enter QRPH reference number"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the reference number from the customer's QRPH payment confirmation
                  </p>
                </div>
              </div>
            )}
            
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold text-primary">
                ₱{Math.round(total * (1 + (taxEnabled ? taxRate / 100 : 0))).toLocaleString()}
              </p>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Cash Received</label>
                  <Input
                    type="number"
                    placeholder="Enter amount received"
                    value={cashAmount}
                    onChange={(e) => {
                      const amount = parseFloat(e.target.value) || 0;
                      setCashAmount(e.target.value);
                      const finalTotal = Math.round(total * (1 + (taxEnabled ? taxRate / 100 : 0)));
                      setChange(amount - finalTotal);
                    }}
                    className="mt-1"
                  />
                </div>
                
                {cashAmount && (
                  <div className={`p-3 rounded-lg text-center ${
                    change >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className="text-sm text-muted-foreground">Change</p>
                    <p className={`text-xl font-bold ${
                      change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ₱{Math.abs(change).toLocaleString()}
                    </p>
                    {change < 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        Insufficient amount
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowPaymentDialog(false);
                setCashAmount('');
                setChange(0);
                setReferenceNumber('');
              }}
              disabled={isProcessingSale}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (paymentMethod === 'qrph') {
                  setShowQrphConfirmDialog(true);
                  return;
                }
                processSale();
              }}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={cart.length === 0 || isProcessingSale}
            >
              {isProcessingSale ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                "Process Payment"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QRPH Confirmation Dialog (reduce misinput) */}
      <Dialog open={showQrphConfirmDialog} onOpenChange={(open) => {
        // Prevent closing while processing
        if (!open && isProcessingSale) return;
        setShowQrphConfirmDialog(open);
      }}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Confirm QRPH Payment</DialogTitle>
            <DialogDescription>
              Please double-check the reference number and amount before finalizing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Reference Number</div>
              <div className="mt-1 text-base font-semibold tracking-wide">
                {referenceNumber?.trim() ? referenceNumber.trim() : <span className="text-destructive">Missing</span>}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-center">
              <div className="text-xs text-muted-foreground">Total Amount</div>
              <div className="mt-1 text-2xl font-bold text-primary">
                ₱{Math.round(total * (1 + (taxEnabled ? taxRate / 100 : 0))).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowQrphConfirmDialog(false)}
              disabled={isProcessingSale}
            >
              Back
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={async () => {
                // Close confirm, keep payment dialog open until success/failure inside processSale
                setShowQrphConfirmDialog(false);
                await processSale();
              }}
              disabled={cart.length === 0 || isProcessingSale || !referenceNumber.trim()}
            >
              Confirm & Process
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* Discount Confirmation Dialog */}
      <Dialog open={discountConfirmDialog} onOpenChange={setDiscountConfirmDialog}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Enable Discount Mode?</DialogTitle>
            <DialogDescription>
              This will allow you to apply discounts to items in the cart
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDiscountConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPriceEditingEnabled(true);
                setDiscountConfirmDialog(false);
                addToast("Discount mode enabled", "success");
              }}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              Enable Discount
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
