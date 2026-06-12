import { WaitlistNotificationService } from './waitlist-notification.service';

describe('WaitlistNotificationService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NOTIFICATION_SERVICE_URL: 'http://notification.local', INTERNAL_API_TOKEN: 'internal-token' };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('posts waitlist matched notification event with SMS channel reserved', async () => {
    const service = new WaitlistNotificationService();

    await service.notifyOffered({ userId: 2004, orderId: 9001, content: '候补成功，请付款。' });

    expect(fetch).toHaveBeenCalledWith('http://notification.local/api/notification/internal/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
      body: JSON.stringify({
        eventId: 'waitlist-matched:2004:9001',
        eventType: 'WAITLIST_MATCHED',
        aggregateKey: 'WAITLIST_MATCHED:9001',
        userId: 2004,
        orderId: 9001,
        channels: ['IN_APP', 'SMS'],
        content: '候补成功，请付款。',
        actionHref: '/orders/9001',
        actionLabel: '查看订单',
        payload: { source: 'grab-service', phase: 'WAITLIST_OFFERED' },
      }),
    });
  });

  it('posts waitlist expired notification event', async () => {
    const service = new WaitlistNotificationService();

    await service.notifyExpired({ userId: 2004, orderId: 9001, content: '候补订单已超时，请重新候补。' });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(request.body);
    expect(request).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
    });
    expect(global.fetch).toHaveBeenCalledWith('http://notification.local/api/notification/internal/events', request);
    expect(body).toMatchObject({
      eventId: 'order-payment-timeout:2004:9001',
      eventType: 'ORDER_PAYMENT_TIMEOUT',
      aggregateKey: 'ORDER_PAYMENT_TIMEOUT:9001',
      userId: 2004,
      orderId: 9001,
      channels: ['IN_APP', 'SMS'],
      content: '候补订单已超时，请重新候补。',
      actionHref: '/orders/9001',
      actionLabel: '查看订单',
      payload: { source: 'grab-service', phase: 'WAITLIST_EXPIRED' },
    });
  });

  it('fails during initialization when notification service URL is missing', () => {
    delete process.env.NOTIFICATION_SERVICE_URL;
    process.env.API_GATEWAY_URL = 'http://gateway.local';

    expect(() => new WaitlistNotificationService()).toThrow('通知服务地址未配置');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
