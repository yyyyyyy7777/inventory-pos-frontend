import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ProductsProvider } from "@/contexts/products-context"
import { SalesProvider } from "@/contexts/sales-context"
import { EmployeesProvider } from "@/contexts/employees-context"
import { RemittanceProvider } from "@/contexts/remittance-context"
import { ActivityProvider } from "@/contexts/activity-context"
import { ToastProvider } from "@/contexts/toast-context"
import { OfflineProvider } from "@/contexts/offline-context"
import { ToastContainer } from "@/components/ui/toast-container"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { HydrationFix } from "@/components/hydration-fix"
import { ServiceWorkerRegister } from "@/components/pwa-service-worker"

import { AutosaveProvider } from "@/contexts/autosave-context"
import { SyncStatusIndicator } from "@/components/sync-status-indicator"

// <CHANGE> Removed unused @vercel/analytics/next import that was causing error

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "The Wheezard PH",
  description: "Point of Sale and Inventory System",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192x192.png",
    shortcut: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <HydrationFix />

        <ErrorBoundary>
          <ToastProvider>
            <OfflineProvider>
              <AutosaveProvider>
                <ActivityProvider>
                  <ProductsProvider>
                    <SalesProvider>
                      <EmployeesProvider>
                        <RemittanceProvider>
                          {children}
                          <ToastContainer />
                          <ServiceWorkerRegister />
                          <div className="fixed bottom-4 right-4 z-50">
                            <SyncStatusIndicator />
                          </div>
                        </RemittanceProvider>
                      </EmployeesProvider>
                    </SalesProvider>
                  </ProductsProvider>
                </ActivityProvider>
              </AutosaveProvider>
            </OfflineProvider>
          </ToastProvider>
        </ErrorBoundary>
        {/* <CHANGE> Removed Analytics component */}
      </body>
    </html>
  )
}
