type GrabProgressMessageSource = {
  message?: string | null
  failReason?: string | null
  queueRank?: number | null
}

type GrabTicketTypeSource = {
  ticketTypeId: number
  name?: string | null
}

type GrabAutoDowngradeSource = {
  allowAutoDowngrade?: boolean | null
  matchedTicketTypeId?: number | null
  requestedTicketTypes?: GrabTicketTypeSource[] | null
}

const GRAB_MESSAGE_LABELS: Record<string, string> = {
  'ticket type sold out': '当前票档已售罄',
  'order confirmation pending': '订单确认中，请稍后查看订单结果',
  'team order confirmation pending': '小队订单确认中，请稍后查看订单结果',
}

export function localizeGrabProgressMessage(message: string | null | undefined) {
  if (!message) return message ?? null
  const trimmed = message.trim()
  const lockedCreatingOrderMatch = trimmed.match(/^(.+?) locked, creating order$/i)
  if (lockedCreatingOrderMatch) return `${lockedCreatingOrderMatch[1]}已锁定，正在创建订单`
  const localized = GRAB_MESSAGE_LABELS[trimmed.toLowerCase()]
  if (localized) return localized
  return /[\u3400-\u9fff]/.test(trimmed) ? message : '抢票状态更新中，请稍后查看'
}

export function getGrabProgressDisplayMessage(
  progress: GrabProgressMessageSource,
  fallback = '正在排队',
) {
  const message = progress.message || progress.failReason
  if (message) return localizeGrabProgressMessage(message) || message
  if (progress.queueRank != null) return `你前面还有 ${progress.queueRank} 人`
  return fallback
}

export function getQueueRankTrendLabel(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null) return null
  if (current < previous) return `较上次前进 ${previous - current} 位`
  if (current > previous) return `较上次后退 ${current - previous} 位`
  return '排位暂未变化'
}

export function getAutoDowngradeDisplay(progress: GrabAutoDowngradeSource) {
  if (!progress.allowAutoDowngrade) return '未开启自动降档'
  const matched = progress.requestedTicketTypes?.find((ticket) => ticket.ticketTypeId === progress.matchedTicketTypeId)
  if (matched && progress.requestedTicketTypes?.[0]?.ticketTypeId !== matched.ticketTypeId) {
    return matched.name ? `已自动降档至 ${matched.name}` : '已自动降档，票档信息待同步'
  }
  return '已开启，按票档顺序尝试'
}
