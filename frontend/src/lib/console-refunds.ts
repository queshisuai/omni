import type { RefundRequestVO, RefundStatus } from '../types/api.ts'

const CONSOLE_REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  0: '待审核',
  1: '已退款',
  2: '已拒绝',
  3: '退款失败',
  4: '处理中',
}

const CONSOLE_REFUND_STATUS_CLASS_NAMES: Record<RefundStatus, string> = {
  0: 'bg-[#fff8e1] text-[#f59e0b]',
  1: 'bg-[#f0fff4] text-[#22c55e]',
  2: 'bg-[#f5f5f5] text-[#777]',
  3: 'bg-[#fff1f2] text-[#e11d48]',
  4: 'bg-[#e3f2fd] text-[#2563eb]',
}

export function formatConsoleRefundStatus(status: RefundStatus) {
  return CONSOLE_REFUND_STATUS_LABELS[status] || '未知退款状态'
}

export function getConsoleRefundStatusClassName(status: RefundStatus | number | null | undefined) {
  if (status == null) return 'bg-[#fff7e6] text-[#ad6800]'
  return CONSOLE_REFUND_STATUS_CLASS_NAMES[status as RefundStatus] || 'bg-[#fff7e6] text-[#ad6800]'
}

export function isKnownConsoleRefundStatus(status: RefundStatus | number | null | undefined) {
  return status != null && Object.prototype.hasOwnProperty.call(CONSOLE_REFUND_STATUS_LABELS, status)
}

export function canReviewConsoleRefund(status: RefundStatus | number | null | undefined) {
  return status === 0 || status === 4
}

export function getBatchRefundApproveTargets<T extends Pick<RefundRequestVO, 'status'>>(refunds: T[]) {
  return refunds.filter(refund => canReviewConsoleRefund(refund.status))
}

export function getBatchRefundRejectTargets<T extends Pick<RefundRequestVO, 'status'>>(refunds: T[]) {
  return refunds.filter(refund => refund.status === 0)
}

export function formatConsoleRefundActionLabel(status: RefundStatus | number | null | undefined) {
  if (canReviewConsoleRefund(status)) return ''
  return isKnownConsoleRefundStatus(status) ? '无需操作' : '状态待核对'
}

export function getConsoleRefundActivityLabel(
  refund: Pick<RefundRequestVO, 'orderName' | 'activityName'>,
) {
  return refund.orderName || refund.activityName || '活动信息待同步'
}

export function buildConsoleRefundExportCsv(refunds: RefundRequestVO[]) {
  const header = ['退款号', '订单号', '活动', '金额', '状态', '原因', '申请时间', '审核时间', '到账时间']
  const rows = refunds.map(refund => [
    refund.refundNo || `退款记录 ${refund.id}`,
    refund.orderNo || '-',
    getConsoleRefundActivityLabel(refund),
    refund.amount,
    formatConsoleRefundStatus(refund.status),
    refund.reason || '-',
    refund.createTime,
    refund.reviewTime || '-',
    refund.refundTime || '-',
  ])
  return `\ufeff${[header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}`
}

export function buildConsoleRefundExportExcelHtml(refunds: RefundRequestVO[]) {
  const header = ['退款号', '订单号', '活动', '金额', '状态', '原因', '申请时间', '审核时间', '到账时间']
  const rows = refunds.map(refund => [
    refund.refundNo || `退款记录 ${refund.id}`,
    refund.orderNo || '-',
    getConsoleRefundActivityLabel(refund),
    refund.amount,
    formatConsoleRefundStatus(refund.status),
    refund.reason || '-',
    refund.createTime,
    refund.reviewTime || '-',
    refund.refundTime || '-',
  ])
  const head = header.map(cell => `<th>${htmlCell(cell)}</th>`).join('')
  const body = rows.map(row => `<tr>${row.map(cell => `<td>${htmlCell(cell)}</td>`).join('')}</tr>`).join('')
  return `\ufeff<html><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function htmlCell(value: string | number | null | undefined) {
  return value == null
    ? ''
    : String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
}
