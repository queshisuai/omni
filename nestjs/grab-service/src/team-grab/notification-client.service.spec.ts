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

  it('sends internal notification messages with the internal token', async () => {
    const service = new NotificationClientService();

    await service.sendPaid(200, 9001);

    expect(global.fetch).toHaveBeenCalledWith('http://notify.local/api/notification/internal/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
      body: JSON.stringify({
        userId: 200,
        orderId: 9001,
        type: 'TEAM_PAID',
        content: '小队订单已支付成功。',
      }),
    });
  });

  it('fails before calling notification service when internal token is missing', async () => {
    delete process.env.INTERNAL_API_TOKEN;
    const service = new NotificationClientService();

    await expect(service.sendExpired(200, 9001)).rejects.toThrow('通知内部接口令牌未配置');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
