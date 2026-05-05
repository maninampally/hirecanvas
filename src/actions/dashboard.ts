'use server'

import { runWithLLMRouter } from '@/lib/ai/llmRouter'
import { createClient } from '@/lib/supabase/server'

type JobStatus = 'Wishlist' | 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected' | 'Closed'

type JobRow = {
  id: string
  company: string
  status: JobStatus
  created_at: string
  updated_at: string
  applied_date: string | null
  source: string | null
  salary_range: string | null
}

type TimelineRow = {
  job_id: string
  status: JobStatus
  changed_at: string
}

const FUNNEL_STAGES = ['Applied', 'Screening', 'Interview', 'Offer'] as const

type FunnelStage = (typeof FUNNEL_STAGES)[number]

type DashboardSummary = {
  totalApplications: number
  activeInterviews: number
  offers: number
  rejections: number
}

export type PipelineFunnelDatum = {
  stage: FunnelStage
  count: number
  conversionFromPrevious: number | null
  avgDaysInStage: number | null
}

export type ResponseRateDatum = {
  company: string
  avgDaysToResponse: number
  responses: number
  totalJobs: number
}

export type ActivityHeatmapCell = {
  date: string
  count: number
  weekIndex: number
  dayIndex: number
  intensity: number
}

export type SourceBreakdownDatum = {
  source: string
  applied: number
  interview: number
  offer: number
  rejected: number
}

export type ResponseTimeBucket = {
  bucket: string
  count: number
}

export type SalaryDatum = {
  status: string
  min: number
  max: number
  count: number
}

export type DashboardAnalytics = {
  summary: DashboardSummary
  funnel: PipelineFunnelDatum[]
  responseRates: ResponseRateDatum[]
  heatmap: {
    startDate: string
    endDate: string
    maxCount: number
    cells: ActivityHeatmapCell[]
  }
  gamification: {
    weeklyTarget: number
    weeklyCompleted: number
    currentStreak: number
    longestStreak: number
    achievements: Array<{ key: string; label: string; unlocked: boolean }>
  }
  sourceBreakdown: SourceBreakdownDatum[]
  responseDistribution: ResponseTimeBucket[]
  salaryAnalytics: SalaryDatum[]
}

export type WeeklyStrategyReport = {
  insights: string[]
  provider: string
  model: string
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.message?.toLowerCase().includes('relation') ||
    error.message?.toLowerCase().includes('does not exist')
  )
}

function toDateValue(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function daysBetween(fromDate: Date, toDate: Date) {
  const diffMs = toDate.getTime() - fromDate.getTime()
  return diffMs <= 0 ? 0 : diffMs / (1000 * 60 * 60 * 24)
}

function stageFromStatus(status: JobStatus): FunnelStage | null {
  if (status === 'Applied') return 'Applied'
  if (status === 'Screening') return 'Screening'
  if (status === 'Interview') return 'Interview'
  if (status === 'Offer') return 'Offer'
  return null
}

function parseSalaryRange(raw: string | null): { min: number; max: number } | null {
  if (!raw) return null
  const numbers = raw.match(/[\d,]+/g)?.map(s => parseInt(s.replace(/,/g, ''), 10)).filter(n => !isNaN(n) && n > 0)
  if (!numbers || numbers.length === 0) return null
  numbers.sort((a, b) => a - b)
  return { min: numbers[0], max: numbers[numbers.length - 1] }
}

/** Calendar day in the user's local timezone (avoid UTC day collisions in heatmaps). */
function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Prefer SQL DATE string so buckets match stored calendar dates across timezones. */
function jobCalendarDateKey(job: JobRow): string | null {
  const raw = job.applied_date?.trim()
  if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10)
  }
  const fallback = toDateValue(job.applied_date)
  return fallback ? toDateKey(fallback) : null
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

async function getDashboardData() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const [{ data: goalsRow }, { data: userProfile }] = await Promise.all([
    supabase
      .from('user_goals')
      .select('weekly_target,current_streak,longest_streak')
      .eq('user_id', user.id)
      .maybeSingle<{ weekly_target: number; current_streak: number; longest_streak: number }>(),
    supabase
      .from('app_users')
      .select('achievements')
      .eq('id', user.id)
      .maybeSingle<{ achievements: string[] | null }>(),
  ])

  const { data: jobsData, error: jobsError } = await supabase
    .from('jobs')
    .select('id,company,status,created_at,updated_at,applied_date,source,salary_range')
    .eq('user_id', user.id)
    .eq('is_archived', false)

  if (jobsError) {
    if (isMissingRelationError(jobsError)) {
      return {
        userId: user.id,
        jobs: [] as JobRow[],
        timeline: [] as TimelineRow[],
        goals: goalsRow || null,
        achievements: userProfile?.achievements || [],
      }
    }
    throw jobsError
  }

  const jobs = (jobsData || []) as JobRow[]
  if (jobs.length === 0) {
    return {
      userId: user.id,
      jobs,
      timeline: [] as TimelineRow[],
      goals: goalsRow || null,
      achievements: userProfile?.achievements || [],
    }
  }

  const jobIds = jobs.map((job) => job.id)
  const { data: timelineData, error: timelineError } = await supabase
    .from('job_status_timeline')
    .select('job_id,status,changed_at')
    .in('job_id', jobIds)
    .order('changed_at', { ascending: true })

  if (timelineError) {
    if (isMissingRelationError(timelineError)) {
      return {
        userId: user.id,
        jobs,
        timeline: [] as TimelineRow[],
        goals: goalsRow || null,
        achievements: userProfile?.achievements || [],
      }
    }
    throw timelineError
  }

  return {
    userId: user.id,
    jobs,
    timeline: (timelineData || []) as TimelineRow[],
    goals: goalsRow || null,
    achievements: userProfile?.achievements || [],
  }
}

function buildAnalytics(
  jobs: JobRow[],
  timeline: TimelineRow[],
  goals: { weekly_target: number; current_streak: number; longest_streak: number } | null,
  unlockedAchievements: string[]
): DashboardAnalytics {
  const timelineByJob = new Map<string, TimelineRow[]>()

  for (const row of timeline) {
    const current = timelineByJob.get(row.job_id)
    if (current) {
      current.push(row)
    } else {
      timelineByJob.set(row.job_id, [row])
    }
  }

  const reachedPerJob = new Map<string, Set<FunnelStage>>()

  for (const job of jobs) {
    const reached = new Set<FunnelStage>()
    reached.add('Applied')

    const currentStage = stageFromStatus(job.status)
    if (currentStage) {
      reached.add(currentStage)
    }

    const events = timelineByJob.get(job.id) || []
    for (const event of events) {
      const eventStage = stageFromStatus(event.status)
      if (eventStage) {
        reached.add(eventStage)
      }
    }

    reachedPerJob.set(job.id, reached)
  }

  const funnelCounts: Record<FunnelStage, number> = {
    Applied: 0,
    Screening: 0,
    Interview: 0,
    Offer: 0,
  }

  for (const stages of reachedPerJob.values()) {
    for (const stage of FUNNEL_STAGES) {
      if (stages.has(stage)) {
        funnelCounts[stage] += 1
      }
    }
  }

  const stageDurations = new Map<FunnelStage, number[]>()
  for (const stage of FUNNEL_STAGES) stageDurations.set(stage, [])

  for (const job of jobs) {
    const events = timelineByJob.get(job.id) || []
    if (events.length === 0) continue

    for (let i = 0; i < events.length - 1; i++) {
      const currentStage = stageFromStatus(events[i].status)
      if (!currentStage) continue
      const currentDate = toDateValue(events[i].changed_at)
      const nextDate = toDateValue(events[i + 1].changed_at)
      if (currentDate && nextDate) {
        const days = daysBetween(currentDate, nextDate)
        stageDurations.get(currentStage)?.push(days)
      }
    }
  }

  const funnel: PipelineFunnelDatum[] = FUNNEL_STAGES.map((stage, index) => {
    const count = funnelCounts[stage]
    const durations = stageDurations.get(stage) || []
    const avgDays = durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : null

    return {
      stage,
      count,
      conversionFromPrevious: index === 0 ? null : (funnelCounts[FUNNEL_STAGES[index - 1]] > 0 ? Math.round((count / funnelCounts[FUNNEL_STAGES[index - 1]]) * 1000) / 10 : 0),
      avgDaysInStage: avgDays,
    }
  })

  const responseStatuses = new Set<JobStatus>(['Screening', 'Interview', 'Offer', 'Rejected'])
  const responseAgg = new Map<string, { totalDays: number; responses: number; totalJobs: number }>()

  for (const job of jobs) {
    const company = job.company?.trim() || 'Unknown Company'
    const appliedAt = toDateValue(job.applied_date) || toDateValue(job.created_at)

    const current = responseAgg.get(company) || { totalDays: 0, responses: 0, totalJobs: 0 }
    current.totalJobs += 1

    if (appliedAt) {
      const events = timelineByJob.get(job.id) || []
      const firstResponse = events.find((event) => {
        const changedAt = toDateValue(event.changed_at)
        return Boolean(changedAt && changedAt >= appliedAt && responseStatuses.has(event.status))
      })

      const firstResponseAt =
        toDateValue(firstResponse?.changed_at) ||
        (responseStatuses.has(job.status) ? toDateValue(job.updated_at) : null)

      if (firstResponseAt) {
        current.totalDays += daysBetween(appliedAt, firstResponseAt)
        current.responses += 1
      }
    }

    responseAgg.set(company, current)
  }

  const responseRates: ResponseRateDatum[] = [...responseAgg.entries()]
    .map(([company, data]) => ({
      company,
      avgDaysToResponse:
        data.responses > 0 ? Math.round((data.totalDays / data.responses) * 10) / 10 : Number.POSITIVE_INFINITY,
      responses: data.responses,
      totalJobs: data.totalJobs,
    }))
    .filter((row) => Number.isFinite(row.avgDaysToResponse))
    .sort((a, b) => a.avgDaysToResponse - b.avgDaysToResponse)
    .slice(0, 8)

  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 363)

  const countsByDate = new Map<string, number>()
  for (const job of jobs) {
    const key = jobCalendarDateKey(job)
    if (!key) continue

    countsByDate.set(key, (countsByDate.get(key) || 0) + 1)
  }

  const cells: ActivityHeatmapCell[] = []
  let maxCount = 0

  for (let dayOffset = 0; dayOffset < 364; dayOffset += 1) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + dayOffset)
    const key = toDateKey(date)
    const count = countsByDate.get(key) || 0
    if (count > maxCount) maxCount = count

    cells.push({
      date: key,
      count,
      weekIndex: Math.floor(dayOffset / 7),
      dayIndex: dayOffset % 7,
      intensity: 0,
    })
  }

  const heatmapCells = cells.map((cell) => ({
    ...cell,
    intensity: maxCount > 0 ? Math.min(1, cell.count / maxCount) : 0,
  }))

  const summary: DashboardSummary = {
    totalApplications: jobs.length,
    activeInterviews: jobs.filter((job) => job.status === 'Interview').length,
    offers: jobs.filter((job) => job.status === 'Offer').length,
    rejections: jobs.filter((job) => job.status === 'Rejected').length,
  }

  const weekStart = startOfWeek(today)
  const weeklyCompleted = jobs.filter((job) => {
    const appliedAt = toDateValue(job.applied_date) || toDateValue(job.created_at)
    return Boolean(appliedAt && appliedAt >= weekStart)
  }).length
  const achievementDefs = [
    { key: 'first_application', label: 'First Application', check: jobs.length >= 1 },
    { key: 'ten_applications', label: '10 Applications', check: jobs.length >= 10 },
    { key: 'first_interview', label: 'First Interview', check: jobs.some((job) => job.status === 'Interview') },
    { key: 'offer_received', label: 'Offer Received', check: jobs.some((job) => job.status === 'Offer') },
    { key: 'seven_day_streak', label: '7 Day Streak', check: (goals?.current_streak || 0) >= 7 },
  ]
  const achievements = achievementDefs.map((item) => ({
    key: item.key,
    label: item.label,
    unlocked: item.check || unlockedAchievements.includes(item.key),
  }))

  // Source breakdown
  const sourceAgg = new Map<string, SourceBreakdownDatum>()
  for (const job of jobs) {
    const src = job.source || 'Manual'
    const existing = sourceAgg.get(src) || { source: src, applied: 0, interview: 0, offer: 0, rejected: 0 }
    if (job.status === 'Interview' || job.status === 'Screening') existing.interview += 1
    else if (job.status === 'Offer') existing.offer += 1
    else if (job.status === 'Rejected') existing.rejected += 1
    else existing.applied += 1
    sourceAgg.set(src, existing)
  }
  const sourceBreakdown = [...sourceAgg.values()].sort((a, b) =>
    (b.applied + b.interview + b.offer + b.rejected) - (a.applied + a.interview + a.offer + a.rejected)
  ).slice(0, 8)

  // Response time distribution
  const RESPONSE_BUCKETS = ['0-3d', '4-7d', '8-14d', '15-30d', '30+d', 'Never'] as const
  const responseCounts: Record<string, number> = {}
  for (const b of RESPONSE_BUCKETS) responseCounts[b] = 0

  for (const job of jobs) {
    const appliedAt = toDateValue(job.applied_date) || toDateValue(job.created_at)
    if (!appliedAt) { responseCounts['Never'] += 1; continue }

    const events = timelineByJob.get(job.id) || []
    const firstResponse = events.find((event) => {
      const changedAt = toDateValue(event.changed_at)
      return Boolean(changedAt && changedAt >= appliedAt && responseStatuses.has(event.status))
    })

    const firstResponseAt = toDateValue(firstResponse?.changed_at) ||
      (responseStatuses.has(job.status) ? toDateValue(job.updated_at) : null)

    if (!firstResponseAt) { responseCounts['Never'] += 1; continue }

    const days = daysBetween(appliedAt, firstResponseAt)
    if (days <= 3) responseCounts['0-3d'] += 1
    else if (days <= 7) responseCounts['4-7d'] += 1
    else if (days <= 14) responseCounts['8-14d'] += 1
    else if (days <= 30) responseCounts['15-30d'] += 1
    else responseCounts['30+d'] += 1
  }

  const responseDistribution: ResponseTimeBucket[] = RESPONSE_BUCKETS.map(b => ({
    bucket: b,
    count: responseCounts[b],
  }))

  // Salary analytics
  const salaryByStatus = new Map<string, { totalMin: number; totalMax: number; count: number }>()
  for (const job of jobs) {
    const parsed = parseSalaryRange(job.salary_range)
    if (!parsed) continue
    const status = job.status
    const existing = salaryByStatus.get(status) || { totalMin: 0, totalMax: 0, count: 0 }
    existing.totalMin += parsed.min
    existing.totalMax += parsed.max
    existing.count += 1
    salaryByStatus.set(status, existing)
  }

  const salaryAnalytics: SalaryDatum[] = [...salaryByStatus.entries()]
    .map(([status, data]) => ({
      status,
      min: Math.round(data.totalMin / data.count),
      max: Math.round(data.totalMax / data.count),
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    summary,
    funnel,
    responseRates,
    heatmap: {
      startDate: toDateKey(startDate),
      endDate: toDateKey(today),
      maxCount,
      cells: heatmapCells,
    },
    gamification: {
      weeklyTarget: goals?.weekly_target || 10,
      weeklyCompleted,
      currentStreak: goals?.current_streak || 0,
      longestStreak: goals?.longest_streak || 0,
      achievements,
    },
    sourceBreakdown,
    responseDistribution,
    salaryAnalytics,
  }
}

export async function getDashboardAnalytics() {
  const { jobs, timeline, goals, achievements } = await getDashboardData()
  return buildAnalytics(jobs, timeline, goals, achievements)
}

export async function updateStreakOnJobActivity(userId: string, activityDate = new Date()) {
  const supabase = await createClient()
  const todayKey = toDateKey(activityDate)
  const { data: existing } = await supabase
    .from('user_goals')
    .select('weekly_target,current_streak,longest_streak,last_active_date')
    .eq('user_id', userId)
    .maybeSingle<{
      weekly_target: number
      current_streak: number
      longest_streak: number
      last_active_date: string | null
    }>()

  if (!existing) {
    await supabase.from('user_goals').insert({
      user_id: userId,
      weekly_target: 10,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: todayKey,
    })
    return
  }

  const lastKey = existing.last_active_date
  if (lastKey === todayKey) return

  let nextStreak = 1
  if (lastKey) {
    const last = new Date(lastKey)
    const diffDays = Math.floor((new Date(todayKey).getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) nextStreak = existing.current_streak + 1
  }

  await supabase
    .from('user_goals')
    .update({
      current_streak: nextStreak,
      longest_streak: Math.max(existing.longest_streak, nextStreak),
      last_active_date: todayKey,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}

export async function getWeeklyStrategyReport() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('tier')
    .eq('id', user.id)
    .single<{ tier: 'free' | 'pro' | 'elite' | 'admin' }>()

  if (!appUser || (appUser.tier !== 'elite' && appUser.tier !== 'admin')) {
    throw new Error('Weekly strategy report is available on Elite plan')
  }

  const { jobs, timeline, goals, achievements } = await getDashboardData()
  const analytics = buildAnalytics(jobs, timeline, goals || null, achievements || [])

  const topResponseCompanies = analytics.responseRates.slice(0, 5)
  const prompt = [
    'You are a career strategy coach. Return strict JSON only.',
    'Required JSON keys: insights.',
    'insights must be an array of 3 to 5 short actionable insights.',
    'Do not use markdown or numbering.',
    `Total applications: ${analytics.summary.totalApplications}`,
    `Active interviews: ${analytics.summary.activeInterviews}`,
    `Offers: ${analytics.summary.offers}`,
    `Rejections: ${analytics.summary.rejections}`,
    `Pipeline funnel: ${JSON.stringify(analytics.funnel)}`,
    `Top fastest-response companies: ${JSON.stringify(topResponseCompanies)}`,
  ].join('\n')

  const routed = await runWithLLMRouter({
    task: 'general',
    prompt,
    temperature: 0.2,
    maxTokens: 700,
  })

  let insights: string[] = []

  try {
    const parsed = JSON.parse(routed.text) as { insights?: string[] }
    insights = (parsed.insights || []).map((insight) => insight.trim()).filter(Boolean).slice(0, 5)
  } catch {
    insights = []
  }

  if (insights.length === 0) {
    insights = [
      'Double down on companies that respond within 10 days by sending tailored applications first.',
      'If interviews are not converting to offers, add one measurable impact bullet to every interview story.',
      'Reserve one session weekly for follow-ups on applications older than 14 days.',
    ]
  }

  await supabase.from('ai_usage').insert({
    user_id: user.id,
    feature: 'weekly_strategy_report',
    tokens_used: Math.max(120, Math.ceil(prompt.length / 4)),
    cost_cents: 2,
    status: 'completed',
  })

  return {
    insights,
    provider: routed.provider,
    model: routed.model,
  } as WeeklyStrategyReport
}

export type RecentJobItem = {
  id: string
  company: string
  title: string
  status: string
  source: string
  updated_at: string
}

export async function getRecentJobs(limit = 6) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('jobs')
    .select('id,company,title,status,source,updated_at')
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }

  return (data || []) as RecentJobItem[]
}

export type SyncWindowHours = 12 | 24 | 48 | 168

export type SyncReportActivityItem = {
  emailId: string
  jobId: string
  company: string
  title: string
  status: JobStatus
  subject: string
  fromAddress: string
  receivedAt: string
  emailDirection: 'inbound' | 'outbound' | 'unknown'
  confidence: number | null
}

export type SyncReport = {
  windowHours: SyncWindowHours
  totals: {
    processed: number
    created: number
    updated: number
    skipped: number
  }
  confidenceBuckets: {
    high: number
    medium: number
    low: number
    unknown: number
  }
  recentActivity: SyncReportActivityItem[]
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const normalized = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

export async function getSyncReport(windowHours: SyncWindowHours = 24): Promise<SyncReport> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  const [{ count: processedCount, error: processedError }, { data: gmailJobs, error: jobsError }] =
    await Promise.all([
      supabase
        .from('processed_emails')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('processed_at', since),
      supabase
        .from('jobs')
        .select('id,company,title,status,created_at,updated_at')
        .eq('user_id', user.id)
        .eq('source', 'gmail_sync')
        .gte('updated_at', since),
    ])

  if (processedError && !isMissingRelationError(processedError)) throw processedError
  if (jobsError && !isMissingRelationError(jobsError)) throw jobsError

  const jobs = (gmailJobs || []) as Array<{
    id: string
    company: string
    title: string
    status: JobStatus
    created_at: string
    updated_at: string
  }>

  const created = jobs.filter((job) => {
    const createdAt = toDateValue(job.created_at)
    return Boolean(createdAt && createdAt.toISOString() >= since)
  }).length

  const updated = jobs.filter((job) => {
    const createdAt = toDateValue(job.created_at)
    return !createdAt || createdAt.toISOString() < since
  }).length

  const totals = {
    processed: processedCount || 0,
    created,
    updated,
    skipped: Math.max(0, (processedCount || 0) - created - updated),
  }

  const { data: emailRows, error: emailsError } = await supabase
    .from('job_emails')
    .select('gmail_message_id,job_id,subject,from_address,received_at,email_direction,extracted_data')
    .in(
      'job_id',
      jobs.length > 0 ? jobs.map((job) => job.id) : ['00000000-0000-0000-0000-000000000000']
    )
    .gte('received_at', since)
    .order('received_at', { ascending: false })
    .limit(12)

  if (emailsError && !isMissingRelationError(emailsError)) throw emailsError

  const jobsById = new Map(jobs.map((job) => [job.id, job]))
  const confidenceBuckets = { high: 0, medium: 0, low: 0, unknown: 0 }

  const recentActivity = ((emailRows || []) as Array<{
    gmail_message_id: string
    job_id: string
    subject: string
    from_address: string
    received_at: string
    email_direction: 'inbound' | 'outbound' | 'unknown'
    extracted_data?: {
      extracted?: { confidence?: number | null }
    } | null
  }>)
    .map((email) => {
      const job = jobsById.get(email.job_id)
      if (!job) return null

      const confidence = normalizeConfidence(email.extracted_data?.extracted?.confidence)
      if (confidence === null) confidenceBuckets.unknown += 1
      else if (confidence >= 80) confidenceBuckets.high += 1
      else if (confidence >= 60) confidenceBuckets.medium += 1
      else confidenceBuckets.low += 1

      return {
        emailId: email.gmail_message_id,
        jobId: email.job_id,
        company: job.company,
        title: job.title,
        status: job.status,
        subject: email.subject || '(no subject)',
        fromAddress: email.from_address || 'unknown',
        receivedAt: email.received_at,
        emailDirection: email.email_direction || 'unknown',
        confidence,
      } satisfies SyncReportActivityItem
    })
    .filter((item): item is SyncReportActivityItem => Boolean(item))

  return {
    windowHours,
    totals,
    confidenceBuckets,
    recentActivity,
  }
}
