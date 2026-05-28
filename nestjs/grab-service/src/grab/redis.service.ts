import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
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

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrBy(key: string, increment: number): Promise<number> {
    return this.client.incrby(key, increment);
  }

  async del(keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async eval(script: string, keys: string[], args: string[]): Promise<any> {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }
}