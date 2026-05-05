'use client'

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/60 ${className || ''}`} />
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Greeting skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-64" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-24" />
          <SkeletonBlock className="h-9 w-24" />
          <SkeletonBlock className="h-9 w-28" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 border-l-[3px] border-l-slate-200">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-8 w-16" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6">
          <SkeletonBlock className="h-5 w-40 mb-2" />
          <SkeletonBlock className="h-3 w-56 mb-6" />
          <SkeletonBlock className="h-72 w-full" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <SkeletonBlock className="h-5 w-32 mb-2" />
          <SkeletonBlock className="h-3 w-48 mb-4" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-3/4" />
          </div>
        </div>
      </div>

      {/* Analytics section */}
      <div className="space-y-4">
        <SkeletonBlock className="h-6 w-40" />
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <SkeletonBlock className="h-5 w-48 mb-4" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <SkeletonBlock className="h-5 w-44 mb-4" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        </div>
      </div>

      {/* Applications table */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="h-5 w-16" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
