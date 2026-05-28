import { Injectable } from '@nestjs/common';

export interface CreateOrderInput {
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  allocateRandom: boolean;
}

export interface CreatedOrderResponse {
  id: number;
  orderNo: string;
  amount: number;
}

@Injectable()
export class OrderClientService {
  private readonly baseUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:8088';

  async createOrder(input: CreateOrderInput): Promise<CreatedOrderResponse> {
    const usesSeatEndpoint = input.seatIds.length > 0 || input.allocateRandom;
    const path = usesSeatEndpoint ? '/api/order/create-with-seats' : '/api/order/create';
    const body = usesSeatEndpoint
      ? {
          userId: input.userId,
          sessionId: input.sessionId,
          ticketTypeId: input.ticketTypeId,
          seatIds: input.seatIds,
          quantity: input.quantity,
        }
      : {
          userId: input.userId,
          sessionId: input.sessionId,
          ticketTypeId: input.ticketTypeId,
          quantity: input.quantity,
        };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || '订单创建失败');
    }
    return result.data;
  }
}
