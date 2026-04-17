'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import {
  MdPerson,
  MdSecurity,
  MdNotifications,
  MdLink,
} from 'react-icons/md'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('account')
  const searchParams = useSearchParams()
  const router = useRouter()
  const connectionSuccess = searchParams.get('connected')
  const connectionError = searchParams.get('error')
  const requestedTab = searchParams.get('tab')

  useEffect(() => {
    if (
      requestedTab &&
      requestedTab !== activeTab &&
      ['account', 'security', 'notifications', 'connections'].includes(requestedTab)
    ) {
      setActiveTab(requestedTab)
    }
  }, [requestedTab, activeTab])

  const tabs = [
    { id: 'account', label: 'Account', icon: MdPerson },
    { id: 'security', label: 'Security', icon: MdSecurity },
    { id: 'notifications', label: 'Notifications', icon: MdNotifications },
    { id: 'connections', label: 'Connections', icon: MdLink },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100/80 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="text-base" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="animate-fade-in">
        {activeTab === 'account' && (
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                <Input value={user?.full_name || ''} disabled />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Plan</label>
                <div className="flex items-center gap-3">
                  <Input value={user?.tier || 'free'} disabled className="w-32" />
                  <Badge variant="teal">{user?.tier === 'pro' ? 'Pro' : user?.tier === 'elite' ? 'Elite' : 'Free'}</Badge>
                </div>
              </div>
              <Button className="mt-2">Update Account</Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'security' && (
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Password</p>
                    <p className="text-xs text-slate-500">Last changed: Unknown</p>
                  </div>
                  <Button size="sm" variant="outline">Change</Button>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Two-Factor Authentication</p>
                    <p className="text-xs text-slate-500">Add extra security to your account</p>
                  </div>
                  <Button size="sm" variant="outline">Enable</Button>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Active Sessions</p>
                    <p className="text-xs text-slate-500">Manage your login sessions</p>
                  </div>
                  <Button size="sm" variant="outline">View</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'notifications' && (
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 max-w-lg">
              <Checkbox label="Email notifications for job updates" defaultChecked />
              <Checkbox label="Sync completion alerts" defaultChecked />
              <Checkbox label="Weekly pipeline summary" defaultChecked />
              <Checkbox label="New feature announcements" />
              <Checkbox label="Marketing emails" />
            </CardContent>
          </Card>
        )}

        {activeTab === 'connections' && (
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              {connectionSuccess === 'gmail' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 animate-slide-down">
                  Gmail connected successfully.
                </div>
              )}
              {connectionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 animate-slide-down">
                  Gmail connection failed: {connectionError}
                </div>
              )}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Gmail</p>
                    <p className="text-xs text-slate-500">Auto-sync job emails</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push('/api/auth/gmail/connect')}
                >
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
