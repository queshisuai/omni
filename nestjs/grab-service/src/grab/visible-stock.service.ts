import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { TicketClientService } from './ticket-client.service';

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
  ) {}

  async getSessionVisibleStock(sessionId: number, ticketTypeIds: number[]): Promise<SessionVisibleStockResponse> {
    const metadata = await this.ticketClient.listVisibleTicketTypes(sessionId, ticketTypeIds);
    const ticketTypes = [];

    for (const ticket of metadata) {
      const redisStock = await this.redisService.get(`grab:stock:${sessionId}:${ticket.ticketTypeId}`);
      const visibleStock = this.toVisibleStock(redisStock, ticket.remainStock);
      ticketTypes.push({
        ticketTypeId: ticket.ticketTypeId,
        name: ticket.name,
        visibleStock,
        level: this.level(visibleStock),
      });
    }

    return { sessionId, ticketTypes, snapshotTime: new Date().toISOString() };
  }

  private toVisibleStock(redisStock: string | null, remainStock: number | null): number | null {
    if (redisStock != null) {
      const parsed = Number(redisStock);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return remainStock == null ? null : remainStock;
  }

  private level(stock: number | null): VisibleStockLevel {
    if (stock == null || Number.isNaN(stock)) return 'UNKNOWN';
    if (stock <= 0) return 'SOLD_OUT';
    if (stock <= 10) return 'LOW';
    if (stock <= 50) return 'HOT';
    return 'AVAILABLE';
  }
}
