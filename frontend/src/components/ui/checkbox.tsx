import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center justify-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            "peer flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-primary ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
            checked ? "bg-primary text-primary-foreground" : "bg-transparent",
            className
          )}
          onClick={(e) => {
            if (disabled) return
            e.stopPropagation()
            onCheckedChange?.(!checked)
          }}
        >
          {checked && <Check className="h-3 w-3 stroke-[3]" />}
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
