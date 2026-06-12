export type SentryClientEnv = Record<string, string | undefined>

export type SentryClientConfig = {
  enabled: boolean
  dsn: string
  environment: string
  release: string | undefined
  sampleRate: number
  tracesSampleRate: number
  replaysSessionSampleRate: number
  replaysOnErrorSampleRate: number
}

export type SentryServerEnabledKey = 'SENTRY_SERVER_ENABLED' | 'SENTRY_EDGE_ENABLED'

export type SentryServerConfig = {
  enabled: boolean
  dsn: string
  environment: string
  release: string | undefined
  tracesSampleRate: number
}

export type SentryLikeEvent = {
  request?: {
    url?: string
    query_string?: unknown
    cookies?: unknown
    headers?: Record<string, unknown>
    data?: unknown
  }
  user?: unknown
  tags?: Record<string, unknown>
  extra?: Record<string, unknown>
}

export type SentryLikeBreadcrumb = {
  category?: string
  message?: string
  data?: Record<string, unknown>
}

const SENSITIVE_EXTRA_KEYS = [
  'authorization',
  'cookie',
  'idno',
  'id_no',
  'internal',
  'jwt',
  'phone',
  'qrcode',
  'token',
]

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

export function getSentryClientConfig(env: SentryClientEnv): SentryClientConfig {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN ?? ''
  return {
    enabled: env.NEXT_PUBLIC_SENTRY_ENABLED === 'true' && dsn.length > 0,
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? 'local',
    release: env.SENTRY_RELEASE,
    sampleRate: parseNumber(env.SENTRY_SAMPLE_RATE, 1),
    tracesSampleRate: parseNumber(env.SENTRY_TRACES_SAMPLE_RATE, 0),
    replaysSessionSampleRate: parseNumber(env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0),
    replaysOnErrorSampleRate: parseNumber(env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 0),
  }
}

export function getSentryServerConfig(
  env: SentryClientEnv,
  enabledKey: SentryServerEnabledKey,
): SentryServerConfig {
  const dsn = env.SENTRY_DSN ?? ''
  return {
    enabled: env[enabledKey] === 'true' && dsn.length > 0,
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? 'local',
    release: env.SENTRY_RELEASE,
    tracesSampleRate: parseNumber(env.SENTRY_TRACES_SAMPLE_RATE, 0),
  }
}

export function normalizeSentryRoute(input: string | undefined) {
  if (!input) return undefined
  const url = input.startsWith('http')
    ? new URL(input)
    : new URL(input, 'https://omni.local')

  return url.pathname
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/\d+/g, '[id]')
}

function isSensitiveExtraKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '')
  return SENSITIVE_EXTRA_KEYS.some((item) => normalized.includes(item))
}

export function scrubSentryBreadcrumb<T extends SentryLikeBreadcrumb>(breadcrumb: T): T {
  if (breadcrumb.category === 'console' || breadcrumb.category === 'fetch') {
    return {
      ...breadcrumb,
      data: undefined,
      message: breadcrumb.message ? '[Filtered]' : breadcrumb.message,
    } as T
  }

  return breadcrumb
}

export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
  const scrubbed = structuredClone(event)

  if (scrubbed.request) {
    scrubbed.request.url = normalizeSentryRoute(scrubbed.request.url)
    delete scrubbed.request.query_string
    delete scrubbed.request.cookies
    delete scrubbed.request.data

    if (scrubbed.request.headers) {
      delete scrubbed.request.headers.Authorization
      delete scrubbed.request.headers.authorization
      delete scrubbed.request.headers.Cookie
      delete scrubbed.request.headers.cookie
      delete scrubbed.request.headers['X-Internal-Token']
      delete scrubbed.request.headers['x-internal-token']
    }
  }

  delete scrubbed.user

  if (scrubbed.extra) {
    for (const key of Object.keys(scrubbed.extra)) {
      if (isSensitiveExtraKey(key)) {
        scrubbed.extra[key] = '[Filtered]'
      }
    }
  }

  return scrubbed
}
