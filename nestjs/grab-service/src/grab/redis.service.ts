import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { requireEnv, requireIntegerEnv } from '../runtime-env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: requireEnv('REDIS_HOST', 'Redis 地址未配置'),
      port: requireIntegerEnv('REDIS_PORT', 'Redis 端口未配置', 'Redis 端口配置无效'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async setIfAbsent(key: string, value: string): Promise<boolean> {
    return (await this.client.set(key, value, 'NX')) === 'OK';
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  async rpush(key: string, value: string): Promise<number> {
    return this.client.rpush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async sadd(key: string, value: string): Promise<number> {
    return this.client.sadd(key, value);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async srem(key: string, value: string): Promise<number> {
    return this.client.srem(key, value);
  }

  async hset(key: string, values: Record<string, string>): Promise<number> {
    return this.client.hset(key, values);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async existsByPattern(pattern: string): Promise<boolean> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      if (keys.length > 0) return true;
      cursor = nextCursor;
    } while (cursor !== '0');
    return false;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async del(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async eval(script: string, keys: string[], args: string[]): Promise<any> {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
