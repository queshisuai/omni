import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { requireEnv, requireIntegerEnv } from '../runtime-env';

export interface DatabaseQueryClient {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    host: requireEnv('GRAB_DB_HOST', '抢票数据库地址未配置'),
    port: requireIntegerEnv('GRAB_DB_PORT', '抢票数据库端口未配置', '抢票数据库端口配置无效'),
    database: requireEnv('GRAB_DB_NAME', '抢票数据库名称未配置'),
    user: requireEnv('GRAB_DB_USER', '抢票数据库用户未配置'),
    password: requireEnv('GRAB_DB_PASSWORD', '抢票数据库密码未配置'),
  });

  query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async withTransaction<T>(callback: (client: DatabaseQueryClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
