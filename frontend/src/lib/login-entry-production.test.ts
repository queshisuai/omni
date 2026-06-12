import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function loginFormSource() {
  return readFileSync(new URL('../components/LoginForm.tsx', import.meta.url), 'utf8')
}

function authEntrySources() {
  return [
    readFileSync(new URL('../components/LoginFooter.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../components/RegisterForm.tsx', import.meta.url), 'utf8'),
  ].join('\n')
}

test('login page does not expose unavailable qr or third party login entries', () => {
  const content = loginFormSource()

  assert.doesNotMatch(content, /qrcode/)
  assert.doesNotMatch(content, /QrCode/)
  assert.doesNotMatch(content, /扫码登录/)
  assert.doesNotMatch(content, /其他登录方式/)
  assert.doesNotMatch(content, /api\.iconify\.design/)
  assert.doesNotMatch(content, /淘宝|微信|QQ|微博|支付宝登录/)
})

test('auth pages do not link to borrowed Damai or Alibaba user destinations', () => {
  const content = authEntrySources()

  assert.doesNotMatch(content, /help\.damai\.cn|x\.damai\.cn|alimebot\.taobao\.com|member\.alibaba\.com/)
})
