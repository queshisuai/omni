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

export interface CreateTeamOrderWithLockedSeatsInput {
  teamId: number;
  userId: number;
  payerUserId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seats: Array<{ sessionSeatId: number; seatLabel: string }>;
  teamGrabRequestId: string;
  grabRequestId: string;
  matchedStrategy: string | null;
  authorizedMaxUnitPrice: number;
}

export interface GrabOrderLookupResponse {
  id: number;
  orderNo: string;
  status: string | null;
  grabRequestId: string | null;
}

export interface OrderStatusResponse {
  id: number;
  status: number;
  userId: number;
  quantity: number;
}

export interface OrderSeatResponse {
  orderSeatId: number;
  sessionSeatId: number;
  seatLabel: string | null;
  status: number;
}

@Injectable()
export class OrderClientService {
  private readonly baseUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:8088';
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async createOrder(input: CreateOrderInput): Promise<CreatedOrderResponse> {
    if (!this.internalToken) {
      throw new Error('order internal token is not configured');
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
      throw new Error(result.message || 'order creation failed');
    }
    return result.data;
  }

  async findByGrabRequestId(grabRequestId: string): Promise<GrabOrderLookupResponse | null> {
    if (!this.internalToken) {
      throw new Error('order internal token is not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/order/internal/grab-requests/${encodeURIComponent(grabRequestId)}`, {
      method: 'GET',
      headers: { 'X-Internal-Token': this.internalToken },
    });
    if (response.status === 404) return null;
    const result = await response.json();
    if (!response.ok || (result.code !== 200 && result.code !== 404)) {
      throw new Error(result.message || 'order lookup failed');
    }
    return result.data ?? null;
  }

  async createTeamOrderWithLockedSeats(input: CreateTeamOrderWithLockedSeatsInput): Promise<CreatedOrderResponse> {
    if (!this.internalToken) {
      throw new Error('order internal token is not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/order/internal/team/create-with-locked-seats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
      body: JSON.stringify(input),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || 'team order creation failed');
    }
    return result.data;
  }

  async getOrder(orderId: number): Promise<OrderStatusResponse> {
    if (!this.internalToken) {
      throw new Error('order internal token is not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/order/internal/${orderId}`, {
      method: 'GET',
      headers: { 'X-Internal-Token': this.internalToken },
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || 'order lookup failed');
    }
    return result.data;
  }

  async listOrderSeats(orderId: number): Promise<OrderSeatResponse[]> {
    if (!this.internalToken) {
      throw new Error('order internal token is not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/order/internal/${orderId}/seats`, {
      method: 'GET',
      headers: { 'X-Internal-Token': this.internalToken },
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || 'order seat lookup failed');
    }
    return Array.isArray(result.data) ? result.data : [];
  }
}
