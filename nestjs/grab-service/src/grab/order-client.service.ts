import { Injectable } from '@nestjs/common';

export interface CreateOrderInput {
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  allocateRandom: boolean;
  authorizedMaxUnitPrice?: number | null;
  grabRequestId?: string | null;
  requestedTicketTypeId?: number | null;
  matchedTicketTypeId?: number | null;
  autoDowngraded?: boolean;
}

export interface CreatedOrderResponse {
  id: number;
  orderNo: string;
  amount: number;
}

@Injectable()
export class OrderClientService {
  private readonly baseUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:8088';
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async createOrder(input: CreateOrderInput): Promise<CreatedOrderResponse> {
    if (!this.internalToken) {
      throw new Error('订单内部接口令牌未配置');
    }

    const usesSeatEndpoint = input.seatIds.length > 0 || input.allocateRandom;
    const path = usesSeatEndpoint ? '/api/order/internal/create-with-seats' : '/api/order/internal/create';
    const grabMetadata = {
      authorizedMaxUnitPrice: input.authorizedMaxUnitPrice,
      grabRequestId: input.grabRequestId,
      requestedTicketTypeId: input.requestedTicketTypeId,
      matchedTicketTypeId: input.matchedTicketTypeId,
      autoDowngraded: Boolean(input.autoDowngraded),
    };
    const body = usesSeatEndpoint
      ? {
          userId: input.userId,
          sessionId: input.sessionId,
          ticketTypeId: input.ticketTypeId,
          seatIds: input.seatIds,
          quantity: input.quantity,
          ...grabMetadata,
        }
      : {
          userId: input.userId,
          sessionId: input.sessionId,
          ticketTypeId: input.ticketTypeId,
          quantity: input.quantity,
          ...grabMetadata,
        };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || '订单创建失败');
    }
    return result.data;
  }
}
