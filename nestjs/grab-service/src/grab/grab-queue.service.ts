import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface EnqueueRequest {
  requestId: string;
  sessionId: number;
  userId: number;
}

export interface EnqueueResult {
  queueSeq: number;
  queueRank: number;
}

@Injectable()
export class GrabQueueService {
  constructor(private readonly redis: RedisService) {}

  async enqueue(request: EnqueueRequest): Promise<EnqueueResult> {
    const sessionId = String(request.sessionId);
    const script = `
      local queueSeq = redis.call('INCR', KEYS[1])
      redis.call('HSET', KEYS[2],
        'requestId', ARGV[1],
        'sessionId', ARGV[2],
        'userId', ARGV[3],
        'queueSeq', tostring(queueSeq),
        'status', ARGV[4]
      )
      redis.call('RPUSH', KEYS[3], ARGV[1])
      redis.call('SADD', KEYS[4], ARGV[2])
      return queueSeq
    `;
    const queueSeq = Number(
      await this.redis.eval(
        script,
        [this.queueSeqKey(request.sessionId), this.requestKey(request.requestId), this.queueKey(request.sessionId), this.activeSessionsKey()],
        [request.requestId, sessionId, String(request.userId), 'QUEUED'],
      ),
    );

    const queueRank = await this.calculateQueueRank(request.sessionId, queueSeq);
    return { queueSeq, queueRank };
  }

  async calculateQueueRank(sessionId: number, queueSeq: number): Promise<number> {
    const processed = await this.redis.get(this.processedSeqKey(sessionId));
    const processedSeq = processed ? Number(processed) : 0;

    return Math.max(queueSeq - processedSeq - 1, 0);
  }

  async markProcessed(sessionId: number, queueSeq: number): Promise<void> {
    const script = `
      local currentSeq = tonumber(redis.call('GET', KEYS[1]) or '0') or 0
      local newSeq = tonumber(ARGV[1])
      if newSeq > currentSeq then
        redis.call('SET', KEYS[1], ARGV[1])
        return 1
      end
      return 0
    `;

    await this.redis.eval(script, [this.processedSeqKey(sessionId)], [String(queueSeq)]);
  }

  async dequeue(sessionId: number): Promise<string | null> {
    const script = `
      local requestId = redis.call('LPOP', KEYS[1])
      if requestId then
        redis.call('RPUSH', KEYS[2], requestId)
      end
      return requestId
    `;

    return this.redis.eval(script, [this.queueKey(sessionId), this.inflightQueueKey(sessionId)], []);
  }

  async ackProcessed(sessionId: number, requestId: string, queueSeq: number): Promise<void> {
    const script = `
      redis.call('LREM', KEYS[1], 1, ARGV[1])
      local currentSeq = tonumber(redis.call('GET', KEYS[2]) or '0') or 0
      local newSeq = tonumber(ARGV[2])
      if newSeq > currentSeq then
        redis.call('SET', KEYS[2], ARGV[2])
        return 1
      end
      return 0
    `;

    await this.redis.eval(script, [this.inflightQueueKey(sessionId), this.processedSeqKey(sessionId)], [requestId, String(queueSeq)]);
  }

  async requeueInflight(sessionId: number, requestId: string): Promise<void> {
    const script = `
      local removed = redis.call('LREM', KEYS[1], 1, ARGV[1])
      if removed > 0 then
        redis.call('LPUSH', KEYS[2], ARGV[1])
        redis.call('SADD', KEYS[3], ARGV[2])
        return 1
      end
      return 0
    `;

    await this.redis.eval(script, [this.inflightQueueKey(sessionId), this.queueKey(sessionId), this.activeSessionsKey()], [requestId, String(sessionId)]);
  }

  async getActiveSessions(): Promise<number[]> {
    const sessions = await this.redis.smembers(this.activeSessionsKey());

    return sessions.map((sessionId) => Number(sessionId)).filter((sessionId) => !Number.isNaN(sessionId));
  }

  async removeActiveSession(sessionId: number): Promise<void> {
    await this.removeActiveSessionIfQueueEmpty(sessionId);
  }

  async removeActiveSessionIfQueueEmpty(sessionId: number): Promise<void> {
    const script = `
      if redis.call('LLEN', KEYS[1]) == 0 and redis.call('LLEN', KEYS[2]) == 0 then
        return redis.call('SREM', KEYS[3], ARGV[1])
      end
      return 0
    `;

    await this.redis.eval(script, [this.queueKey(sessionId), this.inflightQueueKey(sessionId), this.activeSessionsKey()], [String(sessionId)]);
  }

  private queueSeqKey(sessionId: number): string {
    return `grab:queue:seq:${sessionId}`;
  }

  private queueKey(sessionId: number): string {
    return `grab:queue:${sessionId}`;
  }

  private inflightQueueKey(sessionId: number): string {
    return `grab:queue:inflight:${sessionId}`;
  }

  private processedSeqKey(sessionId: number): string {
    return `grab:queue:processed:${sessionId}`;
  }

  private requestKey(requestId: string): string {
    return `grab:req:${requestId}`;
  }

  private activeSessionsKey(): string {
    return 'grab:active-sessions';
  }
}
