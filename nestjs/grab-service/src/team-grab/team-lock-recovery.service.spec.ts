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
    seatLabel: null,
    joinTime: now,
  };
}

describe('TeamLockRecoveryService', () => {
  it('claims stale missing-order recovery first without releasing locked seats', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      claimStalePreOrderRecovery: jest.fn().mockResolvedValue(staleTeamGrab),
      claimStalePreOrderRelease: jest.fn(),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markClaimedTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      repairTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(true),
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
    expect(orderClient.findByGrabRequestId).toHaveBeenCalledTimes(1);
    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-1');
    expect(repository.claimStalePreOrderRecovery).toHaveBeenCalledWith('TEAM-GRAB-1', 30);
    expect(repository.claimStalePreOrderRelease).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });

  it('releases claimed stale pre-order ticket locks only after winning release claim', async () => {
    const claimedTeamGrab = { ...staleTeamGrab, failReason: 'ORDER_CREATE_TIMEOUT_CLAIMED' };
    const releasingTeamGrab = { ...claimedTeamGrab, failReason: 'ORDER_CREATE_TIMEOUT_RELEASING' };
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([claimedTeamGrab]),
      claimStalePreOrderRecovery: jest.fn(),
      claimStalePreOrderRelease: jest.fn().mockResolvedValue(releasingTeamGrab),
      markTeamGrabOrderCreated: jest.fn(),
      markClaimedTeamGrabOrderCreated: jest.fn(),
      repairTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(true),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreatedFromProgressStatuses: jest.fn(),
      findByRequestId: jest.fn(),
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

    expect(repository.claimStalePreOrderRecovery).not.toHaveBeenCalled();
    expect(repository.claimStalePreOrderRelease).toHaveBeenCalledWith('TEAM-GRAB-1', 30);
    expect(orderClient.findByGrabRequestId).toHaveBeenCalledTimes(2);
    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', [501, 502]);
    expect(repository.markTeamFailed).toHaveBeenCalledWith(7, 'TEAM-GRAB-1', 'ORDER_CREATE_TIMEOUT');
    expect(grabRepository.updateStatus).toHaveBeenCalledWith('GRAB-1', GRAB_STATUS.FAILED, 'ORDER_CREATE_TIMEOUT');
    expect(queueService.removeQueuedRequest).toHaveBeenCalledWith(20, 'GRAB-1');
    expect(notificationClient.sendFailed).toHaveBeenCalledWith(100, null);
    expect(notificationClient.sendFailed).toHaveBeenCalledWith(200, null);
  });

  it('leaves stale locks untouched when stale recovery loses the claim', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      claimStalePreOrderRecovery: jest.fn().mockResolvedValue(null),
      claimStalePreOrderRelease: jest.fn(),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markClaimedTeamGrabOrderCreated: jest.fn(),
      repairTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(false),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreatedFromProgressStatuses: jest.fn(),
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

    expect(repository.claimStalePreOrderRecovery).toHaveBeenCalledWith('TEAM-GRAB-1', 30);
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });

  it('recovers stale pre-order locks as order-created when lookup finds an order', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      claimStalePreOrderRecovery: jest.fn(),
      claimStalePreOrderRelease: jest.fn(),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markClaimedTeamGrabOrderCreated: jest.fn(),
      repairTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
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
      findByRequestId: jest.fn(),
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
    expect(repository.claimStalePreOrderRecovery).not.toHaveBeenCalled();
    expect(repository.repairTeamGrabOrderCreated).toHaveBeenCalledWith('TEAM-GRAB-1', 9001);
    expect(repository.markClaimedTeamGrabOrderCreated).not.toHaveBeenCalled();
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

  it('continues found-order recovery when generic grab is already order-created with matching order', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      claimStalePreOrderRecovery: jest.fn(),
      claimStalePreOrderRelease: jest.fn(),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markClaimedTeamGrabOrderCreated: jest.fn(),
      repairTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(undefined),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreatedFromProgressStatuses: jest.fn().mockResolvedValue(null),
      findByRequestId: jest.fn().mockResolvedValue({
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

    expect(grabRepository.markOrderCreatedFromProgressStatuses).toHaveBeenCalledWith(
      'GRAB-1',
      9001,
      30,
      [],
      [GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.PENDING_RECOVERY],
    );
    expect(grabRepository.findByRequestId).toHaveBeenCalledWith('GRAB-1');
    expect(repository.claimStalePreOrderRecovery).not.toHaveBeenCalled();
    expect(repository.repairTeamGrabOrderCreated).toHaveBeenCalledWith('TEAM-GRAB-1', 9001);
    expect(repository.updateTeamStatus).toHaveBeenCalledWith(7, 'LOCKED', ['GRABBING', 'LOCKED']);
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });

  it('does not mark team locked when found-order team grab repair returns null', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      claimStalePreOrderRecovery: jest.fn(),
      claimStalePreOrderRelease: jest.fn(),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue(null),
      markClaimedTeamGrabOrderCreated: jest.fn(),
      repairTeamGrabOrderCreated: jest.fn().mockResolvedValue(null),
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
      findByRequestId: jest.fn(),
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

    expect(repository.repairTeamGrabOrderCreated).toHaveBeenCalledWith('TEAM-GRAB-1', 9001);
    expect(repository.updateTeamStatus).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
  });

  it('does not release or fail stale locks when order lookup throws', async () => {
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([staleTeamGrab]),
      claimStalePreOrderRecovery: jest.fn(),
      claimStalePreOrderRelease: jest.fn(),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue(undefined),
      markClaimedTeamGrabOrderCreated: jest.fn(),
      repairTeamGrabOrderCreated: jest.fn(),
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
    expect(repository.claimStalePreOrderRecovery).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });

  it('does not release when claimed release lookup throws, then later recovers claimed row when first lookup finds order', async () => {
    const claimedTeamGrab = { ...staleTeamGrab, failReason: 'ORDER_CREATE_TIMEOUT_CLAIMED' };
    const releasingTeamGrab = { ...claimedTeamGrab, failReason: 'ORDER_CREATE_TIMEOUT_RELEASING' };
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn()
        .mockResolvedValueOnce([claimedTeamGrab])
        .mockResolvedValueOnce([claimedTeamGrab]),
      claimStalePreOrderRecovery: jest.fn(),
      claimStalePreOrderRelease: jest.fn().mockResolvedValueOnce(releasingTeamGrab),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markClaimedTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      repairTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...staleTeamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(true),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreatedFromProgressStatuses: jest.fn().mockResolvedValue({
        requestId: 'GRAB-1',
        status: GRAB_STATUS.ORDER_CREATED,
        progressStatus: GRAB_STATUS.ORDER_CREATED,
        orderId: 9001,
      }),
      findByRequestId: jest.fn(),
      markOrderCreated: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const orderClient = {
      findByGrabRequestId: jest.fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('order lookup unavailable'))
        .mockResolvedValueOnce({ id: 9001, orderNo: 'O1', status: 'PENDING', grabRequestId: 'GRAB-1' }),
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
    await service.recoverStaleLocks();

    expect(orderClient.findByGrabRequestId).toHaveBeenCalledTimes(3);
    expect(repository.claimStalePreOrderRelease).toHaveBeenCalledWith('TEAM-GRAB-1', 30);
    expect(repository.repairTeamGrabOrderCreated).toHaveBeenCalledWith('TEAM-GRAB-1', 9001);
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });

  it('leaves claimed stale locks untouched when second order lookup throws', async () => {
    const claimedTeamGrab = { ...staleTeamGrab, failReason: 'ORDER_CREATE_TIMEOUT_CLAIMED' };
    const releasingTeamGrab = { ...claimedTeamGrab, failReason: 'ORDER_CREATE_TIMEOUT_RELEASING' };
    const repository = {
      findStalePreOrderTeamGrabRequests: jest.fn().mockResolvedValue([claimedTeamGrab]),
      claimStalePreOrderRecovery: jest.fn(),
      claimStalePreOrderRelease: jest.fn().mockResolvedValue(releasingTeamGrab),
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue(undefined),
      markClaimedTeamGrabOrderCreated: jest.fn().mockResolvedValue(undefined),
      repairTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn().mockResolvedValue(undefined),
      markTeamFailed: jest.fn().mockResolvedValue(true),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      markOrderCreatedFromProgressStatuses: jest.fn(),
      markOrderCreated: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const orderClient = {
      findByGrabRequestId: jest.fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('order lookup unavailable')),
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

    expect(orderClient.findByGrabRequestId).toHaveBeenCalledTimes(2);
    expect(repository.claimStalePreOrderRecovery).not.toHaveBeenCalled();
    expect(repository.claimStalePreOrderRelease).toHaveBeenCalledWith('TEAM-GRAB-1', 30);
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(repository.markTeamFailed).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });
});
