import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/console/refunds/page.tsx', import.meta.url), 'utf8')
const refundsHelperSource = readFileSync(new URL('./console-refunds.ts', import.meta.url), 'utf8')

test('console refunds page gives technical identifiers Chinese business context', () => {
  assert.doesNotMatch(source, /用户\s*ID/)
  assert.doesNotMatch(source, /ID:/)
  assert.match(source, /用户编号/)
  assert.match(source, /订单编号/)
  assert.match(source, /buildConsoleRefundExportCsv/)
  assert.match(source, /buildConsoleRefundExportExcelHtml/)
  assert.match(source, /导出退款明细/)
  assert.match(source, /导出 Excel/)
  assert.match(refundsHelperSource, /未知退款状态/)
  assert.match(source, /getConsoleRefundStatusClassName/)
  assert.match(source, /formatConsoleRefundActionLabel/)
  assert.match(source, /getConsoleRefundActivityLabel/)
  assert.match(refundsHelperSource, /状态待核对/)
  assert.doesNotMatch(source, /未知活动/)
  assert.doesNotMatch(refundsHelperSource, /未知活动/)
  assert.match(refundsHelperSource, /bg-\[#fff7e6\] text-\[#ad6800\]/)
  assert.doesNotMatch(source, /refund\.status !== 0 && refund\.status !== 4 && \(/)
  assert.doesNotMatch(source, /label: '未知状态'/)
  assert.doesNotMatch(source, /UNKNOWN_STATUS_META = \{ label: '未知退款状态', className: 'bg-\[#f5f5f5\] text-\[#777\]' \}/)
})

test('console refunds page supports audited batch refund review through existing single APIs', () => {
  assert.match(source, /selectedRefundIds/)
  assert.match(source, /getBatchRefundApproveTargets/)
  assert.match(source, /getBatchRefundRejectTargets/)
  assert.match(source, /handleBatchRefundReview/)
  assert.match(source, /window\.confirm/)
  assert.match(source, /批量同意退款/)
  assert.match(source, /批量拒绝退款/)
  assert.match(source, /批量处理结果/)
  assert.match(source, /批量同意\/重试退款/)
  assert.match(source, /批量拒绝退款/)
  assert.match(source, /approveRefund\(refund\.id/)
  assert.match(source, /rejectRefund\(refund\.id/)
  assert.match(source, /canReviewConsoleRefund\(refund\.status\)/)
})
