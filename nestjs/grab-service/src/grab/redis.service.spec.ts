import Redis from 'ioredis';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    quit: jest.fn(),
  })),
}));

describe('RedisService', () => {
  const RedisMock = Redis as unknown as jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    RedisMock.mockClear();
    process.env = {
      ...originalEnv,
      REDIS_HOST: 'redis.local',
      REDIS_PORT: '6379',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates a client with explicit Redis environment', () => {
    new RedisService();

    expect(RedisMock).toHaveBeenCalledWith({
      host: 'redis.local',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
    });
  });

  it('fails during initialization when Redis host is missing', () => {
    delete process.env.REDIS_HOST;

    expect(() => new RedisService()).toThrow('Redis 地址未配置');
    expect(RedisMock).not.toHaveBeenCalled();
  });
});
