import { GRAB_STATUS } from '../grab/grab-status';
import { TeamGrabProcessorService } from './team-grab-processor.service';

const now = new Date('2026-05-30T12:00:00.000Z');

function grabRecord(overrides: any = {}) {
  return {
    id: 1,
    requestId: 'GRAB-QUEUED-1',
    idempotencyKey: 'team-grab-1',
    userId: 100,
    sessionId: 20,
    ticketTypeId: 30,
    quantity: 2,
    seatIds: [],
    allocateRandom: true,
    status: GRAB_STATUS.WAITING,
    progressStatus: GRAB_STATUS.WAITING,
    progressMessage: null,
    orderId: null,
    failReason: null,
    requestType: 'TEAM_GRAB',
    queueSeq: 12,
    requestedTicketTypes: [{ ticketTypeId: 30, name: 'VIP', maxPrice: 880 }],
    allowAutoDowngrade: false,
    currentTicketTypeId: 30,
    currentAttemptIndex: 0,
    matchedTicketTypeId: null,
    attemptsSnapshot: [],
    workerId: 'worker-1',
    workerClaimedAt: now,
    processingStartedAt: now,
    completedAt: null,
    expireTime: new Date('2026-05-30T12:15:00.000Z'),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function teamGrabRecord(overrides: any = {}) {
  return {
    id: 7,
    requestId: 'TEAM-GRAB-1',
    grabRequestId: 'GRAB-QUEUED-1',
    teamId: 1,
    triggerUserId: 200,
    payerUserId: 100,
    sessionId: 20,
    ticketTypeId: 30,
    quantity: 2,
    strategy: 'SAME_BLOCK',
    fallbacks: ['SAME_TICKET_TYPE'],
    matchedStrategy: null,
    status: 'PENDING',
    orderId: null,
    lockedSeatIds: [],
    seatLabels: [],
    failReason: null,
    createTime: now,
    updateTime: now,
    ...overrides,
  };
}

function createProcessor(overrides: any = {}) {
  const teamRepository = overrides.teamRepository ?? {};
  const grabRepository = overrides.grabRepository ?? {};
  const ticketClient = overrides.ticketClient ?? {};
  const orderClient = overrides.orderClient ?? {};
  const notificationClient = overrides.notificationClient;
  return {
    processor: new TeamGrabProcessorService(teamRepository, grabRepository, ticketClient, orderClient, notificationClient),
    teamRepository,
    grabRepository,
    ticketClient,
    orderClient,
    notificationClient,
  };
}

describe('TeamGrabProcessorService', () => {
  it('persists locked seats before creating a team order and sends distinct grab ids', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue({
        ...teamGrab,
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      markTeamGrabOrderCreateInProgress: jest.fn().mockResolvedValue({ ...teamGrab, status: 'LOCKED', failReason: 'ORDER_CREATE_IN_PROGRESS' }),
      markTeamGrabOrderCreatedAndLockTeam: jest.fn().mockResolvedValue({ ...teamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.ORDER_CREATED, orderId: 9001 }),
      updateStatus: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'TO1', amount: 1760 }),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(true);

    expect(ticketClient.lockTeamSeats).toHaveBeenCalledWith(expect.objectContaining({
      lockRequestId: 'TEAM-GRAB-1',
      quantity: 2,
      strategy: 'SAME_BLOCK',
      fallbacks: ['SAME_TICKET_TYPE'],
    }));
    const lockInput = ticketClient.lockTeamSeats.mock.calls[0][0];
    expect(lockInput.lockExpireTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(lockInput.lockExpireTime).not.toMatch(/Z$/);
    expect(teamRepository.persistLockedSeats).toHaveBeenCalledWith('TEAM-GRAB-1', {
      lockedSeatIds: [501, 502],
      seatLabels: ['A-1', 'A-2'],
      matchedStrategy: 'SAME_BLOCK',
    });
    expect(teamRepository.persistLockedSeats.mock.invocationCallOrder[0])
      .toBeLessThan(orderClient.createTeamOrderWithLockedSeats.mock.invocationCallOrder[0]);
    expect(orderClient.createTeamOrderWithLockedSeats).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 1,
      userId: 100,
      payerUserId: 100,
      sessionId: 20,
      ticketTypeId: 30,
      quantity: 2,
      teamGrabRequestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-QUEUED-1',
      matchedStrategy: 'SAME_BLOCK',
      authorizedMaxUnitPrice: 880,
      seats: [
        { sessionSeatId: 501, seatLabel: 'A-1' },
        { sessionSeatId: 502, seatLabel: 'A-2' },
      ],
    }));
    const orderInput = orderClient.createTeamOrderWithLockedSeats.mock.calls[0][0];
    expect(orderInput.teamGrabRequestId).not.toBe(orderInput.grabRequestId);
    expect(grabRepository.markOrderCreated).toHaveBeenCalledWith('GRAB-QUEUED-1', 9001, 30, [], GRAB_STATUS.ORDER_CREATING, 'worker-1');
    expect(teamRepository.markTeamGrabOrderCreatedAndLockTeam).toHaveBeenCalledWith('TEAM-GRAB-1', 1, 9001);
    expect(teamRepository.markTeamGrabOrderCreated).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalled();
  });

  it('does not lock seats or create order when grab progress update loses worker fencing', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(null),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(teamRepository.updateTeamGrabStatus).not.toHaveBeenCalled();
    expect(ticketClient.lockTeamSeats).not.toHaveBeenCalled();
    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
  });

  it('does not lock seats or create order when team grab status update fails', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(null),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(ticketClient.lockTeamSeats).not.toHaveBeenCalled();
    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
  });

  it('keeps locked seats and returns false when order is created but grab order persistence returns null', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue({
        ...teamGrab,
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      markTeamGrabOrderCreateInProgress: jest.fn().mockResolvedValue({ ...teamGrab, status: 'LOCKED', failReason: 'ORDER_CREATE_IN_PROGRESS' }),
      markTeamGrabFailed: jest.fn(),
      markTeamGrabOrderCreatedAndLockTeam: jest.fn().mockResolvedValue({ ...teamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn().mockResolvedValue(null),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
      updateStatus: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'TO1', amount: 1760 }),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(grabRepository.markOrderCreated).toHaveBeenCalledWith('GRAB-QUEUED-1', 9001, 30, [], GRAB_STATUS.ORDER_CREATING, 'worker-1');
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, expect.any(String));
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
  });

  it('keeps locked seats and returns false when order is created but grab order persistence throws', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue({
        ...teamGrab,
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      markTeamGrabOrderCreateInProgress: jest.fn().mockResolvedValue({ ...teamGrab, status: 'LOCKED', failReason: 'ORDER_CREATE_IN_PROGRESS' }),
      markTeamGrabFailed: jest.fn(),
      markTeamGrabOrderCreatedAndLockTeam: jest.fn().mockResolvedValue({ ...teamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn().mockRejectedValue(new Error('database unavailable')),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
      updateStatus: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'TO1', amount: 1760 }),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(grabRepository.markOrderCreated).toHaveBeenCalledWith('GRAB-QUEUED-1', 9001, 30, [], GRAB_STATUS.ORDER_CREATING, 'worker-1');
    expect(grabRepository.markPendingRecovery).toHaveBeenCalled();
  });

  it('keeps locked seats and returns false when atomic team order-created transition returns null', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue({
        ...teamGrab,
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      markTeamGrabOrderCreateInProgress: jest.fn().mockResolvedValue({ ...teamGrab, status: 'LOCKED', failReason: 'ORDER_CREATE_IN_PROGRESS' }),
      markTeamGrabOrderCreatedAndLockTeam: jest.fn().mockResolvedValue(null),
      markTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn(),
      markTeamGrabFailed: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn(),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
      updateStatus: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'TO1', amount: 1760 }),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(teamRepository.markTeamGrabOrderCreatedAndLockTeam).toHaveBeenCalledWith('TEAM-GRAB-1', 1, 9001);
    expect(teamRepository.markTeamGrabOrderCreated).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalled();
    expect(grabRepository.markOrderCreated).not.toHaveBeenCalled();
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
  });

  it('keeps locked seats and returns false when atomic team order-created transition throws', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue({
        ...teamGrab,
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      markTeamGrabOrderCreateInProgress: jest.fn().mockResolvedValue({ ...teamGrab, status: 'LOCKED', failReason: 'ORDER_CREATE_IN_PROGRESS' }),
      markTeamGrabOrderCreatedAndLockTeam: jest.fn().mockRejectedValue(new Error('failed to mark team locked')),
      markTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn(),
      markTeamGrabFailed: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      markOrderCreated: jest.fn(),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
      updateStatus: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'TO1', amount: 1760 }),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(teamRepository.markTeamGrabOrderCreatedAndLockTeam).toHaveBeenCalledWith('TEAM-GRAB-1', 1, 9001);
    expect(teamRepository.markTeamGrabOrderCreated).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalled();
    expect(grabRepository.markOrderCreated).not.toHaveBeenCalled();
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
  });

  it('marks grab and team failed when ticket lock fails', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ ...teamGrab, status: 'FAILED' }),
      updateTeamStatus: jest.fn().mockResolvedValue({ id: 1, status: 'FAILED' }),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.FAILED }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockRejectedValue(new Error('no team seat strategy can satisfy quantity')),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(true);

    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', []);
    expect(grabRepository.updateStatus).toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, 'no team seat strategy can satisfy quantity');
    expect(teamRepository.markTeamGrabFailed).toHaveBeenCalledWith('TEAM-GRAB-1', 'no team seat strategy can satisfy quantity');
    expect(teamRepository.updateTeamStatus).toHaveBeenCalledWith(1, 'FAILED', ['GRABBING', 'READY']);
  });

  it('marks pending recovery when ticket lock timeout leaves unknown request-id locks', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      markTeamGrabReleasePending: jest.fn(),
      markTeamGrabRequestIdReleasePending: jest.fn().mockResolvedValue({
        ...teamGrab,
        status: 'GRABBING',
        lockedSeatIds: [],
        seatLabels: [],
        failReason: 'ORDER_CREATE_RELEASE_PENDING',
      }),
      markTeamGrabFailed: jest.fn(),
      updateTeamStatus: jest.fn().mockResolvedValue({ id: 1, status: 'FAILED' }),
      listConfirmedMembers: jest.fn().mockResolvedValue([{ userId: 100, status: 'CONFIRMED' }]),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockRejectedValue(new Error('ticket service timeout')),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(false),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const notificationClient: any = {
      sendFailed: jest.fn(),
    };
    const { processor } = createProcessor({
      teamRepository,
      grabRepository,
      ticketClient,
      orderClient,
      notificationClient,
    });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', []);
    expect(teamRepository.markTeamGrabReleasePending).not.toHaveBeenCalled();
    expect(teamRepository.markTeamGrabRequestIdReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1');
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith(
      'GRAB-QUEUED-1',
      GRAB_STATUS.FAILED,
      expect.any(String),
    );
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
    expect(teamRepository.listConfirmedMembers).not.toHaveBeenCalled();
    expect(notificationClient.sendFailed).not.toHaveBeenCalled();
  });

  it('marks failed when ticket lock timeout is cleared by request-id release', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      markTeamGrabRequestIdReleasePending: jest.fn(),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ ...teamGrab, status: 'FAILED' }),
      updateTeamStatus: jest.fn().mockResolvedValue({ id: 1, status: 'FAILED' }),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.FAILED }),
      markPendingRecovery: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockRejectedValue(new Error('ticket service timeout')),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(true);

    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', []);
    expect(teamRepository.markTeamGrabRequestIdReleasePending).not.toHaveBeenCalled();
    expect(grabRepository.markPendingRecovery).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, 'ticket service timeout');
    expect(teamRepository.markTeamGrabFailed).toHaveBeenCalledWith('TEAM-GRAB-1', 'ticket service timeout');
    expect(teamRepository.updateTeamStatus).toHaveBeenCalledWith(1, 'FAILED', ['GRABBING', 'READY']);
  });

  it('notifies confirmed members when ordinary team grab failure wins the team failure transition', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ ...teamGrab, status: 'FAILED' }),
      updateTeamStatus: jest.fn().mockResolvedValue({ id: 1, status: 'FAILED' }),
      listConfirmedMembers: jest.fn().mockResolvedValue([
        { userId: 100, status: 'CONFIRMED' },
        { userId: 200, status: 'CONFIRMED' },
      ]),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.FAILED }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockRejectedValue(new Error('no team seat strategy can satisfy quantity')),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const notificationClient: any = {
      sendFailed: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('notify failed')),
    };
    const { processor } = createProcessor({
      teamRepository,
      grabRepository,
      ticketClient,
      orderClient,
      notificationClient,
    });

    await expect(processor.process(record)).resolves.toBe(true);

    expect(teamRepository.updateTeamStatus).toHaveBeenCalledWith(1, 'FAILED', ['GRABBING', 'READY']);
    expect(teamRepository.listConfirmedMembers).toHaveBeenCalledWith(1);
    expect(notificationClient.sendFailed).toHaveBeenCalledWith(100, null);
    expect(notificationClient.sendFailed).toHaveBeenCalledWith(200, null);
  });

  it.each([null, false])(
    'does not notify members when ordinary team grab failure loses the team failure transition with %p',
    async (transitionResult) => {
      const record = grabRecord();
      const teamGrab = teamGrabRecord();
      const teamRepository: any = {
        findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
        updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
        markTeamGrabFailed: jest.fn().mockResolvedValue({ ...teamGrab, status: 'FAILED' }),
        updateTeamStatus: jest.fn().mockResolvedValue(transitionResult),
        listConfirmedMembers: jest.fn().mockResolvedValue([{ userId: 100, status: 'CONFIRMED' }]),
      };
      const grabRepository: any = {
        updateProgress: jest.fn().mockResolvedValue(record),
        updateStatus: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.FAILED }),
      };
      const ticketClient: any = {
        lockTeamSeats: jest.fn().mockRejectedValue(new Error('no team seat strategy can satisfy quantity')),
        releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
      };
      const orderClient: any = {
        createTeamOrderWithLockedSeats: jest.fn(),
      };
      const notificationClient: any = {
        sendFailed: jest.fn(),
      };
      const { processor } = createProcessor({
        teamRepository,
        grabRepository,
        ticketClient,
        orderClient,
        notificationClient,
      });

      await expect(processor.process(record)).resolves.toBe(true);

      expect(teamRepository.updateTeamStatus).toHaveBeenCalledWith(1, 'FAILED', ['GRABBING', 'READY']);
      expect(teamRepository.listConfirmedMembers).not.toHaveBeenCalled();
      expect(notificationClient.sendFailed).not.toHaveBeenCalled();
    },
  );

  it('does not create an order or release locked seats when recovery already claimed the team grab', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      persistLockedSeats: jest.fn().mockResolvedValue({
        ...teamGrab,
        status: 'LOCKED',
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      markTeamGrabOrderCreateInProgress: jest.fn().mockResolvedValue(null),
      markTeamGrabFailed: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
      updateStatus: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(teamRepository.markTeamGrabOrderCreateInProgress).toHaveBeenCalledWith('TEAM-GRAB-1');
    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, expect.any(String));
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      workerId: 'worker-1',
    }));
  });

  it('keeps locked seats and returns false when team order creation is ambiguous and lookup finds no order', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      persistLockedSeats: jest.fn().mockResolvedValue({
        ...teamGrab,
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      markTeamGrabOrderCreateInProgress: jest.fn().mockResolvedValue({ ...teamGrab, status: 'LOCKED', failReason: 'ORDER_CREATE_IN_PROGRESS' }),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ ...teamGrab, status: 'FAILED' }),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.FAILED }),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn().mockRejectedValue(new Error('order service timeout')),
      findByGrabRequestId: jest.fn().mockResolvedValue(null),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-QUEUED-1');
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, expect.any(String));
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
  });

  it('finishes order creation when team order creation is ambiguous and lookup finds an order', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      persistLockedSeats: jest.fn().mockResolvedValue({
        ...teamGrab,
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      markTeamGrabOrderCreateInProgress: jest.fn().mockResolvedValue({ ...teamGrab, status: 'LOCKED', failReason: 'ORDER_CREATE_IN_PROGRESS' }),
      markTeamGrabFailed: jest.fn(),
      markTeamGrabOrderCreatedAndLockTeam: jest.fn().mockResolvedValue({ ...teamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      markTeamGrabOrderCreated: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
      markOrderCreated: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.ORDER_CREATED, orderId: 9001 }),
      markPendingRecovery: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn(),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn().mockRejectedValue(new Error('order service timeout')),
      findByGrabRequestId: jest.fn().mockResolvedValue({ id: 9001, orderNo: 'TO1', amount: 1760 }),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(true);

    expect(orderClient.findByGrabRequestId).toHaveBeenCalledWith('GRAB-QUEUED-1');
    expect(ticketClient.releaseTeamSeatLock).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, expect.any(String));
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.markTeamGrabOrderCreatedAndLockTeam).toHaveBeenCalledWith('TEAM-GRAB-1', 1, 9001);
    expect(teamRepository.markTeamGrabOrderCreated).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalled();
    expect(grabRepository.markOrderCreated).toHaveBeenCalledWith('GRAB-QUEUED-1', 9001, 30, [], GRAB_STATUS.ORDER_CREATING, 'worker-1');
    expect(grabRepository.markPendingRecovery).not.toHaveBeenCalled();
  });

  it('releases locked seats and marks failed when locked seats are not persisted', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      persistLockedSeats: jest.fn().mockResolvedValue(null),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ ...teamGrab, status: 'FAILED' }),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.FAILED }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(true);

    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', [501, 502]);
    expect(grabRepository.updateStatus).toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, 'failed to persist team locked seats');
    expect(teamRepository.markTeamGrabFailed).toHaveBeenCalledWith('TEAM-GRAB-1', 'failed to persist team locked seats');
    expect(teamRepository.updateTeamStatus).toHaveBeenCalledWith(1, 'FAILED', ['GRABBING', 'READY']);
  });

  it('keeps locked seats recoverable when persistence and release compensation both fail', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue(null),
      markTeamGrabReleasePending: jest.fn().mockResolvedValue({
        ...teamGrab,
        status: 'LOCKED',
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
        failReason: 'ORDER_CREATE_TIMEOUT_CLAIMED',
      }),
      markTeamGrabFailed: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(false),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', [501, 502]);
    expect(teamRepository.markTeamGrabReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1', {
      lockedSeatIds: [501, 502],
      seatLabels: ['A-1', 'A-2'],
      matchedStrategy: 'SAME_BLOCK',
    });
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith(
      'GRAB-QUEUED-1',
      GRAB_STATUS.FAILED,
      expect.any(String),
    );
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
  });

  it('keeps locked seats recoverable when persistence fails and release compensation throws', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue(null),
      markTeamGrabReleasePending: jest.fn().mockResolvedValue({
        ...teamGrab,
        status: 'LOCKED',
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
        failReason: 'ORDER_CREATE_TIMEOUT_CLAIMED',
      }),
      markTeamGrabFailed: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      releaseTeamSeatLock: jest.fn().mockRejectedValue(new Error('ticket release unavailable')),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', [501, 502]);
    expect(teamRepository.markTeamGrabReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1', {
      lockedSeatIds: [501, 502],
      seatLabels: ['A-1', 'A-2'],
      matchedStrategy: 'SAME_BLOCK',
    });
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith(
      'GRAB-QUEUED-1',
      GRAB_STATUS.FAILED,
      expect.any(String),
    );
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
  });

  it('marks pending recovery when release-pending persistence returns null but request-id marker succeeds', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue(null),
      markTeamGrabReleasePending: jest.fn().mockResolvedValue(null),
      markTeamGrabRequestIdReleasePending: jest.fn().mockResolvedValue({
        ...teamGrab,
        status: 'GRABBING',
        lockedSeatIds: [],
        seatLabels: [],
        failReason: 'ORDER_CREATE_RELEASE_PENDING',
      }),
      markTeamGrabFailed: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(false),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(teamRepository.markTeamGrabReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1', {
      lockedSeatIds: [501, 502],
      seatLabels: ['A-1', 'A-2'],
      matchedStrategy: 'SAME_BLOCK',
    });
    expect(teamRepository.markTeamGrabRequestIdReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1');
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith(
      'GRAB-QUEUED-1',
      GRAB_STATUS.FAILED,
      expect.any(String),
    );
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
  });

  it('marks pending recovery when release-pending persistence throws but request-id marker succeeds', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue(null),
      markTeamGrabReleasePending: jest.fn().mockRejectedValue(new Error('release pending write failed')),
      markTeamGrabRequestIdReleasePending: jest.fn().mockResolvedValue({
        ...teamGrab,
        status: 'GRABBING',
        lockedSeatIds: [],
        seatLabels: [],
        failReason: 'ORDER_CREATE_RELEASE_PENDING',
      }),
      markTeamGrabFailed: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
      markPendingRecovery: jest.fn().mockResolvedValue({ ...record, progressStatus: GRAB_STATUS.PENDING_RECOVERY }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(false),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(teamRepository.markTeamGrabReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1', {
      lockedSeatIds: [501, 502],
      seatLabels: ['A-1', 'A-2'],
      matchedStrategy: 'SAME_BLOCK',
    });
    expect(teamRepository.markTeamGrabRequestIdReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1');
    expect(grabRepository.markPendingRecovery).toHaveBeenCalledWith('GRAB-QUEUED-1', expect.objectContaining({
      message: 'team order confirmation pending',
      currentTicketTypeId: 30,
      workerId: 'worker-1',
    }));
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith(
      'GRAB-QUEUED-1',
      GRAB_STATUS.FAILED,
      expect.any(String),
    );
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
  });

  it('does not mark pending recovery when request-id marker returns null', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue(null),
      markTeamGrabReleasePending: jest.fn().mockResolvedValue(null),
      markTeamGrabRequestIdReleasePending: jest.fn().mockResolvedValue(null),
      markTeamGrabFailed: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
      markPendingRecovery: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(false),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(teamRepository.markTeamGrabReleasePending).toHaveBeenCalled();
    expect(teamRepository.markTeamGrabRequestIdReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1');
    expect(grabRepository.markPendingRecovery).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith(
      'GRAB-QUEUED-1',
      GRAB_STATUS.FAILED,
      expect.any(String),
    );
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
  });

  it('does not mark pending recovery when request-id marker throws', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue({ ...teamGrab, status: 'GRABBING' }),
      persistLockedSeats: jest.fn().mockResolvedValue(null),
      markTeamGrabReleasePending: jest.fn().mockRejectedValue(new Error('release pending write failed')),
      markTeamGrabRequestIdReleasePending: jest.fn().mockRejectedValue(new Error('request-id marker failed')),
      markTeamGrabFailed: jest.fn(),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
      markPendingRecovery: jest.fn(),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockResolvedValue({
        lockedSeatIds: [501, 502],
        seatLabels: ['A-1', 'A-2'],
        matchedStrategy: 'SAME_BLOCK',
      }),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(false),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(false);

    expect(teamRepository.markTeamGrabReleasePending).toHaveBeenCalled();
    expect(teamRepository.markTeamGrabRequestIdReleasePending).toHaveBeenCalledWith('TEAM-GRAB-1');
    expect(grabRepository.markPendingRecovery).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalledWith(
      'GRAB-QUEUED-1',
      GRAB_STATUS.FAILED,
      expect.any(String),
    );
    expect(teamRepository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(teamRepository.updateTeamStatus).not.toHaveBeenCalledWith(1, 'FAILED', expect.any(Array));
  });
});
