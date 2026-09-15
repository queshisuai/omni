import assert from 'node:assert/strict'
import { test } from 'node:test'
import { interpretAiTicketFinder, searchAiTicketFinder } from './api.ts'

test('calls finder interpret and search endpoints with the original query', async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ url: string; method: string; body: string }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method || 'GET',
      body: String(init?.body || ''),
    })
    return new Response(JSON.stringify({
      code: 200,
      message: '成功',
      data: {
        requestId: 'finder-1',
        parsedIntent: null,
        clarification: null,
        results: [],
        explanation: null,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    await interpretAiTicketFinder('东京演唱会')
    await searchAiTicketFinder('东京演唱会')
    assert.deepEqual(requests, [
      {
        url: '/api/ticket/ai/finder/interpret',
        method: 'POST',
        body: JSON.stringify({ query: '东京演唱会' }),
      },
      {
        url: '/api/ticket/ai/finder/search',
        method: 'POST',
        body: JSON.stringify({ query: '东京演唱会' }),
      },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})
