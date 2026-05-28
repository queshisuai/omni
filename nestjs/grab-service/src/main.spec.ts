const mockServerListen = jest.fn((_port: number, _backlog: number, callback: () => void) => callback());
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockEnableCors = jest.fn();

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: async () => ({
      enableCors: mockEnableCors,
      init: mockInit,
      getHttpServer: () => ({ listen: mockServerListen }),
    }),
  },
}));

describe('grab-service bootstrap', () => {
  beforeEach(() => {
    mockServerListen.mockClear();
    mockInit.mockClear();
    mockEnableCors.mockClear();
    process.env.GRAB_SERVICE_PORT = '3002';
  });

  it('listens with an explicit backlog for high-concurrency admission traffic', async () => {
    const main = require('./main') as typeof import('./main');

    await main.bootstrap();

    expect(mockEnableCors).toHaveBeenCalled();
    expect(mockInit).toHaveBeenCalled();
    expect(mockServerListen).toHaveBeenCalledWith(3002, 2048, expect.any(Function));
  });
});
