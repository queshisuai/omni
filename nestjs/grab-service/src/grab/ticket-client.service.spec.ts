import { TicketClientService } from './ticket-client.service';

describe('TicketClientService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, TICKET_SERVICE_URL: 'http://ticket.local', INTERNAL_API_TOKEN: 'internal-token' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: 200,
        data: [{ ticketTypeId: 1, name: 'A', price: 1280, remainStock: 87 }],
      }),
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('loads ticket metadata through the internal ticket endpoint', async () => {
    const service = new TicketClientService();

    const result = await service.listVisibleTicketTypes(101, [1]);

    expect(global.fetch).toHaveBeenCalledWith('http://ticket.local/api/ticket/internal/sales/ticket-types-visible', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
      body: JSON.stringify({ sessionId: 101, ticketTypeIds: [1] }),
    }));
    expect(result).toEqual([{ ticketTypeId: 1, name: 'A', price: 1280, remainStock: 87 }]);
  });

  it('locks team seats through the internal ticket endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: 200,
        data: { lockedSeatIds: [501, 502], seatLabels: ['A-1', 'A-2'], matchedStrategy: 'SAME_BLOCK' },
      }),
    } as any);
    const service = new TicketClientService();

    const result = await service.lockTeamSeats({
      sessionId: 20,
      ticketTypeId: 30,
      quantity: 2,
      strategy: 'SAME_BLOCK',
      fallbacks: ['SAME_TICKET_TYPE'],
      lockRequestId: 'TEAM-GRAB-1',
      lockExpireTime: '2026-05-30T12:15:00.000Z',
    });

    expect(global.fetch).toHaveBeenCalledWith('http://ticket.local/api/ticket/internal/sales/lock-team-seats', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
      body: JSON.stringify({
        sessionId: 20,
        ticketTypeId: 30,
        quantity: 2,
        strategy: 'SAME_BLOCK',
        fallbacks: ['SAME_TICKET_TYPE'],
        lockRequestId: 'TEAM-GRAB-1',
        lockExpireTime: '2026-05-30T12:15:00.000Z',
      }),
    }));
    expect(result).toEqual({ lockedSeatIds: [501, 502], seatLabels: ['A-1', 'A-2'], matchedStrategy: 'SAME_BLOCK' });
  });

  it('releases team seat locks through the internal ticket endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: 200, data: true }),
    } as any);
    const service = new TicketClientService();

    await expect(service.releaseTeamSeatLock('TEAM-GRAB-1', [501, 502])).resolves.toBe(true);

    expect(global.fetch).toHaveBeenCalledWith('http://ticket.local/api/ticket/internal/sales/release-team-seat-lock', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
      body: JSON.stringify({ lockRequestId: 'TEAM-GRAB-1', seatIds: [501, 502] }),
    }));
  });
});
