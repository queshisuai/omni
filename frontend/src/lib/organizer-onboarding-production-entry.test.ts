import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const source = (relativePath: string) => readFileSync(join(here, relativePath), 'utf8')

test('主办方入驻管理页面使用双 Tab、分页表格和共享抽屉弹窗', () => {
  const content = source('../app/console/organizer-applications/page.tsx')

  assert.match(content, /type Tab = 'applications' \| 'directory'/)
  assert.match(content, /useState<Tab>\('applications'\)/)
  assert.match(content, /入驻审核申请/)
  assert.match(content, /正式主办方名录/)
  assert.match(content, /@\/components\/Pagination/)
  assert.match(content, /<GlobalPagination\b/)
  assert.match(content, /@\/components\/ui\/Drawer/)
  assert.match(content, /<Drawer\b/)
  assert.match(content, /@\/components\/ui\/Modal/)
  assert.match(content, /<Modal\b/)
  assert.match(content, /keyword/)
  assert.match(content, /subjectType/)
  assert.match(content, /立即审核/)
  assert.match(content, /查看详情/)
  assert.match(content, /selectedMaterial/)
})

test('主办方入驻管理页面使用预留 API，并以 3000ms 弱依赖加载活动数', () => {
  const content = source('../app/console/organizer-applications/page.tsx')

  assert.match(content, /listOrganizerApplications/)
  assert.match(content, /listOrganizers/)
  assert.match(content, /approveOrganizerApplication/)
  assert.match(content, /rejectOrganizerApplication/)
  assert.match(content, /batchOrganizerOnsaleSummary/)
  assert.match(content, /revokeOrganizer/)
  assert.match(content, /timeoutMs:\s*3000/)
  assert.match(content, /活动数加载失败|统计中|-/)
  assert.doesNotMatch(content, /deactivateOrganizer/)
})

test('冻结和驳回操作必须使用中文原因校验及高危提示', () => {
  const content = source('../app/console/organizer-applications/page.tsx')

  assert.match(content, /取消合作\/冻结原因不能为空/)
  assert.match(content, /驳回原因不能为空/)
  assert.match(content, /不会自动退款/)
  assert.match(content, /不会修改历史订单或活动数据/)
  assert.match(content, /冻结主办方资质/)
  assert.match(content, /danger/)
})

test('主办方入驻管理入口文案统一而不改变路径和权限', () => {
  const layout = source('../app/console/layout.tsx')
  const paths = source('../lib/console-paths.ts')
  const profile = source('../app/console/profile/page.tsx')

  for (const content of [layout, paths, profile]) {
    assert.match(content, /主办方入驻审核和管理/)
  }
  assert.match(paths, /permission: 'organizer\.review'/)
  assert.match(paths, /href: '\/console\/organizer-applications'/)
  assert.match(layout, /href: '\/console\/organizer-applications'/)
  assert.match(profile, /href="\/console\/organizer-applications"/)
})
