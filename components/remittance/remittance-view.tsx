"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Edit2, Trash2, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRemittance } from "@/contexts/remittance-context"

interface RemittanceViewProps {
  isAdmin: boolean
  cabinet: string
}

export function RemittanceView({ isAdmin, cabinet }: RemittanceViewProps) {
  const { getRemittancesByCabinet, updateRemittance, deleteRemittance, addRemittance, getRentSummary, getRemittanceSummary } = useRemittance()
  const [activeTab, setActiveTab] = useState("rent")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null)
  const [recordToComplete, setRecordToComplete] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState(false)

  const remittances = getRemittancesByCabinet(cabinet)
  const rentSummary = getRentSummary(cabinet)
  const remittanceSummary = getRemittanceSummary(cabinet)

  // Filter for Rent Status tab
  const rentRecords = remittances.filter((rem) => {
    const matchesSearch =
      rem.renterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rem.id.includes(searchQuery)

    const matchesStatus = filterStatus === "all" || rem.rentStatus !== "paid"

    return matchesSearch && matchesStatus
  })

  // Filter for Remittance Status tab
  const remittanceRecords = remittances.filter((rem) => {
    const matchesSearch =
      rem.renterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rem.id.includes(searchQuery)

    const matchesStatus = filterStatus === "all" || rem.remittanceStatus === "pending" || rem.remittanceStatus === "released"

    return matchesSearch && matchesStatus
  })

  const handleDelete = (id: string) => {
    setRecordToDelete(id)
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    if (recordToDelete) {
      deleteRemittance(recordToDelete)
      setShowDeleteDialog(false)
      setRecordToDelete(null)
    }
  }

  const handleSaveEdit = () => {
    if (editingRecord) {
      updateRemittance(editingRecord.id, editingRecord)
      setShowEditDialog(false)
      setEditingRecord(null)
    }
  }

  const handleComplete = (id: string, type: "rent" | "remittance") => {
    setRecordToComplete(id)
    setShowCompleteDialog(true)
  }

  const confirmComplete = (type: "rent" | "remittance") => {
    if (recordToComplete) {
      const record = remittances.find((r) => r.id === recordToComplete)
      if (record) {
        if (type === "rent") {
          updateRemittance(recordToComplete, { rentStatus: "paid" })
        } else {
          updateRemittance(recordToComplete, { remittanceStatus: "collected" })
        }
      }
      setShowCompleteDialog(false)
      setRecordToComplete(null)
    }
  }

  const handleExportReport = () => {
    const csvContent = [
      ["Remittance ID", "Date", "Renter Name", "Rent Amount", "Rent Status", "Remittance Amount", "Remittance Status", "Staff Name", "Notes"],
      ...remittances.map((rem: any) => [
        rem.id,
        rem.date,
        rem.renterName,
        rem.rentAmount.toString(),
        rem.rentStatus,
        rem.remittanceAmount.toString(),
        rem.remittanceStatus,
        rem.staffName,
        rem.notes,
      ]),
    ]

    const csv = csvContent.map((row: any) => row.map((cell: any) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `remittance-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 2000)
  }

  const getRentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-50 border-emerald-200 text-emerald-900"
      case "unpaid":
        return "bg-red-50 border-red-200 text-red-900"
      case "partial":
        return "bg-yellow-50 border-yellow-200 text-yellow-900"
      default:
        return "bg-gray-50 border-gray-200 text-gray-900"
    }
  }

  const getRemittanceStatusColor = (status: string) => {
    switch (status) {
      case "collected":
        return "bg-emerald-50 border-emerald-200 text-emerald-900"
      case "released":
        return "bg-blue-50 border-blue-200 text-blue-900"
      case "pending":
        return "bg-orange-50 border-orange-200 text-orange-900"
      default:
        return "bg-gray-50 border-gray-200 text-gray-900"
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Renters */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Renters
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{rentSummary.totalRenters}</p>
                <p className="mt-2 text-xs text-muted-foreground">Cabinet: {cabinet}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-2 text-2xl">👥</span>
            </div>
          </CardContent>
        </Card>

        {/* Unpaid Rent */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Unpaid Renters
                </p>
                <p className="mt-2 text-3xl font-semibold text-destructive">{rentSummary.unpaidRenters}</p>
                <p className="mt-2 text-xs text-destructive">
                  ₱{rentSummary.totalUnpaidRent.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <span className="rounded-full bg-destructive/10 px-3 py-2 text-2xl">⚠️</span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Remittances */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pending Remittances
                </p>
                <p className="mt-2 text-3xl font-semibold text-orange-600">{remittanceSummary.pendingRemittances}</p>
                <p className="mt-2 text-xs text-orange-600">Awaiting release</p>
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-2 text-2xl">⏳</span>
            </div>
          </CardContent>
        </Card>

        {/* Total to Remit */}
        <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm hover:border-primary/40 hover:shadow-md transition-all">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total to Remit
                </p>
                <p className="mt-2 text-3xl font-semibold text-emerald-600">
                  ₱{remittanceSummary.totalToRemit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="mt-2 text-xs text-emerald-600">Pending + Released</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-2 text-2xl">💰</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remittance Records with Tabs */}
      <Card className="bg-card/60 border border-primary/10 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Remittance Records</CardTitle>
              <CardDescription>Manage rent collection and remittance payments</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExportReport}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download size={16} />
                Export
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => setShowAddDialog(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Plus size={16} />
                  Add Renter
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rent">Rent Status</TabsTrigger>
              <TabsTrigger value="remittance">Remittance Status</TabsTrigger>
            </TabsList>

            {/* Rent Status Tab */}
            <TabsContent value="rent" className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-4 flex-col sm:flex-row">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by renter name, ID, or staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Rent Status Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">ID</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Renter</th>
                      <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Rent Amount</th>
                      <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Status</th>
                      <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentRecords.length > 0 ? (
                      rentRecords.map((rem: any) => (
                        <tr key={rem.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs">{rem.id}</td>
                          <td className="py-3 px-4">{rem.date}</td>
                          <td className="py-3 px-4 font-medium">{rem.renterName}</td>
                          <td className="py-3 px-4 text-right">₱{rem.rentAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getRentStatusColor(rem.rentStatus)}`}>
                              {rem.rentStatus.charAt(0).toUpperCase() + rem.rentStatus.slice(1)}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-center">
                              <div className="flex gap-1 justify-center">
                                {rem.rentStatus !== "paid" && (
                                  <button
                                    onClick={() => handleComplete(rem.id, "rent")}
                                    className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded transition-colors font-medium"
                                    title="Mark as Paid"
                                  >
                                    ✓ Paid
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingRecord(rem)
                                    setShowEditDialog(true)
                                  }}
                                  className="p-1 hover:bg-primary/10 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={16} className="text-primary" />
                                </button>
                                <button
                                  onClick={() => handleDelete(rem.id)}
                                  className="p-1 hover:bg-destructive/10 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} className="text-destructive" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-muted-foreground">
                          No rent records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Remittance Status Tab */}
            <TabsContent value="remittance" className="space-y-4">
              {/* Search */}
              <div className="flex gap-4 flex-col sm:flex-row">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by renter name, ID, or staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Remittance Status Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">ID</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Renter</th>
                      <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Remittance Amount</th>
                      <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Status</th>
                      {isAdmin && <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {remittanceRecords.length > 0 ? (
                      remittanceRecords.map((rem: any) => (
                        <tr key={rem.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs">{rem.id}</td>
                          <td className="py-3 px-4">{rem.date}</td>
                          <td className="py-3 px-4 font-medium">{rem.renterName}</td>
                          <td className="py-3 px-4 text-right">₱{rem.remittanceAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getRemittanceStatusColor(rem.remittanceStatus)}`}>
                              {rem.remittanceStatus.charAt(0).toUpperCase() + rem.remittanceStatus.slice(1)}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-center">
                              <div className="flex gap-1 justify-center">
                                {rem.remittanceStatus !== "collected" && (
                                  <button
                                    onClick={() => handleComplete(rem.id, "remittance")}
                                    className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded transition-colors font-medium"
                                    title="Mark as Collected"
                                  >
                                    ✓ Collected
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingRecord(rem)
                                    setShowEditDialog(true)
                                  }}
                                  className="p-1 hover:bg-primary/10 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={16} className="text-primary" />
                                </button>
                                <button
                                  onClick={() => handleDelete(rem.id)}
                                  className="p-1 hover:bg-destructive/10 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} className="text-destructive" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-muted-foreground">
                          No remittance records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Renter Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Renter</DialogTitle>
            <DialogDescription>
              Create a new remittance record for a renter
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Renter Name</label>
              <Input
                placeholder="Enter renter name"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Rent Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Remittance Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Rent Status</label>
              <select className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background">
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Remittance Status</label>
              <select className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background">
                <option value="pending">Pending</option>
                <option value="released">Released</option>
                <option value="collected">Collected</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                placeholder="Add any notes..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add Renter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Remittance Record</DialogTitle>
            <DialogDescription>
              Update the remittance record details
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Renter Name</label>
                <Input
                  value={editingRecord.renterName}
                  onChange={(e) => setEditingRecord({ ...editingRecord, renterName: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Rent Amount</label>
                  <Input
                    type="number"
                    value={editingRecord.rentAmount}
                    onChange={(e) => setEditingRecord({ ...editingRecord, rentAmount: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Remittance Amount</label>
                  <Input
                    type="number"
                    value={editingRecord.remittanceAmount}
                    onChange={(e) => setEditingRecord({ ...editingRecord, remittanceAmount: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={editingRecord.notes}
                  onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete/Mark as Paid Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Complete</DialogTitle>
            <DialogDescription>
              {activeTab === "rent" ? "Mark this rent as paid?" : "Mark this remittance as collected?"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => confirmComplete(activeTab as "rent" | "remittance")} className="bg-emerald-600 hover:bg-emerald-700">
              {activeTab === "rent" ? "Mark as Paid" : "Mark as Collected"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Remittance Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this remittance record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Success Toast */}
      {exportSuccess && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg">
          Report exported successfully!
        </div>
      )}
    </div>
  )
}
