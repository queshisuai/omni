import { GrabCompensationService } from './grab-compensation.service';
import { GRAB_STATUS } from './grab-status';

const EXPIRED_MESSAGE = '抢票请求已过期';

function buildExpiredRequest(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'GRAB1',
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 2,
    seatIds: [301, 302],
    idempotencyKey: 'idem-1',
    orderId: null,
    progressStatus: GRAB_STATUS.QUEUED,
    currentTicketTypeId: null,
    matchedTicketTypeId: null,
    attemptsSnapshot: [],
    queueSeq: 12,
    expireTime: new Date('2026-05-27T12:00:00.000Z'),
    ...overrides,
  };
}

function buildService(expiredRequests: Array<Record<string, unknown>>, overrides: {
  repository?: any;
  admission?: any;
  orderClient?: any;
  queue?: any;
} = {}) {
  const repository: any = overrides.repository ?? {
    findExpiredInFlight: jest.fn().mockResolvedValue(expiredRequests),
    expireActiveRequest: jest.fn().mockImplementation((requestId, failReason) => Promise.resolve({
      ...expiredRequests.find((request) => request.requestId === requestId),
      status: GRAB_STATUS.EXPIRED,
      progressStatus: GRAB_STATUS.EXPIRED,
      failReason,
    })),
    markOrderCreated: jest.fn(),
    findPendingRecovery: jest.fn().mockResolvedValue([]),
    findByRequestId: jest.fn(),
  };
  const admission: any = overrides.admission ?? { release: jest.fn() };
  const orderClient: any = overrides.orderClient ?? { findByGrabRequestId: jest.fn().mockResolvedValue(null) };
  const queue: any = overrides.queue ?? {
    getActiveSessions: jest.fn().mockResolvedValue([]),
    listInflightRequestIds: jest.fn(),
    getRequestMetadata: jest.fn(),
    ackOrphanInflight: jest.fn(),
    ackProcessed: jest.fn(),
    requeueInflight: jest.fn(),
    removeActiveSessionIfQueueEmpty: jest.fn(),
  };
  const service = new GrabCompensationService(repository, admission, orderClient, queue);

  return { repository, admission, orderClient, queue, service };
}

describe('GrabCompensationService', () => {
  it('expires queued requests without releasing redis holds', async () => {
    const expired = buildExpiredRequest({ requestId: 'GRAB-QUEUED', progressStatus: GRAB_STATUS.QUEUED });
    const { repository, admission, service } = buildService([expired]);

    await service.sweepExpiredRequests();

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.expireActiveRequest).toHaveBeenCalledWith('GRAB-QUEUED', EXPIRED_MESSAGE, [GRAB_STATUS.QUEUED]);
  });

  it.each([GRAB_STATUS.WAITING, GRAB_STATUS.TRYING_TICKET_TYPE])('expires %s requests without releasing redis holds', async (progressStatus) => {
    const expired = buildExpiredRequest({ requestId: `GRAB-${progressStatus}`, progressStatus });
    const { repository, admission, service } = buildService([expired]);

    await service.sweepExpiredRequests();

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.expireActiveRequest).toHaveBeenCalledWith(`GRAB-${progressStatus}`, EXPIRED_MESSAGE, [progressStatus]);
  });

  it.each([GRAB_STATUS.LOCKING, GRAB_STATUS.ORDER_CREATING])('conditionally expires %s requests and releases redis holds when no order exists', async (progressStatus) => {
    const expired = buildExpiredRequest({ requestId: `GRAB-${progressStatus}`, progressStatus, currentTicketTypeId: 203 });
    const { repository, admission, service } = buildService([expired]);

    await service.sweepExpiredRequests();

    expect(admission.release).toHaveBeenCalledWith({
      requestId: `GRAB-${progressStatus}`,
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 203,
      quantity: 2,
      seatIds: [301, 302],
      idempotencyKey: 'idem-1',
    });
    expect(repository.expireActiveRequest).toHaveBeenCalledWith(`GRAB-${progressStatus}`, EXPIRED_MESSAGE, [progressStatus]);
  });

  it('does not release redis holds when conditional expiry loses the race', async () => {
    const expired = buildExpiredRequest({ requestId: 'GRAB-RACE', progressStatus: GRAB_STATUS.LOCKING, currentTicketTypeId: 203 });
    const { repository, admission, service } = buildService([expired], {
      repository: {
        findExpiredInFlight: jest.fn().mockResolvedValue([expired]),
        expireActiveRequest: jest.fn().mockResolvedValue(null),
        findByRequestId: jest.fn(),
        markOrderCreated: jest.fn(),
        findPendingRecovery: jest.fn().mockResolvedValue([]),
      },
    });

    await service.sweepExpiredRequests();

    expect(repository.expireActiveRequest).toHaveBeenCalledWith('GRAB-RACE', EXPIRED_MESSAGE, [GRAB_STATUS.LOCKING]);
    expect(admission.release).not.toHaveBeenCalled();
  });

  it('recovers an order-created request before expiring order-creating holds', async () => {
    const expired = buildExpiredRequest({
      requestId: 'GRAB-ORDER-CREATED',
      progressStatus: GRAB_STATUS.ORDER_CREATING,
      currentTicketTypeId: 203,
      attemptsSnapshot: [{ ticketTypeId: 203, name: 'B', status: 'LOCKING', message: 'locked' }],
    });
    const { repository, admission, orderClient, queue, service } = buildService([expired], {
      orderClient: { findByGrabRequestId: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', status: 'PENDING', grabRequestId: 'GRAB-ORDER-CREATED' }) },
    });
    repository.markOrderCreated.mockResolvedValue({ ...expired, orderId: 9001, progressStatus: GRAB_STATUS.ORDER_CREATED });

    await service.sweepExpiredRequests();

    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-ORDER-CREATED');
    expect(repository.markOrderCreated).toHaveBeenCalledWith(
      'GRAB-ORDER-CREATED',
      9001,
      203,
      [expect.objectContaining({ ticketTypeId: 203, status: 'ORDER_CREATED' })],
      GRAB_STATUS.ORDER_CREATING,
    );
    expect(repository.expireActiveRequest).not.toHaveBeenCalled();
    expect(admission.release).not.toHaveBeenCalled();
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB-ORDER-CREATED', 12);
  });

  it('does not expire or release order-creating holds when order lookup is unavailable', async () => {
    const expired = buildExpiredRequest({
      requestId: 'GRAB-LOOKUP-DOWN',
      progressStatus: GRAB_STATUS.ORDER_CREATING,
      currentTicketTypeId: 203,
    });
    const { repository, admission, orderClient, service } = buildService([expired], {
      orderClient: { findByGrabRequestId: jest.fn().mockRejectedValue(new Error('order lookup unavailable')) },
    });

    await service.sweepExpiredRequests();

    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-LOOKUP-DOWN');
    expect(repository.expireActiveRequest).not.toHaveBeenCalled();
    expect(admission.release).not.toHaveBeenCalled();
  });

  it('acks orphan inflight queue items and advances processed sequence from redis metadata', async () => {
    const queue: any = {
      getActiveSessions: jest.fn().mockResolvedValue([101]),
      listInflightRequestIds: jest.fn().mockResolvedValue(['GRAB-MISSING']),
      getRequestMetadata: jest.fn().mockResolvedValue({ requestId: 'GRAB-MISSING', queueSeq: 18, inflightAt: Date.now() - 120_000 }),
      ackOrphanInflight: jest.fn(),
      ackProcessed: jest.fn(),
      requeueInflight: jest.fn(),
      removeActiveSessionIfQueueEmpty: jest.fn(),
    };
    const repository: any = {
      findExpiredInFlight: jest.fn().mockResolvedValue([]),
      findPendingRecovery: jest.fn().mockResolvedValue([]),
      findByRequestId: jest.fn().mockResolvedValue(null),
    };
    const { service } = buildService([], { repository, queue });

    await service.sweepExpiredRequests();

    expect(queue.ackOrphanInflight).toHaveBeenCalledWith(101, 'GRAB-MISSING');
    expect(queue.removeActiveSessionIfQueueEmpty).toHaveBeenCalledWith(101);
  });

  it('requeues stale inflight queued records that are not expired', async () => {
    const record = buildExpiredRequest({
      requestId: 'GRAB-STALE',
      progressStatus: GRAB_STATUS.WAITING,
      expireTime: new Date(Date.now() + 60_000),
    });
    const queue: any = {
      getActiveSessions: jest.fn().mockResolvedValue([101]),
      listInflightRequestIds: jest.fn().mockResolvedValue(['GRAB-STALE']),
      getRequestMetadata: jest.fn().mockResolvedValue({ requestId: 'GRAB-STALE', queueSeq: 19, inflightAt: Date.now() - 120_000 }),
      ackOrphanInflight: jest.fn(),
      ackProcessed: jest.fn(),
      requeueInflight: jest.fn(),
      removeActiveSessionIfQueueEmpty: jest.fn(),
    };
    const repository: any = {
      findExpiredInFlight: jest.fn().mockResolvedValue([]),
      findPendingRecovery: jest.fn().mockResolvedValue([]),
      findByRequestId: jest.fn().mockResolvedValue(record),
    };
    const { service } = buildService([], { repository, queue });

    await service.sweepExpiredRequests();

    expect(queue.requeueInflight).toHaveBeenCalledWith(101, 'GRAB-STALE');
  });

  it('recovers pending recovery requests when an order later becomes visible', async () => {
    const pending = buildExpiredRequest({
      requestId: 'GRAB-PENDING-RECOVERY',
      progressStatus: GRAB_STATUS.PENDING_RECOVERY,
      currentTicketTypeId: 203,
      attemptsSnapshot: [{ ticketTypeId: 203, name: 'B', status: 'LOCKING', message: 'order confirmation pending' }],
      expireTime: new Date(Date.now() + 60_000),
    });
    const { repository, orderClient, queue, service } = buildService([], {
      repository: {
        findExpiredInFlight: jest.fn().mockResolvedValue([]),
        findPendingRecovery: jest.fn().mockResolvedValue([pending]),
        findByRequestId: jest.fn(),
        markOrderCreated: jest.fn().mockResolvedValue({ ...pending, orderId: 9001, progressStatus: GRAB_STATUS.ORDER_CREATED }),
      },
      orderClient: { findByGrabRequestId: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', status: 'PENDING', grabRequestId: 'GRAB-PENDING-RECOVERY' }) },
    });

    await service.sweepExpiredRequests();

    expect(repository.findPendingRecovery).toHaveBeenCalledWith(100);
    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-PENDING-RECOVERY');
    expect(repository.markOrderCreated).toHaveBeenCalledWith(
      'GRAB-PENDING-RECOVERY',
      9001,
      203,
      [expect.objectContaining({ ticketTypeId: 203, status: 'ORDER_CREATED' })],
      GRAB_STATUS.PENDING_RECOVERY,
    );
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB-PENDING-RECOVERY', 12);
  });
});
