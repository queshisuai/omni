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
});
