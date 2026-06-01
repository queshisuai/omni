import type { RefundRequestVO } from '../types/api.ts'

export type RefundTimelineState = 'done' | 'active' | 'pending' | 'failed'

export interface RefundTimelineStep {
  label: string
  time: string | null
  state: RefundTimelineState
}

export function buildRefundTimeline(refund: RefundRequestVO): RefundTimelineStep[] {
  const reviewState: RefundTimelineState = refund.status === 2 || refund.status === 3 ? 'failed' : refund.status === 0 ? 'active' : 'done'
  const refundState: RefundTimelineState = refund.status === 1 ? 'done' : refund.status === 3 ? 'failed' : refund.status === 4 ? 'active' : 'pending'
  return [
    { label: '已提交申请', time: refund.createTime, state: 'done' },
    { label: refund.status === 2 ? '审核已拒绝' : '平台审核', time: refund.reviewTime, state: reviewState },
    { label: refund.status === 3 ? '退款失败' : '原路退回', time: refund.refundTime, state: refundState },
  ]
}

export function getRefundSupportCopy(refund: RefundRequestVO | null | undefined) {
  if (!refund) return null
  if (refund.status === 3) return '退款失败，可联系人工客服介入处理'
  if (refund.status === 4) return '退款处理中超过预期时，可联系人工客服查询'
  return null
}
