import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('orders refund support entry opens a real support conversation instead of fake success', () => {
  const content = source('../app/orders/page.tsx')

  assert.doesNotMatch(content, /已记录客服介入请求/)
  assert.match(content, /\bstartSupportConversation\b/)
  assert.match(content, /preferHuman:\s*true/)
  assert.match(content, /退款单号/)
  assert.match(content, /\/help\?conversationId=/)
})

test('help page honors preferred support conversation from order redirect', () => {
  const content = source('../app/help/page.tsx')

  assert.match(content, /\bURLSearchParams\b/)
  assert.match(content, /conversationId/)
  assert.match(content, /loadMyConversation\(preferredConversationId/)
})

test('help page uses shared handoff action label for unknown support statuses', () => {
  const content = source('../app/help/page.tsx')

  assert.doesNotMatch(content, /conversation\?\.status === 'WAITING_AGENT' \? '人工介入请等待'/)
  assert.match(content, /formatSupportHandoffActionLabel/)
})

test('order detail timeline includes latest refund state', () => {
  const content = source('../app/orders/[id]/page.tsx')

  assert.match(content, /buildOrderDetailTimeline\(order,\s*latestRefund\)/)
})

test('orders pages use readable ticket fallback instead of ticket type identifiers', () => {
  const contents = [
    source('../app/orders/page.tsx'),
    source('../app/orders/[id]/page.tsx'),
  ].join('\n')

  assert.doesNotMatch(contents, /票档 \$\{fallbackTicketTypeId\}/)
  assert.doesNotMatch(contents, /未知票档/)
  assert.match(contents, /票档信息待同步/)
})

test('orders pages use syncing copy when activity or venue names are missing', () => {
  const contents = [
    source('../app/orders/page.tsx'),
    source('../app/orders/[id]/page.tsx'),
  ].join('\n')

  assert.doesNotMatch(contents, /未知活动/)
  assert.doesNotMatch(contents, /未知场馆/)
  assert.match(contents, /活动信息待同步/)
  assert.match(contents, /场馆信息待同步/)
})

test('orders page does not label unknown order status as cancelled', () => {
  const content = source('../app/orders/page.tsx')

  assert.doesNotMatch(content, /STATUS_MAP\[order\.status\] \|\| STATUS_MAP\[3\]/)
  assert.match(content, /订单状态更新中/)
})

test('orders page uses refund status formatter for unknown refund states', () => {
  const content = source('../app/orders/page.tsx')

  assert.match(content, /\bgetRefundStatusMeta\b/)
  assert.match(content, /\bisRefundActionBlockingStatus\b/)
  assert.doesNotMatch(content, /REFUND_STATUS_MAP\[latestRefund\.status\]\.color/)
  assert.doesNotMatch(content, /REFUND_STATUS_MAP\[latestRefund\.status\]\.label/)
  assert.doesNotMatch(content, /REFUND_STATUS_MAP\[activeRefund\.status\]\.color/)
  assert.doesNotMatch(content, /REFUND_STATUS_MAP\[activeRefund\.status\]\.label/)
  assert.doesNotMatch(content, /ACTIVE_REFUND_STATUSES\.has\(refund\.status\)/)
})
