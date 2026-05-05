'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type SyncLogEmail = {
  id: string
  gmailMessageId: string
  stage: string
  reviewStatus: string | null
  reason: string | null
  subject: string | null
  from: string | null
  processedAt: string | null
  receivedAt: string | null
  to: string | null
  cc: string | null
  bcc: string | null
  snippet: string | null
  linkedJob?: { id: string; title: string; company: string } | null
}

type SyncLogSummary = {
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  durationSeconds: number | null
  processed: number
  created: number
  failed: boolean
  error: string | null
  emailsShown?: number
  emailsLinkedToJobs?: number
}

type SyncRunListItem = {
  id: string
  status: string
  startedAt: string | null
  completedAt: string | null
  processed: number
  totalEmails: number
  newJobsFound: number
  failed: boolean
  error: string | null
  extractionMode: string | null
  truncated: boolean | null
}

type SyncLogsResponse = {
  runs: SyncRunListItem[]
  runsHasMore: boolean
  runsListMax: number
  selectedSyncId: string | null
  status: {
    id: string
    status: string
    total_emails: number
    processed_count: number
    new_jobs_found: number
    error_message: string | null
    started_at: string | null
    completed_at: string | null
    extraction_mode: string | null
    truncated: boolean | null
    oldest_processed_at: string | null
  } | null
  summary: SyncLogSummary | null
  emails: SyncLogEmail[]
}

const STAGE_LABELS: Record<string, string> = {
  'sync_filter:outbound': 'Outbound',
  'sync_filter:gmail_category': 'Gmail Tab',
  'sync_filter:body_size': 'Body Too Large',
  'sync_filter:duplicate': 'Duplicate',
  'sync_filter:fast_skip': 'Fast Skip',
  ai_stage1: 'AI: Classifier',
  ai_stage2: 'AI: Extractor',
  ai_stage3: 'AI: Verifier',
  ai_status_mapping: 'AI: Status Map',
  needs_review: 'Needs Review',
  upserted_or_updated: 'Saved',
  auto_rejected: 'Rejected',
  unknown: 'Unknown',
}

const STATUS_VARIANT: Record<string, 'emerald' | 'amber' | 'rose' | 'teal' | 'default'> = {
  auto_accepted: 'emerald',
  needs_review: 'amber',
  auto_rejected: 'rose',
}

function formatWhen(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatShortWhen(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ALL_STAGES = [
  'all',
  'upserted_or_updated',
  'needs_review',
  'auto_rejected',
  'sync_filter:outbound',
  'sync_filter:fast_skip',
  'ai_stage1',
  'ai_stage2',
  'ai_stage3',
]

const DEFAULT_RUNS_CAP = 25
const RUNS_PAGE_STEP = 25
const MAX_RUNS_CAP = 100

export default function SyncLogsPage() {
  const [data, setData] = useState<SyncLogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [jobLinkFilter, setJobLinkFilter] = useState<'all' | 'linked' | 'not_linked'>('all')
  const [search, setSearch] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [runsListMax, setRunsListMax] = useState(DEFAULT_RUNS_CAP)
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const paramsRef = useRef({ appliedFrom, appliedTo, selectedSyncId, runsListMax })

  useEffect(() => {
    paramsRef.current = { appliedFrom, appliedTo, selectedSyncId, runsListMax }
  }, [appliedFrom, appliedTo, selectedSyncId, runsListMax])

  const fetchLogs = useCallback(async (opts?: { signal?: AbortSignal; loadingMore?: boolean; cap?: number }) => {
    const { appliedFrom: from, appliedTo: to, selectedSyncId: sid } = paramsRef.current
    const cap = opts?.cap ?? paramsRef.current.runsListMax
    if (opts?.loadingMore) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('runsListMax', String(Math.min(cap, MAX_RUNS_CAP)))
      qs.set('limit', '500')
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      if (sid) qs.set('syncId', sid)
      const res = await fetch(`/api/sync/logs?${qs}`, { cache: 'no-store', signal: opts?.signal })
      const json = (await res.json()) as SyncLogsResponse & { error?: string }
      if (!res.ok) throw new Error('error' in json ? (json as { error?: string }).error || 'Failed' : 'Failed')
      setData(json as SyncLogsResponse)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load logs')
    } finally {
      if (opts?.loadingMore) setLoadingMore(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchLogs({ signal: ctrl.signal })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [appliedFrom, appliedTo, selectedSyncId, fetchLogs])

  useEffect(() => {
    if (runsListMax <= DEFAULT_RUNS_CAP) return
    const ctrl = new AbortController()
    const id = window.setTimeout(() => {
      void fetchLogs({ signal: ctrl.signal, loadingMore: true, cap: runsListMax })
    }, 0)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [runsListMax, fetchLogs])

  useEffect(() => {
    if (!data?.runsHasMore || loading || loadingMore) return
    if (runsListMax >= MAX_RUNS_CAP) return
    const el = loadMoreRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [e] = entries
        if (!e?.isIntersecting) return
        setRunsListMax((m) => Math.min(m + RUNS_PAGE_STEP, MAX_RUNS_CAP))
      },
      { root: null, rootMargin: '80px', threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [data?.runsHasMore, loading, loadingMore, runsListMax])

  const applyDateFilter = () => {
    setAppliedFrom(draftFrom.trim())
    setAppliedTo(draftTo.trim())
    setRunsListMax(DEFAULT_RUNS_CAP)
    setSelectedSyncId(null)
  }

  const clearDateFilter = () => {
    setDraftFrom('')
    setDraftTo('')
    setAppliedFrom('')
    setAppliedTo('')
    setRunsListMax(DEFAULT_RUNS_CAP)
    setSelectedSyncId(null)
  }

  const selectRun = (id: string) => {
    setSelectedSyncId(id)
  }

  const emails = data?.emails || []
  const filtered = emails.filter((e) => {
    if (stageFilter !== 'all' && e.stage !== stageFilter) return false
    if (jobLinkFilter === 'linked' && !e.linkedJob) return false
    if (jobLinkFilter === 'not_linked' && e.linkedJob) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        e.subject?.toLowerCase().includes(q) ||
        e.from?.toLowerCase().includes(q) ||
        e.reason?.toLowerCase().includes(q) ||
        e.stage?.toLowerCase().includes(q) ||
        e.linkedJob?.title.toLowerCase().includes(q) ||
        e.linkedJob?.company.toLowerCase().includes(q)
      )
    }
    return true
  })

  const stageCounts = emails.reduce<Record<string, number>>((acc, e) => {
    acc[e.stage] = (acc[e.stage] || 0) + 1
    return acc
  }, {})

  const linkedEmailCount = emails.reduce((n, e) => n + (e.linkedJob ? 1 : 0), 0)
  const unlinkedEmailCount = emails.length - linkedEmailCount

  const s = data?.summary
  const syncStatus = data?.status
  const runs = data?.runs || []

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sync Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Browse past sync runs and per-email processing. Emails linked to your Applications list are labeled{' '}
            <span className="font-medium text-slate-600">Pipeline</span>. Showing up to {runsListMax} recent runs; scroll the list to load more.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void fetchLogs({})}
          disabled={loading}
          className="gap-2 border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 ${loading ? 'animate-spin-slow' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Filter by sync start date</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">From</label>
            <input
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">To</label>
            <input
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={applyDateFilter} className="bg-teal-600 hover:bg-teal-700">
              Apply
            </Button>
            <Button type="button" variant="outline" onClick={clearDateFilter}>
              Clear
            </Button>
          </div>
          {(appliedFrom || appliedTo) && (
            <p className="text-xs text-slate-500 w-full sm:w-auto sm:ml-auto">
              Active: {appliedFrom || '…'} → {appliedTo || '…'} (UTC day bounds)
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sync runs</h2>
          <div className="max-h-[min(420px,50vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {loading && runs.length === 0 && (
              <div className="p-3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            )}
            {!loading &&
              runs.map((r) => {
                const selected = data?.selectedSyncId === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRun(r.id)}
                    className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-teal-50/80 ${
                      selected ? 'bg-teal-50 border-l-4 border-l-teal-500' : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">{formatShortWhen(r.startedAt)}</span>
                      <Badge
                        variant={r.failed ? 'rose' : r.status === 'in_progress' ? 'amber' : 'teal'}
                        className="text-[10px] shrink-0"
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {r.processed} processed · {r.newJobsFound} jobs
                    </p>
                  </button>
                )
              })}
            {!loading && runs.length === 0 && (
              <p className="p-4 text-sm text-slate-500 text-center">No sync runs match this date range.</p>
            )}
            {data?.runsHasMore && runsListMax < MAX_RUNS_CAP && (
              <div ref={loadMoreRef} className="h-10 flex items-center justify-center text-xs text-slate-400">
                {loadingMore ? 'Loading more…' : 'Scroll for more runs'}
              </div>
            )}
            {runsListMax >= MAX_RUNS_CAP && data?.runsHasMore && (
              <p className="p-2 text-center text-[11px] text-slate-400">Showing first {MAX_RUNS_CAP} runs in this view</p>
            )}
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          {s && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Selected run summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Started</span>
                    <p className="text-slate-900 font-semibold mt-0.5">{formatWhen(s.startedAt)}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Duration</span>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {s.durationSeconds != null ? `${s.durationSeconds}s` : '—'}
                    </p>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Processed</span>
                    <p className="text-slate-900 font-semibold mt-0.5">{s.processed}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Jobs Created</span>
                    <p className="text-slate-900 font-semibold mt-0.5">{s.created}</p>
                  </div>
                </div>
                {s.failed && s.error && (
                  <p className="mt-2 text-xs text-rose-600 rounded-md bg-rose-50 px-3 py-2">Error: {s.error}</p>
                )}
                <div className="mt-3 rounded-md bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">This list: </span>
                  {emails.length} emails loaded ·{' '}
                  <span className="font-semibold text-violet-700">{linkedEmailCount}</span> tied to an application (
                  <Link href="/applications" className="text-teal-600 hover:underline font-medium">
                    Applications
                  </Link>
                  )
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {syncStatus?.extraction_mode && (
                    <span>
                      Mode: <span className="font-medium text-slate-700">{syncStatus.extraction_mode}</span>
                    </span>
                  )}
                  {syncStatus?.truncated && (
                    <span className="text-amber-600 font-medium">
                      Results truncated — run a narrower date range sync to catch older mail.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {emails.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {ALL_STAGES.map((stage) => {
                  const count = stage === 'all' ? emails.length : stageCounts[stage] || 0
                  if (stage !== 'all' && count === 0) return null
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setStageFilter(stage)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        stageFilter === stage
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                      }`}
                    >
                      {stage === 'all' ? 'All' : STAGE_LABELS[stage] || stage} ({count})
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Applications</span>
                {(
                  [
                    { key: 'all' as const, label: 'All in list', count: emails.length },
                    { key: 'linked' as const, label: 'On pipeline', count: linkedEmailCount },
                    { key: 'not_linked' as const, label: 'Not on pipeline', count: unlinkedEmailCount },
                  ] as const
                ).map(({ key, label, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setJobLinkFilter(key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      jobLinkFilter === key
                        ? 'bg-violet-100 text-violet-800 border-violet-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-violet-200'
                    }`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {emails.length > 0 && (
            <input
              type="text"
              placeholder="Search subject, sender, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          )}

          {loading && !s && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center max-w-sm mx-auto">
              {runs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No sync runs to show. Trigger a sync from the header, or widen the date range.
                </p>
              ) : !s && emails.length === 0 ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-700">No sync has run yet</p>
                  <p className="text-sm text-slate-400">
                    Click the <strong>Sync</strong> button in the top bar to process your Gmail inbox for job-related emails.
                  </p>
                </>
              ) : s && emails.length === 0 ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-700">Sync completed — no emails matched</p>
                  <p className="text-sm text-slate-400">
                    This run found no job-related emails in the processed window. Try syncing a wider date range.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">No emails match the selected filter.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStageFilter('all')
                      setJobLinkFilter('all')
                    }}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 underline underline-offset-2"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900 truncate flex-1">
                      {entry.subject || '(no subject)'}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={STATUS_VARIANT[entry.reviewStatus || ''] || 'default'} className="text-[10px]">
                        {entry.reviewStatus || 'unknown'}
                      </Badge>
                    </div>
                  </div>

                  {entry.from && (
                    <p className="text-xs text-slate-500 truncate">
                      <span className="text-slate-400">From:</span> {entry.from}
                    </p>
                  )}
                  {entry.linkedJob && (
                    <p className="text-xs flex flex-wrap items-center gap-1.5">
                      <Badge variant="violet" className="text-[10px]">
                        Pipeline
                      </Badge>
                      <Link
                        href={`/applications?jobId=${entry.linkedJob.id}`}
                        className="text-violet-800 font-medium hover:underline underline-offset-2 truncate"
                      >
                        {entry.linkedJob.company} — {entry.linkedJob.title}
                      </Link>
                    </p>
                  )}
                  {(entry.to || entry.cc || entry.bcc) && (
                    <p className="text-xs text-slate-500 truncate">
                      {entry.to && (
                        <>
                          <span className="text-slate-400">To:</span> {entry.to}{' '}
                        </>
                      )}
                      {entry.cc && (
                        <>
                          <span className="text-slate-400">CC:</span> {entry.cc}{' '}
                        </>
                      )}
                      {entry.bcc && (
                        <>
                          <span className="text-slate-400">BCC:</span> {entry.bcc}
                        </>
                      )}
                    </p>
                  )}
                  {entry.snippet && <p className="text-xs text-slate-400 truncate italic">{entry.snippet}</p>}

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5 flex-wrap">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-medium">
                      {STAGE_LABELS[entry.stage] || entry.stage}
                    </span>
                    {entry.reason && <span className="truncate max-w-xs">{entry.reason}</span>}
                    <span className="ml-auto">{formatWhen(entry.processedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
