import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSupportSubject, filterSupportConversations, formatSupportConversationStatus, getLoginRedirectForRole, getSupportConversationRecordsHref, shouldPollSupportConversation } from './support-tools.ts'

test('routes support role to support workbench after login', () => {
  assert.equal(getLoginRedirectForRole('support'), '/support')
  assert.equal(getLoginRedirectForRole('admin'), '/console')
  assert.equal(getLoginRedirectForRole('organizer'), '/console')
  assert.equal(getLoginRedirectForRole('user'), '/')
})

test('formats support conversation status in Chinese', () => {
  assert.equal(formatSupportConversationStatus('OPEN'), 'AI 服务中')
  assert.equal(formatSupportConversationStatus('WAITING_AGENT'), '等待人工接入')
  assert.equal(formatSupportConversationStatus('ASSIGNED'), '人工处理中')
  assert.equal(formatSupportConversationStatus('CLOSED'), '已结束')
})

test('builds concise support subject from first message', () => {
  assert.equal(buildSupportSubject('  电子票二维码无法打开，需要人工帮忙看一下  '), '电子票二维码无法打开，需要人工帮忙看一下')
  assert.equal(buildSupportSubject(''), '在线客服咨询')
})

test('filters support conversations by workbench tab', () => {
  const conversations = [
    { id: 1, status: 'WAITING_AGENT' },
    { id: 2, status: 'ASSIGNED' },
    { id: 3, status: 'CLOSED' },
  ] as any[]

  assert.deepEqual(filterSupportConversations(conversations, 'active').map(item => item.id), [1, 2])
  assert.deepEqual(filterSupportConversations(conversations, 'closed').map(item => item.id), [3])
  assert.deepEqual(filterSupportConversations(conversations, 'all').map(item => item.id), [1, 2, 3])
})

test('polls active support conversations so manual refresh is not required', () => {
  assert.equal(shouldPollSupportConversation('OPEN'), true)
  assert.equal(shouldPollSupportConversation('WAITING_AGENT'), true)
  assert.equal(shouldPollSupportConversation('ASSIGNED'), true)
  assert.equal(shouldPollSupportConversation('CLOSED'), false)
  assert.equal(shouldPollSupportConversation(null), false)
})

test('links admin support management to user conversation records instead of agent filtered records', () => {
  assert.equal(getSupportConversationRecordsHref(), '/console/support-conversations')
})
