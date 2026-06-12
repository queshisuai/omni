import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  captureAnalyticsEvent,
  createAnalyticsTracker,
  getAnalyticsClientConfig,
  sanitizeAnalyticsEvent,
} from './analytics.ts'

test('keeps PostHog analytics disabled unless flag token and host are present', () => {
  assert.deepEqual(getAnalyticsClientConfig({}), {
    enabled: false,
    projectToken: '',
    host: '',
    autocapture: false,
    capturePageview: false,
    sessionReplayEnabled: false,
    personProfiles: 'never',
  })

  assert.equal(getAnalyticsClientConfig({
    NEXT_PUBLIC_POSTHOG_ENABLED: 'true',
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test',
  }).enabled, false)

  assert.equal(getAnalyticsClientConfig({
    NEXT_PUBLIC_POSTHOG_ENABLED: 'true',
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
  }).enabled, true)
})

test('allows only documented PostHog events and properties', () => {
  assert.equal(sanitizeAnalyticsEvent('omni_unknown_event', {
    source: 'console',
  }), null)

  assert.deepEqual(sanitizeAnalyticsEvent('omni_search_submitted', {
    keyword_present: true,
    city: '上海',
    category_id: 12,
    source: 'header',
    keyword: '周杰伦',
    phone: '13800000001',
    token: 'secret',
  }), {
    name: 'omni_search_submitted',
    properties: {
      keyword_present: true,
      city: '上海',
      category_id: 12,
      source: 'header',
    },
  })
})

test('drops sensitive identifiers and unsafe values from allowed analytics properties', () => {
  assert.deepEqual(sanitizeAnalyticsEvent('omni_order_created', {
    activity_id: 900002,
    payment_required: true,
    source: '/orders/980057?token=secret',
    orderId: 980057,
    userId: 2004,
    conversationId: '13dbf4c9-ae24-4d7f-83ee-8523b8e71774',
  }), {
    name: 'omni_order_created',
    properties: {
      activity_id: 900002,
      payment_required: true,
    },
  })
})

test('does not send events when analytics is disabled or no transport is installed', () => {
  const calls: Array<[string, Record<string, unknown>]> = []
  const disabledTracker = createAnalyticsTracker({}, {
    capture(name, properties) {
      calls.push([name, properties])
    },
  })

  assert.equal(disabledTracker.capture('omni_console_ops_summary_viewed', {
    role: 'admin',
    funnel_steps_bucket: '10+',
  }), false)
  assert.deepEqual(calls, [])

  const enabledTrackerWithoutTransport = createAnalyticsTracker({
    NEXT_PUBLIC_POSTHOG_ENABLED: 'true',
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
  })

  assert.equal(enabledTrackerWithoutTransport.capture('omni_console_ops_summary_viewed', {
    role: 'admin',
    funnel_steps_bucket: '10+',
  }), false)

  assert.equal(captureAnalyticsEvent('omni_console_ops_summary_viewed', {
    role: 'admin',
    funnel_steps_bucket: '10+',
  }), false)
})

test('sends sanitized allowlist events through an injected transport only when enabled', () => {
  const calls: Array<[string, Record<string, unknown>]> = []
  const tracker = createAnalyticsTracker({
    NEXT_PUBLIC_POSTHOG_ENABLED: 'true',
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
  }, {
    capture(name, properties) {
      calls.push([name, properties])
    },
  })

  assert.equal(tracker.capture('omni_console_ops_summary_viewed', {
    role: 'admin',
    funnel_steps_bucket: '10+',
    token: 'secret',
  }), true)

  assert.deepEqual(calls, [[
    'omni_console_ops_summary_viewed',
    {
      role: 'admin',
      funnel_steps_bucket: '10+',
    },
  ]])
})
