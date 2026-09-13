import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const source = (relativePath: string) => readFileSync(join(here, relativePath), 'utf8')

function assertHighDensityWorkbench(page: string) {
  assert.match(page, /<table/)
  assert.match(page, /whitespace-nowrap/)
  assert.match(page, /truncate/)
  assert.match(page, /<Drawer/)
  assert.match(page, /GlobalPagination/)
  assert.doesNotMatch(page, /pageItems = useMemo\(\(\) => items\.slice/)
  assert.doesNotMatch(page, /rounded-xl border border-\[#eee\] bg-white p-4/)
}

test('艺人档案审核页改为表格分页和右侧资质抽屉', () => {
  const page = source('../app/console/artists/pending/page.tsx')

  assertHighDensityWorkbench(page)
  assert.match(page, /待审核档案/)
  assert.match(page, /正式艺人库归档/)
  assert.match(page, /已驳回记录/)
  assert.match(page, /风控拦截名单/)
  assert.match(page, /SafeImage/)
  assert.match(page, /listPendingAdminArtists\(\{[\s\S]*page/)
  assert.match(page, /reviewNote\.trim\(\)/)
  assert.match(page, /riskReason\.trim\(\)/)
  assert.match(page, /驳回整改/)
  assert.match(page, /标记为风险艺人/)
})

test('恢复售票审核页改为服务端分页表格和整改核验抽屉', () => {
  const page = source('../app/console/risk-resolutions/page.tsx')

  assertHighDensityWorkbench(page)
  assert.match(page, /待审批恢复申请/)
  assert.match(page, /已恢复售票记录/)
  assert.match(page, /已驳回整改申请/)
  assert.match(page, /SafeImage/)
  assert.match(page, /业务影响告警/)
  assert.match(page, /系统将立即解除售票熔断/)
  assert.match(page, /reviewNote\.trim\(\)/)
  assert.match(page, /approveActivityRiskResolution/)
  assert.match(page, /rejectActivityRiskResolution/)
})

test('站点变更审核页改为服务端分页表格和 Diff 抽屉', () => {
  const page = source('../app/console/station-config-reviews/page.tsx')

  assertHighDensityWorkbench(page)
  assert.match(page, /待审批变更单/)
  assert.match(page, /历史变更生效归档/)
  assert.match(page, /已否决变更单/)
  assert.match(page, /getStationConfigReviewDiff/)
  assert.match(page, /变更前/)
  assert.match(page, /变更后/)
  assert.match(page, /高危风险/)
  assert.match(page, /reviewNote\.trim\(\)/)
  assert.match(page, /approveStationConfigReview/)
  assert.match(page, /rejectStationConfigReview/)
})

test('审核 API 暴露新分页查询和独立动作路径', () => {
  const api = source('../lib/api.ts')

  assert.match(api, /\/api\/ticket\/admin\/artists\/pending\?/)
  assert.match(api, /\/api\/ticket\/admin\/artists\/\$\{id\}\/approve/)
  assert.match(api, /\/api\/ticket\/admin\/artists\/\$\{id\}\/reject/)
  assert.match(api, /\/api\/ticket\/admin\/artists\/\$\{id\}\/mark-risk/)
  assert.match(api, /\/api\/ticket\/admin\/risk-resolutions\?/)
  assert.match(api, /\/api\/ticket\/admin\/risk-resolutions\/\$\{id\}\/approve/)
  assert.match(api, /\/api\/ticket\/admin\/risk-resolutions\/\$\{id\}\/reject/)
  assert.match(api, /\/api\/ticket\/admin\/station-config-reviews\?/)
  assert.match(api, /\/api\/ticket\/admin\/station-config-reviews\/\$\{id\}\/diff/)
  assert.match(api, /\/api\/ticket\/admin\/station-config-reviews\/\$\{id\}\/approve/)
  assert.match(api, /\/api\/ticket\/admin\/station-config-reviews\/\$\{id\}\/reject/)
})

test('控制台全局主内容区使用满宽布局', () => {
  const layout = source('../app/console/layout.tsx')

  assert.match(layout, /<main className="flex-1 min-w-0 p-6 sm:p-8 overflow-y-auto">/)
  assert.match(layout, /<div className="w-full min-w-0">/)
  assert.doesNotMatch(layout, /max-w-\[1200px\]/)
})

test('审核列表统一复用 ConsoleTable 外壳并取消固定最小表宽', () => {
  const component = source('../components/ConsoleTable.tsx')
  const venue = source('../app/console/venue/applications/page.tsx')
  const artists = source('../app/console/artists/pending/page.tsx')
  const riskResolutions = source('../app/console/risk-resolutions/page.tsx')
  const stationReviews = source('../app/console/station-config-reviews/page.tsx')

  assert.match(component, /w-full rounded-xl border border-gray-200 bg-white overflow-hidden/)
  assert.match(component, /overflow-x-auto/)
  assert.match(component, /bg-gray-50 text-gray-500 font-semibold border-b/)
  assert.match(component, /ConsoleTableSkeleton/)

  for (const page of [venue, artists, riskResolutions, stationReviews]) {
    assert.match(page, /<ConsoleTable/)
    assert.doesNotMatch(page, /min-w-\[\d+px\] w-full table-fixed/)
    assert.doesNotMatch(page, /<div className="overflow-hidden rounded-xl border border-\[#e5e5e5\] bg-white">/)
  }
})
