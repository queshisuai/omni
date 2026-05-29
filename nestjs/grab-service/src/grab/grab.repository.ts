import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GRAB_STATUS, GrabStatus } from './grab-status';
import type {
  CreateQueuedGrabRequestInput,
  CreatePendingGrabRequestInput,
  FindActiveGrabIntentInput,
  GrabAttemptSnapshot,
  GrabRequestRecord,
  GrabTicketPreference,
} from './grab.types';

interface GrabRequestRow {
  id: string | number;
  request_id: string;
  idempotency_key: string;
  user_id: string | number;
  session_id: string | number;
  ticket_type_id: string | number;
  quantity: number;
  seat_ids: number[] | string;
  allocate_random: boolean;
  status: GrabStatus;
  progress_status?: GrabStatus | null;
  progress_message?: string | null;
  order_id: string | number | null;
  fail_reason: string | null;
  request_type?: 'NORMAL_GRAB' | 'TEAM_GRAB' | 'WAITLIST_OFFER' | null;
  queue_seq?: string | number | null;
  requested_ticket_types?: GrabTicketPreference[] | string | null;
  allow_auto_downgrade?: boolean | null;
  current_ticket_type_id?: string | number | null;
  current_attempt_index?: number | null;
  matched_ticket_type_id?: string | number | null;
  attempts_snapshot?: GrabAttemptSnapshot[] | string | null;
  worker_id?: string | null;
  worker_claimed_at?: Date | null;
  processing_started_at?: Date | null;
  completed_at?: Date | null;
  expire_time: Date;
  created_at: Date;
  updated_at: Date;
}

interface UpdateGrabProgressInput {
  status: GrabStatus;
  message: string | null;
  currentTicketTypeId: number | null;
  currentAttemptIndex: number;
  attempts: GrabAttemptSnapshot[];
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

@Injectable()
export class GrabRepository {
  constructor(private readonly database: DatabaseService) {}

  async createPending(input: CreatePendingGrabRequestInput): Promise<GrabRequestRecord> {
    const normalizedSeatIds = [...input.seatIds].sort((a, b) => a - b);
    const result = await this.database.query<GrabRequestRow>(
      `insert into grab_request (
        request_id, idempotency_key, user_id, session_id, ticket_type_id,
        quantity, seat_ids, allocate_random, status, expire_time
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
      returning *`,
      [
        input.requestId,
        input.idempotencyKey,
        input.userId,
        input.sessionId,
        input.ticketTypeId,
        input.quantity,
        JSON.stringify(normalizedSeatIds),
        input.allocateRandom,
        GRAB_STATUS.PENDING,
        input.expireTime,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async createQueued(input: CreateQueuedGrabRequestInput): Promise<GrabRequestRecord> {
    const normalizedSeatIds = [...input.seatIds].sort((a, b) => a - b);
    const progressMessage = `你前面还有 ${Math.max(input.queueSeq - 1, 0)} 人`;
    const attempts = input.requestedTicketTypes.map((preference) => ({
      ticketTypeId: preference.ticketTypeId,
      name: preference.name,
      status: 'PENDING' as const,
      message: '待尝试',
    }));
    const result = await this.database.query<GrabRequestRow>(
      `insert into grab_request (
        request_id, idempotency_key, user_id, session_id, ticket_type_id,
        quantity, seat_ids, allocate_random, status, progress_status,
        progress_message, request_type, queue_seq, requested_ticket_types,
        allow_auto_downgrade, current_ticket_type_id, current_attempt_index,
        attempts_snapshot, expire_time
      ) values (
        $1, $2, $3, $4, $5,
        $6, $7::jsonb, $8, $9, $10,
        $11, $12, $13, $14::jsonb,
        $15, $16, $17,
        $18::jsonb, $19
      )
      returning *`,
      [
        input.requestId,
        input.idempotencyKey,
        input.userId,
        input.sessionId,
        input.ticketTypeId,
        input.quantity,
        JSON.stringify(normalizedSeatIds),
        input.allocateRandom,
        GRAB_STATUS.QUEUED,
        GRAB_STATUS.QUEUED,
        progressMessage,
        'NORMAL_GRAB',
        input.queueSeq,
        JSON.stringify(input.requestedTicketTypes),
        input.allowAutoDowngrade,
        input.ticketTypeId,
        0,
        JSON.stringify(attempts),
        input.expireTime,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserAndIdempotency(userId: number, idempotencyKey: string): Promise<GrabRequestRecord | null> {
    const result = await this.database.query<GrabRequestRow>(
      `select * from grab_request where user_id = $1 and idempotency_key = $2 limit 1`,
      [userId, idempotencyKey],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByRequestId(requestId: string): Promise<GrabRequestRecord | null> {
    const result = await this.database.query<GrabRequestRow>(
      `select * from grab_request where request_id = $1 limit 1`,
      [requestId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateStatus(requestId: string, status: GrabStatus, failReason: string | null = null): Promise<GrabRequestRecord> {
    const result = await this.database.query<GrabRequestRow>(
      `update grab_request
       set status = $2, fail_reason = $3, updated_at = now()
       where request_id = $1
       returning *`,
      [requestId, status, failReason],
    );
    return this.mapRow(result.rows[0]);
  }

  async updateProgress(requestId: string, input: UpdateGrabProgressInput): Promise<GrabRequestRecord> {
    const result = await this.database.query<GrabRequestRow>(
      `update grab_request
       set progress_status = $2,
           status = $2,
           progress_message = $3,
           current_ticket_type_id = $4,
           current_attempt_index = $5,
           attempts_snapshot = $6::jsonb,
           updated_at = now()
       where request_id = $1
       returning *`,
      [
        requestId,
        input.status,
        input.message,
        input.currentTicketTypeId,
        input.currentAttemptIndex,
        JSON.stringify(input.attempts),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async claimForProcessing(requestId: string, workerId: string): Promise<GrabRequestRecord | null> {
    const result = await this.database.query<GrabRequestRow>(
      `update grab_request
       set worker_id = $2,
           worker_claimed_at = now(),
           processing_started_at = now(),
           progress_status = $7,
           status = $7,
           updated_at = now()
       where request_id = $1
         and status in ($3, $4)
         and progress_status in ($5, $6)
       returning *`,
      [
        requestId,
        workerId,
        GRAB_STATUS.QUEUED,
        GRAB_STATUS.WAITING,
        GRAB_STATUS.QUEUED,
        GRAB_STATUS.WAITING,
        GRAB_STATUS.WAITING,
      ],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markOrderCreated(
    requestId: string,
    orderId: number,
    matchedTicketTypeId: number | null = null,
    attempts: GrabAttemptSnapshot[] = [],
  ): Promise<GrabRequestRecord> {
    const result = await this.database.query<GrabRequestRow>(
      `update grab_request
       set status = $2,
           progress_status = $2,
           order_id = $3,
           matched_ticket_type_id = $4,
           attempts_snapshot = $5::jsonb,
           completed_at = now(),
           fail_reason = null,
           updated_at = now()
       where request_id = $1
       returning *`,
      [requestId, GRAB_STATUS.ORDER_CREATED, orderId, matchedTicketTypeId, JSON.stringify(attempts)],
    );
    return this.mapRow(result.rows[0]);
  }

  async findActiveByIntent(input: FindActiveGrabIntentInput): Promise<GrabRequestRecord | null> {
    const normalizedSeatIds = [...input.seatIds].sort((a, b) => a - b);
    const activeStatuses = [GRAB_STATUS.PENDING, GRAB_STATUS.ACCEPTED, GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.ORDER_CREATED];
    const result = await this.database.query<GrabRequestRow>(
      `select * from grab_request
       where user_id = $1
         and session_id = $2
         and ticket_type_id = $3
         and quantity = $4
         and seat_ids = $5::jsonb
         and allocate_random = $6
         and status = any($7::varchar[])
       order by created_at asc
       limit 1`,
      [
        input.userId,
        input.sessionId,
        input.ticketTypeId,
        input.quantity,
        JSON.stringify(normalizedSeatIds),
        input.allocateRandom,
        activeStatuses,
      ],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findExpiredInFlight(now: Date, limit: number): Promise<GrabRequestRecord[]> {
    const result = await this.database.query<GrabRequestRow>(
      `select * from grab_request
       where status in ($1, $2)
         and expire_time < $3
       order by expire_time asc
       limit $4`,
      [GRAB_STATUS.ACCEPTED, GRAB_STATUS.ORDER_CREATING, now, limit],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: GrabRequestRow): GrabRequestRecord {
    const seatIds = this.parseJsonArray<number>(row.seat_ids);
    return {
      id: Number(row.id),
      requestId: row.request_id,
      idempotencyKey: row.idempotency_key,
      userId: Number(row.user_id),
      sessionId: Number(row.session_id),
      ticketTypeId: Number(row.ticket_type_id),
      quantity: row.quantity,
      seatIds,
      allocateRandom: row.allocate_random,
      status: row.status,
      progressStatus: row.progress_status ?? row.status,
      progressMessage: row.progress_message ?? null,
      orderId: row.order_id == null ? null : Number(row.order_id),
      failReason: row.fail_reason,
      requestType: row.request_type ?? 'NORMAL_GRAB',
      queueSeq: row.queue_seq == null ? null : Number(row.queue_seq),
      requestedTicketTypes: this.parseJsonArray<GrabTicketPreference>(row.requested_ticket_types),
      allowAutoDowngrade: row.allow_auto_downgrade ?? false,
      currentTicketTypeId: row.current_ticket_type_id == null ? null : Number(row.current_ticket_type_id),
      currentAttemptIndex: row.current_attempt_index ?? 0,
      matchedTicketTypeId: row.matched_ticket_type_id == null ? null : Number(row.matched_ticket_type_id),
      attemptsSnapshot: this.parseJsonArray<GrabAttemptSnapshot>(row.attempts_snapshot),
      workerId: row.worker_id ?? null,
      workerClaimedAt: row.worker_claimed_at ?? null,
      processingStartedAt: row.processing_started_at ?? null,
      completedAt: row.completed_at ?? null,
      expireTime: row.expire_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return JSON.parse(value) as T[];
    return [];
  }
}
