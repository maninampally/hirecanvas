import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white font-bold text-sm border border-white/10">
              H
            </div>
            <span className="text-xl font-bold text-white/90">HireCanvas</span>
          </Link>

          {/* Value prop */}
          <div className="space-y-6 max-w-sm">
            <h2 className="text-3xl font-bold text-white leading-tight">
              Track smarter.<br />
              Land faster.
            </h2>
            <p className="text-teal-200/80 leading-relaxed">
              Join thousands of job seekers who use HireCanvas to automate their job search pipeline.
            </p>

            {/* Stats */}
            <div className="flex gap-8 pt-4">
              {[
                { value: '2.5K+', label: 'Users' },
                { value: '18K+', label: 'Jobs Tracked' },
                { value: '92%', label: 'Success Rate' },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-teal-300/60">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-sm text-teal-50/90 italic leading-relaxed mb-3">
              &ldquo;HireCanvas helped me organize my entire job search. I went from scattered spreadsheets to landing 3 offers in 6 weeks.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-300 to-emerald-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                S
              </div>
              <div>
                <p className="text-sm font-medium text-white/90">Sarah K.</p>
                <p className="text-xs text-teal-300/60">Software Engineer</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#f0fdfb]">
        <div className="w-full max-w-md animate-slide-up">
          {children}
        </div>
      </div>
    </div>
  )
}
