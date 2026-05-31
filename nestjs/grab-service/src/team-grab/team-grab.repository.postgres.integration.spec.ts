import { Pool } from 'pg';
import { TeamGrabRepository } from './team-grab.repository';

const runIntegration = process.env.RUN_GRAB_POSTGRES_INTEGRATION === '1';
const describeIntegration = runIntegration ? describe : describe.skip;

type RowSnapshot = {
  grabStatus: string;
  grabProgressStatus: string;
  grabOrderId: string | null;
  teamGrabStatus: string;
  teamGrabOrderId: string | null;
  teamGrabFailReason: string | null;
  teamStatus: string | null;
};

class PgPoolDatabase {
  constructor(private readonly pool: Pool) {}

  query<T>(sql: string, params: unknown[] = []) {
    return this.pool.query<T>(sql, params);
  }

  async withTransaction<T>(callback: (client: { query: Pool['query'] }) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
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
}

describeIntegration('TeamGrabRepository Postgres integration', () => {
  const schema = `team_grab_it_${Date.now()}_${process.pid}`.toLowerCase();
  const poolConfig = {
    host: process.env.GRAB_POSTGRES_HOST ?? process.env.PGHOST ?? 'localhost',
    port: Number(process.env.GRAB_POSTGRES_PORT ?? process.env.PGPORT ?? 5432),
    database: process.env.GRAB_POSTGRES_DATABASE ?? process.env.PGDATABASE ?? 'postgres',
    user: process.env.GRAB_POSTGRES_USER ?? process.env.PGUSER ?? 'postgres',
    password: process.env.GRAB_POSTGRES_PASSWORD ?? process.env.PGPASSWORD ?? '123456',
  };

  let adminPool: Pool;
  let appPool: Pool;
  let repository: TeamGrabRepository;

  beforeAll(async () => {
    adminPool = new Pool(poolConfig);
    await adminPool.query(`create schema ${schema}`);

    appPool = new Pool({
      ...poolConfig,
      options: `-c search_path=${schema}`,
    });
    repository = new TeamGrabRepository(new PgPoolDatabase(appPool) as any);

    await appPool.query(`
      create table ticket_team (
        id bigserial primary key,
        invite_code varchar(32) not null,
        leader_user_id bigint not null,
        activity_id bigint not null,
        session_id bigint not null,
        ticket_type_id bigint not null,
        size integer not null default 1,
        strategy varchar(32) not null default 'STRICT_CONTIGUOUS',
        fallback_strategy_json jsonb not null default '[]'::jsonb,
        status varchar(32) not null default 'DRAFT',
        create_time timestamptz not null default now(),
        update_time timestamptz not null default now(),
        constraint uk_ticket_team_invite_code unique (invite_code),
        constraint chk_ticket_team_size check (size between 1 and 6),
        constraint chk_ticket_team_strategy check (strategy in ('STRICT_CONTIGUOUS', 'SAME_BLOCK', 'SAME_TICKET_TYPE', 'FALLBACK')),
        constraint chk_ticket_team_status check (status in ('DRAFT', 'READY', 'GRABBING', 'LOCKED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'))
      );

      create table grab_request (
        id bigserial primary key,
        request_id varchar(64) not null,
        idempotency_key varchar(128) not null,
        user_id bigint not null,
        session_id bigint not null,
        ticket_type_id bigint not null,
        quantity integer not null,
        seat_ids jsonb not null default '[]'::jsonb,
        allocate_random boolean not null default false,
        status varchar(32) not null,
        request_type varchar(32) not null default 'NORMAL_GRAB',
        queue_seq bigint,
        requested_ticket_types jsonb not null default '[]'::jsonb,
        allow_auto_downgrade boolean not null default false,
        current_ticket_type_id bigint,
        current_attempt_index integer not null default 0,
        matched_ticket_type_id bigint,
        progress_status varchar(32) not null default 'QUEUED',
        progress_message varchar(512),
        attempts_snapshot jsonb not null default '[]'::jsonb,
        order_id bigint,
        fail_reason varchar(512),
        worker_claimed_at timestamptz,
        worker_id varchar(128),
        processing_started_at timestamptz,
        completed_at timestamptz,
        expire_time timestamptz not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint uk_grab_request_request_id unique (request_id),
        constraint uk_grab_request_user_idempotency unique (user_id, idempotency_key),
        constraint chk_grab_request_quantity_positive check (quantity > 0),
        constraint chk_grab_request_status check (status in (
          'QUEUED',
          'WAITING',
          'TRYING_TICKET_TYPE',
          'LOCKING',
          'PENDING',
          'ACCEPTED',
          'ORDER_CREATING',
          'ORDER_CREATED',
          'SOLD_OUT',
          'DOWNGRADING',
          'PENDING_RECOVERY',
          'LIMITED',
          'FAILED',
          'EXPIRED'
        )),
        constraint chk_grab_request_progress_status check (progress_status in (
          'QUEUED',
          'WAITING',
          'TRYING_TICKET_TYPE',
          'LOCKING',
          'ORDER_CREATING',
          'ORDER_CREATED',
          'SOLD_OUT',
          'DOWNGRADING',
          'PENDING_RECOVERY',
          'LIMITED',
          'FAILED',
          'EXPIRED'
        ))
      );

      create table team_grab_request (
        id bigserial primary key,
        request_id varchar(64) not null,
        grab_request_id varchar(64) not null,
        team_id bigint not null references ticket_team(id),
        trigger_user_id bigint not null,
        payer_user_id bigint not null,
        session_id bigint not null,
        ticket_type_id bigint not null,
        quantity integer not null,
        strategy varchar(32) not null,
        fallback_strategy_json jsonb not null default '[]'::jsonb,
        matched_strategy varchar(32),
        status varchar(32) not null default 'PENDING',
        order_id bigint,
        locked_seat_ids jsonb not null default '[]'::jsonb,
        seat_labels jsonb not null default '[]'::jsonb,
        fail_reason varchar(512),
        create_time timestamptz not null default now(),
        update_time timestamptz not null default now(),
        constraint uk_team_grab_request_request_id unique (request_id),
        constraint uk_team_grab_request_grab_request_id unique (grab_request_id),
        constraint chk_team_grab_request_quantity check (quantity between 2 and 6),
        constraint chk_team_grab_request_status check (status in ('PENDING', 'GRABBING', 'LOCKED', 'ORDER_CREATED', 'FAILED', 'EXPIRED'))
      );

      create unique index uk_team_grab_request_active_team
        on team_grab_request(team_id)
        where status in ('PENDING', 'GRABBING', 'LOCKED', 'ORDER_CREATED');
    `);
  });

  beforeEach(async () => {
    await appPool.query('truncate table team_grab_request, grab_request, ticket_team restart identity');
  });

  afterAll(async () => {
    await appPool?.end();
    if (adminPool) {
      await adminPool.query(`drop schema if exists ${schema} cascade`);
      await adminPool.end();
    }
  });

  it('updates grab_request, team_grab_request, and ticket_team for a matching found-order recovery', async () => {
    await insertRecoverableRows({
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-1',
      teamId: 7,
    });

    const result = await repository.recoverFoundOrderAndLockTeam({
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-1',
      teamId: 7,
      orderId: 9001,
      ticketTypeId: 30,
    });

    expect(result).toMatchObject({
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-1',
      teamId: 7,
      status: 'ORDER_CREATED',
      orderId: 9001,
      strategy: 'STRICT_CONTIGUOUS',
      fallbacks: ['SAME_BLOCK'],
      failReason: null,
    });
    await expect(snapshotRows('GRAB-1', 'TEAM-GRAB-1', 7)).resolves.toEqual({
      grabStatus: 'ORDER_CREATED',
      grabProgressStatus: 'ORDER_CREATED',
      grabOrderId: '9001',
      teamGrabStatus: 'ORDER_CREATED',
      teamGrabOrderId: '9001',
      teamGrabFailReason: null,
      teamStatus: 'LOCKED',
    });
  });

  it('does not update unrelated rows when requestId and grabRequestId belong to different relationships', async () => {
    await insertRecoverableRows({
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-1',
      teamId: 7,
    });
    await insertRecoverableRows({
      requestId: 'TEAM-GRAB-2',
      grabRequestId: 'GRAB-2',
      teamId: 8,
    });

    const result = await repository.recoverFoundOrderAndLockTeam({
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-2',
      teamId: 7,
      orderId: 9001,
      ticketTypeId: 30,
    });

    expect(result).toBeNull();
    await expect(snapshotRows('GRAB-1', 'TEAM-GRAB-1', 7)).resolves.toEqual({
      grabStatus: 'ORDER_CREATING',
      grabProgressStatus: 'ORDER_CREATING',
      grabOrderId: null,
      teamGrabStatus: 'GRABBING',
      teamGrabOrderId: null,
      teamGrabFailReason: 'ORDER_CREATE_IN_PROGRESS',
      teamStatus: 'GRABBING',
    });
    await expect(snapshotRows('GRAB-2', 'TEAM-GRAB-2', 8)).resolves.toEqual({
      grabStatus: 'ORDER_CREATING',
      grabProgressStatus: 'ORDER_CREATING',
      grabOrderId: null,
      teamGrabStatus: 'GRABBING',
      teamGrabOrderId: null,
      teamGrabFailReason: 'ORDER_CREATE_IN_PROGRESS',
      teamStatus: 'GRABBING',
    });
  });

  it('rolls back grab and team_grab updates when the team row cannot be locked', async () => {
    await insertRecoverableRows({
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-1',
      teamId: 7,
      teamStatus: 'FAILED',
    });

    await expect(repository.recoverFoundOrderAndLockTeam({
      requestId: 'TEAM-GRAB-1',
      grabRequestId: 'GRAB-1',
      teamId: 7,
      orderId: 9001,
      ticketTypeId: 30,
    })).rejects.toThrow('小队锁定状态更新失败');

    await expect(snapshotRows('GRAB-1', 'TEAM-GRAB-1', 7)).resolves.toEqual({
      grabStatus: 'ORDER_CREATING',
      grabProgressStatus: 'ORDER_CREATING',
      grabOrderId: null,
      teamGrabStatus: 'GRABBING',
      teamGrabOrderId: null,
      teamGrabFailReason: 'ORDER_CREATE_IN_PROGRESS',
      teamStatus: 'FAILED',
    });
  });

  async function insertRecoverableRows(input: {
    requestId: string;
    grabRequestId: string;
    teamId: number;
    teamStatus?: string;
  }): Promise<void> {
    await appPool.query(
      `insert into ticket_team (
         id, invite_code, leader_user_id, activity_id, session_id, ticket_type_id,
         size, strategy, fallback_strategy_json, status
       ) values ($1, $2, 100, 20, 10, 30, 2, 'STRICT_CONTIGUOUS', '["SAME_BLOCK"]'::jsonb, $3)`,
      [input.teamId, `INV-${input.teamId}`, input.teamStatus ?? 'GRABBING'],
    );
    await appPool.query(
      `insert into grab_request (
         request_id, idempotency_key, user_id, session_id, ticket_type_id, quantity,
         seat_ids, allocate_random, status, request_type, queue_seq, requested_ticket_types,
         allow_auto_downgrade, current_attempt_index, progress_status, progress_message, expire_time
       ) values (
         $1, $2, 100, 10, 30, 2,
         '[]'::jsonb, false, 'ORDER_CREATING', 'TEAM_GRAB', 1, '[30]'::jsonb,
         false, 0, 'ORDER_CREATING', '', now() + interval '15 minutes'
       )`,
      [input.grabRequestId, `idem-${input.grabRequestId}`],
    );
    await appPool.query(
      `insert into team_grab_request (
         request_id, grab_request_id, team_id, trigger_user_id, payer_user_id,
         session_id, ticket_type_id, quantity, strategy, fallback_strategy_json, status, fail_reason
       ) values ($1, $2, $3, 100, 100, 10, 30, 2, 'STRICT_CONTIGUOUS', '["SAME_BLOCK"]'::jsonb, 'GRABBING', 'ORDER_CREATE_IN_PROGRESS')`,
      [input.requestId, input.grabRequestId, input.teamId],
    );
  }

  async function snapshotRows(grabRequestId: string, requestId: string, teamId: number): Promise<RowSnapshot> {
    const result = await appPool.query<{
      grab_status: string;
      grab_progress_status: string;
      grab_order_id: string | null;
      team_grab_status: string;
      team_grab_order_id: string | null;
      team_grab_fail_reason: string | null;
      team_status: string | null;
    }>(
      `select
         g.status as grab_status,
         g.progress_status as grab_progress_status,
         g.order_id::text as grab_order_id,
         r.status as team_grab_status,
         r.order_id::text as team_grab_order_id,
         r.fail_reason as team_grab_fail_reason,
         t.status as team_status
       from grab_request g
       join team_grab_request r on r.request_id = $2
       left join ticket_team t on t.id = $3
       where g.request_id = $1`,
      [grabRequestId, requestId, teamId],
    );
    const row = result.rows[0];
    return {
      grabStatus: row.grab_status,
      grabProgressStatus: row.grab_progress_status,
      grabOrderId: row.grab_order_id,
      teamGrabStatus: row.team_grab_status,
      teamGrabOrderId: row.team_grab_order_id,
      teamGrabFailReason: row.team_grab_fail_reason,
      teamStatus: row.team_status,
    };
  }
});
