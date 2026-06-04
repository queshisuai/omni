import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { TicketClientService, TicketTypeVisibleInfo } from './ticket-client.service';

@Injectable()
export class GrabStockService {
  constructor(
    private readonly redisService: RedisService,
    private readonly ticketClient: TicketClientService,
  ) {}

  async ensureInitialized(sessionId: number, ticketTypeId: number): Promise<number | null> {
    const current = await this.redisService.get(this.stockKey(sessionId, ticketTypeId));
    if (current != null) return this.parseStock(current);

    const ticket = (await this.ticketClient.listVisibleTicketTypes(sessionId, [ticketTypeId]))
      .find((item) => item.ticketTypeId === ticketTypeId);
    if (!ticket) return null;
    return this.initializeFromTicketInfo(sessionId, ticket);
  }

  async initializeFromTicketInfo(sessionId: number, ticket: TicketTypeVisibleInfo): Promise<number | null> {
    if (ticket.remainStock == null) return null;
    const stock = Math.max(0, Math.floor(ticket.remainStock));
    const key = this.stockKey(sessionId, ticket.ticketTypeId);
    const initialized = await this.redisService.setIfAbsent(key, String(stock));
    if (initialized) return stock;

    const current = await this.redisService.get(key);
    return current == null ? stock : this.parseStock(current);
  }

  private parseStock(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private stockKey(sessionId: number, ticketTypeId: number): string {
    return `grab:stock:${sessionId}:${ticketTypeId}`;
  }
}
