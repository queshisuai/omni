import { OrderClientService } from './order-client.service';

describe('OrderClientService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ORDER_SERVICE_URL: 'http://order.local', INTERNAL_API_TOKEN: 'internal-token' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: 200, data: { id: 14, orderNo: 'DM1', amount: 160 } }),
    } as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('creates normal orders through internal endpoint with token', async () => {
    const service = new OrderClientService();

    await service.createOrder({ userId: 2004, sessionId: 7, ticketTypeId: 21, quantity: 1, seatIds: [], allocateRandom: false });

    expect(global.fetch).toHaveBeenCalledWith('http://order.local/api/order/internal/create', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
    }));
  });

  it('creates seat orders through internal endpoint with token', async () => {
    const service = new OrderClientService();

    await service.createOrder({ userId: 2004, sessionId: 7, ticketTypeId: 21, quantity: 1, seatIds: [301], allocateRandom: false });

    expect(global.fetch).toHaveBeenCalledWith('http://order.local/api/order/internal/create-with-seats', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
    }));
  });

  it('fails before calling order service when internal token is missing', async () => {
    delete process.env.INTERNAL_API_TOKEN;
    const service = new OrderClientService();

    await expect(service.createOrder({ userId: 2004, sessionId: 7, ticketTypeId: 21, quantity: 1, seatIds: [], allocateRandom: false }))
      .rejects.toThrow('订单内部接口令牌未配置');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
