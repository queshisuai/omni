import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canActOnSuggestion,
  canUseSupportCopilot,
  getCopilotErrorMessage,
  haveMessagesChanged,
} from './customer-service-copilot.ts'

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8')

test('Copilot API 复用 request 并使用四条真实路径', () => {
  const api = source('lib/api.ts')
  assert.match(api, /generateCsCopilotSuggestion/)
  assert.match(api, /acceptCsCopilotSuggestion/)
  assert.match(api, /editCsCopilotSuggestion/)
  assert.match(api, /rejectCsCopilotSuggestion/)
  assert.match(api, /\/api\/user\/cs\/sessions\/\$\{sessionId\}\/copilot\/suggestions/)
  assert.match(api, /\/api\/user\/cs\/copilot\/suggestions\/\$\{suggestionId\}\/accept/)
  assert.match(api, /\/api\/user\/cs\/copilot\/suggestions\/\$\{suggestionId\}\/edit/)
  assert.match(api, /\/api\/user\/cs\/copilot\/suggestions\/\$\{suggestionId\}\/reject/)
  assert.doesNotMatch(api, /axios/)
})

test('只有 Copilot Generate 使用专用 35 秒前端请求超时', () => {
  const api = source('lib/api.ts')
  assert.match(api, /const COPILOT_GENERATE_REQUEST_TIMEOUT_MS = 35000/)
  assert.match(api, /generateCsCopilotSuggestion[\s\S]*timeoutMs:\s*COPILOT_GENERATE_REQUEST_TIMEOUT_MS/)
  assert.doesNotMatch(api, /acceptCsCopilotSuggestion[\s\S]*timeoutMs:\s*SUPPORT_MESSAGE_REQUEST_TIMEOUT_MS/)
  assert.doesNotMatch(api, /editCsCopilotSuggestion[\s\S]*timeoutMs:\s*SUPPORT_MESSAGE_REQUEST_TIMEOUT_MS/)
  assert.doesNotMatch(api, /rejectCsCopilotSuggestion[\s\S]*timeoutMs:\s*SUPPORT_MESSAGE_REQUEST_TIMEOUT_MS/)
})

test('仅 support.ai.use 或平台管理员可以使用 Copilot', () => {
  assert.equal(canUseSupportCopilot('support', []), false)
  assert.equal(canUseSupportCopilot('support', ['support.ai.use']), true)
  assert.equal(canUseSupportCopilot('platform_super_admin', []), false)
})

test('Copilot 错误码映射为中文业务提示', () => {
  assert.equal(getCopilotErrorMessage(409), '会话内容已发生变化，当前 AI 建议已失效，请重新生成。')
  assert.equal(getCopilotErrorMessage(502), 'AI 返回内容未通过系统事实校验，请重新生成。')
  assert.equal(getCopilotErrorMessage(503), 'AI 服务暂时不可用，请稍后重试。')
  assert.equal(getCopilotErrorMessage(null), 'AI 建议处理失败，请稍后重试。')
})

test('仅 READY 和 ACCEPTED 允许旧建议动作', () => {
  assert.equal(canActOnSuggestion('READY'), true)
  assert.equal(canActOnSuggestion('ACCEPTED'), true)
  assert.equal(canActOnSuggestion('EXPIRED'), false)
  assert.equal(canActOnSuggestion('REJECTED'), false)
})

test('消息 ID 序列可检测新消息且空序列稳定', () => {
  assert.equal(haveMessagesChanged([], []), false)
  assert.equal(haveMessagesChanged([1, 2], [1, 2]), false)
  assert.equal(haveMessagesChanged([1, 2], [1, 2, 3]), true)
  assert.equal(haveMessagesChanged([1, 2], [1, 4]), true)
})
