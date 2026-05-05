import { createServiceClient } from '@/lib/supabase/service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type StatusCount = { status: string; count: number }

export default async function SharedViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Use service client — public visitors have no session, and RLS now
  // restricts shared_views to the owning user only.
  const supabase = createServiceClient()

  const { data: share } = await supabase
    .from('shared_views')
    .select('id,user_id,is_active')
    .eq('share_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!share) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0fdfb]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-bold text-slate-900 mb-2">Link Unavailable</h1>
            <p className="text-sm text-slate-500">This shared view is not active or does not exist.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('status,created_at')
    .eq('user_id', share.user_id)
    .eq('is_archived', false)

  const statusCounts: StatusCount[] = []
  const counts = new Map<string, number>()
  for (const job of jobs || []) {
    counts.set(job.status, (counts.get(job.status) || 0) + 1)
  }
  for (const [status, count] of counts) {
    statusCounts.push({ status, count })
  }
  statusCounts.sort((a, b) => b.count - a.count)

  const total = jobs?.length || 0

  /* eslint-disable react-hooks/purity -- Async Server Component: wall clock is request-scoped; not a streaming RSC cache key. */
  const fetchedAtMs = Date.now()
  /* eslint-enable react-hooks/purity */
  const recentCutoffMs = fetchedAtMs - 7 * 24 * 60 * 60 * 1000
  const recentCount = (jobs || []).filter((j) => {
    const d = new Date(j.created_at)
    return d.getTime() > recentCutoffMs
  }).length

  const statusColors: Record<string, string> = {
    Wishlist: 'bg-teal-100 text-teal-700',
    Applied: 'bg-blue-100 text-blue-700',
    Screening: 'bg-amber-100 text-amber-700',
    Interview: 'bg-amber-100 text-amber-700',
    Offer: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-rose-100 text-rose-700',
    Closed: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="min-h-screen bg-[#f0fdfb] py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold mx-auto mb-3 shadow-md shadow-teal-500/30">
            H
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Job Search Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">Shared view — no personal data shown</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-slate-900">{total}</p>
              <p className="text-xs text-slate-500 mt-1">Total Applications</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-slate-900">{recentCount}</p>
              <p className="text-xs text-slate-500 mt-1">Added This Week</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusCounts.length === 0 ? (
              <p className="text-sm text-slate-400">No applications yet.</p>
            ) : (
              <div className="space-y-2">
                {statusCounts.map(({ status, count }) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-slate-100 text-slate-600'}`}>
                        {status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-teal-500"
                          style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Powered by <span className="font-semibold text-teal-600">HireCanvas</span>
        </p>
      </div>
    </div>
  )
}
