"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const sizeMap = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
} as const

export type SpinnerSize = keyof typeof sizeMap

function Spinner({
  size = "md",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  size?: SpinnerSize
}) {
  return (
    <div
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("flex items-center justify-center", className)}
      {...props}
    >
      <Loader2
        className="animate-spin text-muted-foreground"
        size={sizeMap[size]}
        aria-hidden="true"
      />
      <span className="sr-only">Loading...</span>
    </div>
  )
}

export { Spinner }
