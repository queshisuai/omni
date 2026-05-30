import { Injectable } from '@nestjs/common';

export interface NotificationMessageInput {
  userId: number;
  orderId: number | null;
  type: string;
  content: string;
}

@Injectable()
export class NotificationClientService {
  private readonly baseUrl = process.env.NOTIFICATION_SERVICE_URL || process.env.ORDER_SERVICE_URL || 'http://localhost:8088';
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async sendMessage(input: NotificationMessageInput): Promise<void> {
    if (!this.internalToken) throw new Error('notification internal token is not configured');

    const response = await fetch(`${this.baseUrl}/api/notification/internal/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
      body: JSON.stringify(input),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || 'notification failed');
    }
  }

  async sendLocked(userId: number, orderId: number | null): Promise<void> {
    await this.sendMessage({
      userId,
      orderId,
      type: 'TEAM_LOCKED',
      content: 'Team seats locked, leader payment pending',
    });
  }

  async sendPaid(userId: number, orderId: number): Promise<void> {
    await this.sendMessage({
      userId,
      orderId,
      type: 'TEAM_PAID',
      content: 'Team tickets issued',
    });
  }

  async sendFailed(userId: number, orderId: number | null): Promise<void> {
    await this.sendMessage({
      userId,
      orderId,
      type: 'TEAM_FAILED',
      content: 'Team grab failed',
    });
  }

  async sendExpired(userId: number, orderId: number | null): Promise<void> {
    await this.sendMessage({
      userId,
      orderId,
      type: 'TEAM_EXPIRED',
      content: 'Team order expired',
    });
  }
}
