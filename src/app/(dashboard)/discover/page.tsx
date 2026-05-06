'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSuggestedJobs, type SuggestedJob } from '@/actions/discover'
import { updateTargetRoles } from '@/actions/settings'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { MdExplore, MdBookmarkAdd, MdLaunch, MdAutoAwesome, MdLocationOn, MdFilterList, MdAdd } from 'react-icons/md'
import { Input } from '@/components/ui/input'

export default function DiscoverPage() {
  const { user, setUser } = useAuthStore()
  const [jobs, setJobs] = useState<SuggestedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [scoreFilter, setScoreFilter] = useState<number>(0)
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [newRole, setNewRole] = useState('')

  async function load() {
    console.log("[Discover] Requesting job suggestions...")
    setLoading(true)
    try {
      const data = await getSuggestedJobs()
      console.log(`[Discover] Received ${data.length} jobs from server`)
      setJobs(data)
    } catch (err: any) {
      console.error("[Discover] Load error:", err)
      toast.error('Failed to load suggestions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Discover Jobs" 
        description="AI-powered job matches based on your latest resume and preferences."
      />

      {/* Preferences & Filters Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Target Roles Tags */}
        <div className="lg:col-span-8 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Target Roles</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Search Keywords</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user?.target_roles?.map((role) => (
              <Badge key={role} variant="blue" className="pl-2 pr-1 py-1 flex items-center gap-1.5 rounded-lg">
                {role}
                <button 
                  onClick={async () => {
                    const newRoles = user.target_roles?.filter(r => r !== role) || []
                    await updateTargetRoles(newRoles)
                    setUser({ ...user, target_roles: newRoles })
                    load() // Refresh search
                  }}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                >
                  <MdAdd className="rotate-45 text-sm" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Input 
                placeholder="Add role (e.g. Frontend Engineer)" 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newRole.trim()) {
                    const roles = [...(user?.target_roles || []), newRole.trim()]
                    await updateTargetRoles(roles)
                    setUser({ ...user!, target_roles: roles })
                    setNewRole('')
                    load() // Refresh search
                  }
                }}
                className="h-8 text-xs bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-teal-500/30"
              />
            </div>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="lg:col-span-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <MdFilterList className="text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Quick Filters</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              variant={remoteOnly ? 'default' : 'outline'} 
              className="h-8 text-xs gap-1.5"
              onClick={() => setRemoteOnly(!remoteOnly)}
            >
              <MdLocationOn className="text-sm" />
              Remote
            </Button>
            <Button 
              size="sm" 
              variant={scoreFilter === 70 ? 'default' : 'outline'} 
              className="h-8 text-xs"
              onClick={() => setScoreFilter(scoreFilter === 70 ? 0 : 70)}
            >
              70%+ Match
            </Button>
            <Button 
              size="sm" 
              variant={scoreFilter === 90 ? 'default' : 'outline'} 
              className="h-8 text-xs"
              onClick={() => setScoreFilter(scoreFilter === 90 ? 0 : 90)}
            >
              90%+ Match
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
              <MdExplore className="text-3xl text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No suggestions yet</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Upload a resume in the ATS Checker to start seeing personalized job matches.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs
            .filter(job => {
              if (remoteOnly && !job.location.toLowerCase().includes('remote')) return false
              if (scoreFilter > 0 && job.matchScore < scoreFilter) return false
              return true
            })
            .map((job) => (
            <Card key={job.id} className="group hover:border-teal-200 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden flex flex-col">
              <CardContent className="p-0 flex flex-col flex-1">
                {/* Header with Match Score */}
                <div className="p-5 border-b border-slate-50 bg-slate-50/30">
                  <div className="flex justify-between items-start gap-2">
                    <Badge variant={job.source === 'dice' ? 'blue' : 'emerald'} className="capitalize">
                      {job.source}
                    </Badge>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5 text-teal-600 font-bold">
                        <MdAutoAwesome className="text-sm" />
                        <span>{job.matchScore}% Match</span>
                      </div>
                      <div className="w-16 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-teal-500" 
                          style={{ width: `${job.matchScore}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-3 line-clamp-1">{job.title}</h3>
                  <p className="text-sm text-slate-600 font-medium">{job.company}</p>
                  <p className="text-xs text-slate-400 mt-1">{job.location} • {job.salary}</p>
                </div>

                {/* AI Reason */}
                <div className="px-5 py-4 flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">AI Insight</p>
                  <p className="text-sm text-slate-700 mt-1.5 leading-relaxed italic">
                    "{job.matchReason}"
                  </p>
                </div>

                {/* Footer Actions */}
                <div className="p-5 pt-0 mt-auto flex gap-2">
                  <Button size="sm" className="flex-1 gap-2" variant="outline">
                    <MdBookmarkAdd className="text-base" />
                    Save
                  </Button>
                  <a 
                    href={job.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-md shadow-teal-500/20"
                  >
                    <MdLaunch className="text-base" />
                    View
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
