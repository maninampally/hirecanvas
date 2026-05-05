'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCalendarEvents, type CalendarEvent } from '@/actions/calendar'
import { deleteReminder } from '@/actions/reminders'
import { MdChevronLeft, MdChevronRight, MdEvent, MdArrowForward, MdClose, MdDeleteOutline, MdOpenInNew } from 'react-icons/md'
import { toast } from 'sonner'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EVENT_COLORS: Record<CalendarEvent['type'], { dot: string; bg: string; text: string; border: string }> = {
  interview: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  reminder: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  offer_deadline: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function friendlyDate(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function typeLabel(type: CalendarEvent['type']) {
  if (type === 'offer_deadline') return 'Offer Deadline'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

// ── Day Detail Panel ──────────────────────────────────────────────
function DayPanel({
  dateKey,
  dayEvents,
  onClose,
  onDeleted,
}: {
  dateKey: string
  dayEvents: CalendarEvent[]
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function handleDelete(event: CalendarEvent) {
    // Only reminders can be deleted from here
    if (event.type !== 'reminder') {
      toast.info('To remove an interview date, edit the application and clear the interview date field.')
      return
    }
    const remId = event.id.replace('reminder-', '')
    setDeletingId(event.id)
    try {
      await deleteReminder(remId)
      toast.success('Reminder deleted')
      startTransition(() => onDeleted(event.id))
    } catch {
      toast.error('Failed to delete reminder')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Events</p>
            <p className="text-base font-bold text-slate-900 mt-0.5">{friendlyDate(dateKey)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close day panel"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Events list */}
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {dayEvents.map((event) => {
            const colors = EVENT_COLORS[event.type]
            const isReminder = event.type === 'reminder'
            const isDeleting = deletingId === event.id

            return (
              <div key={event.id} className="flex items-center gap-3 px-5 py-3.5">
                {/* Color dot */}
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{event.title}</p>
                  <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 ${colors.bg} ${colors.text}`}>
                    {typeLabel(event.type)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link
                    href={event.href}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-600 transition-colors"
                    title={isReminder ? 'View reminder' : 'View application'}
                    aria-label="Open event"
                  >
                    <MdOpenInNew className="text-base" />
                  </Link>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => void handleDelete(event)}
                    className={`rounded-lg p-1.5 transition-colors ${
                      isReminder
                        ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-500'
                        : 'text-slate-200 cursor-not-allowed'
                    }`}
                    title={isReminder ? 'Delete reminder' : 'Edit application to remove interview date'}
                    aria-label={isReminder ? 'Delete reminder' : 'Cannot delete interview from calendar'}
                  >
                    {isDeleting ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <MdDeleteOutline className="text-base" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">
            💡 Reminders can be deleted here. To remove an interview date, edit the application.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)

  useEffect(() => {
    getCalendarEvents()
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = toDateKey(new Date())

  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const existing = eventsByDate.get(event.date) || []
    existing.push(event)
    eventsByDate.set(event.date, existing)
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const cells: Array<{ day: number | null; dateKey: string }> = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateKey: '' })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, dateKey })
  }

  const selectedEvents = selectedDateKey ? (eventsByDate.get(selectedDateKey) || []) : []

  function handleEventDeleted(deletedId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== deletedId))
    // Close panel if no more events on that day
    if (selectedDateKey) {
      const remaining = (eventsByDate.get(selectedDateKey) || []).filter((e) => e.id !== deletedId)
      if (remaining.length === 0) setSelectedDateKey(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">Interviews, reminders, and offer deadlines</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth} aria-label="Previous month">
            <MdChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextMonth} aria-label="Next month">
            <MdChevronRight />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse">
              <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="bg-slate-50 py-2 text-center">
                    <div className="h-3 w-6 mx-auto rounded bg-slate-200" />
                  </div>
                ))}
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="bg-white min-h-[80px] p-1.5">
                    <div className="h-3 w-4 rounded bg-slate-100 mb-1" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-500">
                    {day}
                  </div>
                ))}
                {cells.map((cell, i) => {
                  const dayEvents = cell.dateKey ? eventsByDate.get(cell.dateKey) || [] : []
                  const isToday = cell.dateKey === today
                  const hasEvents = dayEvents.length > 0
                  const isSelected = cell.dateKey === selectedDateKey

                  return (
                    <div
                      key={i}
                      className={`bg-white min-h-[80px] p-1.5 transition-colors ${
                        !cell.day ? 'bg-slate-50/50' : ''
                      } ${hasEvents ? 'cursor-pointer hover:bg-slate-50' : ''} ${
                        isSelected ? 'ring-2 ring-inset ring-teal-400' : ''
                      }`}
                      onClick={() => {
                        if (cell.day && hasEvents) {
                          setSelectedDateKey(isSelected ? null : cell.dateKey)
                        }
                      }}
                      role={hasEvents ? 'button' : undefined}
                      aria-label={hasEvents ? `View ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''} on ${cell.dateKey}` : undefined}
                      tabIndex={hasEvents ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (hasEvents && (e.key === 'Enter' || e.key === ' ')) {
                          setSelectedDateKey(isSelected ? null : cell.dateKey)
                        }
                      }}
                    >
                      {cell.day && (
                        <>
                          <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-teal-500 text-white' : 'text-slate-700'
                          }`}>
                            {cell.day}
                          </p>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map((event) => {
                              const colors = EVENT_COLORS[event.type]
                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  className={`w-full text-left block truncate rounded px-1 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedDateKey(cell.dateKey)
                                  }}
                                  aria-label={`Event: ${event.title}`}
                                >
                                  {event.title}
                                </button>
                              )
                            })}
                            {dayEvents.length > 3 && (
                              <p className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 3} more</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {events.length === 0 && (
                <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-600">No events this month</p>
                  <p className="text-xs text-slate-400">Add interview dates on applications or create reminders to see them here.</p>
                  <div className="flex gap-2 mt-1">
                    <Link href="/reminders" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      + Add Reminder
                    </Link>
                    <Link href="/applications" className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 transition-colors">
                      View Applications
                    </Link>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Interview
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reminder
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Offer Deadline
                </span>
                <span className="flex items-center gap-1.5 ml-auto text-slate-400 italic">
                  Click any event or date to view details
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      {!loading && (() => {
        const todayStr = toDateKey(new Date())
        const upcoming = events
          .filter((e) => e.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 10)
        return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MdEvent className="text-teal-500" />
                  Upcoming Events
                </CardTitle>
                <Link href="/reminders" className="text-xs text-teal-600 font-medium hover:text-teal-700 flex items-center gap-1">
                  Add Reminder <MdArrowForward className="text-sm" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-500">No upcoming events — clear schedule ahead!</p>
                  <p className="text-xs text-slate-400 mt-1">Add interview dates on applications or create reminders to see them here.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcoming.map((event) => {
                    const colors = EVENT_COLORS[event.type]
                    const d = new Date(`${event.date}T00:00:00`)
                    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    return (
                      <div key={event.id} className="flex items-center justify-between gap-4 py-2.5 hover:bg-slate-50/60 transition-colors rounded px-1">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                          <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                            {typeLabel(event.type)}
                          </span>
                          <span className="text-xs text-slate-400">{label}</span>
                          <Link
                            href={event.href}
                            className="rounded-lg p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                            title="Open"
                            aria-label="Open event"
                          >
                            <MdOpenInNew className="text-sm" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Day Panel Modal */}
      {selectedDateKey && selectedEvents.length > 0 && (
        <DayPanel
          dateKey={selectedDateKey}
          dayEvents={selectedEvents}
          onClose={() => setSelectedDateKey(null)}
          onDeleted={handleEventDeleted}
        />
      )}
    </div>
  )
}
