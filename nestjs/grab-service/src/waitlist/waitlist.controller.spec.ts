import { WaitlistController } from './waitlist.controller';
import { WaitlistAllocatorService } from './waitlist-allocator.service';

describe('WaitlistController', () => {
  it('uses concrete allocator dependency metadata for Nest injection', () => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', WaitlistController);

    expect(paramTypes[1]).toBe(WaitlistAllocatorService);
  });

  it('creates entries for authenticated user id', async () => {
    const service = {
      createEntry: jest.fn().mockResolvedValue({ id: 1, status: 'WAITING', rank: 3 }),
    };
    const controller = new WaitlistController(service as any, {} as any);

    const result = await controller.create({ user: { userId: 2004 } } as any, { sessionId: 101, ticketTypeId: 202, quantity: 1 });

    expect(service.createEntry).toHaveBeenCalledWith(2004, { sessionId: 101, ticketTypeId: 202, quantity: 1 });
    expect(result).toEqual({ code: 200, message: '成功', data: { id: 1, status: 'WAITING', rank: 3 } });
  });

  it('routes release events to allocator through internal endpoint', async () => {
    process.env.INTERNAL_API_TOKEN = 'internal-token';
    const allocator = {
      allocate: jest.fn().mockResolvedValue({ status: 'NO_MATCH' }),
    };
    const controller = new WaitlistController({} as any, allocator as any);

    const result = await controller.released('internal-token', {
      eventKey: 'release-1',
      source: 'ORDER_TIMEOUT',
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
    });

    expect(allocator.allocate).toHaveBeenCalled();
    expect(result).toEqual({ code: 200, message: '成功', data: { status: 'NO_MATCH' } });
  });

  it('rejects internal calls with a Chinese error message', async () => {
    process.env.INTERNAL_API_TOKEN = 'internal-token';
    const controller = new WaitlistController({} as any, { allocate: jest.fn() } as any);

    await expect(controller.released('wrong-token', {
      eventKey: 'release-1',
      source: 'ORDER_TIMEOUT',
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
    })).rejects.toMatchObject({
      message: '内部接口令牌无效',
    });
  });
});
