import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class GrabService {
  private readonly GRAB_LUA_SCRIPT = `
    local stockKey = KEYS[1]
    local userKey = KEYS[2]
    local userId = ARGV[1]
    local sessionId = ARGV[2]
    local ticketTypeId = ARGV[3]

    local stock = redis.call('get', stockKey)
    if not stock or tonumber(stock) <= 0 then
      return -1
    end

    local userGrabKey = userKey .. ':' .. userId .. ':' .. sessionId .. ':' .. ticketTypeId
    local hasGrabbed = redis.call('get', userGrabKey)
    if hasGrabbed then
      return -2
    end

    redis.call('decr', stockKey)
    redis.call('setex', userGrabKey, 300, '1')

    return 1
  `;

  constructor(private readonly redisService: RedisService) {}

  async grabTicket(
    userId: string,
    sessionId: string,
    ticketTypeId: string,
  ): Promise<{ success: boolean; message: string }> {
    const stockKey = `stock:${sessionId}:${ticketTypeId}`;
    const userKey = 'grab:user';

    const result = await this.redisService.eval(
      this.GRAB_LUA_SCRIPT,
      [stockKey, userKey],
      [userId, sessionId, ticketTypeId],
    );

    if (result === 1) {
      return { success: true, message: '抢票成功' };
    } else if (result === -1) {
      return { success: false, message: '库存不足' };
    } else if (result === -2) {
      return { success: false, message: '已抢过该票' };
    }

    return { success: false, message: '抢票失败' };
  }

  async initStock(sessionId: string, ticketTypeId: string, stock: number): Promise<void> {
    const stockKey = `stock:${sessionId}:${ticketTypeId}`;
    await this.redisService.set(stockKey, stock.toString());
  }

  async getStock(sessionId: string, ticketTypeId: string): Promise<number> {
    const stockKey = `stock:${sessionId}:${ticketTypeId}`;
    const stock = await this.redisService.get(stockKey);
    return stock ? parseInt(stock) : 0;
  }
}