import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BLOG_POSTS, getPostBySlug } from '../posts'

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  return {
    title: `${post.title} — HireCanvas Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="mb-8">
          <Link href="/blog" className="text-sm text-teal-600 hover:underline">← All posts</Link>
        </div>

        <article>
          <header className="mb-10">
            <p className="text-xs text-slate-400 mb-3">
              {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}
              {post.readMinutes} min read
            </p>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">
              {post.title}
            </h1>
            <p className="mt-3 text-lg text-slate-500 leading-relaxed">{post.excerpt}</p>
          </header>

          <div
            className="prose prose-slate prose-sm sm:prose max-w-none
              prose-headings:font-bold prose-headings:text-slate-900
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-slate-700 prose-p:leading-relaxed
              prose-li:text-slate-700
              prose-a:text-teal-600 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-slate-900"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>

        <div className="mt-16 pt-8 border-t border-slate-100">
          <p className="text-sm text-slate-500 mb-4">Track your job search automatically with HireCanvas.</p>
          <Link
            href="/register"
            className="inline-block bg-teal-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-600 transition-colors"
          >
            Try HireCanvas free →
          </Link>
        </div>
      </div>
    </div>
  )
}
