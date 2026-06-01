import test from 'node:test'
import assert from 'node:assert/strict'
import { getLoginRedirectForRole, formatSupportConversationStatus, buildSupportSubject } from './support-tools.ts'

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
