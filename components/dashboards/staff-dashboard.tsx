"use client"

import { useState } from "react"
import { StaffSidebar } from "@/components/navigation/staff-sidebar"
import { InventoryView } from "@/components/inventory/inventory-view"
import { SalesView } from "@/components/sales/sales-view"
import { POSView } from "@/components/pos/pos-view"
import { EnhancedStaffAnalytics } from "@/components/analytics/enhanced-staff-analytics"
import { CabinetSelector } from "@/components/cabinet/cabinet-selector"

type StaffViewType = "dashboard" | "inventory" | "sales" | "pos"

interface StaffDashboardProps {
  username: string
  onLogout: () => void
}

export function StaffDashboard({ username, onLogout }: StaffDashboardProps) {
  const [currentView, setCurrentView] = useState<StaffViewType>("dashboard")
  const [selectedCabinet, setSelectedCabinet] = useState("main")

  // Get header title based on current view
  const getHeaderTitle = () => {
    switch (currentView) {
      case "dashboard":
        return "Dashboard"
      case "inventory":
        return "Inventory Management"
      case "sales":
        return "Sales History"
      case "pos":
        return "Point of Sale"
      default:
        return "Dashboard"
    }
  }

  // Get header description based on current view
  const getHeaderDescription = () => {
    switch (currentView) {
      case "dashboard":
        return `Welcome, ${username}!`
      case "inventory":
        return "Manage your product inventory and stock levels"
      case "sales":
        return "View and manage sales transactions"
      case "pos":
        return "Process customer sales and transactions"
      default:
        return `Welcome, ${username}!`
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <StaffSidebar currentView={currentView} onViewChange={setCurrentView} onLogout={onLogout} username={username} />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8 bg-primary/10 rounded-lg p-6 border border-primary/30">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-1">{getHeaderTitle()}</h1>
              <p className="text-muted-foreground">{getHeaderDescription()}</p>
            </div>
            <CabinetSelector selectedCabinet={selectedCabinet} onSelectCabinet={setSelectedCabinet} />
          </div>

          {currentView === "dashboard" && <EnhancedStaffAnalytics cabinet={selectedCabinet} username={username} onViewChange={setCurrentView} />}
          {currentView === "inventory" && <InventoryView isAdmin={false} cabinet={selectedCabinet} username={username} />}
          {currentView === "sales" && <SalesView isAdmin={false} cabinet={selectedCabinet} />}
          {currentView === "pos" && <POSView cabinet={selectedCabinet} username={username} />}
        </div>
      </div>
    </div>
  )
}
