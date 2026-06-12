import type { CheckInRecordVO } from '../types/api.ts'

const CHECK_IN_RESULT_LABELS: Record<string, string> = {
  SUCCESS: '成功',
  DUPLICATE: '重复',
  FAILED: '失败',
}

const CHECK_IN_RESULT_CLASS_NAMES: Record<string, string> = {
  SUCCESS: 'bg-[#f0fff4] text-[#16a34a]',
  DUPLICATE: 'bg-[#fff7ed] text-[#f97316]',
  FAILED: 'bg-[#fef2f2] text-[#dc2626]',
}

export function formatConsoleCheckInResult(result: string) {
  return CHECK_IN_RESULT_LABELS[result] || '未知结果'
}

export function getConsoleCheckInResultClassName(result: string | null | undefined) {
  if (!result) return 'bg-[#fff7e6] text-[#ad6800]'
  return CHECK_IN_RESULT_CLASS_NAMES[result] || 'bg-[#fff7e6] text-[#ad6800]'
}

export function buildConsoleCheckInExportCsv(records: CheckInRecordVO[]) {
  const rows = records.map(toExportRow)
  return `\ufeff${[header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}`
}

export function buildConsoleCheckInExportExcelHtml(records: CheckInRecordVO[]) {
  const rows = records.map(toExportRow)
  const head = header.map(cell => `<th>${htmlCell(cell)}</th>`).join('')
  const body = rows.map(row => `<tr>${row.map(cell => `<td>${htmlCell(cell)}</td>`).join('')}</tr>`).join('')
  return `\ufeff<html><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
}

export function buildConsoleCheckInExceptionExportCsv(records: CheckInRecordVO[]) {
  return buildConsoleCheckInExportCsv(filterExceptionRecords(records))
}

export function buildConsoleCheckInExceptionExportExcelHtml(records: CheckInRecordVO[]) {
  return buildConsoleCheckInExportExcelHtml(filterExceptionRecords(records))
}

export function getConsoleCheckInExceptionRecords(records: CheckInRecordVO[]) {
  return filterExceptionRecords(records)
}

const header = ['请求号', '票号', '设备', '渠道', '结果', '失败原因', '核验时间']

function filterExceptionRecords(records: CheckInRecordVO[]) {
  return records.filter(record => record.result !== 'SUCCESS')
}

function toExportRow(record: CheckInRecordVO) {
  return [
    record.requestId || '-',
    record.ticketNo || '-',
    record.deviceCode || '-',
    record.channel || '-',
    formatConsoleCheckInResult(record.result),
    record.failureReason || '-',
    record.checkedInAt || record.createTime || '-',
  ]
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
