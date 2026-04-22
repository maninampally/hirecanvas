'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  disconnectGmail,
  checkGmailConnection,
  getConnectionStatus,
  getMFAStatus,
  getNotificationPreferences,
  getUserSessions,
  revokeSession,
  saveMFAStatus,
  updateAccountProfile,
  updateNotificationPreferences,
  type ConnectionStatus,
  type GmailConnectionCheckResult,
  type MFAStatus,
  type NotificationPreferences,
  type UserSessionItem,
} from '@/actions/settings'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { getOnboardingState, setOnboardingCompleted, type OnboardingState } from '@/actions/onboarding'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  MdPerson,
  MdSecurity,
  MdNotifications,
  MdLink,
} from 'react-icons/md'

type MFAEnrollResult = {
  id: string
  totp?: {
    qr_code?: string
  }
}

type MFAChallengeResult = {
  id: string
}

type MFAListFactorsResult = {
  totp?: Array<{ id: string }>
}

type SupabaseMFAApi = {
  enroll: (payload: { factorType: 'totp'; friendlyName: string }) => Promise<{ data: MFAEnrollResult | null; error: Error | null }>
  challenge: (payload: { factorId: string }) => Promise<{ data: MFAChallengeResult | null; error: Error | null }>
  verify: (payload: { factorId: string; challengeId: string; code: string }) => Promise<{ data: unknown; error: Error | null }>
  listFactors: () => Promise<{ data: MFAListFactorsResult | null; error: Error | null }>
  unenroll: (payload: { factorId: string }) => Promise<{ data: unknown; error: Error | null }>
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('account')
  const [accountForm, setAccountForm] = useState(() => ({
    full_name: user?.full_name || '',
    email: user?.email || '',
    avatar_url: user?.avatar_url || '',
  }))
  const [savingAccount, setSavingAccount] = useState(false)

  const [mfaStatus, setMfaStatus] = useState<MFAStatus>({ is_enabled: false, backup_codes: [] })
  const [loadingSecurityData, setLoadingSecurityData] = useState(true)
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [savingMfa, setSavingMfa] = useState(false)
  const [sessions, setSessions] = useState<UserSessionItem[]>([])
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loadingPreferences, setLoadingPreferences] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus[]>([])
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [savingConnection, setSavingConnection] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(false)
  const [connectionCheck, setConnectionCheck] = useState<GmailConnectionCheckResult | null>(null)
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null)
  const [onboardingBusy, setOnboardingBusy] = useState(false)

  function describeDevice(userAgent: string | null) {
    if (!userAgent) return 'Unknown device'
    if (userAgent.includes('Windows')) return 'Windows device'
    if (userAgent.includes('Macintosh')) return 'Mac device'
    if (userAgent.includes('Android')) return 'Android device'
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS device'
    return 'Browser session'
  }

  function formatIp(ip: string | null) {
    return ip && ip.trim() ? ip : 'Unknown IP'
  }

  const searchParams = useSearchParams()
  const router = useRouter()
  const connectionSuccess = searchParams.get('connected')
  const connectionError = searchParams.get('error')
  const requestedTab = searchParams.get('tab')
  const unsubscribed = searchParams.get('unsubscribed') === '1'

  useEffect(() => {
    if (
      requestedTab &&
      requestedTab !== activeTab &&
      ['account', 'security', 'notifications', 'connections'].includes(requestedTab)
    ) {
      const timer = setTimeout(() => {
        setActiveTab(requestedTab)
      }, 0)

      return () => clearTimeout(timer)
    }
  }, [requestedTab, activeTab])

  useEffect(() => {
    let mounted = true

    const loadPreferences = async () => {
      try {
        const data = await getNotificationPreferences()
        if (mounted) setPreferences(data)
      } catch (error) {
        if (mounted) {
          toast.error(error instanceof Error ? error.message : 'Unable to load notification preferences')
        }
      } finally {
        if (mounted) setLoadingPreferences(false)
      }
    }

    const timer = setTimeout(() => {
      void loadPreferences()
    }, 0)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const loadOnboarding = async () => {
      try {
        const state = await getOnboardingState()
        if (mounted) setOnboardingState(state)
      } catch {
        if (mounted) setOnboardingState(null)
      }
    }
    const timer = setTimeout(() => {
      void loadOnboarding()
    }, 0)
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadSecurityData = async () => {
      try {
        const [mfa, userSessions] = await Promise.all([getMFAStatus(), getUserSessions()])
        if (!mounted) return
        setMfaStatus(mfa)
        setSessions(userSessions)
      } catch (error) {
        if (!mounted) return
        toast.error(error instanceof Error ? error.message : 'Unable to load security settings')
      } finally {
        if (mounted) setLoadingSecurityData(false)
      }
    }

    const timer = setTimeout(() => {
      void loadSecurityData()
    }, 0)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadConnectionStatus = async () => {
      try {
        const status = await getConnectionStatus()
        if (mounted) setConnectionStatus(status)
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : 'Unable to load connection status')
      } finally {
        if (mounted) setLoadingConnections(false)
      }
    }

    const timer = setTimeout(() => {
      void loadConnectionStatus()
    }, 0)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  async function handleAccountSave() {
    setSavingAccount(true)
    try {
      const result = await updateAccountProfile(accountForm)
      setUser(
        user
          ? {
              ...user,
              full_name: result.full_name,
              email: result.email,
              avatar_url: result.avatar_url || undefined,
            }
          : null
      )

      if (result.email_change_pending) {
        toast.success('Account updated. Check your inbox to confirm the new email address.')
      } else {
        toast.success('Account updated')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update account')
    } finally {
      setSavingAccount(false)
    }
  }

  async function handleSendPasswordReset() {
    if (!user?.email) return
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo })
      if (error) throw error
      toast.success('Password reset link sent to your email')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send password reset email')
    }
  }

  async function refreshSessions() {
    const updated = await getUserSessions()
    setSessions(updated)
  }

  async function handleRevokeSession(sessionId: string) {
    setRevokingSessionId(sessionId)
    try {
      const result = await revokeSession(sessionId)
      if (result.was_current_session) {
        await supabase.auth.signOut()
        toast.success('Current session revoked. Please sign in again.')
        router.push('/login')
        return
      }

      await refreshSessions()
      toast.success('Session revoked')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to revoke session')
    } finally {
      setRevokingSessionId(null)
    }
  }

  async function handleStartMFAEnrollment() {
    setSavingMfa(true)
    try {
      const mfaApi = (supabase.auth as unknown as { mfa: SupabaseMFAApi }).mfa
      const { data: enrollData, error: enrollError } = await mfaApi.enroll({
        factorType: 'totp',
        friendlyName: 'HireCanvas Authenticator',
      })

      if (enrollError) throw enrollError

      const factorId = enrollData?.id as string | undefined
      const qrCode = enrollData?.totp?.qr_code as string | undefined
      if (!factorId || !qrCode) throw new Error('Unable to start MFA enrollment')

      const { data: challengeData, error: challengeError } = await mfaApi.challenge({ factorId })
      if (challengeError) throw challengeError

      setMfaFactorId(factorId)
      setMfaChallengeId(challengeData?.id || null)
      setMfaQrCode(qrCode)
      toast.success('Scan the QR code and enter a verification code')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start MFA enrollment')
    } finally {
      setSavingMfa(false)
    }
  }

  async function handleVerifyMFA() {
    if (!mfaFactorId || !mfaChallengeId || !mfaCode.trim()) {
      toast.error('Enter the 6-digit authenticator code')
      return
    }

    setSavingMfa(true)
    try {
      const mfaApi = (supabase.auth as unknown as { mfa: SupabaseMFAApi }).mfa
      const { error } = await mfaApi.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode.trim(),
      })
      if (error) throw error

      const updated = await saveMFAStatus({ is_enabled: true })
      setMfaStatus(updated)
      setMfaQrCode(null)
      setMfaFactorId(null)
      setMfaChallengeId(null)
      setMfaCode('')
      toast.success('Two-factor authentication enabled')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to verify MFA code')
    } finally {
      setSavingMfa(false)
    }
  }

  async function handleDisableMFA() {
    setSavingMfa(true)
    try {
      const mfaApi = (supabase.auth as unknown as { mfa: SupabaseMFAApi }).mfa
      const { data: factorsData } = await mfaApi.listFactors()
      const totpFactors = (factorsData?.totp || []) as Array<{ id: string }>

      for (const factor of totpFactors) {
        await mfaApi.unenroll({ factorId: factor.id })
      }

      const updated = await saveMFAStatus({ is_enabled: false, backup_codes: [] })
      setMfaStatus(updated)
      setMfaQrCode(null)
      setMfaFactorId(null)
      setMfaChallengeId(null)
      setMfaCode('')
      toast.success('Two-factor authentication disabled')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to disable MFA')
    } finally {
      setSavingMfa(false)
    }
  }

  async function handleCopyBackupCodes() {
    if (!mfaStatus.backup_codes.length) return
    try {
      await navigator.clipboard.writeText(mfaStatus.backup_codes.join('\n'))
      toast.success('Backup codes copied')
    } catch {
      toast.error('Unable to copy backup codes')
    }
  }

  async function handleDisconnectGmail(tokenId: string) {
    setSavingConnection(true)
    try {
      await disconnectGmail(tokenId)
      setConnectionStatus((prev) => prev.filter((c) => c.id !== tokenId))
      toast.success('Gmail disconnected')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to disconnect Gmail')
    } finally {
      setSavingConnection(false)
    }
  }

  async function handleCheckGmailConnection(tokenId: string) {
    setCheckingConnection(true)
    setConnectionCheck(null)
    try {
      const result = await checkGmailConnection(tokenId)
      setConnectionCheck(result)
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify Gmail connection'
      setConnectionCheck({ ok: false, message })
      toast.error(message)
    } finally {
      setCheckingConnection(false)
    }
  }

  function updatePreference<K extends keyof Omit<NotificationPreferences, 'unsubscribe_token'>>(
    key: K,
    checked: boolean
  ) {
    setPreferences((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [key]: checked,
      }
    })
  }

  async function handleSavePreferences() {
    if (!preferences) return

    setSavingPreferences(true)
    try {
      const updated = await updateNotificationPreferences({
        email_job_updates: preferences.email_job_updates,
        sync_completion_alerts: preferences.sync_completion_alerts,
        weekly_pipeline_summary: preferences.weekly_pipeline_summary,
        follow_up_nudges: preferences.follow_up_nudges,
        daily_digest: preferences.daily_digest,
        feature_announcements: preferences.feature_announcements,
        marketing_emails: preferences.marketing_emails,
      })
      setPreferences(updated)
      toast.success('Notification preferences saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save notification preferences')
    } finally {
      setSavingPreferences(false)
    }
  }

  async function handleSkipOnboarding() {
    if (onboardingBusy) return
    setOnboardingBusy(true)
    try {
      await setOnboardingCompleted(true)
      setOnboardingState((prev) => (prev ? { ...prev, completed: true } : prev))
      setUser(user ? { ...user, onboarding_completed: true } : user)
      toast.success('Onboarding dismissed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update onboarding status')
    } finally {
      setOnboardingBusy(false)
    }
  }

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
          <div className="space-y-4">
            {onboardingState && !onboardingState.completed && (
              <OnboardingChecklist
                hasGmailConnected={onboardingState.hasGmailConnected}
                hasCreatedJob={onboardingState.hasCreatedJob}
                hasRunSync={onboardingState.hasRunSync}
                onSkip={handleSkipOnboarding}
              />
            )}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                <Input
                  value={accountForm.full_name}
                  onChange={(event) =>
                    setAccountForm((previous) => ({
                      ...previous,
                      full_name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={accountForm.email}
                  onChange={(event) =>
                    setAccountForm((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Avatar URL</label>
                <Input
                  value={accountForm.avatar_url}
                  placeholder="https://..."
                  onChange={(event) =>
                    setAccountForm((previous) => ({
                      ...previous,
                      avatar_url: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Plan</label>
                <div className="flex items-center gap-3">
                  <Input value={user?.tier || 'free'} disabled className="w-32" />
                  <Badge variant="teal">{user?.tier === 'pro' ? 'Pro' : user?.tier === 'elite' ? 'Elite' : 'Free'}</Badge>
                </div>
              </div>
              <Button className="mt-2" onClick={() => void handleAccountSave()} disabled={savingAccount}>
                {savingAccount ? 'Updating...' : 'Update Account'}
              </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'security' && (
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Password</p>
                    <p className="text-xs text-slate-500">Send a secure reset link to update your password.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void handleSendPasswordReset()}>
                    Send Reset Link
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Two-Factor Authentication</p>
                    <p className="text-xs text-slate-500">
                      {loadingSecurityData
                        ? 'Loading MFA status...'
                        : mfaStatus.is_enabled
                        ? 'Enabled. You can disable it anytime.'
                        : 'Add extra security with authenticator app verification.'}
                    </p>
                  </div>
                  {mfaStatus.is_enabled ? (
                    <Button size="sm" variant="outline" onClick={() => void handleDisableMFA()} disabled={savingMfa}>
                      {savingMfa ? 'Disabling...' : 'Disable'}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void handleStartMFAEnrollment()} disabled={savingMfa}>
                      {savingMfa ? 'Starting...' : 'Enable'}
                    </Button>
                  )}
                </div>

                {mfaQrCode && (
                  <div className="space-y-3 pt-1 border-t border-slate-200">
                    <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
                      Setup steps: 1) Scan QR code with your authenticator app, 2) Enter the 6-digit code, 3) Save backup codes for account recovery.
                    </div>
                    <p className="text-xs text-slate-600">Scan this QR code with Google Authenticator or similar app.</p>
                    <Image
                      src={mfaQrCode}
                      alt="MFA QR"
                      width={176}
                      height={176}
                      unoptimized
                      className="rounded-lg border border-slate-200 bg-white p-2"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Enter 6-digit code"
                        value={mfaCode}
                        onChange={(event) => setMfaCode(event.target.value)}
                        className="max-w-xs"
                      />
                      <Button size="sm" onClick={() => void handleVerifyMFA()} disabled={savingMfa}>
                        {savingMfa ? 'Verifying...' : 'Verify'}
                      </Button>
                    </div>
                  </div>
                )}

                {mfaStatus.is_enabled && mfaStatus.backup_codes.length > 0 && (
                  <div className="pt-1 border-t border-slate-200">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-600">Backup codes (store these safely):</p>
                      <Button size="sm" variant="outline" onClick={() => void handleCopyBackupCodes()}>
                        Copy Codes
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {mfaStatus.backup_codes.map((code) => (
                        <code key={code} className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700">
                          {code}
                        </code>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Use a backup code if you lose access to your authenticator app.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Active Sessions</p>
                    <p className="text-xs text-slate-500">Revoke any session you do not recognize.</p>
                  </div>
                </div>

                {loadingSecurityData && <p className="text-xs text-slate-500">Loading sessions...</p>}

                {!loadingSecurityData && sessions.length === 0 && (
                  <p className="text-xs text-slate-500">No active sessions found.</p>
                )}

                {!loadingSecurityData && sessions.length > 0 && (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {describeDevice(session.user_agent)}
                            {session.is_current ? ' (Current)' : ''}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{formatIp(session.ip_address)}</p>
                          <p className="text-[11px] text-slate-500">
                            Last activity: {session.last_activity ? new Date(session.last_activity).toLocaleString() : 'Unknown'} • Expires:{' '}
                            {new Date(session.expires_at).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revokingSessionId === session.id}
                          onClick={() => void handleRevokeSession(session.id)}
                        >
                          {revokingSessionId === session.id ? 'Revoking...' : 'Revoke'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
              {unsubscribed && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  You were unsubscribed successfully. You can re-enable any email type below.
                </div>
              )}
              <Checkbox
                label="Email notifications for job updates"
                checked={preferences?.email_job_updates || false}
                disabled={loadingPreferences || savingPreferences}
                onChange={(event) => updatePreference('email_job_updates', event.currentTarget.checked)}
              />
              <Checkbox
                label="Sync completion alerts"
                checked={preferences?.sync_completion_alerts || false}
                disabled={loadingPreferences || savingPreferences}
                onChange={(event) => updatePreference('sync_completion_alerts', event.currentTarget.checked)}
              />
              <Checkbox
                label="Weekly pipeline summary"
                checked={preferences?.weekly_pipeline_summary || false}
                disabled={loadingPreferences || savingPreferences}
                onChange={(event) => updatePreference('weekly_pipeline_summary', event.currentTarget.checked)}
              />
              <Checkbox
                label="Follow-up nudge emails"
                checked={preferences?.follow_up_nudges || false}
                disabled={loadingPreferences || savingPreferences}
                onChange={(event) => updatePreference('follow_up_nudges', event.currentTarget.checked)}
              />
              <Checkbox
                label="Daily digest email"
                checked={preferences?.daily_digest || false}
                disabled={loadingPreferences || savingPreferences}
                onChange={(event) => updatePreference('daily_digest', event.currentTarget.checked)}
              />
              <Checkbox
                label="New feature announcements"
                checked={preferences?.feature_announcements || false}
                disabled={loadingPreferences || savingPreferences}
                onChange={(event) => updatePreference('feature_announcements', event.currentTarget.checked)}
              />
              <Checkbox
                label="Marketing emails"
                checked={preferences?.marketing_emails || false}
                disabled={loadingPreferences || savingPreferences}
                onChange={(event) => updatePreference('marketing_emails', event.currentTarget.checked)}
              />
              <Button
                onClick={() => {
                  void handleSavePreferences()
                }}
                disabled={loadingPreferences || savingPreferences || !preferences}
              >
                {savingPreferences ? 'Saving...' : 'Save Preferences'}
              </Button>
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
              {connectionCheck && (
                <div
                  className={`p-3 rounded-xl text-sm animate-slide-down ${
                    connectionCheck.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-amber-50 border border-amber-200 text-amber-800'
                  }`}
                >
                  {connectionCheck.message}
                  {typeof connectionCheck.messageCountSample === 'number' && (
                    <span className="ml-1 text-xs">
                      (recent sample messages found: {connectionCheck.messageCountSample})
                    </span>
                  )}
                </div>
              )}
              {loadingConnections ? (
                <p className="text-sm text-slate-500">Loading connection status...</p>
              ) : connectionStatus.length === 0 ? (
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
                      <p className="text-xs text-slate-500">Not connected</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => router.push('/api/auth/gmail/connect')} disabled={savingConnection}>
                    Connect
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {connectionStatus.map(conn => (
                    <div key={conn.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/60">
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
                          <p className="text-xs text-slate-500">
                            {conn.gmail_connected
                              ? `${conn.gmail_email || 'Connected'}${conn.gmail_expires_at ? ` • Expires ${new Date(conn.gmail_expires_at).toLocaleString()}` : ''}`
                              : 'Connection revoked or expired'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCheckGmailConnection(conn.id)}
                          disabled={checkingConnection || savingConnection}
                        >
                          {checkingConnection ? 'Checking...' : 'Test Connection'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleDisconnectGmail(conn.id)} disabled={savingConnection || checkingConnection}>
                          {savingConnection ? 'Disconnecting...' : 'Disconnect'}
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => router.push('/api/auth/gmail/connect')} disabled={savingConnection}>
                    Connect Another Gmail Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
