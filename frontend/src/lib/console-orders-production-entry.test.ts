import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/console/orders/page.tsx', import.meta.url), 'utf8')

test('console orders page uses readable ticket fallback instead of ticket type identifiers', () => {
  assert.doesNotMatch(source, /票档 \$\{order\.matchedTicketTypeId \?\? order\.ticketTypeId\}/)
  assert.match(source, /getConsoleOrderTicketLabel/)
})

test('console orders page uses readable activity fallback instead of unknown activity copy', () => {
  assert.doesNotMatch(source, /未知活动/)
  assert.match(source, /getConsoleOrderActivityLabel/)
})

test('console orders page labels downgraded ticket route identifiers in Chinese context', () => {
  assert.doesNotMatch(source, /#\{requestedTicketTypeId\}/)
  assert.doesNotMatch(source, /#\{matchedTicketTypeId\}/)
  assert.match(source, /原票档编号/)
  assert.match(source, /实际票档编号/)
})

test('console orders page uses Chinese fallback for unknown order status', () => {
  assert.doesNotMatch(source, /CONSOLE_ORDER_STATUS_LABELS\[o\.status\] \|\| '-'/)
  assert.match(source, /formatConsoleOrderStatusLabel/)
})

test('console orders page uses shared order status badge styles', () => {
  assert.doesNotMatch(source, /o\.status === 1 \? 'bg-\[#fff8e1\] text-\[#f59e0b\]' :/)
  assert.doesNotMatch(source, /o\.status === 2 \? 'bg-\[#f0fff4\] text-\[#22c55e\]' :/)
  assert.match(source, /getConsoleOrderStatusClassName/)
})
