"use client"

import { useToast } from "@/contexts/toast-context"
import { X, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react"

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  const getStyles = (type: string) => {
    switch (type) {
      case "success":
        return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-200 shadow-emerald-500/25"
      case "error":
        return "bg-gradient-to-r from-red-500 to-red-600 text-white border-red-200 shadow-red-500/25"
      case "warning":
        return "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-yellow-200 shadow-yellow-500/25"
      case "info":
<<<<<<< HEAD
        return "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-200 shadow-blue-500/25"
=======
        return "bg-gradient-to-r from-violet-500 to-violet-600 text-white border-violet-200 shadow-violet-500/25"
>>>>>>> clean-branch
      default:
        return "bg-gradient-to-r from-gray-500 to-gray-600 text-white border-gray-200 shadow-gray-500/25"
    }
  }

  const getIcon = (type: string) => {
    const iconClass = "w-5 h-5"
    switch (type) {
      case "success":
        return <CheckCircle className={iconClass} />
      case "error":
        return <XCircle className={iconClass} />
      case "warning":
        return <AlertTriangle className={iconClass} />
      case "info":
        return <Info className={iconClass} />
      default:
        return <Info className={iconClass} />
    }
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-md">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className={`
            ${getStyles(toast.type)} 
            px-6 py-4 rounded-xl border-2 shadow-2xl 
            flex items-center justify-between gap-4 
            animate-in fade-in slide-in-from-right-8 duration-500 
            hover:scale-[1.02] transition-all duration-200
            backdrop-blur-sm
            min-w-[320px]
            max-w-[400px]
            ${toast.type === 'error' ? 'animate-pulse border-4' : ''}
          `}
        >
          <div className="flex items-center gap-3 flex-1">
            <div className={`flex-shrink-0 ${toast.type === 'error' ? 'animate-bounce' : 'animate-pulse'}`}>
              {getIcon(toast.type)}
            </div>
            <p className="text-sm font-semibold leading-tight">
              {toast.message}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition-all duration-200 hover:scale-110"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
