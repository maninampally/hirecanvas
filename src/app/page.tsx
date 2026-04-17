'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { ApplicationActivityChart } from '@/components/dashboard/ApplicationActivityChart'
import { AIExtractionFeed } from '@/components/dashboard/AIExtractionFeed'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/stores/authStore'
import {
  MdAutoAwesome,
  MdEmail,
  MdTimeline,
  MdQuiz,
  MdDescription,
  MdNotificationsActive,
  MdCheckCircle,
  MdArrowForward,
  MdStar,
} from 'react-icons/md'

export default function Home() {
  const router = useRouter()
  const { user, setUser, setLoading } = useAuthStore()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name,
            avatar_url: authUser.user_metadata?.avatar_url,
            tier: 'free',
          })
        }
      } catch (error) {
        console.error('Auth check failed:', error)
      } finally {
        setIsCheckingAuth(false)
        setLoading(false)
      }
    }
    checkAuth()
  }, [supabase, setUser, setLoading])

  // ── Logged-in Dashboard ──
  if (user && !isCheckingAuth) {
    return (
      <DashboardLayout>
        <div className="w-full space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Your Application Pipeline</h2>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Applications', value: 124, subtext: '+12 this week', color: 'from-teal-500 to-teal-600', border: 'border-l-teal-500' },
              { label: 'Active Interviews', value: 7, subtext: '+2 this week', color: 'from-blue-500 to-blue-600', border: 'border-l-blue-500' },
              { label: 'Offers', value: 1, subtext: '+1 this week', color: 'from-emerald-500 to-emerald-600', border: 'border-l-emerald-500' },
              { label: 'Rejections', value: 32, subtext: '-3 this week', color: 'from-rose-400 to-rose-500', border: 'border-l-rose-500' },
            ].map((kpi, i) => (
              <Card key={i} className={`border-l-[3px] ${kpi.border} animate-slide-up`} style={{ animationDelay: `${i * 75}ms` }}>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{kpi.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{kpi.subtext}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ApplicationActivityChart className="h-full" />
            </div>
            <AIExtractionFeed className="h-full" />
          </div>

          {/* Applications Table */}
          <Card>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Active Applications</h3>
              <Button size="sm" variant="outline">Filter</Button>
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
                    { company: 'Google', role: 'Senior Frontend Engineer', stage: 'Interview', stageColor: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60', source: 'Gmail Sync', activity: '2 days ago' },
                    { company: 'Meta', role: 'Full Stack Engineer', stage: 'Applied', stageColor: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/60', source: 'Manual', activity: '5 days ago' },
                    { company: 'Stripe', role: 'Product Engineer', stage: 'Offer', stageColor: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60', source: 'Gmail Sync', activity: '1 day ago' },
                    { company: 'Amazon', role: 'Backend Engineer', stage: 'Rejected', stageColor: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60', source: 'Manual', activity: '1 week ago' },
                  ].map((app, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 text-sm">{app.company}</td>
                      <td className="px-6 py-4 text-slate-600 text-sm">{app.role}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${app.stageColor}`}>{app.stage}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{app.source}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{app.activity}</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 text-xs">View →</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  // ── Landing Page ──
  const features = [
    { icon: MdEmail, title: 'Gmail Sync', desc: 'Automatically pull job emails and track them in one place.', color: 'bg-blue-50 text-blue-600' },
    { icon: MdAutoAwesome, title: 'AI Extraction', desc: 'AI reads your emails and extracts company, role, and status.', color: 'bg-violet-50 text-violet-600' },
    { icon: MdTimeline, title: 'Pipeline Tracking', desc: 'Visual dashboard of all applications and their current status.', color: 'bg-teal-50 text-teal-600' },
    { icon: MdQuiz, title: 'Interview Prep', desc: '50+ curated questions with sample answers for top companies.', color: 'bg-amber-50 text-amber-600' },
    { icon: MdDescription, title: 'Resume Manager', desc: 'Upload, version, and optimize your resumes for ATS systems.', color: 'bg-emerald-50 text-emerald-600' },
    { icon: MdNotificationsActive, title: 'Smart Reminders', desc: 'Auto follow-up nudges so you never miss a deadline.', color: 'bg-rose-50 text-rose-600' },
  ]

  const plans = [
    { name: 'Free', price: '0', desc: 'Get started with the basics', features: ['Manual job entry', 'Basic templates', 'Interview prep', '5 contacts'], highlighted: false },
    { name: 'Pro', price: '9.99', desc: 'Automate your job search', features: ['3 auto syncs/day', 'Gemini AI extraction', 'Follow-up nudges', 'Unlimited contacts', 'All templates'], highlighted: true },
    { name: 'Elite', price: '29.99', desc: 'The ultimate edge', features: ['Unlimited syncs', 'Claude AI extraction', 'AI cover letters', 'Interview coaching', 'Priority support'], highlighted: false },
  ]

  return (
    <div className="min-h-screen bg-[#f0fdfb]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-md shadow-teal-500/30">
              H
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">HireCanvas</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-teal-200/30 via-transparent to-emerald-100/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-blue-100/20 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-full text-xs font-semibold text-teal-700 ring-1 ring-teal-200/60 mb-6">
                <MdAutoAwesome className="text-sm" />
                AI-Powered Job Search Management
              </div>
              <h2 className="text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-6">
                Your Job Search{' '}
                <span className="text-gradient-teal">Command Center</span>
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
                Auto-sync job emails, extract data with AI, and track your entire pipeline from application to offer — all in one beautiful dashboard.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/register">
                  <Button size="lg">
                    Start Free Today
                    <MdArrowForward />
                  </Button>
                </Link>
                <Button variant="outline" size="lg">See How It Works</Button>
              </div>

              {/* Trust signals */}
              <div className="flex items-center gap-6 mt-10 pt-8 border-t border-slate-200/60">
                {[
                  { value: '2,500+', label: 'Active Users' },
                  { value: '18,000+', label: 'Jobs Tracked' },
                  { value: '4.9/5', label: 'User Rating' },
                ].map((stat, i) => (
                  <div key={i}>
                    <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="animate-slide-up delay-200 hidden lg:block">
              <div className="relative">
                <div className="bg-white rounded-2xl shadow-teal-lg border border-slate-200/60 p-6 space-y-4">
                  {/* Mini KPI row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Applications', value: '124', color: 'border-l-teal-500' },
                      { label: 'Interviews', value: '7', color: 'border-l-blue-500' },
                      { label: 'Offers', value: '3', color: 'border-l-emerald-500' },
                    ].map((k, i) => (
                      <div key={i} className={`bg-slate-50 rounded-xl p-3 border-l-[3px] ${k.color}`}>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">{k.label}</p>
                        <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Mini chart */}
                  <div className="bg-slate-50 rounded-xl p-4 h-40 flex items-end gap-2">
                    {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
                      <div key={i} className="flex-1 bg-gradient-to-t from-teal-400 to-teal-300 rounded-t-lg transition-all" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  {/* Mini table rows */}
                  <div className="space-y-2">
                    {['Google — Senior Frontend', 'Stripe — Product Engineer', 'Meta — Full Stack'].map((row, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-slate-700">{row}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          i === 0 ? 'bg-amber-50 text-amber-600' : i === 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {i === 0 ? 'Interview' : i === 1 ? 'Offer' : 'Applied'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Floating decorations */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-teal-200/40 to-emerald-200/40 rounded-full blur-xl animate-float" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-tr from-blue-200/30 to-violet-200/30 rounded-full blur-xl animate-float delay-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-3">Everything You Need to Land the Job</h3>
            <p className="text-slate-500 max-w-lg mx-auto">Powerful tools designed for modern job seekers. Automate the busywork, focus on what matters.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={i}
                  className="group p-6 rounded-2xl border border-slate-200/60 bg-white hover:shadow-teal-md hover:border-teal-200/60 transition-all duration-300"
                >
                  <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="text-xl" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-2">{f.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-3">Simple, Transparent Pricing</h3>
            <p className="text-slate-500">Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-8 text-center transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-teal-500 to-teal-600 text-white shadow-xl shadow-teal-500/25 scale-105 ring-2 ring-teal-400/40'
                    : 'bg-white border border-slate-200 hover:shadow-teal-md hover:border-teal-200/60'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full shadow-sm">
                    <MdStar className="text-xs" /> Most Popular
                  </div>
                )}
                <h4 className={`text-xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h4>
                <p className={`text-sm mb-4 ${plan.highlighted ? 'text-teal-100' : 'text-slate-500'}`}>{plan.desc}</p>
                <div className={`text-4xl font-extrabold mb-6 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>
                  ${plan.price}
                  <span className={`text-base font-medium ${plan.highlighted ? 'text-teal-200' : 'text-slate-400'}`}>/mo</span>
                </div>
                <ul className="text-left space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      <MdCheckCircle className={`text-base mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-teal-200' : 'text-teal-500'}`} />
                      <span className={plan.highlighted ? 'text-teal-50' : 'text-slate-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button
                    variant={plan.highlighted ? 'outline' : (i === 0 ? 'outline' : 'default')}
                    className={`w-full ${plan.highlighted ? 'border-white/40 text-white hover:bg-white/10' : ''}`}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-gradient-to-br from-teal-600 to-teal-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-white rounded-full blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h3 className="text-3xl font-bold text-white mb-4">Ready to Take Control of Your Job Search?</h3>
          <p className="text-teal-100 text-lg mb-8 max-w-xl mx-auto">
            Join thousands of job seekers who track smarter, not harder.
          </p>
          <Link href="/register">
            <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 shadow-lg">
              Start Free — No Credit Card Required
              <MdArrowForward />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-slate-200/60 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-[10px]">H</div>
                <span className="font-bold text-slate-800">HireCanvas</span>
              </div>
              <p className="text-sm text-slate-500">Your AI-powered job search command center.</p>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-slate-900 mb-3">Product</h5>
              <ul className="space-y-2 text-sm"><li><a href="#" className="text-slate-500 hover:text-teal-600 transition-colors">Features</a></li><li><a href="#" className="text-slate-500 hover:text-teal-600 transition-colors">Pricing</a></li></ul>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-slate-900 mb-3">Legal</h5>
              <ul className="space-y-2 text-sm"><li><Link href="/terms" className="text-slate-500 hover:text-teal-600 transition-colors">Terms</Link></li><li><Link href="/privacy" className="text-slate-500 hover:text-teal-600 transition-colors">Privacy</Link></li></ul>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-slate-900 mb-3">Contact</h5>
              <p className="text-sm text-slate-500">hello@hirecanvas.in</p>
            </div>
          </div>
          <div className="border-t border-slate-200/60 pt-8 text-center">
            <p className="text-sm text-slate-400">&copy; 2026 HireCanvas. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
