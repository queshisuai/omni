import { GRAB_STATUS } from '../grab/grab-status';
import { TeamLockRecoveryService } from './team-lock-recovery.service';
import type { TeamGrabRequestRecord, TicketTeamMemberRecord } from './team-grab.types';

const now = new Date('2026-05-30T12:00:00.000Z');

const staleTeamGrab: TeamGrabRequestRecord = {
  id: 1,
  requestId: 'TEAM-GRAB-1',
  grabRequestId: 'GRAB-1',
  teamId: 7,
  triggerUserId: 200,
  payerUserId: 100,
  sessionId: 20,
  ticketTypeId: 30,
  quantity: 2,
  strategy: 'SAME_BLOCK',
  fallbacks: [],
  matchedStrategy: 'SAME_BLOCK',
  status: 'GRABBING',
  orderId: null,
  lockedSeatIds: [501, 502],
  seatLabels: ['A-1', 'A-2'],
  failReason: null,
  createTime: now,
  updateTime: now,
};

function member(userId: number): TicketTeamMemberRecord {
  return {
    id: userId,
    teamId: 7,
    sessionId: 20,
    userId,
    role: userId === 100 ? 'LEADER' : 'MEMBER',
    status: 'CONFIRMED',
    seatId: null,
    orderSeatId: null,
    joinTime: now,
  };
}

describe('TeamLockRecoveryService', () => {
  it('releases stale pre-order ticket locks and marks team failed', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(undefined),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreatedFromProgressStatuses: jest.fn().mockResolvedValue({
        requestId: 'GRAB-1',
        status: GRAB_STATUS.ORDER_CREATED,
        progressStatus: GRAB_STATUS.ORDER_CREATED,
        orderId: 9001,
      }),
      markOrderCreated: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const orderClient = {
      findByGrabRequestId: jest.fn().mockResolvedValue(null),
    };
    const ticketClient = {
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const queueService = {
      removeQueuedRequest: jest.fn().mockResolvedValue(undefined),
    };
    const notificationClient = {
      sendFailed: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TeamLockRecoveryService(
      repository as any,
      grabRepository as any,
      orderClient as any,
      ticketClient as any,
      queueService as any,
      notificationClient as any,
    );

    await service.recoverStaleLocks();

    expect(repository.findStalePreOrderTeamGrabRequests).toHaveBeenCalledWith(100, 30);
    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-1');
    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', [501, 502]);
    expect(repository.markTeamFailed).toHaveBeenCalledWith(7, 'TEAM-GRAB-1', 'ORDER_CREATE_TIMEOUT');
    expect(grabRepository.updateStatus).toHaveBeenCalledWith('GRAB-1', GRAB_STATUS.FAILED, 'ORDER_CREATE_TIMEOUT');
    expect(queueService.removeQueuedRequest).toHaveBeenCalledWith(20, 'GRAB-1');
    expect(notificationClient.sendFailed).toHaveBeenCalledWith(100, null);
    expect(notificationClient.sendFailed).toHaveBeenCalledWith(200, null);
  });

  it('recovers stale pre-order locks as order-created when lookup finds an order', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(undefined),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreatedFromProgressStatuses: jest.fn().mockResolvedValue({
        requestId: 'GRAB-1',
        status: GRAB_STATUS.ORDER_CREATED,
        progressStatus: GRAB_STATUS.ORDER_CREATED,
        orderId: 9001,
      }),
      markOrderCreated: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const orderClient = {
      findByGrabRequestId: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', status: 'PENDING', grabRequestId: 'GRAB-1' }),
    };
    const ticketClient = {
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const queueService = {
      removeQueuedRequest: jest.fn().mockResolvedValue(undefined),
    };
    const notificationClient = {
      sendFailed: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TeamLockRecoveryService(
      repository as any,
      grabRepository as any,
      orderClient as any,
      ticketClient as any,
      queueService as any,
      notificationClient as any,
    );

    await service.recoverStaleLocks();

    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-1');
    expect(repository.markTeamGrabOrderCreated).toHaveBeenCalledWith('TEAM-GRAB-1', 9001);
    expect(repository.updateTeamStatus).toHaveBeenCalledWith(7, 'LOCKED', ['GRABBING', 'LOCKED']);
    expect(grabRepository.markOrderCreatedFromProgressStatuses).toHaveBeenCalledWith(
      'GRAB-1',
      9001,
      30,
      [],
      [GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.PENDING_RECOVERY],
    );
    expect(grabRepository.markOrderCreated).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });

  it('leaves stale locks untouched when found order cannot mark grab order created', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(undefined),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreatedFromProgressStatuses: jest.fn().mockResolvedValue(null),
      markOrderCreated: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const orderClient = {
      findByGrabRequestId: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'O1', status: 'PENDING', grabRequestId: 'GRAB-1' }),
    };
    const ticketClient = {
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const queueService = {
      removeQueuedRequest: jest.fn().mockResolvedValue(undefined),
    };
    const notificationClient = {
      sendFailed: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TeamLockRecoveryService(
      repository as any,
      grabRepository as any,
      orderClient as any,
      ticketClient as any,
      queueService as any,
      notificationClient as any,
    );

    await service.recoverStaleLocks();

    expect(grabRepository.markOrderCreatedFromProgressStatuses).toHaveBeenCalledWith(
      'GRAB-1',
      9001,
      30,
      [],
      [GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.PENDING_RECOVERY],
    );
    expect(repository.markTeamGrabOrderCreated).not.toHaveBeenCalled();
    expect(repository.updateTeamStatus).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });

  it('does not release or fail stale locks when order lookup throws', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue(undefined),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(undefined),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreated: jest.fn().mockResolvedValue(undefined),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const orderClient = {
      findByGrabRequestId: jest.fn().mockRejectedValue(new Error('order lookup unavailable')),
    };
    const ticketClient = {
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const queueService = {
      removeQueuedRequest: jest.fn().mockResolvedValue(undefined),
    };
    const notificationClient = {
      sendFailed: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TeamLockRecoveryService(
      repository as any,
      grabRepository as any,
      orderClient as any,
      ticketClient as any,
      queueService as any,
      notificationClient as any,
    );

    await service.recoverStaleLocks();

    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-1');
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });
});
