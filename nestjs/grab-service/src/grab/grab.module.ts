import { Module } from '@nestjs/common';
import { GrabController } from './grab.controller';
import { GrabService } from './grab.service';
import { RedisService } from './redis.service';

@Module({
  controllers: [GrabController],
  providers: [GrabService, RedisService],
  exports: [GrabService],
})
export class GrabModule {}