"use client"

import { useState } from "react"
import { AdminSidebar } from "@/components/navigation/admin-sidebar"
import { InventoryView } from "@/components/inventory/inventory-view"
import { SalesView } from "@/components/sales/sales-view"
import { POSView } from "@/components/pos/pos-view"
import { EmployeeManagement } from "@/components/employees/employee-management"
import { ActivityLogView } from "@/components/activity/activity-log-view"
import { CabinetSelector } from "@/components/cabinet/cabinet-selector"
import { EnhancedAnalytics } from "@/components/analytics/enhanced-analytics"

type AdminViewType = "dashboard" | "inventory" | "sales" | "pos" | "employees" | "activity"

interface AdminDashboardProps {
  username: string
  onLogout: () => void
}

export function AdminDashboard({ username, onLogout }: AdminDashboardProps) {
  const [currentView, setCurrentView] = useState<AdminViewType>("dashboard")
  const [selectedCabinet, setSelectedCabinet] = useState("main")

  // Get header title based on current view
  const getHeaderTitle = () => {
    switch (currentView) {
      case "dashboard":
        return "Dashboard"
      case "inventory":
        return "Inventory Management"
      case "sales":
        return "Sales Management"
      case "pos":
        return "Point of Sale"
      case "employees":
        return "Employee Management"
      case "activity":
        return "Activity Log"
      default:
        return "Dashboard"
    }
  }

  // Get header description based on current view
  const getHeaderDescription = () => {
    switch (currentView) {
      case "dashboard":
        return `Welcome back, ${username}!`
      case "inventory":
        return "Manage product inventory and stock levels across all cabinets"
      case "sales":
        return "View and manage all sales transactions and reports"
      case "pos":
        return "Process customer sales and transactions"
      case "employees":
        return "Manage staff accounts and permissions"
      case "activity":
        return "Track all system activities and changes"
      default:
        return `Welcome back, ${username}!`
    }
  }

  return (
    <div className="flex h-screen bg-background relative mobile-overflow-hidden">
      <AdminSidebar currentView={currentView} onViewChange={setCurrentView} onLogout={onLogout} username={username} />
      <div className="flex-1 overflow-auto lg:ml-0">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8 safe-area-top">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 lg:mb-8 bg-primary/10 rounded-lg p-4 lg:p-6 border border-primary/30 gap-4">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-foreground mb-1">{getHeaderTitle()}</h1>
              <p className="text-sm lg:text-base text-muted-foreground">{getHeaderDescription()}</p>
            </div>
            {currentView !== "activity" && <CabinetSelector selectedCabinet={selectedCabinet} onSelectCabinet={setSelectedCabinet} />}
          </div>

          {currentView === "dashboard" && <EnhancedAnalytics cabinet={selectedCabinet} username={username} />}
          {currentView === "inventory" && <InventoryView isAdmin={true} cabinet={selectedCabinet} username={username} />}
          {currentView === "sales" && <SalesView isAdmin={true} cabinet={selectedCabinet} />}
          {currentView === "pos" && <POSView cabinet={selectedCabinet} username={username} />}
          {currentView === "employees" && <EmployeeManagement username={username} cabinet={selectedCabinet} />}
          {currentView === "activity" && <ActivityLogView isAdmin={true} />}
        </div>
      </div>
    </div>
  )
}
