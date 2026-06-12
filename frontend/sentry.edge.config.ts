import * as Sentry from '@sentry/nextjs'
import {
  getSentryServerConfig,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from './src/lib/sentry-sanitizer.ts'

const config = getSentryServerConfig(process.env, 'SENTRY_EDGE_ENABLED')

if (config.enabled) {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    enabled: true,
    tracesSampleRate: config.tracesSampleRate,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event)
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb)
    },
  })
}
