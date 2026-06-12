export type AnalyticsEnv = Record<string, string | undefined>

export type AnalyticsClientConfig = {
  enabled: boolean
  projectToken: string
  host: string
  autocapture: boolean
  capturePageview: boolean
  sessionReplayEnabled: boolean
  personProfiles: 'never'
}

export type AnalyticsEventName =
  | 'omni_search_submitted'
  | 'omni_search_empty_result_seen'
  | 'omni_activity_detail_viewed'
  | 'omni_interest_clicked'
  | 'omni_sale_reminder_clicked'
  | 'omni_waitlist_clicked'
  | 'omni_order_create_clicked'
  | 'omni_order_created'
  | 'omni_payment_started'
  | 'omni_payment_sync_result_seen'
  | 'omni_refund_entry_clicked'
  | 'omni_console_ops_summary_viewed'
  | 'omni_console_exception_entry_clicked'
  | 'omni_console_reconciliation_entry_clicked'

export type AnalyticsProperties = Record<string, unknown>

export type SanitizedAnalyticsEvent = {
  name: AnalyticsEventName
  properties: AnalyticsProperties
}

export type AnalyticsTransport = {
  capture(name: AnalyticsEventName, properties: AnalyticsProperties): void
}

export type AnalyticsTracker = {
  config: AnalyticsClientConfig
  capture(name: string, properties?: AnalyticsProperties): boolean
}

const PUBLIC_ANALYTICS_ENV_KEYS = [
  'NEXT_PUBLIC_POSTHOG_ENABLED',
  'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_POSTHOG_AUTOCAPTURE',
  'NEXT_PUBLIC_POSTHOG_CAPTURE_PAGEVIEW',
  'NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED',
] as const

const ALLOWED_EVENT_PROPERTIES: Record<AnalyticsEventName, readonly string[]> = {
  omni_search_submitted: ['keyword_present', 'city', 'category_id', 'source'],
  omni_search_empty_result_seen: ['city', 'category_id', 'result_count_bucket'],
  omni_activity_detail_viewed: ['activity_id', 'city', 'category_id', 'sale_status'],
  omni_interest_clicked: ['activity_id', 'source'],
  omni_sale_reminder_clicked: ['activity_id', 'source'],
  omni_waitlist_clicked: ['activity_id', 'ticket_type_id', 'source'],
  omni_order_create_clicked: ['activity_id', 'ticket_type_id', 'source'],
  omni_order_created: ['activity_id', 'payment_required', 'source'],
  omni_payment_started: ['payment_channel', 'source'],
  omni_payment_sync_result_seen: ['result', 'source'],
  omni_refund_entry_clicked: ['source'],
  omni_console_ops_summary_viewed: ['role', 'funnel_steps_bucket'],
  omni_console_exception_entry_clicked: ['role', 'source'],
  omni_console_reconciliation_entry_clicked: ['role', 'source'],
}

const SENSITIVE_PROPERTY_KEYS = [
  'authorization',
  'attendee',
  'card',
  'code',
  'conversation',
  'cookie',
  'email',
  'idno',
  'id_no',
  'internal',
  'jwt',
  'name',
  'order',
  'payment_no',
  'phone',
  'qrcode',
  'refund_no',
  'token',
  'user',
]

const UNSAFE_VALUE_PATTERNS = [
  /[?&](token|phone|code|orderId|userId|conversationId)=/i,
  /\bBearer\s+/i,
  /https?:\/\//i,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
]

const STRING_VALUE_MAX_LENGTH = 80

let defaultTransport: AnalyticsTransport | undefined
let defaultTracker: AnalyticsTracker | null = null

function isPostHogEventName(name: string): name is AnalyticsEventName {
  return Object.hasOwn(ALLOWED_EVENT_PROPERTIES, name)
}

function parseBoolean(value: string | undefined) {
  return value === 'true'
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, '')
}

function isSensitiveKey(key: string) {
  const normalized = normalizeKey(key)
  return SENSITIVE_PROPERTY_KEYS.some((item) => normalized.includes(item))
}

function isSafeAnalyticsValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > STRING_VALUE_MAX_LENGTH) return false
  return !UNSAFE_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function getPublicAnalyticsEnv(): AnalyticsEnv {
  const source = process.env as AnalyticsEnv
  return Object.fromEntries(
    PUBLIC_ANALYTICS_ENV_KEYS.map(key => [key, source[key]]),
  ) as AnalyticsEnv
}

function getDefaultAnalyticsTracker() {
  if (!defaultTracker) {
    defaultTracker = createAnalyticsTracker(getPublicAnalyticsEnv(), defaultTransport)
  }
  return defaultTracker
}

export function getAnalyticsClientConfig(env: AnalyticsEnv): AnalyticsClientConfig {
  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? ''
  const host = env.NEXT_PUBLIC_POSTHOG_HOST ?? ''

  return {
    enabled: env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true' && projectToken.length > 0 && host.length > 0,
    projectToken,
    host,
    autocapture: parseBoolean(env.NEXT_PUBLIC_POSTHOG_AUTOCAPTURE),
    capturePageview: parseBoolean(env.NEXT_PUBLIC_POSTHOG_CAPTURE_PAGEVIEW),
    sessionReplayEnabled: parseBoolean(env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED),
    personProfiles: 'never',
  }
}

export function sanitizeAnalyticsEvent(
  name: string,
  properties: AnalyticsProperties = {},
): SanitizedAnalyticsEvent | null {
  if (!isPostHogEventName(name)) return null

  const allowlist = new Set(ALLOWED_EVENT_PROPERTIES[name])
  const sanitized: AnalyticsProperties = {}

  for (const [key, value] of Object.entries(properties)) {
    if (!allowlist.has(key) || isSensitiveKey(key) || !isSafeAnalyticsValue(value)) continue
    sanitized[key] = typeof value === 'string' ? value.trim() : value
  }

  return {
    name,
    properties: sanitized,
  }
}

export function createAnalyticsTracker(
  env: AnalyticsEnv,
  transport?: AnalyticsTransport,
): AnalyticsTracker {
  const config = getAnalyticsClientConfig(env)

  return {
    config,
    capture(name, properties = {}) {
      if (!config.enabled || !transport) return false

      const sanitized = sanitizeAnalyticsEvent(name, properties)
      if (!sanitized) return false

      transport.capture(sanitized.name, sanitized.properties)
      return true
    },
  }
}

export function configureAnalyticsTransport(
  transport: AnalyticsTransport | undefined,
  env: AnalyticsEnv = getPublicAnalyticsEnv(),
) {
  defaultTransport = transport
  defaultTracker = createAnalyticsTracker(env, defaultTransport)
}

export function setAnalyticsTransport(transport?: AnalyticsTransport) {
  configureAnalyticsTransport(transport)
}

export function captureAnalyticsEvent(
  name: string,
  properties: AnalyticsProperties = {},
) {
  return getDefaultAnalyticsTracker().capture(name, properties)
}
