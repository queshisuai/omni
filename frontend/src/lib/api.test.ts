import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAlipayQrPay } from './api.ts'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('allows alipay qr pay response that takes longer than the default request timeout', async () => {
  const originalFetch = globalThis.fetch
  let aborted = false
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    init?.signal?.addEventListener('abort', () => {
      aborted = true
    })
    await wait(6000)
    return new Response(JSON.stringify({
      code: 200,
      message: 'success',
      data: {
        orderId: 9001,
        orderNo: 'O1',
        amount: 200,
        qrCode: 'qr-code',
        qrCodeUrl: 'https://example.invalid/qr',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const result = await createAlipayQrPay(9001)

    assert.equal(aborted, false)
    assert.equal(result.orderId, 9001)
    assert.equal(result.qrCode, 'qr-code')
  } finally {
    globalThis.fetch = originalFetch
  }
})
