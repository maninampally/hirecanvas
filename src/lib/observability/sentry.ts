import * as Sentry from '@sentry/nextjs'

let sentryReady = false

export function initSentry(serviceName: string) {
  if (sentryReady) return

  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return

  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    environment: process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,
    initialScope: {
      tags: {
        service: serviceName,
      },
    },
  })

  sentryReady = true
}

export function captureSentryException(error: unknown, context?: Record<string, unknown>) {
  if (!sentryReady) return
  Sentry.captureException(error, {
    extra: context,
  })
}

export function captureSentryMessage(message: string, context?: Record<string, unknown>) {
  if (!sentryReady) return
  Sentry.captureMessage(message, {
    level: 'info',
    extra: context,
  })
}
