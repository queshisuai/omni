const mockServerListen = jest.fn((_port: number, _host: string, _backlog: number, callback: () => void) => callback());
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
  const originalEnv = process.env;

  beforeEach(() => {
    mockServerListen.mockClear();
    mockInit.mockClear();
    mockEnableCors.mockClear();
    process.env = {
      ...originalEnv,
      GRAB_SERVICE_PORT: '3002',
      GRAB_SERVICE_HOST: '127.0.0.1',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('listens with an explicit backlog for high-concurrency admission traffic', async () => {
    const main = require('./main') as typeof import('./main');

    await main.bootstrap();

    expect(mockEnableCors).toHaveBeenCalled();
    expect(mockInit).toHaveBeenCalled();
    expect(mockServerListen).toHaveBeenCalledWith(3002, '127.0.0.1', 2048, expect.any(Function));
  });

  it('requires an explicit listen host instead of falling back to loopback', async () => {
    delete process.env.GRAB_SERVICE_HOST;
    const main = require('./main') as typeof import('./main');

    await expect(main.bootstrap()).rejects.toThrow('抢票服务监听地址未配置');

    expect(mockServerListen).not.toHaveBeenCalled();
  });
});
