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
    const stock = this.toBackendVisibleStock(ticket);
    if (stock == null) return null;
    const key = this.stockKey(sessionId, ticket.ticketTypeId);
    const initialized = await this.redisService.setIfAbsent(key, String(stock));
    if (initialized) return stock;

    const initializedByOtherRequest = await this.redisService.get(key);
    return initializedByOtherRequest == null ? stock : this.parseStock(initializedByOtherRequest);
  }

  async syncFromTicketType(sessionId: number, ticketTypeId: number): Promise<number | null> {
    const ticket = (await this.ticketClient.listVisibleTicketTypes(sessionId, [ticketTypeId]))
      .find((item) => item.ticketTypeId === ticketTypeId);
    if (!ticket) return null;
    return this.syncFromTicketInfo(sessionId, ticket);
  }

  async syncFromTicketInfo(sessionId: number, ticket: TicketTypeVisibleInfo): Promise<number | null> {
    const stock = this.toBackendVisibleStock(ticket);
    if (stock == null) return null;
    const key = this.stockKey(sessionId, ticket.ticketTypeId);
    const current = await this.redisService.get(key);
    if (current != null) {
      const currentStock = this.parseStock(current);
      if (currentStock == null) {
        await this.redisService.set(key, String(stock));
        return stock;
      }
      if (currentStock === stock) return stock;

      const hasActiveHold = await this.redisService.existsByPattern(this.userHoldPattern(sessionId, ticket.ticketTypeId));
      if (!hasActiveHold || currentStock > stock) {
        await this.redisService.set(key, String(stock));
        return stock;
      }
      return currentStock;
    }

    return this.initializeFromTicketInfo(sessionId, ticket);
  }

  private toBackendVisibleStock(ticket: TicketTypeVisibleInfo): number | null {
    if (ticket.remainStock == null) return null;
    const remainStock = Math.max(0, Math.floor(ticket.remainStock));
    if (ticket.totalStock == null) return remainStock;
    return Math.min(remainStock, Math.max(0, Math.floor(ticket.totalStock)));
  }

  private parseStock(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private stockKey(sessionId: number, ticketTypeId: number): string {
    return `grab:stock:${sessionId}:${ticketTypeId}`;
  }

  private userHoldPattern(sessionId: number, ticketTypeId: number): string {
    return `grab:user-hold:*:${sessionId}:${ticketTypeId}`;
  }
}
