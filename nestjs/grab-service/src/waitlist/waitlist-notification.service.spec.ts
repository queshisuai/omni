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

  it('posts waitlist offer notification to notification-service internal API', async () => {
    const service = new WaitlistNotificationService();

    await service.notifyOffered({ userId: 2004, orderId: 9001, content: '候补成功，请付款。' });

    expect(fetch).toHaveBeenCalledWith('http://notification.local/api/notification/internal/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-Internal-Token': 'internal-token' }),
    }));
  });
});
