import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('search page sends allowlist analytics events through wrapper', () => {
  const content = source('../app/search/page.tsx')

  assert.match(content, /@\/lib\/analytics/)
  assert.match(content, /captureAnalyticsEvent/)
  assert.match(content, /omni_search_submitted/)
  assert.match(content, /omni_search_empty_result_seen/)
})

test('activity detail page sends allowlist analytics events through wrapper', () => {
  const content = source('../app/activity/[id]/page.tsx')

  assert.match(content, /@\/lib\/analytics/)
  assert.match(content, /captureAnalyticsEvent/)
  assert.match(content, /omni_activity_detail_viewed/)
  assert.match(content, /omni_interest_clicked/)
  assert.match(content, /omni_sale_reminder_clicked/)
  assert.match(content, /omni_waitlist_clicked/)
  assert.match(content, /omni_order_create_clicked/)
  assert.match(content, /omni_order_created/)
})

test('orders page sends payment and refund analytics through wrapper', () => {
  const content = source('../app/orders/page.tsx')

  assert.match(content, /@\/lib\/analytics/)
  assert.match(content, /captureAnalyticsEvent/)
  assert.match(content, /omni_payment_started/)
  assert.match(content, /omni_payment_sync_result_seen/)
  assert.match(content, /omni_refund_entry_clicked/)
})

test('console page sends operations analytics through wrapper', () => {
  const content = source('../app/console/page.tsx')

  assert.match(content, /@\/lib\/analytics/)
  assert.match(content, /captureAnalyticsEvent/)
  assert.match(content, /omni_console_ops_summary_viewed/)
  assert.match(content, /omni_console_exception_entry_clicked/)
  assert.match(content, /omni_console_reconciliation_entry_clicked/)
})
