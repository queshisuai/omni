import { Injectable } from '@nestjs/common';

export interface TicketTypeVisibleInfo {
  ticketTypeId: number;
  name: string;
  price: number;
  remainStock: number | null;
}

@Injectable()
export class TicketClientService {
  private readonly baseUrl = process.env.TICKET_SERVICE_URL || process.env.ORDER_SERVICE_URL || 'http://localhost:8088';
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async listVisibleTicketTypes(sessionId: number, ticketTypeIds: number[]): Promise<TicketTypeVisibleInfo[]> {
    if (!this.internalToken) throw new Error('ticket internal token is not configured');
    const response = await fetch(`${this.baseUrl}/api/ticket/internal/sales/ticket-types-visible`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
      body: JSON.stringify({ sessionId, ticketTypeIds }),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || 'ticket service unavailable');
    }
    return Array.isArray(result.data) ? result.data : [];
  }
}
