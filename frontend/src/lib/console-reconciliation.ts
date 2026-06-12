import {
  formatReconciliationBusinessType,
  formatReconciliationDetailStatus,
  formatReconciliationDifferenceStatus,
  formatReconciliationDiffType,
  formatReconciliationSource,
} from './operation-display.ts'
import type { ReconciliationBatchDetailVO } from '../types/api.ts'

const RECONCILIATION_EXPORT_HEADER = ['记录类型', '批次号', '业务日期', '来源', '业务号', '业务类型或差异类型', '应收或应退', '实收或实退', '差异金额', '状态', '原因', '生成时间']

export function buildConsoleReconciliationExportCsv(detail: ReconciliationBatchDetailVO) {
  const rows = buildConsoleReconciliationExportRows(detail)
  return `\ufeff${[RECONCILIATION_EXPORT_HEADER, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}`
}

export function buildConsoleReconciliationExportExcelHtml(detail: ReconciliationBatchDetailVO) {
  const rows = buildConsoleReconciliationExportRows(detail)
  const head = RECONCILIATION_EXPORT_HEADER.map(cell => `<th>${htmlCell(cell)}</th>`).join('')
  const body = rows.map(row => `<tr>${row.map(cell => `<td>${htmlCell(cell)}</td>`).join('')}</tr>`).join('')
  return `\ufeff<html><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
}

function buildConsoleReconciliationExportRows(detail: ReconciliationBatchDetailVO) {
  const sourceLabel = formatReconciliationSource(detail.batch.sourceType)
  return [
    ...detail.details.map(item => [
      '明细',
      detail.batch.batchNo,
      detail.batch.bizDate,
      sourceLabel,
      item.businessNo || '-',
      formatReconciliationBusinessType(item.businessType),
      formatAmount(item.expectedAmount),
      formatAmount(item.actualAmount),
      '-',
      formatReconciliationDetailStatus(item.status),
      '-',
      item.createTime || '-',
    ]),
    ...detail.differences.map(item => [
      '差异',
      detail.batch.batchNo,
      detail.batch.bizDate,
      sourceLabel,
      item.businessNo || '-',
      formatReconciliationDiffType(item.diffType),
      formatAmount(item.expectedAmount),
      formatAmount(item.actualAmount),
      formatAmount(item.diffAmount),
      formatReconciliationDifferenceStatus(item.status),
      item.reason || '-',
      item.createTime || '-',
    ]),
  ]
}

function formatAmount(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '-'
  const amount = Number(value)
  if (Number.isNaN(amount)) return String(value)
  return amount.toFixed(2)
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
