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

  it('persists TEAM_GRAB request type for queued team requests', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...baseRow, request_type: 'TEAM_GRAB' }] });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.createQueued({
      requestId: 'GRAB-TEAM-1',
      idempotencyKey: 'team-grab-1',
      userId: 100,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [],
      allocateRandom: true,
      expireTime: new Date('2026-05-27T12:15:00.000Z'),
      queueSeq: 3,
      requestedTicketTypes: [{ ticketTypeId: 202, name: 'VIP', maxPrice: 880 }],
      allowAutoDowngrade: false,
      requestType: 'TEAM_GRAB',
    });

    expect(query.mock.calls[0][1]).toContain('TEAM_GRAB');
    expect(result.requestType).toBe('TEAM_GRAB');
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
      workerId: 'worker-1',
    });

    expect(query.mock.calls[0][0]).toContain('progress_status = $2');
    expect(query.mock.calls[0][0]).toContain('worker_id = $8');
    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      GRAB_STATUS.WAITING,
      '正在尝试 VIP',
      202,
      0,
      JSON.stringify(attempts),
      [
        GRAB_STATUS.ORDER_CREATED,
        GRAB_STATUS.SOLD_OUT,
        GRAB_STATUS.LIMITED,
        GRAB_STATUS.FAILED,
        GRAB_STATUS.PENDING_RECOVERY,
        GRAB_STATUS.EXPIRED,
      ],
      'worker-1',
    ]);
    expect(result?.progressStatus).toBe(GRAB_STATUS.WAITING);
    expect(result?.attemptsSnapshot).toEqual(attempts);
  });

  it('does not overwrite terminal progress when updating progress', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.updateProgress('GRAB-EXPIRED', {
      status: GRAB_STATUS.ORDER_CREATING,
      message: 'creating',
      currentTicketTypeId: 202,
      currentAttemptIndex: 0,
      attempts: [],
    });

    expect(query.mock.calls[0][0]).toContain('progress_status <> all');
    expect(result).toBeNull();
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

  it('expires active requests with a conditional status and no existing order', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...baseRow,
        status: GRAB_STATUS.EXPIRED,
        progress_status: GRAB_STATUS.EXPIRED,
        fail_reason: 'grab request cancelled',
        completed_at: new Date('2026-05-27T12:03:00.000Z'),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.expireActiveRequest('GRAB202605270001', 'grab request cancelled', [GRAB_STATUS.LOCKING]);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('progress_status = any($4::varchar[])');
    expect(sql).toContain('order_id is null');
    expect(params).toEqual([
      'GRAB202605270001',
      GRAB_STATUS.EXPIRED,
      'grab request cancelled',
      [GRAB_STATUS.LOCKING],
    ]);
    expect(result?.progressStatus).toBe(GRAB_STATUS.EXPIRED);
    expect(result?.failReason).toBe('grab request cancelled');
  });

  it('does not expire requests when the conditional status no longer matches', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.expireActiveRequest('GRAB-ORDERED', 'cancelled', [GRAB_STATUS.LOCKING]);

    expect(result).toBeNull();
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

    expect(query.mock.calls[0][0]).toContain('worker_id = $7');
    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      GRAB_STATUS.ORDER_CREATED,
      9001,
      202,
      JSON.stringify(attempts),
      GRAB_STATUS.ORDER_CREATING,
      null,
    ]);
    expect(result?.status).toBe(GRAB_STATUS.ORDER_CREATED);
    expect(result?.progressStatus).toBe(GRAB_STATUS.ORDER_CREATED);
    expect(result?.orderId).toBe(9001);
    expect(result?.matchedTicketTypeId).toBe(202);
    expect(result?.attemptsSnapshot).toEqual(attempts);
    expect(result?.failReason).toBeNull();
  });

  it('does not mark order created after terminal progress', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.markOrderCreated('GRAB-EXPIRED', 9001, 203, []);

    expect(query.mock.calls[0][0]).toContain('progress_status = $6');
    expect(result).toBeNull();
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
      GRAB_STATUS.ORDER_CREATING,
      null,
    ]);
    expect(result?.matchedTicketTypeId).toBe(202);
  });

  it('claims only unexpired queued requests or stale waiting leases for processing', async () => {
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

    expect(query.mock.calls[0][0]).toContain('expire_time > now()');
    expect(query.mock.calls[0][0]).toContain('order_id is null');
    expect(query.mock.calls[0][0]).toContain('worker_claimed_at is null');
    expect(query.mock.calls[0][0]).toContain("interval '1 second'");
    expect(query.mock.calls[0][0]).toContain('status = $7');
    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      'worker-1',
      GRAB_STATUS.QUEUED,
      GRAB_STATUS.QUEUED,
      GRAB_STATUS.WAITING,
      GRAB_STATUS.WAITING,
      GRAB_STATUS.WAITING,
      30,
    ]);
    expect(result?.workerId).toBe('worker-1');
    expect(result?.status).toBe(GRAB_STATUS.WAITING);
    expect(result?.progressStatus).toBe(GRAB_STATUS.WAITING);
    expect(none).toBeNull();
  });

  it('marks ambiguous order creation outcomes as pending recovery', async () => {
    const attempts = [
      { ticketTypeId: 202, name: 'VIP', status: 'LOCKING' as const, message: 'locked' },
    ];
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...baseRow,
        status: GRAB_STATUS.PENDING_RECOVERY,
        progress_status: GRAB_STATUS.PENDING_RECOVERY,
        progress_message: 'order confirmation pending',
        fail_reason: 'order confirmation pending',
        attempts_snapshot: JSON.stringify(attempts),
        completed_at: new Date('2026-05-27T12:03:00.000Z'),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.markPendingRecovery('GRAB202605270001', {
      message: 'order confirmation pending',
      currentTicketTypeId: 202,
      currentAttemptIndex: 0,
      attempts,
      workerId: 'worker-1',
    });

    expect(query.mock.calls[0][0]).toContain('progress_status = any($7::varchar[])');
    expect(query.mock.calls[0][0]).toContain('completed_at = coalesce');
    expect(query.mock.calls[0][0]).toContain('worker_id = $8');
    expect(query.mock.calls[0][1]).toEqual([
      'GRAB202605270001',
      GRAB_STATUS.PENDING_RECOVERY,
      'order confirmation pending',
      202,
      0,
      JSON.stringify(attempts),
      [GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.LOCKING],
      'worker-1',
    ]);
    expect(result?.progressStatus).toBe(GRAB_STATUS.PENDING_RECOVERY);
    expect(result?.failReason).toBe('order confirmation pending');
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
      requestedTicketTypes: [
        { ticketTypeId: 202, name: 'VIP', maxPrice: 880 },
        { ticketTypeId: 203, name: 'A区', maxPrice: 680 },
      ],
      allowAutoDowngrade: true,
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('status = any'), expect.any(Array));
    expect(query.mock.calls[0][0]).toContain('requested_ticket_types = $7::jsonb');
    expect(query.mock.calls[0][0]).toContain('allow_auto_downgrade = $8');
    expect(query.mock.calls[0][1].slice(0, 8)).toEqual([
      2004,
      101,
      202,
      2,
      JSON.stringify([301, 302]),
      false,
      JSON.stringify([
        { ticketTypeId: 202, name: 'VIP', maxPrice: 880 },
        { ticketTypeId: 203, name: 'A区', maxPrice: 680 },
      ]),
      true,
    ]);
    expect(query.mock.calls[0][1][8]).toEqual([
      GRAB_STATUS.QUEUED,
      GRAB_STATUS.WAITING,
      GRAB_STATUS.TRYING_TICKET_TYPE,
      GRAB_STATUS.LOCKING,
      GRAB_STATUS.PENDING,
      GRAB_STATUS.ACCEPTED,
      GRAB_STATUS.ORDER_CREATING,
      GRAB_STATUS.DOWNGRADING,
    ]);
    expect(query.mock.calls[0][1][8]).not.toEqual(expect.arrayContaining([
      GRAB_STATUS.ORDER_CREATED,
      GRAB_STATUS.SOLD_OUT,
      GRAB_STATUS.LIMITED,
      GRAB_STATUS.FAILED,
      GRAB_STATUS.PENDING_RECOVERY,
      GRAB_STATUS.EXPIRED,
    ]));
    expect(result?.requestId).toBe('GRAB1');
    expect(result?.orderId).toBe(9001);
  });

  it('finds expired in-flight requests by async progress status ordered by expiry', async () => {
    const now = new Date('2026-05-27T12:15:00.000Z');
    const query = jest.fn().mockResolvedValue({
      rows: [{
        id: 1,
        request_id: 'GRAB-QUEUED',
        idempotency_key: 'idem-queued',
        user_id: 2004,
        session_id: 101,
        ticket_type_id: 202,
        quantity: 1,
        seat_ids: '[]',
        allocate_random: false,
        status: GRAB_STATUS.ACCEPTED,
        progress_status: 'QUEUED',
        order_id: null,
        fail_reason: null,
        expire_time: new Date('2026-05-27T12:00:00.000Z'),
        created_at: new Date('2026-05-27T11:50:00.000Z'),
        updated_at: new Date('2026-05-27T11:50:00.000Z'),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.findExpiredInFlight(now, 100);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('progress_status = any');
    expect(sql).toContain('order by expire_time asc');
    expect(sql).toContain('limit $3');
    expect(params).toEqual([
      ['QUEUED', 'WAITING', 'TRYING_TICKET_TYPE', 'LOCKING', 'ORDER_CREATING'],
      now,
      100,
    ]);
    expect((result[0] as any).progressStatus).toBe('QUEUED');
  });

  it('finds pending recovery requests for order lookup compensation', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...baseRow,
        status: GRAB_STATUS.PENDING_RECOVERY,
        progress_status: GRAB_STATUS.PENDING_RECOVERY,
        updated_at: new Date('2026-05-27T12:01:00.000Z'),
      }],
    });
    const repository = new GrabRepository({ query } as any);

    const result = await repository.findPendingRecovery(50);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('progress_status = $1');
    expect(sql).toContain('order by updated_at asc');
    expect(sql).toContain('limit $2');
    expect(params).toEqual([GRAB_STATUS.PENDING_RECOVERY, 50]);
    expect(result[0].progressStatus).toBe(GRAB_STATUS.PENDING_RECOVERY);
  });
});
