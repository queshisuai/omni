import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export type AdmissionOutcome = 'ACCEPTED' | 'IDEMPOTENT' | 'SOLD_OUT' | 'LIMITED' | 'BYPASSED';

export interface AdmitInput {
  requestId: string;
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  idempotencyKey: string;
  ttlSeconds: number;
}

export interface AdmissionResult {
  outcome: AdmissionOutcome;
  existingRequestId: string | null;
}

@Injectable()
export class GrabAdmissionService {
  private readonly ADMISSION_SCRIPT = `
    -- keys use grab:stock, grab:idempotency, grab:user-hold and grab:seat-hold namespaces
    local stockKey = KEYS[1]
    local idempotencyKey = KEYS[2]
    local userHoldKey = KEYS[3]
    local requestId = ARGV[1]
    local quantity = tonumber(ARGV[5])
    local ttl = tonumber(ARGV[6])
    local seatCount = tonumber(ARGV[7])

    local existingRequestId = redis.call('get', idempotencyKey)
    if existingRequestId then
      return {'IDEMPOTENT', existingRequestId}
    end

    if redis.call('exists', userHoldKey) == 1 then
      return {'LIMITED', ''}
    end

    local stock = redis.call('get', stockKey)
    if not stock then
      redis.call('setex', idempotencyKey, ttl, requestId)
      redis.call('setex', userHoldKey, ttl, requestId)
      for i = 1, seatCount do
        local seatKey = KEYS[3 + i]
        redis.call('setex', seatKey, ttl, requestId)
      end
      return {'BYPASSED', requestId}
    end
    if tonumber(stock) < quantity then
      return {'SOLD_OUT', ''}
    end

    for i = 1, seatCount do
      local seatKey = KEYS[3 + i]
      if redis.call('exists', seatKey) == 1 then
        return {'LIMITED', ''}
      end
    end

    redis.call('decrby', stockKey, quantity)
    redis.call('setex', idempotencyKey, ttl, requestId)
    redis.call('setex', userHoldKey, ttl, requestId)

    for i = 1, seatCount do
      local seatKey = KEYS[3 + i]
      redis.call('setex', seatKey, ttl, requestId)
    end

    return {'ACCEPTED', requestId}
  `;

  constructor(private readonly redisService: RedisService) {}

  async admit(input: AdmitInput): Promise<AdmissionResult> {
    const keys = this.buildKeys(input);
    const raw = await this.redisService.eval(this.ADMISSION_SCRIPT, keys, [
      input.requestId,
      String(input.userId),
      String(input.sessionId),
      String(input.ticketTypeId),
      String(input.quantity),
      String(input.ttlSeconds),
      String(input.seatIds.length),
    ]);
    const [outcome, existingRequestId] = raw as [AdmissionOutcome, string];
    return { outcome, existingRequestId: existingRequestId || null };
  }

  async release(input: Pick<AdmitInput, 'userId' | 'sessionId' | 'ticketTypeId' | 'quantity' | 'seatIds' | 'idempotencyKey'> & { restoreStock?: boolean }): Promise<void> {
    if (input.restoreStock !== false) {
      await this.redisService.incrBy(this.stockKey(input.sessionId, input.ticketTypeId), input.quantity);
    }
    await this.redisService.del([
      this.idempotencyKey(input.userId, input.idempotencyKey),
      this.userHoldKey(input.userId, input.sessionId, input.ticketTypeId),
      ...input.seatIds.map((seatId) => this.seatHoldKey(seatId)),
    ]);
  }

  private buildKeys(input: AdmitInput): string[] {
    return [
      this.stockKey(input.sessionId, input.ticketTypeId),
      this.idempotencyKey(input.userId, input.idempotencyKey),
      this.userHoldKey(input.userId, input.sessionId, input.ticketTypeId),
      ...input.seatIds.map((seatId) => this.seatHoldKey(seatId)),
    ];
  }

  private stockKey(sessionId: number, ticketTypeId: number): string {
    return `grab:stock:${sessionId}:${ticketTypeId}`;
  }

  private idempotencyKey(userId: number, idempotencyKey: string): string {
    return `grab:idempotency:${userId}:${idempotencyKey}`;
  }

  private userHoldKey(userId: number, sessionId: number, ticketTypeId: number): string {
    return `grab:user-hold:${userId}:${sessionId}:${ticketTypeId}`;
  }

  private seatHoldKey(seatId: number): string {
    return `grab:seat-hold:${seatId}`;
  }
}
