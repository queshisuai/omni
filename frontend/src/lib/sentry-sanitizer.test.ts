import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getSentryClientConfig,
  getSentryServerConfig,
  normalizeSentryRoute,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from './sentry-sanitizer.ts'

test('keeps sentry disabled when flag or dsn is missing', () => {
  assert.deepEqual(getSentryClientConfig({}), {
    enabled: false,
    dsn: '',
    environment: 'local',
    release: undefined,
    sampleRate: 1,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })

  assert.equal(getSentryClientConfig({
    NEXT_PUBLIC_SENTRY_ENABLED: 'true',
  }).enabled, false)

  assert.equal(getSentryClientConfig({
    NEXT_PUBLIC_SENTRY_ENABLED: 'true',
    NEXT_PUBLIC_SENTRY_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  }).enabled, true)
})

test('normalizes dynamic ids in route paths', () => {
  assert.equal(normalizeSentryRoute('/orders/980057?token=abc'), '/orders/[id]')
  assert.equal(normalizeSentryRoute('/activity/900002'), '/activity/[id]')
  assert.equal(
    normalizeSentryRoute('/console/sessions/13dbf4c9-ae24-4d7f-83ee-8523b8e71774'),
    '/console/sessions/[id]'
  )
})

test('scrubs sensitive request data from sentry events', () => {
  const result = scrubSentryEvent({
    request: {
      url: 'https://omni.local/orders/980057?token=secret&phone=13800000001',
      query_string: 'token=secret&phone=13800000001',
      cookies: 'SESSION=secret',
      headers: {
        Authorization: 'Bearer secret',
        'X-Internal-Token': 'omni-local-internal-token',
        'Content-Type': 'application/json',
      },
      data: {
        phone: '13800000001',
        idNo: '110101199001011234',
        attendeeName: '张三',
        orderId: 980057,
      },
    },
    user: {
      id: '2004',
      email: 'user@example.com',
      username: '张三',
    },
    tags: {
      role: 'admin',
    },
    extra: {
      token: 'secret',
      qrCode: 'https://qr.example.invalid/abc',
      safe: 'visible',
    },
  })

  assert.equal(result.request.url, '/orders/[id]')
  assert.equal(result.request.query_string, undefined)
  assert.equal(result.request.cookies, undefined)
  assert.equal(result.request.headers.Authorization, undefined)
  assert.equal(result.request.headers['X-Internal-Token'], undefined)
  assert.equal(result.request.headers['Content-Type'], 'application/json')
  assert.equal(result.request.data, undefined)
  assert.equal(result.user, undefined)
  assert.equal(result.extra.token, '[Filtered]')
  assert.equal(result.extra.qrCode, '[Filtered]')
  assert.equal(result.extra.safe, 'visible')
})

test('keeps server and edge sentry disabled unless flag and dsn are present', () => {
  assert.deepEqual(getSentryServerConfig({}, 'SENTRY_SERVER_ENABLED'), {
    enabled: false,
    dsn: '',
    environment: 'local',
    release: undefined,
    tracesSampleRate: 0,
  })

  assert.equal(getSentryServerConfig({
    SENTRY_SERVER_ENABLED: 'true',
  }, 'SENTRY_SERVER_ENABLED').enabled, false)

  assert.equal(getSentryServerConfig({
    SENTRY_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    SENTRY_EDGE_ENABLED: 'true',
    SENTRY_ENVIRONMENT: 'local-trial',
    SENTRY_RELEASE: 'omni-sentry-trial-20260609',
    SENTRY_TRACES_SAMPLE_RATE: '0.5',
  }, 'SENTRY_EDGE_ENABLED').enabled, true)

  assert.equal(getSentryServerConfig({
    SENTRY_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    SENTRY_EDGE_ENABLED: 'false',
  }, 'SENTRY_EDGE_ENABLED').enabled, false)
})

test('scrubs sentry console and fetch breadcrumbs', () => {
  assert.deepEqual(scrubSentryBreadcrumb({
    category: 'fetch',
    message: 'GET /api/user?token=secret',
    data: {
      url: '/api/user?token=secret',
    },
  }), {
    category: 'fetch',
    message: '[Filtered]',
    data: undefined,
  })

  assert.deepEqual(scrubSentryBreadcrumb({
    category: 'navigation',
    message: '/activity/900002',
  }), {
    category: 'navigation',
    message: '/activity/900002',
  })
})
