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
});
