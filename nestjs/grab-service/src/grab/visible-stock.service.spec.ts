import { VisibleStockService } from './visible-stock.service';

describe('VisibleStockService', () => {
  it('uses redis stock before db stock and maps available level', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue('87'),
    };
    const ticketClient: any = {
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 1, name: 'A', price: 1280, remainStock: 12 }]),
    };
    const service = new VisibleStockService(redis, ticketClient);

    const result = await service.getSessionVisibleStock(101, [1]);

    expect(redis.get).toHaveBeenCalledWith('grab:stock:101:1');
    expect(result.ticketTypes[0]).toEqual({ ticketTypeId: 1, name: 'A', visibleStock: 87, level: 'AVAILABLE' });
    expect(result.snapshotTime).toEqual(expect.any(String));
  });

  it('uses db remain stock when redis stock is absent and maps hot levels', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue(null),
    };
    const ticketClient: any = {
      listVisibleTicketTypes: jest.fn().mockResolvedValue([
        { ticketTypeId: 1, name: 'A', price: 1280, remainStock: 0 },
        { ticketTypeId: 2, name: 'B', price: 980, remainStock: 8 },
        { ticketTypeId: 3, name: 'C', price: 680, remainStock: 32 },
      ]),
    };
    const service = new VisibleStockService(redis, ticketClient);

    const result = await service.getSessionVisibleStock(101, [1, 2, 3]);

    expect(result.ticketTypes.map((ticket) => ticket.level)).toEqual(['SOLD_OUT', 'LOW', 'HOT']);
  });

  it('marks unknown when neither redis nor metadata stock exists', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue(null),
    };
    const ticketClient: any = {
      listVisibleTicketTypes: jest.fn().mockResolvedValue([{ ticketTypeId: 1, name: 'A', price: 1280, remainStock: null }]),
    };
    const service = new VisibleStockService(redis, ticketClient);

    const result = await service.getSessionVisibleStock(101, [1]);

    expect(result.ticketTypes[0]).toEqual({ ticketTypeId: 1, name: 'A', visibleStock: null, level: 'UNKNOWN' });
  });
});
