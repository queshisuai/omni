import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

test('profile page combines profile overview and account settings in one page', () => {
  const page = source('app/profile/page.tsx')

  assert.match(page, /个人中心/)
  assert.match(page, /管理个人基础资料、账户安全及系统快捷入口/)
  assert.match(page, /订单管理/)
  assert.match(page, /我的候补/)
  assert.match(page, /实名观演人/)
  assert.match(page, /通知偏好/)
  assert.match(page, /个人设置中心/)
  assert.match(page, /当前账号 \/ 手机：/)
  assert.match(page, /注册时间：/)
  assert.match(page, /更换头像/)
  assert.match(page, /清除/)
  assert.match(page, /mt-2 flex items-center justify-center gap-3 text-xs font-semibold whitespace-nowrap/)
  assert.match(page, /基础资料/)
  assert.match(page, /修改后即时同步/)
  assert.match(page, /保存资料修改/)
  assert.match(page, /安全与认证/)
  assert.match(page, /管理登录密码与敏感操作的安全凭证/)
  assert.match(page, /修改密码/)
  assert.match(page, /更换手机/)
  assert.match(page, /账户提示/)
  assert.match(page, /updateProfile/)
  assert.match(page, /uploadUserAvatar/)
  assert.match(page, /verifyPasswordIdentity/)
  assert.match(page, /verifyCurrentPhone/)
  assert.match(page, /changePassword/)
  assert.match(page, /changePhone/)
  assert.match(page, /sendSmsCode/)
  assert.match(page, /removeToken/)
  assert.match(page, /登录状态已失效，请重新登录/)
  assert.doesNotMatch(page, /LocalFileUpload/)
  assert.doesNotMatch(page, /CardHeader/)
  assert.doesNotMatch(page, /InfoItem/)
  assert.doesNotMatch(page, /profile-avatar-upload/)
  assert.doesNotMatch(page, /scrollToAvatarUpload/)
  assert.doesNotMatch(page, /角色身份/)
  assert.doesNotMatch(page, /基础资料会同步到当前账户/)
  assert.doesNotMatch(page, /查看当前账户资料，快速进入订单和账号设置/)
})

test('header user menu exposes one unified profile entry', () => {
  const header = source('components/Header.tsx')
  const loggedInStart = header.indexOf('{loggedIn && (')
  const loggedInEnd = header.indexOf('{canEnterConsole', loggedInStart)
  assert.notEqual(loggedInStart, -1)
  assert.notEqual(loggedInEnd, -1)

  const loggedInMenu = header.slice(loggedInStart, loggedInEnd)

  assert.match(loggedInMenu, /个人中心/)
  assert.doesNotMatch(loggedInMenu, /个人信息/)
  assert.doesNotMatch(loggedInMenu, /账号设置/)
  assert.doesNotMatch(loggedInMenu, /router\.push\(["']\/profile\/account["']\)/)
})
