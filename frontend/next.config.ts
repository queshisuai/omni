import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  turbopack: {
    root: configDir,
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
