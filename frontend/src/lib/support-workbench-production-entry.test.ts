import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8')

test('support workbench labels user and grab identifiers with Chinese context', () => {
  assert.doesNotMatch(source, /ID：\{active\.userId\}/)
  assert.doesNotMatch(source, /抢票 \{request\.requestId\}/)
  assert.doesNotMatch(source, /用户 \$\{conversation\.userId\}/)
  assert.doesNotMatch(source, /订单 \$\{order\.id\}/)
  assert.doesNotMatch(source, /退款 \$\{refund\.id\}/)
  assert.doesNotMatch(source, /票券 \$\{ticket\.ticketId\}/)
  assert.doesNotMatch(source, /候补 \{item\.id\}/)
  assert.doesNotMatch(source, /通知 \$\{item\.id\}/)
  assert.doesNotMatch(source, /request\.progressMessage \|\| request\.status/)
  assert.doesNotMatch(source, /item\.estimatedWaitText \|\| item\.status/)
  assert.match(source, /用户编号：\{active\.userId\}/)
  assert.match(source, /用户编号：\$\{conversation\.userId\}/)
  assert.match(source, /抢票请求号：\{request\.requestId\}/)
  assert.match(source, /订单编号：\$\{order\.id\}/)
  assert.match(source, /退款编号：\$\{refund\.id\}/)
  assert.match(source, /票券编号：\$\{ticket\.ticketId\}/)
  assert.match(source, /候补编号：\{item\.id\}/)
  assert.match(source, /通知编号：\$\{item\.id\}/)
})

test('support workbench disables write actions when conversation status is unknown', () => {
  assert.match(source, /canClaimSupportConversation/)
  assert.match(source, /canEditSupportConversation/)
  assert.match(source, /canReplySupportConversation/)
  assert.match(source, /canRequestSupportClose/)
  assert.match(source, /formatSupportConversationWriteBlockedMessage/)
  assert.doesNotMatch(source, /disabled=\{active\.status === 'CLOSED'\}/)
  assert.doesNotMatch(source, /disabled=\{active\.status === 'CLOSED' \|\| !transferTarget\}/)
  assert.doesNotMatch(source, /disabled=\{active\.status === 'CLOSED' \|\| active\.status === 'CLOSE_REQUESTED'\}/)
})

test('support workbench reports blocked writes for known but non-actionable conversation status', () => {
  assert.match(source, /formatSupportConversationWriteBlockedMessage\(active\?\.status\) \|\| '当前会话暂不能执行该操作，请刷新后再操作'/)
  assert.match(source, /当前会话暂不能执行该操作，请刷新后再操作/)
  assert.doesNotMatch(source, /if \(message\) setError\(message\)\s+return false/)
})
