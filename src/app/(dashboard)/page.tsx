'use client'

import { useEffect, useState } from 'react'
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
import { useAuthStore } from '@/stores/authStore'
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
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJobItem[]>([])
  const [syncWindow, setSyncWindow] = useState<SyncWindowHours>(24)
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null)
  const [syncReportError, setSyncReportError] = useState<string | null>(null)
  const [isSyncLoading, setIsSyncLoading] = useState(true)
  const [isTriggeringSync, setIsTriggeringSync] = useState(false)

  useEffect(() => {
    let active = true

    async function loadAnalytics() {
      try {
        setAnalyticsError(null)
        setIsSyncLoading(true)
        const [data, jobs, report] = await Promise.all([
          getDashboardAnalytics(),
          getRecentJobs(6),
          getSyncReport(syncWindow),
        ])
        if (active) {
          setAnalytics(data)
          setRecentJobs(jobs)
          setSyncReport(report)
          setSyncReportError(null)
        }
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
  }, [syncWindow])

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
      const response = await fetch('/api/sync/trigger', { method: 'POST' })
      const data = (await response.json()) as {
        message?: string
        error?: string
        remaining?: number
      }

      if (!response.ok) throw new Error(data.error || 'Unable to start sync')

      toast.success(
        typeof data.remaining === 'number'
          ? `Sync started. Remaining: ${data.remaining}`
          : data.message || 'Sync started'
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start sync')
    } finally {
      setIsTriggeringSync(false)
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
        <Button
          type="button"
          onClick={handleManualSync}
          disabled={isTriggeringSync}
          className="inline-flex items-center gap-2 self-start"
        >
          <MdSync className={isTriggeringSync ? 'animate-spin-slow' : ''} />
          {isTriggeringSync ? 'Syncing...' : 'Sync Jobs'}
        </Button>
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
          <Link href="/jobs">
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
                    No applications yet. <Link href="/jobs" className="text-teal-600 font-medium">Add your first job →</Link>
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
                      <Link href="/jobs"><Button variant="ghost" size="sm" className="text-teal-600 text-xs">View →</Button></Link>
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
