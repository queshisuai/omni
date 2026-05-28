import { GRAB_STATUS } from './grab-status';
import { GrabService } from './grab.service';


describe('GrabService', () => {
  it('generates unique request ids under high concurrency volume', () => {
    const service = new GrabService({} as any, {} as any, {} as any);
    const ids = Array.from({ length: 5000 }, () => service['generateRequestId']());

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^GRAB[0-9a-f]{24}$/.test(id))).toBe(true);
  });

  it('creates an order after redis admission succeeds', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockResolvedValue({
        requestId: 'GRAB202605270001',
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 2,
        seatIds: [301, 302],
        allocateRandom: false,
        idempotencyKey: 'idem-1',
        status: GRAB_STATUS.PENDING,
        orderId: null,
        failReason: null,
      }),
      updateStatus: jest.fn().mockImplementation((requestId, status) => Promise.resolve({
        requestId,
        status,
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 2,
        seatIds: [301, 302],
        allocateRandom: false,
        idempotencyKey: 'idem-1',
        orderId: null,
        failReason: null,
      })),
      markOrderCreated: jest.fn().mockResolvedValue({
        requestId: 'GRAB202605270001',
        status: GRAB_STATUS.ORDER_CREATED,
        orderId: 9001,
        failReason: null,
      }),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB202605270001' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', amount: 200 }),
    };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [301, 302],
      allocateRandom: false,
      idempotencyKey: 'idem-1',
    });

    expect(admission.admit).toHaveBeenCalled();
    expect(orderClient.createOrder).toHaveBeenCalledWith({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [301, 302],
      allocateRandom: false,
    });
    expect(repository.markOrderCreated).toHaveBeenCalledWith('GRAB202605270001', 9001);
    expect(result).toEqual({ requestId: 'GRAB202605270001', status: GRAB_STATUS.ORDER_CREATED, orderId: 9001, failReason: null });
  });

  it('restores redis stock when order creation fails after accepted admission', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockResolvedValue({
        requestId: 'GRAB202605270002',
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 1,
        seatIds: [],
        allocateRandom: false,
        idempotencyKey: 'idem-2',
        status: GRAB_STATUS.PENDING,
        orderId: null,
        failReason: null,
      }),
      updateStatus: jest.fn().mockImplementation((requestId, status, failReason = null) => Promise.resolve({
        requestId,
        status,
        orderId: null,
        failReason,
      })),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB202605270002' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockRejectedValue(new Error('订单创建失败')),
    };
    const service = new GrabService(repository, admission, orderClient);

    await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-2',
    });

    expect(admission.release).toHaveBeenCalledWith({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      idempotencyKey: 'idem-2',
      restoreStock: true,
    });
  });

  it('restores redis stock and marks sold out when order creation reports stock failure after accepted admission', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockResolvedValue({
        requestId: 'GRAB202605270003',
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 2,
        seatIds: [302, 301],
        allocateRandom: false,
        idempotencyKey: 'idem-stock',
        status: GRAB_STATUS.PENDING,
        orderId: null,
        failReason: null,
      }),
      updateStatus: jest.fn().mockImplementation((requestId, status, failReason = null) => Promise.resolve({
        requestId,
        status,
        orderId: null,
        failReason,
      })),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB202605270003' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockRejectedValue(new Error('库存锁定失败')),
    };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [302, 301],
      idempotencyKey: 'idem-stock',
    });

    expect(admission.release).toHaveBeenCalledWith({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [301, 302],
      idempotencyKey: 'idem-stock',
      restoreStock: true,
    });
    expect(repository.updateStatus).toHaveBeenLastCalledWith('GRAB202605270003', GRAB_STATUS.SOLD_OUT, '库存锁定失败');
    expect(result).toEqual({ requestId: 'GRAB202605270003', status: GRAB_STATUS.SOLD_OUT, orderId: null, failReason: '库存锁定失败' });
  });

  it('restores redis stock and clears all holds when order creation times out after accepted admission', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockResolvedValue({
        requestId: 'GRAB202605270004',
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 2,
        seatIds: [401, 402],
        allocateRandom: false,
        idempotencyKey: 'idem-timeout',
        status: GRAB_STATUS.PENDING,
        orderId: null,
        failReason: null,
      }),
      updateStatus: jest.fn().mockImplementation((requestId, status, failReason = null) => Promise.resolve({
        requestId,
        status,
        orderId: null,
        failReason,
      })),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', existingRequestId: 'GRAB202605270004' }),
      release: jest.fn(),
    };
    const orderClient: any = {
      createOrder: jest.fn().mockRejectedValue(new Error('订单服务超时')),
    };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [401, 402],
      idempotencyKey: 'idem-timeout',
    });

    expect(admission.release).toHaveBeenCalledWith({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [401, 402],
      idempotencyKey: 'idem-timeout',
      restoreStock: true,
    });
    expect(repository.updateStatus).toHaveBeenLastCalledWith('GRAB202605270004', GRAB_STATUS.FAILED, '订单服务超时');
    expect(result).toEqual({ requestId: 'GRAB202605270004', status: GRAB_STATUS.FAILED, orderId: null, failReason: '订单服务超时' });
  });

  it('marks request failed and does not create order when redis stock is uninitialized', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockResolvedValue({
        requestId: 'GRAB202605270003',
        userId: 2004,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 1,
        seatIds: [],
        allocateRandom: false,
        idempotencyKey: 'idem-3',
        status: GRAB_STATUS.PENDING,
        orderId: null,
        failReason: null,
      }),
      updateStatus: jest.fn().mockImplementation((requestId, status, failReason = null) => Promise.resolve({
        requestId,
        status,
        orderId: null,
        failReason,
      })),
    };
    const admission: any = {
      admit: jest.fn().mockResolvedValue({ outcome: 'STOCK_UNINITIALIZED', existingRequestId: null }),
      release: jest.fn(),
    };
    const orderClient: any = { createOrder: jest.fn() };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-3',
    });

    expect(orderClient.createOrder).not.toHaveBeenCalled();
    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB202605270003', GRAB_STATUS.FAILED, '抢票库存未初始化');
    expect(result).toEqual({ requestId: 'GRAB202605270003', status: GRAB_STATUS.FAILED, orderId: null, failReason: '抢票库存未初始化' });
  });

  it('returns existing active request for the same grab intent', async () => {
    const existing = {
      requestId: 'GRAB-EXISTING',
      status: GRAB_STATUS.ORDER_CREATED,
      orderId: 9001,
      failReason: null,
    };
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findActiveByIntent: jest.fn().mockResolvedValue(existing),
      createPending: jest.fn(),
    };
    const admission: any = { admit: jest.fn() };
    const orderClient: any = { createOrder: jest.fn() };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [302, 301],
      allocateRandom: false,
      idempotencyKey: 'new-key',
    });

    expect(repository.findActiveByIntent).toHaveBeenCalledWith({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [301, 302],
      allocateRandom: false,
    });
    expect(repository.createPending).not.toHaveBeenCalled();
    expect(orderClient.createOrder).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it('returns existing request when concurrent insert hits user idempotency unique constraint', async () => {
    const existing = { requestId: 'GRAB-EXISTING', status: GRAB_STATUS.ORDER_CREATED, orderId: 9001, failReason: null };
    const uniqueError: any = new Error('duplicate key');
    uniqueError.code = '23505';
    const repository: any = {
      findByUserAndIdempotency: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing),
      findActiveByIntent: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockRejectedValue(uniqueError),
    };
    const admission: any = { admit: jest.fn() };
    const orderClient: any = { createOrder: jest.fn() };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.submitRequest(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-1',
    });

    expect(admission.admit).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
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
      failReason: '抢票库存未初始化',
    };
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
    };
    const admission: any = { release: jest.fn() };
    const orderClient: any = { createOrder: jest.fn() };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.cancelRequest(2004, 'GRAB-FAILED');

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(result).toEqual({ requestId: 'GRAB-FAILED', status: GRAB_STATUS.FAILED, orderId: null, failReason: '抢票库存未初始化' });
  });
});
