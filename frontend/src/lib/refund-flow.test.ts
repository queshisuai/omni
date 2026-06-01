import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRefundTimeline, getRefundSupportCopy } from './refund-flow.ts'
import type { RefundRequestVO } from '../types/api.ts'

function refund(status: RefundRequestVO['status'], overrides: Partial<RefundRequestVO> = {}): RefundRequestVO {
  return {
    id: 1,
    orderId: 10,
    orderNo: 'O1',
    userId: 2004,
    paymentId: 99,
    refundNo: 'R1',
    amount: 380,
    reason: null,
    status,
    reviewerId: null,
    reviewNote: null,
    alipayRefundNo: null,
    createTime: '2026-06-01T10:00:00',
    reviewTime: null,
    refundTime: null,
    ...overrides,
  }
}

test('builds refund timeline for pending review', () => {
  assert.deepEqual(buildRefundTimeline(refund(0)).map((step) => [step.label, step.state]), [
    ['已提交申请', 'done'],
    ['平台审核', 'active'],
    ['原路退回', 'pending'],
  ])
})

test('builds refund timeline for completed refund', () => {
  assert.deepEqual(buildRefundTimeline(refund(1, { reviewTime: '2026-06-01T11:00:00', refundTime: '2026-06-01T12:00:00' })).map((step) => step.state), [
    'done',
    'done',
    'done',
  ])
})

test('shows support copy for failed and unknown refund states', () => {
  assert.equal(getRefundSupportCopy(refund(3)), '退款失败，可联系人工客服介入处理')
  assert.equal(getRefundSupportCopy(refund(4)), '退款处理中超过预期时，可联系人工客服查询')
  assert.equal(getRefundSupportCopy(refund(1)), null)
})
