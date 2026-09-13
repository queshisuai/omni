import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function source(path: string) {
  return readFileSync(join(here, path), 'utf8')
}

test('platform account management page defines permission-scoped three-level tabs', () => {
  const pagePath = join(here, '../app/console/accounts/page.tsx')
  assert.equal(existsSync(pagePath), true)

  const content = source('../app/console/accounts/page.tsx')
  assert.match(content, /type AccountTab = 'MANAGER' \| 'AGENT' \| 'ORGANIZER'/)
  assert.match(content, /客服主管/)
  assert.match(content, /普通客服/)
  assert.match(content, /主办方运营员/)
  assert.match(content, /hasConsolePermission/)
  assert.match(content, /support\.account\.manage/)
  assert.match(content, /organizer\.account\.manage/)
  assert.match(content, /availableTabs\[0\]\?\.type/)
})

test('platform account management page uses compact data table columns and skeleton', () => {
  const content = source('../app/console/accounts/page.tsx')

  assert.match(content, /ConsoleTableSkeleton/)
  assert.match(content, /CONSOLE_TABLE_HEADER_CLASS/)
  for (const label of ['人员名称', '登录手机号', '职务/权限角色', '账号状态', '最后更新', '操作']) {
    assert.match(content, new RegExp(label))
  }
  assert.match(content, /bg-purple-100 text-purple-700 ring-2 ring-purple-200/)
  assert.match(content, /from-purple-600 to-fuchsia-500/)
  assert.match(content, /bg-pink-50 text-\[var\(--omni-brand,#ff1268\)\]/)
  assert.match(content, /bg-blue-50 text-blue-600/)
  assert.match(content, /启用中/)
  assert.match(content, /已停用/)
})

test('platform account management dialog has Chinese labels validation and dynamic role copy', () => {
  const content = source('../app/console/accounts/page.tsx')

  for (const label of ['姓名 / 业务昵称', '登录手机号', '登录密码', '职能说明']) {
    assert.match(content, new RegExp(label))
  }
  assert.match(content, /11 位手机号/)
  assert.match(content, /重置登录密码，留空则不修改/)
  assert.match(content, /确认创建/)
  assert.match(content, /确认保存/)
  assert.match(content, /新建客服主管/)
  assert.match(content, /新建普通客服/)
  assert.match(content, /新建主办方运营员/)
})

test('legacy account management routes redirect to platform account management', () => {
  assert.match(source('../app/console/support-accounts/page.tsx'), /redirect\('\/console\/accounts\?type=support'\)/)
  assert.match(source('../app/console/organizer-admins/page.tsx'), /redirect\('\/console\/accounts\?type=organizer'\)/)
})
