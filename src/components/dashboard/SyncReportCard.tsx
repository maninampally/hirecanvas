'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SyncReport, SyncWindowHours } from '@/actions/dashboard'

type SyncReportCardProps = {
  report: SyncReport | null
  windowHours: SyncWindowHours
  onWindowChange: (nextWindow: SyncWindowHours) => void
  isLoading: boolean
  error: string | null
}

function formatWhen(value: string) {
  const date = new Date(value)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function SyncReportCard({
  report,
  windowHours,
  onWindowChange,
  isLoading,
  error,
}: SyncReportCardProps) {
  const totals = report?.totals || { processed: 0, created: 0, updated: 0, skipped: 0 }
  const confidence = report?.confidenceBuckets || { high: 0, medium: 0, low: 0, unknown: 0 }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Daily Sync Report</CardTitle>
            <p className="text-xs text-slate-600 mt-1">Processed emails and extraction quality by window.</p>
          </div>
          <Select
            value={String(windowHours)}
            onChange={(e) => onWindowChange(Number(e.target.value) as SyncWindowHours)}
            className="w-28"
          >
            <option value="12">12h</option>
            <option value="24">24h</option>
            <option value="48">48h</option>
            <option value="168">7d</option>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-slate-50 px-3 py-2"><span className="text-slate-500">Processed</span><p className="text-slate-900 font-semibold">{totals.processed}</p></div>
          <div className="rounded-md bg-slate-50 px-3 py-2"><span className="text-slate-500">Created</span><p className="text-slate-900 font-semibold">{totals.created}</p></div>
          <div className="rounded-md bg-slate-50 px-3 py-2"><span className="text-slate-500">Updated</span><p className="text-slate-900 font-semibold">{totals.updated}</p></div>
          <div className="rounded-md bg-slate-50 px-3 py-2"><span className="text-slate-500">Queued for AI Analysis</span><p className="text-slate-900 font-semibold">{totals.skipped}</p></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="emerald">High: {confidence.high}</Badge>
          <Badge variant="amber">Medium: {confidence.medium}</Badge>
          <Badge variant="rose">Low: {confidence.low}</Badge>
          <Badge variant="teal">Unknown: {confidence.unknown}</Badge>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Activity</p>
          {isLoading && <p className="text-xs text-slate-500">Refreshing sync report...</p>}
          {!isLoading && report?.recentActivity.length === 0 && (
            <p className="text-xs text-slate-500">No synced activity in this window.</p>
          )}
          {(report?.recentActivity || []).slice(0, 6).map((item) => (
            <div key={item.emailId} className="rounded-md border border-slate-200 px-3 py-2">
              <p className="text-xs font-medium text-slate-900 truncate">{item.company} - {item.title}</p>
              <p className="text-xs text-slate-500 truncate">{item.subject}</p>
              <p className="text-[11px] text-slate-400 mt-1">{item.emailDirection} | {formatWhen(item.receivedAt)}</p>
            </div>
          ))}
        </div>

        <Link href="/applications">
          <Button variant="outline" className="w-full text-xs">
            Open jobs for full timeline
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
