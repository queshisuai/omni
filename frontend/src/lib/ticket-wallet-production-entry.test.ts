import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('ticket wallet explains ticket state and links to concrete order detail', () => {
  const content = source('../app/tickets/page.tsx')

  assert.match(content, /getTicketWalletStatusCopy/)
  assert.match(content, /router\.push\(`\/orders\/\$\{ticket\.orderId\}`\)/)
  assert.doesNotMatch(content, /router\.push\(`\/orders`\)/)
})

test('ticket wallet uses readable ticket fallback instead of ticket type identifier', () => {
  const content = source('../app/tickets/page.tsx')

  assert.doesNotMatch(content, /票档 \$\{ticket\.ticketTypeId\}/)
  assert.match(content, /票档信息待同步/)
})

test('ticket wallet does not label unknown ticket status as invalid', () => {
  const content = source('../app/tickets/page.tsx')

  assert.doesNotMatch(content, /STATUS_META\[status\] \|\| STATUS_META\[3\]/)
  assert.match(content, /状态同步中/)
})
