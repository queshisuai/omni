import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildConsoleReconciliationExportCsv, buildConsoleReconciliationExportExcelHtml } from './console-reconciliation.ts'
import type { ReconciliationBatchDetailVO } from '../types/api.ts'

test('builds reconciliation csv with Chinese labels and without row ids', () => {
  const detail = {
    batch: {
      id: 11001,
      batchNo: 'REAL-DEMO-20260611',
      bizDate: '2026-06-11',
      sourceType: 'local',
      status: 'processing',
      createTime: '2026-06-11T01:00:00',
    },
    details: [
      {
        id: 11002,
        batchNo: 'REAL-DEMO-20260611',
        businessNo: 'PAY-980057',
        businessType: 'payment',
        expectedAmount: 188,
        actualAmount: 188,
        status: 'matched',
        createTime: '2026-06-11T01:01:00',
      },
    ],
    differences: [
      {
        id: 11003,
        batchNo: 'REAL-DEMO-20260611',
        businessNo: 'REF-980057',
        diffType: 'amount_mismatch',
        expectedAmount: 188,
        actualAmount: 99,
        diffAmount: 89,
        reason: '退款金额不一致,需复核',
        status: 'open',
        createTime: '2026-06-11T01:02:00',
      },
    ],
  } as ReconciliationBatchDetailVO

  const csv = buildConsoleReconciliationExportCsv(detail)

  assert.equal(
    csv.startsWith('\ufeff记录类型,批次号,业务日期,来源,业务号,业务类型或差异类型,应收或应退,实收或实退,差异金额,状态,原因,生成时间'),
    true,
  )
  assert.match(csv, /明细,REAL-DEMO-20260611,2026-06-11,本地日结,PAY-980057,支付,188\.00,188\.00,-,已匹配,-,2026-06-11T01:01:00/)
  assert.match(csv, /差异,REAL-DEMO-20260611,2026-06-11,本地日结,REF-980057,金额不一致,188\.00,99\.00,89\.00,待处理,"退款金额不一致,需复核",2026-06-11T01:02:00/)
  assert.doesNotMatch(csv, /11001|11002|11003|local|processing|matched|amount_mismatch|open/)
})

test('builds reconciliation excel html with Chinese labels and without row ids', () => {
  const detail = {
    batch: {
      id: 12001,
      batchNo: 'REAL-DEMO-20260612',
      bizDate: '2026-06-12',
      sourceType: 'local',
      status: 'processing',
      createTime: '2026-06-12T01:00:00',
    },
    details: [
      {
        id: 12002,
        batchNo: 'REAL-DEMO-20260612',
        businessNo: 'PAY-980058',
        businessType: 'payment',
        expectedAmount: 288,
        actualAmount: 288,
        status: 'matched',
        createTime: '2026-06-12T01:01:00',
      },
    ],
    differences: [
      {
        id: 12003,
        batchNo: 'REAL-DEMO-20260612',
        businessNo: 'REF-980058',
        diffType: 'amount_mismatch',
        expectedAmount: 288,
        actualAmount: 188,
        diffAmount: 100,
        reason: '退款金额<异常>&需要复核',
        status: 'open',
        createTime: '2026-06-12T01:02:00',
      },
    ],
  } as ReconciliationBatchDetailVO

  const html = buildConsoleReconciliationExportExcelHtml(detail)

  assert.equal(html.startsWith('\ufeff<html><head><meta charset="utf-8">'), true)
  assert.match(html, /<table>/)
  assert.match(html, /记录类型/)
  assert.match(html, /本地日结/)
  assert.match(html, /支付/)
  assert.match(html, /金额不一致/)
  assert.match(html, /退款金额&lt;异常&gt;&amp;需要复核/)
  assert.doesNotMatch(html, /12001|12002|12003|local|processing|matched|amount_mismatch|open/)
})
