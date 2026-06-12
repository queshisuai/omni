import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/console/check-in/page.tsx', import.meta.url), 'utf8')
const checkInHelperSource = readFileSync(new URL('./console-check-in.ts', import.meta.url), 'utf8')

test('console check-in page uses Chinese business labels for session lookup', () => {
  assert.doesNotMatch(source, /场次\s*ID/)
  assert.match(source, /场次编号/)
  assert.match(source, /请求号/)
  assert.match(source, /buildConsoleCheckInExportCsv/)
  assert.match(source, /buildConsoleCheckInExportExcelHtml/)
  assert.match(source, /buildConsoleCheckInExceptionExportCsv/)
  assert.match(source, /buildConsoleCheckInExceptionExportExcelHtml/)
  assert.match(source, /导出核验记录/)
  assert.match(source, /导出 Excel/)
  assert.match(source, /导出异常报表/)
  assert.match(source, /导出异常 Excel/)
  assert.match(source, /downloadRecords\(buildConsoleCheckInExceptionExportCsv\(records\), '异常核验记录'/)
  assert.match(source, /downloadRecords\(buildConsoleCheckInExceptionExportExcelHtml\(records\), '异常核验记录'/)
})

test('console check-in page uses Chinese fallback for unknown result codes', () => {
  assert.doesNotMatch(source, /RESULT_LABELS\[record\.result\] \|\| record\.result/)
  assert.doesNotMatch(source, /RESULT_STYLES\[record\.result\] \|\| 'bg-\[#f5f5f5\] text-\[#666\]'/)
  assert.match(source, /formatConsoleCheckInResult/)
  assert.match(source, /getConsoleCheckInResultClassName/)
  assert.match(checkInHelperSource, /未知结果/)
})
