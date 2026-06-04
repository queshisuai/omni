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
});
