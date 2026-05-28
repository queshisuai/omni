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

  it('passes through requests when redis stock is not initialized', async () => {
    const evalMock = jest.fn().mockResolvedValue(['BYPASSED', 'GRAB202605270001']);
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

    expect(result).toEqual({ outcome: 'BYPASSED', existingRequestId: 'GRAB202605270001' });
  });

  it('can release holds without restoring stock when admission bypassed stock', async () => {
    const redis = { incrBy: jest.fn(), del: jest.fn().mockResolvedValue(2) };
    const service = new GrabAdmissionService(redis as any);

    await service.release({
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 2,
      seatIds: [301],
      idempotencyKey: 'idem-1',
      restoreStock: false,
    });

    expect(redis.incrBy).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith([
      'grab:idempotency:2004:idem-1',
      'grab:user-hold:2004:101:202',
      'grab:seat-hold:301',
    ]);
  });
});
