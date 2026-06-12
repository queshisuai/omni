import { Injectable, Logger } from '@nestjs/common';
import { requireEnv } from '../runtime-env';

interface WaitlistNotificationEvent {
  eventId: string;
  eventType: string;
  aggregateKey: string;
  userId: number;
  orderId: number;
  channels: string[];
  content: string;
  actionHref: string;
  actionLabel: string;
  payload: Record<string, string>;
}

@Injectable()
export class WaitlistNotificationService {
  private readonly logger = new Logger(WaitlistNotificationService.name);
  private readonly baseUrl = requireEnv('NOTIFICATION_SERVICE_URL', '通知服务地址未配置');
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async notifyOffered(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({
      eventId: `waitlist-matched:${input.userId}:${input.orderId}`,
      eventType: 'WAITLIST_MATCHED',
      aggregateKey: `WAITLIST_MATCHED:${input.orderId}`,
      userId: input.userId,
      orderId: input.orderId,
      channels: ['IN_APP', 'SMS'],
      content: input.content,
      actionHref: `/orders/${input.orderId}`,
      actionLabel: '查看订单',
      payload: { source: 'grab-service', phase: 'WAITLIST_OFFERED' },
    });
  }

  async notifyExpired(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({
      eventId: `order-payment-timeout:${input.userId}:${input.orderId}`,
      eventType: 'ORDER_PAYMENT_TIMEOUT',
      aggregateKey: `ORDER_PAYMENT_TIMEOUT:${input.orderId}`,
      userId: input.userId,
      orderId: input.orderId,
      channels: ['IN_APP', 'SMS'],
      content: input.content,
      actionHref: `/orders/${input.orderId}`,
      actionLabel: '查看订单',
      payload: { source: 'grab-service', phase: 'WAITLIST_EXPIRED' },
    });
  }

  async notifyPaid(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({
      eventId: `waitlist-matched:${input.userId}:${input.orderId}:paid`,
      eventType: 'WAITLIST_MATCHED',
      aggregateKey: `WAITLIST_MATCHED:${input.orderId}:PAID`,
      userId: input.userId,
      orderId: input.orderId,
      channels: ['IN_APP', 'SMS'],
      content: input.content,
      actionHref: `/orders/${input.orderId}`,
      actionLabel: '查看订单',
      payload: { source: 'grab-service', phase: 'WAITLIST_PAID' },
    });
  }

  private async send(body: WaitlistNotificationEvent): Promise<void> {
    if (!this.internalToken) return;
    try {
      const response = await fetch(`${this.baseUrl}/api/notification/internal/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
        body: JSON.stringify(body),
      });
      if (!response.ok) this.logger.warn(`候补通知发送失败：${response.status}`);
    } catch (error) {
      this.logger.warn(`候补通知发送失败：${(error as Error).message}`);
    }
  }
}
