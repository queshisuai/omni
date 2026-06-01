import { ForbiddenException } from '@nestjs/common';
import { GrabOpsController } from './grab-ops.controller';
import { GrabOpsService } from './grab-ops.service';

describe('GrabOpsService', () => {
  it('loads failure reason distribution and waitlist conversion', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          { reason: '票档售罄', count: '7' },
          { reason: '实名重复', count: '2' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ total_count: '10', paid_count: '4' }],
      });
    const service = new GrabOpsService({ query } as any);

    const summary = await service.getSummary();

    expect(summary.failureReasons).toEqual([
      { reason: '票档售罄', count: 7 },
      { reason: '实名重复', count: 2 },
    ]);
    expect(summary.waitlist).toEqual({ totalCount: 10, paidCount: 4, conversionRate: 0.4 });
  });
});

describe('GrabOpsController', () => {
  it('allows platform admin to load operation summary', async () => {
    const summary = {
      failureReasons: [{ reason: '票档售罄', count: 7 }],
      waitlist: { totalCount: 10, paidCount: 4, conversionRate: 0.4 },
    };
    const service = { getSummary: jest.fn().mockResolvedValue(summary) };
    const controller = new GrabOpsController(service as any);

    const result = await controller.summary({ user: { userId: 2002, role: 'admin' } } as any);

    expect(service.getSummary).toHaveBeenCalled();
    expect(result).toEqual({ code: 200, message: '成功', data: summary });
  });

  it('rejects organizer from platform operation summary', async () => {
    const service = { getSummary: jest.fn() };
    const controller = new GrabOpsController(service as any);

    await expect(controller.summary({ user: { userId: 2003, role: 'organizer' } } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getSummary).not.toHaveBeenCalled();
  });
});
