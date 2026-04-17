'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

type AdminOverviewResponse = {
  metrics: {
    totalUsers: number
    proUsers: number
    eliteUsers: number
    activeSyncJobs: number
    totalAiCostCents: number
    totalAiTokens: number
  }
  recentAudit: Array<{
    id: string
    event_type: string
    action: string | null
    user_id: string | null
    created_at: string
  }>
  recentSync: Array<{
    id: string
    user_id: string
    status: string
    processed_count: number
    total_emails: number
    new_jobs_found: number
    updated_at: string
  }>
}

type AdminUserRow = {
  id: string
  email: string
  full_name: string | null
  tier: 'free' | 'pro' | 'elite' | 'admin'
  is_suspended: boolean
  created_at: string
}

type TierConfigRow = {
  id: string
  tier: 'free' | 'pro' | 'elite' | 'admin'
  daily_sync_limit: number | null
  hourly_sync_limit: number | null
  ai_extraction_enabled: boolean
  ai_cover_letter_enabled: boolean
  ai_coaching_enabled: boolean
  updated_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [tierConfig, setTierConfig] = useState<TierConfigRow[]>([])
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [pendingTier, setPendingTier] = useState<string | null>(null)

  useEffect(() => {
    if (user?.tier !== 'admin') {
      router.push('/dashboard')
      return
    }

    const loadOverview = async () => {
      setLoading(true)
      setError(null)

      try {
        const [overviewResponse, usersResponse, tierConfigResponse] = await Promise.all([
          fetch('/api/admin/overview'),
          fetch('/api/admin/users'),
          fetch('/api/admin/tier-config'),
        ])

        const overviewData = (await overviewResponse.json()) as AdminOverviewResponse & { error?: string }
        const usersData = (await usersResponse.json()) as { users?: AdminUserRow[]; error?: string }
        const tierConfigData = (await tierConfigResponse.json()) as {
          rows?: TierConfigRow[]
          error?: string
        }

        if (!overviewResponse.ok) throw new Error(overviewData.error || 'Failed to load admin metrics')
        if (!usersResponse.ok) throw new Error(usersData.error || 'Failed to load admin users')
        if (!tierConfigResponse.ok) throw new Error(tierConfigData.error || 'Failed to load tier config')

        setOverview(overviewData)
        setUsers(usersData.users || [])
        setTierConfig(tierConfigData.rows || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin metrics')
      } finally {
        setLoading(false)
      }
    }

    void loadOverview()
  }, [router, user?.tier])

  if (user?.tier !== 'admin') {
    return null
  }

  const metrics = overview?.metrics

  async function handleUserUpdate(userId: string, patch: { tier?: AdminUserRow['tier']; isSuspended?: boolean }) {
    setPendingUserId(userId)
    setError(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tier: patch.tier,
          isSuspended: patch.isSuspended,
        }),
      })

      const data = (await response.json()) as { user?: AdminUserRow; error?: string }
      if (!response.ok) throw new Error(data.error || 'Failed to update user')

      if (data.user) {
        setUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, ...data.user } : item)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setPendingUserId(null)
    }
  }

  async function handleTierConfigSave(row: TierConfigRow) {
    setPendingTier(row.tier)
    setError(null)
    try {
      const response = await fetch('/api/admin/tier-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: row.tier,
          dailySyncLimit: row.daily_sync_limit,
          hourlySyncLimit: row.hourly_sync_limit,
          aiExtractionEnabled: row.ai_extraction_enabled,
          aiCoverLetterEnabled: row.ai_cover_letter_enabled,
          aiCoachingEnabled: row.ai_coaching_enabled,
        }),
      })

      const data = (await response.json()) as { row?: TierConfigRow; error?: string }
      if (!response.ok) throw new Error(data.error || 'Failed to update tier config')

      if (data.row) {
        setTierConfig((prev) => prev.map((item) => (item.tier === row.tier ? data.row! : item)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tier config')
    } finally {
      setPendingTier(null)
    }
  }

  const metricCards = [
    {
      label: 'Total Users',
      value: metrics?.totalUsers ?? 0,
    },
    {
      label: 'Pro Users',
      value: metrics?.proUsers ?? 0,
    },
    {
      label: 'Elite Users',
      value: metrics?.eliteUsers ?? 0,
    },
    {
      label: 'Active Sync Jobs',
      value: metrics?.activeSyncJobs ?? 0,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-600 mt-1">Manage users, sync pipeline health, and platform activity</p>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{loading ? '...' : card.value}</div>
              <p className="text-sm text-slate-600">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Usage Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-600">Estimated AI Cost</p>
            <p className="text-2xl font-bold text-slate-900">
              ${((metrics?.totalAiCostCents ?? 0) / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Approx Tokens Processed</p>
            <p className="text-2xl font-bold text-slate-900">{metrics?.totalAiTokens ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(overview?.recentAudit || []).length === 0 && !loading && (
              <p className="text-slate-600">No audit events yet.</p>
            )}
            {(overview?.recentAudit || []).map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{event.event_type}</p>
                <p className="text-slate-600">
                  {event.action || 'action:n/a'} • {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(overview?.recentSync || []).length === 0 && !loading && (
              <p className="text-slate-600">No sync jobs yet.</p>
            )}
            {(overview?.recentSync || []).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{item.status.replace('_', ' ')}</p>
                <p className="text-slate-600">
                  {item.processed_count}/{item.total_emails} processed • {item.new_jobs_found} new jobs
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="text-xs font-semibold uppercase text-slate-600">
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Tier</th>
                  <th className="px-4 py-2 text-left">Suspended</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.full_name || 'Unnamed user'}</p>
                      <p className="text-xs text-slate-500">{item.email || item.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.tier}
                        onChange={(event) =>
                          setUsers((prev) =>
                            prev.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, tier: event.target.value as AdminUserRow['tier'] }
                                : entry
                            )
                          )
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="elite">elite</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.is_suspended}
                          onChange={(event) =>
                            setUsers((prev) =>
                              prev.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, is_suspended: event.target.checked }
                                  : entry
                              )
                            )
                          }
                        />
                        {item.is_suspended ? 'Yes' : 'No'}
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                        onClick={() =>
                          void handleUserUpdate(item.id, {
                            tier: item.tier,
                            isSuspended: item.is_suspended,
                          })
                        }
                        disabled={pendingUserId === item.id}
                      >
                        {pendingUserId === item.id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tier Config</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tierConfig.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold text-slate-900 uppercase">{row.tier}</p>
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                    onClick={() => void handleTierConfigSave(row)}
                    disabled={pendingTier === row.tier}
                  >
                    {pendingTier === row.tier ? 'Saving...' : 'Save'}
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <label className="text-sm text-slate-700">
                    Daily Sync
                    <input
                      type="number"
                      value={row.daily_sync_limit ?? ''}
                      onChange={(event) =>
                        setTierConfig((prev) =>
                          prev.map((item) =>
                            item.tier === row.tier
                              ? {
                                  ...item,
                                  daily_sync_limit: event.target.value ? Number(event.target.value) : null,
                                }
                              : item
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    Hourly Sync
                    <input
                      type="number"
                      value={row.hourly_sync_limit ?? ''}
                      onChange={(event) =>
                        setTierConfig((prev) =>
                          prev.map((item) =>
                            item.tier === row.tier
                              ? {
                                  ...item,
                                  hourly_sync_limit: event.target.value ? Number(event.target.value) : null,
                                }
                              : item
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    AI Extraction
                    <input
                      type="checkbox"
                      checked={row.ai_extraction_enabled}
                      onChange={(event) =>
                        setTierConfig((prev) =>
                          prev.map((item) =>
                            item.tier === row.tier
                              ? { ...item, ai_extraction_enabled: event.target.checked }
                              : item
                          )
                        )
                      }
                      className="ml-2"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    Cover Letter
                    <input
                      type="checkbox"
                      checked={row.ai_cover_letter_enabled}
                      onChange={(event) =>
                        setTierConfig((prev) =>
                          prev.map((item) =>
                            item.tier === row.tier
                              ? { ...item, ai_cover_letter_enabled: event.target.checked }
                              : item
                          )
                        )
                      }
                      className="ml-2"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    AI Coaching
                    <input
                      type="checkbox"
                      checked={row.ai_coaching_enabled}
                      onChange={(event) =>
                        setTierConfig((prev) =>
                          prev.map((item) =>
                            item.tier === row.tier
                              ? { ...item, ai_coaching_enabled: event.target.checked }
                              : item
                          )
                        )
                      }
                      className="ml-2"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
