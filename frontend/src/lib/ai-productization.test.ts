import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const home = read('../app/page.tsx')
const header = read('../components/Header.tsx')
const search = read('../app/search/page.tsx')
const activity = read('../app/activity/[id]/page.tsx')
const finder = read('../app/ai/ticket-finder/page.tsx')
const finderCopy = read('./ai-ticket-finder.ts')
const copilot = read('../components/customer-service/SupportCopilotPanel.tsx')
const workbench = read('../app/console/customer-service/sessions/page.tsx')

test('adds discoverable AI ticket finder entry points across the C-end purchase path', () => {
  assert.match(home, /href="\/ai\/ticket-finder"/)
  assert.match(header, /href="\/ai\/ticket-finder"/)
  assert.match(header, /AI 找票/)
  assert.match(search, /试试 AI 智能找票/)
  assert.match(activity, /让 AI 帮你找票/)
})

test('finder quick examples only fill the query and do not submit automatically', () => {
  assert.match(finder, /AI_TICKET_FINDER_QUICK_EXAMPLES/)
  assert.match(finderCopy, /上海周末的演唱会/)
  assert.match(finderCopy, /广州300元以内的话剧/)
  assert.match(finderCopy, /北京近期适合两个人看的演出/)
  assert.match(finder, /快捷示例/)
  assert.match(finder, /onClick=\{\(\) => setQuery\(example\)\}/)
  assert.match(finder, /event\.key === 'Enter'/)
  assert.match(finder, /正在理解你的需求/)
  assert.match(finder, /正在为你查找可售票/)
})

test('no-result adjustments clear stale parsed state without submitting', () => {
  assert.match(finder, /const handleAdjust = \(\) => \{[\s\S]*setIntent\(null\)[\s\S]*setClarification\(null\)/)
  assert.match(finder, /const handleAdjustWithHint = \(hint: string\) => \{[\s\S]*setQuery\([\s\S]*handleAdjust\(\)/)
})

test('copilot clearly communicates human review before sending', () => {
  assert.match(copilot, /AI 客服 Copilot/)
  assert.match(copilot, /采用建议/)
  assert.match(copilot, /AI 建议尚未发送/)
  assert.match(copilot, /生成 AI 回复建议/)
  assert.match(workbench, /sendSupportMessage/)
})
