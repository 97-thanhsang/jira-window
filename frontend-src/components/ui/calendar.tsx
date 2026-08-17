"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-3",
        className
      )}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-xs font-medium",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          "absolute left-1 top-1 inline-flex items-center justify-center rounded-md size-6 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
          "dark:hover:bg-input/50 dark:hover:text-foreground"
        ),
        button_next: cn(
          "absolute right-1 top-1 inline-flex items-center justify-center rounded-md size-6 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
          "dark:hover:bg-input/50 dark:hover:text-foreground"
        ),
        weekday: "text-muted-foreground rounded-md w-7 text-[0.7rem] font-normal text-center",
        weekdays: "flex",
        weeks: "space-y-1",
        week: "flex w-full mt-1",
        day: cn(
          "relative p-0 text-center text-xs w-7 h-7",
          "focus-within:relative focus-within:z-20",
          "hover:bg-muted hover:text-foreground rounded-md transition-colors",
          "dark:hover:bg-input/50"
        ),
        day_button: "h-7 w-7 p-0 font-normal aria-selected:opacity-100 rounded-md flex items-center justify-center",
        selected: cn(
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
          "dark:bg-primary dark:text-primary-foreground"
        ),
        today: "bg-accent text-accent-foreground font-semibold",
        outside:
          "day-outside text-muted-foreground/50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground/50 opacity-50",
        disabled: "text-muted-foreground/30 opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        range_start:
          "aria-selected:bg-primary aria-selected:text-primary-foreground rounded-l-md",
        range_end:
          "aria-selected:bg-primary aria-selected:text-primary-foreground rounded-r-md",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeftIcon : ChevronRightIcon
          return <Icon size={14} />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
