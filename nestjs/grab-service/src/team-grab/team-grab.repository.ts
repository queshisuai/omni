import { Injectable } from '@nestjs/common';
import type { QueryResult } from 'pg';
import { DatabaseService } from '../database/database.service';
import type {
  CreateTeamInput,
  TeamMemberRole,
  TeamMemberStatus,
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

interface TransactionClient {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

interface TransactionPool {
  connect(): Promise<TransactionClient>;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

@Injectable()
export class TeamGrabRepository {
  constructor(private readonly database: DatabaseService) {}

  async createTeam(input: CreateTeamInput): Promise<TicketTeamRecord> {
    return this.withTransaction(async (client) => {
      const team = await this.insertTeam(client, input);
      await this.insertLeaderMemberWithClient(client, team.id, team.sessionId, input.leaderUserId);
      return (await this.refreshTeamSizeWithClient(client, team.id)) ?? team;
    });
  }

  private async insertTeam(client: Pick<DatabaseService, 'query'>, input: CreateTeamInput): Promise<TicketTeamRecord> {
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
    client: Pick<DatabaseService, 'query'>,
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
         from ticket_team_member m
         where m.team_id = $1 and m.status in ('JOINED', 'CONFIRMED')
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
         from ticket_team_member m
         where m.team_id = $1 and m.status in ('JOINED', 'CONFIRMED')
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
      `update ticket_team_member
       set status = 'LEFT', update_time = now()
       where team_id = $1
         and user_id = $2
         and status in ('JOINED', 'CONFIRMED')
         and exists (
           select 1 from ticket_team t
           where t.id = $1 and t.status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')
         )
       returning *`,
      [teamId, userId],
    );
    return result.rows[0] ? this.mapMemberRow(result.rows[0]) : null;
  }

  async removeMember(teamId: number, userId: number): Promise<TicketTeamMemberRecord | null> {
    const result = await this.database.query<TicketTeamMemberRow>(
      `update ticket_team_member
       set status = 'LEFT', update_time = now()
       where team_id = $1
         and user_id = $2
         and role = 'MEMBER'
         and status in ('INVITED', 'JOINED', 'CONFIRMED')
         and exists (
           select 1 from ticket_team t
           where t.id = $1 and t.status in ('DRAFT', 'READY', 'FAILED', 'EXPIRED')
         )
       returning *`,
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

  async refreshTeamSize(teamId: number): Promise<TicketTeamRecord | null> {
    return this.refreshTeamSizeWithClient(this.database, teamId);
  }

  private async refreshTeamSizeWithClient(
    client: Pick<DatabaseService, 'query'>,
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
      `with confirmed_members as (
         select count(*)::int as count
         from ticket_team_member m
         where m.team_id = $1 and m.status = 'CONFIRMED'
       )
       update ticket_team t
       set size = confirmed_members.count,
           status = case
             when t.status in ('DRAFT', 'FAILED', 'EXPIRED', 'READY')
               and t.strategy <> 'FALLBACK'
               and confirmed_members.count between 2 and 6
               then 'READY'
             when t.status = 'READY'
               then 'DRAFT'
             else t.status
           end,
           update_time = now()
       from confirmed_members
       where t.id = $1
       returning t.*`,
      [teamId],
    );
    return result.rows[0] ? this.mapTeamRow(result.rows[0]) : null;
  }

  private async withTransaction<T>(callback: (client: Pick<DatabaseService, 'query'>) => Promise<T>): Promise<T> {
    const pool = (this.database as unknown as { pool?: TransactionPool }).pool;
    if (!pool) throw new Error('database transaction pool is unavailable');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
}
