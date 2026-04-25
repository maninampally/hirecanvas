import type { MetadataRoute } from 'next'
import { BLOG_POSTS } from './blog/posts'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hirecanvas.in'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                  lastModified: new Date(), changeFrequency: 'daily',   priority: 1 },
    { url: `${BASE_URL}/login`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/register`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/privacy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/terms`,       lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/blog`,        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
  ]

  const blogRoutes: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes]
}
