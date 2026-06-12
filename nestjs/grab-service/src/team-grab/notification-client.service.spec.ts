import { NotificationClientService } from './notification-client.service';

describe('NotificationClientService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NOTIFICATION_SERVICE_URL: 'http://notify.local', INTERNAL_API_TOKEN: 'internal-token' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: 200, data: true }),
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('sends grab success notification events with SMS channel reserved', async () => {
    const service = new NotificationClientService();

    await service.sendLocked(200, 9001);

    expect(global.fetch).toHaveBeenCalledWith('http://notify.local/api/notification/internal/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
      body: JSON.stringify({
        eventId: 'grab-success:200:9001:locked',
        eventType: 'GRAB_SUCCESS',
        aggregateKey: 'GRAB_SUCCESS:9001:LOCKED',
        userId: 200,
        orderId: 9001,
        channels: ['IN_APP', 'SMS'],
        content: '小队座位已锁定，请队长尽快支付。',
        actionHref: '/orders/9001',
        actionLabel: '查看订单',
        payload: { source: 'grab-service', phase: 'TEAM_LOCKED' },
      }),
    });
  });

  it('sends grab failed notification events', async () => {
    const service = new NotificationClientService();

    await service.sendFailed(200, null);

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      eventId: 'grab-failed:200:none',
      eventType: 'GRAB_FAILED',
      aggregateKey: 'GRAB_FAILED:200:none',
      userId: 200,
      orderId: null,
      channels: ['IN_APP', 'SMS'],
      content: '小队抢票失败，请重新尝试。',
      payload: { source: 'grab-service', phase: 'TEAM_FAILED' },
    });
  });

  it('fails before calling notification service when internal token is missing', async () => {
    delete process.env.INTERNAL_API_TOKEN;
    const service = new NotificationClientService();

    await expect(service.sendExpired(200, 9001)).rejects.toThrow('通知内部接口令牌未配置');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails during initialization when notification service URL is missing', () => {
    delete process.env.NOTIFICATION_SERVICE_URL;
    process.env.ORDER_SERVICE_URL = 'http://order.local';

    expect(() => new NotificationClientService()).toThrow('通知服务地址未配置');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
