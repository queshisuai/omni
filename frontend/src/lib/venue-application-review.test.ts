import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const source = (relativePath: string) => readFileSync(join(here, relativePath), 'utf8')

test('场馆申请 API 暴露分页筛选和独立审核动作', () => {
  const api = source('../lib/api.ts')
  assert.match(api, /listVenueApplications/)
  assert.match(api, /capacityScale/)
  assert.match(api, /materialCompleteness/)
  assert.match(api, /approveVenueApplication/)
  assert.match(api, /rejectVenueApplication/)
})

test('场馆提报页暴露结构化字段和两类材料上传', () => {
  const page = source('../app/console/venue/apply/page.tsx')
  assert.match(page, /venueNameEn/)
  assert.match(page, /FIRE_SAFETY_PERMIT/)
  assert.match(page, /VENUE_LEASE_AGREEMENT/)
  assert.match(page, /!form\.proofNote\.trim\(\) && !proofAsset && !fireAsset && !leaseAsset/)
})

test('场馆审核页使用高密度表格和资质抽屉', () => {
  const page = source('../app/console/venue/applications/page.tsx')
  assert.match(page, /GlobalPagination/)
  assert.match(page, /<Drawer/)
  assert.match(page, /SafeImage/)
  assert.match(page, /capacityScale/)
  assert.match(page, /materialCompleteness/)
  assert.match(page, /待审核申请/)
  assert.match(page, /已入库场馆档案/)
  assert.match(page, /已驳回记录/)
  assert.match(page, /reviewNote\.trim\(\)/)
  assert.doesNotMatch(page, /pageApplications = applications\.slice/)
})
