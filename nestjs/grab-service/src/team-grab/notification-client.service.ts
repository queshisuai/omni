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
    if (!this.internalToken) throw new Error('通知内部接口令牌未配置');

    const response = await fetch(`${this.baseUrl}/api/notification/internal/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
      body: JSON.stringify(input),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || '通知发送失败');
    }
  }

  async sendLocked(userId: number, orderId: number | null): Promise<void> {
    await this.sendMessage({
      userId,
      orderId,
      type: 'TEAM_LOCKED',
      content: '小队座位已锁定，请队长尽快支付。',
    });
  }

  async sendPaid(userId: number, orderId: number): Promise<void> {
    await this.sendMessage({
      userId,
      orderId,
      type: 'TEAM_PAID',
      content: '小队订单已支付成功。',
    });
  }

  async sendFailed(userId: number, orderId: number | null): Promise<void> {
    await this.sendMessage({
      userId,
      orderId,
      type: 'TEAM_FAILED',
      content: '小队抢票失败，请重新尝试。',
    });
  }

  async sendExpired(userId: number, orderId: number | null): Promise<void> {
    await this.sendMessage({
      userId,
      orderId,
      type: 'TEAM_EXPIRED',
      content: '小队订单已过期。',
    });
  }
}
