import { useSyncExternalStore } from 'react'

/**
 * Detects in-app / embedded browsers (webviews) where Google OAuth is blocked
 * with Error 403: disallowed_useragent ("Use secure browsers" policy).
 *
 * Only relevant client-side. Returns false during SSR (no navigator).
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent || ''

  // Explicit in-app browser signatures.
  const inAppSignatures = [
    '; wv)', // Android WebView flag
    'FBAN',
    'FBAV',
    'FB_IAB', // Facebook
    'Instagram',
    'WhatsApp',
    'Line/',
    'Snapchat',
    'LinkedInApp',
    'Twitter',
    'GSA/', // Google Search App
  ]
  if (inAppSignatures.some((sig) => ua.includes(sig))) return true

  // iOS heuristic: an iPhone/iPad UA that lacks the Safari/Chrome/Firefox token
  // is almost always an embedded WKWebView.
  const isIOS = /(iPhone|iPod|iPad)/.test(ua)
  if (isIOS) {
    const hasRealBrowserToken = /(Safari\/|CriOS\/|FxiOS\/)/.test(ua)
    if (!hasRealBrowserToken) return true
  }

  return false
}

// UA never changes after load — no-op subscribe, snapshots resolve at mount.
const emptySubscribe = () => () => {}

/**
 * Hydration-safe hook: false on the server and first client render, then the
 * real value after hydration. Avoids setState-in-effect.
 */
export function useIsInAppBrowser(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => isInAppBrowser(),
    () => false
  )
}
