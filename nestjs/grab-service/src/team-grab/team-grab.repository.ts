import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { DatabaseQueryClient } from '../database/database.service';
import type {
  CreateTeamInput,
  CreateTeamGrabRequestInput,
  TeamMemberRole,
  TeamMemberStatus,
  TeamGrabRequestRecord,
  TeamSeatAssignmentInput,
  TeamSeatStrategy,
  TeamStatus,
  TicketTeamMemberRecord,
  TicketTeamRecord,
} from './team-grab.types';

interface TicketTeamRow {
  id: string | number;
  invite_code: string;
  leader_user_id: string | number;
  activity_id: string | number;
  session_id: string | number;
  ticket_type_id: string | number;
  size: number;
  strategy: TeamSeatStrategy;
  fallback_strategy_json: TeamSeatStrategy[] | string | null;
  status: TeamStatus;
  create_time: Date;
  update_time: Date;
}

interface TicketTeamMemberRow {
  id: string | number;
  team_id: string | number;
  session_id: string | number;
  user_id: string | number;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  seat_id: string | number | null;
  order_seat_id: string | number | null;
  join_time: Date;
}

interface TeamGrabRequestRow {
  id: string | number;
  request_id: string;
  grab_request_id?: string | null;
  team_id: string | number;
  trigger_user_id: string | number;
  payer_user_id: string | number;
  session_id: string | number;
  ticket_type_id: string | number;
  quantity: number;
  strategy: TeamSeatStrategy;
  fallback_strategy_json: TeamSeatStrategy[] | string | null;
  matched_strategy: TeamSeatStrategy | null;
  status: TeamGrabRequestRecord['status'];
  order_id: string | number | null;
  locked_seat_ids: number[] | string | null;
  seat_labels: string[] | string | null;
  fail_reason: string | null;
  create_time: Date;
  update_time: Date;
}

interface TeamSeatAssignmentRow {
  team_id: string | number;
  user_id: string | number;
  order_id: string | number;
  order_seat_id: string | number;
  session_seat_id: string | number;
  seat_label: string | null;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

@Injectable()
export class TeamGrabRepository {
  constructor(private readonly database: DatabaseService) {}

  async createTeam(input: CreateTeamInput): Promise<TicketTeamRecord> {
    return this.database.withTransaction(async (client) => {
      const team = await this.insertTeam(client, input);
      await this.insertLeaderMemberWithClient(client, team.id, team.sessionId, input.leaderUserId);
      return (await this.refreshTeamSizeWithClient(client, team.id)) ?? team;
    });
  }

  private async insertTeam(client: DatabaseQueryClient, input: CreateTeamInput): Promise<TicketTeamRecord> {
    const result = await client.query<TicketTeamRow>(
      `insert into ticket_team (
        invite_code, leader_user_id, activity_id, session_id, ticket_type_id,
        strategy, fallback_strategy_json, status
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      returning *`,
      [
        input.inviteCode,
        input.leaderUserId,
        input.activityId,
        input.sessionId,
        input.ticketTypeId,
        input.strategy,
        JSON.stringify(input.fallbacks),
        'DRAFT',
      ],
    );
    return this.mapTeamRow(result.rows[0]);
  }

  async insertLeaderMember(teamId: number, sessionId: number, leaderUserId: number): Promise<TicketTeamMemberRecord> {
    return this.insertLeaderMemberWithClient(this.database, teamId, sessionId, leaderUserId);
  }

  private async insertLeaderMemberWithClient(
    client: DatabaseQueryClient,
    teamId: number,
    sessionId: number,
    leaderUserId: number,
  ): Promise<TicketTeamMemberRecord> {
    const result = await client.query<TicketTeamMemberRow>(
      `insert into ticket_team_member (team_id, session_id, user_id, role, status)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [teamId, sessionId, leaderUserId, 'LEADER', 'CONFIRMED'],
    );
    return this.mapMemberRow(result.rows[0]);
  }

  async findTeamById(teamId: number): Promise<TicketTeamRecord | null> {
    const result = await this.database.query<TicketTeamRow>(
      `select * from ticket_team where id = $1 limit 1`,
      [teamId],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  async findTeamByInviteCode(inviteCode: string): Promise<TicketTeamRecord | null> {
    const result = await this.database.query<TicketTeamRow>(
      `select * from ticket_team where invite_code = $1 limit 1`,
      [inviteCode],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  async findActiveTeamForUser(sessionId: number, userId: number): Promise<TicketTeamRecord | null> {
    const result = await this.database.query<TicketTeamRow>(
      `select t.*
       from ticket_team t
       join ticket_team_member m on m.team_id = t.id
       where t.session_id = $1
         and m.user_id = $2
         and m.status in ('INVITED', 'JOINED', 'CONFIRMED')
         and t.status in ('DRAFT', 'READY', 'GRABBING', 'LOCKED')
       order by t.create_time desc
       limit 1`,
      [sessionId, userId],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  async listMembers(teamId: number): Promise<TicketTeamMemberRecord[]> {
    const result = await this.database.query<TicketTeamMemberRow>(
      `select * from ticket_team_member
       where team_id = $1
       order by join_time asc, id asc`,
      [teamId],
    );
    return result.rows.map((row) => this.mapMemberRow(row));
  }

  async findMember(teamId: number, userId: number): Promise<TicketTeamMemberRecord | null> {
    const result = await this.database.query<TicketTeamMemberRow>(
      `select * from ticket_team_member
       where team_id = $1 and user_id = $2
       limit 1`,
      [teamId, userId],
    );
    return result.rows[0] ? this.mapMemberRow(result.rows[0]) : null;
  }

  async insertMember(teamId: number, sessionId: number, userId: number): Promise<TicketTeamMemberRecord | null> {
    const result = await this.database.query<TicketTeamMemberRow>(
      `with locked_team as (
         select t.id
         from ticket_team t
         where t.id = $1
           and t.session_id = $2
           and t.status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')
         for update
       ),
       active_members as (
         select count(*)::int as count
         from locked_team
         join ticket_team_member m
           on m.team_id = locked_team.id
          and m.status in ('JOINED', 'CONFIRMED')
       )
       insert into ticket_team_member (team_id, session_id, user_id, role, status)
       select $1, $2, $3, 'MEMBER', 'JOINED'
       from locked_team, active_members
       where active_members.count < 6
       on conflict (team_id, user_id) do update
       set status = 'JOINED', update_time = now()
       where ticket_team_member.status = 'LEFT'
         and (select count from active_members) < 6
       returning *`,
      [teamId, sessionId, userId],
    );
    return result.rows[0] ? this.mapMemberRow(result.rows[0]) : null;
  }

  async confirmMember(teamId: number, userId: number): Promise<TicketTeamMemberRecord | null> {
    const result = await this.database.query<TicketTeamMemberRow>(
      `with locked_team as (
         select t.id
         from ticket_team t
         where t.id = $1 and t.status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')
         for update
       ),
       active_members as (
         select count(*)::int as count
         from locked_team
         join ticket_team_member m
           on m.team_id = locked_team.id
          and m.status in ('JOINED', 'CONFIRMED')
       )
       update ticket_team_member
       set status = 'CONFIRMED', update_time = now()
       from locked_team, active_members
       where ticket_team_member.team_id = $1
         and ticket_team_member.user_id = $2
         and ticket_team_member.status in ('INVITED', 'JOINED')
         and (
           ticket_team_member.status = 'JOINED'
           or active_members.count < 6
         )
       returning ticket_team_member.*`,
      [teamId, userId],
    );
    return result.rows[0] ? this.mapMemberRow(result.rows[0]) : null;
  }

  async leaveMember(teamId: number, userId: number): Promise<TicketTeamMemberRecord | null> {
    const result = await this.database.query<TicketTeamMemberRow>(
      `with locked_team as (
         select t.id
         from ticket_team t
         where t.id = $1 and t.status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')
         for update
       )
       update ticket_team_member
       set status = 'LEFT', update_time = now()
       from locked_team
       where ticket_team_member.team_id = locked_team.id
         and ticket_team_member.team_id = $1
         and ticket_team_member.user_id = $2
         and ticket_team_member.status in ('JOINED', 'CONFIRMED')
       returning ticket_team_member.*`,
      [teamId, userId],
    );
    return result.rows[0] ? this.mapMemberRow(result.rows[0]) : null;
  }

  async removeMember(teamId: number, userId: number): Promise<TicketTeamMemberRecord | null> {
    const result = await this.database.query<TicketTeamMemberRow>(
      `with locked_team as (
         select t.id
         from ticket_team t
         where t.id = $1 and t.status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')
         for update
       )
       update ticket_team_member
       set status = 'LEFT', update_time = now()
       from locked_team
       where ticket_team_member.team_id = locked_team.id
         and ticket_team_member.team_id = $1
         and ticket_team_member.user_id = $2
         and ticket_team_member.role = 'MEMBER'
         and ticket_team_member.status in ('INVITED', 'JOINED', 'CONFIRMED')
       returning ticket_team_member.*`,
      [teamId, userId],
    );
    return result.rows[0] ? this.mapMemberRow(result.rows[0]) : null;
  }

  async updateStrategy(
    teamId: number,
    strategy: TeamSeatStrategy,
    fallbacks: TeamSeatStrategy[],
  ): Promise<TicketTeamRecord | null> {
    const result = await this.database.query<TicketTeamRow>(
      `update ticket_team
       set strategy = $2,
           fallback_strategy_json = $3::jsonb,
           update_time = now()
       where id = $1
         and status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')
       returning *`,
      [teamId, strategy, JSON.stringify(fallbacks)],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  async updateTeamStatus(
    teamId: number,
    status: TeamStatus,
    allowedCurrentStatuses: TeamStatus[],
  ): Promise<TicketTeamRecord | null> {
    const result = await this.database.query<TicketTeamRow>(
      `update ticket_team
       set status = $2, update_time = now()
       where id = $1
         and status = any($3::varchar[])
       returning *`,
      [teamId, status, allowedCurrentStatuses],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  async listConfirmedMembers(teamId: number): Promise<TicketTeamMemberRecord[]> {
    const result = await this.database.query<TicketTeamMemberRow>(
      `select * from ticket_team_member
       where team_id = $1 and status = 'CONFIRMED'
       order by join_time asc, id asc`,
      [teamId],
    );
    return result.rows.map((row) => this.mapMemberRow(row));
  }

  async createTeamGrabRequest(input: CreateTeamGrabRequestInput): Promise<TeamGrabRequestRecord> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `insert into team_grab_request (
        request_id, grab_request_id, team_id, trigger_user_id, payer_user_id,
        session_id, ticket_type_id, quantity, strategy, fallback_strategy_json
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      returning *`,
      [
        input.requestId,
        input.grabRequestId,
        input.teamId,
        input.triggerUserId,
        input.payerUserId,
        input.sessionId,
        input.ticketTypeId,
        input.quantity,
        input.strategy,
        JSON.stringify(input.fallbacks),
      ],
    );
    return this.mapTeamGrabRow(result.rows[0]);
  }

  async findTeamGrabByGrabRequestId(grabRequestId: string): Promise<TeamGrabRequestRecord | null> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `select * from team_grab_request
       where grab_request_id = $1
       order by create_time desc
       limit 1`,
      [grabRequestId],
    );
    return result.rows[0] ? this.mapTeamGrabRow(result.rows[0]) : null;
  }

  async findLockedTeamGrabRequests(limit: number): Promise<TeamGrabRequestRecord[]> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `select r.*
       from team_grab_request r
       join ticket_team t on t.id = r.team_id
       where t.status = 'LOCKED'
         and r.order_id is not null
         and r.status in ('ORDER_CREATED', 'LOCKED')
       order by r.update_time asc
       limit $1`,
      [limit],
    );
    return result.rows.map((row) => this.mapTeamGrabRow(row));
  }

  async findLockedTeamGrabRequestByTeamId(teamId: number): Promise<TeamGrabRequestRecord | null> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `select r.*
       from team_grab_request r
       join ticket_team t on t.id = r.team_id
       where t.id = $1
         and t.status = 'LOCKED'
         and r.order_id is not null
         and r.status in ('ORDER_CREATED', 'LOCKED')
       order by r.update_time asc
       limit 1`,
      [teamId],
    );
    return result.rows[0] ? this.mapTeamGrabRow(result.rows[0]) : null;
  }

  async findStalePreOrderTeamGrabRequests(limit: number, olderThanSeconds: number): Promise<TeamGrabRequestRecord[]> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `select *
       from team_grab_request
       where status in ('GRABBING', 'LOCKED')
         and order_id is null
         and jsonb_array_length(coalesce(locked_seat_ids, '[]'::jsonb)) > 0
         and update_time < now() - ($2::int * interval '1 second')
       order by update_time asc
       limit $1`,
      [limit, olderThanSeconds],
    );
    return result.rows.map((row) => this.mapTeamGrabRow(row));
  }

  async updateTeamGrabStatus(
    requestId: string,
    status: TeamGrabRequestRecord['status'],
    allowedCurrentStatuses: TeamGrabRequestRecord['status'][],
  ): Promise<TeamGrabRequestRecord | null> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `update team_grab_request
       set status = $2, update_time = now()
       where request_id = $1
         and status = any($3::varchar[])
       returning *`,
      [requestId, status, allowedCurrentStatuses],
    );
    return result.rows[0] ? this.mapTeamGrabRow(result.rows[0]) : null;
  }

  async persistLockedSeats(
    requestId: string,
    input: { lockedSeatIds: number[]; seatLabels: string[]; matchedStrategy: TeamSeatStrategy },
  ): Promise<TeamGrabRequestRecord | null> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `update team_grab_request
       set locked_seat_ids = $2::jsonb,
           seat_labels = $3::jsonb,
           matched_strategy = $4,
           status = 'LOCKED',
           update_time = now()
       where request_id = $1
         and status in ('PENDING', 'GRABBING', 'LOCKED')
       returning *`,
      [requestId, JSON.stringify(input.lockedSeatIds), JSON.stringify(input.seatLabels), input.matchedStrategy],
    );
    return result.rows[0] ? this.mapTeamGrabRow(result.rows[0]) : null;
  }

  async markTeamGrabOrderCreated(requestId: string, orderId: number): Promise<TeamGrabRequestRecord | null> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `update team_grab_request
       set status = 'ORDER_CREATED',
           order_id = $2,
           fail_reason = null,
           update_time = now()
       where request_id = $1
         and status in ('LOCKED', 'GRABBING')
       returning *`,
      [requestId, orderId],
    );
    return result.rows[0] ? this.mapTeamGrabRow(result.rows[0]) : null;
  }

  async markTeamGrabFailed(requestId: string, failReason: string): Promise<TeamGrabRequestRecord | null> {
    const result = await this.database.query<TeamGrabRequestRow>(
      `update team_grab_request
       set status = 'FAILED',
           fail_reason = $2,
           update_time = now()
       where request_id = $1
         and status <> 'ORDER_CREATED'
       returning *`,
      [requestId, failReason],
    );
    return result.rows[0] ? this.mapTeamGrabRow(result.rows[0]) : null;
  }

  async insertSeatAssignments(
    teamId: number,
    orderId: number,
    assignments: TeamSeatAssignmentInput[],
  ): Promise<void> {
    await this.database.withTransaction(async (client) => {
      for (const assignment of assignments) {
        await client.query(
          `insert into team_seat_assignment (
             team_id, user_id, order_id, order_seat_id, session_seat_id, seat_label
           ) values ($1, $2, $3, $4, $5, $6)
           on conflict do nothing`,
          [
            teamId,
            assignment.userId,
            orderId,
            assignment.orderSeatId,
            assignment.sessionSeatId,
            assignment.seatLabel,
          ],
        );
        await client.query(
          `update ticket_team_member
           set order_seat_id = $3,
               seat_id = $4,
               update_time = now()
           where team_id = $1
             and user_id = $2
             and status = 'CONFIRMED'`,
          [teamId, assignment.userId, assignment.orderSeatId, assignment.sessionSeatId],
        );
      }
    });
  }

  async assignPaidTeamSeats(
    teamId: number,
    orderId: number,
    assignments: TeamSeatAssignmentInput[],
  ): Promise<boolean> {
    return this.database.withTransaction(async (client) => {
      const lockedTeam = await client.query<{ id: string | number }>(
        `select id
         from ticket_team
         where id = $1
           and status = 'LOCKED'
         for update`,
        [teamId],
      );
      if (!lockedTeam.rows[0]) return false;

      for (const assignment of assignments) {
        const existingByOrderSeat = await client.query<TeamSeatAssignmentRow>(
          `select team_id, user_id, order_id, order_seat_id, session_seat_id, seat_label
           from team_seat_assignment
           where order_seat_id = $1
           for update`,
          [assignment.orderSeatId],
        );
        if (
          existingByOrderSeat.rows[0]
          && !this.isSameSeatAssignment(existingByOrderSeat.rows[0], teamId, assignment.userId, orderId, assignment)
        ) {
          throw new Error('team seat assignment conflict');
        }

        const assignmentResult = await client.query<TeamSeatAssignmentRow>(
          `insert into team_seat_assignment (
             team_id, user_id, order_id, order_seat_id, session_seat_id, seat_label
            ) values ($1, $2, $3, $4, $5, $6)
            on conflict (team_id, user_id) do update
           set order_id = excluded.order_id,
               order_seat_id = excluded.order_seat_id,
               session_seat_id = excluded.session_seat_id,
               seat_label = excluded.seat_label
           where team_seat_assignment.order_id = excluded.order_id
             and team_seat_assignment.order_seat_id = excluded.order_seat_id
             and team_seat_assignment.session_seat_id = excluded.session_seat_id
             and team_seat_assignment.seat_label is not distinct from excluded.seat_label
           returning team_id, user_id, order_id, order_seat_id, session_seat_id, seat_label`,
          [
            teamId,
            assignment.userId,
            orderId,
            assignment.orderSeatId,
            assignment.sessionSeatId,
            assignment.seatLabel,
          ],
        );
        if (
          !assignmentResult.rows[0]
          || !this.isSameSeatAssignment(assignmentResult.rows[0], teamId, assignment.userId, orderId, assignment)
        ) {
          throw new Error('team seat assignment conflict');
        }

        const memberResult = await client.query<TicketTeamMemberRow>(
          `update ticket_team_member
           set order_seat_id = $3,
               seat_id = $4,
               update_time = now()
           where team_id = $1
             and user_id = $2
             and status = 'CONFIRMED'
           returning *`,
          [teamId, assignment.userId, assignment.orderSeatId, assignment.sessionSeatId],
        );
        if (!memberResult.rows[0]) {
          throw new Error('team member not found for paid seat assignment');
        }
      }

      const paid = await client.query<TicketTeamRow>(
        `update ticket_team
         set status = 'PAID',
             update_time = now()
         where id = $1
           and status = 'LOCKED'
         returning *`,
        [teamId],
      );
      return paid.rows.length > 0;
    });
  }

  async markTeamPaid(teamId: number): Promise<TicketTeamRecord | null> {
    const result = await this.database.query<TicketTeamRow>(
      `update ticket_team
       set status = 'PAID',
           update_time = now()
       where id = $1
         and status = 'LOCKED'
       returning *`,
      [teamId],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  async markTeamExpired(teamId: number, reason: string): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await client.query(
        `update team_grab_request
         set status = 'EXPIRED',
             fail_reason = $2,
             update_time = now()
         where team_id = $1
           and order_id is not null
           and status in ('ORDER_CREATED', 'LOCKED')`,
        [teamId, reason],
      );
      await client.query(
        `update ticket_team
         set status = 'EXPIRED',
             update_time = now()
         where id = $1
           and status = 'LOCKED'`,
        [teamId],
      );
    });
  }

  async markTeamFailed(teamId: number, requestId: string, reason: string): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await client.query(
        `update team_grab_request
         set status = 'FAILED',
             fail_reason = $2,
             update_time = now()
         where request_id = $1
           and status <> 'ORDER_CREATED'`,
        [requestId, reason],
      );
      await client.query(
        `update ticket_team
         set status = 'FAILED',
             update_time = now()
         where id = $1
           and status in ('GRABBING', 'LOCKED', 'READY')`,
        [teamId],
      );
    });
  }

  async refreshTeamSize(teamId: number): Promise<TicketTeamRecord | null> {
    return this.refreshTeamSizeWithClient(this.database, teamId);
  }

  private async refreshTeamSizeWithClient(
    client: DatabaseQueryClient,
    teamId: number,
  ): Promise<TicketTeamRecord | null> {
    const result = await client.query<TicketTeamRow>(
      `update ticket_team
       set size = (
         select count(*)::int
         from ticket_team_member m
         where m.team_id = $1 and m.status = 'CONFIRMED'
       ),
       update_time = now()
       where id = $1
       returning *`,
      [teamId],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  async refreshTeamReadiness(teamId: number): Promise<TicketTeamRecord | null> {
    const result = await this.database.query<TicketTeamRow>(
      `with team_row as (
         select t.id, t.leader_user_id
         from ticket_team t
         where t.id = $1
       ),
       confirmed_members as (
         select count(*)::int as count
         from ticket_team_member m
         where m.team_id = $1 and m.status = 'CONFIRMED'
       ),
       leader_member as (
         select exists (
           select 1
           from ticket_team_member m
           join team_row t on t.id = m.team_id
           where m.team_id = $1
             and m.user_id = t.leader_user_id
             and m.role = 'LEADER'
             and m.status = 'CONFIRMED'
         ) as confirmed
       )
       update ticket_team t
       set size = confirmed_members.count,
           status = case
             when t.status in ('DRAFT', 'FAILED', 'EXPIRED', 'READY')
               and t.strategy <> 'FALLBACK'
               and leader_member.confirmed
               and confirmed_members.count between 2 and 6
               then 'READY'
             when t.status = 'READY'
               then 'DRAFT'
             else t.status
           end,
           update_time = now()
       from confirmed_members, leader_member
       where t.id = $1
       returning t.*`,
      [teamId],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  private mapTeamRow(row: TicketTeamRow): TicketTeamRecord {
    return {
      id: Number(row.id),
      inviteCode: row.invite_code,
      leaderUserId: Number(row.leader_user_id),
      activityId: Number(row.activity_id),
      sessionId: Number(row.session_id),
      ticketTypeId: Number(row.ticket_type_id),
      size: row.size,
      strategy: row.strategy,
      fallbacks: this.parseFallbacks(row.fallback_strategy_json),
      status: row.status,
      createTime: row.create_time,
      updateTime: row.update_time,
    };
  }

  private mapMemberRow(row: TicketTeamMemberRow): TicketTeamMemberRecord {
    return {
      id: Number(row.id),
      teamId: Number(row.team_id),
      sessionId: Number(row.session_id),
      userId: Number(row.user_id),
      role: row.role,
      status: row.status,
      seatId: row.seat_id == null ? null : Number(row.seat_id),
      orderSeatId: row.order_seat_id == null ? null : Number(row.order_seat_id),
      joinTime: row.join_time,
    };
  }

  private mapTeamGrabRow(row: TeamGrabRequestRow): TeamGrabRequestRecord {
    return {
      id: Number(row.id),
      requestId: row.request_id,
      grabRequestId: row.grab_request_id ?? null,
      teamId: Number(row.team_id),
      triggerUserId: Number(row.trigger_user_id),
      payerUserId: Number(row.payer_user_id),
      sessionId: Number(row.session_id),
      ticketTypeId: Number(row.ticket_type_id),
      quantity: row.quantity,
      strategy: row.strategy,
      fallbacks: this.parseFallbacks(row.fallback_strategy_json),
      matchedStrategy: row.matched_strategy,
      status: row.status,
      orderId: row.order_id == null ? null : Number(row.order_id),
      lockedSeatIds: this.parseJsonArray<number>(row.locked_seat_ids),
      seatLabels: this.parseJsonArray<string>(row.seat_labels),
      failReason: row.fail_reason,
      createTime: row.create_time,
      updateTime: row.update_time,
    };
  }

  private isSameSeatAssignment(
    row: TeamSeatAssignmentRow,
    teamId: number,
    userId: number,
    orderId: number,
    assignment: TeamSeatAssignmentInput,
  ): boolean {
    return Number(row.team_id) === teamId
      && Number(row.user_id) === userId
      && Number(row.order_id) === orderId
      && Number(row.order_seat_id) === assignment.orderSeatId
      && Number(row.session_seat_id) === assignment.sessionSeatId
      && (row.seat_label ?? null) === (assignment.seatLabel ?? null);
  }

  private parseFallbacks(value: TeamSeatStrategy[] | string | null | undefined): TeamSeatStrategy[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is TeamSeatStrategy => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }
}
