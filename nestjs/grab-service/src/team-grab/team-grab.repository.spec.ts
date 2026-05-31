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
  seat_label: null,
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

  it('lists members with order-owned team seat assignment labels', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ ...memberRow, seat_id: '501', order_seat_id: '7001', seat_label: 'A-1' }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.listMembers(1);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain('left join team_seat_assignment');
    expect(sql).toContain('a.seat_label');
    expect(query.mock.calls[0][1]).toEqual([1]);
    expect(result[0]).toMatchObject({
      userId: 100,
      seatId: 501,
      orderSeatId: 7001,
      seatLabel: 'A-1',
    });
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

  it('begins a team grab by locking the team, freezing confirmed members, inserting queued and team requests, and marking grabbing in one transaction', async () => {
    const confirmedRows = [
      { ...memberRow, id: '9', user_id: '100', role: 'LEADER', join_time: new Date('2026-05-30T12:00:00.000Z') },
      { ...memberRow, id: '10', user_id: '200', role: 'MEMBER', join_time: new Date('2026-05-30T12:01:00.000Z') },
    ];
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ ...teamRow, status: 'READY', size: 2 }] })
      .mockResolvedValueOnce({ rows: confirmedRows })
      .mockResolvedValueOnce({ rows: [{ ...teamGrabRow, quantity: 2, status: 'PENDING' }] })
      .mockResolvedValueOnce({ rows: [{ request_id: 'GRAB-QUEUED-1' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamRow, status: 'GRABBING', size: 2 }] });
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({ withTransaction } as any);

    const result = await repository.beginTeamGrab({
      teamId: 1,
      triggerUserId: 200,
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-QUEUED-1',
      queueSeq: 11,
      idempotencyKey: 'team:1:TEAM-GRAB-1',
      expireTime: new Date('2026-05-30T12:15:00.000Z'),
      requestedTicketTypes: [{ ticketTypeId: 30, name: null, maxPrice: null }],
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    const lockSql = query.mock.calls[0][0].toLowerCase();
    expect(lockSql).toContain('from ticket_team');
    expect(lockSql).toContain("status in ('ready', 'failed', 'expired')");
    expect(lockSql).toContain('for update');
    expect(query.mock.calls[0][1]).toEqual([1]);

    const memberSql = query.mock.calls[1][0].toLowerCase();
    expect(memberSql).toContain('from ticket_team_member');
    expect(memberSql).toContain("status = 'confirmed'");
    expect(memberSql).toContain('order by');
    expect(query.mock.calls[1][1]).toEqual([1]);

    expect(query.mock.calls[2][0]).toContain('insert into team_grab_request');
    expect(query.mock.calls[2][1]).toEqual([
      'TEAM-GRAB-1',
      'GRAB-QUEUED-1',
      1,
      200,
      100,
      20,
      30,
      2,
      'SAME_BLOCK',
      JSON.stringify(['SAME_TICKET_TYPE', 'FALLBACK']),
    ]);

    const queuedGrabSql = query.mock.calls[3][0].toLowerCase();
    expect(queuedGrabSql).toContain('insert into grab_request');
    expect(queuedGrabSql).toContain('request_type');
    expect(queuedGrabSql).toContain('queue_seq');
    expect(query.mock.calls[3][1]).toEqual([
      'GRAB-QUEUED-1',
      'team:1:TEAM-GRAB-1',
      100,
      20,
      30,
      2,
      JSON.stringify([]),
      true,
      'QUEUED',
      'QUEUED',
      '你前面还有 10 人',
      'TEAM_GRAB',
      11,
      JSON.stringify([{ ticketTypeId: 30, name: null, maxPrice: null }]),
      false,
      30,
      0,
      JSON.stringify([{ ticketTypeId: 30, name: null, status: 'PENDING', message: '待尝试' }]),
      new Date('2026-05-30T12:15:00.000Z'),
    ]);

    const updateSql = query.mock.calls[4][0].toLowerCase();
    expect(updateSql).toContain("status = 'grabbing'");
    expect(updateSql).toContain('size = $2');
    expect(updateSql).toContain("status in ('ready', 'failed', 'expired')");
    expect(query.mock.calls[4][1]).toEqual([1, 2]);
    expect(result).toMatchObject({
      team: { status: 'GRABBING', size: 2 },
      teamGrabRequest: { requestId: 'TEAM-GRAB-1', quantity: 2 },
      confirmedMembers: [{ userId: 100 }, { userId: 200 }],
    });
  });

  it('finds team grab requests by queued grab request id', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [teamGrabRow] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.findTeamGrabByGrabRequestId('GRAB-QUEUED-1');

    expect(query.mock.calls[0][0]).toContain('grab_request_id = $1');
    expect(query.mock.calls[0][1]).toEqual(['GRAB-QUEUED-1']);
    expect(result?.requestId).toBe('TEAM-GRAB-1');
  });

  it('finds latest team grab request for a team by update time and id', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...teamGrabRow, order_id: '9001' }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.findLatestTeamGrabRequestByTeamId(1);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain('from team_grab_request');
    expect(sql).toContain('where team_id = $1');
    expect(sql).toContain('order by update_time desc, id desc');
    expect(sql).toContain('limit 1');
    expect(query.mock.calls[0][1]).toEqual([1]);
    expect(result).toMatchObject({
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-QUEUED-1',
      orderId: 9001,
    });
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

  it('finds stale order-creating team grabs without persisted locked seats for request-id recovery', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ ...teamGrabRow, status: 'GRABBING', locked_seat_ids: JSON.stringify([]) }] });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.findStalePreOrderTeamGrabRequests(25, 30);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain('exists');
    expect(sql).toContain('from grab_request g');
    expect(sql).toContain("g.request_type = 'team_grab'");
    expect(sql).toContain("g.status = 'order_creating'");
    expect(sql).toContain("g.progress_status = 'order_creating'");
    expect(sql).toContain('g.order_id is null');
    expect(query.mock.calls[0][1]).toEqual([25, 30]);
    expect(result[0].lockedSeatIds).toEqual([]);
  });

  it('finds stale unpublished queued team grab requests before seat locks are acquired', async () => {
    const expireTime = new Date('2026-05-30T12:15:00.000Z');
    const query = jest.fn().mockResolvedValue({
      rows: [{
        team_id: '7',
        team_grab_request_id: 'TEAM-GRAB-1',
        grab_request_id: 'GRAB-QUEUED-1',
        session_id: '20',
        payer_user_id: '100',
        queue_seq: '11',
        grab_status: 'QUEUED',
        grab_progress_status: 'QUEUED',
        expire_time: expireTime,
      }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.findStaleUnpublishedTeamGrabRequests(25, 30);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain('from team_grab_request r');
    expect(sql).toContain('join grab_request g on g.request_id = r.grab_request_id');
    expect(sql).toContain('join ticket_team t on t.id = r.team_id');
    expect(sql).toContain("r.status = 'pending'");
    expect(sql).toContain('r.order_id is null');
    expect(sql).toContain('jsonb_array_length');
    expect(sql).toContain('g.status as grab_status');
    expect(sql).toContain('g.progress_status as grab_progress_status');
    expect(sql).toContain("g.status = 'queued'");
    expect(sql).toContain("g.progress_status = 'queued'");
    expect(sql).toContain("g.status in ('expired', 'failed'");
    expect(sql).toContain("g.progress_status in ('expired', 'failed'");
    expect(sql).toContain("t.status = 'grabbing'");
    expect(sql).toContain('g.queue_seq is not null');
    expect(sql).toContain('interval');
    expect(query.mock.calls[0][1]).toEqual([25, 30]);
    expect(result).toEqual([{
      teamId: 7,
      teamGrabRequestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-QUEUED-1',
      sessionId: 20,
      payerUserId: 100,
      queueSeq: 11,
      grabStatus: 'QUEUED',
      grabProgressStatus: 'QUEUED',
      expireTime,
    }]);
  });

  it('atomically claims stale pre-order recovery without changing status enum', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...teamGrabRow,
        status: 'LOCKED',
        locked_seat_ids: JSON.stringify([501]),
        fail_reason: 'ORDER_CREATE_TIMEOUT_CLAIMED',
      }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.claimStalePreOrderRecovery('TEAM-GRAB-1', 30);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain('update team_grab_request');
    expect(sql).toContain("fail_reason = 'order_create_timeout_claimed'");
    expect(sql).toContain('from ticket_team');
    expect(sql).toContain('r.request_id = $1');
    expect(sql).toContain("r.status in ('grabbing', 'locked')");
    expect(sql).toContain('r.order_id is null');
    expect(sql).toContain("r.fail_reason is null");
    expect(sql).toContain('jsonb_array_length');
    expect(sql).toContain("t.status in ('grabbing', 'locked')");
    expect(sql).toContain('interval');
    expect(query.mock.calls[0][1]).toEqual(['TEAM-GRAB-1', 30]);
    expect(result).toMatchObject({
      requestId: 'TEAM-GRAB-1',
      status: 'LOCKED',
      lockedSeatIds: [501],
      failReason: 'ORDER_CREATE_TIMEOUT_CLAIMED',
    });
  });

  it('claims stale order-creating team grabs without persisted locked seats for request-id release', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...teamGrabRow,
        status: 'GRABBING',
        locked_seat_ids: JSON.stringify([]),
        fail_reason: 'ORDER_CREATE_TIMEOUT_CLAIMED',
      }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.claimStalePreOrderRecovery('TEAM-GRAB-1', 30);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("fail_reason = 'order_create_timeout_claimed'");
    expect(sql).toContain('exists');
    expect(sql).toContain('from grab_request g');
    expect(sql).toContain("g.request_type = 'team_grab'");
    expect(sql).toContain("g.status = 'order_creating'");
    expect(sql).toContain("g.progress_status = 'order_creating'");
    expect(sql).toContain('g.order_id is null');
    expect(query.mock.calls[0][1]).toEqual(['TEAM-GRAB-1', 30]);
    expect(result).toMatchObject({
      requestId: 'TEAM-GRAB-1',
      status: 'GRABBING',
      lockedSeatIds: [],
      failReason: 'ORDER_CREATE_TIMEOUT_CLAIMED',
    });
  });

  it('marks a failed release compensation as stale pre-order recoverable with locked seats', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...teamGrabRow,
        status: 'LOCKED',
        locked_seat_ids: JSON.stringify([501, 502]),
        seat_labels: JSON.stringify(['A-1', 'A-2']),
        matched_strategy: 'SAME_BLOCK',
        fail_reason: 'ORDER_CREATE_TIMEOUT_CLAIMED',
      }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.markTeamGrabReleasePending('TEAM-GRAB-1', {
      lockedSeatIds: [501, 502],
      seatLabels: ['A-1', 'A-2'],
      matchedStrategy: 'SAME_BLOCK',
    });

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("set status = 'locked'");
    expect(sql).toContain('locked_seat_ids = $2::jsonb');
    expect(sql).toContain('seat_labels = $3::jsonb');
    expect(sql).toContain('matched_strategy = $4');
    expect(sql).toContain("fail_reason = 'order_create_timeout_claimed'");
    expect(sql).toContain("status in ('grabbing', 'locked')");
    expect(sql).toContain('order_id is null');
    expect(query.mock.calls[0][1]).toEqual([
      'TEAM-GRAB-1',
      JSON.stringify([501, 502]),
      JSON.stringify(['A-1', 'A-2']),
      'SAME_BLOCK',
    ]);
    expect(result).toMatchObject({
      requestId: 'TEAM-GRAB-1',
      status: 'LOCKED',
      lockedSeatIds: [501, 502],
      seatLabels: ['A-1', 'A-2'],
      matchedStrategy: 'SAME_BLOCK',
      failReason: 'ORDER_CREATE_TIMEOUT_CLAIMED',
    });
  });

  it('atomically claims stale pre-order release only from an existing recovery claim', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...teamGrabRow,
        status: 'LOCKED',
        locked_seat_ids: JSON.stringify([501]),
        fail_reason: 'ORDER_CREATE_TIMEOUT_RELEASING',
      }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.claimStalePreOrderRelease('TEAM-GRAB-1', 30);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("fail_reason = 'order_create_timeout_releasing'");
    expect(sql).toContain("r.fail_reason in ('order_create_timeout_claimed', 'order_create_timeout_releasing')");
    expect(sql).toContain("r.status in ('grabbing', 'locked')");
    expect(sql).toContain('r.order_id is null');
    expect(sql).toContain("t.status in ('grabbing', 'locked')");
    expect(query.mock.calls[0][1]).toEqual(['TEAM-GRAB-1', 30]);
    expect(result).toMatchObject({
      requestId: 'TEAM-GRAB-1',
      failReason: 'ORDER_CREATE_TIMEOUT_RELEASING',
    });
  });

  it('claims request-id release for stale team grabs without persisted locked seats', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        ...teamGrabRow,
        status: 'GRABBING',
        locked_seat_ids: JSON.stringify([]),
        fail_reason: 'ORDER_CREATE_TIMEOUT_RELEASING',
      }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    const result = await repository.claimStalePreOrderRelease('TEAM-GRAB-1', 30);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("fail_reason = 'order_create_timeout_releasing'");
    expect(sql).toContain("r.fail_reason in ('order_create_timeout_claimed', 'order_create_timeout_releasing')");
    expect(sql).toContain('exists');
    expect(sql).toContain('from grab_request g');
    expect(sql).toContain("g.request_type = 'team_grab'");
    expect(sql).toContain("g.status = 'order_creating'");
    expect(sql).toContain("g.progress_status = 'order_creating'");
    expect(sql).toContain('g.order_id is null');
    expect(query.mock.calls[0][1]).toEqual(['TEAM-GRAB-1', 30]);
    expect(result).toMatchObject({
      requestId: 'TEAM-GRAB-1',
      status: 'GRABBING',
      lockedSeatIds: [],
      failReason: 'ORDER_CREATE_TIMEOUT_RELEASING',
    });
  });

  it('marks team order creation in progress only when no recovery marker exists', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ ...teamGrabRow, status: 'LOCKED', fail_reason: 'ORDER_CREATE_IN_PROGRESS' }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    await repository.markTeamGrabOrderCreateInProgress('TEAM-GRAB-1');

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("fail_reason = 'order_create_in_progress'");
    expect(sql).toContain("status in ('locked', 'grabbing')");
    expect(sql).toContain('order_id is null');
    expect(sql).toContain("(fail_reason is null or fail_reason = 'order_create_in_progress')");
    expect(query.mock.calls[0][1]).toEqual(['TEAM-GRAB-1']);
  });

  it('keeps normal order-created persistence from winning after a recovery claim', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ ...teamGrabRow, status: 'ORDER_CREATED', order_id: '9001' }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    await repository.markTeamGrabOrderCreated('TEAM-GRAB-1', 9001);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("fail_reason is distinct from 'order_create_timeout_claimed'");
    expect(sql).toContain("fail_reason is distinct from 'order_create_timeout_releasing'");
    expect(query.mock.calls[0][1]).toEqual(['TEAM-GRAB-1', 9001]);
  });

  it('allows claimed recovery to persist an order found by second lookup', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ ...teamGrabRow, status: 'ORDER_CREATED', order_id: '9001', fail_reason: null }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    await repository.markClaimedTeamGrabOrderCreated('TEAM-GRAB-1', 9001);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("fail_reason = 'order_create_timeout_claimed'");
    expect(query.mock.calls[0][1]).toEqual(['TEAM-GRAB-1', 9001]);
  });

  it('repairs recovered order-created team grabs from claimed or releasing markers idempotently', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ ...teamGrabRow, status: 'ORDER_CREATED', order_id: '9001', fail_reason: null }],
    });
    const repository = new TeamGrabRepository({ query } as any);

    await repository.repairTeamGrabOrderCreated('TEAM-GRAB-1', 9001);

    const sql = query.mock.calls[0][0].toLowerCase();
    expect(sql).toContain("status = 'order_created'");
    expect(sql).toContain('order_id = $2');
    expect(sql).toContain("status in ('locked', 'grabbing', 'order_created')");
    expect(sql).toContain('(order_id is null or order_id = $2)');
    expect(sql).toContain("fail_reason is null");
    expect(sql).toContain("order_create_timeout_claimed");
    expect(sql).toContain("order_create_timeout_releasing");
    expect(query.mock.calls[0][1]).toEqual(['TEAM-GRAB-1', 9001]);
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
      .mockResolvedValueOnce({ rows: [{ ...teamRow, status: 'EXPIRED' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamGrabRow, status: 'EXPIRED' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamRow, status: 'FAILED' }] })
      .mockResolvedValueOnce({ rows: [{ ...teamGrabRow, status: 'FAILED' }] });
    const withTransaction = jest.fn((callback) => callback({ query }));
    const repository = new TeamGrabRepository({ query, withTransaction } as any);

    await repository.markTeamPaid(7);
    const expired = await repository.markTeamExpired(7, 'ORDER_CANCELLED');
    const failed = await repository.markTeamFailed(7, 'TEAM-GRAB-1', 'ORDER_CREATE_TIMEOUT');

    expect(query.mock.calls[0][0]).toContain("status = 'PAID'");
    expect(query.mock.calls[0][0]).toContain("status = 'LOCKED'");
    expect(query.mock.calls[0][1]).toEqual([7]);
    expect(withTransaction).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain("status = 'EXPIRED'");
    expect(query.mock.calls[1][0]).toContain("status = 'LOCKED'");
    expect(query.mock.calls[1][1]).toEqual([7]);
    expect(query.mock.calls[2][0]).toContain("status = 'EXPIRED'");
    expect(query.mock.calls[2][1]).toEqual([7, 'ORDER_CANCELLED']);
    expect(query.mock.calls[3][0]).toContain("status = 'FAILED'");
    expect(query.mock.calls[3][0]).toContain("status in ('GRABBING', 'LOCKED', 'READY')");
    expect(query.mock.calls[3][1]).toEqual([7]);
    expect(query.mock.calls[4][0]).toContain("status = 'FAILED'");
    expect(query.mock.calls[4][1]).toEqual(['TEAM-GRAB-1', 'ORDER_CREATE_TIMEOUT']);
    expect(expired).toBe(true);
    expect(failed).toBe(true);
  });

  it('returns false without updating team grab rows when terminal team transition loses', async () => {
    const expireQuery = jest.fn().mockResolvedValueOnce({ rows: [] });
    const failQuery = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new TeamGrabRepository({
      withTransaction: jest.fn()
        .mockImplementationOnce((callback) => callback({ query: expireQuery }))
        .mockImplementationOnce((callback) => callback({ query: failQuery })),
    } as any);

    await expect(repository.markTeamExpired(7, 'ORDER_CANCELLED')).resolves.toBe(false);
    await expect(repository.markTeamFailed(7, 'TEAM-GRAB-1', 'ORDER_CREATE_TIMEOUT')).resolves.toBe(false);

    expect(expireQuery).toHaveBeenCalledTimes(1);
    expect(failQuery).toHaveBeenCalledTimes(1);
  });
});
