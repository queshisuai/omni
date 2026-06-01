import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

describe('WaitlistService', () => {
  const entry = {
    id: 1,
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 1,
    seatPreference: null,
    status: 'WAITING',
    priorityNo: 8,
    offerOrderId: null,
    offerExpireTime: null,
    failReason: null,
    createTime: new Date('2026-05-31T00:00:00Z'),
    updateTime: new Date('2026-05-31T00:00:00Z'),
  } as const;

  it('creates a waitlist entry with attendee ids and returns rank', async () => {
    const repository = {
      createEntry: jest.fn().mockResolvedValue({ entry, rank: 3 }),
    };
    const service = new WaitlistService(repository as any);

    const result = await service.createEntry(2004, { sessionId: 101, ticketTypeId: 202, quantity: 1, attendeeIds: [501] });

    expect(repository.createEntry).toHaveBeenCalledWith({ userId: 2004, sessionId: 101, ticketTypeId: 202, quantity: 1, attendeeIds: [501] });
    expect(result).toMatchObject({
      id: 1,
      status: 'WAITING',
      rank: 3,
      estimatedChance: 'HIGH',
      estimatedChanceText: '机会较高',
      estimatedWaitText: '排位靠前，释放票后会优先通知',
    });
  });

  it('rejects invalid quantity', async () => {
    const service = new WaitlistService({ createEntry: jest.fn() } as any);

    await expect(service.createEntry(2004, { sessionId: 101, ticketTypeId: 202, quantity: 0 })).rejects.toMatchObject({
      message: '候补数量必须为 1-6 张',
    });
  });

  it('rejects attendee ids when count does not match quantity', async () => {
    const service = new WaitlistService({ createEntry: jest.fn() } as any);

    await expect(service.createEntry(2004, { sessionId: 101, ticketTypeId: 202, quantity: 2, attendeeIds: [501] })).rejects.toMatchObject({
      message: '实名观演人数必须与候补数量一致',
    });
  });

  it('maps active duplicate entries to conflict', async () => {
    const repository = {
      createEntry: jest.fn().mockRejectedValue({ code: '23505' }),
    };
    const service = new WaitlistService(repository as any);

    await expect(service.createEntry(2004, { sessionId: 101, ticketTypeId: 202, quantity: 1 })).rejects.toMatchObject({
      message: '已加入该场次票档候补',
    });
  });

  it('only cancels waiting entries owned by the user', async () => {
    const repository = {
      cancelWaitingEntry: jest.fn().mockResolvedValue(null),
    };
    const service = new WaitlistService(repository as any);

    await expect(service.cancelEntry(2004, 1)).rejects.toMatchObject({
      message: '未找到可取消的候补记录',
    });
    expect(repository.cancelWaitingEntry).toHaveBeenCalledWith(1, 2004);
  });
});
