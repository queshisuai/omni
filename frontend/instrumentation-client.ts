import * as Sentry from '@sentry/nextjs'
import {
  getSentryClientConfig,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from './src/lib/sentry-sanitizer.ts'
import { initializePostHogAnalytics } from './src/lib/posthog-client.ts'

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

const config = getSentryClientConfig({
  NEXT_PUBLIC_SENTRY_ENABLED: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
  SENTRY_RELEASE: process.env.SENTRY_RELEASE,
  SENTRY_SAMPLE_RATE: process.env.SENTRY_SAMPLE_RATE,
  SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
  SENTRY_REPLAYS_SESSION_SAMPLE_RATE: process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: process.env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
})

if (config.enabled) {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    enabled: config.enabled,
    sampleRate: config.sampleRate,
    tracesSampleRate: config.tracesSampleRate,
    replaysSessionSampleRate: config.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event)
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb)
    },
  })
}

initializePostHogAnalytics()
