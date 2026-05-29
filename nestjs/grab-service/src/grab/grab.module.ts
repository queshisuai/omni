import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabCompensationService } from './grab-compensation.service';
import { GrabController } from './grab.controller';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository } from './grab.repository';
import { GrabService } from './grab.service';
import { OrderClientService } from './order-client.service';
import { RedisService } from './redis.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GrabController],
  providers: [
    GrabService,
    GrabRepository,
    GrabAdmissionService,
    GrabCompensationService,
    GrabQueueService,
    OrderClientService,
    RedisService,
  ],
  exports: [GrabService],
})
export class GrabModule {}
