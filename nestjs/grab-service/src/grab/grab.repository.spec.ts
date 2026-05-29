import { GrabRepository } from './grab.repository';
import { GRAB_STATUS } from './grab-status';


describe('GrabRepository', () => {
  const baseRow = {
    id: '1',
    request_id: 'GRAB202605270001',
    idempotency_key: 'idem-1',
    user_id: '2004',
    session_id: '101',
    ticket_type_id: '202',
    quantity: 2,
    seat_ids: [301, 302],
    allocate_random: false,
    status: GRAB_STATUS.QUEUED,
    progress_status: GRAB_STATUS.QUEUED,
    progress_message: '你前面还有 2 人',
    order_id: null,
    fail_reason: null,
    request_type: 'NORMAL_GRAB',
    queue_seq: '3',
    requested_ticket_types: JSON.stringify([
      { ticketTypeId: 202, name: 'VIP', maxPrice: 880 },
      { ticketTypeId: 203, name: 'A区', maxPrice: 680 },
    ]),
    allow_auto_downgrade: true,
    current_ticket_type_id: '202',
    current_attempt_index: 0,
    matched_ticket_type_id: null,
    attempts_snapshot: JSON.stringify([
      { ticketTypeId: 202, name: 'VIP', status: 'PENDING', message: '待尝试' },
      { ticketTypeId: 203, name: 'A区', status: 'PENDING', message: '待尝试' },
    ]),
    worker_id: null,
    worker_claimed_at: null,
    processing_started_at: null,
    completed_at: null,
    expire_time: new Date('2026-05-27T12:15:00.000Z'),
    created_at: new Date('2026-05-27T12:00:00.000Z'),
    updated_at: new Date('2026-05-27T12:00:00.000Z'),
  };

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

  it('inserts queued requests with persisted progress and ticket preferences', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [baseRow] });
    const repository = new GrabRepository({ query } as any);
    const preferences = [
      { ticketTypeId: 202, name: 'VIP', maxPrice: 880 },
      { ticketTypeId: 203, name: 'A区', maxPrice: 680 },
    ];

    const result = await repository.createQueued({
      requestId: 'GRAB202605270001',
      idempotencyKey: 'idem-1',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [302, 301],
      allocateRandom: false,
      expireTime: new Date('2026-05-27T12:15:00.000Z'),
      queueSeq: 3,
      requestedTicketTypes: preferences,
      allowAutoDowngrade: true,
    });

    const [, params] = query.mock.calls[0];
    expect(params).toContain(GRAB_STATUS.QUEUED);
    expect(params).toContain(3);
    expect(params).toContain(JSON.stringify(preferences));
    expect(params).toContain(true);
    expect(result.progressStatus).toBe(GRAB_STATUS.QUEUED);
    expect(result.queueSeq).toBe(3);
    expect(result.requestedTicketTypes).toEqual(preferences);
  });

  it('updates persisted progress fields', async () => {
    const attempts = [
      { ticketTypeId: 202, name: 'VIP', status: 'TRYING' as const, message: '尝试中' },
      { ticketTypeId: 203, name: 'A区', status: 'PENDING' as const, message: '待尝试' },
    ];
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...baseRow,
        status: GRAB_STATUS.WAITING,
        progress_status: GRAB_STATUS.WAITING,
        progress_message: '正在尝试 VIP',
        current_ticket_type_id: '202',
        current_attempt_index: 0,
        attempts_snapshot: JSON.stringify(attempts),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.updateProgress('GRAB202605270001', {
      status: GRAB_STATUS.WAITING,
      message: '正在尝试 VIP',
      currentTicketTypeId: 202,
      currentAttemptIndex: 0,
      attempts,
    });

    expect(query.mock.calls[0][0]).toContain('progress_status = $2');
    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      GRAB_STATUS.WAITING,
      '正在尝试 VIP',
      202,
      0,
      JSON.stringify(attempts),
    ]);
    expect(result.progressStatus).toBe(GRAB_STATUS.WAITING);
    expect(result.attemptsSnapshot).toEqual(attempts);
  });

  it('maps accepted status to waiting progress when updating status', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...baseRow,
        status: GRAB_STATUS.ACCEPTED,
        progress_status: GRAB_STATUS.WAITING,
        fail_reason: null,
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.updateStatus('GRAB202605270001', GRAB_STATUS.ACCEPTED);

    expect(query.mock.calls[0][0]).toContain('progress_status = $4');
    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      GRAB_STATUS.ACCEPTED,
      null,
      GRAB_STATUS.WAITING,
    ]);
    expect(result.status).toBe(GRAB_STATUS.ACCEPTED);
    expect(result.progressStatus).toBe(GRAB_STATUS.WAITING);
  });

  it('marks order created with matched ticket type and attempts snapshot', async () => {
    const attempts = [
      { ticketTypeId: 202, name: 'VIP', status: 'ORDER_CREATED' as const, message: '已创建订单' },
    ];
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...baseRow,
        status: GRAB_STATUS.ORDER_CREATED,
        progress_status: GRAB_STATUS.ORDER_CREATED,
        progress_message: null,
        order_id: '9001',
        matched_ticket_type_id: '202',
        attempts_snapshot: JSON.stringify(attempts),
        completed_at: new Date('2026-05-27T12:03:00.000Z'),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.markOrderCreated('GRAB202605270001', 9001, 202, attempts);

    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      GRAB_STATUS.ORDER_CREATED,
      9001,
      202,
      JSON.stringify(attempts),
    ]);
    expect(result.status).toBe(GRAB_STATUS.ORDER_CREATED);
    expect(result.progressStatus).toBe(GRAB_STATUS.ORDER_CREATED);
    expect(result.orderId).toBe(9001);
    expect(result.matchedTicketTypeId).toBe(202);
    expect(result.attemptsSnapshot).toEqual(attempts);
    expect(result.failReason).toBeNull();
  });

  it('falls back to original ticket type when legacy order creation omits matched ticket type', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...baseRow,
        status: GRAB_STATUS.ORDER_CREATED,
        progress_status: GRAB_STATUS.ORDER_CREATED,
        order_id: '9001',
        matched_ticket_type_id: '202',
        attempts_snapshot: JSON.stringify([]),
        completed_at: new Date('2026-05-27T12:03:00.000Z'),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.markOrderCreated('GRAB202605270001', 9001);

    expect(query.mock.calls[0][0]).toContain('matched_ticket_type_id = coalesce($4, ticket_type_id)');
    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      GRAB_STATUS.ORDER_CREATED,
      9001,
      null,
      JSON.stringify([]),
    ]);
    expect(result.matchedTicketTypeId).toBe(202);
  });

  it('claims queued or waiting requests for processing and returns null when none match', async () => {
    const claimedAt = new Date('2026-05-27T12:01:00.000Z');
    const query = jest.fn()
      .mockResolvedValueOnce({
        rows: [{
          ...baseRow,
          status: GRAB_STATUS.WAITING,
          progress_status: GRAB_STATUS.WAITING,
          worker_id: 'worker-1',
          worker_claimed_at: claimedAt,
          processing_started_at: claimedAt,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.claimForProcessing('GRAB202605270001', 'worker-1');
    const none = await repository.claimForProcessing('GRAB404', 'worker-1');

    expect(query.mock.calls[0][0]).toContain('status in ($3, $4)');
    expect(query.mock.calls[0][0]).toContain('progress_status in ($5, $6)');
    expect(query.mock.calls[0][0]).toContain('status = $7');
    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      'worker-1',
      GRAB_STATUS.QUEUED,
      GRAB_STATUS.WAITING,
      GRAB_STATUS.QUEUED,
      GRAB_STATUS.WAITING,
      GRAB_STATUS.WAITING,
    ]);
    expect(result?.workerId).toBe('worker-1');
    expect(result?.status).toBe(GRAB_STATUS.WAITING);
    expect(result?.progressStatus).toBe(GRAB_STATUS.WAITING);
    expect(none).toBeNull();
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

    expect(query).toHaveBeenCalledWith(expect.stringContaining('status = any'), expect.any(Array));
    expect(query.mock.calls[0][1].slice(0, 6)).toEqual([
      2004,
      101,
      202,
      2,
      JSON.stringify([301, 302]),
      false,
    ]);
    expect(query.mock.calls[0][1][6]).toEqual([
      GRAB_STATUS.QUEUED,
      GRAB_STATUS.WAITING,
      GRAB_STATUS.TRYING_TICKET_TYPE,
      GRAB_STATUS.LOCKING,
      GRAB_STATUS.PENDING,
      GRAB_STATUS.ACCEPTED,
      GRAB_STATUS.ORDER_CREATING,
      GRAB_STATUS.ORDER_CREATED,
      GRAB_STATUS.DOWNGRADING,
    ]);
    expect(query.mock.calls[0][1][6]).not.toEqual(expect.arrayContaining([
      GRAB_STATUS.SOLD_OUT,
      GRAB_STATUS.LIMITED,
      GRAB_STATUS.FAILED,
      GRAB_STATUS.EXPIRED,
    ]));
    expect(result?.requestId).toBe('GRAB1');
    expect(result?.orderId).toBe(9001);
  });
});
