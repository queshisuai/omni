import { GrabCompensationService } from './grab-compensation.service';
import { GRAB_STATUS } from './grab-status';

const EXPIRED_MESSAGE = '抢票请求已超时';

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
    progressStatus: 'QUEUED',
    ...overrides,
  };
}

function buildService(expiredRequests: Array<Record<string, unknown>>) {
  const repository: any = {
    findExpiredInFlight: jest.fn().mockResolvedValue(expiredRequests),
    updateStatus: jest.fn().mockImplementation((requestId, status, failReason) => Promise.resolve({
      ...expiredRequests.find((request) => request.requestId === requestId),
      status,
      failReason,
    })),
  };
  const admission: any = { release: jest.fn() };
  const service = new GrabCompensationService(repository, admission);

  return { repository, admission, service };
}

describe('GrabCompensationService', () => {
  it('expires queued requests without releasing redis holds', async () => {
    const expired = buildExpiredRequest({ requestId: 'GRAB-QUEUED', progressStatus: 'QUEUED' });
    const { repository, admission, service } = buildService([expired]);

    await service.sweepExpiredRequests();

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB-QUEUED', GRAB_STATUS.EXPIRED, EXPIRED_MESSAGE);
  });

  it.each(['WAITING', 'TRYING_TICKET_TYPE'])('expires %s requests without releasing redis holds', async (progressStatus) => {
    const expired = buildExpiredRequest({ requestId: `GRAB-${progressStatus}`, progressStatus });
    const { repository, admission, service } = buildService([expired]);

    await service.sweepExpiredRequests();

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith(`GRAB-${progressStatus}`, GRAB_STATUS.EXPIRED, EXPIRED_MESSAGE);
  });

  it.each(['LOCKING', 'ORDER_CREATING'])('expires %s requests and releases redis holds when no order exists', async (progressStatus) => {
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
    expect(repository.updateStatus).toHaveBeenCalledWith(`GRAB-${progressStatus}`, GRAB_STATUS.EXPIRED, EXPIRED_MESSAGE);
  });

  it('expires request with existing order without releasing redis hold', async () => {
    const expiredWithOrder = buildExpiredRequest({
      requestId: 'GRAB2',
      quantity: 1,
      seatIds: [],
      idempotencyKey: 'idem-2',
      orderId: 9001,
      progressStatus: 'ORDER_CREATING',
    });
    const { repository, admission, service } = buildService([expiredWithOrder]);

    await service.sweepExpiredRequests();

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB2', GRAB_STATUS.EXPIRED, EXPIRED_MESSAGE);
  });
});
