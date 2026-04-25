import type { Metadata } from 'next'
import Link from 'next/link'
import { BLOG_POSTS } from './posts'

export const metadata: Metadata = {
  title: 'Blog — HireCanvas',
  description: 'Job search tips, tracker comparisons, and guides for serious job seekers.',
  openGraph: {
    title: 'HireCanvas Blog',
    description: 'Job search tips, tracker comparisons, and guides for serious job seekers.',
  },
}

export default function BlogIndexPage() {
  const sorted = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-12">
          <Link href="/" className="text-sm text-teal-600 hover:underline">← HireCanvas</Link>
          <h1 className="mt-4 text-4xl font-bold text-slate-900 tracking-tight">Blog</h1>
          <p className="mt-2 text-lg text-slate-500">Job search tips, tool comparisons, and guides.</p>
        </div>

        <div className="space-y-10">
          {sorted.map((post) => (
            <article key={post.slug} className="border-b border-slate-100 pb-10 last:border-0">
              <Link href={`/blog/${post.slug}`} className="group block">
                <p className="text-xs text-slate-400 mb-2">
                  {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' · '}
                  {post.readMinutes} min read
                </p>
                <h2 className="text-xl font-bold text-slate-900 group-hover:text-teal-700 transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="mt-2 text-slate-600 text-sm leading-relaxed">{post.excerpt}</p>
                <span className="mt-3 inline-block text-sm font-medium text-teal-600 group-hover:underline">
                  Read more →
                </span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
