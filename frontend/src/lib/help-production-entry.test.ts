import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/help/page.tsx', import.meta.url), 'utf8')

test('help page blocks customer reply when conversation status is unknown', () => {
  assert.match(source, /canEditSupportConversation/)
  assert.match(source, /formatSupportConversationWriteBlockedMessage/)
  assert.match(source, /formatSupportConversationWriteBlockedMessage\(conversation\.status\)/)
  assert.doesNotMatch(source, /disabled=\{conversation\?\.status === 'CLOSED'\}/)
  assert.doesNotMatch(source, /disabled=\{loading \|\| conversation\?\.status === 'CLOSED'\}/)
})

test('help page confirms close only after rechecking conversation status', () => {
  assert.match(source, /canConfirmSupportConversationClose/)
  assert.match(source, /!canConfirmSupportConversationClose\(conversation\.status\)/)
  assert.match(source, /当前会话暂不能结束，请刷新后再操作/)
  assert.doesNotMatch(source, /\{conversation\?\.status === 'CLOSE_REQUESTED' && \(/)
})

test('help page reports blocked handoff status before calling handoff API', () => {
  assert.match(source, /canRequestSupportHandoff/)
  assert.match(source, /formatSupportConversationWriteBlockedMessage\(conversation\.status\) \|\| '当前会话暂不能转人工，请刷新后再操作'/)
  assert.match(source, /当前会话暂不能转人工，请刷新后再操作/)
  assert.doesNotMatch(source, /if \(!conversation \|\| !canRequestSupportHandoff\(conversation\)\) return/)
})
