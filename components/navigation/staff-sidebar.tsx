"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LogOut, Menu, X, LayoutDashboard, Package, DollarSign, ShoppingCart, Users, FileText } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface StaffSidebarProps {
  currentView: string
  onViewChange: (view: any) => void
  onLogout: () => void
  username: string
}

export function StaffSidebar({ currentView, onViewChange, onLogout, username }: StaffSidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "sales", label: "Sales", icon: DollarSign },
    { id: "pos", label: "POS System", icon: ShoppingCart },
  ]

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('sidebar-open')
    } else {
      document.body.classList.remove('sidebar-open')
    }
    
    return () => {
      document.body.classList.remove('sidebar-open')
    }
  }, [isMobileMenuOpen])

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-background border-border"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen lg:h-full mobile-sidebar
        transform transition-transform duration-300 ease-in-out
        lg:transform-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
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

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id)
                  setIsMobileMenuOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  currentView === item.id
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <IconComponent size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-4 px-2">
            <p className="text-xs text-sidebar-accent-foreground/60">Logged in as</p>
            <p className="text-sm font-semibold text-sidebar-foreground">{username}</p>
          </div>
          <Button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center gap-2"
          >
            <LogOut size={16} />
            Logout
          </Button>

          <ConfirmDialog
            open={showLogoutConfirm}
            title="Confirm Logout"
            description="Are you sure you want to logout?"
            confirmText="Logout"
            cancelText="Cancel"
            isDangerous={true}
            onConfirm={async () => {
              setShowLogoutConfirm(false)
              
              // Call logout API to update last logout
              try {
                await fetch('/api/auth/logout', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ username }),
                });
              } catch (error) {
                console.error('Error updating logout time:', error);
              }
              
              onLogout()
            }}
            onCancel={() => setShowLogoutConfirm(false)}
          />
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
