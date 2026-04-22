'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UpgradeModal } from '@/components/auth/UpgradeModal'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { ApplicationsSidebar } from '@/components/layout/ApplicationsSidebar'
import { useAuthStore } from '@/stores/authStore'
import { TierGate } from '@/components/ui/TierGate'
import { createClient } from '@/lib/supabase/client'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { toast } from 'sonner'
import {
  MdDashboard,
  MdWork,
  MdPeople,
  MdNotifications,
  MdOutlineEmail,
  MdDescription,
  MdQuiz,
  MdArticle,
  MdSettings,
  MdAdminPanelSettings,
  MdSync,
  MdSearch,
  MdLogout,
  MdChevronLeft,
  MdChevronRight,
  MdMenu,
  MdBalance,
  MdViewSidebar,
} from 'react-icons/md'

function getNavigationSections(tier?: string) {
  const systemItems = [
    { label: 'Settings', href: '/settings', icon: MdSettings },
  ]

  if (tier === 'admin') {
    systemItems.push({ label: 'Admin', href: '/admin', icon: MdAdminPanelSettings })
  }

  return [
    {
      title: 'OVERVIEW',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: MdDashboard },
        { label: 'Applications', href: '/jobs', icon: MdWork },
      ],
    },
    {
      title: 'NETWORK',
      items: [
        { label: 'Contacts', href: '/contacts', icon: MdPeople },
        { label: 'Outreach', href: '/outreach', icon: MdOutlineEmail },
        { label: 'Reminders', href: '/reminders', icon: MdNotifications },
      ],
    },
    {
      title: 'TOOLKIT',
      items: [
        { label: 'Resumes', href: '/resumes', icon: MdDescription },
        { label: 'Interview Prep', href: '/interview-prep', icon: MdQuiz },
        { label: 'Templates', href: '/templates', icon: MdArticle },
        { label: 'Offers', href: '/offers', icon: MdBalance },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        ...systemItems,
        { label: 'Billing', href: '/billing', icon: MdBalance },
      ],
    },
  ]
}

const pathTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/jobs': 'Applications',
  '/contacts': 'Contacts',
  '/outreach': 'Outreach',
  '/reminders': 'Reminders',
  '/resumes': 'Resumes',
  '/interview-prep': 'Interview Prep',
  '/templates': 'Templates',
  '/settings': 'Settings',
  '/admin': 'Admin',
  '/billing': 'Billing',
  '/offers': 'Offer Comparison',
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [applicationsPanelCollapsed, setApplicationsPanelCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem('hc:applications_sidebar_collapsed') !== 'false'
  })
  const [applicationsFilter, setApplicationsFilter] = useState<'All' | 'Active' | 'Interview' | 'Offer'>('All')
  const supabase = createClient()
  const { status: syncStatus, syncInProgress } = useSyncStatus(user?.id)

  useEffect(() => {
    window.localStorage.setItem(
      'hc:applications_sidebar_collapsed',
      String(applicationsPanelCollapsed)
    )
  }, [applicationsPanelCollapsed])

  // Close user menu on outside click
  useEffect(() => {
    const handler = () => {
      if (showUserMenu) setShowUserMenu(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showUserMenu])

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
    router.push('/login')
  }

  const handleSyncInbox = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/sync/trigger', { method: 'POST' })
      const data = (await response.json()) as {
        message?: string; error?: string; remaining?: number
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
      setIsSyncing(false)
    }
  }

  const pageTitle = pathTitles[pathname] || 'Dashboard'

  return (
    <div className="flex h-screen bg-[#f5f6ff] overflow-hidden">
      {mobileSidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-72 bg-gradient-to-b from-[#eef2ff] to-[#e0e7ff] border-r border-indigo-100/70 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed lg:static inset-y-0 left-0 z-50 lg:z-auto ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-indigo-100/70 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md shadow-indigo-500/30">
            H
          </div>
          {!collapsed && (
            <span className="text-base font-bold text-slate-800 tracking-tight">
              HireCanvas
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {getNavigationSections(user?.tier).map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-widest mb-2 px-3">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                          : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 hover:shadow-sm'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`text-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'
                        }`}
                      />
                      {!collapsed && item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sync + Collapse */}
        <div className="border-t border-indigo-100/70 p-3 space-y-2">
          <TierGate
            currentTier={user?.tier}
            allowedTiers={['pro', 'elite', 'admin']}
            fallback={
              !collapsed ? (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <MdSync className="text-lg" />
                  {!collapsed && 'Upgrade to Sync'}
                </button>
              ) : null
            }
          >
            <button
              onClick={handleSyncInbox}
              disabled={isSyncing || syncInProgress}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <MdSync className={`text-lg ${isSyncing || syncInProgress ? 'animate-spin-slow' : ''}`} />
              {!collapsed && (isSyncing ? 'Syncing...' : syncInProgress ? 'In Progress...' : 'Sync Jobs')}
            </button>
          </TierGate>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
          >
            {collapsed ? <MdChevronRight className="text-base" /> : <><MdChevronLeft className="text-base" /> Collapse</>}
          </button>
        </div>

        {/* User */}
        <div className="border-t border-indigo-100/70 p-3">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/60 cursor-pointer transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu) }}
          >
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {user?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-slate-400 truncate">{user?.tier || 'Free'} plan</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div>
            <div className="flex items-center gap-2">
              <button
                className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open menu"
              >
                <MdMenu className="text-xl" />
              </button>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 h-9 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-400 hover:bg-white hover:border-slate-300 transition-all"
            >
              <MdSearch className="text-base" />
              <span className="hidden md:inline">Search...</span>
              <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-400 border border-slate-200">
                ⌘K
              </kbd>
            </button>

            {/* Sync status */}
            {syncStatus && syncStatus.status !== 'idle' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full animate-fade-in">
                <MdSync className={`text-sm text-indigo-600 ${syncStatus.status === 'in_progress' ? 'animate-spin-slow' : ''}`} />
                <span className="text-xs font-medium text-indigo-700">
                  {syncStatus.status === 'in_progress'
                    ? `Syncing ${syncStatus.processed_count}/${syncStatus.total_emails}`
                    : syncStatus.status === 'completed' ? 'Sync complete' : 'Sync failed'}
                </span>
              </div>
            )}

            <NotificationCenter />

            <button
              type="button"
              onClick={() => setApplicationsPanelCollapsed((prev) => !prev)}
              className="hidden xl:flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-600 hover:bg-white"
              title={applicationsPanelCollapsed ? 'Show applications sidebar' : 'Hide applications sidebar'}
            >
              <MdViewSidebar className="text-base" />
              {applicationsPanelCollapsed ? 'Show Apps' : 'Hide Apps'}
            </button>

            {/* User Menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm hover:shadow-md hover:shadow-indigo-500/20 transition-all duration-200"
              >
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-slate-200/60 z-50 py-2 animate-scale-in">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.full_name || user?.email}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <MdSettings className="text-base text-slate-400" />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <MdLogout className="text-base" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex min-h-0 flex-1">
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
          <ApplicationsSidebar
            collapsed={applicationsPanelCollapsed}
            activeFilter={applicationsFilter}
            onFilterChange={setApplicationsFilter}
          />
        </div>

        <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm px-2 py-2">
          <div className="grid grid-cols-6 gap-1 text-[11px]">
            {[
              { href: '/dashboard', label: 'Home', icon: MdDashboard },
              { href: '/jobs', label: 'Jobs', icon: MdWork },
              { href: '/contacts', label: 'Contacts', icon: MdPeople },
              { href: '/reminders', label: 'Reminders', icon: MdNotifications },
              { href: '/resumes', label: 'Resumes', icon: MdDescription },
              { href: '/settings', label: 'Settings', icon: MdSettings },
            ].map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex flex-col items-center justify-center rounded-lg py-1.5 ${isActive ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
                >
                  <Icon className="text-base" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      <CommandPalette open={showCommandPalette} onOpenChange={setShowCommandPalette} />
    </div>
  )
}
