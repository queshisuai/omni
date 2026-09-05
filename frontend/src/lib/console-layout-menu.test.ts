import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const layoutSource = readFileSync(new URL('../app/console/layout.tsx', import.meta.url), 'utf8')

test('console layout defines five grouped business menu sections and fixed profile entry', () => {
  assert.match(layoutSource, /export interface ConsoleSubItem/)
  assert.match(layoutSource, /export interface ConsoleMenuGroup/)
  assert.match(layoutSource, /export const consoleMenuGroups: ConsoleMenuGroup\[\]/)

  for (const groupId of ['dashboard', 'events', 'orders', 'operations', 'system']) {
    assert.match(layoutSource, new RegExp(`id: '${groupId}'`))
  }

  for (const title of ['概览与看板', '演出与票务管理', '订单与履约中心', '运营、客服与审核', '系统、安全与财务']) {
    assert.match(layoutSource, new RegExp(`title: '${title}'`))
  }

  assert.doesNotMatch(layoutSource, /const organizerMenuItems/)
  assert.match(layoutSource, /href="\/console\/profile"[\s\S]*个人中心/)
})

test('console layout filters children by role and permission before hiding empty groups', () => {
  assert.match(layoutSource, /buildVisibleConsoleMenuGroups/)
  assert.match(layoutSource, /canAccessConsolePath\(child\.href, permissionCodes\)/)
  assert.match(layoutSource, /isConsolePathAllowedForRole\(role, child\.href\)/)
  assert.match(layoutSource, /children\.length > 0/)
  assert.match(layoutSource, /getOrganizerConsoleSubItem/)
  assert.match(layoutSource, /我的活动管理/)
})

test('console layout auto-expands active group and uses brand color for active submenu', () => {
  assert.match(layoutSource, /const \[openGroups, setOpenGroups\] = useState<string\[\]>\(\[\]\)/)
  assert.match(layoutSource, /findActiveConsoleGroupId/)
  assert.match(layoutSource, /setOpenGroups/)
  assert.match(layoutSource, /bg-\[var\(--omni-brand\)\]\/10/)
  assert.match(layoutSource, /text-\[var\(--omni-brand\)\]/)
})
