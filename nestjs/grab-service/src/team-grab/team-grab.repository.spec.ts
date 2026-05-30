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

const teamGrabRow = {
  id: '7',
  request_id: 'TEAM-GRAB-1',
  grab_request_id: 'GRAB-QUEUED-1',
  team_id: '1',
  trigger_user_id: '200',
  payer_user_id: '100',
  session_id: '20',
  ticket_type_id: '30',
  quantity: 2,
  strategy: 'SAME_BLOCK',
  fallback_strategy_json: JSON.stringify(['SAME_TICKET_TYPE']),
  matched_strategy: null,
  status: 'PENDING',
  order_id: null,
  locked_seat_ids: JSON.stringify([]),
  seat_labels: JSON.stringify([]),
  fail_reason: null,
  create_time: new Date('2026-05-30T12:00:00.000Z'),
  update_time: new Date('2026-05-30T12:01:00.000Z'),
};

describe('TeamGrabRepository', () => {
  it('creates teams with parameterized strategy fallbacks and maps rows', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [teamRow] })
      .mockResolvedValueOnce({ rows: [memberRow] })
      .mockResolvedValueOnce({ rows: [{ ...teamRow, size: 1 }] });
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({
      withTransaction,
    } as any);

    const result = await repository.createTeam({
      inviteCode: 'TEAM1234',
      leaderUserId: 100,
      activityId: 10,
      sessionId: 20,
      ticketTypeId: 30,
      strategy: 'SAME_BLOCK',
      fallbacks: ['SAME_TICKET_TYPE', 'FALLBACK'],
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('insert into ticket_team'), [
      'TEAM1234',
      100,
      10,
      20,
      30,
      'SAME_BLOCK',
      JSON.stringify(['SAME_TICKET_TYPE', 'FALLBACK']),
      'DRAFT',
    ]);
    expect(query.mock.calls[1][0]).toContain('insert into ticket_team_member');
    expect(query.mock.calls[2][0]).toContain('update ticket_team');
    expect(result).toMatchObject({
      id: 1,
      inviteCode: 'TEAM1234',
      leaderUserId: 100,
      size: 1,
      fallbacks: ['SAME_TICKET_TYPE', 'FALLBACK'],
    });
  });

  it('rolls back team creation when leader insertion violates a unique constraint', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [teamRow] })
      .mockRejectedValueOnce(uniqueViolation);
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({
      withTransaction,
    } as any);

    await expect(repository.createTeam({
      inviteCode: 'TEAM1234',
      leaderUserId: 100,
      activityId: 10,
      sessionId: 20,
      ticketTypeId: 30,
      strategy: 'SAME_BLOCK',
      fallbacks: [],
    })).rejects.toBe(uniqueViolation);

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('insert into ticket_team');
    expect(query.mock.calls[1][0]).toContain('insert into ticket_team_member');
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
    expect(query.mock.calls[0][0].toLowerCase()).toContain('with locked_team as');
    expect(query.mock.calls[0][0].toLowerCase()).toContain('for update');
    expect(query.mock.calls[0][0]).toContain('returning ticket_team_member.*');
    expect(query.mock.calls[0][1]).toEqual([1, 200]);
    expect(result?.status).toBe('LEFT');
  });

  it('guards member insertion by active joined and confirmed capacity under a team lock', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.insertMember(1, 20, 200);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain('for update');
    expect(query.mock.calls[0][0]).toContain("m.status in ('JOINED', 'CONFIRMED')");
    expect(query.mock.calls[0][0]).toContain('active_members.count < 6');
    expect(sql).toMatch(/active_members\s+as\s*\([\s\S]*locked_team/);
    expect(sql).toMatch(/m\.team_id\s*=\s*locked_team\.id|m\.team_id\s*=\s*lt\.id/);
    expect(query.mock.calls[0][1]).toEqual([1, 20, 200]);
    expect(result).toBeNull();
  });

  it('guards invited member confirmation by active joined and confirmed capacity under a team lock', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.confirmMember(1, 200);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain('for update');
    expect(query.mock.calls[0][0]).toContain("m.status in ('JOINED', 'CONFIRMED')");
    expect(query.mock.calls[0][0]).toContain("ticket_team_member.status = 'JOINED'");
    expect(query.mock.calls[0][0]).toContain('active_members.count < 6');
    expect(sql).toMatch(/active_members\s+as\s*\([\s\S]*locked_team/);
    expect(sql).toMatch(/m\.team_id\s*=\s*locked_team\.id|m\.team_id\s*=\s*lt\.id/);
    expect(query.mock.calls[0][1]).toEqual([1, 200]);
    expect(result).toBeNull();
  });

  it('guards member removal with the locked team row', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...memberRow, role: 'MEMBER', user_id: '200', status: 'LEFT' }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.removeMember(1, 200);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain('with locked_team as');
    expect(sql).toContain('for update');
    expect(query.mock.calls[0][0]).toContain("t.status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')");
    expect(query.mock.calls[0][0]).toContain('ticket_team_member.team_id = locked_team.id');
    expect(query.mock.calls[0][0]).toContain("role = 'MEMBER'");
    expect(query.mock.calls[0][0]).toContain("status in ('INVITED', 'JOINED', 'CONFIRMED')");
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

  it('refreshes size and readiness from current confirmed member counts in one guarded query', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...teamRow, size: 2, status: 'READY' }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.refreshTeamReadiness(1);

    const sql = query.mock.calls[0][0];
    expect(query.mock.calls[0][0]).toContain('confirmed_members.count');
    expect(query.mock.calls[0][0]).toContain('between 2 and 6');
    expect(sql).toContain('leader_member');
    expect(sql).toContain("m.role = 'LEADER'");
    expect(sql).toContain('m.user_id = t.leader_user_id');
    expect(sql).toContain('leader_member.confirmed');
    expect(query.mock.calls[0][0]).toContain("t.status in ('DRAFT', 'FAILED', 'EXPIRED', 'READY')");
    expect(query.mock.calls[0][1]).toEqual([1]);
    expect(result?.status).toBe('READY');
    expect(result?.size).toBe(2);
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

  it('creates team grab requests with a distinct queued grab request association', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [teamGrabRow] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.createTeamGrabRequest({
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
    });

    expect(query.mock.calls[0][0]).toContain('grab_request_id');
    expect(query.mock.calls[0][1]).toEqual([
      'TEAM-GRAB-1',
      'GRAB-QUEUED-1',
      1,
      200,
      100,
      20,
      30,
      2,
      'SAME_BLOCK',
      JSON.stringify(['SAME_TICKET_TYPE']),
    ]);
    expect(result.requestId).toBe('TEAM-GRAB-1');
    expect(result.grabRequestId).toBe('GRAB-QUEUED-1');
  });

  it('finds team grab requests by queued grab request id', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [teamGrabRow] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.findTeamGrabByGrabRequestId('GRAB-QUEUED-1');

    expect(query.mock.calls[0][0]).toContain('grab_request_id = $1');
    expect(query.mock.calls[0][1]).toEqual(['GRAB-QUEUED-1']);
    expect(result?.requestId).toBe('TEAM-GRAB-1');
  });

  it('finds locked team grab requests with created orders', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...teamGrabRow, status: 'ORDER_CREATED', order_id: '9001' }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.findLockedTeamGrabRequests(50);

    expect(query.mock.calls[0][0]).toContain("t.status = 'LOCKED'");
    expect(query.mock.calls[0][0]).toContain('r.order_id is not null');
    expect(query.mock.calls[0][1]).toEqual([50]);
    expect(result[0]).toMatchObject({ requestId: 'TEAM-GRAB-1', orderId: 9001 });
  });

  it('finds stale pre-order team grab requests with locked seats and no order', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...teamGrabRow, status: 'GRABBING', locked_seat_ids: JSON.stringify([501]) }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.findStalePreOrderTeamGrabRequests(25, 30);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("status in ('grabbing', 'locked')");
    expect(sql).toContain('order_id is null');
    expect(sql).toContain('jsonb_array_length');
    expect(sql).toContain('interval');
    expect(query.mock.calls[0][1]).toEqual([25, 30]);
    expect(result[0].lockedSeatIds).toEqual([501]);
  });

  it('inserts seat assignments idempotently and updates member seat fields in one transaction', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({ withTransaction } as any);

    await repository.insertSeatAssignments(7, 9001, [
      { userId: 100, orderSeatId: 7001, sessionSeatId: 501, seatLabel: 'A-1' },
      { userId: 200, orderSeatId: 7002, sessionSeatId: 502, seatLabel: 'A-2' },
    ]);

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('insert into team_seat_assignment');
    expect(query.mock.calls[0][0].toLowerCase()).toContain('on conflict do nothing');
    expect(query.mock.calls[1][0]).toContain('update ticket_team_member');
    expect(query.mock.calls[1][1]).toEqual([7, 100, 7001, 501]);
    expect(query.mock.calls[3][1]).toEqual([7, 200, 7002, 502]);
  });

  it('assigns paid team seats and marks the team paid in one locked transaction', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: '7' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ team_id: '7', user_id: '100', order_id: '9001', order_seat_id: '7001', session_seat_id: '501', seat_label: 'A-1' }] })
      .mockResolvedValueOnce({ rows: [{ ...memberRow, team_id: '7', user_id: '100', order_seat_id: '7001', seat_id: '501' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ team_id: '7', user_id: '200', order_id: '9001', order_seat_id: '7002', session_seat_id: '502', seat_label: 'A-2' }] })
      .mockResolvedValueOnce({ rows: [{ ...memberRow, id: '10', team_id: '7', user_id: '200', order_seat_id: '7002', seat_id: '502' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamRow, id: '7', status: 'PAID' }] });
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({ withTransaction } as any);

    const transitioned = await repository.assignPaidTeamSeats(7, 9001, [
      { userId: 100, orderSeatId: 7001, sessionSeatId: 501, seatLabel: 'A-1' },
      { userId: 200, orderSeatId: 7002, sessionSeatId: 502, seatLabel: 'A-2' },
    ]);

    expect(transitioned).toBe(true);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0].toLowerCase()).toContain("status = 'locked'");
    expect(query.mock.calls[0][0].toLowerCase()).toContain('for update');
    expect(query.mock.calls[2][0]).toContain('on conflict (team_id, user_id) do update');
    expect(query.mock.calls[2][0]).toContain('is not distinct from');
    expect(query.mock.calls[2][0].toLowerCase()).not.toContain('update_time');
    expect(query.mock.calls[3][0]).toContain('update ticket_team_member');
    expect(query.mock.calls[7][0]).toContain("status = 'PAID'");
    expect(query.mock.calls[7][0]).toContain("status = 'LOCKED'");
  });

  it('returns false without assignments when paid team assignment cannot lock a LOCKED team', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({ withTransaction } as any);

    const transitioned = await repository.assignPaidTeamSeats(7, 9001, [
      { userId: 100, orderSeatId: 7001, sessionSeatId: 501, seatLabel: 'A-1' },
    ]);

    expect(transitioned).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('throws before stamping members when a paid order seat belongs to another assignment', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: '7' }] })
      .mockResolvedValueOnce({
        rows: [{
          team_id: '8',
          user_id: '300',
          order_id: '9002',
          order_seat_id: '7001',
          session_seat_id: '501',
          seat_label: 'A-1',
        }],
      });
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({ withTransaction } as any);

    await expect(repository.assignPaidTeamSeats(7, 9001, [
      { userId: 100, orderSeatId: 7001, sessionSeatId: 501, seatLabel: 'A-1' },
    ])).rejects.toThrow('team seat assignment conflict');

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('marks teams paid, expired, and failed with guarded status transitions', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ ...teamRow, status: 'PAID' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamGrabRow, status: 'EXPIRED' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamRow, status: 'EXPIRED' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamGrabRow, status: 'FAILED' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamRow, status: 'FAILED' }] });
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({ query, withTransaction } as any);

    await repository.markTeamPaid(7);
    await repository.markTeamExpired(7, 'ORDER_CANCELLED');
    await repository.markTeamFailed(7, 'TEAM-GRAB-1', 'ORDER_CREATE_TIMEOUT');

    expect(query.mock.calls[0][0]).toContain("status = 'PAID'");
    expect(query.mock.calls[0][0]).toContain("status = 'LOCKED'");
    expect(query.mock.calls[0][1]).toEqual([7]);
    expect(withTransaction).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain("status = 'EXPIRED'");
    expect(query.mock.calls[1][1]).toEqual([7, 'ORDER_CANCELLED']);
    expect(query.mock.calls[3][0]).toContain("status = 'FAILED'");
    expect(query.mock.calls[3][1]).toEqual(['TEAM-GRAB-1', 'ORDER_CREATE_TIMEOUT']);
  });
});
