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
    const redis = { incrBy: jest.fn(), del: jest.fn().mockResolvedValue(2) };
    const service = new GrabAdmissionService(redis as any);

    await service.release({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [301],
      idempotencyKey: 'idem-1',
    });

    expect(redis.incrBy).toHaveBeenCalledWith('grab:stock:101:202', 1);
    expect(redis.del).toHaveBeenCalledWith([
      'grab:idempotency:2004:idem-1',
      'grab:user-hold:2004:101:202',
      'grab:seat-hold:301',
    ]);
  });
});
