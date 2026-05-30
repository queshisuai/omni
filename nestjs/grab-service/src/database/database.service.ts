import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';

export interface DatabaseQueryClient {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    host: process.env.GRAB_DB_HOST || 'localhost',
    port: Number(process.env.GRAB_DB_PORT || 5432),
    database: process.env.GRAB_DB_NAME || 'omni_grab',
    user: process.env.GRAB_DB_USER || 'postgres',
    password: process.env.GRAB_DB_PASSWORD || '123456',
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
