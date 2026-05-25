import type { ActiveSeatKey, SeatCraftSeat } from './types'

export function isSeatKeyMatch(key: ActiveSeatKey | null, seat: SeatCraftSeat) {
  if (!key) return false
  return key.blockKey === seat.sectionKey && key.rowNo === seat.row + 1 && key.seatNo === seat.col + 1
}

export function seatEditDisabledReason(seat: SeatCraftSeat | null) {
  if (!seat) return '未选中座位'
  if (seat.status === 'occupied') return '不可移动已占用座位'
  if (seat.status === 'deleted') return '请先恢复座位后再编辑坐标'
  if (seat.baseX == null || seat.baseY == null) return '无法计算座位偏移'
  return null
}

export function canEditSeatPosition(seat: SeatCraftSeat | null) {
  return seatEditDisabledReason(seat) == null
}
