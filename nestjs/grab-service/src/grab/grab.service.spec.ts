import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GRAB_STATUS } from './grab-status';
import { GrabService } from './grab.service';

function createService(overrides: {
  repository?: any;
  admission?: any;
  orderClient?: any;
  queue?: any;
} = {}): GrabService {
  return new GrabService(
    overrides.repository ?? {},
    overrides.admission ?? { admit: jest.fn(), release: jest.fn() },
    overrides.orderClient ?? { createOrder: jest.fn() },
    overrides.queue ?? { enqueue: jest.fn(), calculateQueueRank: jest.fn() },
  );
}

describe('GrabService', () => {
  it('generates unique request ids under high concurrency volume', () => {
    const service = createService();
    const ids = Array.from({ length: 5000 }, () => service['generateRequestId']());

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^GRAB[0-9a-f]{24}$/.test(id))).toBe(true);
  });

  it('enqueues a grab request and does not create an order during submit', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(null),
      createQueued: jest.fn().mockImplementation((input) => Promise.resolve({
        requestId: input.requestId,
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 2,
        seatIds: [301, 302],
        allocateRandom: false,
        idempotencyKey: 'idem-1',
        status: GRAB_STATUS.QUEUED,
        progressStatus: GRAB_STATUS.QUEUED,
        progressMessage: 'queued',
        orderId: null,
        failReason: null,
        queueSeq: input.queueSeq,
      })),
    };
    const admission: any = {
      admit: jest.fn(),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn(),
    };
    const queue: any = {
      enqueue: jest.fn().mockResolvedValue({ queueSeq: 12, queueRank: 4 }),
      calculateQueueRank: jest.fn(),
    };
    const service = createService({ repository, admission, orderClient, queue });

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [302, 301],
      allocateRandom: false,
      idempotencyKey: 'idem-1',
    });

    expect(admission.admit).not.toHaveBeenCalled();
    expect(orderClient.createOrder).not.toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^GRAB/),
      sessionId: 101,
      userId: 2004,
    });
    expect(repository.createQueued).toHaveBeenCalledWith(expect.objectContaining({
      queueSeq: 12,
      requestedTicketTypes: [{ ticketTypeId: 202, name: null, maxPrice: null }],
      allowAutoDowngrade: false,
      seatIds: [301, 302],
    }));
    expect(result).toEqual({
      requestId: expect.stringMatching(/^GRAB/),
      status: GRAB_STATUS.QUEUED,
      orderId: null,
      failReason: null,
      queueSeq: 12,
      queueRank: 4,
      estimatedWaitSeconds: null,
      message: 'queued',
    });
  });

  it('rejects auto downgrade when explicit seats are selected', async () => {
    const service = createService({
      repository: {
        findByUserAndIdempotency: jest.fn(),
        findActiveByIntent: jest.fn(),
        createQueued: jest.fn(),
      },
      queue: { enqueue: jest.fn(), calculateQueueRank: jest.fn() },
    });

    await expect(service.submitRequest(2004, {
      sessionId: 101,
      quantity: 2,
      seatIds: [301, 302],
      idempotencyKey: 'idem-seats',
      ticketTypePreferences: [
        { ticketTypeId: 202, name: 'A', maxPrice: 100 },
        { ticketTypeId: 203, name: 'B', maxPrice: 80 },
      ],
      allowAutoDowngrade: true,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not persist auto downgrade authorization when there is no later ticket type', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(null),
      createQueued: jest.fn().mockImplementation((input) => Promise.resolve({
        requestId: input.requestId,
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 1,
        seatIds: [],
        allocateRandom: true,
        idempotencyKey: 'idem-single',
        status: GRAB_STATUS.QUEUED,
        progressStatus: GRAB_STATUS.QUEUED,
        progressMessage: null,
        orderId: null,
        failReason: null,
        queueSeq: input.queueSeq,
      })),
    };
    const queue: any = {
      enqueue: jest.fn().mockResolvedValue({ queueSeq: 13, queueRank: 5 }),
      calculateQueueRank: jest.fn(),
    };
    const service = createService({ repository, queue });

    await service.submitRequest(2004, {
      sessionId: 101,
      quantity: 1,
      allocateRandom: true,
      idempotencyKey: 'idem-single',
      ticketTypePreferences: [{ ticketTypeId: 202, name: 'A', maxPrice: 100 }],
      allowAutoDowngrade: true,
    });

    expect(repository.createQueued).toHaveBeenCalledWith(expect.objectContaining({
      requestedTicketTypes: [{ ticketTypeId: 202, name: 'A', maxPrice: 100 }],
      allowAutoDowngrade: false,
    }));
  });

  it('returns existing idempotent queued request without enqueueing again', async () => {
    const existing = {
      requestId: 'GRAB-EXISTING',
      userId: 2004,
      sessionId: 101,
      status: GRAB_STATUS.QUEUED,
      progressStatus: GRAB_STATUS.QUEUED,
      progressMessage: 'waiting',
      orderId: null,
      failReason: null,
      queueSeq: 7,
    };
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(existing),
      findActiveByIntent: jest.fn(),
      createQueued: jest.fn(),
    };
    const queue: any = {
      enqueue: jest.fn(),
      calculateQueueRank: jest.fn().mockResolvedValue(2),
    };
    const service = createService({ repository, queue });

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-1',
    });

    expect(repository.findActiveByIntent).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(repository.createQueued).not.toHaveBeenCalled();
    expect(queue.calculateQueueRank).toHaveBeenCalledWith(101, 7);
    expect(result).toEqual({
      requestId: 'GRAB-EXISTING',
      status: GRAB_STATUS.QUEUED,
      orderId: null,
      failReason: null,
      queueSeq: 7,
      queueRank: 2,
      estimatedWaitSeconds: null,
      message: 'waiting',
    });
  });

  it('returns existing active request for the same grab intent without enqueueing again', async () => {
    const existing = {
      requestId: 'GRAB-ACTIVE',
      userId: 2004,
      sessionId: 101,
      status: GRAB_STATUS.QUEUED,
      progressStatus: GRAB_STATUS.QUEUED,
      progressMessage: 'queued',
      orderId: null,
      failReason: null,
      queueSeq: 8,
    };
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(existing),
      createQueued: jest.fn(),
    };
    const queue: any = {
      enqueue: jest.fn(),
      calculateQueueRank: jest.fn().mockResolvedValue(3),
    };
    const service = createService({ repository, queue });

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypePreferences: [
        { ticketTypeId: 202, name: 'A', maxPrice: 100 },
        { ticketTypeId: 203, name: 'B', maxPrice: 80 },
      ],
      allowAutoDowngrade: true,
      quantity: 2,
      allocateRandom: false,
      idempotencyKey: 'new-key',
    });

    expect(repository.findActiveByIntent).toHaveBeenCalledWith({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [],
      allocateRandom: false,
    });
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(repository.createQueued).not.toHaveBeenCalled();
    expect(result).toEqual({
      requestId: 'GRAB-ACTIVE',
      status: GRAB_STATUS.QUEUED,
      orderId: null,
      failReason: null,
      queueSeq: 8,
      queueRank: 3,
      estimatedWaitSeconds: null,
      message: 'queued',
    });
  });

  it('returns progress with queue rank for the owner', async () => {
    const record: any = {
      requestId: 'GRAB-PROGRESS',
      userId: 2004,
      sessionId: 101,
      status: GRAB_STATUS.WAITING,
      progressStatus: GRAB_STATUS.WAITING,
      progressMessage: 'waiting',
      orderId: null,
      failReason: null,
      queueSeq: 10,
      currentTicketTypeId: 202,
      currentAttemptIndex: 0,
      requestedTicketTypes: [{ ticketTypeId: 202, name: 'A', maxPrice: 100 }],
      attemptsSnapshot: [{ ticketTypeId: 202, name: 'A', status: 'PENDING', message: 'pending' }],
      matchedTicketTypeId: null,
      updatedAt: new Date('2026-05-29T12:00:00.000Z'),
    };
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
    };
    const queue: any = {
      calculateQueueRank: jest.fn().mockResolvedValue(3),
    };
    const service = createService({ repository, queue });

    const result = await service.getProgress(2004, 'GRAB-PROGRESS');

    expect(repository.findByRequestId).toHaveBeenCalledWith('GRAB-PROGRESS');
    expect(queue.calculateQueueRank).toHaveBeenCalledWith(101, 10);
    expect(result).toEqual({
      requestId: 'GRAB-PROGRESS',
      sessionId: 101,
      status: GRAB_STATUS.WAITING,
      orderId: null,
      failReason: null,
      queueSeq: 10,
      queueRank: 3,
      estimatedWaitSeconds: null,
      currentTicketTypeId: 202,
      currentAttemptIndex: 0,
      requestedTicketTypes: [{ ticketTypeId: 202, name: 'A', maxPrice: 100 }],
      attempts: [{ ticketTypeId: 202, name: 'A', status: 'PENDING', message: 'pending' }],
      visibleStock: null,
      message: 'waiting',
      matchedTicketTypeId: null,
      updateTime: '2026-05-29T12:00:00.000Z',
    });
  });

  it('does not release redis holds when cancelling a request that never entered redis admission', async () => {
    const record = {
      requestId: 'GRAB-FAILED',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      allocateRandom: false,
      idempotencyKey: 'idem-failed',
      status: GRAB_STATUS.FAILED,
      orderId: null,
      failReason: 'stock unavailable',
    };
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
    };
    const admission: any = { release: jest.fn() };
    const service = createService({ repository, admission });

    const result = await service.cancelRequest(2004, 'GRAB-FAILED');

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({ requestId: 'GRAB-FAILED', status: GRAB_STATUS.FAILED, orderId: null, failReason: 'stock unavailable' });
  });

  it('rejects reading another user grab request', async () => {
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue({
        requestId: 'GRAB-OTHER',
        userId: 2005,
        status: GRAB_STATUS.ORDER_CREATED,
        orderId: 9001,
        failReason: null,
      }),
    };
    const service = createService({ repository });

    await expect(service.getRequest(2004, 'GRAB-OTHER')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findByRequestId).toHaveBeenCalledWith('GRAB-OTHER');
  });

  it('rejects cancelling another user grab request', async () => {
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue({
        requestId: 'GRAB-OTHER',
        userId: 2005,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 1,
        seatIds: [],
        allocateRandom: false,
        idempotencyKey: 'idem-other',
        status: GRAB_STATUS.ACCEPTED,
        orderId: null,
        failReason: null,
      }),
      updateStatus: jest.fn(),
    };
    const admission: any = { release: jest.fn() };
    const service = createService({ repository, admission });

    await expect(service.cancelRequest(2004, 'GRAB-OTHER')).rejects.toBeInstanceOf(ForbiddenException);
    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('returns existing order-created request when cancelling after order creation', async () => {
    const record = {
      requestId: 'GRAB-ORDERED',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      allocateRandom: false,
      idempotencyKey: 'idem-ordered',
      status: GRAB_STATUS.ORDER_CREATED,
      orderId: 9001,
      failReason: null,
    };
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
    };
    const admission: any = { release: jest.fn() };
    const service = createService({ repository, admission });

    const result = await service.cancelRequest(2004, 'GRAB-ORDERED');

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({ requestId: 'GRAB-ORDERED', status: GRAB_STATUS.ORDER_CREATED, orderId: 9001, failReason: null });
  });

  it('expires accepted request and releases redis hold when cancelling an in-flight request', async () => {
    const record = {
      requestId: 'GRAB-ACCEPTED',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      allocateRandom: false,
      idempotencyKey: 'idem-accepted',
      status: GRAB_STATUS.ACCEPTED,
      orderId: null,
      failReason: null,
    };
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({
        ...record,
        status: GRAB_STATUS.EXPIRED,
        failReason: 'request cancelled',
      }),
    };
    const admission: any = { release: jest.fn() };
    const service = createService({ repository, admission });

    const result = await service.cancelRequest(2004, 'GRAB-ACCEPTED');

    expect(admission.release).toHaveBeenCalledWith(record);
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB-ACCEPTED', GRAB_STATUS.EXPIRED, expect.any(String));
    expect(result).toMatchObject({ requestId: 'GRAB-ACCEPTED', status: GRAB_STATUS.EXPIRED, orderId: null, failReason: 'request cancelled' });
  });
});
