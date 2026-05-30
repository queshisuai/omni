import { GrabAdmissionService } from './grab-admission.service';


describe('GrabAdmissionService', () => {
  it('passes all admission keys and arguments to the Lua script', async () => {
    const evalMock = jest.fn().mockResolvedValue(['ACCEPTED', 'GRAB202605270001']);
    const service = new GrabAdmissionService({ eval: evalMock } as any);

    const result = await service.admit({
      requestId: 'GRAB202605270001',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [301, 302],
      idempotencyKey: 'idem-1',
      ttlSeconds: 900,
    });

    expect(evalMock).toHaveBeenCalledWith(expect.stringContaining('grab:stock'), [
      'grab:stock:101:202',
      'grab:idempotency:2004:idem-1',
      'grab:user-hold:2004:101:202',
      'grab:admission:GRAB202605270001',
      'grab:seat-hold:301',
      'grab:seat-hold:302',
    ], [
      'GRAB202605270001',
      '2004',
      '101',
      '202',
      '2',
      '900',
      '2',
    ]);
    expect(result).toEqual({ outcome: 'ACCEPTED', existingRequestId: 'GRAB202605270001' });
  });

  it('rejects requests when redis stock is not initialized', async () => {
    const evalMock = jest.fn(async (script: string) => {
      expect(script).toContain("return {'STOCK_UNINITIALIZED', ''}");
      expect(script).not.toContain("return {'BYPASSED', requestId}");
      return ['STOCK_UNINITIALIZED', ''];
    });
    const service = new GrabAdmissionService({ eval: evalMock } as any);

    const result = await service.admit({
      requestId: 'GRAB202605270001',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [],
      idempotencyKey: 'idem-1',
      ttlSeconds: 900,
    });

    expect(result).toEqual({ outcome: 'STOCK_UNINITIALIZED', existingRequestId: null });
  });

  it('restores stock and clears hold when releasing an accepted admission', async () => {
    const redis = { eval: jest.fn().mockResolvedValue(1), incrBy: jest.fn(), del: jest.fn() };
    const service = new GrabAdmissionService(redis as any);

    await service.release({
      requestId: 'GRAB202605270001',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [301],
      idempotencyKey: 'idem-1',
    });

    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining('markerKey'), [
      'grab:stock:101:202',
      'grab:idempotency:2004:idem-1',
      'grab:user-hold:2004:101:202',
      'grab:admission:GRAB202605270001',
      'grab:seat-hold:301',
    ], ['GRAB202605270001', '1', 'true']);
    const script = redis.eval.mock.calls[0][0];
    expect(script).toContain("redis.call('HGET', markerKey, 'restored')");
    expect(script).toContain("redis.call('HSET', markerKey, 'restored', '1')");
    expect(script.indexOf("redis.call('HGET', markerKey, 'restored')")).toBeLessThan(script.indexOf("redis.call('INCRBY', KEYS[1], markerQuantity)"));
    expect(redis.incrBy).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('release restores stock from a durable admission marker even after idempotency ttl expired', async () => {
    const redis = { eval: jest.fn().mockResolvedValue(1) };
    const service = new GrabAdmissionService(redis as any);

    await service.release({
      requestId: 'GRAB202605270001',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [],
      idempotencyKey: 'idem-1',
    });

    const script = redis.eval.mock.calls[0][0];
    expect(script).not.toContain('return 0');
    expect(script).toContain("local markerQuantity = tonumber(redis.call('HGET', markerKey, 'quantity') or ARGV[2])");
    expect(script).toContain("redis.call('INCRBY', KEYS[1], markerQuantity)");
  });

  it('can clear a matching hold without restoring stock', async () => {
    const redis = { eval: jest.fn().mockResolvedValue(1) };
    const service = new GrabAdmissionService(redis as any);

    await service.release({
      requestId: 'GRAB202605270001',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      idempotencyKey: 'idem-1',
      restoreStock: false,
    });

    expect(redis.eval.mock.calls[0][1]).toContain('grab:admission:GRAB202605270001');
    expect(redis.eval.mock.calls[0][0]).toContain("redis.call('HSET', markerKey, 'restored', '1')");
    expect(redis.eval.mock.calls[0][2]).toEqual(['GRAB202605270001', '1', 'false']);
  });
});
