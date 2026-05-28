import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GRAB_STATUS, GrabStatus } from './grab-status';
import type { CreatePendingGrabRequestInput, GrabRequestRecord } from './grab.types';

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
  order_id: string | number | null;
  fail_reason: string | null;
  expire_time: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class GrabRepository {
  constructor(private readonly database: DatabaseService) {}

  async createPending(input: CreatePendingGrabRequestInput): Promise<GrabRequestRecord> {
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
        JSON.stringify(input.seatIds),
        input.allocateRandom,
        GRAB_STATUS.PENDING,
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

  async markOrderCreated(requestId: string, orderId: number): Promise<GrabRequestRecord> {
    const result = await this.database.query<GrabRequestRow>(
      `update grab_request
       set status = $2, order_id = $3, fail_reason = null, updated_at = now()
       where request_id = $1
       returning *`,
      [requestId, GRAB_STATUS.ORDER_CREATED, orderId],
    );
    return this.mapRow(result.rows[0]);
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
    const seatIds = Array.isArray(row.seat_ids) ? row.seat_ids : JSON.parse(row.seat_ids || '[]');
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
      orderId: row.order_id == null ? null : Number(row.order_id),
      failReason: row.fail_reason,
      expireTime: row.expire_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
