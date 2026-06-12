import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/console/sessions/page.tsx', import.meta.url), 'utf8')

test('console sessions page exposes session report exports', () => {
  assert.match(source, /buildConsoleSessionReportCsv/)
  assert.match(source, /buildConsoleSessionReportExcelHtml/)
  assert.match(source, /导出场次报表/)
  assert.match(source, /导出 Excel/)
  assert.doesNotMatch(source, /活动\s*ID/)
  assert.doesNotMatch(source, /场馆\s*ID/)
})
