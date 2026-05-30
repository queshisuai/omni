import { TeamPaymentSyncService } from './team-payment-sync.service';
import type { TeamGrabRequestRecord, TicketTeamMemberRecord } from './team-grab.types';

const now = new Date('2026-05-30T12:00:00.000Z');

function teamGrab(overrides: Partial<TeamGrabRequestRecord> = {}): TeamGrabRequestRecord {
  return {
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
    status: 'ORDER_CREATED',
    orderId: 9001,
    lockedSeatIds: [501, 502],
    seatLabels: ['A-1', 'A-2'],
    failReason: null,
    createTime: now,
    updateTime: now,
    ...overrides,
  };
}

function member(overrides: Partial<TicketTeamMemberRecord> = {}): TicketTeamMemberRecord {
  return {
    id: 1,
    teamId: 7,
    sessionId: 20,
    userId: 100,
    role: 'LEADER',
    status: 'CONFIRMED',
    seatId: null,
    orderSeatId: null,
    joinTime: now,
    ...overrides,
  };
}

function createService(overrides: any = {}) {
  const repository = {
    findLockedTeamGrabRequests: jest.fn().mockResolvedValue([teamGrab()]),
    listConfirmedMembers: jest.fn().mockResolvedValue([
      member({ userId: 100, role: 'LEADER', joinTime: new Date('2026-05-30T12:00:00.000Z') }),
      member({ id: 2, userId: 200, role: 'MEMBER', joinTime: new Date('2026-05-30T12:01:00.000Z') }),
    ]),
    assignPaidTeamSeats: jest.fn().mockResolvedValue(true),
    markTeamExpired: jest.fn().mockResolvedValue(true),
    ...overrides.repository,
  };
  const orderClient = {
    getOrder: jest.fn().mockResolvedValue({ id: 9001, status: 2, userId: 100, quantity: 2 }),
    listOrderSeats: jest.fn().mockResolvedValue([
      { orderSeatId: 7001, sessionSeatId: 501, seatLabel: 'A-1', status: 2 },
      { orderSeatId: 7002, sessionSeatId: 502, seatLabel: 'A-2', status: 2 },
    ]),
    ...overrides.orderClient,
  };
  const notificationClient = {
    sendPaid: jest.fn().mockResolvedValue(undefined),
    sendExpired: jest.fn().mockResolvedValue(undefined),
    ...overrides.notificationClient,
  };
  const service = new TeamPaymentSyncService(repository as any, orderClient as any, notificationClient as any);
  return { service, repository, orderClient, notificationClient };
}

describe('TeamPaymentSyncService', () => {
  it('assigns paid order seats to confirmed members in leader then join order', async () => {
    const { service, repository } = createService();

    await service.syncLockedTeams();

    expect(repository.assignPaidTeamSeats).toHaveBeenCalledWith(7, 9001, [
      { userId: 100, orderSeatId: 7001, sessionSeatId: 501, seatLabel: 'A-1' },
      { userId: 200, orderSeatId: 7002, sessionSeatId: 502, seatLabel: 'A-2' },
    ]);
  });

  it('sends paid notifications only when this sync transitions the team to paid', async () => {
    const { service, repository, notificationClient } = createService({
      repository: {
        assignPaidTeamSeats: jest.fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false),
      },
    });

    await service.syncLockedTeams();
    await service.syncLockedTeams();

    expect(repository.assignPaidTeamSeats).toHaveBeenCalledTimes(2);
    expect(repository.assignPaidTeamSeats.mock.calls[0][2]).toEqual(repository.assignPaidTeamSeats.mock.calls[1][2]);
    expect(notificationClient.sendPaid).toHaveBeenCalledTimes(2);
  });

  it('marks locked teams expired when the order is cancelled before payment', async () => {
    const { service, repository, notificationClient } = createService({
      orderClient: { getOrder: jest.fn().mockResolvedValue({ id: 9001, status: 3, userId: 100, quantity: 2 }) },
    });

    await service.syncLockedTeams();

    expect(repository.markTeamExpired).toHaveBeenCalledWith(7, 'ORDER_CANCELLED');
    expect(repository.assignPaidTeamSeats).not.toHaveBeenCalled();
    expect(notificationClient.sendExpired).toHaveBeenCalledWith(100, 9001);
    expect(notificationClient.sendExpired).toHaveBeenCalledWith(200, 9001);
  });

  it('does not send expired notifications when cancelled sync loses the locked-to-expired transition', async () => {
    const { service, repository, notificationClient } = createService({
      repository: { markTeamExpired: jest.fn().mockResolvedValue(false) },
      orderClient: { getOrder: jest.fn().mockResolvedValue({ id: 9001, status: 3, userId: 100, quantity: 2 }) },
    });

    await service.syncLockedTeams();

    expect(repository.markTeamExpired).toHaveBeenCalledWith(7, 'ORDER_CANCELLED');
    expect(notificationClient.sendExpired).not.toHaveBeenCalled();
  });

  it('sends paid notifications after assignment and paid marking', async () => {
    const { service, repository, notificationClient } = createService();

    await service.syncLockedTeams();

    expect(notificationClient.sendPaid).toHaveBeenCalledTimes(2);
    expect(notificationClient.sendPaid).toHaveBeenNthCalledWith(1, 100, 9001);
    expect(notificationClient.sendPaid).toHaveBeenNthCalledWith(2, 200, 9001);
    expect(repository.assignPaidTeamSeats.mock.invocationCallOrder[0])
      .toBeLessThan(notificationClient.sendPaid.mock.invocationCallOrder[0]);
  });

  it('does not send paid notifications when paid assignment loses the locked-to-paid transition', async () => {
    const { service, notificationClient } = createService({
      repository: { assignPaidTeamSeats: jest.fn().mockResolvedValue(false) },
    });

    await service.syncLockedTeams();

    expect(notificationClient.sendPaid).not.toHaveBeenCalled();
  });

  it('does not roll back paid state when paid notification fails', async () => {
    const { service, repository } = createService({
      notificationClient: { sendPaid: jest.fn().mockRejectedValue(new Error('notify down')) },
    });

    await service.syncLockedTeams();

    expect(repository.assignPaidTeamSeats).toHaveBeenCalledWith(7, 9001, [
      { userId: 100, orderSeatId: 7001, sessionSeatId: 501, seatLabel: 'A-1' },
      { userId: 200, orderSeatId: 7002, sessionSeatId: 502, seatLabel: 'A-2' },
    ]);
  });

  it('leaves the locked team unchanged when paid order seats do not match confirmed members', async () => {
    const { service, repository } = createService({
      orderClient: {
        listOrderSeats: jest.fn().mockResolvedValue([
          { orderSeatId: 7001, sessionSeatId: 501, seatLabel: 'A-1', status: 2 },
        ]),
      },
    });

    await service.syncLockedTeams();

    expect(repository.assignPaidTeamSeats).not.toHaveBeenCalled();
    expect(repository.markTeamExpired).not.toHaveBeenCalled();
  });
});
