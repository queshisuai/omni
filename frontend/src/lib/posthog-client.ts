import posthog from 'posthog-js'
import {
  configureAnalyticsTransport,
  getAnalyticsClientConfig,
  getPublicAnalyticsEnv,
  type AnalyticsEnv,
  type AnalyticsProperties,
} from './analytics.ts'

type PostHogInitOptions = {
  api_host: string
  autocapture: false
  capture_pageview: false
  disable_session_recording: true
  person_profiles: 'never'
}

type PostHogClient = {
  init(projectToken: string, options: PostHogInitOptions): void
  capture(name: string, properties: AnalyticsProperties): void
}

export function createPostHogAnalyticsTransport(client: Pick<PostHogClient, 'capture'>) {
  return {
    capture(name: string, properties: AnalyticsProperties) {
      client.capture(name, properties)
    },
  }
}

export function initializePostHogAnalytics(
  env: AnalyticsEnv = getPublicAnalyticsEnv(),
  client: PostHogClient = posthog,
) {
  const config = getAnalyticsClientConfig(env)

  if (!config.enabled) {
    configureAnalyticsTransport(undefined, env)
    return false
  }

  client.init(config.projectToken, {
    api_host: config.host,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: 'never',
  })

  configureAnalyticsTransport(createPostHogAnalyticsTransport(client), env)
  return true
}
