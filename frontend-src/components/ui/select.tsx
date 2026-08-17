"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

function Select({
  defaultValue,
  value,
  onValueChange,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root> & {
  onValueChange?: (value: unknown) => void
}) {
  return (
    <SelectPrimitive.Root
      data-slot="select"
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-7 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none transition-colors",
        "hover:bg-muted/50",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "dark:bg-input/30 dark:hover:bg-input/50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="text-muted-foreground" />
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({
  className,
  placeholder,
  ...props
}: SelectPrimitive.Value.Props & {
  placeholder?: string
}) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        "truncate",
        "data-placeholder:text-muted-foreground",
        className
      )}
      placeholder={placeholder}
      {...props}
    />
  )
}

function SelectContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "z-50 max-h-(--available-height) w-(--anchor-width) min-w-[8rem] origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <SelectPrimitive.Arrow className="data-[side=bottom]:top-[-5px] data-[side=left]:right-[-5px] data-[side=right]:left-[-5px] data-[side=top]:bottom-[-5px]">
            <svg width="10" height="5" viewBox="0 0 10 5" className="fill-popover">
              <path d="M0 5 L5 0 L10 5Z" />
            </svg>
          </SelectPrimitive.Arrow>
          {props.children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-1.5 text-sm outline-none select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon />
        </SelectPrimitive.ItemIndicator>
      </span>
      {children}
    </SelectPrimitive.Item>
  )
}

function SelectItemIndicator({
  className,
  ...props
}: SelectPrimitive.ItemIndicator.Props) {
  return (
    <SelectPrimitive.ItemIndicator
      data-slot="select-item-indicator"
      className={cn("", className)}
      {...props}
    />
  )
}

function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectGroup,
  SelectSeparator,
}
