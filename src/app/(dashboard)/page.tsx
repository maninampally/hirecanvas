'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  getDashboardAnalytics,
  getRecentJobs,
  getSyncReport,
  type DashboardAnalytics,
  type RecentJobItem,
  type SyncReport,
  type SyncWindowHours,
} from '@/actions/dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ApplicationActivityChart } from '@/components/dashboard/ApplicationActivityChart'
import { SyncReportCard } from '@/components/dashboard/SyncReportCard'
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel'
import { ResponseRateAnalytics } from '@/components/dashboard/ResponseRateAnalytics'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { WeeklyStrategyReport } from '@/components/dashboard/WeeklyStrategyReport'
import { GoalTracker } from '@/components/dashboard/GoalTracker'
import { AchievementBadges } from '@/components/dashboard/AchievementBadges'
import { Badge } from '@/components/ui/badge'
import { DateInput } from '@/components/ui/date-input'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import {
  MdWork,
  MdHandshake,
  MdStarRate,
  MdClose,
  MdPeople,
  MdOutlineEmail,
  MdDescription,
  MdQuiz,
  MdArticle,
  MdSettings,
  MdAdminPanelSettings,
  MdArrowForward,
  MdSync,
} from 'react-icons/md'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { status: syncStatus, syncInProgress, extractionInProgress, queueStatus, isBusy } = useSyncStatus(user?.id)
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJobItem[]>([])
  const [syncWindow, setSyncWindow] = useState<SyncWindowHours>(24)
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null)
  const [syncReportError, setSyncReportError] = useState<string | null>(null)
  const [isSyncLoading, setIsSyncLoading] = useState(true)
  const [isTriggeringSync, setIsTriggeringSync] = useState(false)
  const [syncRequested, setSyncRequested] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [syncFromDate, setSyncFromDate] = useState('')
  const [syncToDate, setSyncToDate] = useState('')
  const [syncRangePreset, setSyncRangePreset] = useState<'custom' | 'last7' | 'last30' | 'thisMonth'>('custom')
  const [isStoppingSync, setIsStoppingSync] = useState(false)

  const toDateInput = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const applyRangePreset = (preset: 'custom' | 'last7' | 'last30' | 'thisMonth') => {
    setSyncRangePreset(preset)
    if (preset === 'custom') return

    const now = new Date()
    const to = toDateInput(now)

    if (preset === 'last7') {
      const fromDate = new Date(now)
      fromDate.setDate(now.getDate() - 6)
      setSyncFromDate(toDateInput(fromDate))
      setSyncToDate(to)
      return
    }

    if (preset === 'last30') {
      const fromDate = new Date(now)
      fromDate.setDate(now.getDate() - 29)
      setSyncFromDate(toDateInput(fromDate))
      setSyncToDate(to)
      return
    }

    const fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
    setSyncFromDate(toDateInput(fromDate))
    setSyncToDate(to)
  }

  const syncButtonLocked = isTriggeringSync || isBusy || syncRequested

  useEffect(() => {
    if (!syncRequested) return
    if (syncStatus?.status === 'in_progress') return
    if (syncStatus?.status === 'completed' || syncStatus?.status === 'failed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncRequested(false)
    }
  }, [syncRequested, syncStatus?.status])

  const loadDashboardData = useCallback(async () => {
    setAnalyticsError(null)
    setIsSyncLoading(true)
    const [data, jobs, report] = await Promise.all([
      getDashboardAnalytics(),
      getRecentJobs(6),
      getSyncReport(syncWindow),
    ])
    setAnalytics(data)
    setRecentJobs(jobs)
    setSyncReport(report)
    setSyncReportError(null)
  }, [syncWindow])

  useEffect(() => {
    let active = true

    async function loadAnalytics() {
      try {
        await loadDashboardData()
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Failed to load analytics'
        setAnalyticsError(message)
        setSyncReportError(message)
      } finally {
        if (active) {
          setIsLoading(false)
          setIsSyncLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      active = false
    }
  }, [loadDashboardData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadDashboardData()
      toast.success('Dashboard refreshed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh dashboard')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center animate-pulse-soft">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold mx-auto mb-4 shadow-md shadow-teal-500/30 animate-spin-slow">
            H
          </div>
          <p className="text-sm text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const kpis = [
    {
      label: 'Total Applications',
      value: analytics?.summary.totalApplications ?? 0,
      subtext: 'Live total',
      icon: MdWork,
      color: 'from-teal-500 to-teal-600',
      border: 'border-l-teal-500',
      iconBg: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Active Interviews',
      value: analytics?.summary.activeInterviews ?? 0,
      subtext: 'Current stage',
      icon: MdHandshake,
      color: 'from-blue-500 to-blue-600',
      border: 'border-l-blue-500',
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Offers',
      value: analytics?.summary.offers ?? 0,
      subtext: 'Current stage',
      icon: MdStarRate,
      color: 'from-emerald-500 to-emerald-600',
      border: 'border-l-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Rejections',
      value: analytics?.summary.rejections ?? 0,
      subtext: 'Current stage',
      icon: MdClose,
      color: 'from-rose-400 to-rose-500',
      border: 'border-l-rose-500',
      iconBg: 'bg-rose-50 text-rose-500',
    },
  ]

  const modules = [
    { title: 'Contacts', icon: MdPeople, desc: 'Manage your professional network', href: '/contacts', color: 'bg-blue-50 text-blue-600' },
    { title: 'Outreach', icon: MdOutlineEmail, desc: 'Track your networking efforts', href: '/outreach', color: 'bg-violet-50 text-violet-600' },
    { title: 'Resumes', icon: MdDescription, desc: 'Upload and manage documents', href: '/resumes', color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Interview Prep', icon: MdQuiz, desc: 'Practice with curated Q&A', href: '/interview-prep', color: 'bg-amber-50 text-amber-600' },
    { title: 'Templates', icon: MdArticle, desc: 'Email & LinkedIn templates', href: '/templates', color: 'bg-rose-50 text-rose-600' },
    { title: 'Settings', icon: MdSettings, desc: 'Account & preferences', href: '/settings', color: 'bg-slate-100 text-slate-600' },
    ...(user?.tier === 'admin' ? [{ title: 'Admin', icon: MdAdminPanelSettings, desc: 'Platform management', href: '/admin', color: 'bg-teal-50 text-teal-600' }] : []),
  ]

  const formatActivityDate = (value: string) => {
    const date = new Date(value)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  const handleManualSync = async () => {
    setIsTriggeringSync(true)
    try {
      const payload = {
        ...(syncFromDate ? { fromDate: syncFromDate } : {}),
        ...(syncToDate ? { toDate: syncToDate } : {}),
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      }
      const response = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as {
        message?: string
        error?: string
        remaining?: number
        fromDate?: string | null
        toDate?: string | null
      }

      if (!response.ok) throw new Error(data.error || 'Unable to start sync')
      setSyncRequested(true)

      toast.success(
        data.fromDate || data.toDate
          ? `Range sync started (${data.fromDate || '...'} to ${data.toDate || 'today'})`
          : typeof data.remaining === 'number'
            ? `Sync started. Remaining: ${data.remaining}`
            : data.message || 'Sync started'
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start sync')
    } finally {
      setIsTriggeringSync(false)
    }
  }


  const handleStopSync = async () => {
    setIsStoppingSync(true)
    try {
      const response = await fetch('/api/sync/stop', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to stop sync')
      toast.success('Sync stopped')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to stop sync')
    } finally {
      setIsStoppingSync(false)
    }
  }

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'there'
  const activityChartData = (analytics?.heatmap.cells || []).map((cell) => ({
    date: cell.date,
    day: new Date(`${cell.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    applications: cell.count,
  }))

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="animate-slide-up flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {greeting}, {displayName} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Here&apos;s your job search overview for today.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 self-start">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">From</label>
            <DateInput
              value={syncFromDate}
              onChange={(value) => {
                setSyncRangePreset('custom')
                setSyncFromDate(value)
              }}
              className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">To</label>
            <DateInput
              value={syncToDate}
              onChange={(value) => {
                setSyncRangePreset('custom')
                setSyncToDate(value)
              }}
              className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">Range</label>
            <select
              value={syncRangePreset}
              onChange={(event) =>
                applyRangePreset(
                  event.target.value as 'custom' | 'last7' | 'last30' | 'thisMonth'
                )
              }
              className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
            >
              <option value="custom">Custom</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="thisMonth">This month</option>
            </select>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSyncRangePreset('custom')
              setSyncFromDate('')
              setSyncToDate('')
            }}
            className="h-9 px-2 text-xs text-slate-500"
          >
            Clear
          </Button>
          <Button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            className="inline-flex items-center gap-2"
          >
            <MdSync className={isRefreshing ? 'animate-spin-slow' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            type="button"
            onClick={handleManualSync}
            disabled={syncButtonLocked}
            className="inline-flex items-center gap-2 min-w-[120px] justify-center"
          >
            <MdSync className={isTriggeringSync ? 'animate-spin-slow' : ''} />
            {syncButtonLocked ? 'Syncing...' : 'Sync Jobs'}
          </Button>
          {syncButtonLocked && (
            <Button
              type="button"
              variant="outline"
              onClick={handleStopSync}
              disabled={isStoppingSync}
              className="inline-flex items-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              {isStoppingSync ? 'Stopping...' : 'Stop Sync'}
            </Button>
          )}
          {syncStatus && syncStatus.status === 'in_progress' && (
            <div className="w-full rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
              Syncing emails: {syncStatus.processed_count}/{syncStatus.total_emails} processed.
            </div>
          )}
          {!syncInProgress && extractionInProgress && queueStatus && (
            <div className="w-full rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800 flex items-center justify-between">
              <span>
                Extracting jobs... ({queueStatus.counts.completed}/{queueStatus.counts.waiting + queueStatus.counts.active + queueStatus.counts.completed} today)
              </span>
              <span className="text-teal-600 font-medium">
                ~{Math.ceil((queueStatus.counts.waiting + queueStatus.counts.active) / 3)} min remaining
              </span>
            </div>
          )}
          {queueStatus && queueStatus.counts.failed > 0 && (
            <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {queueStatus.counts.failed} extraction{queueStatus.counts.failed > 1 ? 's' : ''} failed — likely AI rate limit. Jobs will retry automatically.
            </div>
          )}
          {syncStatus && syncStatus.status === 'failed' && (
            <div className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              Last sync failed{syncStatus.error_message ? `: ${syncStatus.error_message}` : '.'}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <Card
              key={i}
              className={`border-l-[3px] ${kpi.border} animate-slide-up`}
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1.5">{kpi.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{kpi.subtext}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} flex items-center justify-center`}>
                    <Icon className="text-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6 animate-slide-up delay-200">
        <div className="lg:col-span-2">
          <ApplicationActivityChart data={activityChartData} />
        </div>
        <SyncReportCard
          report={syncReport}
          windowHours={syncWindow}
          onWindowChange={setSyncWindow}
          isLoading={isSyncLoading}
          error={syncReportError}
        />
      </div>

      {analyticsError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 animate-slide-up">
          {analyticsError}
        </div>
      )}

      {/* Sprint 4 Analytics */}
      <div className="space-y-6 animate-slide-up delay-250">
        <h2 className="text-lg font-bold text-slate-900">Analytics & Insights</h2>

        <div className="grid lg:grid-cols-2 gap-6">
          <PipelineFunnel data={analytics?.funnel || []} />
          <ResponseRateAnalytics data={analytics?.responseRates || []} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityHeatmap cells={analytics?.heatmap.cells || []} />
          </div>
          <WeeklyStrategyReport />
        </div>
      </div>

      {/* Applications Table */}
      <Card className="animate-slide-up delay-300">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Active Applications</h3>
          <Link href="/applications">
            <Button size="sm" variant="ghost" className="text-teal-600 text-xs">
              View All <MdArrowForward />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-3.5 text-left">Company</th>
                <th className="px-6 py-3.5 text-left">Title</th>
                <th className="px-6 py-3.5 text-left">Status</th>
                <th className="px-6 py-3.5 text-left">Source</th>
                <th className="px-6 py-3.5 text-left">Last Activity</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">
                    No applications yet. <Link href="/applications" className="text-teal-600 font-medium">Add your first job →</Link>
                  </td>
                </tr>
              )}
              {recentJobs.map((job) => {
                const statusVariant: Record<string, 'amber' | 'blue' | 'emerald' | 'rose' | 'teal'> = {
                  Wishlist: 'teal', Applied: 'blue', Screening: 'amber',
                  Interview: 'amber', Offer: 'emerald', Rejected: 'rose',
                }
                return (
                  <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 text-sm">{job.company}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{job.title}</td>
                    <td className="px-6 py-4"><Badge variant={statusVariant[job.status] || 'teal'}>{job.status}</Badge></td>
                    <td className="px-6 py-4 text-slate-400 text-xs capitalize">{job.source || 'Manual'}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{formatActivityDate(job.updated_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href="/applications"><Button variant="ghost" size="sm" className="text-teal-600 text-xs">View →</Button></Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modules Grid */}
      <div className="animate-slide-up delay-400">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Access</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod, i) => {
            const Icon = mod.icon
            return (
              <Link key={i} href={mod.href}>
                <Card className="group cursor-pointer hover:shadow-teal-md transition-all duration-300 h-full">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl ${mod.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="text-xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">{mod.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{mod.desc}</p>
                    </div>
                    <MdArrowForward className="text-slate-300 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all mt-1" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {analytics && (
        <div className="grid lg:grid-cols-2 gap-6 animate-slide-up delay-500">
          <GoalTracker
            weeklyTarget={analytics.gamification.weeklyTarget}
            weeklyCompleted={analytics.gamification.weeklyCompleted}
            currentStreak={analytics.gamification.currentStreak}
            longestStreak={analytics.gamification.longestStreak}
          />
          <AchievementBadges achievements={analytics.gamification.achievements} />
        </div>
      )}
    </div>
  )
}
