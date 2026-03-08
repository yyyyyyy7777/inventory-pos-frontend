"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

interface StaffSidebarProps {
  currentView: string
  onViewChange: (view: any) => void
  onLogout: () => void
  username: string
}

export function StaffSidebar({ currentView, onViewChange, onLogout, username }: StaffSidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "inventory", label: "Inventory", icon: "🗂️" },
    { id: "sales", label: "Sales", icon: "💰" },
    { id: "pos", label: "POS System", icon: "🛒" },
  ]

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <img 
            src="/Wheezard logo.png" 
            alt="The Wheezard PH Logo" 
            className="w-10 h-10 object-contain"
          />
          <div>
            <h2 className="font-bold text-sidebar-foreground">The Wheezard PH</h2>
            <p className="text-xs text-sidebar-accent-foreground/60">Staff Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              currentView === item.id
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-4 px-2">
          <p className="text-xs text-sidebar-accent-foreground/60">Logged in as</p>
          <p className="text-sm font-semibold text-sidebar-foreground">{username}</p>
        </div>
        <Button
          onClick={onLogout}
          className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center gap-2"
        >
          <LogOut size={16} />
          Logout
        </Button>
      </div>
    </div>
  )
}
