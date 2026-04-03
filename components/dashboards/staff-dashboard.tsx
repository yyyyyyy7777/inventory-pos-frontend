"use client"

import { useState, useEffect } from "react"
import { StaffSidebar } from "@/components/navigation/staff-sidebar"
import { InventoryView } from "@/components/inventory/inventory-view"
import { SalesView } from "@/components/sales/sales-view"
import { POSView } from "@/components/pos/pos-view"
import { EnhancedStaffAnalytics } from "@/components/analytics/enhanced-staff-analytics"
import { CabinetSelector } from "@/components/cabinet/cabinet-selector"
import { LayoutDashboard, Package, ShoppingCart, CreditCard, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

type StaffViewType = "dashboard" | "inventory" | "sales" | "pos"

interface StaffDashboardProps {
  username: string
  onLogout: () => void
}

const viewConfig = {
  dashboard: {
    title: "Dashboard",
    description: () => "",
    icon: LayoutDashboard,
  },
  inventory: {
    title: "Inventory Management",
    description: () => "Manage your product inventory and stock levels",
    icon: Package,
  },
  sales: {
    title: "Sales History",
    description: () => "View and manage sales transactions",
    icon: ShoppingCart,
  },
  pos: {
    title: "Point of Sale",
    description: () => "Process customer sales and transactions",
    icon: CreditCard,
  },
}

export function StaffDashboard({ username, onLogout }: StaffDashboardProps) {
  const [currentView, setCurrentView] = useState<StaffViewType>("dashboard")
  const [selectedCabinet, setSelectedCabinet] = useState("main")

  // Handle mobile back button - navigate to dashboard instead of logging out
  useEffect(() => {
    const handlePopState = () => {
      // If not on dashboard, go to dashboard instead of logging out
      if (currentView !== "dashboard") {
        setCurrentView("dashboard")
        // Push state to prevent back button from exiting app
        window.history.pushState(null, "", window.location.href)
      }
    }

    // Push initial state
    window.history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [currentView])

  const handleViewChange = (view: StaffViewType) => {
    setCurrentView(view)
    // Push state when changing views
    window.history.pushState(null, "", window.location.href)
  }

  const currentConfig = viewConfig[currentView]
  const IconComponent = currentConfig.icon

  // Navigate back to previous view or dashboard
  const handleBack = () => {
    if (currentView !== "dashboard") {
      setCurrentView("dashboard")
    }
  }

  return (
    <div className="flex h-[100dvh] bg-background relative mobile-overflow-hidden overflow-hidden">
      <StaffSidebar currentView={currentView} onViewChange={handleViewChange} onLogout={onLogout} username={username} />
      <div className="flex-1 overflow-auto lg:ml-0">
        <div className="p-4 lg:p-6 pt-14 lg:pt-6">
          <div className="relative overflow-hidden mb-5 bg-[oklch(0.55_0.15_280)] border border-[oklch(0.65_0.20_280)] rounded-2xl shadow-lg">
            <div className="relative p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Mobile Back Button */}
                  {currentView !== "dashboard" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBack}
                      className="lg:hidden flex-shrink-0 w-10 h-10 p-0 text-white hover:bg-white/20 rounded-full"
                    >
                      <ChevronLeft size={24} />
                    </Button>
                  )}
                  <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[oklch(0.75_0.25_280)] shadow-md flex items-center justify-center">
                    <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-[oklch(0.25_0.05_280)]" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {currentConfig.title}
                    </h1>
                    <p className="text-sm text-white/70 line-clamp-1">
                      {typeof currentConfig.description === 'function' ? currentConfig.description() : currentConfig.description}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <CabinetSelector selectedCabinet={selectedCabinet} onSelectCabinet={setSelectedCabinet} showAllOption={currentView !== "inventory"} />
                </div>
              </div>
            </div>
          </div>

          {currentView === "dashboard" && <EnhancedStaffAnalytics cabinet={selectedCabinet} username={username} onViewChange={handleViewChange} />}
          {currentView === "inventory" && <InventoryView isAdmin={false} cabinet={selectedCabinet} username={username} />}
          {currentView === "sales" && <SalesView isAdmin={true} cabinet={selectedCabinet} onNewSale={() => handleViewChange("pos")} />}
          {currentView === "pos" && <POSView cabinet={selectedCabinet} username={username} />}
        </div>
      </div>
    </div>
  )
}
