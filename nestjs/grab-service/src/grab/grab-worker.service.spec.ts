import { GrabWorkerService } from './grab-worker.service';
import { GRAB_STATUS } from './grab-status';

function queuedRecord(overrides: any = {}) {
  return {
    requestId: 'GRAB1',
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 1,
    quantity: 2,
    seatIds: [],
    allocateRandom: true,
    idempotencyKey: 'idem-1',
    queueSeq: 12,
    requestedTicketTypes: [{ ticketTypeId: 1, name: 'A', maxPrice: 1280 }],
    allowAutoDowngrade: false,
    attemptsSnapshot: [{ ticketTypeId: 1, name: 'A', status: 'PENDING', message: 'pending' }],
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('GrabWorkerService', () => {
  it('locks a single ticket type, creates an order, and acks the inflight queue item', async () => {
    const record = queuedRecord();
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      claimForProcessing: jest.fn().mockResolvedValue(record),
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn().mockResolvedValue({
        ...record,
        progressStatus: GRAB_STATUS.ORDER_CREATED,
        orderId: 9001,
        matchedTicketTypeId: 1,
      }),
      updateStatus: jest.fn(),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB1' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', amount: 1960 }),
    };
    const queue: any = {
      ackProcessed: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.processRequest('GRAB1');

    expect(repository.claimForProcessing).toHaveBeenCalledWith('GRAB1', expect.stringMatching(/^grab-worker-/));
    expect(admission.admit).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'GRAB1',
      ticketTypeId: 1,
      quantity: 2,
      ttlSeconds: 900,
    }));
    expect(orderClient.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 1,
      quantity: 2,
      authorizedMaxUnitPrice: 1280,
      grabRequestId: 'GRAB1',
      requestedTicketTypeId: 1,
      matchedTicketTypeId: 1,
      autoDowngraded: false,
    }));
    expect(repository.markOrderCreated).toHaveBeenCalledWith('GRAB1', 9001, 1, expect.arrayContaining([
      expect.objectContaining({ ticketTypeId: 1, status: 'ORDER_CREATED' }),
    ]));
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(admission.release).not.toHaveBeenCalled();
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB1', 12);
  });

  it('marks the attempted ticket type sold out when admission rejects the lock', async () => {
    const record = queuedRecord();
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      claimForProcessing: jest.fn().mockResolvedValue(record),
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.SOLD_OUT }),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'SOLD_OUT', existingRequestId: null }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn(),
    };
    const queue: any = {
      ackProcessed: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.processRequest('GRAB1');

    expect(orderClient.createOrder).not.toHaveBeenCalled();
    expect(repository.updateProgress).toHaveBeenLastCalledWith('GRAB1', expect.objectContaining({
      status: GRAB_STATUS.SOLD_OUT,
      attempts: [expect.objectContaining({ ticketTypeId: 1, status: 'SOLD_OUT' })],
    }));
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB1', GRAB_STATUS.SOLD_OUT, 'ticket type sold out');
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB1', 12);
  });

  it('releases the redis hold when order creation fails after admission succeeds', async () => {
    const record = queuedRecord();
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      claimForProcessing: jest.fn().mockResolvedValue(record),
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.FAILED }),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB1' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockRejectedValue(new Error('order service timeout')),
    };
    const queue: any = {
      ackProcessed: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.processRequest('GRAB1');

    expect(admission.release).toHaveBeenCalledWith({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 1,
      quantity: 2,
      seatIds: [],
      idempotencyKey: 'idem-1',
      restoreStock: true,
    });
    expect(repository.markOrderCreated).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB1', GRAB_STATUS.FAILED, 'order service timeout');
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB1', 12);
  });

  it('does not create an order when a request is cancelled after admission succeeds', async () => {
    const record = queuedRecord();
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      claimForProcessing: jest.fn().mockResolvedValue(record),
      updateProgress: jest.fn()
        .mockResolvedValueOnce(record)
        .mockResolvedValueOnce(record)
        .mockResolvedValueOnce(null),
      markOrderCreated: jest.fn(),
      updateStatus: jest.fn(),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB1' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn(),
    };
    const queue: any = {
      ackProcessed: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.processRequest('GRAB1');

    expect(orderClient.createOrder).not.toHaveBeenCalled();
    expect(repository.markOrderCreated).not.toHaveBeenCalled();
    expect(admission.release).toHaveBeenCalledWith(expect.objectContaining({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 1,
      quantity: 2,
      restoreStock: true,
    }));
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB1', 12);
  });

  it('does not release the redis hold when grab persistence fails after order creation succeeds', async () => {
    const record = queuedRecord();
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      claimForProcessing: jest.fn().mockResolvedValue(record),
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn().mockRejectedValue(new Error('database unavailable')),
      updateStatus: jest.fn(),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB1' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', amount: 1960 }),
    };
    const queue: any = {
      ackProcessed: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.processRequest('GRAB1');

    expect(orderClient.createOrder).toHaveBeenCalled();
    expect(repository.markOrderCreated).toHaveBeenCalled();
    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalledWith('GRAB1', GRAB_STATUS.FAILED, 'database unavailable');
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB1', 12);
  });

  it('does not run overlapping polls', async () => {
    const activeSessions = deferred<number[]>();
    const repository: any = {};
    const admission: any = {};
    const orderClient: any = {};
    const queue: any = {
      getActiveSessions: jest.fn().mockReturnValue(activeSessions.promise),
      dequeue: jest.fn(),
      removeActiveSessionIfQueueEmpty: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    const firstPoll = service.pollOnce();
    const secondPoll = service.pollOnce();
    activeSessions.resolve([]);
    await Promise.all([firstPoll, secondPoll]);

    expect(queue.getActiveSessions).toHaveBeenCalledTimes(1);
  });

  it('discards orphan inflight queue items when the database row is missing', async () => {
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      claimForProcessing: jest.fn(),
    };
    const admission: any = {};
    const orderClient: any = {};
    const queue: any = {
      getActiveSessions: jest.fn().mockResolvedValue([101]),
      dequeue: jest.fn().mockResolvedValue('GRAB-MISSING'),
      discardInflight: jest.fn(),
      removeActiveSessionIfQueueEmpty: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.pollOnce();

    expect(repository.claimForProcessing).not.toHaveBeenCalled();
    expect(queue.discardInflight).toHaveBeenCalledWith(101, 'GRAB-MISSING');
    expect(queue.removeActiveSessionIfQueueEmpty).toHaveBeenCalledWith(101);
  });

  it('downgrades to the next authorized ticket type after sold out', async () => {
    const record = queuedRecord({
      ticketTypeId: 1,
      requestedTicketTypes: [
        { ticketTypeId: 1, name: 'A', maxPrice: 1280 },
        { ticketTypeId: 2, name: 'B', maxPrice: 980 },
      ],
      allowAutoDowngrade: true,
      attemptsSnapshot: [
        { ticketTypeId: 1, name: 'A', status: 'PENDING', message: 'pending' },
        { ticketTypeId: 2, name: 'B', status: 'PENDING', message: 'pending' },
      ],
    });
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      claimForProcessing: jest.fn().mockResolvedValue(record),
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn().mockResolvedValue({ ...record, orderId: 9002, matchedTicketTypeId: 2 }),
      updateStatus: jest.fn(),
    };
    const admission: any = {
      admit: jest.fn()
        .mockResolvedValueOnce({ outcome: 'SOLD_OUT', existingRequestId: null })
        .mockResolvedValueOnce({ outcome: 'ACCEPTED', existingRequestId: 'GRAB1' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockResolvedValue({ id: 9002, orderNo: 'O2', amount: 1960 }),
    };
    const queue: any = {
      ackProcessed: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.processRequest('GRAB1');

    expect(admission.admit).toHaveBeenNthCalledWith(1, expect.objectContaining({ ticketTypeId: 1 }));
    expect(admission.admit).toHaveBeenNthCalledWith(2, expect.objectContaining({ ticketTypeId: 2 }));
    expect(orderClient.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      ticketTypeId: 2,
      authorizedMaxUnitPrice: 980,
      matchedTicketTypeId: 2,
      autoDowngraded: true,
    }));
    expect(repository.markOrderCreated).toHaveBeenCalledWith('GRAB1', 9002, 2, expect.arrayContaining([
      expect.objectContaining({ ticketTypeId: 1, status: 'SOLD_OUT' }),
      expect.objectContaining({ ticketTypeId: 2, status: 'ORDER_CREATED' }),
    ]));
    expect(repository.updateProgress).toHaveBeenCalledWith('GRAB1', expect.objectContaining({
      status: GRAB_STATUS.DOWNGRADING,
      message: 'A sold out, trying B',
    }));
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB1', 12);
  });

  it('marks sold out when downgrade is not authorized', async () => {
    const record = queuedRecord({
      requestedTicketTypes: [
        { ticketTypeId: 1, name: 'A', maxPrice: 1280 },
        { ticketTypeId: 2, name: 'B', maxPrice: 980 },
      ],
      allowAutoDowngrade: false,
    });
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      claimForProcessing: jest.fn().mockResolvedValue(record),
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.SOLD_OUT }),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'SOLD_OUT', existingRequestId: null }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn(),
    };
    const queue: any = {
      ackProcessed: jest.fn(),
    };
    const service = new GrabWorkerService(repository, admission, orderClient, queue);

    await service.processRequest('GRAB1');

    expect(admission.admit).toHaveBeenCalledTimes(1);
    expect(orderClient.createOrder).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB1', GRAB_STATUS.SOLD_OUT, 'ticket type sold out');
    expect(queue.ackProcessed).toHaveBeenCalledWith(101, 'GRAB1', 12);
  });
});
