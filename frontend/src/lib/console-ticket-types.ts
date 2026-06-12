import type { TicketTypeEntity } from '@/types/api'

export type BatchTicketImportRow = {
  sessionId: number
  name: string
  price: number
  totalStock: number
}

function isKnownTicketTypeStatus(status: number) {
  return status === 0 || status === 1
}

export function isBatchTicketPriceUpdateCandidate(ticket: Pick<TicketTypeEntity, 'status'>) {
  return isKnownTicketTypeStatus(ticket.status)
}

export function isBatchTicketStatusUpdateCandidate(ticket: Pick<TicketTypeEntity, 'status'>) {
  return isKnownTicketTypeStatus(ticket.status)
}

export function getBatchTicketPriceUpdateCandidates(ticketTypes: TicketTypeEntity[]) {
  return ticketTypes.filter(isBatchTicketPriceUpdateCandidate)
}

export function getBatchTicketPriceUpdateTargets(ticketTypes: TicketTypeEntity[], selectedIds: Set<number> | number[]) {
  const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  return getBatchTicketPriceUpdateCandidates(ticketTypes).filter(ticket => selectedSet.has(ticket.id))
}

export function getBatchTicketStatusUpdateTargets(ticketTypes: TicketTypeEntity[], selectedIds: Set<number> | number[], targetStatus: number) {
  if (!isKnownTicketTypeStatus(targetStatus)) return []
  const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  return ticketTypes.filter(ticket => selectedSet.has(ticket.id) && isBatchTicketStatusUpdateCandidate(ticket) && ticket.status !== targetStatus)
}

export function getTicketTypeSoldStock(ticket: Pick<TicketTypeEntity, 'totalStock' | 'remainStock'>) {
  return Math.max(0, ticket.totalStock - ticket.remainStock)
}

export function getBatchTicketStockUpdateTargets(ticketTypes: TicketTypeEntity[], selectedIds: Set<number> | number[]) {
  const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  return ticketTypes.filter(ticket => selectedSet.has(ticket.id) && isBatchTicketStatusUpdateCandidate(ticket))
}

export function getBatchTicketStockUpdateBlockedTargets(ticketTypes: TicketTypeEntity[], selectedIds: Set<number> | number[], targetTotalStock: number) {
  if (!Number.isInteger(targetTotalStock) || targetTotalStock < 0) return getBatchTicketStockUpdateTargets(ticketTypes, selectedIds)
  return getBatchTicketStockUpdateTargets(ticketTypes, selectedIds).filter(ticket => targetTotalStock < getTicketTypeSoldStock(ticket))
}

export function parseBatchTicketPriceInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return { price: null, error: '目标票价不能为空' }

  const price = Number(trimmed)
  if (!Number.isFinite(price)) return { price: null, error: '目标票价必须是数字' }
  if (price <= 0) return { price: null, error: '目标票价必须大于 0' }

  return { price: Number(price.toFixed(2)), error: '' }
}

export function parseBatchTicketStockInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return { totalStock: null, error: '目标总库存不能为空' }

  const totalStock = Number(trimmed)
  if (!Number.isFinite(totalStock)) return { totalStock: null, error: '目标总库存必须是数字' }
  if (!Number.isInteger(totalStock)) return { totalStock: null, error: '目标总库存必须是整数' }
  if (totalStock < 0) return { totalStock: null, error: '目标总库存不能小于 0' }

  return { totalStock, error: '' }
}

export function parseBatchTicketImportInput(value: string) {
  const rows: BatchTicketImportRow[] = []
  const errors: string[] = []
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

  if (lines.length === 0) {
    return { rows, errors: ['批量导入票档内容不能为空'] }
  }

  let dataLineNo = 0
  for (const [index, line] of lines.entries()) {
    const cells = line.split(/\t|,|，/).map(cell => cell.trim())
    const isHeader = index === 0 && cells.some(cell => ['场次编号', '票档名称', '票价', '总库存'].includes(cell))
    if (isHeader) continue

    dataLineNo += 1
    if (cells.length !== 4) {
      errors.push(`第 ${dataLineNo} 行：请按“场次编号,票档名称,票价,总库存”填写`)
      continue
    }

    const [sessionIdText, name, priceText, totalStockText] = cells
    const sessionId = Number(sessionIdText)
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      errors.push(`第 ${dataLineNo} 行：场次编号必须是正整数`)
      continue
    }
    if (!name) {
      errors.push(`第 ${dataLineNo} 行：票档名称不能为空`)
      continue
    }

    const price = Number(priceText)
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`第 ${dataLineNo} 行：票价必须大于 0`)
      continue
    }

    const totalStock = Number(totalStockText)
    if (!Number.isInteger(totalStock) || totalStock < 0) {
      errors.push(`第 ${dataLineNo} 行：总库存必须是非负整数`)
      continue
    }

    rows.push({
      sessionId,
      name,
      price: Number(price.toFixed(2)),
      totalStock,
    })
  }

  return { rows, errors }
}

export function formatConsoleTicketTypeStatus(status: number) {
  if (status === 1) return '启用'
  if (status === 0) return '停用'
  return '未知票档状态'
}
