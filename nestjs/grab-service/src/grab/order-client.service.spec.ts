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

  it('passes grab authorization and matched ticket metadata to order service', async () => {
    const service = new OrderClientService();

    await service.createOrder({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 2,
      quantity: 1,
      seatIds: [],
      allocateRandom: false,
      authorizedMaxUnitPrice: 980,
      grabRequestId: 'GRAB1',
      requestedTicketTypeId: 1,
      matchedTicketTypeId: 2,
      autoDowngraded: true,
    });

    expect(global.fetch).toHaveBeenCalledWith('http://order.local/api/order/internal/create', expect.objectContaining({
      body: JSON.stringify({
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 2,
        quantity: 1,
        authorizedMaxUnitPrice: 980,
        grabRequestId: 'GRAB1',
        requestedTicketTypeId: 1,
        matchedTicketTypeId: 2,
        autoDowngraded: true,
      }),
    }));
  });

  it('loads an existing order by grab request id through the internal endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: 200,
        data: { id: 9001, orderNo: 'O1', status: 'PENDING', grabRequestId: 'GRAB1' },
      }),
    } as any);
    const service = new OrderClientService();

    const result = await service.findByGrabRequestId('GRAB1');

    expect(global.fetch).toHaveBeenCalledWith('http://order.local/api/order/internal/grab-requests/GRAB1', {
      method: 'GET',
      headers: { 'X-Internal-Token': 'internal-token' },
    });
    expect(result).toEqual({ id: 9001, orderNo: 'O1', status: 'PENDING', grabRequestId: 'GRAB1' });
  });

  it('returns null when the grab request id has no order', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: 200, data: null }),
    } as any);
    const service = new OrderClientService();

    await expect(service.findByGrabRequestId('GRAB-MISSING')).resolves.toBeNull();
  });

  it('fails before calling order service when internal token is missing', async () => {
    delete process.env.INTERNAL_API_TOKEN;
    const service = new OrderClientService();

    await expect(service.createOrder({ userId: 2004, sessionId: 7, ticketTypeId: 21, quantity: 1, seatIds: [], allocateRandom: false }))
      .rejects.toThrow('order internal token is not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
