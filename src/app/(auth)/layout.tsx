import Link from 'next/link'
import { AUTH_PREVIEW_ACTIVITY, AUTH_PREVIEW_METRIC_LABELS } from '@/lib/constants'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 bg-[#f0fdfb]">
        <div className="w-full max-w-md animate-slide-up">{children}</div>
      </div>

      {/* Right panel — branding & preview */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-60 w-60 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/5" />

        <div className="relative z-10 mx-auto max-w-md text-center">
          <Link href="/" className="mb-10 inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/15 text-sm font-bold text-white backdrop-blur-sm">
              H
            </div>
            <span className="text-xl font-bold tracking-tight text-white/95">HireCanvas</span>
          </Link>

          <div className="mb-8 rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
            <div className="mb-4 grid grid-cols-3 gap-2.5">
              {AUTH_PREVIEW_METRIC_LABELS.map((label) => (
                <div key={label} className="rounded-xl bg-white/10 px-2 py-2.5">
                  <div className="mx-auto h-5 w-8 rounded bg-white/50" />
                  <p className="mt-2 text-[10px] font-medium text-white/70">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 text-left">
              {AUTH_PREVIEW_ACTIVITY.map(([title, bg, fg]) => (
                <div
                  key={title}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-2"
                >
                  <span className="truncate text-xs font-semibold text-white">{title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${bg} ${fg}`}>
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-white">
            Your Job Search
            <br />
            Command Center
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-teal-100/85">
            Auto-sync Gmail, extract data with AI, and track your entire pipeline from application to offer.
          </p>
        </div>
      </div>
    </div>
  )
}
