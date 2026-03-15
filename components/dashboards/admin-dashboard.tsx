"use client"

import { useState } from "react"
import { AdminSidebar } from "@/components/navigation/admin-sidebar"
import { InventoryView } from "@/components/inventory/inventory-view"
import { SalesView } from "@/components/sales/sales-view"
import { POSView } from "@/components/pos/pos-view"
import { EmployeeManagement } from "@/components/employees/employee-management"
import { ActivityLogView } from "@/components/activity/activity-log-new"
import { CabinetSelector } from "@/components/cabinet/cabinet-selector"
import { EnhancedAnalytics } from "@/components/analytics/enhanced-analytics"
import { LayoutDashboard, Package, ShoppingCart, CreditCard, Users, Activity } from "lucide-react"

type AdminViewType = "dashboard" | "inventory" | "sales" | "pos" | "employees" | "activity"

interface AdminDashboardProps {
  username: string
  onLogout: () => void
}

const viewConfig = {
  dashboard: {
    title: "Dashboard",
    description: (username: string) => `Welcome back, ${username}!`,
    icon: LayoutDashboard,
  },
  inventory: {
    title: "Inventory Management",
    description: () => "Manage product inventory and stock levels across all cabinets",
    icon: Package,
  },
  sales: {
    title: "Sales History",
    description: () => "View and manage all sales transactions and reports",
    icon: ShoppingCart,
  },
  pos: {
    title: "Point of Sale",
    description: () => "Process customer sales and transactions",
    icon: CreditCard,
  },
  employees: {
    title: "Employee Management",
    description: () => "Manage staff accounts and permissions",
    icon: Users,
  },
  activity: {
    title: "Activity Log",
    description: () => "Track all system activities and changes",
    icon: Activity,
  },
}

export function AdminDashboard({ username, onLogout }: AdminDashboardProps) {
  const [currentView, setCurrentView] = useState<AdminViewType>("dashboard")
  const [selectedCabinet, setSelectedCabinet] = useState("main")

  const currentConfig = viewConfig[currentView]
  const IconComponent = currentConfig.icon

  return (
    <div className="flex h-[100dvh] bg-background relative mobile-overflow-hidden overflow-hidden">
      <AdminSidebar currentView={currentView} onViewChange={setCurrentView} onLogout={onLogout} username={username} />
      <div className="flex-1 overflow-auto lg:ml-0">
        <div className="p-4 lg:p-6 pt-14 lg:pt-6">
          <div className="relative overflow-hidden mb-5 bg-[oklch(0.55_0.15_280)] border border-[oklch(0.65_0.20_280)] rounded-2xl shadow-lg">
            <div className="relative p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[oklch(0.75_0.25_280)] shadow-md flex items-center justify-center">
                    <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-[oklch(0.25_0.05_280)]" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {currentConfig.title}
                    </h1>
                    <p className="text-sm text-white/70 line-clamp-1">
                      {typeof currentConfig.description === 'function' ? currentConfig.description(username) : currentConfig.description}
                    </p>
                  </div>
                </div>
                {currentView !== "activity" && currentView !== "employees" && (
                  <div className="flex-shrink-0">
                    <CabinetSelector selectedCabinet={selectedCabinet} onSelectCabinet={setSelectedCabinet} showAllOption={currentView !== "inventory"} />
                  </div>
                )}
              </div>
            </div>
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
