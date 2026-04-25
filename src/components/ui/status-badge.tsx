import * as React from "react"

const statusColors = {
  'Wishlist': 'bg-slate-100 text-slate-700',
  'Applied': 'bg-blue-100 text-blue-700',
  'Screening': 'bg-amber-100 text-amber-700',
  'Interview': 'bg-violet-100 text-violet-700',
  'Offer': 'bg-emerald-100 text-emerald-700',
  'Rejected': 'bg-rose-100 text-rose-700',
}

export function StatusBadge({ status }: { status: keyof typeof statusColors }) {
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[status]}`}>
      {status}
    </span>
  )
}

export function StatusDropdown({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (status: string) => void
  disabled?: boolean
}) {
  const dropdownColors: Record<string, string> = {
    Wishlist: 'bg-slate-100 text-slate-700 border-slate-200',
    Applied: 'bg-blue-100 text-blue-700 border-blue-200',
    Screening: 'bg-amber-100 text-amber-700 border-amber-200',
    Interview: 'bg-violet-100 text-violet-700 border-violet-200',
    Offer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`px-3 py-2 border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
        dropdownColors[value] || 'bg-white text-slate-900 border-slate-200'
      }`}
    >
      <option value="Wishlist">Wishlist</option>
      <option value="Applied">Applied</option>
      <option value="Screening">Screening</option>
      <option value="Interview">Interview</option>
      <option value="Offer">Offer</option>
      <option value="Rejected">Rejected</option>
    </select>
  )
}
