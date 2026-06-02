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

    const result = await controller.create({ user: { userId: 2004 } } as any, { sessionId: 101, ticketTypeId: 202, quantity: 1 } as any);

    expect(service.createEntry).toHaveBeenCalledWith(2004, { sessionId: 101, ticketTypeId: 202, quantity: 1 });
    expect(result).toEqual({ code: 200, message: '成功', data: { id: 1, status: 'WAITING', rank: 3 } });
  });

});
