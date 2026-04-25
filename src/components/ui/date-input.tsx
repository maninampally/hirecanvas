'use client'

import { useEffect, useRef, useState } from 'react'

type DateInputProps = {
  value: string
  onChange: (isoDate: string) => void
  className?: string
  disabled?: boolean
}

function toDisplay(isoDate: string) {
  if (!isoDate) return ''
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const [, year, month, day] = match
  return `${month}/${day}/${year}`
}

function parseDisplayToIso(display: string) {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, mm, dd, yyyy] = match

  const month = Number(mm)
  const day = Number(dd)
  const year = Number(yyyy)
  if (year < 1000 || year > 9999) return ''
  if (month < 1 || month > 12) return ''
  if (day < 1 || day > 31) return ''

  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return ''
  }

  return `${yyyy}-${mm}-${dd}`
}

function isValidIsoDate(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const [, yyyy, mm, dd] = match
  const year = Number(yyyy)
  const month = Number(mm)
  const day = Number(dd)
  if (year < 1000 || year > 9999) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const candidate = new Date(Date.UTC(year, month - 1, day))
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  )
}

function digitsToDisplay(digits: string) {
  const clean = digits.replace(/\D/g, '').slice(0, 8)
  if (clean.length <= 2) return clean
  if (clean.length <= 4) return `${clean.slice(0, 2)}/${clean.slice(2)}`
  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4)}`
}

function todayIsoDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DateInput({ value, onChange, className, disabled = false }: DateInputProps) {
  const [display, setDisplay] = useState(toDisplay(value))
  const pickerRef = useRef<HTMLInputElement | null>(null)
  const pickerValue = isValidIsoDate(value) ? value : todayIsoDate()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplay(toDisplay(value))
  }, [value])

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="MM/DD/YYYY"
        value={display}
        disabled={disabled}
        onChange={(event) => {
          const nextDisplay = digitsToDisplay(event.target.value)
          setDisplay(nextDisplay)
          if (!nextDisplay) {
            onChange('')
            return
          }
          const iso = parseDisplayToIso(nextDisplay)
          if (iso) onChange(iso)
        }}
        onBlur={() => {
          if (!display) {
            onChange('')
            return
          }
          const iso = parseDisplayToIso(display)
          if (iso) {
            onChange(iso)
            setDisplay(toDisplay(iso))
            return
          }
          setDisplay(toDisplay(value))
        }}
        className={`flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:border-teal-400 hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className || ''}`}
      />

      <button
        type="button"
        aria-label="Open calendar"
        disabled={disabled}
        onClick={() => {
          const input = pickerRef.current
          if (!input) return
          if (typeof input.showPicker === 'function') {
            input.showPicker()
            return
          }
          input.focus()
          input.click()
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
      >
        📅
      </button>

      <input
        ref={pickerRef}
        type="date"
        value={pickerValue}
        min="1000-01-01"
        max="9999-12-31"
        disabled={disabled}
        onChange={(event) => {
          const nextIso = event.target.value
          if (!nextIso) {
            onChange('')
            setDisplay('')
            return
          }
          if (!isValidIsoDate(nextIso)) {
            event.currentTarget.value = value
            setDisplay(toDisplay(value))
            return
          }
          onChange(nextIso)
          setDisplay(toDisplay(nextIso))
        }}
        className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
