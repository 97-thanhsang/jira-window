"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { format } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"

// ── Root ──────────────────────────────────────────────────────────

interface DatePickerProps {
  value?: Date
  defaultValue?: Date
  onValueChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Format for display (default: dd/MM/yyyy) */
  dateFormat?: string
  /** Allow clearing the selected date */
  clearable?: boolean
}

function DatePicker({
  value,
  defaultValue,
  onValueChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  dateFormat = "dd/MM/yyyy",
  clearable = true,
}: DatePickerProps) {
  const [internalValue, setInternalValue] = React.useState<Date | undefined>(defaultValue)
  const [open, setOpen] = React.useState(false)

  const selected = value !== undefined ? value : internalValue

  function handleSelect(date: Date | undefined) {
    if (value === undefined) setInternalValue(date)
    onValueChange?.(date)
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    if (value === undefined) setInternalValue(undefined)
    onValueChange?.(undefined)
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => { if (!disabled) setOpen(o) }}>
      <Popover.Trigger
        data-slot="date-picker-trigger"
        disabled={disabled}
        className={cn(
          "flex h-7 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none transition-colors",
          "hover:bg-muted/50",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          !selected && "text-muted-foreground",
          className
        )}
      >
        <span className="flex items-center gap-1.5 truncate">
          <CalendarIcon size={12} className="shrink-0 text-muted-foreground" />
          {selected ? format(selected, dateFormat) : placeholder}
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {clearable && selected && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Clear date"
            >
              <XIcon size={11} />
            </button>
          )}
          <CalendarIcon size={12} className="text-muted-foreground" />
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          data-slot="date-picker-positioner"
          sideOffset={4}
          className="isolate z-50 outline-none"
        >
          <Popover.Popup
            data-slot="date-picker-content"
            className={cn(
              "rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              "origin-(--transform-origin)"
            )}
          >
            <Calendar
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              {...(selected ? { defaultMonth: selected } : {})}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
DatePicker.displayName = "DatePicker"

export { DatePicker }
export type { DatePickerProps }
