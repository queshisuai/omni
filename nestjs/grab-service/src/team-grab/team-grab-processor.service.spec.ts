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
  return {
    processor: new TeamGrabProcessorService(teamRepository, grabRepository, ticketClient, orderClient),
    teamRepository,
    grabRepository,
    ticketClient,
    orderClient,
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
      markTeamGrabOrderCreated: jest.fn().mockResolvedValue({ ...teamGrab, status: 'ORDER_CREATED', orderId: 9001 }),
      updateTeamStatus: jest.fn().mockResolvedValue(null),
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
    expect(teamRepository.markTeamGrabOrderCreated).toHaveBeenCalledWith('TEAM-GRAB-1', 9001);
    expect(teamRepository.updateTeamStatus).toHaveBeenCalledWith(1, 'LOCKED', ['GRABBING']);
  });

  it('marks grab and team failed when ticket lock fails', async () => {
    const record = grabRecord();
    const teamGrab = teamGrabRecord();
    const teamRepository: any = {
      findTeamGrabByGrabRequestId: jest.fn().mockResolvedValue(teamGrab),
      updateTeamGrabStatus: jest.fn().mockResolvedValue(teamGrab),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ ...teamGrab, status: 'FAILED' }),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      updateProgress: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({ ...record, status: GRAB_STATUS.FAILED }),
    };
    const ticketClient: any = {
      lockTeamSeats: jest.fn().mockRejectedValue(new Error('no team seat strategy can satisfy quantity')),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn(),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(true);

    expect(orderClient.createTeamOrderWithLockedSeats).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, 'no team seat strategy can satisfy quantity');
    expect(teamRepository.markTeamGrabFailed).toHaveBeenCalledWith('TEAM-GRAB-1', 'no team seat strategy can satisfy quantity');
    expect(teamRepository.updateTeamStatus).toHaveBeenCalledWith(1, 'FAILED', ['GRABBING', 'READY']);
  });

  it('releases locked seats and marks failed when team order creation fails', async () => {
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
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 30, name: 'VIP', price: 880, remainStock: 10 }]),
      releaseTeamSeatLock: jest.fn().mockResolvedValue(true),
    };
    const orderClient: any = {
      createTeamOrderWithLockedSeats: jest.fn().mockRejectedValue(new Error('order service timeout')),
    };
    const { processor } = createProcessor({ teamRepository, grabRepository, ticketClient, orderClient });

    await expect(processor.process(record)).resolves.toBe(true);

    expect(ticketClient.releaseTeamSeatLock).toHaveBeenCalledWith('TEAM-GRAB-1', [501, 502]);
    expect(grabRepository.updateStatus).toHaveBeenCalledWith('GRAB-QUEUED-1', GRAB_STATUS.FAILED, 'order service timeout');
    expect(teamRepository.markTeamGrabFailed).toHaveBeenCalledWith('TEAM-GRAB-1', 'order service timeout');
    expect(teamRepository.updateTeamStatus).toHaveBeenCalledWith(1, 'FAILED', ['GRABBING', 'READY']);
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
});
