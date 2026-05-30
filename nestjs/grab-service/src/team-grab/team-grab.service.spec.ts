import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TeamGrabService } from './team-grab.service';
import type { TeamSeatStrategy, TicketTeamMemberRecord, TicketTeamRecord } from './team-grab.types';

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

function createService(repository: any): TeamGrabService {
  return new TeamGrabService(repository);
}

describe('TeamGrabService', () => {
  it('creates a draft team with the leader as confirmed member', async () => {
    const created = team({ id: 7, leaderUserId: 100, size: 1, status: 'DRAFT' });
    const repository: any = {
      findActiveTeamForUser: jest.fn().mockResolvedValue(null),
      createTeam: jest.fn().mockResolvedValue(created),
      insertLeaderMember: jest.fn().mockResolvedValue(member({
        id: 11,
        teamId: 7,
        userId: 100,
        role: 'LEADER',
        status: 'CONFIRMED',
      })),
      refreshTeamSize: jest.fn().mockResolvedValue(created),
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
    expect(repository.insertLeaderMember).toHaveBeenCalledWith(7, 20, 100);
    expect(result).toMatchObject({
      id: 7,
      leaderUserId: 100,
      status: 'DRAFT',
      size: 1,
    });
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
      listMembers: jest.fn().mockResolvedValue([
        member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
        member({ userId: 200, status: 'CONFIRMED' }),
        member({ userId: 300, status: 'CONFIRMED' }),
      ]),
      refreshTeamSize: jest.fn().mockResolvedValue(team({ size: 3 })),
      updateTeamStatus: jest.fn().mockResolvedValue(updated),
    };
    const service = createService(repository);

    const result = await service.confirmMember(1, 200);

    expect(repository.updateTeamStatus).toHaveBeenCalledWith(1, 'READY', ['DRAFT', 'FAILED', 'EXPIRED', 'READY']);
    expect(result.status).toBe('READY');
    expect(result.size).toBe(3);
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
      listMembers: jest.fn().mockResolvedValue([
        member({ userId: 100, role: 'LEADER', status: 'CONFIRMED' }),
        member({ userId: 200, status: 'CONFIRMED' }),
        member({ userId: 300, status: 'CONFIRMED' }),
      ]),
      refreshTeamSize: jest.fn().mockResolvedValue(team({ size: 3, status: 'DRAFT' })),
      updateTeamStatus: jest.fn().mockResolvedValue(null),
    };
    const service = createService(repository);

    const result = await service.confirmMember(1, 200);

    expect(repository.updateTeamStatus).toHaveBeenCalledWith(1, 'READY', ['DRAFT', 'FAILED', 'EXPIRED', 'READY']);
    expect(repository.findTeamById).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('LOCKED');
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
});
