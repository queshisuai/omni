import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export type AdmissionOutcome = 'ACCEPTED' | 'IDEMPOTENT' | 'SOLD_OUT' | 'LIMITED' | 'STOCK_UNINITIALIZED';

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

export type ReleaseInput = Pick<AdmitInput, 'userId' | 'sessionId' | 'ticketTypeId' | 'quantity' | 'seatIds' | 'idempotencyKey'> & {
  requestId?: string;
  restoreStock?: boolean;
};

@Injectable()
export class GrabAdmissionService {
  private readonly markerCleanupTtlSeconds = 86_400;
  private readonly ADMISSION_SCRIPT = `
    -- keys use grab:stock, grab:idempotency, grab:user-hold, grab:admission and grab:seat-hold namespaces
    local stockKey = KEYS[1]
    local idempotencyKey = KEYS[2]
    local userHoldKey = KEYS[3]
    local markerKey = KEYS[4]
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
      return {'STOCK_UNINITIALIZED', ''}
    end
    if tonumber(stock) < quantity then
      return {'SOLD_OUT', ''}
    end

    for i = 1, seatCount do
      local seatKey = KEYS[4 + i]
      if redis.call('exists', seatKey) == 1 then
        return {'LIMITED', ''}
      end
    end

    redis.call('decrby', stockKey, quantity)
    redis.call('HSET', markerKey,
      'requestId', requestId,
      'sessionId', ARGV[3],
      'ticketTypeId', ARGV[4],
      'quantity', tostring(quantity),
      'restored', '0'
    )
    redis.call('setex', idempotencyKey, ttl, requestId)
    redis.call('setex', userHoldKey, ttl, requestId)

    for i = 1, seatCount do
      local seatKey = KEYS[4 + i]
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

  async release(input: ReleaseInput): Promise<void> {
    const script = `
      local requestId = ARGV[1]
      local quantity = tonumber(ARGV[2])
      local restoreStock = ARGV[3]
      local markerCleanupTtl = tonumber(ARGV[4])
      local markerKey = KEYS[4]

      local function deleteIfMine(key)
        if requestId == '' then
          redis.call('DEL', key)
          return
        end
        if redis.call('GET', key) == requestId then
          redis.call('DEL', key)
        end
      end

      if restoreStock ~= 'false' then
        local markerRequestId = redis.call('HGET', markerKey, 'requestId')
        if requestId ~= '' and markerRequestId == requestId then
          local restored = redis.call('HGET', markerKey, 'restored')
          if restored ~= '1' then
            local markerQuantity = tonumber(redis.call('HGET', markerKey, 'quantity') or ARGV[2])
            redis.call('INCRBY', KEYS[1], markerQuantity)
            redis.call('HSET', markerKey, 'restored', '1')
            redis.call('EXPIRE', markerKey, markerCleanupTtl)
          end
        elseif requestId == '' then
          redis.call('INCRBY', KEYS[1], quantity)
        else
          local idempotentHolder = redis.call('GET', KEYS[2])
          if idempotentHolder == requestId then
            redis.call('INCRBY', KEYS[1], quantity)
          end
        end
      elseif requestId ~= '' and redis.call('HGET', markerKey, 'requestId') == requestId then
        redis.call('HSET', markerKey, 'restored', '1')
        redis.call('EXPIRE', markerKey, markerCleanupTtl)
      end

      deleteIfMine(KEYS[2])
      deleteIfMine(KEYS[3])

      for i = 5, #KEYS do
        deleteIfMine(KEYS[i])
      end

      return 1
    `;

    await this.redisService.eval(script, this.buildKeys(input), [
      input.requestId ?? '',
      String(input.quantity),
      input.restoreStock === false ? 'false' : 'true',
      String(this.markerCleanupTtlSeconds),
    ]);
  }

  private buildKeys(input: Pick<AdmitInput, 'userId' | 'sessionId' | 'ticketTypeId' | 'seatIds' | 'idempotencyKey'> & { requestId?: string }): string[] {
    return [
      this.stockKey(input.sessionId, input.ticketTypeId),
      this.idempotencyKey(input.userId, input.idempotencyKey),
      this.userHoldKey(input.userId, input.sessionId, input.ticketTypeId),
      this.admissionKey(input.requestId ?? ''),
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

  private admissionKey(requestId: string): string {
    return `grab:admission:${requestId}`;
  }

  private seatHoldKey(seatId: number): string {
    return `grab:seat-hold:${seatId}`;
  }
}
