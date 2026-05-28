import { GrabController } from './grab.controller';
import { GRAB_STATUS } from './grab-status';

describe('GrabController', () => {
  it('submits grab request using authenticated user id', async () => {
    const service: any = {
      submitRequest: jest.fn().mockResolvedValue({ requestId: 'GRAB1', status: GRAB_STATUS.ORDER_CREATED, orderId: 9001, failReason: null }),
    };
    const controller = new GrabController(service);

    const result = await controller.submit({ user: { userId: 2004 } } as any, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-1',
    });

    expect(service.submitRequest).toHaveBeenCalledWith(2004, {
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-1',
    });
    expect(result).toEqual({ code: 200, message: 'success', data: { requestId: 'GRAB1', status: GRAB_STATUS.ORDER_CREATED, orderId: 9001, failReason: null } });
  });

  it('ignores body userId and always uses authenticated user id', async () => {
    const service: any = {
      submitRequest: jest.fn().mockResolvedValue({ requestId: 'GRAB2', status: GRAB_STATUS.ORDER_CREATED, orderId: 9002, failReason: null }),
    };
    const controller = new GrabController(service);

    const result = await controller.submit({ user: { userId: 2004 } } as any, {
      userId: 9999,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-body-user',
    } as any);

    expect(service.submitRequest).toHaveBeenCalledWith(2004, {
      userId: 9999,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-body-user',
    });
    expect(service.submitRequest).not.toHaveBeenCalledWith(9999, expect.anything());
    expect(result).toEqual({ code: 200, message: 'success', data: { requestId: 'GRAB2', status: GRAB_STATUS.ORDER_CREATED, orderId: 9002, failReason: null } });
  });
});
