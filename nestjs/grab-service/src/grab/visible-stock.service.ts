import { Injectable, Optional } from '@nestjs/common';
import { GrabStockService } from './grab-stock.service';
import { RedisService } from './redis.service';
import { TicketClientService, TicketTypeVisibleInfo } from './ticket-client.service';

export type VisibleStockLevel = 'AVAILABLE' | 'LOW' | 'HOT' | 'SOLD_OUT' | 'UNKNOWN';

export interface SessionVisibleStockResponse {
  sessionId: number;
  ticketTypes: Array<{
    ticketTypeId: number;
    name: string;
    visibleStock: number | null;
    level: VisibleStockLevel;
  }>;
  snapshotTime: string;
}

@Injectable()
export class VisibleStockService {
  constructor(
    private readonly redisService: RedisService,
    private readonly ticketClient: TicketClientService,
    @Optional() private readonly stockService?: GrabStockService,
  ) {}

  async getSessionVisibleStock(sessionId: number, ticketTypeIds: number[]): Promise<SessionVisibleStockResponse> {
    const metadata = await this.ticketClient.listVisibleTicketTypes(sessionId, ticketTypeIds);
    const ticketTypes = [];

    for (const ticket of metadata) {
      const visibleStock = this.stockService
        ? await this.stockService.syncFromTicketInfo(sessionId, ticket)
        : this.toVisibleStock(await this.redisService.get(`grab:stock:${sessionId}:${ticket.ticketTypeId}`), ticket);
      ticketTypes.push({
        ticketTypeId: ticket.ticketTypeId,
        name: ticket.name,
        visibleStock,
        level: this.level(visibleStock),
      });
    }

    return { sessionId, ticketTypes, snapshotTime: new Date().toISOString() };
  }

  private toVisibleStock(redisStock: string | null, ticket: TicketTypeVisibleInfo): number | null {
    if (redisStock != null) {
      const parsed = Number(redisStock);
      if (!Number.isFinite(parsed)) return null;
      return this.capAtTotalStock(Math.max(0, Math.floor(parsed)), ticket);
    }
    if (ticket.remainStock == null) return null;
    return this.capAtTotalStock(Math.max(0, Math.floor(ticket.remainStock)), ticket);
  }

  private capAtTotalStock(stock: number, ticket: TicketTypeVisibleInfo): number {
    if (ticket.totalStock == null) return stock;
    return Math.min(stock, Math.max(0, Math.floor(ticket.totalStock)));
  }

  private level(stock: number | null): VisibleStockLevel {
    if (stock == null || Number.isNaN(stock)) return 'UNKNOWN';
    if (stock <= 0) return 'SOLD_OUT';
    if (stock <= 10) return 'LOW';
    if (stock <= 50) return 'HOT';
    return 'AVAILABLE';
  }
}
