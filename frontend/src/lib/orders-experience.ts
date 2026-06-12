import type { RefundRequestVO } from '../types/api.ts'

export type TimelineState = 'done' | 'active' | 'pending' | 'failed'

export interface OrderTimelineInput {
  status: number
  createTime?: string | null
}

export interface OrderSeatLabelInput {
  status: number
  seatLabels?: string | null
  seatSelectionMode?: string | null
}

export function formatOrderSeatLabel(order: OrderSeatLabelInput) {
  const labels = order.seatLabels?.trim()
  if (labels) return labels

  if (order.seatSelectionMode === 'NONE') {
    return '无固定座位，凭电子票入场'
  }

  if (order.status === 1) {
    return '支付成功后确认座位信息'
  }

  return '座位信息待确认，请稍后刷新'
}

export function getOrderDetailStatusCopy(status: number) {
  if (status === 1) {
    return { title: '待支付', description: '请在支付时限内完成支付，超时后订单会自动取消。' }
  }
  if (status === 2) {
    return { title: '已支付', description: '订单已支付，可前往票夹查看电子票。' }
  }
  if (status === 3) {
    return { title: '已取消', description: '订单已取消，如仍想观演可重新选票或进入候补。' }
  }
  if (status === 4) {
    return { title: '已退款', description: '退款已处理完成，可查看退款时间线和退款单。' }
  }
  return { title: '订单状态更新中', description: '订单状态正在同步，请稍后刷新查看。' }
}

function getRefundTimelineStep(refund: RefundRequestVO) {
  if (refund.status === 0) {
    return { label: '退款审核中', state: 'active' as TimelineState, time: refund.createTime || null }
  }
  if (refund.status === 1) {
    return { label: '退款完成', state: 'done' as TimelineState, time: refund.refundTime || refund.reviewTime || refund.createTime || null }
  }
  if (refund.status === 2) {
    return { label: '退款已拒绝', state: 'failed' as TimelineState, time: refund.reviewTime || refund.createTime || null }
  }
  if (refund.status === 3) {
    return { label: '退款失败', state: 'failed' as TimelineState, time: refund.refundTime || refund.reviewTime || refund.createTime || null }
  }
  if (refund.status === 4) {
    return { label: '退款处理中', state: 'active' as TimelineState, time: refund.reviewTime || refund.createTime || null }
  }
  return { label: '退款状态同步中', state: 'active' as TimelineState, time: refund.createTime || null }
}

export function buildOrderDetailTimeline(order: OrderTimelineInput, latestRefund?: RefundRequestVO | null) {
  const paid = order.status === 2 || order.status === 4
  const cancelled = order.status === 3
  const refunded = order.status === 4
  const fulfillmentStep = latestRefund
    ? getRefundTimelineStep(latestRefund)
    : {
        label: refunded ? '退款完成' : paid ? '出票入场' : '后续履约',
        state: refunded ? 'done' as TimelineState : paid ? 'active' as TimelineState : 'pending' as TimelineState,
        time: null,
      }

  return [
    { label: '提交订单', state: 'done' as TimelineState, time: order.createTime || null },
    {
      label: paid ? '支付成功' : cancelled ? '订单取消' : '等待支付',
      state: paid ? 'done' as TimelineState : cancelled ? 'failed' as TimelineState : 'active' as TimelineState,
      time: null,
    },
    fulfillmentStep,
  ]
}
