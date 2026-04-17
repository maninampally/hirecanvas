'use client'

export function StatPills() {
  const stats = [
    { label: 'Emails parsed today', value: '86' },
    { label: 'Follow-ups pending', value: '14' },
    { label: 'Status', value: 'Ready', highlight: true },
  ]

  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            stat.highlight
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          <span className="font-bold">{stat.value}</span>
          {' '}
          {stat.label}
        </div>
      ))}
    </div>
  )
}
