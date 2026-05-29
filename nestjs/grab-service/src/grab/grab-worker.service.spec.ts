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
});
