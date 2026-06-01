import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSupportSubject, canRequestSupportHandoff, filterSupportConversations, formatSupportConversationStatus, formatSupportMessageSender, getLoginRedirectForRole, getSupportConversationRecordsHref, isSupportHelpConversationPath, mergeSupportConversations, pickDefaultUserSupportConversation, shouldPollSupportConversation } from './support-tools.ts'

test('routes support role to support workbench after login', () => {
  assert.equal(getLoginRedirectForRole('support'), '/support')
  assert.equal(getLoginRedirectForRole('admin'), '/console')
  assert.equal(getLoginRedirectForRole('organizer'), '/console')
  assert.equal(getLoginRedirectForRole('user'), '/')
})

test('formats support conversation status in Chinese', () => {
  assert.equal(formatSupportConversationStatus('OPEN'), 'AI 服务中')
  assert.equal(formatSupportConversationStatus('WAITING_AGENT'), '人工介入请等待')
  assert.equal(formatSupportConversationStatus('ASSIGNED'), '人工处理中')
  assert.equal(formatSupportConversationStatus('CLOSE_REQUESTED'), '等待用户确认结束')
  assert.equal(formatSupportConversationStatus('CLOSED'), '已结束')
})

test('formats support message sender by customer and agent perspective', () => {
  assert.equal(formatSupportMessageSender({ senderType: 'AGENT', senderDisplayName: '杨梅' }, 'customer'), '人工客服（杨梅）')
  assert.equal(formatSupportMessageSender({ senderType: 'USER', senderDisplayName: '小王' }, 'agent'), '小王')
  assert.equal(formatSupportMessageSender({ senderType: 'USER', senderDisplayName: '小王' }, 'customer'), '我')
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

test('merges active and closed support conversations for workbench tabs', () => {
  const merged = mergeSupportConversations([
    { id: 1, status: 'ASSIGNED', updateTime: '2026-06-01T10:00:00' },
    { id: 2, status: 'CLOSED', updateTime: '2026-06-01T11:00:00' },
    { id: 1, status: 'ASSIGNED', updateTime: '2026-06-01T10:00:00' },
  ] as any[])

  assert.deepEqual(merged.map(item => item.id), [2, 1])
  assert.equal(filterSupportConversations(merged, 'closed').length, 1)
  assert.equal(filterSupportConversations(merged, 'all').length, 2)
})

test('polls active support conversations so manual refresh is not required', () => {
  assert.equal(shouldPollSupportConversation('OPEN'), true)
  assert.equal(shouldPollSupportConversation('WAITING_AGENT'), true)
  assert.equal(shouldPollSupportConversation('ASSIGNED'), true)
  assert.equal(shouldPollSupportConversation('CLOSE_REQUESTED'), true)
  assert.equal(shouldPollSupportConversation('CLOSED'), false)
  assert.equal(shouldPollSupportConversation(null), false)
})

test('only allows handoff after a live conversation exists', () => {
  assert.equal(canRequestSupportHandoff(null), false)
  assert.equal(canRequestSupportHandoff({ status: 'OPEN' }), true)
  assert.equal(canRequestSupportHandoff({ status: 'WAITING_AGENT' }), false)
  assert.equal(canRequestSupportHandoff({ status: 'ASSIGNED' }), false)
  assert.equal(canRequestSupportHandoff({ status: 'CLOSE_REQUESTED' }), false)
  assert.equal(canRequestSupportHandoff({ status: 'CLOSED' }), false)
})

test('treats only the help page as the customer support conversation window', () => {
  assert.equal(isSupportHelpConversationPath('/help'), true)
  assert.equal(isSupportHelpConversationPath('/help?from=message'), true)
  assert.equal(isSupportHelpConversationPath('/orders'), false)
  assert.equal(isSupportHelpConversationPath('/notifications'), false)
  assert.equal(isSupportHelpConversationPath('/support'), false)
  assert.equal(isSupportHelpConversationPath('/console/support-conversations'), false)
})

test('links admin support management to user conversation records instead of agent filtered records', () => {
  assert.equal(getSupportConversationRecordsHref(), '/console/support-conversations')
})

test('picks a real agent conversation before self-assigned admin artifacts in user help center', () => {
  const conversations = [
    { id: 5, userId: 2002, status: 'ASSIGNED', sourceType: 'HUMAN', assignedAgentId: 2002 },
    { id: 4, userId: 2002, status: 'ASSIGNED', sourceType: 'HUMAN', assignedAgentId: 2013 },
    { id: 3, userId: 2002, status: 'OPEN', sourceType: 'AI', assignedAgentId: null },
  ] as any[]

  assert.equal(pickDefaultUserSupportConversation(conversations, 2002)?.id, 4)
})

test('switches away from a preferred self-assigned artifact when a real agent conversation exists', () => {
  const conversations = [
    { id: 5, userId: 2002, status: 'ASSIGNED', sourceType: 'HUMAN', assignedAgentId: 2002 },
    { id: 6, userId: 2002, status: 'ASSIGNED', sourceType: 'HUMAN', assignedAgentId: 2013 },
  ] as any[]

  assert.equal(pickDefaultUserSupportConversation(conversations, 2002, 5)?.id, 6)
})

test('does not reopen a closed conversation as the default user help session', () => {
  const conversations = [
    { id: 7, userId: 2002, status: 'CLOSED', sourceType: 'HUMAN', assignedAgentId: 2013 },
  ] as any[]

  assert.equal(pickDefaultUserSupportConversation(conversations, 2002), null)
})
