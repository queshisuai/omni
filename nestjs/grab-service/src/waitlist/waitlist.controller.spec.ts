import { WaitlistController } from './waitlist.controller';
import { WaitlistAllocatorService } from './waitlist-allocator.service';
import { UnauthorizedException } from '@nestjs/common';

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

  it('rejects internal user waitlist list when internal token is invalid', async () => {
    const previous = process.env.INTERNAL_API_TOKEN;
    process.env.INTERNAL_API_TOKEN = 'internal-token';
    const service = {
      listByUser: jest.fn(),
    };
    const controller = new WaitlistController(service as any, {} as any);

    await expect(controller.internalListByUser('wrong-token', '2004', '5')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.listByUser).not.toHaveBeenCalled();
    process.env.INTERNAL_API_TOKEN = previous;
  });

  it('lists user waitlist entries through internal token', async () => {
    const previous = process.env.INTERNAL_API_TOKEN;
    process.env.INTERNAL_API_TOKEN = 'internal-token';
    const response = [{ id: 1, status: 'WAITING', rank: 3 }];
    const service = {
      listByUser: jest.fn().mockResolvedValue(response),
    };
    const controller = new WaitlistController(service as any, {} as any);

    const result = await controller.internalListByUser('internal-token', '2004', '1');

    expect(service.listByUser).toHaveBeenCalledWith(2004, 1);
    expect(result).toEqual({ code: 200, message: '成功', data: response });
    process.env.INTERNAL_API_TOKEN = previous;
  });
});
