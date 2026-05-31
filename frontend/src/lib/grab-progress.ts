type GrabProgressMessageSource = {
  message?: string | null
  failReason?: string | null
  queueRank?: number | null
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
