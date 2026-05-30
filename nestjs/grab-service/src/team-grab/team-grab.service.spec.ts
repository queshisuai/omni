import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TeamGrabService } from './team-grab.service';
import type { TeamGrabRequestRecord, TeamSeatStrategy, TicketTeamMemberRecord, TicketTeamRecord } from './team-grab.types';

const now = new Date('2026-05-30T12:00:00.000Z');

function team(overrides: Partial<TicketTeamRecord> = {}): TicketTeamRecord {
  return {
    id: 1,
    inviteCode: 'TEAM1234',
    leaderUserId: 100,
    activityId: 10,
    sessionId: 20,
    ticketTypeId: 30,
    size: 1,
    strategy: 'SAME_BLOCK',
    fallbacks: [],
    status: 'DRAFT',
    createTime: now,
    updateTime: now,
    ...overrides,
  };
}

function member(overrides: Partial<TicketTeamMemberRecord> = {}): TicketTeamMemberRecord {
  return {
    id: 1,
    teamId: 1,
    sessionId: 20,
    userId: 100,
    role: 'MEMBER',
    status: 'CONFIRMED',
    seatId: null,
    orderSeatId: null,
    joinTime: now,
    ...overrides,
  };
}

function teamGrabRequest(overrides: Partial<TeamGrabRequestRecord> = {}): TeamGrabRequestRecord {
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
    fallbacks: [],
    matchedStrategy: null,
    status: 'ORDER_CREATED',
    orderId: 9001,
    lockedSeatIds: [],
    seatLabels: [],
    failReason: null,
    createTime: now,
    updateTime: now,
    ...overrides,
  };
}

function createService(repository: any, overrides: any = {}): TeamGrabService {
  return new TeamGrabService(
    repository,
    overrides.grabRepository ?? {},
    overrides.queueService ?? {},
  );
}

describe('TeamGrabService', () => {
  it('creates a draft team with the leader as confirmed member', async () => {
    const created = team({ id: 7, leaderUserId: 100, size: 1, status: 'DRAFT' });
    const repository: any = {
      findActiveTeamForUser: jest.fn().mockResolvedValue(null),
      createTeam: jest.fn().mockResolvedValue(created),
    };
    const service = createService(repository);

    const result = await service.createTeam(100, {
      activityId: 10,
      sessionId: 20,
      ticketTypeId: 30,
      strategy: 'SAME_BLOCK',
      fallbacks: ['SAME_TICKET_TYPE', 'SAME_TICKET_TYPE', 'FALLBACK'],
    });

    expect(repository.createTeam).toHaveBeenCalledWith(expect.objectContaining({
      leaderUserId: 100,
      activityId: 10,
      sessionId: 20,
      ticketTypeId: 30,
      strategy: 'SAME_BLOCK',
      fallbacks: ['SAME_TICKET_TYPE', 'FALLBACK'],
      inviteCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
    }));
    expect(result).toMatchObject({
      id: 7,
      leaderUserId: 100,
      status: 'DRAFT',
      size: 1,
    });
  });

  it('turns create team unique violations into conflict errors without service-side orphan cleanup', async () => {
    const repository: any = {
      findActiveTeamForUser: jest.fn().mockResolvedValue(null),
      createTeam: jest.fn().mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' })),
      insertLeaderMember: jest.fn(),
    };
    const service = createService(repository);

    await expect(service.createTeam(100, {
      activityId: 10,
      sessionId: 20,
      ticketTypeId: 30,
      strategy: 'SAME_BLOCK',
      fallbacks: [],
    })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.insertLeaderMember).not.toHaveBeenCalled();
  });

  it('prevents a user from joining two active teams for the same session', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ id: 2, sessionId: 20, status: 'DRAFT' })),
      findMember: jest.fn().mockResolvedValue(null),
      findActiveTeamForUser: jest.fn().mockResolvedValue(team({ id: 1, sessionId: 20 })),
      insertMember: jest.fn(),
    };
    const service = createService(repository);

    await expect(service.joinTeam(2, 200)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.insertMember).not.toHaveBeenCalled();
  });

  it('allows only leader to update strategy', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ leaderUserId: 100 })),
      updateStrategy: jest.fn(),
    };
    const service = createService(repository);

    await expect(service.updateStrategy(1, 200, 'SAME_TICKET_TYPE', [])).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateStrategy).not.toHaveBeenCalled();
  });

  it('moves a team to READY when 2-6 members are confirmed and strategy is set', async () => {
    const updated = team({
      id: 1,
      leaderUserId: 100,
      size: 3,
      strategy: 'SAME_BLOCK',
      fallbacks: ['SAME_TICKET_TYPE'],
      status: 'READY',
    });
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ leaderUserId: 100, status: 'DRAFT' })),
      findMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'JOINED' })),
      confirmMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'CONFIRMED' })),
      refreshTeamReadiness: jest.fn().mockResolvedValue(updated),
    };
    const service = createService(repository);

    const result = await service.confirmMember(1, 200);

    expect(repository.refreshTeamReadiness).toHaveBeenCalledWith(1);
    expect(repository.listMembers).toBeUndefined();
    expect(result.status).toBe('READY');
    expect(result.size).toBe(3);
  });

  it('does not mark READY from a stale member list when the database refresh keeps DRAFT', async () => {
    const refreshed = team({ id: 1, status: 'DRAFT', size: 1 });
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ leaderUserId: 100, status: 'DRAFT' })),
      findMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'JOINED' })),
      confirmMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'CONFIRMED' })),
      listMembers: jest.fn().mockResolvedValue([
        member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
        member({ userId: 200, status: 'CONFIRMED' }),
      ]),
      refreshTeamReadiness: jest.fn().mockResolvedValue(refreshed),
      updateTeamStatus: jest.fn(),
    };
    const service = createService(repository);

    const result = await service.confirmMember(1, 200);

    expect(repository.refreshTeamReadiness).toHaveBeenCalledWith(1);
    expect(repository.listMembers).not.toHaveBeenCalled();
    expect(repository.updateTeamStatus).not.toHaveBeenCalled();
    expect(result.status).toBe('DRAFT');
    expect(result.size).toBe(1);
  });

  it('returns latest team state when READY transition loses to a locked status', async () => {
    const locked = team({ status: 'LOCKED', size: 3 });
    const repository: any = {
      findTeamById: jest
        .fn()
        .mockResolvedValueOnce(team({ leaderUserId: 100, status: 'DRAFT' }))
        .mockResolvedValueOnce(locked),
      findMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'JOINED' })),
      confirmMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'CONFIRMED' })),
      refreshTeamReadiness: jest.fn().mockResolvedValue(null),
    };
    const service = createService(repository);

    const result = await service.confirmMember(1, 200);

    expect(repository.refreshTeamReadiness).toHaveBeenCalledWith(1);
    expect(repository.findTeamById).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('LOCKED');
  });

  it('returns canPay and latest order for a leader viewing a locked team with a latest order', async () => {
    const lockedTeam = team({ leaderUserId: 100, status: 'LOCKED' });
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(lockedTeam),
      listMembers: jest.fn().mockResolvedValue(members),
      findLatestTeamGrabRequestByTeamId: jest.fn().mockResolvedValue(teamGrabRequest({
        grabRequestId: 'GRAB-QUEUED-9',
        orderId: 9001,
      })),
    };
    const service = createService(repository);

    const result = await service.getTeamDetail(1, 100);

    expect(repository.findMember).toBeUndefined();
    expect(repository.listMembers).toHaveBeenCalledTimes(1);
    expect(repository.findLatestTeamGrabRequestByTeamId).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({
      team: lockedTeam,
      members,
      canPay: true,
      canTriggerGrab: false,
      latestGrabRequestId: 'GRAB-QUEUED-9',
      latestOrderId: 9001,
    });
  });

  it('returns canTriggerGrab for a confirmed member viewing a ready team with 2-6 confirmed members', async () => {
    const readyTeam = team({ leaderUserId: 100, status: 'READY', size: 2 });
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
      member({ userId: 300, role: 'MEMBER', status: 'JOINED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      listMembers: jest.fn().mockResolvedValue(members),
      findLatestTeamGrabRequestByTeamId: jest.fn().mockResolvedValue(null),
    };
    const service = createService(repository);

    const result = await service.getTeamDetail(1, 200);

    expect(repository.listMembers).toHaveBeenCalledTimes(1);
    expect(result.canTriggerGrab).toBe(true);
    expect(result.canPay).toBe(false);
    expect(result.latestGrabRequestId).toBeNull();
    expect(result.latestOrderId).toBeNull();
  });

  it.each([
    {
      name: 'unconfirmed member',
      userId: 200,
      members: [
        member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
        member({ userId: 200, role: 'MEMBER', status: 'JOINED' }),
      ],
    },
    {
      name: 'insufficient confirmed count',
      userId: 100,
      members: [
        member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
        member({ userId: 200, role: 'MEMBER', status: 'JOINED' }),
      ],
    },
  ])('returns canTriggerGrab=false for $name', async ({ userId, members }) => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ leaderUserId: 100, status: 'READY' })),
      listMembers: jest.fn().mockResolvedValue(members),
      findLatestTeamGrabRequestByTeamId: jest.fn().mockResolvedValue(null),
    };
    const service = createService(repository);

    const result = await service.getTeamDetail(1, userId);

    expect(repository.listMembers).toHaveBeenCalledTimes(1);
    expect(result.canTriggerGrab).toBe(false);
  });

  it('rejects a non-member viewing team detail', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ leaderUserId: 100, status: 'READY' })),
      listMembers: jest.fn().mockResolvedValue([
        member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
        member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
      ]),
      findLatestTeamGrabRequestByTeamId: jest.fn(),
    };
    const service = createService(repository);

    await expect(service.getTeamDetail(1, 300)).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.listMembers).toHaveBeenCalledTimes(1);
    expect(repository.findLatestTeamGrabRequestByTeamId).not.toHaveBeenCalled();
  });

  it('returns canPay=false for a non-leader viewing a locked team order', async () => {
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ leaderUserId: 100, status: 'LOCKED' })),
      listMembers: jest.fn().mockResolvedValue(members),
      findLatestTeamGrabRequestByTeamId: jest.fn().mockResolvedValue(teamGrabRequest({ orderId: 9001 })),
    };
    const service = createService(repository);

    const result = await service.getTeamDetail(1, 200);

    expect(result.canPay).toBe(false);
    expect(result.latestOrderId).toBe(9001);
  });

  it('turns active capacity insert failures into conflict when joining a full team', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ id: 1, sessionId: 20, status: 'DRAFT' })),
      findMember: jest.fn().mockResolvedValue(null),
      findActiveTeamForUser: jest.fn().mockResolvedValue(null),
      insertMember: jest.fn().mockResolvedValue(null),
    };
    const service = createService(repository);

    await expect(service.joinTeam(1, 700)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.insertMember).toHaveBeenCalledWith(1, 20, 700);
  });

  it('turns confirm capacity failures into conflict for invited members when the team is full', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ id: 1, status: 'DRAFT' })),
      findMember: jest.fn().mockResolvedValue(member({ userId: 700, status: 'INVITED' })),
      confirmMember: jest.fn().mockResolvedValue(null),
    };
    const service = createService(repository);

    await expect(service.confirmMember(1, 700)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.confirmMember).toHaveBeenCalledWith(1, 700);
  });

  it('prevents member leave after team is LOCKED', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ status: 'LOCKED' })),
      findMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'CONFIRMED' })),
      leaveMember: jest.fn(),
    };
    const service = createService(repository);

    await expect(service.leaveTeam(1, 200)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.leaveMember).not.toHaveBeenCalled();
  });

  it('allows a non-leader member to leave a joinable team and refreshes readiness', async () => {
    const refreshed = team({ status: 'DRAFT', size: 1 });
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ leaderUserId: 100, status: 'READY' })),
      findMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'CONFIRMED' })),
      leaveMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'LEFT' })),
      refreshTeamReadiness: jest.fn().mockResolvedValue(refreshed),
    };
    const service = createService(repository);

    const result = await service.leaveTeam(1, 200);

    expect(repository.leaveMember).toHaveBeenCalledWith(1, 200);
    expect(repository.refreshTeamReadiness).toHaveBeenCalledWith(1);
    expect(result).toBe(refreshed);
  });

  it('deduplicates fallbacks and rejects stricter fallback strategies', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ leaderUserId: 100 })),
      updateStrategy: jest.fn(),
    };
    const service = createService(repository);

    await expect(service.updateStrategy(1, 100, 'SAME_BLOCK', [
      'SAME_TICKET_TYPE',
      'SAME_TICKET_TYPE',
      'STRICT_CONTIGUOUS',
    ] as TeamSeatStrategy[])).rejects.toThrow('fallback strategy cannot be stricter than primary');
    expect(repository.updateStrategy).not.toHaveBeenCalled();
  });

  it('rejects trigger when confirmed member count is below 2', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ status: 'READY', size: 1 })),
      listMembers: jest.fn().mockResolvedValue([
        member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      ]),
    };
    const queueService: any = {
      acquireTeamTriggerLock: jest.fn(),
    };
    const service = createService(repository, { queueService });

    await expect(service.triggerTeamGrab(1, 100)).rejects.toThrow('team must have 2-6 confirmed members');

    expect(queueService.acquireTeamTriggerLock).not.toHaveBeenCalled();
  });

  it('uses confirmed member count as quantity when triggering a team grab', async () => {
    const readyTeam = team({ id: 1, leaderUserId: 100, status: 'READY', size: 3 });
    const members = [
      member({ id: 1, userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ id: 2, userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
      member({ id: 3, userId: 300, role: 'MEMBER', status: 'CONFIRMED' }),
      member({ id: 4, userId: 400, role: 'MEMBER', status: 'JOINED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      listMembers: jest.fn().mockResolvedValue(members),
      createTeamGrabRequest: jest.fn().mockResolvedValue({ requestId: 'TEAM-GRAB-1' }),
      updateTeamStatus: jest.fn().mockResolvedValue(team({ status: 'GRABBING' })),
    };
    const grabRepository: any = {
      createQueued: jest.fn(async (input: any) => ({ requestId: input.requestId })),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 9, queueRank: 4 }),
      publishReserved: jest.fn().mockResolvedValue(undefined),
      acquireTeamTriggerLock: jest.fn().mockResolvedValue(true),
      releaseTeamTriggerLock: jest.fn(),
    };
    const service = createService(repository, { grabRepository, queueService });

    const result = await service.triggerTeamGrab(1, 200);

    expect(grabRepository.createQueued).toHaveBeenCalledWith(expect.objectContaining({
      requestType: 'TEAM_GRAB',
      userId: 100,
      quantity: 3,
      seatIds: [],
      allocateRandom: true,
      queueSeq: 9,
      allowAutoDowngrade: false,
    }));
    const queuedRequestId = grabRepository.createQueued.mock.calls[0][0].requestId;
    expect(repository.createTeamGrabRequest).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 1,
      triggerUserId: 200,
      payerUserId: 100,
      quantity: 3,
      grabRequestId: queuedRequestId,
    }));
    expect(repository.createTeamGrabRequest.mock.calls[0][0].requestId).not.toBe(queuedRequestId);
    expect(repository.updateTeamStatus).toHaveBeenCalledWith(1, 'GRABBING', ['READY', 'FAILED', 'EXPIRED']);
    expect(queueService.publishReserved).toHaveBeenCalledWith(expect.objectContaining({
      requestId: queuedRequestId,
      sessionId: 20,
      userId: 100,
      queueSeq: 9,
      ttlSeconds: 900,
    }));
    expect(grabRepository.createQueued.mock.invocationCallOrder[0])
      .toBeLessThan(repository.createTeamGrabRequest.mock.invocationCallOrder[0]);
    expect(repository.createTeamGrabRequest.mock.invocationCallOrder[0])
      .toBeLessThan(repository.updateTeamStatus.mock.invocationCallOrder[0]);
    expect(repository.updateTeamStatus.mock.invocationCallOrder[0])
      .toBeLessThan(queueService.publishReserved.mock.invocationCallOrder[0]);
    expect(result).toEqual({ requestId: queuedRequestId, queueSeq: 9, queueRank: 4, teamStatus: 'GRABBING' });
  });

  it('creates only one active team grab request when members trigger concurrently', async () => {
    const readyTeam = team({ status: 'READY', size: 2 });
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      listMembers: jest.fn().mockResolvedValue(members),
      createTeamGrabRequest: jest.fn().mockResolvedValue({ requestId: 'TEAM-GRAB-1' }),
      updateTeamStatus: jest.fn().mockResolvedValue(team({ status: 'GRABBING' })),
    };
    const grabRepository: any = {
      createQueued: jest.fn(async (input: any) => ({ requestId: input.requestId })),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 1, queueRank: 0 }),
      publishReserved: jest.fn().mockResolvedValue(undefined),
      acquireTeamTriggerLock: jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      releaseTeamTriggerLock: jest.fn(),
    };
    const service = createService(repository, { grabRepository, queueService });

    const results = await Promise.allSettled([
      service.triggerTeamGrab(1, 100),
      service.triggerTeamGrab(1, 200),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(queueService.acquireTeamTriggerLock).toHaveBeenCalledTimes(2);
    await expect(queueService.acquireTeamTriggerLock.mock.results[0].value).resolves.toBe(true);
    await expect(queueService.acquireTeamTriggerLock.mock.results[1].value).resolves.toBe(false);
    expect(grabRepository.createQueued).toHaveBeenCalledTimes(1);
    expect(repository.createTeamGrabRequest).toHaveBeenCalledTimes(1);
    expect(queueService.publishReserved).toHaveBeenCalledTimes(1);

    const fulfilled = results.find((result) => result.status === 'fulfilled');
    const rejected = results.find((result) => result.status === 'rejected');
    expect(fulfilled).toEqual(expect.objectContaining({
      status: 'fulfilled',
      value: expect.objectContaining({ requestId: expect.any(String) }),
    }));
    expect((fulfilled as PromiseFulfilledResult<any>).value.requestId).toBe(
      grabRepository.createQueued.mock.calls[0][0].requestId,
    );
    expect(rejected).toEqual(expect.objectContaining({
      status: 'rejected',
      reason: expect.any(ConflictException),
    }));
    expect((rejected as PromiseRejectedResult).reason.message).toBe('team grab is already in progress');
  });

  it('fails queued grab and releases lock when team grab insert fails before publish', async () => {
    const readyTeam = team({ status: 'READY', size: 2 });
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      listMembers: jest.fn().mockResolvedValue(members),
      createTeamGrabRequest: jest.fn().mockRejectedValue(new Error('duplicate active team grab')),
      updateTeamStatus: jest.fn(),
    };
    const grabRepository: any = {
      createQueued: jest.fn(async (input: any) => ({ requestId: input.requestId })),
      updateStatus: jest.fn().mockResolvedValue(null),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 1, queueRank: 0 }),
      publishReserved: jest.fn(),
      acquireTeamTriggerLock: jest.fn().mockResolvedValue(true),
      removeQueuedRequest: jest.fn().mockResolvedValue(undefined),
      releaseTeamTriggerLock: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repository, { grabRepository, queueService });

    await expect(service.triggerTeamGrab(1, 100)).rejects.toThrow('duplicate active team grab');

    const queuedRequestId = grabRepository.createQueued.mock.calls[0][0].requestId;
    expect(queueService.publishReserved).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).toHaveBeenCalledWith(queuedRequestId, 'FAILED', 'duplicate active team grab');
    expect(queueService.releaseTeamTriggerLock).toHaveBeenCalledWith(1, 20, 30, queuedRequestId);
  });

  it('marks created team grab failed and releases lock when team status update fails', async () => {
    const readyTeam = team({ status: 'READY', size: 2 });
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      listMembers: jest.fn().mockResolvedValue(members),
      createTeamGrabRequest: jest.fn().mockResolvedValue({ requestId: 'TEAM-GRAB-1' }),
      updateTeamStatus: jest.fn().mockResolvedValue(null),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ requestId: 'TEAM-GRAB-1', status: 'FAILED' }),
    };
    const grabRepository: any = {
      createQueued: jest.fn(async (input: any) => ({ requestId: input.requestId })),
      updateStatus: jest.fn().mockResolvedValue(null),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 1, queueRank: 0 }),
      publishReserved: jest.fn(),
      acquireTeamTriggerLock: jest.fn().mockResolvedValue(true),
      releaseTeamTriggerLock: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repository, { grabRepository, queueService });

    await expect(service.triggerTeamGrab(1, 100)).rejects.toThrow('team grab is already in progress');

    expect(queueService.publishReserved).not.toHaveBeenCalled();
    expect(repository.markTeamGrabFailed).toHaveBeenCalledWith('TEAM-GRAB-1', 'team grab is already in progress');
    expect(grabRepository.updateStatus).toHaveBeenCalledWith(expect.any(String), 'FAILED', 'team grab is already in progress');
    expect(queueService.releaseTeamTriggerLock).toHaveBeenCalledWith(1, 20, 30, expect.any(String));
  });

  it('marks grab and team grab failed when reserved publish fails after team becomes grabbing', async () => {
    const readyTeam = team({ status: 'READY', size: 2 });
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      listMembers: jest.fn().mockResolvedValue(members),
      createTeamGrabRequest: jest.fn().mockResolvedValue({ requestId: 'TEAM-GRAB-1' }),
      updateTeamStatus: jest
        .fn()
        .mockResolvedValueOnce(team({ status: 'GRABBING' }))
        .mockResolvedValueOnce(team({ status: 'FAILED' })),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ requestId: 'TEAM-GRAB-1', status: 'FAILED' }),
    };
    const grabRepository: any = {
      createQueued: jest.fn(async (input: any) => ({ requestId: input.requestId })),
      updateStatus: jest.fn().mockResolvedValue(null),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 1, queueRank: 0 }),
      publishReserved: jest.fn().mockRejectedValue(new Error('redis unavailable')),
      acquireTeamTriggerLock: jest.fn().mockResolvedValue(true),
      removeQueuedRequest: jest.fn().mockResolvedValue(undefined),
      releaseTeamTriggerLock: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repository, { grabRepository, queueService });

    await expect(service.triggerTeamGrab(1, 100)).rejects.toThrow('redis unavailable');

    const queuedRequestId = grabRepository.createQueued.mock.calls[0][0].requestId;
    expect(queueService.removeQueuedRequest).toHaveBeenCalledWith(20, queuedRequestId);
    expect(grabRepository.updateStatus).toHaveBeenCalledWith(queuedRequestId, 'FAILED', 'redis unavailable');
    expect(repository.markTeamGrabFailed).toHaveBeenCalledWith('TEAM-GRAB-1', 'redis unavailable');
    expect(repository.updateTeamStatus).toHaveBeenLastCalledWith(1, 'FAILED', ['GRABBING']);
    expect(queueService.releaseTeamTriggerLock).toHaveBeenCalledWith(1, 20, 30, expect.any(String));
  });
});
