import assert from 'node:assert/strict'
import { test } from 'node:test'
import { proxyToBackend } from './server-proxy.ts'

test('returns chinese 503 when API_PROXY_TARGET is missing', async () => {
  const originalTarget = process.env.API_PROXY_TARGET
  const originalFetch = globalThis.fetch
  delete process.env.API_PROXY_TARGET
  let called = false
  globalThis.fetch = (async () => {
    called = true
    return new Response(JSON.stringify({ code: 200, data: null }))
  }) as typeof fetch

  try {
    const response = await proxyToBackend(new Request('http://localhost/api/user/profile'), 'api', ['user', 'profile'])
    const payload = await response.json()

    assert.equal(response.status, 503)
    assert.deepEqual(payload, { code: 503, message: '后端代理目标未配置', data: null })
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
    if (originalTarget === undefined) {
      delete process.env.API_PROXY_TARGET
    } else {
      process.env.API_PROXY_TARGET = originalTarget
    }
  }
})

test('proxies to explicit API_PROXY_TARGET', async () => {
  const originalTarget = process.env.API_PROXY_TARGET
  const originalFetch = globalThis.fetch
  process.env.API_PROXY_TARGET = 'http://gateway.local/'
  let requestedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({ code: 200, data: { ok: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await proxyToBackend(new Request('http://localhost/api/ticket/activities?city=北京'), 'api', ['ticket', 'activities'])
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(requestedUrl, 'http://gateway.local/api/ticket/activities?city=%E5%8C%97%E4%BA%AC')
    assert.deepEqual(payload, { code: 200, data: { ok: true } })
  } finally {
    globalThis.fetch = originalFetch
    if (originalTarget === undefined) {
      delete process.env.API_PROXY_TARGET
    } else {
      process.env.API_PROXY_TARGET = originalTarget
    }
  }
})
