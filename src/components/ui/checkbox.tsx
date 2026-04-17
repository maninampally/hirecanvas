'use client'

import * as React from "react"

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id || React.useId()
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id={inputId}
          ref={ref}
          className={`h-4.5 w-4.5 rounded-md border-slate-300 text-teal-500 transition-colors focus:ring-2 focus:ring-teal-500/40 focus:ring-offset-0 cursor-pointer accent-teal-500 ${className || ''}`}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm text-slate-700 cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    )
  }
)

Checkbox.displayName = "Checkbox"

export { Checkbox }
