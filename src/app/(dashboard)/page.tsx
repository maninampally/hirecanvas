'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ApplicationActivityChart } from '@/components/dashboard/ApplicationActivityChart'
import { AIExtractionFeed } from '@/components/dashboard/AIExtractionFeed'
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
  MdSettings,
  MdAdminPanelSettings,
  MdArrowForward,
} from 'react-icons/md'

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(false)
  }, [])

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
    { label: 'Total Applications', value: 124, subtext: '+12 this week', icon: MdWork, color: 'from-teal-500 to-teal-600', border: 'border-l-teal-500', iconBg: 'bg-teal-50 text-teal-600' },
    { label: 'Active Interviews', value: 7, subtext: '+2 this week', icon: MdHandshake, color: 'from-blue-500 to-blue-600', border: 'border-l-blue-500', iconBg: 'bg-blue-50 text-blue-600' },
    { label: 'Offers', value: 1, subtext: '+1 this week', icon: MdStarRate, color: 'from-emerald-500 to-emerald-600', border: 'border-l-emerald-500', iconBg: 'bg-emerald-50 text-emerald-600' },
    { label: 'Rejections', value: 32, subtext: '-3 this week', icon: MdClose, color: 'from-rose-400 to-rose-500', border: 'border-l-rose-500', iconBg: 'bg-rose-50 text-rose-500' },
  ]

  const modules = [
    { title: 'Contacts', icon: MdPeople, desc: 'Manage your professional network', href: '/contacts', color: 'bg-blue-50 text-blue-600' },
    { title: 'Outreach', icon: MdOutlineEmail, desc: 'Track your networking efforts', href: '/outreach', color: 'bg-violet-50 text-violet-600' },
    { title: 'Resumes', icon: MdDescription, desc: 'Upload and manage documents', href: '/resumes', color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Interview Prep', icon: MdQuiz, desc: 'Practice with curated Q&A', href: '/interview-prep', color: 'bg-amber-50 text-amber-600' },
    { title: 'Settings', icon: MdSettings, desc: 'Account & preferences', href: '/settings', color: 'bg-slate-100 text-slate-600' },
    { title: 'Admin', icon: MdAdminPanelSettings, desc: 'Platform management', href: '/admin', color: 'bg-teal-50 text-teal-600' },
  ]

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {greeting()}, {user?.full_name || user?.email?.split('@')[0] || 'there'} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Here&apos;s your job search overview for today.
        </p>
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
          <ApplicationActivityChart />
        </div>
        <AIExtractionFeed />
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
                <th className="px-6 py-3.5 text-left">Role</th>
                <th className="px-6 py-3.5 text-left">Stage</th>
                <th className="px-6 py-3.5 text-left">Source</th>
                <th className="px-6 py-3.5 text-left">Last Activity</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { company: 'Google', role: 'Senior Frontend Engineer', stage: 'Interview', variant: 'amber' as const, source: 'Gmail Sync', activity: '2 days ago' },
                { company: 'Meta', role: 'Full Stack Engineer', stage: 'Applied', variant: 'blue' as const, source: 'Manual', activity: '5 days ago' },
                { company: 'Stripe', role: 'Product Engineer', stage: 'Offer', variant: 'emerald' as const, source: 'Gmail Sync', activity: '1 day ago' },
                { company: 'Amazon', role: 'Backend Engineer', stage: 'Rejected', variant: 'rose' as const, source: 'Manual', activity: '1 week ago' },
              ].map((app, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900 text-sm">{app.company}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{app.role}</td>
                  <td className="px-6 py-4"><Badge variant={app.variant}>{app.stage}</Badge></td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{app.source}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{app.activity}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" className="text-teal-600 text-xs">View →</Button>
                  </td>
                </tr>
              ))}
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
    </div>
  )
}
