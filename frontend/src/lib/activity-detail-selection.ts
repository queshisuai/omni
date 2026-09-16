import type { SessionDetail, TicketTypeEntity } from '@/types/api'

export interface InitialPurchaseSelection {
  session: SessionDetail | null
  ticket: TicketTypeEntity | null
}

export function resolveInitialPurchaseSelection(
  sessions: SessionDetail[],
  sessionId: string | null | undefined,
  ticketTypeId: string | null | undefined,
): InitialPurchaseSelection {
  const session = sessions.find(item => sessionId && String(item.session.id) === sessionId) ?? sessions[0] ?? null
  if (!session) return { session: null, ticket: null }

  const ticket = session.ticketTypes.find(item => ticketTypeId && String(item.id) === ticketTypeId)
    ?? session.ticketTypes[0]
    ?? null

  return { session, ticket }
}
