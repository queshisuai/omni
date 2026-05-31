import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WaitlistNotificationService {
  private readonly logger = new Logger(WaitlistNotificationService.name);
  private readonly baseUrl = process.env.NOTIFICATION_SERVICE_URL || process.env.API_GATEWAY_URL || 'http://localhost:8088';
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;

  async notifyOffered(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({ userId: input.userId, orderId: input.orderId, type: 'WAITLIST_OFFERED', content: input.content });
  }

  async notifyExpired(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({ userId: input.userId, orderId: input.orderId, type: 'WAITLIST_EXPIRED', content: input.content });
  }

  async notifyPaid(input: { userId: number; orderId: number; content: string }): Promise<void> {
    await this.send({ userId: input.userId, orderId: input.orderId, type: 'WAITLIST_PAID', content: input.content });
  }

  private async send(body: { userId: number; orderId: number; type: string; content: string }): Promise<void> {
    if (!this.internalToken) return;
    try {
      const response = await fetch(`${this.baseUrl}/api/notification/internal/messages`, {
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
