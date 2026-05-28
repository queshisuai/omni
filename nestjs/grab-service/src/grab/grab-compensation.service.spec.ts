import { GrabCompensationService } from './grab-compensation.service';
import { GRAB_STATUS } from './grab-status';

describe('GrabCompensationService', () => {
  it('expires in-flight requests and releases redis holds', async () => {
    const expired = {
      requestId: 'GRAB1',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [301, 302],
      idempotencyKey: 'idem-1',
      orderId: null,
    };
    const repository: any = {
      findExpiredInFlight: jest.fn().mockResolvedValue([expired]),
      updateStatus: jest.fn().mockResolvedValue({ ...expired, status: GRAB_STATUS.EXPIRED, failReason: '抢票请求已超时' }),
    };
    const admission: any = { release: jest.fn() };
    const service = new GrabCompensationService(repository, admission);

    await service.sweepExpiredRequests();

    expect(admission.release).toHaveBeenCalledWith(expired);
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB1', GRAB_STATUS.EXPIRED, '抢票请求已超时');
  });

  it('expires request with existing order without releasing redis hold', async () => {
    const expiredWithOrder = {
      requestId: 'GRAB2',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      idempotencyKey: 'idem-2',
      orderId: 9001,
    };
    const repository: any = {
      findExpiredInFlight: jest.fn().mockResolvedValue([expiredWithOrder]),
      updateStatus: jest.fn().mockResolvedValue({ ...expiredWithOrder, status: GRAB_STATUS.EXPIRED, failReason: '抢票请求已超时' }),
    };
    const admission: any = { release: jest.fn() };
    const service = new GrabCompensationService(repository, admission);

    await service.sweepExpiredRequests();

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB2', GRAB_STATUS.EXPIRED, '抢票请求已超时');
  });
});
