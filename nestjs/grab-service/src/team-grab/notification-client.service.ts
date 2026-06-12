import { Injectable } from '@nestjs/common';
import { requireEnv } from '../runtime-env';

export interface NotificationMessageInput {
  userId: number;
  orderId: number | null;
  eventId: string;
  eventType: string;
  aggregateKey: string;
  channels: string[];
  content: string;
  actionHref?: string;
  actionLabel?: string;
  payload: Record<string, string>;
}

@Injectable()
export class NotificationClientService {
  private readonly baseUrl = requireEnv('NOTIFICATION_SERVICE_URL', '通知服务地址未配置');
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async sendEvent(input: NotificationMessageInput): Promise<void> {
    if (!this.internalToken) throw new Error('通知内部接口令牌未配置');

    const response = await fetch(`${this.baseUrl}/api/notification/internal/events`, {
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
    const orderKey = this.orderKey(orderId);
    await this.sendEvent({
      eventId: `grab-success:${userId}:${orderKey}:locked`,
      eventType: 'GRAB_SUCCESS',
      aggregateKey: `GRAB_SUCCESS:${orderKey}:LOCKED`,
      userId,
      orderId,
      channels: ['IN_APP', 'SMS'],
      content: '小队座位已锁定，请队长尽快支付。',
      actionHref: this.orderHref(orderId),
      actionLabel: this.orderLabel(orderId),
      payload: { source: 'grab-service', phase: 'TEAM_LOCKED' },
    });
  }

  async sendPaid(userId: number, orderId: number): Promise<void> {
    await this.sendEvent({
      eventId: `grab-success:${userId}:${orderId}:paid`,
      eventType: 'GRAB_SUCCESS',
      aggregateKey: `GRAB_SUCCESS:${orderId}:PAID`,
      userId,
      orderId,
      channels: ['IN_APP', 'SMS'],
      content: '小队订单已支付成功。',
      actionHref: `/orders/${orderId}`,
      actionLabel: '查看订单',
      payload: { source: 'grab-service', phase: 'TEAM_PAID' },
    });
  }

  async sendFailed(userId: number, orderId: number | null): Promise<void> {
    const orderKey = this.orderKey(orderId);
    await this.sendEvent({
      eventId: `grab-failed:${userId}:${orderKey}`,
      eventType: 'GRAB_FAILED',
      aggregateKey: `GRAB_FAILED:${userId}:${orderKey}`,
      userId,
      orderId,
      channels: ['IN_APP', 'SMS'],
      content: '小队抢票失败，请重新尝试。',
      actionHref: this.orderHref(orderId),
      actionLabel: this.orderLabel(orderId),
      payload: { source: 'grab-service', phase: 'TEAM_FAILED' },
    });
  }

  async sendExpired(userId: number, orderId: number | null): Promise<void> {
    const orderKey = this.orderKey(orderId);
    await this.sendEvent({
      eventId: `order-payment-timeout:${userId}:${orderKey}`,
      eventType: 'ORDER_PAYMENT_TIMEOUT',
      aggregateKey: orderId ? `ORDER_PAYMENT_TIMEOUT:${orderId}` : `ORDER_PAYMENT_TIMEOUT:${userId}:none`,
      userId,
      orderId,
      channels: ['IN_APP', 'SMS'],
      content: '小队订单已过期。',
      actionHref: this.orderHref(orderId),
      actionLabel: this.orderLabel(orderId),
      payload: { source: 'grab-service', phase: 'TEAM_EXPIRED' },
    });
  }

  private orderKey(orderId: number | null): string {
    return orderId == null ? 'none' : String(orderId);
  }

  private orderHref(orderId: number | null): string | undefined {
    return orderId == null ? undefined : `/orders/${orderId}`;
  }

  private orderLabel(orderId: number | null): string | undefined {
    return orderId == null ? undefined : '查看订单';
  }
}
