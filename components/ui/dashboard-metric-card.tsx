"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"

export type DashboardMetricColor = "primary" | "green" | "blue" | "orange" | "maroon"

/**
 * Harmonious split-complementary set around app violet (~285°): cool teals/blues vs warm amber/rose,
 * so cards read as one palette, not random hues.
 */
const colorClasses: Record<DashboardMetricColor, string> = {
  green:
    "bg-gradient-to-br from-[oklch(0.36_0.12_150)] to-[oklch(0.50_0.14_146)] border-[oklch(0.40_0.09_148)] text-white",
  blue:
    "bg-gradient-to-br from-[oklch(0.30_0.12_265)] to-[oklch(0.42_0.15_265)] border-[oklch(0.36_0.1_265)] text-white",
  orange:
    "bg-gradient-to-br from-[oklch(0.5_0.13_72)] to-[oklch(0.62_0.11_78)] border-[oklch(0.56_0.09_75)] text-white",
  maroon:
    "bg-gradient-to-br from-[oklch(0.3_0.12_18)] to-[oklch(0.4_0.11_22)] border-[oklch(0.35_0.09_20)] text-white",
  primary:
    "bg-gradient-to-br from-[oklch(0.27_0.13_285)] to-[oklch(0.38_0.15_282)] border-[oklch(0.33_0.11_284)] text-white",
}

const iconBgClasses: Record<DashboardMetricColor, string> = {
  green: "bg-[oklch(0.55_0.15_146)] text-white",
  blue: "bg-[oklch(0.53_0.13_265)] text-white",
  orange: "bg-[oklch(0.62_0.11_74)] text-white",
  maroon: "bg-[oklch(0.52_0.1_20)] text-white",
  primary: "bg-[oklch(0.55_0.13_284)] text-white",
}

export interface DashboardMetricCardProps {
  title: string
  value: React.ReactNode
  description?: React.ReactNode
  icon: React.ReactNode
  color?: DashboardMetricColor
  onClick?: () => void
  /** Merged onto Card (e.g. selected filter ring). */
  className?: string
  titleId?: string
}

/** Sales summary: complementary OKLCH gradients, full-width-friendly value text. */
export function DashboardMetricCard({
  title,
  value,
  description,
  icon,
  color = "primary",
  onClick,
  className = "",
  titleId,
}: DashboardMetricCardProps) {
  const palette = colorClasses[color]
  const iconBg = iconBgClasses[color]

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={`relative min-w-0 overflow-hidden border-2 shadow-lg transition-all duration-300 ${palette} ${
        onClick ? "cursor-pointer hover:shadow-xl" : "hover:shadow-xl"
      } ${className}`.trim()}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-gradient-to-br from-white/20 to-transparent" />
      <CardContent className="relative px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1 sm:space-y-2">
            <p
              id={titleId}
              className="text-xs font-medium uppercase tracking-wide text-white/80 sm:text-sm"
            >
              {title}
            </p>
            <div className="whitespace-normal break-words text-base font-bold tabular-nums leading-snug text-white sm:text-lg md:text-xl">
              {value}
            </div>
            {description != null && description !== "" && (
              <div className="line-clamp-4 text-xs leading-snug text-white/70 [&_*]:text-white/70">
                {description}
              </div>
            )}
          </div>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-2 sm:h-11 sm:w-11 sm:p-3 ${iconBg}`}
            aria-hidden
          >
            <span className="flex h-5 w-5 items-center justify-center sm:h-6 sm:w-6 [&>svg]:size-full [&>svg]:text-white">
              {icon}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
