import { type EnqueueRequest, type EnqueueResult, GrabQueueService } from './grab-queue.service';

describe('GrabQueueService', () => {
  it('assigns a queue sequence and enqueues request FIFO by session', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue(12),
      incr: jest.fn(),
      rpush: jest.fn(),
      sadd: jest.fn(),
      hset: jest.fn(),
      get: jest.fn().mockResolvedValue('7'),
    };
    const service = new GrabQueueService(redis);

    const request: EnqueueRequest = {
      requestId: 'GRAB1',
      sessionId: 101,
      userId: 2004,
    };

    const result: EnqueueResult = await service.enqueue(request);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('INCR', KEYS[1])");
    expect(script).toContain("redis.call('HSET', KEYS[2]");
    expect(script).toContain("redis.call('RPUSH', KEYS[3], ARGV[1])");
    expect(script).toContain("redis.call('SADD', KEYS[4], ARGV[2])");
    expect(keys).toEqual(['grab:queue:seq:101', 'grab:req:GRAB1', 'grab:queue:101', 'grab:active-sessions']);
    expect(args).toEqual(['GRAB1', '101', '2004', 'QUEUED']);
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.rpush).not.toHaveBeenCalled();
    expect(redis.sadd).not.toHaveBeenCalled();
    expect(redis.hset).not.toHaveBeenCalled();
    expect(result).toEqual({ queueSeq: 12, queueRank: 4 });
  });

  it('marks processed sequence with an atomic monotonic Redis script', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue(0),
      get: jest.fn(),
      set: jest.fn(),
    };
    const service = new GrabQueueService(redis);

    await service.markProcessed(101, 18);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('GET', KEYS[1])");
    expect(script).toContain('if newSeq > currentSeq then');
    expect(script).toContain("redis.call('SET', KEYS[1], ARGV[1])");
    expect(keys).toEqual(['grab:queue:processed:101']);
    expect(args).toEqual(['18']);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('dequeues into inflight using an atomic Redis script', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue('GRAB1'),
      lpop: jest.fn(),
    };
    const service = new GrabQueueService(redis);

    await expect(service.dequeue(101)).resolves.toBe('GRAB1');
    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('LPOP', KEYS[1])");
    expect(script).toContain("redis.call('RPUSH', KEYS[2], requestId)");
    expect(keys).toEqual(['grab:queue:101', 'grab:queue:inflight:101']);
    expect(redis.lpop).not.toHaveBeenCalled();
  });

  it('acks processed inflight request and advances processed sequence atomically', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue(1),
    };
    const service = new GrabQueueService(redis);

    await service.ackProcessed(101, 'GRAB1', 18);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('LREM', KEYS[1], 1, ARGV[1])");
    expect(script).toContain("redis.call('GET', KEYS[2])");
    expect(script).toContain('if newSeq > currentSeq then');
    expect(script).toContain("redis.call('SET', KEYS[2], ARGV[2])");
    expect(keys).toEqual(['grab:queue:inflight:101', 'grab:queue:processed:101']);
    expect(args).toEqual(['GRAB1', '18']);
  });

  it('does not advance processed sequence when ack misses inflight request', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue(0),
    };
    const service = new GrabQueueService(redis);

    await service.ackProcessed(101, 'GRAB1', 18);

    const [script] = redis.eval.mock.calls[0];
    expect(script).toContain("local removed = redis.call('LREM', KEYS[1], 1, ARGV[1])");
    expect(script).toContain('if removed <= 0 then');

    const lremIndex = script.indexOf("local removed = redis.call('LREM', KEYS[1], 1, ARGV[1])");
    const guardIndex = script.indexOf('if removed <= 0 then');
    const getIndex = script.indexOf("redis.call('GET', KEYS[2])");
    const setIndex = script.indexOf("redis.call('SET', KEYS[2], ARGV[2])");
    expect(lremIndex).toBeLessThan(guardIndex);
    expect(guardIndex).toBeLessThan(getIndex);
    expect(getIndex).toBeLessThan(setIndex);
  });

  it('requeues inflight request to the front of the session queue atomically', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue(1),
    };
    const service = new GrabQueueService(redis);

    await service.requeueInflight(101, 'GRAB1');

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('LREM', KEYS[1], 1, ARGV[1])");
    expect(script).toContain("redis.call('LPUSH', KEYS[2], ARGV[1])");
    expect(script).toContain("redis.call('SADD', KEYS[3], ARGV[2])");
    expect(keys).toEqual(['grab:queue:inflight:101', 'grab:queue:101', 'grab:active-sessions']);
    expect(args).toEqual(['GRAB1', '101']);
  });

  it('discards orphan inflight request without advancing processed sequence', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue(1),
    };
    const service = new GrabQueueService(redis);

    await service.discardInflight(101, 'GRAB-MISSING');

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('LREM', KEYS[1], 1, ARGV[1])");
    expect(script).not.toContain('processed');
    expect(keys).toEqual(['grab:queue:inflight:101']);
    expect(args).toEqual(['GRAB-MISSING']);
  });

  it('removes active session only when the queue and inflight list are empty using an atomic Redis script', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue(1),
      srem: jest.fn(),
    };
    const service = new GrabQueueService(redis);

    await service.removeActiveSessionIfQueueEmpty(101);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('LLEN', KEYS[1]) == 0");
    expect(script).toContain("redis.call('LLEN', KEYS[2]) == 0");
    expect(script).toContain("redis.call('SREM', KEYS[3], ARGV[1])");
    expect(keys).toEqual(['grab:queue:101', 'grab:queue:inflight:101', 'grab:active-sessions']);
    expect(args).toEqual(['101']);
    expect(redis.srem).not.toHaveBeenCalled();
  });
});
