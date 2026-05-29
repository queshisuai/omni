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

  it('dequeues from the session FIFO queue', async () => {
    const redis: any = {
      lpop: jest.fn().mockResolvedValue('GRAB1'),
    };
    const service = new GrabQueueService(redis);

    await expect(service.dequeue(101)).resolves.toBe('GRAB1');
    expect(redis.lpop).toHaveBeenCalledWith('grab:queue:101');
  });

  it('removes active session only when the queue is empty using an atomic Redis script', async () => {
    const redis: any = {
      eval: jest.fn().mockResolvedValue(1),
      srem: jest.fn(),
    };
    const service = new GrabQueueService(redis);

    await service.removeActiveSessionIfQueueEmpty(101);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('LLEN', KEYS[1]) == 0");
    expect(script).toContain("redis.call('SREM', KEYS[2], ARGV[1])");
    expect(keys).toEqual(['grab:queue:101', 'grab:active-sessions']);
    expect(args).toEqual(['101']);
    expect(redis.srem).not.toHaveBeenCalled();
  });
});
