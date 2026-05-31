const JOINABLE_GRAB_STATUSES = new Set(['SOLD_OUT', 'FAILED', 'LIMITED'])

export function canJoinWaitlistFromGrabStatus(status: string | null | undefined) {
  return Boolean(status && JOINABLE_GRAB_STATUSES.has(status))
}

export function getWaitlistStatusLabel(status: string) {
  const labels: Record<string, string> = {
    WAITING: '候补中',
    ALLOCATING: '分配中',
    OFFERED: '待支付',
    PAID: '已支付',
    CANCELLED: '已取消',
    EXPIRED: '已过期',
    FAILED: '候补失败',
  }
  return labels[status] ?? '未知状态'
}

export function canCancelWaitlistEntry(status: string | null | undefined) {
  return status === 'WAITING'
}

export function getWaitlistPrimaryAction(status: string | null | undefined, offerOrderId: number | null | undefined) {
  if (canCancelWaitlistEntry(status)) return '取消候补'
  if (status === 'OFFERED' && offerOrderId) return '去支付'
  return null
}
