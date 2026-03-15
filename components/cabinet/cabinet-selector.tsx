"use client"

import { useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, Plus, Trash2, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CabinetSelectorProps {
  selectedCabinet: string
  onSelectCabinet: (cabinet: string) => void
  showAllOption?: boolean
}

interface Cabinet {
  id: string
  name: string
  icon: string
}

const INITIAL_CABINETS: Cabinet[] = [
  { id: "main", name: "Main Shop", icon: "🏪" },
  { id: "cabinet1", name: "Cabinet - Renter 1", icon: "🚪" },
  { id: "cabinet2", name: "Cabinet - Renter 2", icon: "🚪" },
]

export function CabinetSelector({ selectedCabinet, onSelectCabinet, showAllOption = true }: CabinetSelectorProps) {
  const [cabinets, setCabinets] = useState<Cabinet[]>(INITIAL_CABINETS)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [cabinetToDelete, setCabinetToDelete] = useState<Cabinet | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [newCabinetName, setNewCabinetName] = useState("")
  const [newCabinetIcon, setNewCabinetIcon] = useState("🚪")

  const allCabinets = showAllOption
    ? [{ id: "all", name: "All (Main + Cabinets)", icon: "📊" }, ...cabinets]
    : cabinets

  const currentCabinet = allCabinets.find((c) => c.id === selectedCabinet) || allCabinets[0]

  const handleAddCabinet = () => {
    if (!newCabinetName.trim()) return

    const newId = `cabinet${cabinets.filter(c => c.id !== "main").length + 1}`
    const newCabinet: Cabinet = {
      id: newId,
      name: newCabinetName.trim(),
      icon: newCabinetIcon,
    }

    setCabinets([...cabinets, newCabinet])
    setNewCabinetName("")
    setIsAddDialogOpen(false)
  }

  const handleDeleteClick = (cabinet: Cabinet, e: React.MouseEvent) => {
    e.stopPropagation()
    if (cabinet.id === "main") return
    setCabinetToDelete(cabinet)
    setDeleteConfirmText("")
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteCabinet = () => {
    if (!cabinetToDelete || deleteConfirmText !== cabinetToDelete.name) return

    setCabinets(cabinets.filter(c => c.id !== cabinetToDelete.id))
    
    // If the deleted cabinet was selected, switch to main
    if (selectedCabinet === cabinetToDelete.id) {
      onSelectCabinet("main")
    }
    
    setIsDeleteDialogOpen(false)
    setCabinetToDelete(null)
    setDeleteConfirmText("")
  }

  const isDeleteConfirmValid = deleteConfirmText === cabinetToDelete?.name

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 border-white/40 hover:bg-white/20 bg-white/10 text-white text-sm h-10 px-3 backdrop-blur-sm"
          >
            <span className="text-base sm:text-lg">{currentCabinet?.icon}</span>
            <span className="hidden sm:inline font-medium">{currentCabinet?.name}</span>
            <span className="sm:hidden font-medium">{currentCabinet?.name?.split(' ')[0]}</span>
            <ChevronDown size={16} className="opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 sm:w-60">
          {allCabinets.map((cabinet) => (
            <div key={cabinet.id} className="flex items-center group">
              <DropdownMenuItem 
                onClick={() => onSelectCabinet(cabinet.id)} 
                className="cursor-pointer py-2 flex-1"
              >
                <span className="text-base sm:text-lg mr-2">{cabinet.icon}</span>
                <span className="text-sm">{cabinet.name}</span>
                {selectedCabinet === cabinet.id && <span className="ml-auto text-primary text-sm">✓</span>}
              </DropdownMenuItem>
              {cabinet.id !== "main" && cabinet.id !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleDeleteClick(cabinet, e)}
                  className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 transition-opacity"
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsAddDialogOpen(true)} className="cursor-pointer py-2">
            <Plus size={16} className="mr-2 text-primary" />
            <span className="text-sm font-medium">Add New Cabinet</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Cabinet</DialogTitle>
            <DialogDescription>
              Create a new cabinet to organize products and track sales separately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cabinetName">Cabinet Name</Label>
              <Input
                id="cabinetName"
                placeholder="e.g., Cabinet - Renter 3"
                value={newCabinetName}
                onChange={(e) => setNewCabinetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCabinet()}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cabinetIcon">Icon</Label>
              <div className="flex gap-2">
                {["🚪", "🏪", "📦", "🗄️", "🧺", "📊"].map((icon) => (
                  <Button
                    key={icon}
                    type="button"
                    variant={newCabinetIcon === icon ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewCabinetIcon(icon)}
                    className="text-lg"
                  >
                    {icon}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCabinet} disabled={!newCabinetName.trim()}>
              Add Cabinet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={20} />
              Delete Cabinet
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All products and sales data associated with this cabinet will be affected.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Alert variant="destructive" className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-700">
                You are about to delete <strong>{cabinetToDelete?.name}</strong>. This is a permanent action.
              </AlertDescription>
            </Alert>
            
            <div className="grid gap-2">
              <Label htmlFor="confirmDelete" className="text-sm font-medium">
                Type <span className="font-bold text-red-600">{cabinetToDelete?.name}</span> to confirm
              </Label>
              <Input
                id="confirmDelete"
                placeholder={`Type "${cabinetToDelete?.name}" to confirm deletion`}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={deleteConfirmText && !isDeleteConfirmValid ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {deleteConfirmText && !isDeleteConfirmValid && (
                <p className="text-xs text-red-500">Text does not match cabinet name exactly</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteCabinet} 
              disabled={!isDeleteConfirmValid}
            >
              <Trash2 size={16} className="mr-2" />
              Delete Cabinet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
