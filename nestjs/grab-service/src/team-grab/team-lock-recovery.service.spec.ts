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
      markTeamFailed: jest.fn().mockResolvedValue(undefined),
      listConfirmedMembers: jest.fn().mockResolvedValue([member(100), member(200)]),
    };
    const grabRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const ticketClient = {
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const notificationClient = {
      sendFailed: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TeamLockRecoveryService(
      repository as any,
      grabRepository as any,
      ticketClient as any,
      notificationClient as any,
    );

    await service.recoverStaleLocks();

    expect(repository.findStalePreOrderTeamGrabRequests).toHaveBeenCalledWith(100, 30);
    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', [501, 502]);
    expect(repository.markTeamFailed).toHaveBeenCalledWith(7, 'TEAM-GRAB-1', 'ORDER_CREATE_TIMEOUT');
    expect(grabRepository.updateStatus).toHaveBeenCalledWith('GRAB-1', GRAB_STATUS.FAILED, 'ORDER_CREATE_TIMEOUT');
    expect(notificationClient.sendFailed).toHaveBeenCalledWith(100, null);
    expect(notificationClient.sendFailed).toHaveBeenCalledWith(200, null);
  });
});
