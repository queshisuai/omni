import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TeamGrabRepository } from '../team-grab/team-grab.repository';
import { TeamGrabService } from '../team-grab/team-grab.service';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabCompensationService } from './grab-compensation.service';
import { GrabController, GrabSessionController } from './grab.controller';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository } from './grab.repository';
import { GrabService } from './grab.service';
import { GrabWorkerService } from './grab-worker.service';
import { OrderClientService } from './order-client.service';
import { RedisService } from './redis.service';
import { TicketClientService } from './ticket-client.service';
import { VisibleStockService } from './visible-stock.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GrabController, GrabSessionController],
  providers: [
    GrabService,
    GrabRepository,
    GrabAdmissionService,
    GrabCompensationService,
    GrabQueueService,
    GrabWorkerService,
    OrderClientService,
    RedisService,
    TicketClientService,
    VisibleStockService,
    TeamGrabRepository,
    TeamGrabService,
  ],
  exports: [GrabService, TeamGrabService],
})
export class GrabModule {}
