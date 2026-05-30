import { TeamGrabRepository } from './team-grab.repository';

const teamRow = {
  id: '1',
  invite_code: 'TEAM1234',
  leader_user_id: '100',
  activity_id: '10',
  session_id: '20',
  ticket_type_id: '30',
  size: 2,
  strategy: 'SAME_BLOCK',
  fallback_strategy_json: JSON.stringify(['SAME_TICKET_TYPE', 'FALLBACK']),
  status: 'DRAFT',
  create_time: new Date('2026-05-30T12:00:00.000Z'),
  update_time: new Date('2026-05-30T12:01:00.000Z'),
};

const memberRow = {
  id: '9',
  team_id: '1',
  session_id: '20',
  user_id: '100',
  role: 'LEADER',
  status: 'CONFIRMED',
  seat_id: null,
  order_seat_id: null,
  join_time: new Date('2026-05-30T12:00:00.000Z'),
};

describe('TeamGrabRepository', () => {
  it('creates teams with parameterized strategy fallbacks and maps rows', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [teamRow] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.createTeam({
      inviteCode: 'TEAM1234',
      leaderUserId: 100,
      activityId: 10,
      sessionId: 20,
      ticketTypeId: 30,
      strategy: 'SAME_BLOCK',
      fallbacks: ['SAME_TICKET_TYPE', 'FALLBACK'],
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('insert into ticket_team'), [
      'TEAM1234',
      100,
      10,
      20,
      30,
      'SAME_BLOCK',
      JSON.stringify(['SAME_TICKET_TYPE', 'FALLBACK']),
      'DRAFT',
    ]);
    expect(result).toMatchObject({
      id: 1,
      inviteCode: 'TEAM1234',
      leaderUserId: 100,
      fallbacks: ['SAME_TICKET_TYPE', 'FALLBACK'],
    });
  });

  it('inserts the leader as a confirmed member', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [memberRow] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.insertLeaderMember(1, 20, 100);

    expect(query.mock.calls[0][0]).toContain('insert into ticket_team_member');
    expect(query.mock.calls[0][1]).toEqual([1, 20, 100, 'LEADER', 'CONFIRMED']);
    expect(result).toMatchObject({ teamId: 1, userId: 100, role: 'LEADER', status: 'CONFIRMED' });
  });

  it('finds active team membership for a user in the same session', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [teamRow] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.findActiveTeamForUser(20, 100);

    expect(query.mock.calls[0][0]).toContain("m.status in ('INVITED', 'JOINED', 'CONFIRMED')");
    expect(query.mock.calls[0][0]).toContain("t.status in ('DRAFT', 'READY', 'GRABBING', 'LOCKED')");
    expect(query.mock.calls[0][1]).toEqual([20, 100]);
    expect(result?.id).toBe(1);
  });

  it('guards member leave by member status and team status', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...memberRow, role: 'MEMBER', user_id: '200', status: 'LEFT' }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.leaveMember(1, 200);

    expect(query.mock.calls[0][0]).toContain("status in ('JOINED', 'CONFIRMED')");
    expect(query.mock.calls[0][0]).toContain("t.status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')");
    expect(query.mock.calls[0][0]).toContain('returning *');
    expect(query.mock.calls[0][1]).toEqual([1, 200]);
    expect(result?.status).toBe('LEFT');
  });

  it('refreshes size from confirmed members only', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...teamRow, size: 3 }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.refreshTeamSize(1);

    expect(query.mock.calls[0][0]).toContain("m.status = 'CONFIRMED'");
    expect(query.mock.calls[0][0]).toContain('update ticket_team');
    expect(query.mock.calls[0][1]).toEqual([1]);
    expect(result?.size).toBe(3);
  });

  it('guards team status updates when allowed current statuses are provided', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...teamRow, status: 'READY' }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.updateTeamStatus(1, 'READY', ['DRAFT', 'FAILED', 'EXPIRED', 'READY']);

    expect(query.mock.calls[0][0]).toContain('status = any($3::varchar[])');
    expect(query.mock.calls[0][1]).toEqual([1, 'READY', ['DRAFT', 'FAILED', 'EXPIRED', 'READY']]);
    expect(result?.status).toBe('READY');
  });

  it('keeps team status updates guarded even when no current statuses match', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.updateTeamStatus(1, 'READY', []);

    expect(query.mock.calls[0][0]).toContain('status = any($3::varchar[])');
    expect(query.mock.calls[0][1]).toEqual([1, 'READY', []]);
    expect(result).toBeNull();
  });
});
