import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  MARKETING_CONTACT_EMAIL,
  MARKETING_DASHBOARD_ACTIVITY,
  MARKETING_PLANS,
  MARKETING_TRUST_CHIPS,
} from '@/lib/constants'
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
  MdRocketLaunch,
  MdSpeed,
  MdShield,
} from 'react-icons/md'

export default async function Home() {
  // Server-side auth check — redirect logged-in users to the real dashboard
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  const features = [
    { icon: MdEmail, title: 'Gmail Sync', desc: 'Automatically pull job emails and track them in one place.', color: 'bg-blue-50 text-blue-600', ring: 'ring-blue-200/60' },
    { icon: MdAutoAwesome, title: 'AI Extraction', desc: 'AI reads your emails and extracts company, role, and status.', color: 'bg-violet-50 text-violet-600', ring: 'ring-violet-200/60' },
    { icon: MdTimeline, title: 'Pipeline Tracking', desc: 'Visual dashboard of all applications and their current status.', color: 'bg-teal-50 text-teal-600', ring: 'ring-teal-200/60' },
    { icon: MdQuiz, title: 'Interview Prep', desc: 'Curated questions with sample answers for common interview formats.', color: 'bg-amber-50 text-amber-600', ring: 'ring-amber-200/60' },
    { icon: MdDescription, title: 'Resume Manager', desc: 'Upload, version, and optimize your resumes for ATS systems.', color: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-200/60' },
    { icon: MdNotificationsActive, title: 'Smart Reminders', desc: 'Auto follow-up nudges so you never miss a deadline.', color: 'bg-rose-50 text-rose-600', ring: 'ring-rose-200/60' },
  ]

  const whyCards = [
    { icon: MdRocketLaunch, title: 'Launch in Minutes', desc: 'Sign up, connect Gmail, and let AI do the rest. No config needed.', gradient: 'from-teal-500 to-emerald-500' },
    { icon: MdSpeed, title: '10x Faster Tracking', desc: 'Auto-extract job data from emails instead of manual spreadsheets.', gradient: 'from-blue-500 to-indigo-500' },
    { icon: MdShield, title: 'Bank-Grade Security', desc: 'AES-256 encryption, RLS policies, and PII sanitization built in.', gradient: 'from-violet-500 to-purple-500' },
  ]

  return (
    <div className="min-h-screen bg-[#f0fdfb]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 glass border-b border-slate-200/40">
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-teal-500/30">
              H
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">HireCanvas</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-teal-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-teal-600 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-teal-600 transition-colors">Pricing</a>
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-to-br from-teal-200/30 via-transparent to-emerald-100/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-blue-100/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-0 w-[300px] h-[300px] bg-gradient-to-br from-violet-100/15 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 rounded-full text-xs font-semibold text-teal-700 ring-1 ring-teal-200/60 mb-6 shadow-sm">
                <MdAutoAwesome className="text-sm animate-pulse-soft" />
                AI-Powered Job Search Management
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.08] tracking-tight mb-6">
                Your Job Search{' '}
                <span className="text-gradient-teal">Command Center</span>
              </h1>
              <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
                Auto-sync job emails, extract data with AI, and track your entire pipeline from application to offer — all in one beautiful dashboard.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/register">
                  <Button size="lg" className="shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-shadow">
                    Start Free Today
                    <MdArrowForward />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button variant="outline" size="lg">See How It Works</Button>
                </a>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center gap-3 mt-12 pt-8 border-t border-slate-200/60">
                {MARKETING_TRUST_CHIPS.map((label, i) => (
                  <div key={i} className="animate-slide-up" style={{ animationDelay: `${400 + i * 100}ms` }}>
                    <p className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard preview mockup */}
            <div className="animate-slide-up delay-200 hidden lg:block">
              <div className="relative">
                <div className="bg-white rounded-2xl shadow-teal-lg border border-slate-200/60 p-6 space-y-4">
                  {/* Mini KPI row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Applications', color: 'border-l-teal-500', bg: 'bg-teal-50/50' },
                      { label: 'Interviews', color: 'border-l-blue-500', bg: 'bg-blue-50/50' },
                      { label: 'Offers', color: 'border-l-emerald-500', bg: 'bg-emerald-50/50' },
                    ].map((k, i) => (
                      <div key={i} className={`${k.bg} rounded-xl p-3 border-l-[3px] ${k.color}`}>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{k.label}</p>
                        <div className="mt-2 h-5 w-10 rounded bg-white/80" />
                      </div>
                    ))}
                  </div>
                  {/* Mini chart */}
                  <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl p-4 h-40 flex items-end gap-2">
                    {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
                      <div key={i} className="flex-1 bg-gradient-to-t from-teal-500 to-teal-300 rounded-t-lg transition-all hover:opacity-80" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  {/* Mini table rows */}
                  <div className="space-y-2">
                    {MARKETING_DASHBOARD_ACTIVITY.map((row, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 hover:bg-slate-100/80 transition-colors">
                        <span className="text-xs font-medium text-slate-700">{row}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          i === 0 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60' : i === 1 ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60' : 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/60'
                        }`}>
                          {i === 0 ? 'Review' : i === 1 ? 'Synced' : 'Queued'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Floating decorations */}
                <div className="absolute -top-5 -right-5 w-28 h-28 bg-gradient-to-br from-teal-200/40 to-emerald-200/40 rounded-full blur-xl animate-float" />
                <div className="absolute -bottom-7 -left-7 w-36 h-36 bg-gradient-to-tr from-blue-200/30 to-violet-200/30 rounded-full blur-xl animate-float delay-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">How It Works</h2>
            <p className="text-slate-500 max-w-lg mx-auto">Three simple steps to transform your job search</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '01', title: 'Connect Gmail', desc: 'One-click OAuth — we pull job-related emails automatically.' },
              { step: '02', title: 'AI Extracts Data', desc: 'Gemini & Claude parse company, role, salary, and status.' },
              { step: '03', title: 'Track & Win', desc: 'Dashboard, reminders, and nudges keep you ahead.' },
            ].map((item, i) => (
              <div key={i} className="relative text-center group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-teal-500/25 group-hover:scale-110 transition-transform duration-300">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 -right-4 w-8 text-teal-300">
                    <MdArrowForward className="text-2xl" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why HireCanvas ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Why HireCanvas?</h2>
            <p className="text-slate-500 max-w-lg mx-auto">Built for serious job seekers who want an unfair advantage.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {whyCards.map((card, i) => {
              const Icon = card.icon
              return (
                <div key={i} className="group relative rounded-2xl bg-white border border-slate-200/60 p-8 hover:shadow-teal-lg transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white text-2xl mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{card.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything You Need to Land the Job</h2>
            <p className="text-slate-500 max-w-lg mx-auto">Powerful tools designed for modern job seekers. Automate the busywork, focus on what matters.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={i}
                  className={`group p-6 rounded-2xl border border-slate-200/60 bg-white hover:shadow-teal-md hover:border-teal-200/60 transition-all duration-300`}
                >
                  <div className={`w-12 h-12 rounded-xl ${f.color} ring-1 ${f.ring} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
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
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple, Transparent Pricing</h2>
            <p className="text-slate-500">Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {MARKETING_PLANS.map((plan, i) => (
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
      <section className="py-24 bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-56 h-56 bg-white rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-teal-400 rounded-full blur-3xl opacity-20" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Take Control of Your Job Search?</h2>
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
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-slate-500 hover:text-teal-600 transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-slate-500 hover:text-teal-600 transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-slate-900 mb-3">Legal</h5>
              <ul className="space-y-2 text-sm">
                <li><Link href="/terms" className="text-slate-500 hover:text-teal-600 transition-colors">Terms</Link></li>
                <li><Link href="/privacy" className="text-slate-500 hover:text-teal-600 transition-colors">Privacy</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-slate-900 mb-3">Contact</h5>
              <p className="text-sm text-slate-500">{MARKETING_CONTACT_EMAIL}</p>
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
