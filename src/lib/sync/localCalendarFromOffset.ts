/**
 * Fixed-offset calendar math aligned with `Date#getTimezoneOffset()`
 * (minutes; positive when local time is behind UTC).
 * Used by sync trigger “today” and Gmail local date-range queries.
 */

export function localCalendarYmdFromUtc(utc: Date, offsetMinutes: number): string {
  const shiftedMs = utc.getTime() - offsetMinutes * 60 * 1000
  const d = new Date(shiftedMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfLocalDayUtcIso(ymd: string, offsetMinutes: number): string {
  const [ys, ms, ds] = ymd.split('-').map(Number)
  const utcMs = Date.UTC(ys, ms - 1, ds, 0, 0, 0) + offsetMinutes * 60 * 1000
  return new Date(utcMs).toISOString()
}
