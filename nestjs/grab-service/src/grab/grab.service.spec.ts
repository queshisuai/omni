import { GRAB_STATUS } from './grab-status';
import { GrabService } from './grab.service';

describe('GrabService', () => {
  it('creates an order after redis admission succeeds', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
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

  it('does not restore redis stock when order creation fails after bypassed admission', async () => {
    const repository: any = {
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
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
      admit: jest.fn().mockResolvedValue({ outcome: 'BYPASSED', existingRequestId: 'GRAB202605270002' }),
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
      restoreStock: false,
    });
  });
});
