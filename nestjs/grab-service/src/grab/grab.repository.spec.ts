import { GrabRepository } from './grab.repository';
import { GRAB_STATUS } from './grab-status';


describe('GrabRepository', () => {
  it('inserts pending requests with generated timestamps', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        id: '1',
        request_id: 'GRAB202605270001',
        idempotency_key: 'idem-1',
        user_id: '2004',
        session_id: '101',
        ticket_type_id: '202',
        quantity: 2,
        seat_ids: [301, 302],
        allocate_random: false,
        status: 'PENDING',
        order_id: null,
        fail_reason: null,
        expire_time: new Date('2026-05-27T12:15:00.000Z'),
        created_at: new Date('2026-05-27T12:00:00.000Z'),
        updated_at: new Date('2026-05-27T12:00:00.000Z'),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.createPending({
      requestId: 'GRAB202605270001',
      idempotencyKey: 'idem-1',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [301, 302],
      allocateRandom: false,
      expireTime: new Date('2026-05-27T12:15:00.000Z'),
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('insert into grab_request'), [
      'GRAB202605270001',
      'idem-1',
      2004,
      101,
      202,
      2,
      JSON.stringify([301, 302]),
      false,
      GRAB_STATUS.PENDING,
      new Date('2026-05-27T12:15:00.000Z'),
    ]);
    expect(result.requestId).toBe('GRAB202605270001');
    expect(result.userId).toBe(2004);
    expect(result.seatIds).toEqual([301, 302]);
    expect(result.status).toBe(GRAB_STATUS.PENDING);
  });

  it('finds active request by normalized grab intent', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        id: 1,
        request_id: 'GRAB1',
        idempotency_key: 'idem-1',
        user_id: 2004,
        session_id: 101,
        ticket_type_id: 202,
        quantity: 2,
        seat_ids: '[301,302]',
        allocate_random: false,
        status: GRAB_STATUS.ORDER_CREATED,
        order_id: 9001,
        fail_reason: null,
        expire_time: new Date('2026-05-27T12:15:00.000Z'),
        created_at: new Date('2026-05-27T12:00:00.000Z'),
        updated_at: new Date('2026-05-27T12:01:00.000Z'),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.findActiveByIntent({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [302, 301],
      allocateRandom: false,
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('status = any'), [
      2004,
      101,
      202,
      2,
      JSON.stringify([301, 302]),
      false,
      [GRAB_STATUS.PENDING, GRAB_STATUS.ACCEPTED, GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.ORDER_CREATED],
    ]);
    expect(result?.requestId).toBe('GRAB1');
    expect(result?.orderId).toBe(9001);
  });
});
