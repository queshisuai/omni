import { WaitlistRepository } from './waitlist.repository';

describe('WaitlistRepository', () => {
  const entryRow = (overrides: Record<string, unknown> = {}) => ({
    id: '1',
    user_id: '2004',
    session_id: '101',
    ticket_type_id: '202',
    quantity: 1,
    attendee_ids: JSON.stringify([501]),
    seat_preference: null,
    status: 'WAITING',
    priority_no: '8',
    offer_order_id: null,
    offer_expire_time: null,
    fail_reason: null,
    create_time: new Date('2026-05-31T00:00:00Z'),
    update_time: new Date('2026-05-31T00:00:00Z'),
    ...overrides,
  });

  it('maps waitlist entry rows to camelCase records', () => {
    const repository = new WaitlistRepository({ query: jest.fn() } as any);
    const record = (repository as any).mapEntry(entryRow({ id: '10', quantity: 2, priority_no: '99' }));

    expect(record).toMatchObject({
      id: 10,
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      attendeeIds: [501],
      status: 'WAITING',
      priorityNo: 99,
    });
  });

  it('creates a waiting entry and computes rank', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [entryRow()] })
      .mockResolvedValueOnce({ rows: [{ rank: '3' }] });
    const repository = new WaitlistRepository({ query } as any);

    const result = await repository.createEntry({ userId: 2004, sessionId: 101, ticketTypeId: 202, quantity: 1, attendeeIds: [501] });

    expect(result.entry.id).toBe(1);
    expect(result.entry.attendeeIds).toEqual([501]);
    expect(result.rank).toBe(3);
    expect(query.mock.calls[0][0]).toContain('insert into waitlist_entry');
    expect(query.mock.calls[0][1]).toContain(JSON.stringify([501]));
  });

  it('claims the earliest eligible waiting entry with row locking', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [entryRow({ id: '2', user_id: '2005', status: 'ALLOCATING', priority_no: '9' })],
    });
    const repository = new WaitlistRepository({ query } as any);

    const result = await repository.claimNextEntry({ sessionId: 101, ticketTypeId: 202, releasedQuantity: 1 });

    expect(result?.status).toBe('ALLOCATING');
    expect(query.mock.calls[0][0]).toContain('for update skip locked');
  });
});
