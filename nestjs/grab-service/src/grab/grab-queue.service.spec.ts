import { GrabQueueService } from './grab-queue.service';

describe('GrabQueueService', () => {
  it('assigns a queue sequence and enqueues request FIFO by session', async () => {
    const redis: any = {
      incr: jest.fn().mockResolvedValue(12),
      rpush: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      hset: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue('7'),
    };
    const service = new GrabQueueService(redis);

    const result = await service.enqueue({
      requestId: 'GRAB1',
      sessionId: 101,
      userId: 2004,
    });

    expect(redis.incr).toHaveBeenCalledWith('grab:queue:seq:101');
    expect(redis.rpush).toHaveBeenCalledWith('grab:queue:101', 'GRAB1');
    expect(redis.sadd).toHaveBeenCalledWith('grab:active-sessions', '101');
    expect(redis.hset).toHaveBeenCalledWith('grab:req:GRAB1', {
      requestId: 'GRAB1',
      sessionId: '101',
      userId: '2004',
      queueSeq: '12',
      status: 'QUEUED',
    });
    expect(result).toEqual({ queueSeq: 12, queueRank: 4 });
  });

  it('does not move processed sequence backwards', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue('20'),
      set: jest.fn(),
    };
    const service = new GrabQueueService(redis);

    await service.markProcessed(101, 18);

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
});
