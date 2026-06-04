import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TeamGrabRepository } from '../team-grab/team-grab.repository';
import { TeamGrabController } from '../team-grab/team-grab.controller';
import { NotificationClientService } from '../team-grab/notification-client.service';
import { TeamLockRecoveryService } from '../team-grab/team-lock-recovery.service';
import { TeamGrabProcessorService } from '../team-grab/team-grab-processor.service';
import { TeamGrabService } from '../team-grab/team-grab.service';
import { TeamPaymentSyncService } from '../team-grab/team-payment-sync.service';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabCompensationService } from './grab-compensation.service';
import { GrabController, GrabSessionController } from './grab.controller';
import { GrabOpsController } from './grab-ops.controller';
import { GrabOpsService } from './grab-ops.service';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository } from './grab.repository';
import { GrabService } from './grab.service';
import { GrabStockService } from './grab-stock.service';
import { GrabWorkerService } from './grab-worker.service';
import { OrderClientService } from './order-client.service';
import { RedisService } from './redis.service';
import { TicketClientService } from './ticket-client.service';
import { VisibleStockService } from './visible-stock.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GrabController, GrabSessionController, GrabOpsController, TeamGrabController],
  providers: [
    GrabService,
    GrabRepository,
    GrabAdmissionService,
    GrabCompensationService,
    GrabOpsService,
    GrabQueueService,
    GrabWorkerService,
    GrabStockService,
    OrderClientService,
    RedisService,
    TicketClientService,
    VisibleStockService,
    TeamGrabRepository,
    TeamGrabService,
    TeamGrabProcessorService,
    TeamPaymentSyncService,
    TeamLockRecoveryService,
    NotificationClientService,
  ],
  exports: [GrabService, TeamGrabService],
})
export class GrabModule {}
