import type { TicketTypeEntity } from '@/types/api'

type SeatAllocationTicket = Pick<TicketTypeEntity, 'seatBlockId' | 'ticketGroupKey'> | null | undefined

export function isSeatBoundTicket(ticket: SeatAllocationTicket) {
  return Boolean(ticket && (ticket.seatBlockId != null || ticket.ticketGroupKey))
}

export function buildSeatAllocationPayload(input: {
  ticket: SeatAllocationTicket
  seatSelectionVisible: boolean
  selectedSeatIds: number[]
}) {
  const seatIds = input.seatSelectionVisible ? input.selectedSeatIds : []
  return {
    seatIds,
    allocateRandom: isSeatBoundTicket(input.ticket) && seatIds.length === 0,
  }
}
