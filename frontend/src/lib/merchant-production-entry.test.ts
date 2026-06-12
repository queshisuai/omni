import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/merchant/page.tsx', import.meta.url), 'utf8')

test('merchant application copy avoids raw user id wording', () => {
  assert.doesNotMatch(source, /用户 ID/)
  assert.match(source, /用户编号/)
})

test('merchant application status does not treat unknown values as rejected or pending', () => {
  const statusMetaSource = source.match(/function statusMeta[\s\S]*?\n}/)?.[0] ?? ''
  const statusDescriptionSource = source.match(/function statusDescription[\s\S]*?\n}/)?.[0] ?? ''

  assert.match(statusMetaSource, /status === 2\) return \{ text: '已驳回'/)
  assert.match(statusMetaSource, /return \{ text: '未知入驻状态'/)
  assert.match(statusDescriptionSource, /入驻状态待核对/)
  assert.doesNotMatch(statusDescriptionSource, /: '资料正在审核中。'/)
})
