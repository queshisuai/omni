import type { SessionAdminVO } from '../types/api.ts'

const SESSION_REPORT_HEADER = ['活动', '场馆', '城市', '开始时间', '结束时间', '状态', '票档数', '总库存', '已售', '余票']

export function formatConsoleSessionStatus(status: number | null | undefined) {
  if (status === 1) return '启用'
  if (status === 0) return '停用'
  return '未知场次状态'
}

export function getConsoleSessionStatusClassName(status: number | null | undefined) {
  if (status === 1) return 'bg-[#f0fff4] text-[#22c55e]'
  if (status === 0) return 'bg-[#f5f5f5] text-[#999]'
  return 'bg-[#fff7e6] text-[#ad6800]'
}

export function buildConsoleSessionReportCsv(sessions: SessionAdminVO[]) {
  const rows = buildConsoleSessionReportRows(sessions)
  return `\ufeff${[SESSION_REPORT_HEADER, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}`
}

export function buildConsoleSessionReportExcelHtml(sessions: SessionAdminVO[]) {
  const rows = buildConsoleSessionReportRows(sessions)
  const head = SESSION_REPORT_HEADER.map(cell => `<th>${htmlCell(cell)}</th>`).join('')
  const body = rows.map(row => `<tr>${row.map(cell => `<td>${htmlCell(cell)}</td>`).join('')}</tr>`).join('')
  return `\ufeff<html><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
}

function buildConsoleSessionReportRows(sessions: SessionAdminVO[]) {
  return sessions.map(session => [
    session.activityName || `活动编号：${session.activityId}`,
    session.venueName || `场馆编号：${session.venueId}`,
    session.venueCity || '-',
    formatTime(session.startTime),
    session.endTime ? formatTime(session.endTime) : '未设置',
    formatConsoleSessionStatus(session.status),
    session.ticketTypeCount,
    session.totalStock,
    session.soldStock,
    session.remainStock,
  ])
}

function formatTime(value?: string | null) {
  return value ? value.replace('T', ' ').substring(0, 16) : '-'
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
