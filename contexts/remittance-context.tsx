"use client"

import React, { createContext, useContext, useState } from "react"

export interface RemittanceRecord {
  id: string
  date: string
  renterName: string
  cabinetId: string
  rentAmount: number
  rentStatus: "paid" | "unpaid" | "partial"
  remittanceAmount: number
  remittanceStatus: "pending" | "released" | "collected"
  notes: string
}

interface RemittanceContextType {
  remittances: RemittanceRecord[]
  addRemittance: (remittance: Omit<RemittanceRecord, "id">) => void
  updateRemittance: (id: string, updates: Partial<RemittanceRecord>) => void
  deleteRemittance: (id: string) => void
  getRemittancesByCabinet: (cabinet: string) => RemittanceRecord[]
  getRentSummary: (cabinet: string) => {
    totalRenters: number
    unpaidRenters: number
    totalUnpaidRent: number
  }
  getRemittanceSummary: (cabinet: string) => {
    pendingRemittances: number
    totalToRemit: number
  }
}

const RemittanceContext = createContext<RemittanceContextType | undefined>(undefined)

export function RemittanceProvider({ children }: { children: React.ReactNode }) {
  const [remittances, setRemittances] = useState<RemittanceRecord[]>([
    {
      id: "REM001",
      date: "2024-12-01",
      renterName: "John Doe",
      cabinetId: "cabinet1",
      rentAmount: 1500,
      rentStatus: "paid",
      remittanceAmount: 0,
      remittanceStatus: "collected",
      notes: "Monthly rent paid in full",
    },
    {
      id: "REM002",
      date: "2024-12-02",
      renterName: "Jane Smith",
      cabinetId: "cabinet2",
      rentAmount: 1500,
      rentStatus: "unpaid",
      remittanceAmount: 1500,
      remittanceStatus: "pending",
      notes: "Awaiting payment",
    },
    {
      id: "REM003",
      date: "2024-12-03",
      renterName: "Bob Wilson",
      cabinetId: "cabinet1",
      rentAmount: 1200,
      rentStatus: "partial",
      remittanceAmount: 600,
      remittanceStatus: "released",
      notes: "Partial payment received",
    },
    {
      id: "REM004",
      date: "2024-12-04",
      renterName: "Alice Brown",
      cabinetId: "cabinet3",
      rentAmount: 1500,
      rentStatus: "unpaid",
      remittanceAmount: 1500,
      remittanceStatus: "pending",
      notes: "Follow up needed",
    },
  ])

  const addRemittance = (remittance: Omit<RemittanceRecord, "id">) => {
    const newId = `REM${String(remittances.length + 1).padStart(3, "0")}`
    setRemittances([...remittances, { ...remittance, id: newId }])
  }

  const updateRemittance = (id: string, updates: Partial<RemittanceRecord>) => {
    setRemittances(
      remittances.map((rem) => (rem.id === id ? { ...rem, ...updates } : rem))
    )
  }

  const deleteRemittance = (id: string) => {
    setRemittances(remittances.filter((rem) => rem.id !== id))
  }

  const getRemittancesByCabinet = (cabinet: string) => {
    return remittances.filter((rem) => rem.cabinetId === cabinet)
  }

  const getRentSummary = (cabinet: string) => {
    const cabinetRemittances = getRemittancesByCabinet(cabinet)
    const totalRenters = cabinetRemittances.length
    const unpaidRenters = cabinetRemittances.filter(
      (rem) => rem.rentStatus === "unpaid" || rem.rentStatus === "partial"
    ).length
    const totalUnpaidRent = cabinetRemittances
      .filter((rem) => rem.rentStatus === "unpaid" || rem.rentStatus === "partial")
      .reduce((sum, rem) => sum + rem.rentAmount, 0)

    return { totalRenters, unpaidRenters, totalUnpaidRent }
  }

  const getRemittanceSummary = (cabinet: string) => {
    const cabinetRemittances = getRemittancesByCabinet(cabinet)
    const pendingRemittances = cabinetRemittances.filter(
      (rem) => rem.remittanceStatus === "pending"
    ).length
    const totalToRemit = cabinetRemittances
      .filter((rem) => rem.remittanceStatus === "pending" || rem.remittanceStatus === "released")
      .reduce((sum, rem) => sum + rem.remittanceAmount, 0)

    return { pendingRemittances, totalToRemit }
  }

  return (
    <RemittanceContext.Provider
      value={{
        remittances,
        addRemittance,
        updateRemittance,
        deleteRemittance,
        getRemittancesByCabinet,
        getRentSummary,
        getRemittanceSummary,
      }}
    >
      {children}
    </RemittanceContext.Provider>
  )
}

export function useRemittance() {
  const context = useContext(RemittanceContext)
  if (!context) {
    throw new Error("useRemittance must be used within RemittanceProvider")
  }
  return context
}
