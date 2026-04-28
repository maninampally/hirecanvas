import { createBrowserClient } from '@supabase/ssr'

function buildClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type BrowserClient = ReturnType<typeof buildClient>

let cached: BrowserClient | null = null

export function createClient(): BrowserClient {
  // During SSR/prerender, NEXT_PUBLIC env vars may be unavailable to
  // the build environment (e.g. CI without secrets configured). The
  // browser client is only used from event handlers and effects, which
  // never run server-side, so return a Proxy that defers throwing
  // until something actually tries to use the client during SSR.
  if (typeof window === 'undefined') {
    return new Proxy({}, {
      get() {
        throw new Error(
          'Supabase browser client accessed during SSR. Move usage into useEffect or an event handler.'
        )
      },
    }) as BrowserClient
  }
  if (!cached) {
    cached = buildClient()
  }
  return cached
}
