"use client"

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

interface CabinetSelectorProps {
  selectedCabinet: string
  onSelectCabinet: (cabinet: string) => void
}

const CABINETS = [
  { id: "main", name: "Main Shop", icon: "🏪" },
  { id: "cabinet1", name: "Cabinet - Renter 1", icon: "🚪" },
  { id: "cabinet2", name: "Cabinet - Renter 2", icon: "🚪" },
]

export function CabinetSelector({ selectedCabinet, onSelectCabinet }: CabinetSelectorProps) {
  const currentCabinet = CABINETS.find((c) => c.id === selectedCabinet)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 border-primary/30 hover:bg-primary/5 bg-transparent text-sm h-10 px-3"
        >
          <span className="text-base sm:text-lg">{currentCabinet?.icon}</span>
          <span className="hidden sm:inline">{currentCabinet?.name}</span>
          <span className="sm:hidden">{currentCabinet?.name?.split(' ')[0]}</span>
          <ChevronDown size={16} className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 sm:w-56">
        {CABINETS.map((cabinet) => (
          <DropdownMenuItem key={cabinet.id} onClick={() => onSelectCabinet(cabinet.id)} className="cursor-pointer py-2">
            <span className="text-base sm:text-lg mr-2">{cabinet.icon}</span>
            <span className="text-sm">{cabinet.name}</span>
            {selectedCabinet === cabinet.id && <span className="ml-auto text-primary text-sm">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
