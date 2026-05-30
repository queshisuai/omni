import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
    seatLabel: null,
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

    await expect(service.joinTeam(2, 200, 'TEAM1234')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.insertMember).not.toHaveBeenCalled();
  });

  it('rejects joining when the invite code is missing or does not match', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ inviteCode: 'TEAM1234', status: 'DRAFT' })),
      findMember: jest.fn(),
      findActiveTeamForUser: jest.fn(),
      insertMember: jest.fn(),
    };
    const service = createService(repository);

    await expect(service.joinTeam(1, 200, '')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.joinTeam(1, 200, 'wrong')).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.findMember).not.toHaveBeenCalled();
    expect(repository.findActiveTeamForUser).not.toHaveBeenCalled();
    expect(repository.insertMember).not.toHaveBeenCalled();
  });

  it('normalizes invite code whitespace and case before joining', async () => {
    const refreshed = team({ id: 1, status: 'DRAFT', size: 1 });
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ id: 1, inviteCode: 'TEAM1234', sessionId: 20, status: 'DRAFT' })),
      findMember: jest.fn().mockResolvedValue(null),
      findActiveTeamForUser: jest.fn().mockResolvedValue(null),
      insertMember: jest.fn().mockResolvedValue(member({ userId: 200, status: 'JOINED' })),
      refreshTeamReadiness: jest.fn().mockResolvedValue(refreshed),
    };
    const service = createService(repository);

    const result = await service.joinTeam(1, 200, ' team1234 ');

    expect(repository.insertMember).toHaveBeenCalledWith(1, 20, 200);
    expect(result).toBe(refreshed);
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

    await expect(service.joinTeam(1, 700, 'TEAM1234')).rejects.toBeInstanceOf(ConflictException);
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

  it('does not publish or create a queued grab when the team grab transaction rejects the snapshot', async () => {
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(team({ status: 'READY', size: 1 })),
      beginTeamGrab: jest.fn().mockRejectedValue(new BadRequestException('team must have 2-6 confirmed members')),
    };
    const grabRepository: any = {
      createQueued: jest.fn(),
      updateStatus: jest.fn(),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 1, queueRank: 0 }),
      publishReserved: jest.fn(),
      acquireTeamTriggerLock: jest.fn().mockResolvedValue(true),
      removeQueuedRequest: jest.fn(),
      releaseTeamTriggerLock: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repository, { grabRepository, queueService });

    await expect(service.triggerTeamGrab(1, 100)).rejects.toThrow('team must have 2-6 confirmed members');

    const queuedRequestId = repository.beginTeamGrab.mock.calls[0][0].grabRequestId;
    expect(grabRepository.createQueued).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(queueService.publishReserved).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(queueService.releaseTeamTriggerLock).toHaveBeenCalledWith(1, 20, 30, queuedRequestId);
  });

  it('uses one repository transaction to create queued and team grab rows from the frozen snapshot', async () => {
    const readyTeam = team({ id: 1, leaderUserId: 100, status: 'READY', size: 3 });
    const members = [
      member({ id: 1, userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ id: 2, userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
      member({ id: 3, userId: 300, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      beginTeamGrab: jest.fn(async (input: any) => ({
        team: team({ id: 1, status: 'GRABBING', size: 3 }),
        confirmedMembers: members,
        teamGrabRequest: teamGrabRequest({
          requestId: input.requestId,
          grabRequestId: input.grabRequestId,
          quantity: 3,
          status: 'PENDING',
        }),
      })),
    };
    const grabRepository: any = {
      createQueued: jest.fn(),
      updateStatus: jest.fn(),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 9, queueRank: 4 }),
      publishReserved: jest.fn().mockResolvedValue(undefined),
      acquireTeamTriggerLock: jest.fn().mockResolvedValue(true),
      releaseTeamTriggerLock: jest.fn(),
    };
    const service = createService(repository, { grabRepository, queueService });

    const result = await service.triggerTeamGrab(1, 200);

    expect(repository.beginTeamGrab).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 1,
      triggerUserId: 200,
      grabRequestId: expect.any(String),
      requestId: expect.any(String),
      queueSeq: 9,
      idempotencyKey: expect.stringMatching(/^team:1:TEAM-GRAB-/),
      expireTime: expect.any(Date),
      requestedTicketTypes: [{ ticketTypeId: 30, name: null, maxPrice: null }],
    }));
    expect(grabRepository.createQueued).not.toHaveBeenCalled();
    const queuedRequestId = repository.beginTeamGrab.mock.calls[0][0].grabRequestId;
    expect(repository.beginTeamGrab.mock.calls[0][0].grabRequestId).toBe(queuedRequestId);
    expect(repository.listMembers).toBeUndefined();
    expect(repository.createTeamGrabRequest).toBeUndefined();
    expect(repository.updateTeamStatus).toBeUndefined();
    expect(queueService.publishReserved).toHaveBeenCalledWith(expect.objectContaining({
      requestId: queuedRequestId,
      sessionId: 20,
      userId: 100,
      queueSeq: 9,
      ttlSeconds: 900,
    }));
    expect(repository.beginTeamGrab.mock.invocationCallOrder[0])
      .toBeGreaterThan(queueService.reserveQueueSeq.mock.invocationCallOrder[0]);
    expect(repository.beginTeamGrab.mock.invocationCallOrder[0])
      .toBeLessThan(queueService.publishReserved.mock.invocationCallOrder[0]);
    expect(result).toEqual({ requestId: queuedRequestId, queueSeq: 9, queueRank: 4, teamStatus: 'GRABBING' });
  });

  it('creates only one active team grab request when members trigger concurrently', async () => {
    const readyTeam = team({ status: 'READY', size: 4 });
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
      member({ userId: 300, role: 'MEMBER', status: 'CONFIRMED' }),
      member({ userId: 400, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      beginTeamGrab: jest.fn(async (input: any) => ({
        team: team({ status: 'GRABBING', size: 4 }),
        confirmedMembers: members,
        teamGrabRequest: teamGrabRequest({
          requestId: input.requestId,
          grabRequestId: input.grabRequestId,
          quantity: 4,
        }),
      })),
    };
    const grabRepository: any = {
      createQueued: jest.fn(),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 1, queueRank: 0 }),
      publishReserved: jest.fn().mockResolvedValue(undefined),
      acquireTeamTriggerLock: jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
      releaseTeamTriggerLock: jest.fn(),
    };
    const service = createService(repository, { grabRepository, queueService });

    const results = await Promise.allSettled([
      service.triggerTeamGrab(1, 100),
      service.triggerTeamGrab(1, 200),
      service.triggerTeamGrab(1, 300),
      service.triggerTeamGrab(1, 400),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(3);
    expect(queueService.acquireTeamTriggerLock).toHaveBeenCalledTimes(4);
    await expect(queueService.acquireTeamTriggerLock.mock.results[0].value).resolves.toBe(true);
    await expect(queueService.acquireTeamTriggerLock.mock.results[1].value).resolves.toBe(false);
    await expect(queueService.acquireTeamTriggerLock.mock.results[2].value).resolves.toBe(false);
    await expect(queueService.acquireTeamTriggerLock.mock.results[3].value).resolves.toBe(false);
    expect(grabRepository.createQueued).not.toHaveBeenCalled();
    expect(repository.beginTeamGrab).toHaveBeenCalledTimes(1);
    expect(queueService.publishReserved).toHaveBeenCalledTimes(1);

    expect(fulfilled[0].value).toEqual(expect.objectContaining({
      requestId: expect.any(String),
      queueSeq: 1,
      queueRank: 0,
    }));
    expect(fulfilled[0].value.requestId).toBe(
      repository.beginTeamGrab.mock.calls[0][0].grabRequestId,
    );
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(ConflictException);
      expect(result.reason.message).toBe('team grab is already in progress');
    }
  });

  it('does not publish or mark rows failed when the transaction rolls back queued grab creation', async () => {
    const readyTeam = team({ status: 'READY', size: 2 });
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      beginTeamGrab: jest.fn().mockRejectedValue(new Error('grab insert failed')),
      updateTeamStatus: jest.fn(),
      markTeamGrabFailed: jest.fn(),
    };
    const grabRepository: any = {
      createQueued: jest.fn(),
      updateStatus: jest.fn(),
    };
    const queueService: any = {
      reserveQueueSeq: jest.fn().mockResolvedValue({ queueSeq: 1, queueRank: 0 }),
      publishReserved: jest.fn(),
      acquireTeamTriggerLock: jest.fn().mockResolvedValue(true),
      removeQueuedRequest: jest.fn().mockResolvedValue(undefined),
      releaseTeamTriggerLock: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repository, { grabRepository, queueService });

    await expect(service.triggerTeamGrab(1, 100)).rejects.toThrow('grab insert failed');

    expect(queueService.publishReserved).not.toHaveBeenCalled();
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(grabRepository.createQueued).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(repository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(repository.updateTeamStatus).not.toHaveBeenCalled();
    const queuedRequestId = repository.beginTeamGrab.mock.calls[0][0].grabRequestId;
    expect(queueService.releaseTeamTriggerLock).toHaveBeenCalledWith(1, 20, 30, queuedRequestId);
  });

  it('keeps committed team grab state for recovery when reserved publish has an uncertain failure', async () => {
    const readyTeam = team({ status: 'READY', size: 2 });
    const members = [
      member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
      member({ userId: 200, role: 'MEMBER', status: 'CONFIRMED' }),
    ];
    const repository: any = {
      findTeamById: jest.fn().mockResolvedValue(readyTeam),
      beginTeamGrab: jest.fn().mockResolvedValue({
        team: team({ status: 'GRABBING', size: 2 }),
        confirmedMembers: members,
        teamGrabRequest: teamGrabRequest({ requestId: 'TEAM-GRAB-1', grabRequestId: 'GRAB-QUEUED-1', quantity: 2 }),
      }),
      updateTeamStatus: jest
        .fn()
        .mockResolvedValueOnce(team({ status: 'FAILED' })),
      markTeamGrabFailed: jest.fn().mockResolvedValue({ requestId: 'TEAM-GRAB-1', status: 'FAILED' }),
    };
    const grabRepository: any = {
      createQueued: jest.fn(),
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

    const queuedRequestId = repository.beginTeamGrab.mock.calls[0][0].grabRequestId;
    expect(queueService.publishReserved).toHaveBeenCalledWith(expect.objectContaining({
      requestId: queuedRequestId,
      sessionId: 20,
      userId: 100,
      queueSeq: 1,
      ttlSeconds: 900,
    }));
    expect(queueService.removeQueuedRequest).not.toHaveBeenCalled();
    expect(grabRepository.updateStatus).not.toHaveBeenCalled();
    expect(repository.markTeamGrabFailed).not.toHaveBeenCalled();
    expect(repository.updateTeamStatus).not.toHaveBeenCalled();
    expect(queueService.releaseTeamTriggerLock).toHaveBeenCalledWith(1, 20, 30, queuedRequestId);
  });
});
