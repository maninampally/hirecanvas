import * as React from "react"

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'teal' | 'blue' | 'amber' | 'emerald' | 'rose' | 'violet' | 'slate'
}

const variantClasses: Record<string, string> = {
  default: 'bg-slate-100 text-slate-700',
  teal: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200/60',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/60',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
  emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60',
  violet: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/60',
  slate: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/60',
}

function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variantClasses[variant]} ${className || ''}`}
      {...props}
    />
  )
}

export { Badge }
export type { BadgeProps }
