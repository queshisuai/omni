import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('sms verification default copy does not expose local demo instructions', () => {
  const files = [
    '../components/LoginForm.tsx',
    '../app/forgot-password/page.tsx',
    '../app/profile/account/page.tsx',
    '../app/notifications/settings/page.tsx',
    './api.ts',
  ]

  for (const path of files) {
    const content = source(path)

    assert.doesNotMatch(content, /本地演示环境/)
    assert.doesNotMatch(content, /本地演示验证码/)
    assert.doesNotMatch(content, /本地演示返回提示/)
    assert.doesNotMatch(content, /短信或本地演示/)
    assert.doesNotMatch(content, /按返回提示输入验证码/)
    assert.doesNotMatch(content, /暂未接入短信供应商/)
    assert.doesNotMatch(content, /短信通道接入前/)
    assert.doesNotMatch(content, /供应商接入前/)
  }
})
