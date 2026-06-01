export type TimelineState = 'done' | 'active' | 'pending' | 'failed'

export interface OrderTimelineInput {
  status: number
  createTime?: string | null
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

export function buildOrderDetailTimeline(order: OrderTimelineInput) {
  const paid = order.status === 2 || order.status === 4
  const cancelled = order.status === 3
  const refunded = order.status === 4
  return [
    { label: '提交订单', state: 'done' as TimelineState, time: order.createTime || null },
    {
      label: paid ? '支付成功' : cancelled ? '订单取消' : '等待支付',
      state: paid ? 'done' as TimelineState : cancelled ? 'failed' as TimelineState : 'active' as TimelineState,
      time: null,
    },
    {
      label: refunded ? '退款完成' : paid ? '出票入场' : '后续履约',
      state: refunded ? 'done' as TimelineState : paid ? 'active' as TimelineState : 'pending' as TimelineState,
      time: null,
    },
  ]
}
