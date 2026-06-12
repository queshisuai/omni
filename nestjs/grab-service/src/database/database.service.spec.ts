import { Pool } from 'pg';
import { DatabaseService } from './database.service';

jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

describe('DatabaseService', () => {
  const PoolMock = Pool as unknown as jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    PoolMock.mockReset();
    process.env = {
      ...originalEnv,
      GRAB_DB_HOST: 'db.local',
      GRAB_DB_PORT: '5432',
      GRAB_DB_NAME: 'omni_grab',
      GRAB_DB_USER: 'grab_user',
      GRAB_DB_PASSWORD: 'grab-password',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('commits and releases successful transactions', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = jest.fn();
    PoolMock.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue({ query, release }),
      query: jest.fn(),
      end: jest.fn(),
    }));

    const database = new DatabaseService();

    const result = await database.withTransaction((client) => client.query('select 1'));

    expect(result).toEqual({ rows: [{ id: 1 }] });
    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenNthCalledWith(2, 'select 1');
    expect(query).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases failed transactions', async () => {
    const error = new Error('insert failed');
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ rows: [] });
    const release = jest.fn();
    PoolMock.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue({ query, release }),
      query: jest.fn(),
      end: jest.fn(),
    }));

    const database = new DatabaseService();

    await expect(database.withTransaction((client) => client.query('insert into x values (1)'))).rejects.toBe(error);

    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenNthCalledWith(2, 'insert into x values (1)');
    expect(query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('fails during initialization when database environment is missing', () => {
    delete process.env.GRAB_DB_HOST;

    expect(() => new DatabaseService()).toThrow('抢票数据库地址未配置');
    expect(PoolMock).not.toHaveBeenCalled();
  });
});
