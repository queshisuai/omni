import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/console/reconciliation/page.tsx', import.meta.url), 'utf8')

test('reconciliation page uses shared Chinese display formatters for backend codes', () => {
  assert.match(source, /formatReconciliationBatchStatus/)
  assert.match(source, /formatReconciliationDiffType/)
  assert.match(source, /buildConsoleReconciliationExportCsv/)
  assert.match(source, /buildConsoleReconciliationExportExcelHtml/)
  assert.match(source, /导出对账单/)
  assert.match(source, /导出 Excel/)
  assert.doesNotMatch(source, /return status \|\| '-'/)
  assert.doesNotMatch(source, /return type \|\| '-'/)
  assert.doesNotMatch(source, /return source \|\| '-'/)
})
