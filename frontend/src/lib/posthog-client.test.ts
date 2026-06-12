import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { captureAnalyticsEvent, configureAnalyticsTransport } from './analytics.ts'
import { initializePostHogAnalytics } from './posthog-client.ts'

function createFakePostHogClient() {
  const initCalls: Array<[string, Record<string, unknown>]> = []
  const captureCalls: Array<[string, Record<string, unknown>]> = []

  return {
    initCalls,
    captureCalls,
    client: {
      init(projectToken: string, options: Record<string, unknown>) {
        initCalls.push([projectToken, options])
      },
      capture(name: string, properties: Record<string, unknown>) {
        captureCalls.push([name, properties])
      },
    },
  }
}

test('does not initialize PostHog SDK when config is incomplete', () => {
  const fake = createFakePostHogClient()

  configureAnalyticsTransport(undefined, {})
  assert.equal(initializePostHogAnalytics({}, fake.client), false)

  assert.deepEqual(fake.initCalls, [])
  assert.equal(captureAnalyticsEvent('omni_search_submitted', {
    keyword_present: true,
    city: '上海',
    source: 'search',
  }), false)
})

test('initializes PostHog SDK with privacy safe options and sanitized transport', () => {
  const fake = createFakePostHogClient()

  const initialized = initializePostHogAnalytics({
    NEXT_PUBLIC_POSTHOG_ENABLED: 'true',
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
    NEXT_PUBLIC_POSTHOG_AUTOCAPTURE: 'true',
    NEXT_PUBLIC_POSTHOG_CAPTURE_PAGEVIEW: 'true',
    NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED: 'true',
  }, fake.client)

  assert.equal(initialized, true)
  assert.deepEqual(fake.initCalls, [[
    'phc_test',
    {
      api_host: 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: 'never',
    },
  ]])

  assert.equal(captureAnalyticsEvent('omni_search_submitted', {
    keyword_present: true,
    city: '上海',
    source: 'search',
    keyword: '不应上报的搜索原词',
    phone: '13800000001',
  }), true)

  assert.deepEqual(fake.captureCalls, [[
    'omni_search_submitted',
    {
      keyword_present: true,
      city: '上海',
      source: 'search',
    },
  ]])
})

test('client instrumentation installs PostHog transport without page direct SDK imports', () => {
  const instrumentation = readFileSync(new URL('../../instrumentation-client.ts', import.meta.url), 'utf8')
  const pageSources = [
    '../app/search/page.tsx',
    '../app/activity/[id]/page.tsx',
    '../app/orders/page.tsx',
    '../app/console/page.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))

  assert.match(instrumentation, /initializePostHogAnalytics/)
  for (const content of pageSources) {
    assert.doesNotMatch(content, /posthog-js/)
  }
})
