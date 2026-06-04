import { GrabStockService } from './grab-stock.service';

describe('GrabStockService', () => {
  it('initializes missing grab stock from ticket remain stock with set-if-absent', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValueOnce(null),
      setIfAbsent: jest.fn().mockResolvedValue(true),
    };
    const ticketClient: any = {
      listVisibleTicketTypes: jest.fn().mockResolvedValue([
        { ticketTypeId: 202, name: '普通票', price: 180, remainStock: 112 },
      ]),
    };
    const service = new GrabStockService(redis, ticketClient);

    const stock = await service.ensureInitialized(101, 202);

    expect(stock).toBe(112);
    expect(ticketClient.listVisibleTicketTypes).toHaveBeenCalledWith(101, [202]);
    expect(redis.setIfAbsent).toHaveBeenCalledWith('grab:stock:101:202', '112');
  });

  it('keeps existing redis stock when another request initialized first', async () => {
    const redis: any = {
      get: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('87'),
      setIfAbsent: jest.fn().mockResolvedValue(false),
    };
    const ticketClient: any = {
      listVisibleTicketTypes: jest.fn().mockResolvedValue([
        { ticketTypeId: 202, name: '普通票', price: 180, remainStock: 112 },
      ]),
    };
    const service = new GrabStockService(redis, ticketClient);

    const stock = await service.ensureInitialized(101, 202);

    expect(stock).toBe(87);
    expect(redis.setIfAbsent).toHaveBeenCalledWith('grab:stock:101:202', '112');
  });

  it('refreshes stale redis stock from ticket remain stock when no active hold exists', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue('0'),
      existsByPattern: jest.fn().mockResolvedValue(false),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const ticketClient: any = {};
    const service = new GrabStockService(redis, ticketClient);

    const stock = await service.syncFromTicketInfo(101, {
      ticketTypeId: 202,
      name: 'A',
      price: 180,
      remainStock: 112,
    });

    expect(stock).toBe(112);
    expect(redis.existsByPattern).toHaveBeenCalledWith('grab:user-hold:*:101:202');
    expect(redis.set).toHaveBeenCalledWith('grab:stock:101:202', '112');
  });

  it('caps synced stock at ticket total stock when backend remain stock is too high', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue('440'),
      existsByPattern: jest.fn().mockResolvedValue(false),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const ticketClient: any = {};
    const service = new GrabStockService(redis, ticketClient);

    const stock = await service.syncFromTicketInfo(3, {
      ticketTypeId: 91,
      name: 'A',
      price: 280,
      remainStock: 440,
      totalStock: 300,
    });

    expect(stock).toBe(300);
    expect(redis.set).toHaveBeenCalledWith('grab:stock:3:91', '300');
  });

  it('keeps lower redis stock while an active hold exists', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue('110'),
      existsByPattern: jest.fn().mockResolvedValue(true),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const ticketClient: any = {};
    const service = new GrabStockService(redis, ticketClient);

    const stock = await service.syncFromTicketInfo(101, {
      ticketTypeId: 202,
      name: 'A',
      price: 180,
      remainStock: 112,
    });

    expect(stock).toBe(110);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('syncs redis downward even when active holds exist', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue('120'),
      existsByPattern: jest.fn().mockResolvedValue(true),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const ticketClient: any = {};
    const service = new GrabStockService(redis, ticketClient);

    const stock = await service.syncFromTicketInfo(101, {
      ticketTypeId: 202,
      name: 'A',
      price: 180,
      remainStock: 112,
    });

    expect(stock).toBe(112);
    expect(redis.set).toHaveBeenCalledWith('grab:stock:101:202', '112');
  });
});
