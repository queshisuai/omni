import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

test('profile security card uses step modals instead of inline password form', () => {
  const page = source('app/profile/page.tsx')

  assert.match(page, /安全与认证/)
  assert.match(page, /管理登录密码与敏感操作的安全凭证/)
  assert.match(page, /登录密码/)
  assert.match(page, /定期更换密码有助于保护账号安全/)
  assert.match(page, /安全手机/)
  assert.match(page, /用于接收验证码及安全登录/)
  assert.match(page, /安全防护等级：高/)
  assert.match(page, /最近安全操作/)
  assert.match(page, /openPasswordModal/)
  assert.match(page, /openPhoneModal/)
  assert.doesNotMatch(page, /title="修改密码"[\s\S]*description="提交后即时生效，不会强制登出；验证码由后端真实校验"/)
})

test('password and phone security flows are two-step backend-backed modals', () => {
  const page = source('app/profile/page.tsx')
  const api = source('lib/api.ts')

  assert.match(page, /1\. 身份验证/)
  assert.match(page, /2\. 设置新密码/)
  assert.match(page, /1\. 身份已验证/)
  assert.match(page, /完成修改/)
  assert.match(page, /1\. 验证原手机/)
  assert.match(page, /2\. 绑定新手机/)
  assert.match(page, /1\. 原手机已验证/)
  assert.match(page, /确认绑定/)
  assert.match(page, /resetSecurityModals/)
  assert.match(page, /startCountdown/)
  assert.match(page, /verifyPasswordIdentity/)
  assert.match(page, /verifyCurrentPhone/)
  assert.match(page, /changePhone/)
  assert.match(page, /updateStoredUser\(\{ phone:/)
  assert.match(page, /showToast/)
  assert.match(page, /1\[3-9\]\\d\{9\}/)

  assert.match(api, /export async function verifyPasswordIdentity/)
  assert.match(api, /export async function verifyCurrentPhone/)
  assert.match(api, /export async function changePhone/)
  assert.match(api, /\/api\/user\/password\/verify/)
  assert.match(api, /\/api\/user\/phone\/verify-current/)
  assert.match(api, /\/api\/user\/phone/)
})

